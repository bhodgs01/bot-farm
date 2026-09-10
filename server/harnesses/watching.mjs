/**
 * Harness adapter: the watchtower — one sentry per thing Blake is keeping an eye on.
 *
 * Added by /keeping-an-eye-on-it. The point is the thing you fixed but do not yet trust:
 * a node that was power-cutting, a service that was flapping, a cron that kept failing.
 * Each sentry says how long the good run has lasted, or how recently it broke again.
 *
 * The list lives at WATCHING_FILE (the data volume, so items can be added without a
 * release), shape:
 *
 *   { "id": "hp3-power", "title": "hp3 power stability", "subject": "jarvishp3",
 *     "check": "node", "note": "why we are watching", "since": "<ISO>", "goal": "24h" }
 *
 * `check` decides how the live line is computed, and is the flexible part:
 *   node    — subject is a k8s node name; reports uptime since it last went Ready
 *   deploy  — subject is "namespace/name"; reports ready vs desired replicas
 *   http    — subject is a URL; reports the status code
 *   (none)  — reports simply how long it has been since `since`
 *
 * A check that cannot answer degrades to the plain elapsed line rather than vanishing:
 * a sentry going quiet must never look like an all-clear.
 */
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const here = path.dirname(fileURLToPath(import.meta.url))
const FILE = process.env.WATCHING_FILE || path.join(here, '..', 'watching.json')
const ZONE = 'Keeping an eye on'
const TTL_MS = 60 * 1000
const PROBE_TIMEOUT_MS = 8 * 1000
const BORN = Date.parse('2026-09-09T12:00:00Z')
const NL = String.fromCharCode(10)

const SA_DIR = '/var/run/secrets/kubernetes.io/serviceaccount'
const KUBE_API = process.env.KUBERNETES_SERVICE_HOST
  ? `https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT || 443}`
  : ''

/** Round to the biggest unit that still reads naturally. */
function human(ms) {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 90) return `${s} s`
  const m = Math.round(s / 60)
  if (m < 90) return `${m} m`
  const h = Math.round(m / 60)
  if (h < 48) return `${h} h`
  return `${Math.round(h / 24)} d`
}

/** GET a raw API path. In-cluster uses the service-account token, otherwise kubectl. */
async function kubeGet(apiPath) {
  let token = ''
  try {
    token = (await fsp.readFile(path.join(SA_DIR, 'token'), 'utf8')).trim()
  } catch {
    /* not in-cluster */
  }
  if (token && KUBE_API) {
    const res = await fetch(KUBE_API + apiPath, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`${apiPath} → ${res.status}`)
    return res.json()
  }
  const { stdout } = await execFileAsync('kubectl', ['get', '--raw', apiPath], { maxBuffer: 8 * 1024 * 1024 })
  return JSON.parse(stdout)
}

/**
 * Ask the world how the watched thing is doing right now.
 * Returns { line, ok, changedAt } — `line` is the sentence under the sentry's name.
 */
async function runCheck(item) {
  const since = Date.parse(item.since || '') || 0
  const plain = since ? `${human(Date.now() - since)} since we started watching` : 'watching'

  try {
    if (item.check === 'node' && item.subject) {
      const node = await kubeGet(`/api/v1/nodes/${encodeURIComponent(item.subject)}`)
      const ready = (node.status?.conditions || []).find((c) => c.type === 'Ready')
      const at = Date.parse(ready?.lastTransitionTime || '') || 0
      const span = at ? human(Date.now() - at) : '?'
      if (ready?.status === 'True') return { line: `up ${span} with no reboot`, ok: true, changedAt: at }
      return { line: `DOWN for ${span} (${ready?.reason || 'not ready'})`, ok: false, changedAt: at }
    }

    if (item.check === 'deploy' && item.subject?.includes('/')) {
      const [ns, name] = item.subject.split('/')
      const d = await kubeGet(`/apis/apps/v1/namespaces/${encodeURIComponent(ns)}/deployments/${encodeURIComponent(name)}`)
      const want = d.spec?.replicas ?? 0
      const got = d.status?.readyReplicas ?? 0
      const avail = (d.status?.conditions || []).find((c) => c.type === 'Available')
      const at = Date.parse(avail?.lastTransitionTime || '') || 0
      if (got >= want && want > 0) return { line: `${got}/${want} ready, steady ${human(Date.now() - at)}`, ok: true, changedAt: at }
      return { line: `only ${got}/${want} ready`, ok: false, changedAt: at }
    }

    if (item.check === 'http' && item.subject) {
      const t0 = Date.now()
      const res = await fetch(item.subject, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS), redirect: 'manual' })
      const ms = Date.now() - t0
      const ok = res.status < 400 || res.status === 401 || res.status === 302 || res.status === 307
      return { line: `HTTP ${res.status} in ${ms} ms`, ok, changedAt: 0 }
    }
  } catch (err) {
    // A failed probe is not an all-clear and not an alarm either — say so plainly.
    return { line: `${plain} · check unavailable (${err.message.slice(0, 40)})`, ok: null, changedAt: 0 }
  }

  return { line: plain, ok: null, changedAt: since }
}

async function fetchThreads() {
  let list = []
  try {
    list = JSON.parse(await fsp.readFile(FILE, 'utf8'))
  } catch {
    try {
      list = JSON.parse(await fsp.readFile(path.join(here, '..', 'watching.json'), 'utf8'))
    } catch {
      list = []
    }
  }
  if (!Array.isArray(list)) list = []
  const live = list.filter((w) => w && w.title && !w.done)
  const now = Date.now()

  const checked = await Promise.all(
    live.map(async (w) => ({ ...w, status: await runCheck(w) }))
  )

  const out = []

  // One sentry per watched thing.
  let first = true
  for (const w of checked) {
    const okMark = w.status.ok === false ? '⚠' : w.status.ok === true ? '👁' : '👁'
    out.push({
      id: `watching:${w.id || w.title}`,
      // The earliest sentry carries the landmark, so the zone gets exactly one
      // watchtower and the rest of the watch stands around it rather than each
      // spawning its own figure and building.
      ...(first ? { landmark: 'tower' } : {}),
      plate: w.status.ok === false ? 'trouble' : w.status.line.split(' ').slice(0, 2).join(' '),
      title: `${okMark} ${w.title}`,
      preview: [`Keeping an eye on ${w.subject || w.title} — ${w.status.line}`, w.note || ''].filter(Boolean).join(NL),
      details: {
        Watching: w.subject || w.title,
        Status: w.status.line,
        Why: w.note || '',
        Since: w.since ? new Date(w.since).toLocaleString('en-US', { timeZone: 'America/Chicago' }) : '',
        'All clear at': w.goal || '',
        Check: w.check || 'elapsed time only',
        'Stop watching': `/keeping-an-eye-on-it done ${w.id || ''}`.trim(),
      },
      project: ZONE,
      projectPath: 'watching://post',
      worktree: '',
      cwd: 'watching',
      gitBranch: w.check || 'watch',
      model: '',
      effort: '',
      createdAt: BORN + 1,
      lastActivityAt: now,
      lastFocusedAt: 0,
      running: false,
      // Only raise a hand when the watched thing is actually misbehaving. A calm sentry
      // reporting a long good run is the whole point and must not nag.
      unread: w.status.ok === false,
      hasError: w.status.ok === false,
      starred: false,
      routine: '',
      prState: '',
      archived: false,
      hasTranscript: false,
      sizeBytes: 1400,
      source: 'watching',
      canOpen: Boolean(w.url),
      canArchive: true,
      ref: { id: w.id || w.title, url: w.url || '' },
    })
    first = false
  }
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
        console.warn('watching:', err.message)
        return cache.data || []
      })
  }
  return cache.data || cache.inflight
}

export default {
  id: 'watching',
  name: 'Keeping an eye on',
  detect: async () => true,
  scanThreads,
  openThread: (ref) => (ref?.url ? { ok: true, browser: true, url: ref.url } : { ok: false, error: 'No link on this one' }),
  newSession: () => ({ ok: false, error: `Add one with /keeping-an-eye-on-it` }),
  // Archiving a sentry stops the watch, the same thing /keeping-an-eye-on-it done <id> does.
  setArchived: async (ref, archived) => {
    const id = ref?.id
    if (!id) return { ok: false, error: 'No id on this one' }
    try {
      let list = []
      try {
        list = JSON.parse(await fsp.readFile(FILE, 'utf8'))
      } catch {
        return { ok: false, error: 'Nothing is being watched yet' }
      }
      let hit = false
      const next = list.map((x) => {
        if ((x.id || x.title) !== id) return x
        hit = true
        return { ...x, done: archived !== false }
      })
      if (!hit) return { ok: false, error: `Not watching anything called ${id}` }
      await fsp.writeFile(`${FILE}.tmp`, JSON.stringify(next, null, 2))
      await fsp.rename(`${FILE}.tmp`, FILE)
      cache = { at: 0, data: null, inflight: null }
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  },
}
