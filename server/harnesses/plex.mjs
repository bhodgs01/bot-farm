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
    return {
      id: `plex:${key}`,
      kind: 'watching',
      title: show.slice(0, 120),
      preview: `${user} is ${state === 'paused' ? 'paused' : 'watching'} · ${pct}% in${player ? ` · ${player}` : ''}`,
      project: 'Plex',
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

function openThread(ref) {
  const key = String(ref?.ratingKey || '')
  if (!/^\d+$/.test(key)) return { ok: true, browser: true, url: OPEN_URL }
  return { ok: true, browser: true, url: `${OPEN_URL}server/0/details?key=${encodeURIComponent(`/library/metadata/${key}`)}` }
}

export default {
  id: 'plex',
  name: 'Plex',
  detect: async () => Boolean(TOKEN),
  scanThreads,
  openThread,
  newSession: () => ({ ok: false, error: 'Press play in Plex' }),
  setArchived: async () => ({ ok: false, error: 'Stop the stream; it walks home on its own' }),
}
