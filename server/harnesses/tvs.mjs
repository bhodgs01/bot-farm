/**
 * Harness adapter: the Embassy TVs — three Raspberry Pi signage boxes on the tailnet.
 *
 * Each TV is a worker on the Embassy hex. SSH answering means the box is up. A box the
 * tailnet knows but that will not open port 22 is the "answers ARP, refuses SSH" case from
 * the install notes: a stalled boot or a bad SD card, and the fix is a reflash, so he raises
 * a hand. What each screen is showing comes from the portal's public signage poll.
 */
import net from 'node:net'

const ZONE = 'Embassy Landscape'
const TTL_MS = 60 * 1000
const BORN = Date.parse('2026-09-05T12:00:00Z')
const SIGNAGE = (process.env.EMBASSY_SIGNAGE_URL || 'https://inspire.kcproto.com/api/signage/poll').replace(/\/$/, '')
const TVS = (() => {
  try {
    const v = JSON.parse(process.env.EMBASSY_TVS || '')
    if (Array.isArray(v) && v.length) return v
  } catch {
    /* default list below */
  }
  return [
    { id: 'tv1', name: 'TV 1', host: '100.107.216.105', where: 'sales dashboard' },
    { id: 'tv2', name: 'TV 2', host: '100.124.55.107', where: '' },
    { id: 'tv3', name: 'TV 3', host: '100.89.174.27', where: '' },
  ]
})()

const probe = (host, port, ms = 5000) =>
  new Promise((resolve) => {
    const s = net.connect({ host, port, timeout: ms })
    s.on('connect', () => {
      s.destroy()
      resolve('open')
    })
    s.on('timeout', () => {
      s.destroy()
      resolve('timeout')
    })
    s.on('error', (e) => resolve(e.code || 'error'))
  })

async function showing(id) {
  try {
    const r = await fetch(`${SIGNAGE}/${id}`, { signal: AbortSignal.timeout(6000) })
    if (!r.ok) return ''
    const t = await r.text()
    try {
      const j = JSON.parse(t)
      return String(j.url || j.link || j.value || t).slice(0, 160)
    } catch {
      return t.slice(0, 160)
    }
  } catch {
    return ''
  }
}

async function fetchThreads() {
  const now = Date.now()
  return Promise.all(
    TVS.map(async (tv, i) => {
      const [ssh, url] = await Promise.all([probe(tv.host, 22), showing(tv.id)])
      const up = ssh === 'open'
      const refused = ssh === 'ECONNREFUSED'
      const state = up ? 'online' : refused ? 'up, SSH refused' : ssh === 'timeout' ? 'unreachable' : `down (${ssh})`
      return {
        id: `tv:${tv.id}`,
        kind: 'device',
        landmark: i === 0 ? 'tvwall' : undefined,
        title: `📺 ${tv.name}`,
        preview: up ? `${tv.name} online${url ? ` · showing ${url}` : ''}` : `${tv.name} ${state}: answers on the tailnet but not SSH means a stalled boot or a bad SD card. Reflash.`,
        details: { Status: state, Tailscale: tv.host, Showing: url || (tv.where || 'unknown'), SSH: `ssh embassy${tv.id}@${tv.host}`, Fix: up ? '' : 'Reflash the SD card (let Imager verify), then /check-tvs' },
        project: ZONE,
        projectPath: 'tvs://embassy',
        worktree: '',
        cwd: tv.id,
        gitBranch: state,
        model: 'Raspberry Pi',
        effort: '',
        createdAt: BORN + i,
        lastActivityAt: now,
        lastFocusedAt: 0,
        running: false,
        unread: false,
        hasError: !up,
        alertKey: up ? '' : `tv:${tv.id}:${ssh}`,
        starred: false,
        routine: '',
        prState: '',
        archived: false,
        hasTranscript: false,
        sizeBytes: 1200,
        source: 'embassy-tvs',
        canOpen: Boolean(url && /^https?:/.test(url)),
        canArchive: false,
        ref: { tv: tv.id, url },
      }
    })
  )
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
        console.warn('tvs:', err.message)
        return cache.data || []
      })
  }
  return cache.data || cache.inflight
}

export default {
  id: 'tvs',
  name: 'Embassy TVs',
  detect: async () => true,
  scanThreads,
  openThread: (ref) => (ref?.url ? { ok: true, browser: true, url: ref.url } : { ok: false, error: 'Nothing on that screen to open' }),
  newSession: () => ({ ok: false, error: 'Point a TV at a page from the Signage card in the portal admin' }),
  setArchived: async () => ({ ok: false, error: 'The TVs stay' }),
}
