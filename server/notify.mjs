/**
 * The night watch.
 *
 * The map is honest but silent: a hand that goes up at 3am waits until somebody opens the
 * tab. Between the quiet hours this pushes the handful of things that genuinely should wake
 * Blake out through Apprise on the DR box, which fans to ntfy and Gotify — the topic his
 * phone already subscribes to.
 *
 * Deliberately narrow. Only four kinds of thing ring: an alarm at Frances's apartment, a
 * cluster node gone, a disk about to fill, and a backup check that has stopped answering.
 * Everything else waits for morning and turns up in "while you were out" instead. A quiet
 * pager is a pager people still trust at 3am.
 *
 * Each alert is sent once per failure: the key is the thread's own alertKey, so a failure
 * that is still failing at 4am does not ring again, and a genuinely new failure does.
 */
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.BOT_CROSSING_DATA || path.join(here, '..', 'data')
const FILE = path.join(DATA_DIR, 'notified.json')

const ENABLED = process.env.NIGHT_PUSH === '1'
const APPRISE = (process.env.APPRISE_URL || 'http://100.120.190.49:30888/notify/jarvis').replace(/\/$/, '')
const TAG = process.env.APPRISE_TAG || 'jarvis'
/** Quiet hours in Blake's clock: the window where a push is allowed to wake him. */
const QUIET_START = Number(process.env.NIGHT_PUSH_START ?? 22)
const QUIET_END = Number(process.env.NIGHT_PUSH_END ?? 7)
/** A disk is only worth waking somebody for when it is nearly out, not merely busy. */
const DISK_CRITICAL = Number(process.env.DISK_CRITICAL_PCT || 95)
/** Never send more than this many pushes in one sweep, however bad the night is. */
const MAX_PER_SWEEP = 3
const NL = String.fromCharCode(10)

const pct = (s) => Number(String(s || '').replace(/[^0-9.]/g, '')) || 0

/**
 * The four things worth a buzz. Each says what it is and how to recognise it; everything
 * else on the map is deliberately not here.
 */
const WAKE_FOR = [
  {
    what: 'Frances',
    test: (t) => t.id === 'frances:alarm' && t.hasError,
    title: 'Frances: alarm',
  },
  {
    what: 'node',
    test: (t) => t.id.startsWith('node:') && t.hasError,
    title: 'Cluster node down',
  },
  {
    what: 'disk',
    test: (t) => t.id === 'fleet:disks' && t.hasError && pct(t.plate) >= DISK_CRITICAL,
    title: 'Disk nearly full',
  },
  {
    what: 'backup',
    test: (t) => (t.id === 'backup:watch' || t.id === 'jarvis:phyllis') && t.hasError,
    title: 'Backup check failing',
  },
]

/** KC local hour, which is the only clock Blake sleeps on. */
function hourKC(now = new Date()) {
  return Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Chicago' }).format(now))
}

/** Inside the window that wraps past midnight (22:00 → 07:00 by default). */
export function isQuietHours(now = new Date()) {
  const h = hourKC(now)
  return QUIET_START > QUIET_END ? h >= QUIET_START || h < QUIET_END : h >= QUIET_START && h < QUIET_END
}

let sent = null // key → { at, id }
/**
 * True until the first sweep has run against a store that did not exist. Everything already
 * failing when the watch starts is recorded silently: a pager whose first act is to read out
 * the backlog is a pager that gets muted.
 */
let seeding = false
async function load() {
  if (sent) return sent
  try {
    const raw = JSON.parse(await fsp.readFile(FILE, 'utf8'))
    sent = raw && typeof raw === 'object' ? raw : {}
  } catch {
    sent = {}
    seeding = true
  }
  return sent
}
async function save() {
  await fsp.mkdir(DATA_DIR, { recursive: true })
  const tmp = FILE + '.tmp'
  await fsp.writeFile(tmp, JSON.stringify(sent, null, 2))
  await fsp.rename(tmp, FILE)
}

/** Forget alerts older than a week so the file cannot grow without end. */
function prune(map) {
  const cutoff = Date.now() - 7 * 86400000
  for (const [k, v] of Object.entries(map)) if ((v?.at || 0) < cutoff) delete map[k]
}

/** One push. Apprise bakes priority and emoji into its own config, so this only carries text. */
export async function push({ title, body }) {
  const res = await fetch(APPRISE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body, type: 'warning', tag: TAG }),
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) throw new Error(`apprise → ${res.status} ${(await res.text().catch(() => '')).slice(0, 120)}`)
  return true
}

/**
 * Look at a scan and ring for anything new that qualifies. Safe to call on every poll:
 * outside the quiet hours, or with the push switched off, it does nothing at all.
 */
export async function nightWatch(threads) {
  if (!ENABLED || !isQuietHours()) return { sent: 0, skipped: 'quiet hours' }
  const map = await load()
  prune(map)

  const hits = []
  for (const t of threads) {
    if (t.archived || t.acked) continue
    const rule = WAKE_FOR.find((r) => r.test(t))
    if (!rule) continue
    const key = `${t.id}:${String(t.alertKey || t.preview || '').slice(0, 120)}`
    if (map[key]) continue
    hits.push({ rule, thread: t, key })
  }
  // First ever sweep: write down what is already wrong and stay silent. Only a failure that
  // appears after the watch is running is worth waking somebody for.
  if (seeding) {
    seeding = false
    for (const hit of hits) map[hit.key] = { at: Date.now(), id: hit.thread.id, seeded: true }
    await save()
    console.log(`night watch: seeded ${hits.length} existing alerts, none sent`)
    return { sent: 0, seeded: hits.length }
  }
  if (!hits.length) return { sent: 0 }

  let count = 0
  for (const hit of hits.slice(0, MAX_PER_SWEEP)) {
    const t = hit.thread
    const body = [String(t.title || '').replace(/^[^\w(]+\s*/, ''), String(t.preview || '').split(NL)[0]].filter(Boolean).join(NL)
    try {
      await push({ title: `Bot Farm: ${hit.rule.title}`, body: body.slice(0, 400) })
      map[hit.key] = { at: Date.now(), id: t.id }
      count++
      console.log(`night watch: pushed ${hit.rule.what} — ${t.id}`)
    } catch (err) {
      // A pager that cannot page is worth a line in the log, never a crash in the scan.
      console.warn('night watch:', err.message)
    }
  }
  if (count) await save()
  return { sent: count, candidates: hits.length }
}
