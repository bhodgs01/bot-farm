/**
 * Harness adapter: Home — Home Assistant, as astronauts on the Home hex.
 *
 * Only things that mean something get a body:
 *   - a person who is home stands on the hex (Blake at his desk is *working*)
 *   - one Doors keeper stands for every door, window, garage and mailbox: the count of
 *     open ones floats by its `!`, and hovering lists which
 *   - motion or a visitor at the front holds a person glyph while it lasts
 *   - every plant stands in the Garden by its planter; one whose soil moisture is below
 *     the threshold slumps with a droplet glyph until it is watered
 * Everything else in the house stays off the map.
 *
 * Read-only: one GET of /api/states per poll.
 * Env: HA_TOKEN (long-lived access token), HA_URL optional, HA_PLANT_DRY (default 50).
 */

const TOKEN = process.env.HA_TOKEN || ''
const HA_URL = process.env.HA_URL || 'http://home-assistant.home-assistant.svc.cluster.local:8123'
const OPEN_URL = process.env.HA_OPEN_URL || 'https://homeassistant.kcproto.com'
const PLANT_DRY = Number(process.env.HA_PLANT_DRY) || 50
const TTL_MS = 15 * 1000
const ZONE = 'Home'
const GARDEN = 'Garden'

/**
 * The doors that count. The house has contact sensors on the washer, dryer and mailbox
 * too, and those are not doors. Override with HA_DOORS as JSON {entity_id: label}.
 */
const DOORS = (() => {
  try {
    if (process.env.HA_DOORS) return JSON.parse(process.env.HA_DOORS)
  } catch {}
  return {
    'binary_sensor.contact_sensor_5': 'Front door',
    'binary_sensor.contact_sensor_6': 'Back door',
    'binary_sensor.contact_sensor_4': 'Door to garage',
    'binary_sensor.contact_sensor': 'Cave door',
    'cover.garage_door_opener_door': 'Garage door',
  }
})()
/** Motion that means somebody is at the house, not somebody walking through the living room. */
const OUTSIDE = /front|door|garage|driveway|porch|yard|gate/i
const VISITOR_CLASSES = new Set(['motion', 'occupancy', 'presence', 'moving'])
const DESK = /at_desk|desk_occupancy/i

function base(entityId, attrs, kind, extra = {}) {
  const now = Date.now()
  const changed = Date.parse(extra.changed || '') || now
  return {
    id: `home:${entityId}`,
    kind,
    title: extra.title || attrs.friendly_name || entityId,
    preview: extra.preview || '',
    project: ZONE,
    projectPath: 'home://house',
    worktree: '',
    cwd: entityId,
    gitBranch: extra.branch || kind,
    model: extra.model || '',
    effort: '',
    createdAt: changed,
    lastActivityAt: changed,
    lastFocusedAt: 0,
    running: Boolean(extra.running),
    unread: false,
    hasError: Boolean(extra.error),
    starred: false,
    routine: '',
    prState: '',
    archived: false,
    hasTranscript: false,
    sizeBytes: extra.sizeBytes || 4000,
    source: 'home-assistant',
    canOpen: true,
    canArchive: false,
    ref: { entityId },
  }
}

/** `Basement corner leak sensor Water Leak Sensor` → `Basement corner`. */
function leakName(attrs, entityId) {
  const raw = String(attrs.friendly_name || entityId.split('.')[1])
  const cleaned = raw.replace(/\s*water leak sensor\s*$/i, '').replace(/\s*leak sensor\s*$/i, '').replace(/\s*water sensor\s*$/i, '').trim()
  return cleaned || raw
}

/** `Front door sensor Contact Sensor` → `Front door`. */
function doorName(attrs, entityId) {
  const raw = String(attrs.friendly_name || entityId.split('.')[1])
  const cleaned = raw
    .replace(/\s*contact sensor\s*$/i, '')
    .replace(/\s*sensor\s*$/i, '')
    .replace(/\s*opener door\s*$/i, '')
    .trim()
  return cleaned || raw.trim() || entityId
}

/** Plants have their soil sensor named after them; the sensor id is the plant's id. */
function plantName(attrs, entityId) {
  return String(attrs.friendly_name || entityId.split('.')[1])
    .replace(/\s*soil moisture\s*$/i, '')
    .replace(/\s*plant\s*-\s*moisture level\s*$/i, '')
    .trim()
}

/** Blake's nap-time toggle, read on every scan. The page darkens the sky while it is on. */
const NAP_ENTITY = process.env.HA_NAP_ENTITY || 'input_boolean.nap_time_toggle'
let napState = false
export const napMode = () => napState
let napCache = { at: 0, inflight: null }
/** The toggle alone, fresh within three seconds: the nap should land on the map in one poll. */
export async function fetchNap() {
  if (Date.now() - napCache.at < 3000) return napState
  if (!napCache.inflight) {
    napCache.inflight = fetch(`${HA_URL}/api/states/${NAP_ENTITY}`, { headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' }, signal: AbortSignal.timeout(4000) })
      .then(async (r) => {
        if (r.ok) napState = (await r.json()).state === 'on'
        napCache = { at: Date.now(), inflight: null }
        return napState
      })
      .catch(() => {
        napCache = { at: Date.now(), inflight: null }
        return napState
      })
  }
  return napCache.inflight
}

async function fetchThreads() {
  const res = await fetch(`${HA_URL}/api/states`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`home-assistant states → ${res.status}`)
  const states = await res.json()
  const out = []
  const seenPlants = new Set()
  const doors = [] // { name, open, changed }
  const leaks = [] // { name, wet, offline, changed }
  const laundry = [] // { name, since }

  for (const s of states) {
    const id = s.entity_id
    const domain = id.split('.')[0]
    const a = s.attributes || {}
    const cls = String(a.device_class || '')
    const changed = s.last_changed

    if (id === NAP_ENTITY) {
      napState = s.state === 'on'
      continue
    }

    if (domain === 'person') {
      if (s.state !== 'home') continue
      const name = a.friendly_name || id.split('.')[1]
      out.push(base(id, a, 'person', { title: `${name}`, preview: `${name} is home`, branch: 'home', changed }))
      continue
    }

    if (DOORS[id]) {
      const state = String(s.state)
      if (domain === 'cover' ? /^(open|closed|opening|closing)$/.test(state) : /^(on|off)$/.test(state)) {
        doors.push({ name: DOORS[id], open: domain === 'cover' ? state !== 'closed' : state === 'on', changed })
      }
      continue
    }
    if (domain === 'binary_sensor' && cls === 'moisture' && /leak|water/i.test(id)) {
      if (s.state === 'on' || s.state === 'off') leaks.push({ name: leakName(a, id), wet: s.state === 'on', changed })
      else leaks.push({ name: leakName(a, id), wet: false, offline: true, changed })
      continue
    }
    if (domain === 'input_boolean' && /^(laundry_sitting|dryer_sitting|washing_machine_is_done)$/.test(id.split('.')[1])) {
      if (s.state === 'on') laundry.push({ name: id.includes('dryer') ? 'Dryer' : 'Washer', since: changed })
      continue
    }

    if (domain === 'binary_sensor') {
      if (s.state !== 'on') continue
      // handled below as a group
      if (DESK.test(id)) {
        out.push(base(id, a, 'person', { title: 'Blake at desk', preview: 'at the desk, working', branch: 'desk', running: true, changed }))
        continue
      }
      if (VISITOR_CLASSES.has(cls) && OUTSIDE.test(id + ' ' + (a.friendly_name || ''))) {
        out.push(base(id, a, 'visitor', { preview: `${a.friendly_name || id}: movement right now`, branch: 'motion', changed }))
        continue
      }
      continue
    }

    if (domain === 'sensor' && cls === 'moisture' && /soil_moisture/i.test(id)) {
      const pct = Number(s.state)
      if (!Number.isFinite(pct)) continue
      const name = plantName(a, id)
      if (seenPlants.has(name.toLowerCase())) continue
      seenPlants.add(name.toLowerCase())
      const dry = pct < PLANT_DRY
      const t = base(id, a, dry ? 'plant' : 'greenery', {
        title: `🌱 ${name}`,
        preview: dry ? `${name} is thirsty · soil ${Math.round(pct)}% (waters at ${PLANT_DRY}%)` : `${name} is fine · soil ${Math.round(pct)}%`,
        branch: `${Math.round(pct)}% soil`,
        model: dry ? 'needs water' : 'watered',
        changed,
        sizeBytes: 1000 * (1 + Math.round(pct) * 20),
      })
      t.project = GARDEN
      t.projectPath = 'home://garden'
      t.landmark = 'planter'
      out.push(t)
    }
  }
  // One keeper for every door in the house. Open ones are counted by the badge and
  // listed on hover; a house with everything shut shows a quiet keeper and no badge.
  if (doors.length) {
    const open = doors.filter((d) => d.open)
    const latest = doors.reduce((m, d) => Math.max(m, Date.parse(d.changed || '') || 0), 0)
    const lines = [
      open.length ? `OPEN: ${open.map((d) => d.name).join(', ')}` : 'Everything is shut',
      `closed: ${doors.filter((d) => !d.open).map((d) => d.name).join(', ') || 'none'}`,
    ]
    const t = base('house.doors', {}, 'doors', {
      title: '🚪 Doors',
      preview: lines.join(String.fromCharCode(10)),
      branch: open.length ? `${open.length} open` : 'all shut',
      model: `${doors.length} sensors`,
      error: open.length > 0,
      changed: latest ? new Date(latest).toISOString() : undefined,
      sizeBytes: 1000 * (1 + doors.length * 30),
    })
    t.count = open.length
    out.push(t)
  }

  // Leaks: one keeper for the three sensors. Red only when one is wet.
  if (leaks.length) {
    const wet = leaks.filter((l) => l.wet)
    const offline = leaks.filter((l) => l.offline)
    const t = base('house.leaks', {}, 'leaks', {
      title: '💧 Leak sensors',
      preview: [
        wet.length ? `WATER: ${wet.map((l) => l.name).join(', ')}` : 'All dry',
        `watching: ${leaks.filter((l) => !l.offline).map((l) => l.name).join(', ') || 'none'}`,
        offline.length ? `offline: ${offline.map((l) => l.name).join(', ')}` : '',
      ].filter(Boolean).join(String.fromCharCode(10)),
      branch: wet.length ? `${wet.length} wet` : 'dry',
      model: `${leaks.length - offline.length} sensors`,
      error: wet.length > 0,
      sizeBytes: 3000,
    })
    t.count = wet.length
    out.push(t)
  }

  // Laundry: the washer or dryer finished and nobody came. The automations flip a boolean.
  if (laundry.length) {
    const since = laundry.map((l) => Date.parse(l.since || '') || 0).filter(Boolean)
    const oldest = since.length ? Math.min(...since) : Date.now()
    const hrs = Math.max(1, Math.round((Date.now() - oldest) / 3600000))
    const t = base('house.laundry', {}, 'laundry', {
      title: '🧺 Laundry',
      preview: laundry.map((l) => `${l.name} has been sitting for ${Math.max(1, Math.round((Date.now() - (Date.parse(l.since || '') || Date.now())) / 3600000))}h`).join(String.fromCharCode(10)),
      branch: `${laundry.map((l) => l.name.toLowerCase()).join(' + ')} sitting`,
      model: `${hrs}h`,
      changed: new Date(oldest).toISOString(),
      sizeBytes: 3000,
    })
    t.unread = true
    t.count = laundry.length
    out.push(t)
  } else {
    // The keeper is always there; he only raises a hand when something is sitting.
    out.push(base('house.laundry', {}, 'laundry', { title: '🧺 Laundry', preview: 'Nothing sitting in the washer or dryer', branch: 'clear', model: 'washer + dryer', sizeBytes: 3000 }))
  }

  // The greenhouse itself: the Garden's landmark, kept by a gardener who reports the count.
  const plants = out.filter((t) => t.project === GARDEN)
  const thirsty = plants.filter((t) => t.kind === 'plant').length
  if (plants.length) {
    const g = base('garden.greenhouse', {}, 'person', {
      title: '🌻 Greenhouse',
      preview: thirsty ? `${plants.length} plants · ${thirsty} need water` : `${plants.length} plants · all watered`,
      branch: 'greenhouse',
      running: false,
    })
    g.project = GARDEN
    g.projectPath = 'home://garden'
    g.landmark = 'greenhouse'
    g.createdAt = 0
    g.lastActivityAt = Date.now()
    out.push(g)
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
        console.warn('home:', err.message)
        return cache.data || []
      })
  }
  return cache.data || cache.inflight
}

export default {
  id: 'home',
  name: 'Home',
  detect: async () => Boolean(TOKEN),
  scanThreads,
  openThread: (ref) => ({ ok: true, browser: true, url: `${OPEN_URL}/history?entity_id=${encodeURIComponent(ref?.entityId || '')}` }),
  newSession: () => ({ ok: false, error: 'The house runs itself' }),
  setArchived: async () => ({ ok: false, error: 'Close the door, water the plant; it walks home on its own' }),
}
