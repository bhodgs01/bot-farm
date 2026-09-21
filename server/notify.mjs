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
 * What the watch has rung for lately, newest first. The map is otherwise the only place
 * Blake learns anything, and a pager that fires while he sleeps is invisible to it: he
 * wakes to a notification with no idea whether the colony knows it happened. This is how
 * the morning card can say "you were paged at 3:14, for this".
 */
export async function recentPushes(sinceMs = 12 * 3600 * 1000) {
  const map = await load()
  const cutoff = Date.now() - sinceMs
  return Object.entries(map)
    .filter(([k, v]) => v && !k.startsWith('__') && !v.seeded && (v.at || 0) >= cutoff)
    .map(([key, v]) => ({ at: v.at, id: v.id, title: v.title || '', body: v.body || '', key }))
    .sort((a, b) => b.at - a.at)
}

/**
 * Ring the pager on purpose, so Blake can hear for himself that it works without waiting
 * for something to go wrong at 3am. Deliberately a button he presses rather than something
 * that fires on its own: the one honest test of a pager is the one you are awake for.
 */
export async function pagerTest({ who } = {}) {
  const when = new Date().toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' })
  await push({
    title: 'Bot Farm: pager test',
    body: `This is the night watch checking in at ${when}. A real one only rings for Frances, a node, a disk, or a backup check.`,
  })
  console.log(`night watch: pager test sent${who ? ` by ${who}` : ''}`)
  return { sent: true, at: Date.now() }
}

/**
 * The morning digest.
 *
 * The night watch is deliberately almost silent — four things ring, everything else waits.
 * That leaves a gap at the other end: the map knows what the day holds and says nothing until
 * Blake opens it. So once a morning, one push with what actually wants him.
 *
 * One a day, on purpose. This is the counterweight to a session spent taking alerts away: the
 * point is that a single summary he trusts beats a dozen interruptions he learns to swipe past.
 */
const DIGEST_HOUR = Number(process.env.MORNING_DIGEST_HOUR ?? 7)
const DIGEST_ON = process.env.MORNING_DIGEST !== '0'

function dayKC(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Chicago' }).format(now)
}

export async function morningDigest(threads) {
  if (!DIGEST_ON || !ENABLED) return { sent: 0 }
  const now = new Date()
  if (hourKC(now) !== DIGEST_HOUR) return { sent: 0, skipped: 'not the hour' }
  const map = await load()
  const today = dayKC(now)
  if (map.__digest?.day === today) return { sent: 0, skipped: 'already sent today' }
  // Claim the day before sending: a push that fails should not be retried every poll for
  // the rest of the hour.
  map.__digest = { day: today, at: Date.now() }
  await save()

  const live = threads.filter((t) => !t.archived && !t.acked)
  const wants = live.filter((t) => t.unread || t.hasError)
  const broken = wants.filter((t) => t.hasError)
  const waiting = wants.filter((t) => !t.hasError)
  const name = (t) => String(t.title || '').replace(/^[^\w$]+\s*/, '').slice(0, 42)
  const due = live
    .filter((t) => t.id.startsWith('deadline:') && t.unread)
    .map((t) => name(t))
  const weather = live.find((t) => t.id === 'weather:now')?.plate || ''

  const lines = []
  if (broken.length) lines.push(`Broken (${broken.length}): ${broken.slice(0, 4).map(name).join(', ')}`)
  if (waiting.length) lines.push(`Waiting (${waiting.length}): ${waiting.slice(0, 5).map(name).join(', ')}`)
  if (due.length) lines.push(`Due: ${due.slice(0, 3).join(', ')}`)
  if (weather) lines.push(`Outside: ${weather}`)
  if (!lines.length) lines.push('Nothing wants you. The colony is quiet.')

  const title = wants.length ? `Bot Farm: ${wants.length} want you today` : 'Bot Farm: all quiet'
  try {
    await push({ title, body: lines.join(NL).slice(0, 600) })
    console.log(`morning digest: sent (${wants.length} wanting)`)
    return { sent: 1, wanting: wants.length }
  } catch (err) {
    console.warn('morning digest:', err.message)
    return { sent: 0, error: err.message }
  }
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
    const title = `Bot Farm: ${hit.rule.title}`
    try {
      await push({ title, body: body.slice(0, 400) })
      // Keep what was said, not just that something was: the morning card reads this back.
      map[hit.key] = { at: Date.now(), id: t.id, title, body: body.slice(0, 200) }
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
