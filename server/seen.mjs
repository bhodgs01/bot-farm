/**
 * "I have read this."
 *
 * Some sources can tell you a message arrived but not that Blake read it. Dada chat is the
 * one that started this: it reports `unread` when the last word in the thread is Ema's, so
 * her heart came back on every refresh until Blake typed a reply, even when he had read
 * every message. Reading is not replying.
 *
 * So the colony keeps its own mark: the stamp of the newest thing Blake has seen on a
 * worker. Anything at or below that stamp is read; anything newer raises the hand again.
 * That means a fresh message from Ema still reaches him, and a message he has already read
 * stays quiet.
 *
 * Stored in DATA_DIR/seen.json. One writer: this module.
 */
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.BOT_CROSSING_DATA || path.join(here, '..', 'data')
const FILE = path.join(DATA_DIR, 'seen.json')

let seen = null // id → { stamp, at, who }

async function load() {
  if (seen) return seen
  try {
    const raw = JSON.parse(await fsp.readFile(FILE, 'utf8'))
    seen = raw && typeof raw === 'object' ? raw : {}
  } catch {
    seen = {}
  }
  return seen
}

async function save() {
  await fsp.mkdir(DATA_DIR, { recursive: true })
  const tmp = FILE + '.tmp'
  await fsp.writeFile(tmp, JSON.stringify(seen, null, 2))
  await fsp.rename(tmp, FILE)
}

/** The newest stamp Blake has marked read on this worker, or 0 if he never has. */
export async function seenStamp(id) {
  const map = await load()
  return Number(map[id]?.stamp) || 0
}

/**
 * Mark everything up to `stamp` read. The stamp only ever moves forward, so a scan that
 * arrives with an older message can never quietly un-read what he has already cleared.
 */
export async function markSeen(id, stamp, who) {
  const map = await load()
  const next = Number(stamp) || Date.now()
  if (next <= (Number(map[id]?.stamp) || 0)) return map[id]
  map[id] = { stamp: next, at: Date.now(), who }
  await save()
  return map[id]
}

/**
 * Fold the marks into a scan as a safety net: a thread that says what its newest stamp is
 * (`seenStamp`) and is not carrying a failure goes quiet once Blake has read that far.
 * Harnesses that compute this themselves are unaffected — the result is the same.
 */
export async function applySeen(threads) {
  const map = await load()
  for (const t of threads) {
    const mark = map[t.id]
    if (!mark || !t.unread || t.hasError) continue
    if (Number(t.seenStamp) && Number(t.seenStamp) <= Number(mark.stamp)) {
      t.unread = false
      t.wasRead = true
    }
  }
  return threads
}
