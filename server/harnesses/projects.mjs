/**
 * Harness adapter: the KC Proto projects board — every open project is an astronaut, on one
 * of three hexes by stage. Drag one to the next hex, or press the button on its card, and
 * the board changes (see server/act.mjs). A paid project walks back to the ship.
 *
 * Janine keeps the board (`/api/projects`, the same list the clawd dashboard renders).
 * A prospect needs a follow-up and holds a `?`; a project in process hammers away; an
 * active one is an ongoing client and just stands there. Paid and completed are gone. The card reads client, project, type and the total.
 *
 * Read-only: one GET per poll.
 */

const API = (process.env.JANINE_URL || 'http://janine.janine.svc.cluster.local:3120').replace(/\/$/, '')
const OPEN_URL = process.env.PROJECTS_OPEN_URL || 'https://clawd.kcproto.com/'
const TTL_MS = 60 * 1000
const ZONE_FOR_STATUS = { prospect: 'Active Projects', active: 'Active Projects', in_process: 'In Process', completed: 'Completed' }
const PRINT_RATE = Number(process.env.PJ_PRINT_RATE) || 0.3
const SETUP_FEE = Number(process.env.PJ_SETUP_FEE) || 3

const SHOW = new Set(['prospect', 'in_process', 'active', 'completed'])
const LABEL = { prospect: 'prospect', in_process: 'in process', active: 'active', completed: 'completed, awaiting payment' }
/** What the card offers next, by stage. */
const NEXT = { prospect: ['active', 'in_process'], active: ['in_process'], in_process: ['completed'], completed: ['paid'] }

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
        title: `${p.status === 'prospect' ? '🤝' : p.status === 'in_process' ? '🔧' : p.status === 'completed' ? '📦' : '🏷️'} ${who}`,
        preview: [what, LABEL[p.status], amount ? money(amount) : 'no price yet', p.type ? String(p.type).replace('_', ' ') : '', p.priority ? `${p.priority} lead` : '', `${age}d on the board`]
          .filter(Boolean)
          .join(' · '),
        project: ZONE_FOR_STATUS[p.status] || 'Active Projects',
        projectPath: `board://${p.status}`,
        status: p.status,
        actions: NEXT[p.status] || [],
        details: {
          Client: p.client || '',
          Project: p.name || '',
          Email: p.email || '',
          Type: String(p.type || '').replace('_', ' '),
          Status: LABEL[p.status] || p.status,
          Priority: p.priority || '',
          Total: amount ? money(amount) : '',
          Labor: Number(p.labor) ? money(Number(p.labor)) : '',
          Material: Number(p.material) ? money(Number(p.material)) : '',
          Grams: Number(p.grams) ? `${p.grams} g` : '',
          Expenses: (p.expenses || []).length ? (p.expenses || []).map((e) => `${e.name || e.label || 'expense'} ${money(Number(e.amount) || 0)}`).join(', ') : '',
          Retainer: Number(p.retainer) ? `${money(Number(p.retainer))} ${p.billingCycle || ''}`.trim() : '',
          Payment: p.paymentMethod || '',
          Tasks: (p.tasks || []).length ? (p.tasks || []).map((t) => (typeof t === 'string' ? t : t.title || t.name || '')).filter(Boolean).join(', ') : '',
          Created: p.created ? new Date(created).toLocaleDateString('en-US') : '',
          Started: p.processStarted ? new Date(started).toLocaleDateString('en-US') : '',
          Completed: p.completed ? new Date(Date.parse(p.completed)).toLocaleDateString('en-US') : '',
          Notes: p.notes || '',
        },
        worktree: '',
        cwd: p.email || '',
        gitBranch: LABEL[p.status],
        model: amount ? money(amount) : '',
        effort: '',
        createdAt: created,
        lastActivityAt: started,
        lastFocusedAt: 0,
        running: p.status === 'in_process',
        unread: p.status === 'prospect' || p.status === 'completed',
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
/** Forget the last read: a write just happened and the next scan must see it. */
export function refreshProjects() {
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
