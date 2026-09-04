/**
 * Harness adapter: the calendar — this week, as one keeper plus today's meetings.
 *
 * The keeper stands on KC Proto with the number of events still to come this week over his
 * head; hovering lists them by day. Every event inside the next 24 hours is its own
 * astronaut with a hand up and a `?`, so tomorrow morning is visible from orbit tonight.
 *
 * Read-only: Google Calendar events on the primary calendar, through Janine's OAuth token
 * (it carries calendar scope). Env: the same GMAIL_* trio; CAL_ID optional.
 */

const CLIENT_ID = process.env.GMAIL_CLIENT_ID || ''
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || ''
const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN || ''
const CAL_ID = process.env.CAL_ID || 'primary'
const TZ = 'America/Chicago'
const TTL_MS = 5 * 60 * 1000
const SOON_MS = 2 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const ZONE = 'KC Proto'

let access = { token: '', expiresAt: 0 }
async function accessToken() {
  if (access.token && Date.now() < access.expiresAt - 60 * 1000) return access.token
  const body = new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: REFRESH_TOKEN, grant_type: 'refresh_token' })
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`token refresh → ${res.status}`)
  const json = await res.json()
  access = { token: json.access_token, expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000 }
  return access.token
}

/** Midnight today and the end of Sunday, in Kansas City, as instants. */
function weekWindow(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' }).formatToParts(now).map((p) => [p.type, p.value]))
  const h = Number(parts.hour) % 24
  const m = Number(parts.minute)
  const startOfDay = new Date(now.getTime() - (h * 60 + m) * 60000 - (now.getSeconds() * 1000))
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday)
  const daysLeft = dow === 0 ? 0 : 7 - dow
  const endOfWeek = new Date(startOfDay.getTime() + (daysLeft + 1) * 86400000)
  return { startOfDay, endOfWeek }
}

const fmtDay = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' })
const fmtTime = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })
const fmtDate = new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'short', day: 'numeric' })

async function fetchThreads() {
  const token = await accessToken()
  const { startOfDay, endOfWeek } = weekWindow()
  const q = new URLSearchParams({ timeMin: startOfDay.toISOString(), timeMax: endOfWeek.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '60' })
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CAL_ID)}/events?${q}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`calendar → ${res.status}`)
  const json = await res.json()
  const now = Date.now()
  const events = (json.items || [])
    .filter((e) => e.status !== 'cancelled')
    .map((e) => {
      const allDay = Boolean(e.start?.date)
      const start = Date.parse(e.start?.dateTime || `${e.start?.date}T00:00:00-05:00`) || 0
      const end = Date.parse(e.end?.dateTime || `${e.end?.date}T00:00:00-05:00`) || start
      return { id: e.id, title: e.summary || '(untitled)', start, end, allDay, where: e.location || '', link: e.htmlLink || '', who: (e.attendees || []).filter((a) => !a.self).map((a) => a.displayName || a.email).slice(0, 4) }
    })
    .filter((e) => e.end > now - 60 * 60 * 1000)

  const out = []
  const line = (e) => `${fmtDay.format(e.start)} ${e.allDay ? 'all day' : fmtTime.format(e.start)} · ${e.title}${e.where ? ` @ ${e.where}` : ''}`
  const upcoming = events.filter((e) => e.end > now)
  const next = upcoming.find((e) => !e.allDay) || upcoming[0]
  out.push({
    id: 'cal:week',
    kind: 'task',
    count: upcoming.length,
    title: '📅 This week',
    preview: upcoming.length ? upcoming.slice(0, 14).map((e) => `• ${line(e)}`).join(String.fromCharCode(10)) + (upcoming.length > 14 ? `\n… and ${upcoming.length - 14} more` : '') : 'Nothing left on the calendar this week',
    project: ZONE,
    projectPath: 'calendar://week',
    worktree: '',
    cwd: CAL_ID,
    gitBranch: next ? `next: ${fmtDay.format(next.start)} ${next.allDay ? '' : fmtTime.format(next.start)}`.trim() : 'clear',
    model: `${fmtDate.format(startOfDay)} – ${fmtDate.format(endOfWeek.getTime() - 1)}`,
    effort: '',
    createdAt: 0,
    lastActivityAt: now,
    lastFocusedAt: 0,
    running: false,
    unread: Boolean(next && !next.allDay && next.start - now < SOON_MS && next.start > now - 15 * 60000),
    hasError: false,
    starred: false,
    routine: '',
    prState: '',
    archived: false,
    hasTranscript: false,
    sizeBytes: 1000 * (1 + upcoming.length * 40),
    source: 'calendar',
    canOpen: true,
    canArchive: false,
    ref: { link: 'https://calendar.google.com/calendar/u/0/r/week' },
  })

  for (const e of events.filter((e) => e.start < now + DAY_MS && e.end > now)) {
    const live = e.start <= now && e.end > now
    const soon = !live && e.start - now < SOON_MS
    out.push({
      id: `cal:${e.id}`,
      kind: 'task',
      title: `${live ? '🔴' : '🗓️'} ${e.title}`.slice(0, 120),
      preview: [`${fmtDay.format(e.start)} ${e.allDay ? 'all day' : `${fmtTime.format(e.start)} – ${fmtTime.format(e.end)}`}`, e.where, e.who.length ? `with ${e.who.join(', ')}` : ''].filter(Boolean).join(' · '),
      project: ZONE,
      projectPath: 'calendar://today',
      worktree: '',
      cwd: 'next 24h',
      gitBranch: live ? 'happening now' : soon ? 'starting soon' : 'within 24h',
      model: '',
      effort: '',
      createdAt: e.start - 86400000,
      lastActivityAt: now,
      lastFocusedAt: 0,
      running: live,
      unread: !live,
      hasError: false,
      starred: false,
      routine: '',
      prState: '',
      archived: false,
      hasTranscript: false,
      sizeBytes: 1000 * (1 + Math.max(1, (e.end - e.start) / 60000)),
      source: 'calendar',
      canOpen: Boolean(e.link),
      canArchive: false,
      ref: { link: e.link },
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
        console.warn('calendar:', err.message)
        return cache.data || []
      })
  }
  return cache.data || cache.inflight
}

export default {
  id: 'calendar',
  name: 'Calendar',
  detect: async () => Boolean(CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN),
  scanThreads,
  openThread: (ref) => ({ ok: true, browser: true, url: /^https:\/\/(calendar|www)\.google\.com\//.test(ref?.link || '') ? ref.link : 'https://calendar.google.com/calendar/u/0/r/week' }),
  newSession: () => ({ ok: false, error: 'Put it on the calendar' }),
  setArchived: async () => ({ ok: false, error: 'It leaves when the day does' }),
}
