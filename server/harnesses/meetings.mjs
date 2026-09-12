/**
 * Harness adapter: Meetings Hub — the recap items Blake has not approved yet.
 *
 * Every recorded meeting comes out of the hub with follow-ups, draft emails and meeting
 * requests that wait for a yes. Until Blake approves or drops them, the meeting owes him a
 * decision, so it stands on the Meetings hex with a hand up. A meeting whose items are all
 * dealt with walks off the map; the hub keeper stays behind with the open-task count.
 *
 * Deliberately quiet about approved tasks: those land in Vikunja project 14, which the
 * tasks harness already carries (calm, on KC Proto). Nothing is counted twice.
 *
 * Read-only: GET /api/meetings, GET /api/tasks.
 */

const BASE = (process.env.MEETINGS_URL || 'http://meetings-hub-api.meetings.svc.cluster.local:3000').replace(/\/$/, '')
const OPEN_URL = (process.env.MEETINGS_OPEN_URL || 'https://meetings.kcproto.com').replace(/\/$/, '')
const ZONE = 'Meetings'
const TTL_MS = 90 * 1000
const BORN = Date.parse('2026-09-12T06:00:00Z')
const NL = String.fromCharCode(10)

const base = {
  worktree: '',
  effort: '',
  model: '',
  lastFocusedAt: 0,
  running: false,
  starred: false,
  routine: '',
  prState: '',
  archived: false,
  hasTranscript: false,
  hasError: false,
  canOpen: true,
  canArchive: false,
  source: 'meetings-hub',
}

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12000) })
  if (!res.ok) throw new Error(`meetings ${path} → ${res.status}`)
  return res.json()
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

/** "6 follow-ups, 1 email, 1 meeting request" — only the parts that actually have something. */
function pendingWords(c) {
  return [
    c.followupsOpen ? plural(c.followupsOpen, 'follow-up', 'follow-ups') : '',
    c.emailsOpen ? plural(c.emailsOpen, 'draft email', 'draft emails') : '',
    c.meetingRequestsOpen ? plural(c.meetingRequestsOpen, 'meeting request', 'meeting requests') : '',
  ]
    .filter(Boolean)
    .join(', ')
}

const when = (iso) => {
  const t = Date.parse(iso || '')
  if (!Number.isFinite(t)) return ''
  return new Date(t).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const daysSince = (iso) => {
  const t = Date.parse(iso || '')
  return Number.isFinite(t) ? Math.floor((Date.now() - t) / 86400000) : 0
}

async function fetchThreads() {
  const now = Date.now()
  const [meetings, tasks] = await Promise.all([
    getJson('/api/meetings').then((j) => (Array.isArray(j.meetings) ? j.meetings : [])),
    getJson('/api/tasks')
      .then((j) => (Array.isArray(j.tasks) ? j.tasks : []))
      .catch(() => []),
  ])

  // Only a meeting with something still unapproved is on the map. A finished one is history,
  // and history belongs in the hub, not underfoot.
  const waiting = meetings.filter((m) => (m.counts?.open || 0) > 0 || m.status === 'processing' || m.error)
  const open = tasks.filter((t) => !t.done)
  const mine = open.filter((t) => /blake/i.test(t.owner || ''))
  const urgent = open.filter((t) => /urgent|high/i.test(t.priority || ''))
  const totalOpen = waiting.reduce((n, m) => n + (m.counts?.open || 0), 0)

  const keeper = {
    ...base,
    id: 'meeting:hub',
    kind: 'keeper',
    landmark: 'clubhouse',
    title: '🗓️ Meetings Hub',
    plate: totalOpen ? String(totalOpen) : '',
    count: totalOpen,
    roof: open.length ? `${open.length} task${open.length === 1 ? '' : 's'}` : 'clear',
    preview: totalOpen
      ? `${plural(totalOpen, 'item', 'items')} from ${plural(waiting.length, 'meeting', 'meetings')} waiting on your yes.`
      : `Nothing to approve. ${open.length ? `${plural(open.length, 'task', 'tasks')} still open in the bundles.` : 'The bundles are clear.'}`,
    details: {
      'Waiting on you': totalOpen ? `${totalOpen} across ${waiting.length} meeting${waiting.length === 1 ? '' : 's'}` : 'nothing',
      'Open tasks': open.length ? String(open.length) : 'none',
      'Yours': mine.length ? mine.slice(0, 12).map((t) => `• ${t.title}${t.due ? ` (${t.due})` : ''}`).join(NL) : 'none assigned to you',
      Urgent: urgent.length ? urgent.slice(0, 8).map((t) => `• ${t.title}`).join(NL) : 'none',
      Recorded: `${meetings.length} meeting${meetings.length === 1 ? '' : 's'} in the hub`,
    },
    project: ZONE,
    projectPath: 'meetings://hub',
    cwd: 'meetings-hub',
    gitBranch: totalOpen ? `${totalOpen} to approve` : 'clear',
    createdAt: BORN,
    lastActivityAt: now,
    unread: false,
    sizeBytes: 4000,
    ref: { url: OPEN_URL },
  }

  const rows = waiting.map((m, i) => {
    const c = m.counts || {}
    const age = daysSince(m.createdAt)
    const stuck = m.status === 'processing'
    const broke = Boolean(m.error)
    const words = pendingWords(c)
    return {
      ...base,
      id: `meeting:${m.id}`,
      title: `🗓️ ${String(m.title || 'Untitled meeting').slice(0, 70)}`,
      preview: broke
        ? `The hub could not finish this one: ${String(m.error).slice(0, 160)}`
        : stuck
          ? 'Still transcribing and writing the recap.'
          : `${words} waiting on your yes${age ? `, ${plural(age, 'day', 'days')} old` : ''}.`,
      details: {
        Meeting: m.title || '',
        Recorded: when(m.createdAt),
        Waiting: words || '',
        With: (m.attendees || []).join(', ') || 'not listed',
        Status: m.status || '',
        Error: m.error || '',
        Approve: 'Open the hub, then approve or drop each item. Approved ones become tasks in a bundle.',
      },
      project: ZONE,
      projectPath: `meetings://${m.id}`,
      cwd: 'meetings-hub',
      gitBranch: broke ? 'failed' : stuck ? 'processing' : `${c.open} to approve`,
      createdAt: Date.parse(m.createdAt || '') || BORN + i,
      lastActivityAt: Date.parse(m.createdAt || '') || now,
      running: stuck,
      // A recap nobody has signed off on is, by definition, waiting on Blake.
      unread: !stuck && !broke,
      hasError: broke,
      alertKey: broke ? `meeting:${m.id}:${String(m.error).slice(0, 80)}` : '',
      sizeBytes: 1000 * (1 + Math.min(20, c.open || 1)),
      ref: { url: OPEN_URL, meeting: m.id },
    }
  })

  return [keeper, ...rows]
}

let cache = { at: 0, data: null, inflight: null }
async function scanThreads() {
  if (cache.data && Date.now() - cache.at < TTL_MS) return cache.data
  if (!cache.inflight) {
    cache.inflight = fetchThreads()
      .then((data) => {
        cache = { at: Date.now(), data, inflight: null }
        return data
      })
      .catch((err) => {
        cache.inflight = null
        console.warn('meetings:', err.message)
        return cache.data || []
      })
  }
  return cache.data || cache.inflight
}

let detectCache = { at: 0, ok: false }
async function detect() {
  if (cache.data) return true
  if (Date.now() - detectCache.at < 60 * 1000) return detectCache.ok
  try {
    const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(8000) })
    detectCache = { at: Date.now(), ok: res.ok }
  } catch {
    detectCache = { at: Date.now(), ok: false }
  }
  return detectCache.ok
}

export default {
  id: 'meetings',
  name: 'Meetings Hub',
  detect,
  scanThreads,
  openThread: (ref) => ({ ok: true, browser: true, url: ref?.url || OPEN_URL }),
  newSession: () => ({ ok: false, error: 'Record a meeting in the hub' }),
  setArchived: async () => ({ ok: false, error: 'Approve or drop the items in the hub' }),
}
