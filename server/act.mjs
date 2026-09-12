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
import { refreshChores, SAY_PEOPLE } from './harnesses/chores.mjs'
import { refreshJanine } from './harnesses/janine.mjs'

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

const CHORES = (process.env.CHORES_URL || 'http://chore-quest.chore-quest.svc.cluster.local').replace(/\/$/, '')

/**
 * Mark one or more of Blake's chores done in Chore Quest. The app has one whole-state
 * PUT, so this reads the state, flips the flags, writes it back, and reads it again to be
 * sure. Returns how many were newly marked.
 */
export async function completeChores({ ids, who }) {
  const wanted = [...new Set(ids.map((id) => `blake-${String(id)}`))]
  const get = async () => {
    const r = await fetch(`${CHORES}/api/state`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) })
    if (!r.ok) throw new Error(`chores read → ${r.status}`)
    return r.json()
  }
  const state = await get()
  const known = new Set((state.todayC?.blake || []).map((c) => `blake-${c.id}`))
  const missing = wanted.filter((k) => !known.has(k))
  if (missing.length) throw new Error(`Not on today's list: ${missing.join(', ')}`)
  state.done = state.done || {}
  let changed = 0
  for (const k of wanted) if (!state.done[k]) { state.done[k] = true; changed++ }
  if (changed) {
    const r = await fetch(`${CHORES}/api/state`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state), signal: AbortSignal.timeout(10000) })
    if (!r.ok) throw new Error(`chores write → ${r.status}`)
    const after = await get()
    for (const k of wanted) if (!after.done?.[k]) throw new Error('Chore Quest did not keep the change')
  }
  console.log(`act: ${who} marked ${wanted.length} chore(s) done`)
  refreshChores()
  return changed
}

/**
 * Mark Kai's "feed Carti" chore done in Chore Quest — the one write the bot farm makes to a
 * kid's list, and only for this one pet duty (so it clears Carti's note from either app).
 */
export async function feedCartiDone() {
  const get = async () => {
    const r = await fetch(`${CHORES}/api/state`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) })
    if (!r.ok) throw new Error(`chores read → ${r.status}`)
    return r.json()
  }
  const state = await get()
  const key = 'kai-feed-carti'
  const onList = (state.todayC?.kai || []).some((c) => c.id === 'feed-carti')
  if (!onList) return false // nothing to do — not on today's list
  state.done = state.done || {}
  if (state.done[key]) { refreshChores(); return true }
  state.done[key] = true
  const r = await fetch(`${CHORES}/api/state`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state), signal: AbortSignal.timeout(10000) })
  if (!r.ok) throw new Error(`chores write → ${r.status}`)
  const after = await get()
  if (!after.done?.[key]) throw new Error('Chore Quest did not keep the change')
  console.log('act: fed Carti — kai-feed-carti marked done')
  refreshChores()
  return true
}

/**
 * Blake read a kid's note: clear it. Same read-modify-write-verify as completeChores,
 * against the same Chore Quest state document. Clearing is the acknowledgement — the note
 * leaves the kid's card in Chore Quest and the speech bubble leaves their head on the map,
 * together, so the two can never disagree about whether it still stands.
 */
export async function clearSay({ kid, who }) {
  const id = String(kid || '').toLowerCase()
  if (!SAY_PEOPLE.includes(id)) throw new Error(`Not on the board: ${kid}`)
  const get = async () => {
    const r = await fetch(`${CHORES}/api/state`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) })
    if (!r.ok) throw new Error(`chores read → ${r.status}`)
    return r.json()
  }
  const state = await get()
  const said = state.says && state.says[id] ? String(state.says[id].text || '') : ''
  if (!said) {
    refreshChores()
    return { cleared: false, text: '' }
  }
  state.says = { ...state.says }
  delete state.says[id]
  const r = await fetch(`${CHORES}/api/state`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state), signal: AbortSignal.timeout(10000) })
  if (!r.ok) throw new Error(`chores write → ${r.status}`)
  const after = await get()
  if (after.says && after.says[id]) throw new Error('Chore Quest did not keep the change')
  console.log(`act: ${who} acknowledged ${id}'s note (${said.slice(0, 60)})`)
  refreshChores()
  return { cleared: true, text: said }
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

// ── a raised hand becomes a ticket ───────────────────────────────────────────────────────
/** Which Vikunja project a hex's tickets go to. Anything unlisted lands in Client Ops. */
const PROJECT_FOR_ZONE = { 'KC Proto': 2, Calendar: 2, Inbox: 1, CorrosionDC: 3, 'NGV Talent': 4, 'Embassy Landscape': 5, 'NED Builds': 6, CyberGrade: 7, 'KC AI Club': 8, Frances: 9 }

export async function createTicket({ thread, who }) {
  if (!VIKUNJA_TOKEN) throw new Error('No Vikunja token on this server')
  const project = PROJECT_FOR_ZONE[thread.project] || 2
  const headers = { Authorization: `Bearer ${VIKUNJA_TOKEN}`, Accept: 'application/json', 'Content-Type': 'application/json' }
  const facts = Object.entries(thread.details || {})
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `${k}: ${String(v).replace(/\s+/g, ' ').slice(0, 300)}`)
    .join('\n')
  const description = [`From Bot Farm (${thread.project}).`, thread.preview ? String(thread.preview).slice(0, 600) : '', facts, thread.ref?.url ? `Link: ${thread.ref.url}` : ''].filter(Boolean).join('\n\n')
  const r = await fetch(`${VIKUNJA}/projects/${project}/tasks`, { method: 'PUT', headers, body: JSON.stringify({ title: String(thread.title || 'Bot Farm').replace(/^[^\w$]+/, '').slice(0, 200), description }), signal: AbortSignal.timeout(10000) })
  if (!r.ok) throw new Error(`ticket create → ${r.status}`)
  const task = await r.json()
  console.log(`act: ${who} filed ticket #${task.id} in project ${project}: ${task.title}`)
  refreshTasks()
  return task
}

// ── Janine's held drafts: send it, or skip it ────────────────────────────────────────────
const JANINE_BASE = (process.env.JANINE_URL || 'http://janine.janine.svc.cluster.local:3120').replace(/\/$/, '')
export async function janineDraftAction({ draftKey, action, who }) {
  if (!['approve', 'skip', 'handled'].includes(action)) throw new Error('Bad action')
  const r = await fetch(`${JANINE_BASE}/api/draft/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draftKey, action }), signal: AbortSignal.timeout(20000) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.success === false) throw new Error(j.error || `janine → ${r.status}`)
  console.log(`act: ${who} told Janine to ${action} ${draftKey}`)
  refreshJanine()
  return j
}

// ── Nudge: a payment reminder drafted into Gmail, never sent from here ────────────────
const GMAIL = { id: process.env.GMAIL_CLIENT_ID || '', secret: process.env.GMAIL_CLIENT_SECRET || '', refresh: process.env.GMAIL_REFRESH_TOKEN || '' }
let gmailAccess = { token: '', expiresAt: 0 }
async function gmailToken() {
  if (gmailAccess.token && Date.now() < gmailAccess.expiresAt - 60000) return gmailAccess.token
  if (!GMAIL.id || !GMAIL.secret || !GMAIL.refresh) throw new Error('No Gmail credentials on this server')
  const body = new URLSearchParams({ client_id: GMAIL.id, client_secret: GMAIL.secret, refresh_token: GMAIL.refresh, grant_type: 'refresh_token' })
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`gmail token → ${res.status}`)
  const json = await res.json()
  gmailAccess = { token: json.access_token, expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000 }
  return gmailAccess.token
}

/**
 * Draft a short, polite reminder to the client behind a receivable. It lands in Gmail's
 * Drafts for Blake to read and send; nothing goes out from the map.
 */
export async function nudgeClient({ thread, who }) {
  const d = thread.details || {}
  const to = String(d.Email || thread.cwd || '').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error('No email address on this job')
  const client = String(d.Client || '').trim()
  const job = String(thread.title || '').replace(/^[^\w$]+/, '').trim()
  const amount = String(d.Total || d.Owed || thread.plate || '').trim()
  const first = client.split(/\s+/)[0] || 'there'
  const subject = `Invoice reminder: ${job}`
  const text = [
    `Hi ${first},`,
    '',
    `Quick note on the invoice for ${job}${amount ? ` (${amount})` : ''}. When you get a chance, could you let me know where it stands on your end?`,
    '',
    'Happy to resend it or answer any questions.',
    '',
    'Thanks,',
    'Blake',
  ].join('\r\n')
  const raw = [`To: ${to}`, `Subject: ${subject}`, 'Content-Type: text/plain; charset=utf-8', 'MIME-Version: 1.0', '', text].join('\r\n')
  const encoded = Buffer.from(raw, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const token = await gmailToken()
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: { raw: encoded } }), signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`gmail draft → ${res.status}`)
  const draft = await res.json()
  console.log(`act: ${who} drafted a reminder to ${to} for ${job} (draft ${draft.id})`)
  return { id: draft.id, to, subject }
}
