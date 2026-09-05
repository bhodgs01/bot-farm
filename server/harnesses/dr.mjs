/**
 * Harness adapter: the off-site outpost and the desktop backup.
 *
 * Hetzner DR: the standalone k3s node in Ashburn that keeps the client apps alive through a
 * home outage. Its status API says how many pods are running. One keeper on its own distant
 * hex; a failed pod or an unreachable node raises his hand.
 *
 * Desktop Kopia: the nightly C:\Users\blake snapshot to jarvisnas reports to an Uptime Kuma
 * push monitor. Read through Kuma's metrics endpoint with an API key. It was silently dead
 * for five months once; this worker stands on the Backups hex so it cannot be again.
 */

const DR_URL = (process.env.DR_STATUS_URL || 'http://100.120.190.49:3200/').replace(/\/?$/, '/')
const KUMA_URL = (process.env.KUMA_URL || 'http://uptime-kuma.uptime-kuma.svc.cluster.local:3001').replace(/\/$/, '')
const KUMA_KEY = process.env.KUMA_API_KEY || ''
const KUMA_MONITOR = process.env.KUMA_KOPIA_MONITOR || 'Desktop backup'
const DR_ZONE = 'Hetzner DR'
const BACKUP_ZONE = 'Backups'
const TTL_MS = 2 * 60 * 1000
const BORN = Date.parse('2026-09-05T12:00:00Z')
const NL = String.fromCharCode(10)

async function drStatus() {
  const r = await fetch(DR_URL, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) })
  if (!r.ok) throw new Error(`dr → ${r.status}`)
  return r.json()
}

/** Kuma's Prometheus text, filtered to the one monitor: status, response time, last check. */
async function kopiaStatus() {
  if (!KUMA_KEY) return { known: false, reason: 'no Kuma key' }
  const r = await fetch(`${KUMA_URL}/metrics`, { headers: { Authorization: `Basic ${Buffer.from(`:${KUMA_KEY}`).toString('base64')}` }, signal: AbortSignal.timeout(10000) })
  if (!r.ok) throw new Error(`kuma metrics → ${r.status}`)
  const text = await r.text()
  const line = text.split(NL).find((l) => l.startsWith('monitor_status{') && l.includes(KUMA_MONITOR))
  if (!line) return { known: false, reason: `monitor "${KUMA_MONITOR}" not in metrics` }
  const value = Number(line.trim().split(/\s+/).pop())
  const name = (line.match(/monitor_name="([^"]+)"/) || [])[1] || KUMA_MONITOR
  // 1 up, 0 down, 2 pending, 3 maintenance
  return { known: true, name, up: value === 1, pending: value === 2, value }
}

async function fetchThreads() {
  const now = Date.now()
  const out = []
  const [dr, kopia] = await Promise.all([drStatus().catch((e) => ({ error: e.message })), kopiaStatus().catch((e) => ({ known: false, reason: e.message }))])

  const pods = dr.pods || {}
  const node = (dr.nodes || [])[0]
  const reachable = !dr.error
  const failed = Number(pods.failed) || 0
  const notReady = reachable && node && node.status !== 'Ready'
  out.push({
    id: 'dr:hetzner',
    kind: 'keeper',
    landmark: 'outpost',
    title: '🌐 Hetzner DR',
    roof: reachable ? `${pods.running ?? 0}/${pods.total ?? 0} pods` : 'unreachable',
    count: failed,
    preview: reachable
      ? `${pods.running} of ${pods.total} pods running on ${node?.name || 'the DR node'}${failed ? `, ${failed} failed` : ''}${pods.pending ? `, ${pods.pending} pending` : ''}`
      : `Cannot reach the DR status API: ${dr.error}`,
    details: {
      Node: node ? `${node.name} · ${node.status} · k3s ${node.version} · ${node.cpu_capacity} vCPU / ${node.mem_capacity_gb} GB` : '',
      Pods: reachable ? `${pods.running} running, ${pods.pending || 0} pending, ${failed} failed of ${pods.total}` : '',
      Failing: (pods.list || []).filter((p) => p.status && !/Running|Succeeded|Completed/.test(p.status)).map((p) => `${p.namespace || ''}/${p.name}: ${p.status}`).join(NL),
      Where: 'Hetzner Cloud CPX31, Ashburn VA · tailnet 100.120.190.49',
      Failover: 'dr-failover-controller flips 16 hostnames to the jarvis-dr tunnel when home is down for ~2 min',
      Updated: dr.timestamp ? new Date(dr.timestamp).toLocaleTimeString('en-US', { timeZone: 'America/Chicago' }) : '',
    },
    project: DR_ZONE,
    projectPath: 'dr://hetzner',
    worktree: '',
    cwd: 'jarvis-hetzner',
    gitBranch: reachable ? (failed || notReady ? 'degraded' : 'standing by') : 'unreachable',
    model: 'k3s',
    effort: '',
    createdAt: BORN,
    lastActivityAt: Date.parse(dr.timestamp || '') || now,
    lastFocusedAt: 0,
    running: false,
    unread: false,
    hasError: !reachable || failed > 0 || Boolean(notReady),
    alertKey: !reachable ? 'unreachable' : failed ? `failed:${failed}` : notReady ? 'notready' : '',
    starred: false,
    routine: '',
    prState: '',
    archived: false,
    hasTranscript: false,
    sizeBytes: 1000 * (1 + (Number(pods.total) || 0)),
    source: 'hetzner-dr',
    canOpen: true,
    canArchive: false,
    ref: { url: 'https://agents.kcproto.com/' },
  })

  out.push({
    id: 'backup:desktop',
    kind: 'backup',
    title: '💽 Desktop backup',
    preview: kopia.known
      ? kopia.up
        ? `Kopia snapshot of C:\\Users\\blake to jarvisnas is current (Kuma push heartbeat within 26 h)`
        : kopia.pending
          ? 'Kuma is waiting on the first heartbeat'
          : 'No Kopia heartbeat in 26 h: the nightly desktop backup did not run. It was silently dead for five months once.'
      : `Cannot read the backup monitor: ${kopia.reason}`,
    details: {
      What: 'Kopia over SFTP to jarvisnas, Task Scheduler "Kopia-PC-Backup" daily 03:00, retention 7d/4w/3m/1y',
      Monitor: `Uptime Kuma push monitor "${kopia.name || KUMA_MONITOR}" (26 h heartbeat + 1 retry)`,
      Status: kopia.known ? (kopia.up ? 'up' : kopia.pending ? 'pending' : 'DOWN') : `unknown (${kopia.reason})`,
      Check: 'kopia snapshot list --all on the desktop; Task Scheduler last result',
    },
    project: BACKUP_ZONE,
    projectPath: 'backup://desktop',
    worktree: '',
    cwd: 'blake-desktop',
    gitBranch: kopia.known ? (kopia.up ? 'current' : 'missed') : 'unknown',
    model: 'Kopia',
    effort: '',
    createdAt: BORN + 1,
    lastActivityAt: now,
    lastFocusedAt: 0,
    running: false,
    unread: false,
    hasError: kopia.known ? !(kopia.up || kopia.pending) : false,
    alertKey: kopia.known && !kopia.up && !kopia.pending ? `down:${new Date().toISOString().slice(0, 10)}` : '',
    starred: false,
    routine: '',
    prState: '',
    archived: false,
    hasTranscript: false,
    sizeBytes: 2000,
    source: 'kopia-kuma',
    canOpen: true,
    canArchive: false,
    ref: { url: `${process.env.KUMA_OPEN_URL || 'http://100.82.137.28:30310'}/dashboard` },
  })
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
        console.warn('dr:', err.message)
        return cache.data || []
      })
  }
  return cache.data || cache.inflight
}

export default {
  id: 'dr',
  name: 'DR and backups',
  detect: async () => true,
  scanThreads,
  openThread: (ref) => ({ ok: true, browser: true, url: ref?.url || 'https://agents.kcproto.com/' }),
  newSession: () => ({ ok: false, error: 'Nothing to start here' }),
  setArchived: async () => ({ ok: false, error: 'These stay on watch' }),
}
