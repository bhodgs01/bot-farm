/**
 * Harness adapter: Mary — the person Frances looks after, standing on the Frances hex
 * with her resting heart rate over her head.
 *
 * Reads the caregiver app's live vitals board (Garmin through Home Assistant) and the
 * Ambient Vitals subagent's verdict. The card carries the vital signs, stress and sleep;
 * a hand goes up only when the subagent says something is out of range, because a flag
 * is for something Blake acts on.
 *
 * Read-only: two GETs per refresh, a minute apart.
 */

const BASE = (process.env.CAREGIVER_URL || 'http://caregiver.caregiver.svc.cluster.local').replace(/\/$/, '')
const OPEN_URL = process.env.CAREGIVER_OPEN_URL || 'https://caregiver.kcproto.com/?open=vitals'
const ZONE = 'Frances'
const TTL_MS = 60 * 1000
const BORN = Date.parse('2026-09-06T12:00:00Z')
const NL = String.fromCharCode(10)
const fmtTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })

async function getJson(path, ms = 10000) {
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(ms) })
  if (!res.ok) throw new Error(`caregiver ${path} → ${res.status}`)
  return res.json()
}

const sign = (board, label) => (Array.isArray(board.signs) ? board.signs : []).find((s) => s.label === label)
const fmt = (s) => {
  if (!s || s.value == null) return ''
  const unit = String(s.unit || '')
  return unit.startsWith('/') ? `${s.value}${unit}` : unit ? `${s.value} ${unit}` : String(s.value)
}

async function fetchThreads() {
  const [board, agent] = await Promise.all([getJson('/api/vitals'), getJson('/api/subagent?slug=vitals').catch(() => null)])
  const now = Date.now()
  const hr = sign(board, 'Resting HR')
  const hrv = sign(board, 'HRV')
  const battery = sign(board, 'Body Battery')
  const stress = sign(board, 'Avg Stress')
  const recovery = sign(board, 'Recovery')
  const fitness = sign(board, 'Fitness age')
  const status = String(agent?.status || 'good').toLowerCase()
  const worrying = !['good', 'ok', 'fine', 'normal', 'stable'].includes(status)
  const sleep = board.sleep && typeof board.sleep === 'object' ? board.sleep : null
  const sleepLine = sleep
    ? [sleep.total || sleep.hours ? `${sleep.total || sleep.hours} h` : '', sleep.score ? `score ${sleep.score}` : '', Array.isArray(sleep.stages) ? sleep.stages.map((s) => `${s.label} ${s.value}${s.unit || ''}`).join(', ') : ''].filter(Boolean).join(' · ')
    : ''
  const bands = Array.isArray(board.stress?.bands) ? board.stress.bands.map((b) => `${b.label} ${b.value}`).join(', ') : ''

  const details = {
    Verdict: agent?.headline || '',
    'Resting HR': hr ? `${fmt(hr)}${hr.min != null && hr.max != null ? ` (24h ${hr.min}–${hr.max})` : ''}` : '',
    HRV: hrv ? `${fmt(hrv)}${hrv.status ? `, ${hrv.status}` : ''}${hrv.baseline != null ? ` (baseline ${hrv.baseline})` : ''}` : '',
    'Body battery': fmt(battery),
    Stress: stress ? `${fmt(stress)}${bands ? ` · ${bands}` : ''}` : '',
    Recovery: fmt(recovery),
    'Fitness age': fitness ? `${fmt(fitness)}${fitness.vs != null ? ` (actual ${fitness.vs})` : ''}` : '',
    Sleep: sleepLine || 'not reported',
    Source: board.live ? 'Garmin via Home Assistant, live' : 'caregiver app',
    Updated: board.updated ? `${fmtTime.format(new Date(board.updated))} CT` : '',
  }
  return [
    {
      id: 'mary:vitals',
      kind: worrying ? 'task' : 'vitals',
      title: '❤️ Mary',
      plate: hr && hr.value != null ? `♥ ${hr.value}` : '',
      preview: [agent?.headline || 'Vitals live from the Garmin', hr ? `Resting HR ${fmt(hr)}` : '', battery ? `Body battery ${fmt(battery)}` : ''].filter(Boolean).join(NL),
      project: ZONE,
      projectPath: 'caregiver://mary',
      worktree: '',
      cwd: 'Mary',
      gitBranch: agent?.stat || '',
      model: worrying ? status : 'vitals in range',
      effort: '',
      createdAt: BORN,
      lastActivityAt: board.updated || now,
      lastFocusedAt: 0,
      running: false,
      unread: false,
      hasError: worrying,
      alertKey: worrying ? `vitals:${status}` : '',
      starred: false,
      routine: '',
      prState: '',
      archived: false,
      hasTranscript: false,
      sizeBytes: 3000,
      source: 'caregiver',
      canOpen: true,
      canArchive: false,
      details,
      metrics: Array.isArray(agent?.metrics) ? agent.metrics : [],
      ref: { slug: 'vitals' },
    },
  ]
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
        console.warn('mary:', err.message)
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
    const res = await fetch(`${BASE}/api/vitals`, { signal: AbortSignal.timeout(8000) })
    detectCache = { at: Date.now(), ok: res.ok }
  } catch {
    detectCache = { at: Date.now(), ok: false }
  }
  return detectCache.ok
}

export default {
  id: 'mary',
  name: "Mary's vitals",
  detect,
  scanThreads,
  openThread: () => ({ ok: true, browser: true, url: OPEN_URL }),
  newSession: () => ({ ok: false, error: 'Mary is looked after in the caregiver app' }),
  setArchived: async () => ({ ok: false, error: 'Mary stays' }),
}
