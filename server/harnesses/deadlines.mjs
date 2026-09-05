/**
 * Harness adapter: the countdown post — one worker per deadline, days left over his head.
 *
 * The list lives in server/deadlines.json (or DEADLINES_FILE, so the one on the data volume
 * can be edited without a release). A deadline inside a week raises a hand; a past one is
 * beamed away the next morning. Dates are Kansas City dates.
 */
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const FILE = process.env.DEADLINES_FILE || path.join(here, '..', 'deadlines.json')
const ZONE = 'Countdown'
const TTL_MS = 60 * 1000
const SOON_DAYS = 7
const BORN = Date.parse('2026-09-05T12:00:00Z')
const NL = String.fromCharCode(10)

function kcToday() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const get = (t) => parts.find((p) => p.type === t)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}
const dayNumber = (iso) => Math.round(Date.parse(`${iso}T12:00:00Z`) / 86400000)
const fmtDate = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })

async function fetchThreads() {
  let list = []
  try {
    list = JSON.parse(await fsp.readFile(FILE, 'utf8'))
  } catch (err) {
    throw new Error(`deadlines: ${err.message}`)
  }
  if (!Array.isArray(list)) list = []
  const today = dayNumber(kcToday())
  const now = Date.now()
  const out = []
  const live = list
    .filter((d) => d && d.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date))
    .map((d) => ({ ...d, left: dayNumber(d.date) - today }))
    .filter((d) => d.left >= -1) // yesterday's still shows once, beamed away after
    .sort((a, b) => a.left - b.left)

  const soon = live.filter((d) => d.left >= 0 && d.left <= SOON_DAYS)
  out.push({
    id: 'deadline:post',
    kind: 'keeper',
    landmark: 'countdown',
    roof: live.length ? `${live.length} ahead` : 'clear',
    title: '⏳ Countdown',
    preview: live.length ? live.map((d) => `• ${d.left <= 0 ? (d.left === 0 ? 'today' : 'yesterday') : `${d.left}d`}: ${d.title}`).join(NL) : 'nothing on the calendar',
    details: { Next: live[0] ? `${live[0].title} in ${live[0].left} day${live[0].left === 1 ? '' : 's'}` : '', 'Within a week': soon.map((d) => d.title).join(', ') || 'none', Edit: FILE },
    project: ZONE,
    projectPath: 'deadlines://post',
    worktree: '',
    cwd: 'deadlines',
    gitBranch: soon.length ? `${soon.length} this week` : '',
    model: '',
    effort: '',
    createdAt: BORN,
    lastActivityAt: now,
    lastFocusedAt: 0,
    running: false,
    unread: false,
    hasError: false,
    starred: false,
    routine: '',
    prState: '',
    archived: false,
    hasTranscript: false,
    sizeBytes: 2000,
    source: 'deadlines',
    canOpen: false,
    canArchive: false,
    ref: { post: true },
  })

  for (const d of live) {
    const when = fmtDate.format(new Date(`${d.date}T12:00:00Z`))
    const plate = d.left < 0 ? 'gone' : d.left === 0 ? 'today' : `${d.left}d`
    out.push({
      id: `deadline:${d.id || d.title}`,
      kind: 'deadline',
      plate,
      title: `⏳ ${d.title}`,
      preview: [`${when}${d.time ? ` ${d.time}` : ''} · ${d.left < 0 ? 'was yesterday' : d.left === 0 ? 'TODAY' : `${d.left} day${d.left === 1 ? '' : 's'} left`}`, d.note || ''].filter(Boolean).join(NL),
      details: { When: `${when}${d.time ? ` at ${d.time}` : ''}`, 'Days left': d.left < 0 ? 'passed' : String(d.left), Notes: d.note || '', Link: d.url || '' },
      project: ZONE,
      projectPath: 'deadlines://post',
      worktree: '',
      cwd: 'deadlines',
      gitBranch: d.left <= SOON_DAYS ? 'this week' : when,
      model: '',
      effort: '',
      createdAt: BORN + (dayNumber(d.date) % 1000),
      lastActivityAt: now,
      lastFocusedAt: 0,
      running: false,
      unread: d.left >= 0 && d.left <= SOON_DAYS,
      hasError: false,
      starred: false,
      routine: '',
      prState: '',
      archived: false,
      hasTranscript: false,
      sizeBytes: 1500,
      source: 'deadlines',
      canOpen: Boolean(d.url),
      canArchive: false,
      exit: 'beam',
      ref: { id: d.id || d.title, url: d.url || '' },
    })
  }
  return out
}

let cache = { at: 0, data: null, inflight: null }
async function scanThreads() {
  const age = Date.now() - cache.at
  if (cache.data && age < TTL_MS) return cache.data
  if (!cache.inflight) {
    cache.inflight = fetchThreads()
      .then((data) => {
        cache = { at: Date.now(), data, inflight: null }
        return data
      })
      .catch((err) => {
        cache.inflight = null
        console.warn('deadlines:', err.message)
        return cache.data || []
      })
  }
  return cache.data || cache.inflight
}

export default {
  id: 'deadlines',
  name: 'Countdown',
  detect: async () => true,
  scanThreads,
  openThread: (ref) => (ref?.url ? { ok: true, browser: true, url: ref.url } : { ok: false, error: 'No link on this one' }),
  newSession: () => ({ ok: false, error: `Add a line to ${FILE}` }),
  setArchived: async () => ({ ok: false, error: 'It leaves on its own once the day has passed' }),
}
