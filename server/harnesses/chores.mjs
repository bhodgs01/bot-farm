/**
 * Harness adapter: Chore Quest — Blake's own chores for today, on their own Chores hex.
 *
 * The map is Blake's report on his own life, so only his list is here. Every chore left
 * today is one astronaut standing on the hex with the chore on hover; the board keeper
 * wears the count on its roof; when the last one is done the keeper celebrates. The kids'
 * lists stay in Chore Quest.
 *
 * Chore Quest repeats generated chores (the battery reminders arrive once per device
 * reading), so chores with the same first line fold into one astronaut that remembers
 * every id it stands for. Marking him done marks all of them.
 *
 * Reads /api/state; the one write (done) goes through server/act.mjs.
 */

const URL = process.env.CHORES_URL || 'http://chore-quest.chore-quest.svc.cluster.local'
const OPEN_URL = process.env.CHORES_OPEN_URL || 'https://chores.kcproto.com'
const TTL_MS = 30 * 1000
const ZONE = 'Chores'
const NL = String.fromCharCode(10)

/** The chore's first line, without the photo link Chore Quest tacks on. */
const headline = (c) => String(c.task || '').split(NL)[0].replace(/https?:\/\/\S+/g, '').trim() || 'chore'
/** The rest of the chore text, for the card. */
const body = (c) => String(c.task || '').split(NL).slice(1).map((l) => l.trim()).filter(Boolean).join(NL)
const link = (c) => (String(c.task || '').match(/https?:\/\/\S+/) || [''])[0]

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
  if (!mine.length) return out

  const left = mine.filter((c) => !done[`blake-${c.id}`])
  // Fold repeats: same headline, one astronaut, every id remembered.
  const groups = new Map()
  for (const c of left) {
    const key = headline(c).toLowerCase()
    if (!groups.has(key)) groups.set(key, { first: c, ids: [], notes: [] })
    const g = groups.get(key)
    g.ids.push(c.id)
    const b = body(c)
    if (b && !g.notes.includes(b)) g.notes.push(b)
  }

  const base = {
    project: ZONE,
    projectPath: 'home://chores',
    worktree: '',
    effort: '',
    lastFocusedAt: 0,
    running: false,
    hasError: false,
    starred: false,
    routine: '',
    archived: false,
    hasTranscript: false,
    source: 'chore-quest',
    canOpen: true,
    canArchive: false,
  }

  // The board: count on the roof, whole list on hover, a party when it hits zero.
  out.push({
    ...base,
    id: 'chore:blake:list',
    kind: left.length ? 'task' : 'done',
    landmark: 'signpost',
    roof: left.length ? `${left.length} left` : 'all done',
    count: 0,
    title: `📝 Chore board`,
    preview: left.length ? [...groups.values()].map((g) => `• ${headline(g.first)}${g.ids.length > 1 ? ` ×${g.ids.length}` : ''}`).join(NL) : `all ${mine.length} done today`,
    details: {
      Today: `${mine.length - left.length} of ${mine.length} done`,
      Left: [...groups.values()].map((g) => headline(g.first)).join(', '),
    },
    cwd: 'blake',
    gitBranch: left.length ? `${left.length} left` : 'done',
    model: `${mine.length - left.length}/${mine.length} done`,
    createdAt: dayStart.getTime(),
    lastActivityAt: now,
    unread: false,
    prState: left.length ? '' : 'MERGED',
    sizeBytes: 1000 * (1 + mine.length * 20),
    ref: { kid: 'blake' },
  })

  // One astronaut per chore left.
  for (const g of groups.values()) {
    const c = g.first
    const title = `${c.icon && c.icon !== '📝' ? `${c.icon} ` : ''}${headline(c)}`
    out.push({
      ...base,
      id: `chore:blake:${c.id}`,
      kind: 'task',
      title: title.slice(0, 120),
      preview: [g.notes.join(NL), g.ids.length > 1 ? `${g.ids.length} reminders folded into one` : '', c.xp ? `${c.xp} xp` : ''].filter(Boolean).join(NL) || 'on today\'s list',
      details: {
        Chore: headline(c),
        Notes: g.notes.join(NL),
        Category: c.cat || '',
        Reminders: g.ids.length > 1 ? String(g.ids.length) : '',
        XP: c.xp ? String(c.xp) : '',
        Photo: link(c),
      },
      actions: ['chore'],
      exit: 'beam',
      cwd: 'blake',
      gitBranch: 'to do',
      model: '',
      createdAt: dayStart.getTime(),
      lastActivityAt: now,
      unread: false,
      prState: '',
      sizeBytes: 1000 * (1 + (c.xp || 10)),
      ref: { kid: 'blake', ids: g.ids },
    })
  }
  return out
}

let cache = { at: 0, data: null, inflight: null }
/** Forget the last read: a chore was just marked done and the next scan must see it. */
export function refreshChores() {
  cache = { at: 0, data: null, inflight: null }
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
        console.warn('chores:', err.message)
        return cache.data || []
      })
  }
  return cache.data || cache.inflight
}

let detectCache = { at: 0, ok: false }
async function detect() {
  if (cache.data) return true
  if (Date.now() - detectCache.at < 60 * 1000) return detectCache.ok
  try {
    const res = await fetch(`${URL}/api/state`, { signal: AbortSignal.timeout(15000) })
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
  setArchived: async () => ({ ok: false, error: 'Mark it done on the card' }),
}
