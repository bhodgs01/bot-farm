/**
 * Harness adapter: the KC Proto projects board — every open project is an astronaut.
 *
 * Janine keeps the board (`/api/projects`, the same list the clawd dashboard renders).
 * A prospect needs a follow-up and holds a `?`; a project in process hammers away; an
 * active one is delivered and unpaid, so it also holds a `?` until the money lands. Paid
 * and completed projects are gone. The card reads client, project, type and the total.
 *
 * Read-only: one GET per poll.
 */

const API = (process.env.JANINE_URL || 'http://janine.janine.svc.cluster.local:3120').replace(/\/$/, '')
const OPEN_URL = process.env.PROJECTS_OPEN_URL || 'https://clawd.kcproto.com/'
const TTL_MS = 60 * 1000
const ZONE = 'KC Proto'
const PRINT_RATE = Number(process.env.PJ_PRINT_RATE) || 0.3
const SETUP_FEE = Number(process.env.PJ_SETUP_FEE) || 3

const SHOW = new Set(['prospect', 'in_process', 'active'])
const LABEL = { prospect: 'prospect', in_process: 'in process', active: 'delivered, unpaid' }

/** The dashboard's own total: labor + material + per-gram print charge + expenses. */
function total(p) {
  let t = (Number(p.labor) || 0) + (Number(p.material) || 0)
  if (p.type === '3d_print' && Number(p.grams)) t += Number(p.grams) * PRINT_RATE + SETUP_FEE
  for (const e of p.expenses || []) t += Number(e.amount) || 0
  return t
}

const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`

async function fetchThreads() {
  const res = await fetch(`${API}/api/projects`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`projects → ${res.status}`)
  const json = await res.json()
  const list = Array.isArray(json) ? json : json.projects || []
  const now = Date.now()
  return list
    .filter((p) => SHOW.has(p.status))
    .map((p) => {
      const amount = total(p)
      const created = Date.parse(p.created || '') || now
      const started = Date.parse(p.processStarted || '') || created
      const age = Math.max(1, Math.round((now - created) / 86400000))
      const who = p.client || p.name || 'Someone'
      const what = p.name && p.name !== p.client ? p.name : ''
      return {
        id: `project:${p.id}`,
        kind: 'project',
        title: `${p.status === 'prospect' ? '🤝' : p.status === 'in_process' ? '🔧' : '💵'} ${who}`,
        preview: [what, LABEL[p.status], amount ? money(amount) : 'no price yet', p.type ? String(p.type).replace('_', ' ') : '', p.priority ? `${p.priority} lead` : '', `${age}d on the board`]
          .filter(Boolean)
          .join(' · '),
        project: ZONE,
        projectPath: 'board://kcproto',
        worktree: '',
        cwd: p.email || '',
        gitBranch: LABEL[p.status],
        model: amount ? money(amount) : '',
        effort: '',
        createdAt: created,
        lastActivityAt: started,
        lastFocusedAt: 0,
        running: p.status === 'in_process',
        unread: p.status === 'prospect' || p.status === 'active',
        hasError: false,
        starred: p.priority === 'hot',
        routine: '',
        prState: '',
        archived: false,
        hasTranscript: false,
        sizeBytes: 1000 * (1 + amount * 2),
        source: 'projects-board',
        canOpen: true,
        canArchive: false,
        ref: { id: p.id },
      }
    })
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
        console.warn('projects:', err.message)
        return cache.data || []
      })
  }
  return cache.data || cache.inflight
}

let detectCache = { at: 0, ok: false }
async function detect() {
  if (Date.now() - detectCache.at < 60 * 1000) return detectCache.ok
  try {
    const res = await fetch(`${API}/api/projects`, { signal: AbortSignal.timeout(5000) })
    detectCache = { at: Date.now(), ok: res.ok }
  } catch {
    detectCache = { at: Date.now(), ok: false }
  }
  return detectCache.ok
}

export default {
  id: 'projects',
  name: 'Projects Board',
  detect,
  scanThreads,
  openThread: () => ({ ok: true, browser: true, url: OPEN_URL }),
  newSession: () => ({ ok: false, error: 'Projects are added on the board' }),
  setArchived: async () => ({ ok: false, error: 'Mark it paid on the board; it walks home on its own' }),
}
