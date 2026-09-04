/**
 * Write actions. The first ones on the map, and the pattern for every one that follows:
 * gated at the edge by Cloudflare Access, checked again here against the allowlist, and
 * each one a whole read-modify-write-verify cycle against the source of truth.
 *
 * Projects live on Janine's board as one JSON list that is replaced wholesale, which is
 * exactly how a stale tab once wiped three orders. So: read the list, change one field
 * on one entry, write the whole list back, read it again, and refuse to report success
 * unless the count is unchanged and the change is visible.
 */
import { refreshProjects } from './harnesses/projects.mjs'
import { refreshTasks } from './harnesses/tasks.mjs'

const VIKUNJA = (process.env.VIKUNJA_URL || 'http://vikunja.vikunja.svc.cluster.local:3456').replace(/\/$/, '') + '/api/v1'
const VIKUNJA_TOKEN = process.env.VIKUNJA_TOKEN || ''

const JANINE = (process.env.JANINE_URL || 'http://janine.janine.svc.cluster.local:3120').replace(/\/$/, '')

const ALLOWED = new Set(['prospect', 'active', 'in_process', 'completed', 'paid'])

async function getList() {
  const res = await fetch(`${JANINE}/api/projects`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`projects read → ${res.status}`)
  const json = await res.json()
  return Array.isArray(json) ? json : json.projects || []
}

/** Close a ticket in Vikunja: read it, mark it done, write it back, read it again. */
export async function closeTask({ id, who }) {
  if (!VIKUNJA_TOKEN) throw new Error('No Vikunja token on this server')
  const headers = { Authorization: `Bearer ${VIKUNJA_TOKEN}`, Accept: 'application/json', 'Content-Type': 'application/json' }
  const get = async () => {
    const r = await fetch(`${VIKUNJA}/tasks/${id}`, { headers, signal: AbortSignal.timeout(10000) })
    if (!r.ok) throw new Error(`ticket read → ${r.status}`)
    return r.json()
  }
  const task = await get()
  if (task.done) return task
  const r = await fetch(`${VIKUNJA}/tasks/${id}`, { method: 'POST', headers, body: JSON.stringify({ ...task, done: true }), signal: AbortSignal.timeout(10000) })
  if (!r.ok) throw new Error(`ticket write → ${r.status}`)
  const after = await get()
  if (!after.done) throw new Error('Vikunja did not mark it done')
  console.log(`act: ${who} closed ticket #${id} (${task.title})`)
  refreshTasks()
  return after
}

/** Move one project to a new status. Returns the updated entry. */
export async function setProjectStatus({ id, status, who }) {
  if (!ALLOWED.has(status)) throw new Error(`Not a board status: ${status}`)
  const list = await getList()
  const i = list.findIndex((p) => p.id === id)
  if (i === -1) throw new Error('That project is not on the board any more')
  const before = list[i]
  if (before.status === status) return before
  const now = new Date().toISOString()
  const next = { ...before, status }
  if (status === 'in_process' && !next.processStarted) next.processStarted = now
  if (status === 'completed' || status === 'paid') next.completed = next.completed || now
  if (status === 'active' || status === 'prospect') next.completed = null
  const updated = list.slice()
  updated[i] = next

  const res = await fetch(`${JANINE}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projects: updated }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`projects write → ${res.status}`)

  const after = await getList()
  const seen = after.find((p) => p.id === id)
  if (after.length !== list.length || !seen || seen.status !== status) {
    throw new Error('The board did not take the change; nothing else was touched')
  }
  console.log(`act: ${who} moved project ${id} ${before.status} → ${status}`)
  refreshProjects()
  return seen
}
