/**
 * Harness adapter: Uptime Kuma — a down check stands at the machine it is down on.
 *
 * Kuma watches 195 things. The colony was reading six of them. Everything else it
 * knew, the map never heard, which is a strange way to treat the one service whose
 * whole job is noticing.
 *
 * The trick that makes this useful rather than a second alert list: almost every
 * monitor's URL is an in-cluster service address, `http://<svc>.<ns>.svc.cluster.local`.
 * That gives the namespace, the namespace gives the pod, and the pod gives the node.
 * So a failing check walks out to the rack it actually lives on and stands there,
 * and the Cluster hex tells you which computer has the problem without you reading a
 * single hostname. A check that cannot be placed goes to the Watchdog, and the ones
 * guarding backups go to the Backups tile where Blake already looks for them.
 *
 * Read-only: GET /metrics on Kuma (basic auth, empty user, API key as password) and
 * a pod list through the service account.
 */
import fsp from 'node:fs/promises'

const KUMA_URL = (process.env.KUMA_URL || 'http://uptime-kuma.uptime-kuma.svc.cluster.local:3001').replace(/\/$/, '')
const KUMA_OPEN_URL = (process.env.KUMA_OPEN_URL || 'https://uptime.kcproto.com').replace(/\/$/, '')
const KUMA_KEY = process.env.KUMA_API_KEY || ''
const KUBE_API = process.env.KUBERNETES_SERVICE_HOST ? `https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT || 443}` : ''
/** Backups have their own tile; those checks belong there, not out at a rack. */
const BACKUP_MONITORS = new RegExp(process.env.BACKUP_MONITORS || 'backup|kopia|velero|syncthing|offsite', 'i')
/** A cascade can take dozens down at once. Past this they fold into one keeper. */
const MAX_PEOPLE = Number(process.env.KUMA_MAX_PEOPLE || 12)
const TTL_MS = 60 * 1000
const BORN = Date.parse('2026-09-15T06:00:00Z')
const NL = String.fromCharCode(10)

const base = {
  worktree: '',
  effort: '',
  model: '',
  lastFocusedAt: 0,
  running: false,
  unread: false,
  starred: false,
  routine: '',
  prState: '',
  archived: false,
  hasTranscript: false,
  canOpen: true,
  canArchive: false,
  source: 'uptime-kuma',
}

async function saToken() {
  try {
    return (await fsp.readFile('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf8')).trim()
  } catch {
    return ''
  }
}

async function kubeGet(apiPath) {
  const token = await saToken()
  if (!token || !KUBE_API) throw new Error('no service account')
  const r = await fetch(KUBE_API + apiPath, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) })
  if (!r.ok) throw new Error(`${apiPath} → ${r.status}`)
  return r.json()
}

/** Every monitor Kuma knows, with its status. 1 up, 0 down, 2 pending, 3 maintenance. */
async function monitors() {
  if (!KUMA_KEY) throw new Error('no Kuma API key')
  const r = await fetch(`${KUMA_URL}/metrics`, {
    headers: { Authorization: `Basic ${Buffer.from(`:${KUMA_KEY}`).toString('base64')}` },
    signal: AbortSignal.timeout(15000),
  })
  if (!r.ok) throw new Error(`kuma → ${r.status}`)
  const text = await r.text()
  const out = []
  for (const line of text.split(NL)) {
    if (!line.startsWith('monitor_status')) continue
    const grab = (k) => line.match(new RegExp(`monitor_${k}="([^"]*)"`))?.[1] || ''
    const name = grab('name')
    if (!name) continue
    const value = Number(line.trim().split(/\s+/).pop())
    out.push({ name, type: grab('type'), url: grab('url'), hostname: grab('hostname'), value, up: value === 1 })
  }
  return out
}

/**
 * Where each namespace's work actually runs, and which node answers to which address.
 * Built once per scan from a single pod list rather than a lookup per monitor.
 */
let _place = { at: 0, data: null }
export async function placement() {
  // Shared with the keys harness, which asks the same question about credentials.
  // One pod list a minute serves both.
  if (_place.data && Date.now() - _place.at < 60 * 1000) return _place.data
  const byNamespace = new Map()
  const byAddress = new Map()
  try {
    const nodes = await kubeGet('/api/v1/nodes?limit=100')
    for (const n of nodes.items || []) {
      const name = n.metadata?.name
      for (const a of n.status?.addresses || []) if (a.address) byAddress.set(a.address, name)
      byAddress.set(name, name)
    }
  } catch {
    /* no nodes: everything falls through to the Watchdog */
  }
  try {
    const pods = await kubeGet('/api/v1/pods?limit=1000')
    for (const p of pods.items || []) {
      const ns = p.metadata?.namespace
      const node = p.spec?.nodeName
      if (!ns || !node) continue
      // Prefer a running pod's node; a namespace whose only pod is pending still
      // tells you where the scheduler put it.
      const running = p.status?.phase === 'Running'
      const held = byNamespace.get(ns)
      if (!held || (running && !held.running)) byNamespace.set(ns, { node, running })
    }
  } catch {
    /* same */
  }
  _place = { at: Date.now(), data: { byNamespace, byAddress } }
  return _place.data
}

/** Which node a namespace's work runs on, or '' when nothing places it. */
export async function nodeForNamespace(ns) {
  if (!ns) return ''
  try {
    return (await placement()).byNamespace.get(ns)?.node || ''
  } catch {
    return ''
  }
}

/** The namespace a monitor points at, from an in-cluster service address. */
function namespaceOf(url) {
  const m = String(url || '').match(/^[a-z]+:\/\/[^/]*?\.([a-z0-9-]+)\.svc\.cluster\.local/i)
  return m ? m[1] : ''
}

/** The bare host a monitor points at, for the IP and node-name cases. */
function hostOf(mon) {
  if (mon.hostname && mon.hostname !== 'null') return mon.hostname
  const m = String(mon.url || '').match(/^[a-z]+:\/\/([^/:]+)/i)
  return m ? m[1] : ''
}

async function fetchThreads() {
  const now = Date.now()
  const all = await monitors()
  const down = all.filter((m) => m.value === 0)
  const { byNamespace, byAddress } = down.length ? await placement() : { byNamespace: new Map(), byAddress: new Map() }

  // Work out where each failure lives before deciding what to draw.
  const placed = down.map((m) => {
    if (BACKUP_MONITORS.test(m.name)) return { m, zone: 'Backups', node: '', why: 'a backup check' }
    const ns = namespaceOf(m.url)
    const host = hostOf(m)
    const node = (ns && byNamespace.get(ns)?.node) || byAddress.get(host) || ''
    if (node) return { m, zone: 'Cluster', node, why: ns ? `${ns} runs on ${node}` : `${host} is ${node}` }
    return { m, zone: 'Watchdog', node: '', why: host ? `nothing in the cluster answers for ${host}` : 'no address to place it by' }
  })

  const threads = []
  const keeper = {
    ...base,
    id: 'kuma:watch',
    kind: 'keeper',
    title: '📟 Uptime Kuma',
    plate: down.length ? String(down.length) : '',
    preview: down.length
      ? `${down.length} of ${all.length} checks are down.`
      : `All ${all.length} checks are answering.`,
    details: {
      Watching: `${all.length} checks`,
      Down: down.length ? down.map((m) => `• ${m.name}`).join(NL) : 'none',
      Placed: placed.filter((p) => p.node).length ? placed.filter((p) => p.node).map((p) => `${p.m.name} → ${p.node}`).join(NL) : 'none out at a rack',
      Note: 'A failing check walks to the node its namespace runs on. One it cannot place waits at the Watchdog.',
    },
    project: 'Watchdog',
    projectPath: 'kuma://watch',
    cwd: 'uptime-kuma',
    gitBranch: down.length ? `${down.length} down` : `${all.length} green`,
    createdAt: BORN,
    lastActivityAt: now,
    hasError: false,
    sizeBytes: 4000,
    ref: { url: KUMA_OPEN_URL },
  }
  threads.push(keeper)

  // One person per failure, standing where it failed. Past the cap the rest are a
  // number on the keeper: a storm should not bury the map in identical astronauts.
  for (const p of placed.slice(0, MAX_PEOPLE)) {
    threads.push({
      ...base,
      id: `kuma:${p.m.name.replace(/[^\w]+/g, '-').toLowerCase()}`,
      title: `📟 ${p.m.name.slice(0, 60)}`,
      preview: `Down. ${p.why}.`,
      details: {
        Monitor: p.m.name,
        Type: p.m.type,
        Target: p.m.url && p.m.url !== 'https://' ? p.m.url : hostOf(p.m),
        Runs_on: p.node || 'not placed',
        Why_here: p.why,
      },
      project: p.zone,
      projectPath: `kuma://${p.m.name}`,
      cwd: p.node || 'uptime-kuma',
      gitBranch: 'down',
      // Stand at the rack rather than raising a hut of its own.
      ...(p.node ? { attachTo: `node:${p.node}` } : {}),
      createdAt: BORN + 1,
      lastActivityAt: now,
      hasError: true,
      alertKey: `kuma:${p.m.name}`,
      exit: 'beam',
      sizeBytes: 1500,
      ref: { url: KUMA_OPEN_URL },
    })
  }
  if (placed.length > MAX_PEOPLE) {
    keeper.details.Note = `${placed.length - MAX_PEOPLE} more are down than are standing on the map; the rest are listed above.`
  }
  return threads
}

let cache = { at: 0, data: null, inflight: null }
async function scanThreads() {
  if (cache.data && Date.now() - cache.at < TTL_MS) return cache.data
  if (!cache.inflight) {
    cache.inflight = fetchThreads()
      .then((data) => {
        cache = { at: Date.now(), data, inflight: null }
        return data
      })
      .catch((err) => {
        cache.inflight = null
        console.warn('kuma:', err.message)
        return cache.data || []
      })
  }
  return cache.data || cache.inflight
}

export default {
  id: 'kuma',
  name: 'Uptime Kuma',
  detect: async () => Boolean(KUMA_KEY),
  scanThreads,
  openThread: (ref) => ({ ok: true, browser: true, url: ref?.url || KUMA_OPEN_URL }),
  newSession: () => ({ ok: false, error: 'Add the monitor in Kuma' }),
  setArchived: async () => ({ ok: false, error: 'Fix it, or silence it in Kuma' }),
}
