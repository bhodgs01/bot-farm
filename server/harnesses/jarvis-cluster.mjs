/**
 * Harness adapter: the JARVIS Armada — every production agent on the K3s cluster.
 *
 * Bot Crossing was written for coding-agent threads on a laptop. Here the "harness" is the
 * cluster itself: one Thread per named agent (Janine, Biff, COLE, ...), one hex zone per
 * client, and every visible state derived from a real signal. There is no simulator and
 * there will not be one — an astronaut hammers because its pods are burning CPU or a job
 * is mid-run, slumps because something is CrashLooping or a deployment has no ready
 * replicas, and holds a `?` because a human-facing queue (approvals, escalations) is
 * non-empty.
 *
 * Reads come from two places, both read-only:
 *   - the Kubernetes API (pods, deployments, cronjobs, namespaces, metrics.k8s.io)
 *     In-cluster: the pod's service-account token. On a workstation: `kubectl get --raw`.
 *   - the agents dashboard's same-origin proxies (`/api/biff`, `/api/cluster`, ...) plus
 *     the watchdog's `/api/state`. Public over Cloudflare on a workstation, the ClusterIP
 *     service in-cluster. Every fetch fails silently; a missing signal is "no signal", never
 *     a guess.
 */
import fsp from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const AGENTS_BASE = process.env.AGENTS_BASE || 'https://agents.kcproto.com'
const WATCHDOG_BASE = process.env.WATCHDOG_BASE || 'https://watchdog.kcproto.com'
const SA_DIR = '/var/run/secrets/kubernetes.io/serviceaccount'
const KUBE_API = process.env.KUBERNETES_SERVICE_HOST
  ? `https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT || 443}`
  : ''

/** How long one cluster snapshot is reused before the API is asked again. */
const SNAPSHOT_TTL_MS = 15 * 1000
/** A pod above this is "doing something" — idle Node apps sit at 5–30m, databases at 20–60m. */
const RUNNING_CPU_MILLI = Number(process.env.COLONY_RUNNING_CPU_M) || 150
/** A watchdog escalation newer than this still wants a human. */
const ESCALATION_WINDOW_MS = 30 * 60 * 1000
/** How long a probe of an agent's own dashboard is trusted. */
const PROBE_TTL_MS = 30 * 1000

/**
 * The roster. `zone` is what claims a hex (one per client); `ns` are the namespaces whose
 * pods, deployments and cronjobs belong to the agent; `url` is where "Open" goes.
 * `probe` is an HTTP endpoint that must answer for the agent to be considered up.
 *
 * Mapping is by namespace on purpose — it is the one thing Flux keeps honest.
 */
export const ROSTER = [
  { id: 'mem',     name: 'Mem',     emoji: '🧠', role: 'second brain',         zone: 'Brain',           landmark: 'dish',          ns: ['graph-explorer', 'qdrant', 'neo4j', 'rag-parser'],           url: 'https://brain.kcproto.com' },
  { id: 'vera',    name: 'Vera',    emoji: '🎙️', role: 'voice AI',             zone: 'KC Proto',          ns: ['jarvis-hud', 'jarvis-watch'],                                url: 'https://hud.kcproto.com' },
  { id: 'janine',  name: 'Janine',  emoji: '💁‍♀️', role: 'email receptionist',   zone: 'KC Proto',          ns: ['janine', 'janine2'],                                         url: 'https://janine.kcproto.com' },
  { id: 'cole',    name: 'COLE',    emoji: '🛡️', role: 'incident response',    zone: 'Watchdog',        landmark: 'tower',          ns: ['watchdog', 'anthropic-watch'],                 url: 'https://watchdog.kcproto.com' },
  { id: 'jim',     name: 'Jim',     emoji: '📋', role: 'helpdesk',             zone: 'KC Proto',          ns: ['ticket-bot', 'kuma-ticket-bridge', 'embassy-tickets'],       url: 'https://ticket_bot.kcproto.com' },
  { id: 'phyllis', name: 'Phyllis', emoji: '🧐', role: 'QA inspector',         zone: 'Backups',           ns: ['backup-monitor', 'backups', 'kev-fleet-check'],              url: '', landmark: 'silo' },
  { id: 'sync',    name: 'Sync',    emoji: '🔁', role: 'file sync',            zone: 'Backups',           ns: ['syncthing'],                                                 url: 'https://syncthing.kcproto.com' },
  { id: 'velero',  name: 'Velero',  emoji: '🧳', role: 'cluster backups',      zone: 'Backups',           ns: ['velero'],                                                    url: '' },
  { id: 'frank',   name: 'Frank',   emoji: '🧑‍🎨', role: 'designer',             zone: 'KC Proto',          ns: ['kcaistudio'],                                                url: '' },
  { id: 'adam',    name: 'Adam',    emoji: '🛠️', role: 'print farm operator',  zone: 'Print Service',   landmark: 'workshop',          ns: ['print-farm', 'print-service', 'octofarm'],                   url: 'https://print.kcproto.com' },
  { id: 'clawd',   name: 'Clawd',   emoji: '🦞', role: 'chaos gremlin',        zone: 'KC Proto',        landmark: 'silo',          ns: ['clawd-dashboard'],                                           url: 'https://agents.kcproto.com/clawd-chat.html', probe: process.env.CLAWD_PROBE || '' },
  { id: 'frances', name: 'Frances', emoji: '🩺', role: 'caregiver AI',         zone: 'Frances',           ns: ['caregiver'],                                                 url: 'https://caregiver.kcproto.com' },
  { id: 'grader',  name: 'Grader',  emoji: '🧮', role: 'compliance grader',    zone: 'CyberGrade',        ns: ['cybergrade', 'cybergrade-api'],                              url: '' },
  { id: 'franky',  name: 'Franky',  emoji: '🚀', role: 'xprize',               zone: 'Franky',            ns: ['franky'],                                                    url: '' },
  { id: 'plex',    name: 'Plex',    emoji: '📺', role: 'media server',         zone: 'Plex',            landmark: 'pad',              ns: ['plex'],                                                      url: 'https://app.plex.tv/desktop' },
  { id: 'core',    name: 'Core',    emoji: '🛰️', role: 'control plane',        zone: 'Cluster',           ns: ['kube-system'],                                               url: 'https://grafana.kcproto.com', landmark: 'solar' },
  { id: 'house',   name: 'House',   emoji: '🏠', role: 'home assistant',       zone: 'Home',              ns: ['home-assistant'],                                            url: 'https://ha.kcproto.com', landmark: 'habitat' },
  { id: 'biff',    name: 'Biff',    emoji: '🧑‍💼', role: 'club operations',      zone: 'KC AI Club',      landmark: 'lab',        ns: ['aiclub'],                                                    url: 'https://ai-club.kcproto.com/#/biff' },
  { id: 'marc',    name: 'Marc',    emoji: '🌿', role: 'landscape ops',        zone: 'Embassy Landscape', ns: ['marc', 'aspire-portal', 'irrigation-mapper', 'inspire-fallback'], url: 'https://inspire.kcproto.com' },
  { id: 'rusty',   name: 'Rusty',   emoji: '⛽', role: 'oil wells',            zone: 'CorrosionDC',       ns: ['corrosiondc'],                                               url: 'https://wellz.kcproto.com' },
  { id: 'olga',    name: 'Olga',    emoji: '🧑‍🏫', role: 'recruit intel',        zone: 'NGV Talent',        ns: ['recruit-intel', 'recruiter-bot', 'recruit-form', 'ngv-sales'], url: 'https://recruiter-bot.kcproto.com' },
  { id: 'dwight',  name: 'Dwight',  emoji: '🚜', role: 'inventory',            zone: 'NED Builds',        ns: ['nedbuilds-pro', 'small-business', 'ned-estimates'],          url: 'https://small-biz.kcproto.com' },
  { id: 'leo',     name: 'Leo',     emoji: '📣', role: 'listing announcer',    zone: 'NED Builds',        ns: ['ned-ar-bot'],                                                url: '' },
  { id: 'snoop',   name: 'Snoop',   emoji: '📈', role: 'trader',               zone: 'Trade Floor',     landmark: 'reactor',      ns: [],  url: 'https://trade-bot.kcproto.com', probe: 'https://trade-bot.kcproto.com/api/health' },
  { id: 'gordon',  name: 'Gordon',  emoji: '👨‍🍳', role: 'schema roast',         zone: 'Roast Bot',      ns: ['roast-bot'],                                                 url: 'https://schemacheckerai.com' },
]

const BAD_WAITING = new Set(['CrashLoopBackOff', 'ImagePullBackOff', 'ErrImagePull', 'CreateContainerConfigError', 'InvalidImageName'])

// ------------------------------------------------------------------------------------------
// Kubernetes access — service account in-cluster, kubectl on a workstation.
// ------------------------------------------------------------------------------------------

let saToken = null
async function serviceAccountToken() {
  if (saToken !== null) return saToken
  try {
    saToken = (await fsp.readFile(`${SA_DIR}/token`, 'utf8')).trim()
  } catch {
    saToken = ''
  }
  return saToken
}

/** GET a raw API path and parse the JSON. Throws on failure; callers decide what that costs. */
async function kubeGet(apiPath) {
  const token = await serviceAccountToken()
  if (token && KUBE_API) {
    const res = await fetch(KUBE_API + apiPath, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(KUBE_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`${apiPath} → ${res.status}`)
    return res.json()
  }
  const { stdout } = await execFileAsync('kubectl', ['get', '--raw', apiPath], { maxBuffer: 64 * 1024 * 1024 })
  return JSON.parse(stdout)
}

/**
 * One snapshot of everything the roster needs, shared across agents.
 *
 * The API server can be slow from some nodes (measured: 5s for a one-item list, 24s for
 * the full pod list), so two rules: only the roster's namespaces are listed, in parallel,
 * and a scan never waits on a refresh that is already running — it takes the last good
 * snapshot and the refresh lands for the next poll. Only the very first scan waits.
 */
const ROSTER_NAMESPACES = [...new Set(ROSTER.flatMap((a) => a.ns))]
const KUBE_TIMEOUT_MS = 90 * 1000
let snapshot = { at: 0, data: null, inflight: null }
let nsCreatedCache = { at: 0, map: new Map() }

async function listPerNamespace(pathFor) {
  const lists = await Promise.all(
    ROSTER_NAMESPACES.map((ns) => kubeGet(pathFor(ns)).then((r) => r.items || []).catch(() => []))
  )
  return byNamespace(lists.flat())
}

async function buildSnapshot() {
  const [pods, deploys, cronjobs, metrics, nodes, nodeMetrics] = await Promise.all([
    listPerNamespace((ns) => `/api/v1/namespaces/${ns}/pods`),
    listPerNamespace((ns) => `/apis/apps/v1/namespaces/${ns}/deployments`),
    listPerNamespace((ns) => `/apis/batch/v1/namespaces/${ns}/cronjobs`),
    kubeGet('/apis/metrics.k8s.io/v1beta1/pods').catch(() => ({ items: [] })),
    kubeGet('/api/v1/nodes').catch(() => ({ items: [] })),
    kubeGet('/apis/metrics.k8s.io/v1beta1/nodes').catch(() => ({ items: [] })),
  ])
  const nodePods = await podsPerNode((nodes.items || []).map((n) => n.metadata.name))
  // Namespace creation times never change; refresh them rarely.
  if (Date.now() - nsCreatedCache.at > 10 * 60 * 1000) {
    try {
      const namespaces = await kubeGet('/api/v1/namespaces')
      const map = new Map()
      for (const n of namespaces.items || []) map.set(n.metadata.name, Date.parse(n.metadata.creationTimestamp) || 0)
      nsCreatedCache = { at: Date.now(), map }
    } catch {
      /* keep what we had */
    }
  }
  const cpuByPod = new Map()
  for (const m of metrics.items || []) {
    let milli = 0
    for (const c of m.containers || []) milli += parseCpu(c.usage?.cpu)
    cpuByPod.set(`${m.metadata.namespace}/${m.metadata.name}`, milli)
  }
  const nodeUsage = new Map()
  for (const m of nodeMetrics.items || []) nodeUsage.set(m.metadata.name, { cpu: parseCpu(m.usage?.cpu), mem: parseMem(m.usage?.memory) })
  return { pods, deploys, cronjobs, cpuByPod, nsCreated: nsCreatedCache.map, nodes: nodes.items || [], nodeUsage, nodePods }
}

async function clusterSnapshot() {
  const age = Date.now() - snapshot.at
  if (snapshot.data && age < SNAPSHOT_TTL_MS) return snapshot.data
  if (!snapshot.inflight) {
    snapshot.inflight = buildSnapshot()
      .then((data) => {
        snapshot = { at: Date.now(), data, inflight: null }
        return data
      })
      .catch((err) => {
        snapshot.inflight = null
        if (snapshot.data) return snapshot.data
        throw err
      })
  }
  return snapshot.data || snapshot.inflight
}

function byNamespace(items) {
  const out = new Map()
  for (const it of items || []) {
    const ns = it.metadata?.namespace || ''
    if (!out.has(ns)) out.set(ns, [])
    out.get(ns).push(it)
  }
  return out
}

/** `16Gi` / `16384Ki` / `123456` → bytes. */
function parseMem(q) {
  if (!q) return 0
  const m = String(q).match(/^([\d.]+)([KMGTPE]i?)?$/)
  if (!m) return 0
  const n = Number(m[1])
  const unit = m[2] || ''
  const pow = { K: 1e3, M: 1e6, G: 1e9, T: 1e12, Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4 }[unit] || 1
  return n * pow
}

/**
 * How many pods each node carries, without downloading them: a list capped at one item
 * reports `remainingItemCount`, so nineteen tiny requests replace one eight-megabyte one.
 */
const EMPTY_STATS = () => ({ total: 0, running: 0, starting: 0, bad: 0, badNames: [] })
let nodePodsCache = { at: 0, map: new Map() }
async function podsPerNode(names) {
  if (Date.now() - nodePodsCache.at < 60 * 1000) return nodePodsCache.map
  const map = new Map()
  const token = await serviceAccountToken()
  if (token && KUBE_API) {
    // Table format with no objects: one row per pod, a few bytes each.
    await Promise.all(
      names.map(async (name) => {
        try {
          const res = await fetch(`${KUBE_API}/api/v1/pods?fieldSelector=spec.nodeName%3D${encodeURIComponent(name)}&includeObject=None`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json;as=Table;v=v1;g=meta.k8s.io' },
            signal: AbortSignal.timeout(KUBE_TIMEOUT_MS),
          })
          const table = res.ok ? await res.json() : null
          if (!table) throw new Error('no table')
          // Table columns: Name | Ready | Status | Restarts | Age | IP | Node ...
          const stats = EMPTY_STATS()
          for (const row of table.rows || []) {
            const [podName, , status] = row.cells || []
            const st = String(status || '')
            if (/^(Completed|Succeeded)$/.test(st)) continue
            stats.total++
            if (st === 'Running') stats.running++
            else if (/ContainerCreating|Pending|PodInitializing|^Init:|Terminating/.test(st)) stats.starting++
            else if (/CrashLoopBackOff|Error|ImagePullBackOff|ErrImagePull|OOMKilled|CreateContainerConfigError|Evicted|Unknown/.test(st)) {
              stats.bad++
              if (stats.badNames.length < 6) stats.badNames.push(`${podName} (${st})`)
            }
          }
          map.set(name, stats)
        } catch {
          map.set(name, nodePodsCache.map.get(name) || EMPTY_STATS())
        }
      })
    )
  } else {
    try {
      const { stdout } = await execFileAsync('kubectl', ['get', 'pods', '-A', '--no-headers', '-o', 'custom-columns=NODE:.spec.nodeName,PHASE:.status.phase,WAIT:.status.containerStatuses[*].state.waiting.reason'], { maxBuffer: 16 * 1024 * 1024 })
      for (const line of stdout.split(String.fromCharCode(10))) {
        const [node, phase, wait] = line.trim().split(/\s+/)
        if (!node || node === '<none>' || phase === 'Succeeded') continue
        const stats = map.get(node) || EMPTY_STATS()
        stats.total++
        if (/CrashLoopBackOff|ImagePullBackOff|ErrImagePull|CreateContainerConfigError/.test(wait || '') || phase === 'Failed') stats.bad++
        else if (phase === 'Running') stats.running++
        else stats.starting++
        map.set(node, stats)
      }
    } catch {
      /* keep the last counts */
    }
  }
  nodePodsCache = { at: Date.now(), map }
  return map
}

/** `250m` → 250, `1` → 1000, `123456n` → 0.12 (nanocores). */
function parseCpu(q) {
  if (!q) return 0
  const s = String(q)
  if (s.endsWith('n')) return Number(s.slice(0, -1)) / 1e6
  if (s.endsWith('u')) return Number(s.slice(0, -1)) / 1e3
  if (s.endsWith('m')) return Number(s.slice(0, -1))
  return Number(s) * 1000
}

// ------------------------------------------------------------------------------------------
// Application signals — the queues and health feeds that already exist on the cluster.
// ------------------------------------------------------------------------------------------

async function fetchJson(url, ms = 8000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/** HEAD-ish liveness of an agent's own front door. Any answer below 500 counts as up. */
const probeCache = new Map()
async function probe(url) {
  const cached = probeCache.get(url)
  if (cached && Date.now() - cached.at < PROBE_TTL_MS) return cached.up
  let up = false
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(6000) })
    up = res.status < 500
  } catch {
    up = false
  }
  probeCache.set(url, { at: Date.now(), up })
  return up
}

/**
 * Everything app-level, fetched once per scan. Each entry is `{ running, unread, error,
 * message, activityAt, work }` for one agent id, and any of them may be missing.
 */
async function appSignals() {
  const out = {}
  const [biff, cluster, watchdog, shorts, feeds, trader, syncthing, velero, pot] = await Promise.all([
    fetchJson(`${AGENTS_BASE}/api/biff`),
    fetchJson(`${AGENTS_BASE}/api/cluster`),
    fetchJson(`${WATCHDOG_BASE}/api/state`),
    fetchJson(`${AGENTS_BASE}/api/shorts-state`),
    fetchJson(`${AGENTS_BASE}/api/brain-feeds`, 20000),
    fetchJson(`${process.env.TRADE_BOT_URL || 'https://trade-bot.kcproto.com'}/api/status`),
    fetchJson(process.env.SYNCTHING_STATUS_URL || 'http://syncthing-dashboard.syncthing.svc.cluster.local:3200/api/status'),
    kubeGet('/apis/velero.io/v1/namespaces/velero/backups').catch(() => null),
    fetchJson(`${process.env.TRADE_BOT_URL || 'https://trade-bot.kcproto.com'}/api/aggregate`),
  ])

  if (syncthing && Array.isArray(syncthing.instances)) {
    const inst = syncthing.instances
    const offline = inst.filter((i) => !i.online || i.error)
    const folders = inst.flatMap((i) => (i.folders || []).map((f) => ({ ...f, on: i.name })))
    const busy = folders.filter((f) => /sync|scan/i.test(String(f.state || '')))
    const broken = folders.filter((f) => /error|outofsync/i.test(String(f.state || '')))
    const behind = folders.filter((f) => Number(f.syncPercentage) < 99)
    const pct = folders.length ? Math.min(...folders.map((f) => Number(f.syncPercentage) || 0)) : 100
    const latest = folders.reduce((m, f) => Math.max(m, Date.parse(f.stateChanged || '') || 0), 0)
    out.sync = {
      running: busy.length > 0,
      error: offline.length > 0 || broken.length > 0,
      message: offline.length
        ? `${offline.map((i) => i.name).join(', ')} offline`
        : broken.length
          ? `${broken.map((f) => `${f.label} on ${f.on}`).join(', ')} in error`
          : `${inst.length} nodes online · ${folders[0]?.label || 'mirror'} ${pct.toFixed(1)}% in sync${busy.length ? ` · ${busy.map((f) => `${f.on} ${f.state}`).join(', ')}` : ''}${behind.length ? ` · ${behind.map((f) => f.on).join(', ')} behind` : ''}`,
      activityAt: latest,
      work: Math.round((folders[0]?.globalFiles || 0) / 1000),
    }
  }

  if (velero && Array.isArray(velero.items)) {
    const backups = velero.items
      .map((b) => ({
        name: b.metadata?.name || '',
        phase: b.status?.phase || 'Unknown',
        start: Date.parse(b.status?.startTimestamp || b.metadata?.creationTimestamp || '') || 0,
        end: Date.parse(b.status?.completionTimestamp || '') || 0,
        items: Number(b.status?.progress?.itemsBackedUp) || 0,
        errors: Number(b.status?.errors) || 0,
        schedule: b.metadata?.labels?.['velero.io/schedule-name'] || '',
      }))
      .sort((a, b) => b.start - a.start)
    const last = backups[0]
    const inProgress = backups.filter((b) => b.phase === 'InProgress')
    const now = Date.now()
    const lastNightly = backups.find((b) => /nightly/.test(b.schedule || b.name))
    const stale = lastNightly ? now - lastNightly.start > 27 * 60 * 60 * 1000 : true
    const failed = last && /Failed/.test(last.phase)
    const ago = (t) => (t ? `${Math.round((now - t) / 3600000)}h ago` : 'never')
    out.velero = {
      running: inProgress.length > 0,
      error: Boolean(failed || stale),
      message: inProgress.length
        ? `backing up now: ${inProgress[0].name}`
        : failed
          ? `last backup ${last.phase}: ${last.name} (${last.errors} errors)`
          : stale
            ? `no nightly backup in ${lastNightly ? ago(lastNightly.start) : 'sight'}`
            : `nightly ${lastNightly.phase} ${ago(lastNightly.start)} · ${lastNightly.items.toLocaleString('en-US')} items · ${backups.length} backups kept`,
      activityAt: last?.end || last?.start || 0,
      work: last?.items || 0,
    }
  }

  // Snoop's bot runs on the Hetzner node, so its own status endpoint is the signal.
  if (trader && trader.account) {
    const cycleAt = Date.parse(trader.lastCycleTime || '') || 0
    const equity = Number(trader.account.equity) || 0
    const last = Number(trader.account.last_equity) || equity
    const day = equity - last
    const paper = /^PA/i.test(String(trader.account.account_number || ''))
    // The real money is the live pot behind the replicator, not the strategist's paper cash.
    const live = Number(pot?.totalAUM) || 0
    const liveProfit = Number(pot?.totalProfit) || 0
    const livePct = Number(pot?.totalReturn) || 0
    const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`
    out.snoop = {
      roof: live ? `${money(live)} live` : `${money(Number(trader.account.cash) || 0)} paper`,
      running: Boolean(cycleAt) && Date.now() - cycleAt < 20 * 60 * 1000,
      error: Boolean(trader.lastError),
      message: trader.lastError
        ? `bot error: ${String(trader.lastError).slice(0, 120)}`
        : `${live ? `LIVE pot $${live.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${liveProfit >= 0 ? '+' : '-'}$${Math.abs(liveProfit).toFixed(0)}, ${livePct >= 0 ? '+' : ''}${livePct.toFixed(1)}%) · ` : ''}strategist ${paper ? 'paper' : 'live'} equity ${money(equity)} today ${day >= 0 ? '+' : '-'}$${Math.abs(Math.round(day)).toLocaleString('en-US')} · ${(trader.positions || []).length} positions · ${Number(trader.dailyTradeCount) || 0} trades today`,
      activityAt: cycleAt,
      work: Number(trader.tradeCount) || 0,
    }
  }

  if (biff) {
    const approvals = Number(biff.approvals) || 0
    out.biff = {
      unread: approvals > 0,
      message: `${approvals} awaiting approval · ${Number(biff.actionItems) || 0} open items · ${Number(biff.unread) || 0} unread`,
      activityAt: Date.parse(biff.ts) || 0,
      work: (Number(biff.actionItems) || 0) + (Number(biff.unread) || 0),
    }
  }

  if (watchdog) {
    const services = Object.entries(watchdog.serviceState || {})
    const unhealthy = services.filter(([, s]) => s && s.status && s.status !== 'healthy')
    const now = Date.now()
    const recentEscalations = (watchdog.events || []).filter((e) => {
      const t = Number(e?.ts ?? e?.at ?? e?.time) || Date.parse(e?.timestamp || e?.ts || '') || 0
      const kind = String(e?.type || e?.level || e?.kind || '').toLowerCase()
      return t && now - t < ESCALATION_WINDOW_MS && kind.includes('escalat')
    })
    const failingPods = Number(cluster?.podsFail) || 0
    // Every unhealthy service stands on the Watchdog hex, slumped, until it recovers.
    out._watchdogServices = unhealthy.map(([name, s]) => ({
      name,
      failures: Number(s.consecutiveFailures) || 0,
      error: String(s.lastError || '').slice(0, 160),
      since: Number(s.lastAlerted) || now,
    }))
    out.cole = {
      running: unhealthy.length > 0 || failingPods > 0,
      unread: recentEscalations.length > 0,
      message:
        unhealthy.length || failingPods
          ? `remediating: ${unhealthy.map(([n]) => n).slice(0, 3).join(', ')}${failingPods ? ` · ${failingPods} pods failing` : ''}`
          : `${services.length} services healthy · ${Number(watchdog.stats?.scansCompleted) || 0} scans`,
      activityAt: unhealthy.length || failingPods ? now : 0,
      work: Number(watchdog.stats?.remediationsSucceeded) || 0,
    }
  }

  if (shorts && typeof shorts === 'object') {
    const entries = Object.values(shorts)
    const posted = entries.filter((v) => v && v.postedAt).length
    const latest = entries.reduce((m, v) => Math.max(m, Date.parse(v?.postedAt || v?.approvedAt || '') || 0), 0)
    out.marty = { message: `${posted}/${entries.length} shorts posted`, activityAt: latest, work: posted }
  }

  if (feeds && feeds.planets) {
    let total = 0
    let healthy = 0
    for (const p of Object.values(feeds.planets)) {
      const list = p?.feeds || []
      total += Number(p?.feedCount) || list.length
      healthy += Number(p?.healthyCount) || list.filter((f) => f && f.status === 'healthy').length
    }
    const down = total - healthy
    out.mem = { error: down > Math.max(3, total * 0.25), message: down ? `${healthy}/${total} feeds · ${down} down` : `${total} feeds healthy`, work: total }
  }

  return out
}

// ------------------------------------------------------------------------------------------
// Per-agent derivation. Pure: (roster entry, snapshot, signals) → Thread.
// ------------------------------------------------------------------------------------------

/** Remember when an agent was last seen doing something, so "asleep" means quiet, not unobserved. */
const lastSeenActive = new Map()

function podProblems(pod) {
  const out = []
  const phase = pod.status?.phase
  if (phase === 'Failed') out.push(`${pod.metadata.name}: Failed`)
  for (const cs of pod.status?.containerStatuses || []) {
    const waiting = cs.state?.waiting?.reason
    if (waiting && BAD_WAITING.has(waiting)) out.push(`${pod.metadata.name}: ${waiting}`)
    const term = cs.lastState?.terminated
    if (term?.reason === 'OOMKilled' && Date.now() - (Date.parse(term.finishedAt) || 0) < 30 * 60 * 1000) {
      out.push(`${pod.metadata.name}: OOMKilled`)
    }
  }
  return out
}

function isJobPod(pod) {
  return (pod.metadata?.ownerReferences || []).some((o) => o.kind === 'Job')
}

function deriveAgent(agent, snap, signals, probeUp) {
  const pods = agent.ns.flatMap((ns) => snap.pods.get(ns) || [])
  const deploys = agent.ns.flatMap((ns) => snap.deploys.get(ns) || [])
  const cronjobs = agent.ns.flatMap((ns) => snap.cronjobs.get(ns) || [])
  const sig = signals[agent.id] || {}
  const now = Date.now()

  const problems = pods.flatMap(podProblems)
  for (const d of deploys) {
    const want = d.spec?.replicas ?? 1
    const ready = d.status?.readyReplicas || 0
    if (want > 0 && ready < want) problems.push(`${d.metadata.name}: ${ready}/${want} ready`)
  }
  if (probeUp === false) problems.push('dashboard not answering')
  if (sig.error) problems.push(sig.message)

  let cpu = 0
  let busiest = ''
  for (const p of pods) {
    if (p.status?.phase !== 'Running') continue
    const m = snap.cpuByPod.get(`${p.metadata.namespace}/${p.metadata.name}`) || 0
    cpu += m
    if (m >= RUNNING_CPU_MILLI && m > (snap.cpuByPod.get(busiest) || 0)) busiest = `${p.metadata.namespace}/${p.metadata.name}`
  }
  const activeJobs = pods.filter((p) => isJobPod(p) && p.status?.phase === 'Running')
  const running = Boolean(sig.running) || activeJobs.length > 0 || Boolean(busiest)

  let activityAt = sig.activityAt || 0
  for (const p of pods) activityAt = Math.max(activityAt, Date.parse(p.status?.startTime || '') || 0)
  for (const c of cronjobs) activityAt = Math.max(activityAt, Date.parse(c.status?.lastScheduleTime || '') || 0)
  if (running) lastSeenActive.set(agent.id, now)
  activityAt = Math.max(activityAt, lastSeenActive.get(agent.id) || 0)

  let createdAt = 0
  for (const ns of agent.ns) {
    const t = snap.nsCreated.get(ns) || 0
    if (t && (!createdAt || t < createdAt)) createdAt = t
  }

  // "How much has this agent done" — cronjob runs are the honest unit we have for every
  // agent, plus whatever its own app reports. Scaled into the byte range the card expects.
  const ageDays = createdAt ? (now - createdAt) / 86400000 : 0
  const suspended = cronjobs.filter((c) => c.spec?.suspend).length
  const work = ageDays * 3 + (sig.work || 0) * 20 + cronjobs.length * 50
  const sizeBytes = Math.round(1000 * (1 + work))

  const detail = [
    `${pods.filter((p) => p.status?.phase === 'Running').length} pods`,
    cronjobs.length ? `${cronjobs.length} cronjobs${suspended ? ` (${suspended} suspended)` : ''}` : '',
    cpu ? `${Math.round(cpu)}m CPU` : '',
    activeJobs.length ? `${activeJobs.length} job${activeJobs.length > 1 ? 's' : ''} running` : '',
  ].filter(Boolean)

  const preview = problems.length ? problems.slice(0, 3).join(' · ') : sig.message || detail.join(' · ')

  return {
    id: `jarvis:${agent.id}`,
    title: `${agent.emoji} ${agent.name}`,
    preview,
    project: agent.zone,
    projectPath: `cluster://${agent.zone.toLowerCase().replace(/\s+/g, '-')}`,
    worktree: '',
    cwd: agent.ns.join(', '),
    gitBranch: agent.role,
    model: detail.join(' · '),
    effort: '',
    createdAt,
    lastActivityAt: activityAt,
    lastFocusedAt: 0,
    running,
    unread: Boolean(sig.unread),
    hasError: problems.length > 0,
    starred: false,
    routine: '',
    prState: '',
    archived: false,
    hasTranscript: true,
    sizeBytes,
    source: 'k3s',
    landmark: agent.landmark || '',
    roof: sig.roof || '',
    canOpen: Boolean(agent.url),
    canArchive: false,
    ref: { agent: agent.id, url: agent.url },
  }
}

/**
 * App signals are slow (the brain feed roll-up alone can take seconds), and the page polls
 * every 15s. So they refresh in the background and a scan takes whatever is current:
 * stale-while-revalidate; even the first scan does not wait for them.
 */
const SIGNALS_TTL_MS = 20 * 1000
let signalsCache = { at: 0, data: null, inflight: null }
async function currentSignals() {
  const age = Date.now() - signalsCache.at
  if (signalsCache.data && age < SIGNALS_TTL_MS) return signalsCache.data
  if (!signalsCache.inflight) {
    signalsCache.inflight = appSignals()
      .then((data) => {
        signalsCache = { at: Date.now(), data, inflight: null }
        return data
      })
      .catch(() => {
        signalsCache.inflight = null
        return signalsCache.data || {}
      })
  }
  // No signals yet? Paint the crew now from cluster state alone; queues arrive next poll.
  return signalsCache.data || {}
}

async function scanThreads() {
  const [snap, signals] = await Promise.all([clusterSnapshot(), currentSignals()])
  const probes = await Promise.all(ROSTER.map((a) => (a.probe ? probe(a.probe) : Promise.resolve(null))))
  const agents = ROSTER.map((agent, i) => deriveAgent(agent, snap, signals, probes[i]))
  return agents.concat(watchdogThreads(signals._watchdogServices || []), brainFeedThreads(snap), nodeThreads(snap))
}

/**
 * Feeds arriving at the brain: every sync job in graph-explorer that is running right now
 * is an astronaut hammering on the Brain hex; one that finished in the last ten minutes
 * celebrates the ingest before walking home; one that failed slumps.
 */
const BRAIN_NS = 'graph-explorer'
const BRAIN_DONE_WINDOW_MS = 10 * 60 * 1000
function brainFeedThreads(snap) {
  const now = Date.now()
  const out = []
  for (const pod of snap.pods.get(BRAIN_NS) || []) {
    const owner = (pod.metadata?.ownerReferences || []).find((o) => o.kind === 'Job')
    if (!owner) continue
    const phase = pod.status?.phase
    const started = Date.parse(pod.status?.startTime || '') || now
    const finished = (pod.status?.containerStatuses || []).reduce(
      (m, cs) => Math.max(m, Date.parse(cs.state?.terminated?.finishedAt || '') || 0),
      0
    )
    if (phase === 'Succeeded' && now - finished > BRAIN_DONE_WINDOW_MS) continue
    if (phase !== 'Running' && phase !== 'Succeeded' && phase !== 'Failed') continue
    // Job names carry a schedule stamp: `feed-sync-29312345` -> `feed-sync`.
    const feed = String(owner.name).replace(/-\d{5,}$/, '').replace(/-[a-z0-9]{5}$/, '')
    const mins = Math.max(1, Math.round((now - started) / 60000))
    out.push({
      id: `brain:${owner.name}`,
      title: `📡 ${feed}`,
      preview:
        phase === 'Running'
          ? `feed syncing · ${mins} min in`
          : phase === 'Succeeded'
            ? `ingested ${Math.max(1, Math.round((now - finished) / 60000))} min ago`
            : 'sync failed',
      project: 'Brain',
      projectPath: 'cluster://brain',
      worktree: '',
      cwd: BRAIN_NS,
      gitBranch: feed,
      model: phase.toLowerCase(),
      effort: '',
      createdAt: started,
      lastActivityAt: finished || started,
      lastFocusedAt: 0,
      running: phase === 'Running',
      unread: false,
      hasError: phase === 'Failed',
      starred: false,
      routine: feed,
      prState: phase === 'Succeeded' ? 'MERGED' : '',
      archived: false,
      hasTranscript: true,
      sizeBytes: 1000 * (1 + mins * 20),
      source: 'brain-jobs',
      canOpen: true,
      canArchive: false,
      ref: { agent: 'mem', url: 'https://brain.kcproto.com' },
    })
  }
  return out
}

/**
 * The fleet itself: one astronaut per node on the Cluster hex. Hot CPU or memory hammers,
 * NotReady, cordoned or under pressure slumps, and the card reads like a status page.
 */
function nodeThreads(snap) {
  const now = Date.now()
  return (snap.nodes || []).map((n) => {
    const name = n.metadata.name
    const cond = (type) => (n.status?.conditions || []).find((c) => c.type === type)
    const ready = cond('Ready')?.status === 'True'
    const pressure = ['MemoryPressure', 'DiskPressure', 'PIDPressure'].filter((t) => cond(t)?.status === 'True')
    const cordoned = Boolean(n.spec?.unschedulable)
    const use = snap.nodeUsage?.get(name)
    const capCpu = parseCpu(n.status?.allocatable?.cpu)
    const capMem = parseMem(n.status?.allocatable?.memory)
    const cpuPct = use && capCpu ? Math.round((100 * use.cpu) / capCpu) : null
    const memPct = use && capMem ? Math.round((100 * use.mem) / capMem) : null
    const st = snap.nodePods?.get(name) || EMPTY_STATS()
    const pods = st.total
    const role = Object.keys(n.metadata.labels || {}).some((k) => k.includes('control-plane') || k.includes('master')) ? 'control plane' : 'worker'
    const problems = [!ready ? 'NotReady' : '', cordoned ? 'cordoned' : '', ...pressure].filter(Boolean)
    if (st.bad) problems.push(`${st.bad} pod${st.bad > 1 ? 's' : ''} down: ${st.badNames.join(', ')}`)
    const hot = (cpuPct ?? 0) >= 70 || (memPct ?? 0) >= 85
    const pushing = st.starting > 0
    const readyAt = Date.parse(cond('Ready')?.lastTransitionTime || '') || 0
    return {
      id: `node:${name}`,
      landmark: 'rack',
      count: st.bad || 0,
      roof: `${st.running} pods`,
      title: `🖥 ${name}`,
      preview: [problems.length ? problems.join(', ') : 'Ready', cpuPct != null ? `cpu ${cpuPct}%` : '', memPct != null ? `mem ${memPct}%` : '', `${st.running} running`, st.starting ? `${st.starting} starting` : '', n.status?.nodeInfo?.kubeletVersion || '']
        .filter(Boolean)
        .join(' · '),
      project: 'Cluster',
      projectPath: 'cluster://nodes',
      worktree: '',
      cwd: n.status?.addresses?.find((a) => a.type === 'InternalIP')?.address || '',
      gitBranch: role,
      model: cpuPct != null ? `${cpuPct}% cpu` : '',
      effort: '',
      createdAt: Date.parse(n.metadata.creationTimestamp) || now,
      lastActivityAt: hot || pushing ? now : readyAt || now,
      lastFocusedAt: 0,
      running: hot || pushing,
      unread: false,
      hasError: problems.length > 0,
      starred: role === 'control plane',
      routine: '',
      prState: '',
      archived: false,
      hasTranscript: true,
      sizeBytes: 1000 * (1 + pods * 25),
      source: 'nodes',
      canOpen: true,
      canArchive: false,
      ref: { agent: 'core', url: 'https://grafana.kcproto.com' },
    }
  })
}

/** One slumped astronaut per service the watchdog currently calls unhealthy. */
function watchdogThreads(services) {
  const now = Date.now()
  return services.map((svc) => ({
    id: `watchdog:${svc.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    title: `⚠ ${svc.name}`,
    preview: svc.error || `${svc.failures} consecutive failures`,
    project: 'Watchdog',
    projectPath: 'cluster://watchdog',
    worktree: '',
    cwd: 'watchdog',
    gitBranch: 'unhealthy',
    model: `${svc.failures} failures`,
    effort: '',
    createdAt: svc.since || now,
    lastActivityAt: now,
    lastFocusedAt: 0,
    running: false,
    unread: false,
    hasError: true,
    starred: false,
    routine: '',
    prState: '',
    archived: false,
    hasTranscript: true,
    sizeBytes: 1000 * (1 + svc.failures * 50),
    source: 'watchdog',
    canOpen: true,
    canArchive: false,
    ref: { agent: 'cole', url: 'https://watchdog.kcproto.com' },
  }))
}

let detectCache = { at: 0, ok: false }
async function detect() {
  if (Date.now() - detectCache.at < 60 * 1000) return detectCache.ok
  let ok = false
  try {
    await kubeGet('/api/v1/namespaces?limit=1')
    ok = true
  } catch {
    ok = false
  }
  detectCache = { at: Date.now(), ok }
  return ok
}

const HTTP_URL = /^https?:\/\/[^\s]+$/i

/** "Open" is the agent's own dashboard, in the browser. Nothing on the server launches. */
function openThread(ref) {
  const agent = ROSTER.find((a) => a.id === ref?.agent)
  const url = agent?.url || ''
  if (!HTTP_URL.test(url)) return { ok: false, error: 'That agent has no dashboard to open' }
  return { ok: true, url, browser: true }
}

const newSession = () => ({ ok: false, error: 'Agents are deployed by Flux, not started from here' })
const setArchived = async () => ({ ok: false, error: 'Retire an agent in Flux; the colony hides it on its own side' })

export default {
  id: 'jarvis-cluster',
  name: 'JARVIS Armada',
  detect,
  scanThreads,
  openThread,
  newSession,
  setArchived,
}
