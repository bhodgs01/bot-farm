/**
 * Harness adapter: the print farm — every running print is an astronaut.
 *
 * Every enabled printer is a machine on the Print Service hex with its operator beside it.
 * A job starts and that operator gets to work, with a ring over its head that fills as the print completes. The
 * card shows the job, the printer, the client whose order it is, layers and ETA. When the
 * print finishes the astronaut walks home. A printer reporting an error slumps with a `!`
 * until it clears.
 *
 * Read-only: GET /api/fleet and /api/orders on the print-farm service, nothing else.
 */

const FARM_URL = process.env.PRINT_FARM_URL || 'http://print-farm.print-farm.svc.cluster.local'
const OPEN_URL = process.env.PRINT_FARM_OPEN_URL || 'https://print.kcproto.com'
const TTL_MS = 10 * 1000
const ORDERS_TTL_MS = 5 * 60 * 1000

async function getJson(path, ms = 8000) {
  const res = await fetch(`${FARM_URL}${path}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(ms) })
  if (!res.ok) throw new Error(`print-farm ${path} → ${res.status}`)
  return res.json()
}

let orders = { at: 0, byId: new Map() }
async function ordersById() {
  if (Date.now() - orders.at < ORDERS_TTL_MS) return orders.byId
  try {
    const list = await getJson('/api/orders')
    orders = { at: Date.now(), byId: new Map((Array.isArray(list) ? list : []).map((o) => [o.id, o])) }
  } catch {
    orders.at = Date.now() - ORDERS_TTL_MS + 30 * 1000 // retry in 30s, keep what we had
  }
  return orders.byId
}

function eta(seconds) {
  const s = Number(seconds) || 0
  if (s <= 0) return ''
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min left`
  return `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m left`
}

/** Remember when a job was first seen so its astronaut keeps one id for the whole print. */
const jobStart = new Map()

async function fetchThreads() {
  const [fleet, byOrder] = await Promise.all([getJson('/api/fleet'), ordersById()])
  const now = Date.now()
  const out = []
  const live = new Set()
  for (const p of Array.isArray(fleet) ? fleet : []) {
    if (!p.enabled) continue
    const state = String(p.state || '').toLowerCase()
    const order = p.assigned_order_id ? byOrder.get(p.assigned_order_id) : null
    const client = order?.client || ''
    const printing = state === 'printing' || state === 'paused'
    if (printing) {
      const key = `${p.id}:${p.job_name || ''}`
      live.add(key)
      if (!jobStart.has(key)) jobStart.set(key, now)
      const progress = Math.max(0, Math.min(1, Number(p.progress) || 0))
      const layers = p.layer_total ? `layer ${p.layer_current || 0}/${p.layer_total}` : ''
      out.push({
        id: `print:${p.id}`,
        kind: 'printing',
        landmark: 'printer',
        progress,
        title: `${p.job_name || 'Print'}`.slice(0, 120),
        preview: [client ? `for ${client}` : 'one-off', `on ${p.name}`, layers, eta(p.eta_seconds), state === 'paused' ? 'PAUSED' : '']
          .filter(Boolean)
          .join(' · '),
        project: 'Print Service',
        projectPath: 'farm://print-service',
        worktree: '',
        cwd: p.name,
        gitBranch: `${Math.round(progress * 100)}%`,
        model: p.model || p.driver || '',
        effort: '',
        createdAt: jobStart.get(key),
        lastActivityAt: Date.parse(p.updated_at) || now,
        lastFocusedAt: 0,
        running: state === 'printing',
        unread: false,
        hasError: false,
        starred: false,
        routine: '',
        prState: '',
        archived: false,
        hasTranscript: false,
        // The card's bar reads log10(bytes); map completion onto its 1KB..3MB range.
        sizeBytes: Math.round(1000 * Math.pow(10, 3.5 * Math.max(0.01, progress))),
        source: 'print-farm',
        canOpen: true,
        canArchive: false,
        ref: { printer: p.id },
      })
    } else {
      const offline = p.online === false
      const broken = state === 'error' && p.error_text
      out.push({
        id: `print:${p.id}`,
        landmark: 'printer',
        title: broken ? `⚠ ${p.name}` : p.name,
        preview: broken ? String(p.error_text).slice(0, 200) : offline ? `${p.name} is offline` : `${p.name} idle${p.job_name ? ` · last: ${p.job_name}` : ''}${client ? ` · dedicated to ${client}` : ''}`,
        project: 'Print Service',
        projectPath: 'farm://print-service',
        worktree: '',
        cwd: p.name,
        gitBranch: broken ? 'error' : offline ? 'offline' : 'idle',
        model: p.model || '',
        effort: '',
        createdAt: Date.parse(p.updated_at) || now,
        lastActivityAt: Date.parse(p.updated_at) || now,
        lastFocusedAt: 0,
        running: false,
        unread: false,
        hasError: Boolean(broken || offline),
        starred: false,
        routine: '',
        prState: '',
        archived: false,
        hasTranscript: false,
        sizeBytes: 1000 * (1 + (Number(p.layer_total) || 0) / 10),
        source: 'print-farm',
        canOpen: true,
        canArchive: false,
        ref: { printer: p.id },
      })
    }
  }
  for (const key of jobStart.keys()) if (!live.has(key)) jobStart.delete(key)
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
        console.warn('print-farm:', err.message)
        return cache.data || []
      })
  }
  return cache.data || cache.inflight
}

let detectCache = { at: 0, ok: false }
async function detect() {
  if (Date.now() - detectCache.at < 60 * 1000) return detectCache.ok
  let ok = false
  try {
    await getJson('/api/fleet', 5000)
    ok = true
  } catch {
    ok = false
  }
  detectCache = { at: Date.now(), ok }
  return ok
}

export default {
  id: 'print-farm',
  name: 'Print Farm',
  detect,
  scanThreads,
  openThread: () => ({ ok: true, browser: true, url: OPEN_URL }),
  newSession: () => ({ ok: false, error: 'Start prints from the farm dashboard' }),
  setArchived: async () => ({ ok: false, error: 'It walks home when the print finishes' }),
}
