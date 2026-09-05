/**
 * Harness adapter: Vikunja — every open task is an astronaut on its client's hex.
 *
 * Every open ticket stands beside its client's agent with a hand up and a `?`: an open
 * ticket is, by definition, waiting on Blake. Overdue ones raise the `!` instead. The card
 * carries the whole ticket and a button that closes it (see server/act.mjs).
 *
 * Read-only: GET /projects, then GET /projects/{id}/tasks per project.
 * Env: VIKUNJA_TOKEN, VIKUNJA_URL optional.
 */

const TOKEN = process.env.VIKUNJA_TOKEN || ''
const API = (process.env.VIKUNJA_URL || 'http://vikunja.vikunja.svc.cluster.local:3456').replace(/\/$/, '') + '/api/v1'
const OPEN_URL = (process.env.VIKUNJA_OPEN_URL || 'https://tasks.kcproto.com').replace(/\/$/, '')
const TTL_MS = 60 * 1000
const SOON_MS = 24 * 60 * 60 * 1000

/**
 * Projects that are somebody else's to-do list, not Blake's. The Marc Coaching Hub writes
 * follow-ups for Marc's own team into Vikunja; they are his to chase, not Blake's.
 */
const NOT_MINE = /coaching hub/i

/** Vikunja project title → hex. Anything unlisted keeps its own title as the hex name. */
const ZONE_FOR = [
  [/corrosion/i, 'CorrosionDC'],
  [/ngv|recruit/i, 'NGV Talent'],
  [/embassy|marc coaching/i, 'Embassy Landscape'],
  [/fj40|land ?cruiser|garage/i, 'Garage'],
  [/nedbuilds|ned builds/i, 'NED Builds'],
  [/cybergrade/i, 'CyberGrade'],
  [/ai club/i, 'KC AI Club'],
  [/caregiver|frances/i, 'Frances'],
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
      if (p.is_archived || NOT_MINE.test(p.title)) return
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
        const desc = String(t.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
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
          unread: !overdue,
          hasError: Boolean(overdue),
          actions: ['done'],
          details: {
            Ticket: `#${t.id}`,
            Project: p.title,
            Due: due ? new Date(due).toLocaleString('en-US') : '',
            Priority: Number(t.priority) ? ['', 'low', 'medium', 'high', 'urgent', 'DO NOW'][Number(t.priority)] || String(t.priority) : '',
            Labels: labels.join(', '),
            Assigned: (t.assignees || []).map((a) => a.name || a.username).filter(Boolean).join(', '),
            Created: validDate(t.created) ? new Date(validDate(t.created)).toLocaleDateString('en-US') : '',
            Updated: validDate(t.updated) ? new Date(validDate(t.updated)).toLocaleDateString('en-US') : '',
            Description: desc.slice(0, 1200),
          },
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
  // One keeper on KC Proto carries the whole list: the count over his head, the titles
  // on hover, a `?` if anything is due soon and a `!` if anything is overdue.
  if (out.length) {
    const overdue = out.filter((t) => t.hasError).length
    const soon = out.filter((t) => t.unread).length
    const lines = out
      .slice()
      .sort((a, b) => (b.hasError - a.hasError) || (b.unread - a.unread) || a.createdAt - b.createdAt)
      .slice(0, 14)
      .map((t) => `• ${t.hasError ? '⚠ ' : ''}${t.title}${t.cwd ? ` (${t.cwd})` : ''}`)
    if (out.length > 14) lines.push(`… and ${out.length - 14} more`)
    out.push({
      id: 'task:all',
      kind: 'task',
      count: out.length,
      title: '📋 Tasks',
      preview: lines.join(String.fromCharCode(10)),
      project: 'KC Proto',
      projectPath: 'tasks://all',
      worktree: '',
      cwd: 'all projects',
      gitBranch: overdue ? `${overdue} overdue` : soon ? `${soon} due soon` : `${out.length} open`,
      model: '',
      effort: '',
      createdAt: 0,
      lastActivityAt: now,
      lastFocusedAt: 0,
      running: false,
      unread: soon > 0,
      hasError: overdue > 0,
      starred: false,
      routine: '',
      prState: '',
      archived: false,
      hasTranscript: false,
      sizeBytes: 1000 * (1 + out.length * 30),
      source: 'vikunja',
      canOpen: true,
      canArchive: false,
      ref: { task: 0 },
    })
  }
  return out
}

let cache = { at: 0, data: null, inflight: null }
/** Forget the last read after a write. */
export function refreshTasks() {
  cache = { at: 0, data: cache.data, inflight: null }
}
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
