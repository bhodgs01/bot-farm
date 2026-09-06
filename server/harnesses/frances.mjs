/**
 * Harness adapter: Mary's apartment — the doors and the escalation ladder, on the Frances hex.
 *
 * Doors: the four contact sensors the caregiver app watches (front, back, garage, cave),
 * read straight from Home Assistant. The count of open doors rides over the keeper's head;
 * a door open at night, or open longer than ten minutes, raises a hand.
 *
 * Alarm: the caregiver app's single active incident (`/api/floor`). While one is open and
 * nobody on the ladder has acknowledged it, the keeper's hand is up with the ladder on the
 * card. Quiet floor: the keeper stands with the last few events on hover.
 *
 * Read-only: one HA states GET and one caregiver GET per refresh.
 */

const HA_TOKEN = process.env.HA_TOKEN || ''
const HA_URL = process.env.HA_URL || 'http://home-assistant.home-assistant.svc.cluster.local:8123'
const CARE = (process.env.CAREGIVER_URL || 'http://caregiver.caregiver.svc.cluster.local').replace(/\/$/, '')
const CARE_OPEN = process.env.CAREGIVER_OPEN_URL || 'https://caregiver.kcproto.com/'
const ZONE = 'Frances'
const TTL_MS = 30 * 1000
const BORN = Date.parse('2026-09-06T12:00:00Z')
const NL = String.fromCharCode(10)
const OPEN_TOO_LONG_MS = 10 * 60 * 1000

/** The apartment's doors, as the caregiver app names them. Override with FRANCES_DOORS as JSON {entity_id: label}. */
const DOORS = (() => {
  try {
    const v = JSON.parse(process.env.FRANCES_DOORS || '')
    if (v && typeof v === 'object' && Object.keys(v).length) return v
  } catch {
    /* default list below */
  }
  return {
    'binary_sensor.contact_sensor_5': 'Front door',
    'binary_sensor.contact_sensor_6': 'Back door',
    'binary_sensor.contact_sensor_4': 'Door to the garage',
    'binary_sensor.contact_sensor': 'Cave door',
  }
})()

const fmtTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })
const kcHour = () => Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Chicago' }).format(new Date())) % 24
const ago = (ms) => (ms < 60000 ? 'just now' : ms < 3600000 ? `${Math.round(ms / 60000)} min` : ms < 86400000 ? `${Math.round(ms / 3600000)} h` : `${Math.round(ms / 86400000)} d`)

async function getJson(url, headers = {}, ms = 10000) {
  const res = await fetch(url, { headers: { Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(ms) })
  if (!res.ok) throw new Error(`${url.replace(/^https?:\/\/[^/]+/, '')} → ${res.status}`)
  return res.json()
}

const base = {
  project: ZONE,
  projectPath: 'caregiver://mary',
  worktree: '',
  effort: '',
  lastFocusedAt: 0,
  running: false,
  unread: false,
  starred: false,
  routine: '',
  prState: '',
  archived: false,
  hasTranscript: false,
  source: 'caregiver',
  canOpen: true,
  canArchive: false,
}

async function doorsThread(now) {
  if (!HA_TOKEN) return null
  const states = await getJson(`${HA_URL}/api/states`, { Authorization: `Bearer ${HA_TOKEN}` })
  const byId = new Map(states.map((s) => [s.entity_id, s]))
  const night = kcHour() >= 22 || kcHour() < 7
  const doors = Object.entries(DOORS).map(([id, label]) => {
    const s = byId.get(id)
    const open = s ? s.state === 'on' || s.state === 'open' : false
    const since = s ? Date.parse(s.last_changed) || 0 : 0
    return { id, label, open, since, known: Boolean(s), unavailable: s ? s.state === 'unavailable' : false }
  })
  const open = doors.filter((d) => d.open)
  const tooLong = open.filter((d) => d.since && now - d.since > OPEN_TOO_LONG_MS)
  const flag = open.length > 0 && (night || tooLong.length > 0)
  const details = Object.fromEntries(doors.map((d) => [d.label, !d.known ? 'no sensor' : d.unavailable ? 'sensor offline' : `${d.open ? 'OPEN' : 'closed'}${d.since ? ` · ${ago(now - d.since)} (${fmtTime.format(new Date(d.since))})` : ''}`]))
  return {
    ...base,
    id: 'frances:doors',
    kind: 'doors',
    title: '🚪 Doors',
    plate: open.length ? String(open.length) : '',
    count: 0,
    preview: open.length ? `${open.map((d) => d.label).join(', ')} open${night ? ' · at night' : tooLong.length ? ' · too long' : ''}` : 'All doors shut',
    details: { ...details, Rule: 'A hand goes up for a door open at night (10 PM to 7 AM) or open longer than ten minutes.' },
    cwd: 'apartment',
    gitBranch: open.length ? `${open.length} open` : 'shut',
    model: night ? 'night' : 'day',
    createdAt: BORN,
    lastActivityAt: Math.max(BORN, ...doors.map((d) => d.since || 0)),
    hasError: flag,
    alertKey: flag ? `doors:${open.map((d) => d.id).join(',')}` : '',
    sizeBytes: 1500,
    ref: { url: 'https://homeassistant.kcproto.com/' },
  }
}

async function alarmThread(now) {
  const floor = await getJson(`${CARE}/api/floor`)
  const inc = floor.incident && typeof floor.incident === 'object' ? floor.incident : null
  const recent = Array.isArray(floor.recent) ? floor.recent : []
  const openUnacked = Boolean(inc && inc.status === 'open' && !inc.ackedBy)
  const ladder = inc && Array.isArray(inc.ladder) ? inc.ladder.map((r) => `${r.name || r.slug} (tier ${r.tier}): ${r.state}`).join(NL) : ''
  const events = recent
    .filter((e) => e.kind === 'event')
    .slice(-8)
    .reverse()
    .map((e) => `${e.ts ? fmtTime.format(new Date(e.ts)) : ''} ${e.icon || ''} ${e.text || e.type || ''}${e.live ? ' · live' : ''}`.trim())
  return {
    ...base,
    id: 'frances:alarm',
    kind: openUnacked ? 'task' : 'keeper',
    title: inc ? `🚨 ${inc.summary || 'Incident'}` : '🛎️ Escalation ladder',
    plate: openUnacked ? String(inc.severity || 'alarm').toUpperCase() : '',
    preview: inc
      ? `${inc.severity} · opened ${ago(now - (inc.openedAt || now))} ago · ${inc.ackedBy ? `acknowledged by ${inc.ackedBy}` : 'NOT acknowledged'}`
      : `Quiet floor. ${events.length ? `Last: ${events[0]}` : 'No recent events.'}`,
    details: {
      Incident: inc ? `${inc.summary} (${inc.severity}, ${inc.cynefin || ''})` : 'none open',
      Reason: inc?.reason || '',
      Opened: inc?.openedAt ? `${fmtTime.format(new Date(inc.openedAt))} CT` : '',
      Acknowledged: inc ? inc.ackedBy || 'nobody yet' : '',
      Ladder: ladder,
      'Recent events': events.join(NL),
      Rule: 'The hand is up while an incident is open and nobody on the ladder has acknowledged it. Acknowledge in the caregiver app.',
    },
    cwd: 'Frances',
    gitBranch: inc ? inc.status : 'quiet',
    model: inc ? inc.severity : '',
    createdAt: BORN + 1,
    lastActivityAt: inc?.openedAt || (recent.length ? recent[recent.length - 1].ts || now : now),
    hasError: openUnacked,
    alertKey: openUnacked ? `incident:${inc.id}` : '',
    unread: false,
    sizeBytes: 2000,
    ref: { url: CARE_OPEN },
  }
}

async function fetchThreads() {
  const now = Date.now()
  const [doors, alarm] = await Promise.all([doorsThread(now).catch((e) => (console.warn('frances doors:', e.message), null)), alarmThread(now).catch((e) => (console.warn('frances alarm:', e.message), null))])
  return [doors, alarm].filter(Boolean)
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
        console.warn('frances:', err.message)
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
    const res = await fetch(`${CARE}/api/floor`, { signal: AbortSignal.timeout(8000) })
    detectCache = { at: Date.now(), ok: res.ok }
  } catch {
    detectCache = { at: Date.now(), ok: false }
  }
  return detectCache.ok
}

export default {
  id: 'frances',
  name: "Mary's apartment",
  detect,
  scanThreads,
  openThread: (ref) => ({ ok: true, browser: true, url: ref?.url || CARE_OPEN }),
  newSession: () => ({ ok: false, error: 'The apartment is watched from the caregiver app' }),
  setArchived: async () => ({ ok: false, error: 'These stay' }),
}
