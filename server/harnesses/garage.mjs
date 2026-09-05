/**
 * Harness adapter: the garage — Blake's FJ40 on the lift, and what is open on it.
 *
 * The list lives in server/garage.json (or GARAGE_FILE on the data volume): each open item
 * is a worker with the note on hover; `flag: true` is a hand up. The truck itself is the
 * landmark. FJ40 tasks in Vikunja route here too through tasks.mjs.
 */
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const FILE = process.env.GARAGE_FILE || path.join(here, '..', 'garage.json')
const ZONE = 'Garage'
const TTL_MS = 60 * 1000
const BORN = Date.parse('2026-09-05T12:00:00Z')
const NL = String.fromCharCode(10)

async function fetchThreads() {
  const doc = JSON.parse(await fsp.readFile(FILE, 'utf8'))
  const items = Array.isArray(doc.items) ? doc.items : []
  const now = Date.now()
  const flagged = items.filter((i) => i.flag)
  const base = {
    project: ZONE,
    projectPath: 'garage://fj40',
    worktree: '',
    effort: '',
    lastFocusedAt: 0,
    running: false,
    hasError: false,
    starred: false,
    routine: '',
    prState: '',
    archived: false,
    hasTranscript: false,
    source: 'garage',
    canOpen: false,
    canArchive: false,
  }
  const out = [
    {
      ...base,
      id: 'garage:fj40',
      kind: 'keeper',
      landmark: 'garage',
      title: '🚙 FJ40',
      roof: flagged.length ? `${flagged.length} open` : 'running',
      preview: [doc.status || '', ...items.map((i) => `• ${i.title}`)].filter(Boolean).join(NL),
      details: { Truck: doc.vehicle || '', Status: doc.status || '', Open: items.map((i) => i.title).join(', '), Edit: FILE },
      cwd: 'garage',
      gitBranch: doc.status ? doc.status.split('.')[0] : '',
      model: '2F',
      createdAt: BORN,
      lastActivityAt: now,
      unread: false,
      sizeBytes: 3000,
      ref: {},
    },
  ]
  items.forEach((it, i) => {
    out.push({
      ...base,
      id: `garage:${it.id || i}`,
      kind: 'item',
      title: `🔧 ${it.title}`,
      preview: it.note || '',
      details: { Item: it.title, Notes: it.note || '', Priority: it.flag ? 'needs a decision or a call' : 'when you get to it' },
      cwd: 'garage',
      gitBranch: it.flag ? 'open' : 'noted',
      model: '',
      createdAt: BORN + 1 + i,
      lastActivityAt: now,
      unread: Boolean(it.flag),
      sizeBytes: 1200,
      exit: 'beam',
      ref: { id: it.id },
    })
  })
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
        console.warn('garage:', err.message)
        return cache.data || []
      })
  }
  return cache.data || cache.inflight
}

export default {
  id: 'garage',
  name: 'Garage',
  detect: async () => true,
  scanThreads,
  openThread: () => ({ ok: false, error: `Edit ${FILE}` }),
  newSession: () => ({ ok: false, error: `Add an item to ${FILE}` }),
  setArchived: async () => ({ ok: false, error: `Remove it from ${FILE}` }),
}
