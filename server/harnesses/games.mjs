/**
 * Harness adapter: game day — one scoreboard astronaut in the Newsroom for the Kansas City
 * teams (Chiefs, Royals, Sporting KC, KC Current).
 *
 * No game today and the astronaut sleeps at the newsstand with the next fixture on hover.
 * On a game day it stands up with kickoff over its head; while the game is on, the score
 * rides over its head and refreshes every minute; after the final it keeps the score up
 * until midnight. Never a raised hand: a score is never something Blake has to act on.
 *
 * Read-only: ESPN's public scoreboards, one GET per league per refresh. ESPN wants a
 * browser User-Agent; the plain fetch default is turned away.
 */

const ZONE = 'Newsroom'
const BORN = Date.parse('2026-09-06T12:00:00Z')
const NL = String.fromCharCode(10)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
const LEAGUES = [
  { path: 'football/nfl', team: 'Chiefs', emoji: '🏈', abbr: ['KC'] },
  { path: 'baseball/mlb', team: 'Royals', emoji: '⚾', abbr: ['KC'] },
  { path: 'soccer/usa.1', team: 'Sporting KC', emoji: '⚽', abbr: ['SKC', 'KC'] },
  { path: 'soccer/usa.nwsl', team: 'KC Current', emoji: '⚽', abbr: ['KC', 'KCC'] },
]
const LIVE_TTL_MS = 60 * 1000
const IDLE_TTL_MS = 15 * 60 * 1000
const TZ = 'America/Chicago'
const fmtDay = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ })
const fmtTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ })
const kcDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)

const isKC = (competitor, league) => {
  const t = competitor.team || {}
  return league.abbr.includes(t.abbreviation) || /kansas city/i.test(t.displayName || t.location || '')
}

async function scoreboard(league) {
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${league.path}/scoreboard`, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`espn ${league.path} → ${res.status}`)
  const json = await res.json()
  const out = []
  for (const e of json.events || []) {
    const c = e.competitions?.[0]
    if (!c) continue
    const us = c.competitors.find((x) => isKC(x, league))
    if (!us) continue
    const them = c.competitors.find((x) => x !== us)
    const state = e.status?.type?.state || 'pre' // pre | in | post
    out.push({
      league,
      id: e.id,
      date: Date.parse(e.date),
      state,
      detail: e.status?.type?.shortDetail || '',
      home: us.homeAway === 'home',
      us: { name: us.team?.displayName || league.team, abbr: us.team?.abbreviation || 'KC', score: us.score != null ? Number(us.score) : null, record: us.records?.[0]?.summary || '' },
      them: { name: them?.team?.displayName || '?', abbr: them?.team?.abbreviation || '?', score: them?.score != null ? Number(them.score) : null, record: them?.records?.[0]?.summary || '' },
      venue: c.venue?.fullName || '',
      tv: (c.broadcasts || []).flatMap((b) => b.names || []).join(', '),
      link: e.links?.[0]?.href || '',
    })
  }
  return out
}

async function fetchThreads() {
  const now = Date.now()
  const lists = await Promise.all(LEAGUES.map((l) => scoreboard(l).catch((e) => (console.warn('games:', e.message), []))))
  const games = lists.flat().sort((a, b) => a.date - b.date)
  const today = kcDate(new Date(now))
  const todays = games.filter((g) => kcDate(new Date(g.date)) === today)
  const live = todays.find((g) => g.state === 'in')
  const next = games.find((g) => g.state === 'pre' && g.date > now)
  // The game that matters right now: the live one, else today's next, else today's last final.
  const game = live || todays.find((g) => g.state === 'pre') || [...todays].reverse().find((g) => g.state === 'post') || null
  const scoreLine = (g) => `${g.us.abbr} ${g.us.score ?? 0} – ${g.them.abbr} ${g.them.score ?? 0}`
  const line = (g) => `${g.league.emoji} ${g.us.name} ${g.home ? 'vs' : 'at'} ${g.them.name} · ${fmtDay.format(new Date(g.date))} ${fmtTime.format(new Date(g.date))}${g.tv ? ` · ${g.tv}` : ''}`
  const asleep = !game
  const plate = !game ? '' : game.state === 'in' ? scoreLine(game) : game.state === 'post' ? `F ${scoreLine(game)}` : fmtTime.format(new Date(game.date))
  const upcoming = games.filter((g) => g.state === 'pre').slice(0, 6).map(line)
  const title = game ? `${game.league.emoji} ${game.us.name}` : '🏟️ Game day'
  const preview = !game
    ? next ? `No KC game today. Next: ${line(next)}` : 'No KC game today, none on the board.'
    : game.state === 'in'
      ? `LIVE ${scoreLine(game)} · ${game.detail}${game.tv ? ` · on ${game.tv}` : ''}`
      : game.state === 'post'
        ? `Final: ${scoreLine(game)} · ${game.us.score > game.them.score ? `${game.us.name} win` : game.us.score < game.them.score ? `${game.us.name} lose` : 'draw'}`
        : `Today ${fmtTime.format(new Date(game.date))}: ${game.us.name} ${game.home ? 'vs' : 'at'} ${game.them.name}${game.tv ? ` · on ${game.tv}` : ''}`
  return [
    {
      id: 'games:kc',
      kind: game ? 'info' : 'keeper',
      asleep,
      title,
      plate,
      preview,
      details: {
        Now: game ? preview : 'no game today',
        Status: game ? game.detail : '',
        Records: game ? `${game.us.abbr} ${game.us.record || '?'} · ${game.them.abbr} ${game.them.record || '?'}` : '',
        Venue: game?.venue || '',
        TV: game?.tv || '',
        Upcoming: upcoming.join(NL) || 'nothing scheduled',
        Source: 'ESPN scoreboard, refreshed every minute during a game',
      },
      project: ZONE,
      projectPath: 'games://kc',
      worktree: '',
      cwd: 'Kansas City',
      gitBranch: game ? game.state === 'in' ? 'live' : game.state === 'post' ? 'final' : 'today' : 'no game',
      model: game ? game.league.team : '',
      effort: '',
      createdAt: BORN,
      lastActivityAt: game ? now : BORN,
      lastFocusedAt: 0,
      running: Boolean(live),
      unread: false,
      hasError: false,
      starred: false,
      routine: '',
      prState: '',
      archived: false,
      hasTranscript: false,
      sizeBytes: 1500,
      source: 'espn',
      canOpen: Boolean(game?.link),
      canArchive: false,
      live: Boolean(live),
      ref: { url: game?.link || 'https://www.espn.com/' },
    },
  ]
}

let cache = { at: 0, data: null, inflight: null }
async function scanThreads() {
  const ttl = cache.data?.[0]?.live ? LIVE_TTL_MS : IDLE_TTL_MS
  const age = Date.now() - cache.at
  if (cache.data && age < ttl) return cache.data
  if (!cache.inflight) {
    cache.inflight = fetchThreads()
      .then((data) => {
        cache = { at: Date.now(), data, inflight: null }
        return data
      })
      .catch((err) => {
        cache.inflight = null
        console.warn('games:', err.message)
        return cache.data || []
      })
  }
  return cache.data || cache.inflight
}

export default {
  id: 'games',
  name: 'Game day',
  detect: async () => true,
  scanThreads,
  openThread: (ref) => ({ ok: true, browser: true, url: ref?.url || 'https://www.espn.com/' }),
  newSession: () => ({ ok: false, error: 'The schedule is up to the leagues' }),
  setArchived: async () => ({ ok: false, error: 'The scoreboard stays' }),
}
