/**
 * Harness adapter: fleet health that no single app owns.
 *
 * - Flux (Cluster hex): kustomizations that are not Ready, read through the ServiceAccount.
 * - Disks (Cluster hex): every node's root filesystem from Prometheus; the worst percent over
 *   his head, a hand up when any node is past DISK_ALERT.
 * - NAS (Backups hex): jarvisnas /mnt/home, the volume everything backs up to.
 * - Failover watch (Hetzner DR hex): is the dr-failover-controller running on the Hetzner
 *   cluster, and are the canaries it polls (grafana, homepage, immich) answering. The
 *   controller flips 17 hostnames to the DR tunnel when home is down; if it is not running,
 *   nothing will.
 */
import fsp from 'node:fs/promises'

const KUBE_API = process.env.KUBERNETES_SERVICE_HOST ? `https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT || 443}` : ''
const PROM = (process.env.PROMETHEUS_URL || 'http://prometheus.monitoring.svc.cluster.local:9090').replace(/\/$/, '')
const DR_URL = (process.env.DR_STATUS_URL || 'http://100.120.190.49:3200/').replace(/\/?$/, '/')
const CANARIES = (process.env.FAILOVER_CANARIES || 'grafana.kcproto.com,homepage.kcproto.com,immich.kcproto.com').split(',').map((s) => s.trim()).filter(Boolean)
const DISK_ALERT = Number(process.env.DISK_ALERT_PCT || 90)
const KUMA_URL = (process.env.KUMA_URL || 'http://uptime-kuma.uptime-kuma.svc.cluster.local:3001').replace(/\/$/, '')
const KUMA_OPEN_URL = (process.env.KUMA_OPEN_URL || 'https://uptime.kcproto.com').replace(/\/$/, '')
const KUMA_KEY = process.env.KUMA_API_KEY || ''
/** Which Kuma monitors count as guarding a backup. */
const BACKUP_MONITORS = new RegExp(process.env.BACKUP_MONITORS || 'backup|kopia|velero|syncthing|offsite', 'i')
const TTL_MS = 2 * 60 * 1000
const BORN = Date.parse('2026-09-05T12:00:00Z')
const NL = String.fromCharCode(10)

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
async function promQuery(q) {
  const r = await fetch(`${PROM}/api/v1/query?query=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(12000) })
  if (!r.ok) throw new Error(`prometheus → ${r.status}`)
  const j = await r.json()
  return j.data?.result || []
}

const base = {
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
  canOpen: true,
  canArchive: false,
}

async function fluxThread(now) {
  let list = null
  let error = ''
  try {
    list = await kubeGet('/apis/kustomize.toolkit.fluxcd.io/v1/kustomizations?limit=500')
  } catch (err) {
    error = err.message
  }
  const items = list?.items || []
  const ready = (k) => (k.status?.conditions || []).find((c) => c.type === 'Ready')
  // A reconcile in progress is not a failure until it has been in progress a while: every
  // release nudges the source and the whole tree re-reconciles for a few minutes.
  const GRACE_MS = Number(process.env.FLUX_GRACE_MIN || 15) * 60000
  const stuck = (k) => {
    const c = ready(k)
    if (!c || c.status === 'True') return false
    const since = Date.parse(c.lastTransitionTime || '') || 0
    const inProgress = /progress/i.test(`${c.reason || ''} ${c.message || ''}`)
    return !inProgress || Date.now() - since > GRACE_MS
  }
  const bad = items.filter((k) => stuck(k) && !k.spec?.suspend)
  const suspended = items.filter((k) => k.spec?.suspend)
  return {
    ...base,
    id: 'fleet:flux',
    kind: 'keeper',
    title: '🔁 Flux',
    plate: items.length ? `${items.length - bad.length}/${items.length}` : '',
    count: bad.length,
    preview: error ? `Cannot read kustomizations: ${error}` : bad.length ? `${bad.length} not ready:${NL}${bad.slice(0, 8).map((k) => `• ${k.metadata.name}: ${(ready(k)?.message || ready(k)?.reason || 'not ready').slice(0, 90)}`).join(NL)}` : `${items.length} kustomizations reconciled${suspended.length ? `, ${suspended.length} suspended` : ''}`,
    details: {
      Synced: items.length ? `${items.length - bad.length} of ${items.length}` : '',
      'Not ready': bad.map((k) => `${k.metadata.name}: ${(ready(k)?.message || ready(k)?.reason || '').slice(0, 160)}`).join(NL) || 'none',
      Suspended: suspended.map((k) => k.metadata.name).join(', ') || 'none',
      Rule: 'Suspend and resume a stuck kustomization; never delete one with prune on.',
    },
    project: 'Cluster',
    projectPath: 'fleet://flux',
    cwd: 'flux-system',
    gitBranch: error ? 'no access' : bad.length ? `${bad.length} not ready` : 'reconciled',
    model: '',
    createdAt: BORN,
    lastActivityAt: now,
    hasError: bad.length > 0 || Boolean(error),
    alertKey: bad.length ? `flux:${bad.map((k) => k.metadata.name).sort().join(',')}` : error ? `err:${error}` : '',
    sizeBytes: 1000 * (1 + items.length / 10),
    source: 'flux',
    ref: { url: 'https://agents.kcproto.com/' },
  }
}

async function diskThreads(now) {
  let rows = []
  let error = ''
  try {
    rows = await promQuery('1 - node_filesystem_avail_bytes{mountpoint="/",fstype!~"tmpfs|overlay|squashfs"} / node_filesystem_size_bytes{mountpoint="/",fstype!~"tmpfs|overlay|squashfs"}')
  } catch (err) {
    error = err.message
  }
  const nodes = rows
    .map((r) => ({ name: r.metric.instance || r.metric.job, pct: Math.round(Number(r.value[1]) * 100) }))
    .filter((n) => Number.isFinite(n.pct))
    .sort((a, b) => b.pct - a.pct)
  const hot = nodes.filter((n) => n.pct >= DISK_ALERT)
  const warm = nodes.filter((n) => n.pct >= 80 && n.pct < DISK_ALERT)
  const worst = nodes[0]
  const disks = {
    ...base,
    id: 'fleet:disks',
    kind: 'keeper',
    title: '💾 Disks',
    plate: worst ? `${worst.pct}%` : '',
    count: hot.length,
    preview: error ? `Cannot read disk usage: ${error}` : hot.length ? `${hot.length} node${hot.length > 1 ? 's' : ''} past ${DISK_ALERT}%:${NL}${hot.map((n) => `• ${n.name} ${n.pct}%`).join(NL)}` : worst ? `Fullest root disk: ${worst.name} at ${worst.pct}%${warm.length ? ` · ${warm.length} over 80%` : ''}` : 'no data',
    details: {
      'Over 80%': [...hot, ...warm].map((n) => `${n.name} ${n.pct}%`).join(', ') || 'none',
      'All nodes': nodes.map((n) => `${n.name} ${n.pct}%`).join(', '),
      Threshold: `${DISK_ALERT}% raises a hand`,
    },
    project: 'Cluster',
    projectPath: 'fleet://disks',
    cwd: 'node-exporter',
    gitBranch: hot.length ? `${hot.length} full` : worst ? `worst ${worst.pct}%` : '',
    model: '',
    createdAt: BORN + 1,
    lastActivityAt: now,
    hasError: hot.length > 0,
    alertKey: hot.length ? `disks:${hot.map((n) => n.name).sort().join(',')}` : '',
    sizeBytes: 1000 * (1 + nodes.length),
    source: 'prometheus',
    ref: { url: 'https://grafana.kcproto.com' },
  }

  let nas = null
  try {
    const r = await promQuery('1 - node_filesystem_avail_bytes{instance="jarvisnas",mountpoint="/mnt/home"} / node_filesystem_size_bytes{instance="jarvisnas",mountpoint="/mnt/home"}')
    const free = await promQuery('node_filesystem_avail_bytes{instance="jarvisnas",mountpoint="/mnt/home"}')
    if (r[0]) nas = { pct: Math.round(Number(r[0].value[1]) * 100), freeTb: free[0] ? (Number(free[0].value[1]) / 1e12).toFixed(2) : '' }
  } catch {
    /* card says unknown */
  }
  const nasThread = {
    ...base,
    id: 'fleet:nas',
    kind: 'keeper',
    title: '🗄️ NAS',
    plate: nas ? `${nas.pct}%` : '',
    preview: nas ? `jarvisnas /mnt/home at ${nas.pct}%${nas.freeTb ? `, ${nas.freeTb} TB free` : ''}. Velero, Kopia and Syncthing all land here.` : 'Cannot read the NAS volume',
    details: { Volume: 'jarvisnas 100.103.153.94 /mnt/home (NFS)', Used: nas ? `${nas.pct}%` : '', Free: nas?.freeTb ? `${nas.freeTb} TB` : '', Holds: 'velero-backups, Kopia desktop repo, Syncthing mirror, NFS PVs' },
    project: 'Backups',
    projectPath: 'fleet://nas',
    cwd: 'jarvisnas',
    gitBranch: nas ? (nas.pct >= DISK_ALERT ? 'nearly full' : `${nas.pct}% used`) : 'unknown',
    model: '',
    createdAt: BORN + 2,
    lastActivityAt: now,
    hasError: Boolean(nas && nas.pct >= DISK_ALERT),
    alertKey: nas && nas.pct >= DISK_ALERT ? `nas:${nas.pct}` : '',
    sizeBytes: 3000,
    source: 'prometheus',
    ref: { url: 'https://grafana.kcproto.com' },
  }
  return [disks, nasThread]
}

async function failoverThread(now) {
  let dr = null
  let error = ''
  try {
    const r = await fetch(DR_URL, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) })
    if (!r.ok) throw new Error(`dr → ${r.status}`)
    dr = await r.json()
  } catch (err) {
    error = err.message
  }
  const pods = dr?.pods?.list || []
  const ctl = pods.find((p) => /dr-failover/.test(p.name || ''))
  const ctlUp = Boolean(ctl && /Running/.test(ctl.status || ''))
  const canaries = await Promise.all(
    CANARIES.map(async (h) => {
      try {
        const r = await fetch(`https://${h}/`, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(8000) })
        return { host: h, ok: r.status < 500 }
      } catch {
        return { host: h, ok: false }
      }
    })
  )
  const up = canaries.filter((c) => c.ok).length
  const homeHealthy = up === canaries.length
  return {
    ...base,
    id: 'dr:failover',
    kind: 'keeper',
    title: '🛟 Failover watch',
    plate: error ? '' : ctlUp ? (homeHealthy ? 'home' : `${up}/${canaries.length}`) : 'off',
    preview: error
      ? `Cannot reach the DR status API: ${error}`
      : !ctl
        ? 'The dr-failover-controller is NOT on the Hetzner cluster. Nothing will flip DNS if home goes down.'
        : !ctlUp
          ? `dr-failover-controller is ${ctl.status}. Nothing will flip DNS if home goes down.`
          : `Controller running on Hetzner · canaries ${up}/${canaries.length} up · routing: ${homeHealthy ? 'home is primary' : 'home degraded, controller deciding'}`,
    details: {
      Controller: ctl ? `${ctl.name}: ${ctl.status}` : 'not found on the Hetzner cluster',
      Canaries: canaries.map((c) => `${c.host}: ${c.ok ? 'up' : 'DOWN'}`).join(NL),
      Flips: '17 hostnames from the home tunnel to jarvis-dr after ~2 min down, back after ~3 min healthy',
      Code: 'apps/dr-failover/controller.py (source of record); runs from the dr-failover-code ConfigMap on Hetzner, not Flux',
      Note: 'Routing state is inferred from the canaries; the controller does not publish it yet.',
    },
    project: 'Hetzner DR',
    projectPath: 'dr://failover',
    cwd: 'dr-failover',
    gitBranch: error ? 'unknown' : !ctlUp ? 'controller down' : homeHealthy ? 'home primary' : 'watching',
    model: '',
    createdAt: BORN + 3,
    lastActivityAt: now,
    hasError: Boolean(error) || !ctlUp,
    alertKey: error ? `err:${error}` : !ctlUp ? `ctl:${ctl ? ctl.status : 'missing'}` : '',
    sizeBytes: 3000,
    source: 'dr-failover',
    ref: { url: 'https://agents.kcproto.com/' },
  }
}

/**
 * The backup watch (Backups hex): every Uptime Kuma monitor that guards a backup, read
 * straight off Kuma's Prometheus endpoint. Kuma is the thing that actually knows whether
 * the desktop's Kopia run, the Velero store, the NAS mirror and the content check are
 * alive; the colony just puts its verdict on the map. Any one of them down is a flag,
 * because a backup you are not told about is not a backup.
 */
async function backupThread(now) {
  const thread = {
    ...base,
    id: 'backup:watch',
    kind: 'keeper',
    title: '💾 Backup watch',
    project: 'Backups',
    projectPath: 'kuma://backups',
    cwd: 'uptime-kuma',
    model: '',
    createdAt: BORN + 3,
    lastActivityAt: now,
    sizeBytes: 3000,
    source: 'uptime-kuma',
    ref: { url: KUMA_OPEN_URL },
  }
  if (!KUMA_KEY) {
    return { ...thread, plate: '', preview: 'No Kuma API key on this server, so the backup monitors cannot be read.', details: { Fix: 'Mint a key in Uptime Kuma and put it in the bot-farm-kuma secret.' }, gitBranch: 'no key', hasError: false }
  }
  let monitors = []
  try {
    const r = await fetch(`${KUMA_URL}/metrics`, {
      headers: { Authorization: `Basic ${Buffer.from(`:${KUMA_KEY}`).toString('base64')}` },
      signal: AbortSignal.timeout(15000),
    })
    if (!r.ok) throw new Error(`kuma → ${r.status}`)
    const text = await r.text()
    for (const line of text.split(String.fromCharCode(10))) {
      if (!line.startsWith('monitor_status')) continue
      const name = line.match(/monitor_name="([^"]*)"/)?.[1]
      const value = Number(line.trim().split(/\s+/).pop())
      // 1 up, 0 down, 2 pending, 3 maintenance. Only a hard down is a failure.
      if (name && BACKUP_MONITORS.test(name)) monitors.push({ name, up: value === 1, value })
    }
  } catch (err) {
    return { ...thread, preview: `Cannot read Uptime Kuma: ${err.message}`, details: { Error: err.message }, gitBranch: 'unreadable', hasError: false }
  }
  if (!monitors.length) {
    return { ...thread, preview: 'Kuma answered, but no monitor looks like a backup.', details: { Note: 'Name a monitor so it matches backup, Kopia, Velero, Syncthing or offsite.' }, gitBranch: 'nothing watched', hasError: false }
  }
  monitors.sort((a, b) => a.name.localeCompare(b.name))
  const down = monitors.filter((m) => !m.up)
  const state = (m) => (m.value === 1 ? 'up' : m.value === 0 ? 'DOWN' : m.value === 2 ? 'pending' : m.value === 3 ? 'maintenance' : 'unknown')
  return {
    ...thread,
    plate: down.length ? String(down.length) : '',
    preview: down.length
      ? `${down.length} of ${monitors.length} backup checks are down: ${down.map((m) => m.name).join(', ')}`
      : `All ${monitors.length} backup checks are answering.`,
    details: {
      Down: down.length ? down.map((m) => `• ${m.name}`).join(NL) : 'none',
      Watching: monitors.map((m) => `${m.name}: ${state(m)}`).join(NL),
      Source: 'Uptime Kuma, read through its Prometheus endpoint',
    },
    gitBranch: down.length ? `${down.length} down` : `${monitors.length} green`,
    hasError: down.length > 0,
    alertKey: down.length ? `backup:${down.map((m) => m.name).sort().join(',')}` : '',
  }
}

async function fetchThreads() {
  const now = Date.now()
  const [flux, disks, fo, backup] = await Promise.all([fluxThread(now), diskThreads(now), failoverThread(now), backupThread(now)])
  return [flux, ...disks, fo, backup]
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
        console.warn('fleet:', err.message)
        return cache.data || []
      })
  }
  return cache.data || cache.inflight
}

export default {
  id: 'fleet',
  name: 'Fleet health',
  detect: async () => true,
  scanThreads,
  openThread: (ref) => ({ ok: true, browser: true, url: ref?.url || 'https://grafana.kcproto.com' }),
  newSession: () => ({ ok: false, error: 'Nothing to start here' }),
  setArchived: async () => ({ ok: false, error: 'These stay on watch' }),
}
