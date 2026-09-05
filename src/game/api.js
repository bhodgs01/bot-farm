async function req(url, options) {
  const res = await fetch(url, options)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `${res.status} ${res.statusText}`)
  return body
}

const post = (url, payload) =>
  req(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

export const fetchThreads = () => req('/api/threads')
export const fetchState = () => req('/api/state')
export const fetchNap = () => req('/api/nap')

/** The hash in this page's own bundle name; 'dev' under the Vite dev server. */
export const BUILD = (() => {
  for (const s of document.scripts) {
    const m = (s.src || '').match(/assets\/index-([A-Za-z0-9_-]+)\.js/)
    if (m) return m[1]
  }
  return 'dev'
})()

/**
 * The server is serving a newer build than this page is running. Reload once so this tab
 * stops saving a layout the rest of the world has moved past. The guard keeps a page that
 * somehow still mismatches after a reload from looping.
 */
export function reloadForBuild(build) {
  const key = `botfarm.reloaded.${build}`
  try {
    if (sessionStorage.getItem(key)) return false
    sessionStorage.setItem(key, '1')
  } catch {
    /* no session storage: reload anyway, once is all we can promise */
  }
  location.reload()
  return true
}

export const saveState = async (state) => {
  const res = await fetch('/api/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Botfarm-Build': BUILD },
    body: JSON.stringify(state),
  })
  const body = await res.json().catch(() => ({}))
  if (res.status === 409 && body.build) {
    reloadForBuild(body.build)
    throw new Error('stale build')
  }
  if (!res.ok) throw new Error(body.error || `${res.status} ${res.statusText}`)
  return body
}

/**
 * Hand a thread back to whichever harness owns it — the desktop app comes forward on its own.
 *
 * `ref` is opaque here on purpose: it is whatever that harness's adapter needs to find the
 * thread again, and the browser only ever passes it straight back. Nothing in the UI knows
 * what a Claude Code session id, or a Codex rollout id, actually looks like.
 */
export const openThread = (thread) => post('/api/open', { harness: thread.harness, ref: thread.ref })

export const archiveThread = (thread, archived) =>
  post('/api/archive', { id: thread.id, harness: thread.harness, ref: thread.ref, archived })

/** A brand new thread in a repo, via that harness's own new-session deep link. */
export const newSession = (folder, harness) => post('/api/new-session', { folder, harness })

export const revealFolder = (folder) => post('/api/reveal', { folder })

/** Ask a worker what it needs. Gated at the edge; a 401 carries where to sign in. */
export const askWorker = (thread, message) => post('/api/ask', { id: thread.id, message })

/** Move a project to another stage on the board. Gated at the edge like chat. */
export const actProject = (projectId, status) => post('/api/act/project', { id: projectId, status })

/** Close a Vikunja ticket. Same gate. */
export const actTask = (taskId) => post('/api/act/task', { id: taskId })

/** Mark one of Blake's chores done (every id the astronaut stands for). */
export const actChore = (ids) => post('/api/act/chore', { ids })

/** Remove a known flag (or put it back). The flag returns on its own if the failure changes. */
export const actAck = (threadId, on) => post('/api/act/ack', { id: threadId, on })

/** Mark a desk's briefing read (or unread): the correspondent puts his hand down. */
export const actNews = (topic, date, on) => post('/api/act/news', { topic, date, on })

/** Star (or unstar) a worker: a gold star over his head until you take it off. */
export const actStar = (threadId, on) => post('/api/act/star', { id: threadId, on })
