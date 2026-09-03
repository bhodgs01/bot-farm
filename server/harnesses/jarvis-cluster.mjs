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
  { id: 'cole',    name: 'COLE',    emoji: '🛡️', role: 'incident response',    zone: 'Watchdog',          ns: ['watchdog', 'anthropic-watch'],                 url: 'https://watchdog.kcproto.com' },
  { id: 'jim',     name: 'Jim',     emoji: '📋', role: 'helpdesk',             zone: 'KC Proto',          ns: ['ticket-bot', 'kuma-ticket-bridge', 'embassy-tickets'],       url: 'https://ticket_bot.kcproto.com' },
  { id: 'phyllis', name: 'Phyllis', emoji: '🧐', role: 'QA inspector',         zone: 'KC Proto',          ns: ['backup-monitor', 'backups', 'kev-fleet-check'],              url: '' },
  { id: 'frank',   name: 'Frank',   emoji: '🧑‍🎨', role: 'designer',             zone: 'KC Proto',          ns: ['kcaistudio'],                                                url: '' },
  { id: 'adam',    name: 'Adam',    emoji: '🛠️', role: 'print farm operator',  zone: 'Print Service',          ns: ['print-farm', 'print-service', 'octofarm'],                   url: 'https://print.kcproto.com' },
  { id: 'clawd',   name: 'Clawd',   emoji: '🦞', role: 'chaos gremlin',        zone: 'KC Proto',          ns: ['clawd-dashboard'],                                           url: 'https://agents.kcproto.com/clawd-chat.html', probe: process.env.CLAWD_PROBE || '' },
  { id: 'frances', name: 'Frances', emoji: '🩺', role: 'caregiver AI',         zone: 'Frances',           ns: ['caregiver'],                                                 url: 'https://caregiver.kcproto.com' },
  { id: 'grader',  name: 'Grader',  emoji: '🧮', role: 'compliance grader',    zone: 'CyberGrade',        ns: ['cybergrade', 'cybergrade-api'],                              url: '' },
  { id: 'clayton', name: 'Clayton', emoji: '🎤', role: 'presentation host',    zone: 'Clayton',           ns: ['clayton'],                                                   url: '' },
  { id: 'atlas',   name: 'Atlas',   emoji: '⌚', role: 'wearable demo',        zone: 'Atlas',             ns: ['atlas-demo'],                                                url: '' },
  { id: 'franky',  name: 'Franky',  emoji: '🚀', role: 'xprize',               zone: 'Franky',            ns: ['franky'],                                                    url: '' },
  { id: 'plex',    name: 'Plex',    emoji: '📺', role: 'media server',         zone: 'Plex',              ns: ['plex'],                                                      url: 'https://app.plex.tv/desktop' },
  { id: 'biff',    name: 'Biff',    emoji: '🧑‍💼', role: 'club operations',      zone: 'KC AI Club',        ns: ['aiclub'],                                                    url: 'https://ai-club.kcproto.com/#/biff' },
  { id: 'marc',    name: 'Marc',    emoji: '🌿', role: 'landscape ops',        zone: 'Embassy Landscape', ns: ['marc', 'aspire-portal', 'irrigation-mapper', 'inspire-fallback'], url: 'https://inspire.kcproto.com' },
  { id: 'rusty',   name: 'Rusty',   emoji: '⛽', role: 'oil wells',            zone: 'CorrosionDC',       ns: ['corrosiondc'],                                               url: 'https://wellz.kcproto.com' },
  { id: 'olga',    name: 'Olga',    emoji: '🧑‍🏫', role: 'recruit intel',        zone: 'NGV Talent',        ns: ['recruit-intel', 'recruiter-bot', 'recruit-form', 'ngv-sales'], url: 'https://recruiter-bot.kcproto.com' },
  { id: 'dwight',  name: 'Dwight',  emoji: '🚜', role: 'inventory',            zone: 'NED Builds',        ns: ['nedbuilds-pro', 'small-business', 'ned-estimates'],          url: 'https://small-biz.kcproto.com' },
  { id: 'leo',     name: 'Leo',     emoji: '📣', role: 'listing announcer',    zone: 'NED Builds',        ns: ['ned-ar-bot'],                                                url: '' },
  { id: 'snoop',   name: 'Snoop',   emoji: '📈', role: 'trader',               zone: 'Trade Floor',      ns: ['trade-bot'],                                                 url: 'https://trade-bot.kcproto.com' },
  { id: 'marty',   name: 'Marty',   emoji: '🏃', role: 'shorts poster',        zone: 'Shorts',      ns: ['shorts-player'],                                             url: '' },
  { id: 'hank',    name: 'Hank',    emoji: '📒', role: 'bookkeeper',           zone: 'Books',      ns: ['books'],                                                     url: '' },
  { id: 'gordon',  name: 'Gordon',  emoji: '👨‍🍳', role: 'schema roast',         zone: 'Roast Bot',      ns: ['roast-bot'],                                                 url: 'https://schemacheckerai.com' },
  { id: 'vince',   name: 'Vince',   emoji: '🕵️', role: 'sales hunter',         zone: 'Prospector',      ns: ['spambot'],                                                   url: 'https://prospector.kcproto.com', probe: 'https://prospector.kcproto.com' },
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
  const [pods, deploys, cronjobs, metrics] = await Promise.all([
    listPerNamespace((ns) => `/api/v1/namespaces/${ns}/pods`),
    listPerNamespace((ns) => `/apis/apps/v1/namespaces/${ns}/deployments`),
    listPerNamespace((ns) => `/apis/batch/v1/namespaces/${ns}/cronjobs`),
    kubeGet('/apis/metrics.k8s.io/v1beta1/pods').catch(() => ({ items: [] })),
  ])
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
  return { pods, deploys, cronjobs, cpuByPod, nsCreated: nsCreatedCache.map }
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
  const [biff, cluster, watchdog, shorts, feeds] = await Promise.all([
    fetchJson(`${AGENTS_BASE}/api/biff`),
    fetchJson(`${AGENTS_BASE}/api/cluster`),
    fetchJson(`${WATCHDOG_BASE}/api/state`),
    fetchJson(`${AGENTS_BASE}/api/shorts-state`),
    fetchJson(`${AGENTS_BASE}/api/brain-feeds`, 20000),
  ])

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
  return agents.concat(watchdogThreads(signals._watchdogServices || []), brainFeedThreads(snap))
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
