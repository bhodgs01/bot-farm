/**
 * Harness adapter: Chore Quest — Blake's own chores for today, as one keeper on the Home hex.
 *
 * The map is Blake's report on his own life, so only his list is here: the number of
 * chores left floats over the keeper's head, hovering lists them, and when the last one
 * is done he celebrates. The kids' lists stay in Chore Quest.
 *
 * Read-only: one GET of /api/state per poll.
 */

const URL = process.env.CHORES_URL || 'http://chore-quest.chore-quest.svc.cluster.local'
const OPEN_URL = process.env.CHORES_OPEN_URL || 'https://chores.kcproto.com'
const TTL_MS = 30 * 1000


async function fetchThreads() {
  const res = await fetch(`${URL}/api/state`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`chore-quest → ${res.status}`)
  const state = await res.json()
  const done = state.done || {}
  const now = Date.now()
  const dayStart = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }))
  dayStart.setHours(0, 0, 0, 0)
  const out = []
  const mine = Array.isArray(state.todayC?.blake) ? state.todayC.blake : []
  if (mine.length) {
    const left = mine.filter((c) => !done[`blake-${c.id}`])
    const clean = (c) => String(c.task || '').replace(/https?:\/\/\S+/g, '').trim() || 'chore'
    out.push({
      id: 'chore:blake:list',
      kind: left.length ? 'task' : 'done',
      count: left.length,
      title: `📝 Blake's chores`,
      preview: left.length ? left.map((c) => `• ${clean(c)}`).join(String.fromCharCode(10)) : `all ${mine.length} done today`,
      project: 'Home',
      projectPath: 'home://chores',
      worktree: '',
      cwd: 'blake',
      gitBranch: left.length ? `${left.length} left` : 'done',
      model: `${mine.length - left.length}/${mine.length} done`,
      effort: '',
      createdAt: dayStart.getTime(),
      lastActivityAt: now,
      lastFocusedAt: 0,
      running: false,
      unread: false,
      hasError: false,
      starred: false,
      routine: '',
      prState: left.length ? '' : 'MERGED',
      archived: false,
      hasTranscript: false,
      sizeBytes: 1000 * (1 + mine.length * 20),
      source: 'chore-quest',
      canOpen: true,
      canArchive: false,
      ref: { kid: 'blake' },
    })
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
        console.warn('chores:', err.message)
        return cache.data || []
      })
  }
  return cache.data || cache.inflight
}

let detectCache = { at: 0, ok: false }
async function detect() {
  if (Date.now() - detectCache.at < 60 * 1000) return detectCache.ok
  try {
    const res = await fetch(`${URL}/api/state`, { signal: AbortSignal.timeout(5000) })
    detectCache = { at: Date.now(), ok: res.ok }
  } catch {
    detectCache = { at: Date.now(), ok: false }
  }
  return detectCache.ok
}

export default {
  id: 'chores',
  name: 'Chore Quest',
  detect,
  scanThreads,
  openThread: () => ({ ok: true, browser: true, url: OPEN_URL }),
  newSession: () => ({ ok: false, error: 'Chores are handed out in Chore Quest' }),
  setArchived: async () => ({ ok: false, error: 'Mark it done in Chore Quest' }),
}
