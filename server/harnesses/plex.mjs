/**
 * Harness adapter: Plex — every active stream is an astronaut.
 *
 * Somebody presses play, an astronaut walks out of the ship to the Plex hex and gets to
 * work for as long as the stream runs, with a play glyph over its head. Pause and it stands
 * still, glyph still up. Stop and it walks home. The card shows what is playing, for whom,
 * and how far in. The building progress bar is the playback position.
 *
 * Read-only: one GET of /status/sessions per poll, nothing else.
 *
 * Env: PLEX_TOKEN (the server's own token, from its Preferences.xml), PLEX_URL optional.
 */

const TOKEN = process.env.PLEX_TOKEN || ''
const PLEX_URL = process.env.PLEX_URL || 'http://plex-fallback.plex.svc.cluster.local:32400'
const OPEN_URL = process.env.PLEX_OPEN_URL || 'https://app.plex.tv/desktop/#!/'
const TTL_MS = 10 * 1000

let cache = { at: 0, data: null, inflight: null }

async function fetchSessions() {
  const res = await fetch(`${PLEX_URL}/status/sessions`, {
    headers: { Accept: 'application/json', 'X-Plex-Token': TOKEN },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`plex sessions → ${res.status}`)
  const json = await res.json()
  const now = Date.now()
  return (json?.MediaContainer?.Metadata || []).map((m) => {
    const show = m.grandparentTitle ? `${m.grandparentTitle} · ${m.title}` : m.title || 'Something'
    const user = m.User?.title || 'someone'
    const state = m.Player?.state || 'playing'
    const pct = m.duration ? Math.round((100 * (m.viewOffset || 0)) / m.duration) : 0
    const player = [m.Player?.device, m.Player?.product].filter(Boolean).join(' ')
    const key = m.Session?.id || m.sessionKey || `${user}:${m.ratingKey}`
    // Backdrop first (it is landscape, like the screen), poster as the fallback. The page
    // fetches these through /api/plex/art so the token never leaves the server.
    const artPath = [m.art, m.grandparentArt, m.thumb, m.grandparentThumb, m.parentThumb].find((v) => typeof v === 'string' && v.startsWith('/library/'))
    const posterPath = [m.thumb, m.grandparentThumb, m.parentThumb].find((v) => typeof v === 'string' && v.startsWith('/library/'))
    const artUrl = (v) => (v ? `/api/plex/art?key=${encodeURIComponent(v)}` : '')
    return {
      art: artUrl(artPath),
      poster: artUrl(posterPath),
      watcher: user,
      pct,
      id: `plex:${key}`,
      kind: 'watching',
      title: show.slice(0, 120),
      preview: `${user} is ${state === 'paused' ? 'paused' : 'watching'} · ${pct}% in${player ? ` · ${player}` : ''}`,
      project: 'Blakeflix',
      projectPath: 'plex://sessions',
      worktree: '',
      cwd: user,
      gitBranch: state,
      model: m.type === 'episode' ? 'episode' : m.type || '',
      effort: '',
      createdAt: now - (m.viewOffset || 0),
      lastActivityAt: now,
      lastFocusedAt: 0,
      running: state !== 'paused',
      unread: false,
      hasError: false,
      starred: false,
      routine: '',
      prState: '',
      archived: false,
      hasTranscript: false,
      // The card's progress bar reads log10(bytes); map 0..100% onto its 1KB..3MB range.
      sizeBytes: Math.round(1000 * Math.pow(10, 3.5 * Math.max(0.01, pct / 100))),
      source: 'plex',
      canOpen: true,
      canArchive: false,
      ref: { ratingKey: m.ratingKey || '' },
    }
  })
}

async function scanThreads() {
  const age = Date.now() - cache.at
  if (cache.data && age < TTL_MS) return cache.data
  if (!cache.inflight) {
    cache.inflight = fetchSessions()
      .then((data) => {
        cache = { at: Date.now(), data, inflight: null }
        return data
      })
      .catch((err) => {
        cache.inflight = null
        console.warn('plex:', err.message)
        return cache.data || []
      })
  }
  return cache.data || cache.inflight
}

/**
 * One piece of artwork from the Plex server, for the theater screen and the card. Only
 * library art paths are allowed through, and each one is held for ten minutes so a screen
 * cycling every ten seconds never re-asks Plex for the same frame.
 */
const art = new Map()
const ART_TTL_MS = 10 * 60 * 1000
export async function plexArt(key) {
  const path = String(key || '')
  if (!/^\/library\/metadata\/\d+\/(art|thumb|banner)\/\d+$/.test(path)) return null
  const hit = art.get(path)
  if (hit && Date.now() - hit.at < ART_TTL_MS) return hit
  // Ask Plex for a modest transcode: the screen is a few hundred pixels across.
  const url = `${PLEX_URL}/photo/:/transcode?width=640&height=360&minSize=1&upscale=1&url=${encodeURIComponent(path)}`
  const res = await fetch(url, { headers: { 'X-Plex-Token': TOKEN }, signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`plex art → ${res.status}`)
  const entry = { at: Date.now(), type: res.headers.get('content-type') || 'image/jpeg', body: Buffer.from(await res.arrayBuffer()) }
  if (art.size > 64) art.delete(art.keys().next().value)
  art.set(path, entry)
  return entry
}

function openThread(ref) {
  const key = String(ref?.ratingKey || '')
  if (!/^\d+$/.test(key)) return { ok: true, browser: true, url: OPEN_URL }
  return { ok: true, browser: true, url: `${OPEN_URL}server/0/details?key=${encodeURIComponent(`/library/metadata/${key}`)}` }
}

export default {
  id: 'plex',
  name: 'Blakeflix',
  detect: async () => Boolean(TOKEN),
  scanThreads,
  openThread,
  newSession: () => ({ ok: false, error: 'Press play in Plex' }),
  setArchived: async () => ({ ok: false, error: 'Stop the stream; it walks home on its own' }),
}
