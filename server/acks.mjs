/**
 * Acknowledged flags.
 *
 * Blake can remove a `!` he already knows about, and it stays removed for good: a dismissal is
 * a permanent mute on that worker, so a flapping CronJob that keeps rewording its error can't
 * un-mute itself. It comes back only when Blake flags it again (unack). The `alertKey` a mute
 * records is kept for reference, not for matching.
 *
 * Stored in DATA_DIR/acks.json so it survives a restart. One writer: this module.
 */
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.BOT_CROSSING_DATA || path.join(here, '..', 'data')
const FILE = path.join(DATA_DIR, 'acks.json')
const STARS = path.join(DATA_DIR, 'stars.json')

let acks = null // id → { key, at, who }

async function load() {
  if (acks) return acks
  try {
    const raw = JSON.parse(await fsp.readFile(FILE, 'utf8'))
    acks = raw && typeof raw === 'object' ? raw : {}
  } catch {
    acks = {}
  }
  return acks
}

async function save() {
  await fsp.mkdir(DATA_DIR, { recursive: true })
  const tmp = FILE + '.tmp'
  await fsp.writeFile(tmp, JSON.stringify(acks, null, 2))
  await fsp.rename(tmp, FILE)
}

/** What, precisely, is being flagged right now. */
export const alertKeyOf = (t) => String(t.alertKey || t.preview || '').slice(0, 400)

/**
 * Fold acknowledgements into a scan. A matching ack clears the flag and marks the thread
 * `acked`; a stale ack (the failure changed) is forgotten and the flag stands.
 */
export async function applyAcks(threads) {
  const map = await load()
  for (const t of threads) {
    const ack = map[t.id]
    if (!ack) continue
    if (!t.hasError) continue // nothing to silence right now; the mute waits for it to return
    // A dismissal is a permanent mute: it silences this worker no matter how its failure text
    // changes over time (a flapping CronJob like Rusty reworded its error and used to un-mute
    // itself). Only Blake's "Flag again" (unack) brings the flag back.
    t.hasError = false
    t.acked = true
    t.ackedAt = ack.at
  }
  return threads
}

export async function ack(thread, who) {
  const map = await load()
  map[thread.id] = { key: alertKeyOf(thread), at: Date.now(), who }
  await save()
  return map[thread.id]
}

// ── stars: keep an eye on something that is not flagged ─────────────────────────────
let stars = null // id → { at, who }
async function loadStars() {
  if (stars) return stars
  try {
    const raw = JSON.parse(await fsp.readFile(STARS, 'utf8'))
    stars = raw && typeof raw === 'object' ? raw : {}
  } catch {
    stars = {}
  }
  return stars
}
async function saveStars() {
  await fsp.mkdir(DATA_DIR, { recursive: true })
  const tmp = STARS + '.tmp'
  await fsp.writeFile(tmp, JSON.stringify(stars, null, 2))
  await fsp.rename(tmp, STARS)
}
export async function applyStars(threads) {
  const map = await loadStars()
  for (const t of threads) if (map[t.id]) t.watched = true
  return threads
}
export async function setStar(id, on, who) {
  const map = await loadStars()
  if (on) map[id] = { at: Date.now(), who }
  else delete map[id]
  await saveStars()
  return Boolean(map[id])
}

export async function unack(id) {
  const map = await load()
  if (map[id]) {
    delete map[id]
    await save()
  }
}
