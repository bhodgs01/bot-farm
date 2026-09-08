/**
 * Harness adapter: web analytics — one watcher on the KC Proto hex who knows who is on the
 * sites right now, read from the self-hosted Umami at umami.kcproto.com.
 *
 * States, by doctrine (the farm shows what Blake acts on, not vanity counts):
 *   running  = somebody is on one of the sites RIGHT NOW (count over the head = live visitors)
 *   unread   = a site that normally gets traffic has gone quiet for QUIET_DAYS (probably broken
 *              upstream of the health check) — hand up with a ?
 *   asleep   = nothing live and nothing quiet: lastActivityAt is the last real pageview seen,
 *              so the colony's own 3-day rule puts the watcher to bed
 *
 * Read-only: login once (token cached, re-login on 401), then per scan one /active per site
 * and, every 10 minutes, one /stats + one /metrics?type=referrer per site.
 * Env: UMAMI_URL (in-cluster service), UMAMI_USER, UMAMI_PASSWORD.
 */

const ZONE = 'KC Proto'
const BORN = Date.parse('2026-09-07T12:00:00Z')
const DAY = 86400000
const ACTIVE_TTL_MS = 60 * 1000
const DAILY_TTL_MS = 10 * 60 * 1000
const QUIET_DAYS = Number(process.env.UMAMI_QUIET_DAYS || 2)
const BASE = String(process.env.UMAMI_URL || 'http://umami.umami.svc.cluster.local:3000').replace(/\/$/, '')
const USER = process.env.UMAMI_USER || 'admin'
const PASS = process.env.UMAMI_PASSWORD || ''
const DASH = 'https://umami.kcproto.com'

let token = ''
async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`umami login → ${res.status}`)
  token = (await res.json()).token
}
async function api(path, retry = true) {
  if (!token) await login()
  const res = await fetch(`${BASE}/api${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) })
  if (res.status === 401 && retry) {
    token = ''
    return api(path, false)
  }
  if (!res.ok) throw new Error(`umami ${path} → ${res.status}`)
  return res.json()
}

/** Per-site facts that change slowly: today, last 7 days, last hit, top referrer. */
let daily = { at: 0, sites: [] }
async function refreshDaily() {
  const now = Date.now()
  const list = (await api('/websites?pageSize=200')).data || []
  const sites = await Promise.all(
    list.map(async (w) => {
      const day = await api(`/websites/${w.id}/stats?startAt=${now - DAY}&endAt=${now}`).catch(() => null)
      const week = await api(`/websites/${w.id}/stats?startAt=${now - 7 * DAY}&endAt=${now}`).catch(() => null)
      const refs = await api(`/websites/${w.id}/metrics?type=referrer&startAt=${now - 7 * DAY}&endAt=${now}&limit=1`).catch(() => [])
      // Newest session first by default; an explicit orderBy makes Umami 2.20 return 500.
      const sess = await api(`/websites/${w.id}/sessions?startAt=${now - 30 * DAY}&endAt=${now}&pageSize=5`).catch(() => null)
      const lastAt = (sess?.data || []).reduce((m, s) => Math.max(m, s.lastAt ? Date.parse(s.lastAt) : 0), 0)
      const val = (s, k) => Number(s?.[k]?.value ?? s?.[k] ?? 0)
      return {
        id: w.id,
        name: w.name,
        domain: w.domain,
        today: val(day, 'visitors'),
        week: val(week, 'visitors'),
        weekPrev: Number(week?.visitors?.prev ?? 0),
        lastAt,
        referrer: refs?.[0]?.x || '',
      }
    })
  )
  daily = { at: now, sites }
  return daily
}

async function fetchThreads() {
  const now = Date.now()
  if (now - daily.at > DAILY_TTL_MS) await refreshDaily().catch((e) => console.warn('analytics:', e.message))
  const sites = daily.sites
  const live = await Promise.all(
    sites.map(async (s) => ({ ...s, live: Number((await api(`/websites/${s.id}/active`).catch(() => ({ visitors: 0 }))).visitors || 0) }))
  )
  const onNow = live.filter((s) => s.live > 0).sort((a, b) => b.live - a.live)
  const liveTotal = onNow.reduce((n, s) => n + s.live, 0)
  // "Gone quiet": had visitors the week before last week, none in QUIET_DAYS days.
  const quiet = live.filter((s) => s.weekPrev > 0 && s.lastAt && now - s.lastAt > QUIET_DAYS * DAY)
  const busiest = [...live].sort((a, b) => b.today - a.today).filter((s) => s.today > 0).slice(0, 5)
  const lastSeen = live.reduce((m, s) => Math.max(m, s.lastAt || 0), 0)
  const site = (s) => s.domain
  const line = (s) => `${s.live ? `${s.live} on now · ` : ''}${s.today} today · ${s.week} this week${s.referrer ? ` · via ${s.referrer}` : ''}`
  const preview = onNow.length
    ? `On now: ${onNow.map((s) => `${site(s)} (${s.live})`).join(', ')}`
    : quiet.length
      ? `Gone quiet: ${quiet.map(site).join(', ')}`
      : busiest.length
        ? `Today: ${busiest.map((s) => `${site(s)} ${s.today}`).join(', ')}`
        : 'Nobody on the sites yet'
  return [
    {
      id: 'analytics:watcher',
      kind: 'watcher',
      title: '📈 Visitors',
      plate: liveTotal ? `${liveTotal} live` : quiet.length ? `${quiet.length} quiet` : '',
      preview,
      details: {
        ...Object.fromEntries(
          live
            .filter((s) => s.live || s.today || s.week)
            .sort((a, b) => b.live - a.live || b.today - a.today)
            .map((s) => [site(s), line(s)])
        ),
        ...(quiet.length ? { Quiet: quiet.map((s) => `${site(s)} (last ${Math.floor((now - s.lastAt) / DAY)}d ago)`).join(', ') } : {}),
        Rule: `Awake while someone is on a site; hand up when a site with traffic goes ${QUIET_DAYS}d silent. Umami, no cookies.`,
      },
      project: ZONE,
      projectPath: 'umami://kcproto',
      worktree: '',
      cwd: `${live.length} sites`,
      gitBranch: liveTotal ? `${liveTotal} live` : busiest.length ? `${busiest[0].today} today` : '',
      model: '',
      effort: '',
      createdAt: BORN,
      lastActivityAt: Math.max(lastSeen, BORN),
      lastFocusedAt: 0,
      running: liveTotal > 0,
      unread: quiet.length > 0,
      hasError: false,
      alertKey: quiet.length ? `analytics:quiet:${quiet.map(site).join(',')}` : '',
      starred: false,
      routine: '',
      prState: '',
      archived: false,
      hasTranscript: false,
      sizeBytes: 1500 + 400 * Math.min(live.length, 20),
      source: 'umami',
      canOpen: true,
      canArchive: false,
      ref: { url: DASH },
    },
  ]
}

let cache = { at: 0, data: null, inflight: null }
async function scanThreads() {
  const age = Date.now() - cache.at
  if (cache.data && age < ACTIVE_TTL_MS) return cache.data
  if (!cache.inflight) {
    cache.inflight = fetchThreads()
      .then((data) => {
        cache = { at: Date.now(), data, inflight: null }
        return data
      })
      .catch((err) => {
        cache.inflight = null
        console.warn('analytics:', err.message)
        return cache.data || []
      })
  }
  return cache.data || cache.inflight
}

export default {
  id: 'analytics',
  name: 'Web analytics (Umami)',
  detect: async () => Boolean(PASS),
  scanThreads,
  openThread: (ref) => ({ ok: true, browser: true, url: ref?.url || DASH }),
  newSession: () => ({ ok: false, error: 'Add a site in Umami, then tag its page' }),
  setArchived: async () => ({ ok: false, error: 'The watcher stays' }),
}
