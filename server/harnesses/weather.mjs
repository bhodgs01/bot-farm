/**
 * Harness adapter: the weather desk — one correspondent in the Newsroom wearing the
 * temperature over his head.
 *
 * Reads Blake's weather dashboard (NWS observations, forecast and alerts for Mission, KS).
 * The card carries the conditions, today's and tomorrow's forecast, and any active alerts;
 * the chat answers from the same facts. A warning-grade alert (tornado, severe storm,
 * flash flood, winter storm) raises his hand; advisories and heat warnings stay on the card,
 * because a flag is for something Blake acts on.
 *
 * Read-only: three GETs per refresh, five minutes apart.
 */

const BASE = (process.env.WEATHER_URL || 'http://weather-dashboard.weather-dashboard.svc.cluster.local:3125').replace(/\/$/, '')
const OPEN_URL = process.env.WEATHER_OPEN_URL || 'https://weather.kcproto.com'
const TTL_MS = 5 * 60 * 1000
const ZONE = 'Newsroom'
/** Fixed creation stamp so the desk keeps its stand slot from day to day. */
const BORN = Date.parse('2026-09-05T12:00:00Z')
const NL = String.fromCharCode(10)

/** Alerts that mean "do something now", as opposed to "it is hot". */
const URGENT = /tornado|severe thunderstorm|flash flood|winter storm|blizzard|ice storm|hurricane/i

async function getJson(path, ms = 12000) {
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(ms) })
  if (!res.ok) throw new Error(`weather ${path} → ${res.status}`)
  return res.json()
}

function iconFor(desc, daytime = true) {
  const d = String(desc || '').toLowerCase()
  if (/thunder|storm/.test(d)) return '⛈️'
  if (/snow|sleet|flurr/.test(d)) return '❄️'
  if (/rain|shower|drizzle/.test(d)) return '🌧️'
  if (/fog|mist|haze|smoke/.test(d)) return '🌫️'
  if (/overcast|cloudy/.test(d) && !/partly|mostly sunny/.test(d)) return '☁️'
  if (/partly|mostly/.test(d)) return daytime ? '⛅' : '☁️'
  return daytime ? '☀️' : '🌙'
}

const round = (n) => (Number.isFinite(Number(n)) ? Math.round(Number(n)) : null)
const compass = (deg) => {
  const d = Number(deg)
  if (!Number.isFinite(d)) return ''
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round((((d % 360) + 360) % 360) / 45) % 8]
}
const fmtTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })
const fmtDay = new Intl.DateTimeFormat('en-US', { weekday: 'short', hour: 'numeric', timeZone: 'America/Chicago' })

async function fetchThreads() {
  const [cur, fc, al] = await Promise.all([
    getJson('/api/current'),
    getJson('/api/forecast').catch(() => []),
    getJson('/api/alerts').catch(() => []),
  ])
  const now = Date.now()
  const periods = Array.isArray(fc) ? fc : []
  const alerts = Array.isArray(al) ? al : []
  const temp = round(cur.tempF)
  const feels = round(cur.heatIndexF ?? cur.windChillF)
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Chicago' }).format(new Date()))
  const daytime = hour >= 7 && hour < 20
  const icon = iconFor(cur.description, daytime)
  const wind = cur.windSpeedMph != null ? `${compass(cur.windDirection)} ${round(cur.windSpeedMph)} mph${cur.windGustMph ? `, gusts ${round(cur.windGustMph)}` : ''}` : ''
  const today = periods[0]
  const next = periods[1]
  const tomorrow = periods.find((p, i) => i > 0 && p.isDaytime && /tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(p.name))
  const urgent = alerts.filter((a) => URGENT.test(String(a.event || '')))
  const alertLine = alerts.map((a) => `${a.event}${a.expires ? ` until ${fmtDay.format(new Date(a.expires))}` : ''}`).join('; ')
  const updated = cur.timestamp ? fmtTime.format(new Date(cur.timestamp)) : ''

  const details = {
    Now: `${cur.description || 'Unknown'}, ${temp != null ? `${temp}°F` : '—'}${feels != null && feels !== temp ? ` (feels like ${feels}°)` : ''}`,
    Humidity: cur.humidity != null ? `${round(cur.humidity)}%` : '',
    Wind: wind,
    Dewpoint: cur.dewpointF != null ? `${round(cur.dewpointF)}°F` : '',
    Pressure: cur.pressureInHg != null ? `${Number(cur.pressureInHg).toFixed(2)} inHg` : '',
    Visibility: cur.visibilityMi != null ? `${round(cur.visibilityMi)} mi` : '',
    [today ? today.name : 'Today']: today ? `${today.short}, ${today.tempF}°${today.precipProb ? `, ${today.precipProb}% rain` : ''}` : '',
    [next ? next.name : 'Next']: next ? `${next.short}, ${next.tempF}°${next.precipProb ? `, ${next.precipProb}% rain` : ''}` : '',
    Tomorrow: tomorrow && tomorrow !== next ? `${tomorrow.short}, ${tomorrow.tempF}°${tomorrow.precipProb ? `, ${tomorrow.precipProb}% rain` : ''}` : '',
    Outlook: today ? today.detailed : '',
    Alerts: alertLine || 'none',
    Station: cur.stationName ? `${cur.stationName}${updated ? ` at ${updated} CT` : ''}` : '',
  }

  return [
    {
      id: 'weather:now',
      kind: 'weather',
      title: `${icon} Weather`,
      plate: temp != null ? `${temp}°` : '',
      preview: [details.Now, today ? `${today.name}: ${today.short}, ${today.tempF}°` : '', alertLine ? `⚠ ${alertLine}` : ''].filter(Boolean).join(NL),
      project: ZONE,
      projectPath: 'weather://desk',
      worktree: '',
      cwd: 'Mission, KS',
      gitBranch: cur.description || '',
      model: temp != null ? `${temp}°F` : '',
      effort: '',
      createdAt: BORN,
      lastActivityAt: now,
      lastFocusedAt: 0,
      running: false,
      unread: false,
      hasError: urgent.length > 0,
      alertKey: urgent.length ? `alert:${urgent.map((a) => a.id).join(',')}` : '',
      starred: false,
      routine: '',
      prState: '',
      archived: false,
      hasTranscript: false,
      sizeBytes: 1000 * 4,
      source: 'weather-dashboard',
      canOpen: true,
      canArchive: false,
      details,
      alerts: alerts.map((a) => ({ event: a.event, severity: a.severity, headline: a.headline, expires: a.expires })),
      forecast: periods.slice(0, 6).map((p) => ({ name: p.name, tempF: p.tempF, short: p.short, precipProb: p.precipProb, wind: p.windSpeed })),
      ref: { desk: 'weather' },
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
        console.warn('weather:', err.message)
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
    const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(8000) })
    detectCache = { at: Date.now(), ok: res.ok }
  } catch {
    detectCache = { at: Date.now(), ok: false }
  }
  return detectCache.ok
}

export default {
  id: 'weather',
  name: 'Weather desk',
  detect,
  scanThreads,
  openThread: () => ({ ok: true, browser: true, url: OPEN_URL }),
  newSession: () => ({ ok: false, error: 'The weather writes itself' }),
  setArchived: async () => ({ ok: false, error: 'The weather desk stays' }),
}
