/**
 * Acknowledged flags.
 *
 * Blake can remove a `!` he already knows about. The ack is pinned to a fingerprint of the
 * failure (`alertKey`: the failed backup's name, the pods that are down, the error text),
 * so it silences that failure and nothing else. The next scan that reports a different
 * failure for the same worker drops the ack and the flag comes back on its own.
 *
 * Stored in DATA_DIR/acks.json so it survives a restart. One writer: this module.
 */
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.BOT_CROSSING_DATA || path.join(here, '..', 'data')
const FILE = path.join(DATA_DIR, 'acks.json')

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
  let dirty = false
  for (const t of threads) {
    const ack = map[t.id]
    if (!ack) continue
    if (!t.hasError) continue // nothing to silence; keep the ack in case it comes back the same
    if (alertKeyOf(t) === ack.key) {
      t.hasError = false
      t.acked = true
      t.ackedAt = ack.at
    } else {
      delete map[t.id]
      dirty = true
    }
  }
  if (dirty) await save().catch(() => {})
  return threads
}

export async function ack(thread, who) {
  const map = await load()
  map[thread.id] = { key: alertKeyOf(thread), at: Date.now(), who }
  await save()
  return map[thread.id]
}

export async function unack(id) {
  const map = await load()
  if (map[id]) {
    delete map[id]
    await save()
  }
}
