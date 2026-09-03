/**
 * Harness adapter: Vikunja — every open task is an astronaut on its client's hex.
 *
 * A task with nothing special about it just stands there, so a client with three open
 * tickets shows three people beside its agent. One that is due within a day or marked
 * high priority holds a `?`; one that is overdue slumps with a `!`. Done tasks are gone.
 *
 * Read-only: GET /projects, then GET /projects/{id}/tasks per project.
 * Env: VIKUNJA_TOKEN, VIKUNJA_URL optional.
 */

const TOKEN = process.env.VIKUNJA_TOKEN || ''
const API = (process.env.VIKUNJA_URL || 'http://vikunja.vikunja.svc.cluster.local:3456').replace(/\/$/, '') + '/api/v1'
const OPEN_URL = (process.env.VIKUNJA_OPEN_URL || 'https://tasks.kcproto.com').replace(/\/$/, '')
const TTL_MS = 60 * 1000
const SOON_MS = 24 * 60 * 60 * 1000

/** Vikunja project title → hex. Anything unlisted keeps its own title as the hex name. */
const ZONE_FOR = [
  [/corrosion/i, 'CorrosionDC'],
  [/ngv|recruit/i, 'NGV Talent'],
  [/embassy|marc coaching/i, 'Embassy Landscape'],
  [/nedbuilds|ned builds/i, 'NED Builds'],
  [/cybergrade/i, 'CyberGrade'],
  [/ai club/i, 'KC AI Club'],
  [/caregiver|frances/i, 'Frances'],
  [/franky/i, 'Franky'],
  [/janine/i, 'KC Proto'],
  [/client ops|kc proto|meetings/i, 'KC Proto'],
  [/hive/i, 'Trade Floor'],
  [/^inbox$/i, 'Inbox'],
]

async function getJson(path) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`vikunja ${path.split('?')[0]} → ${res.status}`)
  return res.json()
}

const validDate = (s) => {
  const t = Date.parse(s || '')
  return Number.isFinite(t) && t > Date.UTC(1971, 0, 1) ? t : 0
}

async function fetchThreads() {
  const projects = await getJson('/projects')
  const now = Date.now()
  const out = []
  await Promise.all(
    (Array.isArray(projects) ? projects : []).map(async (p) => {
      if (p.is_archived) return
      const zone = ZONE_FOR.find(([re]) => re.test(p.title))?.[1] || p.title
      let tasks = []
      try {
        tasks = await getJson(`/projects/${p.id}/tasks?per_page=50`)
        if (Array.isArray(tasks) && tasks.length === 50) {
          const more = await getJson(`/projects/${p.id}/tasks?per_page=50&page=2`).catch(() => [])
          tasks = tasks.concat(Array.isArray(more) ? more : [])
        }
      } catch {
        return
      }
      for (const t of Array.isArray(tasks) ? tasks : []) {
        if (t.done) continue
        const due = validDate(t.due_date)
        const overdue = due && due < now
        const soon = due && !overdue && due - now < SOON_MS
        const high = Number(t.priority) >= 4
        const labels = (t.labels || []).map((l) => l.title).filter(Boolean)
        const when = due ? (overdue ? `overdue since ${new Date(due).toLocaleDateString('en-US')}` : `due ${new Date(due).toLocaleDateString('en-US')}`) : 'no due date'
        out.push({
          id: `task:${t.id}`,
          kind: 'task',
          title: String(t.title || 'Task').slice(0, 120),
          preview: [p.title, when, high ? 'high priority' : '', labels.join(', ')].filter(Boolean).join(' · '),
          project: zone,
          projectPath: `tasks://${p.id}`,
          worktree: '',
          cwd: p.title,
          gitBranch: overdue ? 'overdue' : soon ? 'due soon' : 'open',
          model: labels[0] || '',
          effort: '',
          createdAt: validDate(t.created) || now,
          lastActivityAt: validDate(t.updated) || validDate(t.created) || now,
          lastFocusedAt: 0,
          running: false,
          unread: Boolean(soon || high),
          hasError: Boolean(overdue),
          starred: Boolean(t.is_favorite),
          routine: '',
          prState: '',
          archived: false,
          hasTranscript: false,
          sizeBytes: 1000 * (1 + (Number(t.priority) || 1) * 30),
          source: 'vikunja',
          canOpen: true,
          canArchive: false,
          ref: { task: t.id },
        })
      }
    })
  )
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
        console.warn('tasks:', err.message)
        return cache.data || []
      })
  }
  return cache.data || cache.inflight
}

export default {
  id: 'tasks',
  name: 'Vikunja',
  detect: async () => Boolean(TOKEN),
  scanThreads,
  openThread: (ref) => {
    const id = Number(ref?.task)
    return Number.isInteger(id) && id > 0 ? { ok: true, browser: true, url: `${OPEN_URL}/tasks/${id}` } : { ok: true, browser: true, url: OPEN_URL }
  },
  newSession: () => ({ ok: false, error: 'Tasks are made in Vikunja' }),
  setArchived: async () => ({ ok: false, error: 'Mark it done in Vikunja; it walks home on its own' }),
}
