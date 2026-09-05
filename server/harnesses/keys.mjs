/**
 * Harness adapter: keys and spend — two workers on the Watchdog hex.
 *
 * Keys: every Anthropic key wired into a cluster secret is probed against the API once a
 * night (GET /v1/models). A dead one is a hand up with the namespace and secret named; the
 * value itself never leaves this process, not even a fingerprint beyond the first eight
 * characters after the prefix. Doctrine: one key per app, named for the app, so a dead key
 * gets replaced, never collapsed onto a shared one.
 *
 * Spend: today's API cost from the Admin usage report, per key, the same maths as the /$
 * skill. The dollar figure floats over his head; a day past SPEND_ALERT_USD raises a hand.
 *
 * Needs: a ServiceAccount that may list secrets, and ANTHROPIC_ADMIN_KEY for the report.
 */
import fsp from 'node:fs/promises'

const ZONE = 'Watchdog'
const KUBE_API = process.env.KUBERNETES_SERVICE_HOST ? `https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT || 443}` : ''
const ADMIN_KEY = process.env.ANTHROPIC_ADMIN_KEY || ''
const SPEND_ALERT = Number(process.env.SPEND_ALERT_USD || 25)
const KEYS_TTL_MS = 6 * 60 * 60 * 1000
const SPEND_TTL_MS = 10 * 60 * 1000
const BORN = Date.parse('2026-09-05T12:00:00Z')
const NL = String.fromCharCode(10)

// Per-model pricing, dollars per million tokens: [input, output, cache write, cache read].
// Mirrors the /$ skill; unknown models fall back to Sonnet-class pricing.
const PRICE = [
  [/opus/i, [15, 75, 18.75, 1.5]],
  [/sonnet/i, [3, 15, 3.75, 0.3]],
  [/haiku/i, [0.8, 4, 1, 0.08]],
]
const priceFor = (model) => (PRICE.find(([re]) => re.test(model || '')) || [null, [3, 15, 3.75, 0.3]])[1]

async function saToken() {
  try {
    return (await fsp.readFile('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf8')).trim()
  } catch {
    return ''
  }
}

// ── keys ────────────────────────────────────────────────────────────────────────────────
let keysCache = { at: 0, data: null, inflight: null }

async function auditKeys() {
  const token = await saToken()
  if (!token || !KUBE_API) throw new Error('no service account')
  const res = await fetch(`${KUBE_API}/api/v1/secrets?limit=2000`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`secrets list → ${res.status}`)
  const list = await res.json()
  // secret → the Anthropic keys it carries (values decoded in memory only)
  const holders = new Map() // key value → [ns/name]
  for (const s of list.items || []) {
    for (const [field, b64] of Object.entries(s.data || {})) {
      let v = ''
      try {
        v = Buffer.from(b64, 'base64').toString('utf8').trim()
      } catch {
        continue
      }
      // a key may sit inside an env-file style value
      const found = v.match(/sk-ant-api03-[A-Za-z0-9_-]{20,}/g) || []
      for (const k of found) {
        if (!holders.has(k)) holders.set(k, [])
        holders.get(k).push(`${s.metadata.namespace}/${s.metadata.name}:${field}`)
      }
    }
  }
  const results = []
  for (const [k, where] of holders) {
    let status = 'unknown'
    try {
      const r = await fetch('https://api.anthropic.com/v1/models?limit=1', { headers: { 'x-api-key': k, 'anthropic-version': '2023-06-01' }, signal: AbortSignal.timeout(15000) })
      status = r.status === 200 ? 'live' : r.status === 401 || r.status === 403 ? 'dead' : `http ${r.status}`
    } catch (err) {
      status = `error: ${err.message}`
    }
    results.push({ tag: `${k.slice(0, 12)}…${k.slice(-4)}`, status, where })
  }
  return { at: Date.now(), results }
}

async function keysSnapshot() {
  if (keysCache.data && Date.now() - keysCache.at < KEYS_TTL_MS) return keysCache.data
  if (!keysCache.inflight) {
    keysCache.inflight = auditKeys()
      .then((d) => {
        keysCache = { at: Date.now(), data: d, inflight: null }
        return d
      })
      .catch((err) => {
        keysCache.inflight = null
        console.warn('keys:', err.message)
        return keysCache.data || { at: 0, results: [], error: err.message }
      })
  }
  return keysCache.data || keysCache.inflight
}

// ── spend ───────────────────────────────────────────────────────────────────────────────
let spendCache = { at: 0, data: null, inflight: null }
let keyNames = { at: 0, map: new Map() }

async function adminGet(path, params) {
  const url = new URL(`https://api.anthropic.com/v1/organizations${path}`)
  for (const [k, v] of Object.entries(params || {})) {
    if (Array.isArray(v)) for (const x of v) url.searchParams.append(k, x)
    else url.searchParams.set(k, v)
  }
  const out = []
  let page = null
  for (let i = 0; i < 10; i++) {
    if (page) url.searchParams.set('page', page)
    const r = await fetch(url, { headers: { 'x-api-key': ADMIN_KEY, 'anthropic-version': '2023-06-01' }, signal: AbortSignal.timeout(20000) })
    if (!r.ok) throw new Error(`admin ${path} → ${r.status}`)
    const j = await r.json()
    out.push(...(j.data || []))
    if (!j.has_more || !j.next_page) break
    page = j.next_page
  }
  return out
}

async function namesForKeys() {
  if (Date.now() - keyNames.at < 6 * 60 * 60 * 1000) return keyNames.map
  try {
    const list = await adminGet('/api_keys', { limit: 100 })
    keyNames = { at: Date.now(), map: new Map(list.map((k) => [k.id, { name: k.name, status: k.status }])) }
  } catch (err) {
    console.warn('keys: names', err.message)
  }
  return keyNames.map
}

function kcMidnightUtc() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(new Date())
  const get = (t) => Number(parts.find((p) => p.type === t)?.value)
  // the offset between KC local and UTC right now, applied to local midnight
  const nowUtc = Date.now()
  const localHour = get('hour') % 24
  const minutes = new Date().getUTCMinutes()
  const sinceMidnight = localHour * 3600000 + minutes * 60000 + new Date().getUTCSeconds() * 1000
  return new Date(nowUtc - sinceMidnight)
}

async function spendToday() {
  if (!ADMIN_KEY) throw new Error('no admin key')
  const start = kcMidnightUtc()
  // Hour buckets from Kansas City midnight: a day bucket has to start at UTC midnight, which
  // is 7 pm here, and would count last evening as today.
  start.setUTCMinutes(0, 0, 0)
  const buckets = await adminGet('/usage_report/messages', {
    starting_at: start.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    bucket_width: '1h',
    'group_by[]': ['api_key_id', 'model'],
    limit: 48,
  })
  const names = await namesForKeys()
  const byKey = new Map()
  let total = 0
  for (const b of buckets) {
    for (const r of b.results || []) {
      const [pi, po, pw, pr] = priceFor(r.model)
      const cache = r.cache_creation || {}
      const dollars =
        ((Number(r.uncached_input_tokens) || 0) * pi +
          (Number(r.output_tokens) || 0) * po +
          ((Number(cache.ephemeral_5m_input_tokens) || 0) + (Number(cache.ephemeral_1h_input_tokens) || 0)) * pw +
          (Number(r.cache_read_input_tokens) || 0) * pr) /
        1e6
      const id = r.api_key_id || '(no key)'
      byKey.set(id, (byKey.get(id) || 0) + dollars)
      total += dollars
    }
  }
  const rows = [...byKey.entries()].sort((a, b) => b[1] - a[1]).map(([id, d]) => ({ name: names.get(id)?.name || id, dollars: d }))
  return { at: Date.now(), total, rows }
}

async function spendSnapshot() {
  if (spendCache.data && Date.now() - spendCache.at < SPEND_TTL_MS) return spendCache.data
  if (!spendCache.inflight) {
    spendCache.inflight = spendToday()
      .then((d) => {
        spendCache = { at: Date.now(), data: d, inflight: null }
        return d
      })
      .catch((err) => {
        spendCache.inflight = null
        console.warn('spend:', err.message)
        return spendCache.data || { at: 0, total: NaN, rows: [], error: err.message }
      })
  }
  return spendCache.data || spendCache.inflight
}

// ── threads ─────────────────────────────────────────────────────────────────────────────
const base = {
  project: ZONE,
  projectPath: 'watchdog://keys',
  worktree: '',
  effort: '',
  lastFocusedAt: 0,
  running: false,
  unread: false,
  starred: false,
  routine: '',
  prState: '',
  archived: false,
  hasTranscript: false,
  canOpen: true,
  canArchive: false,
}
const money = (d) => (Number.isFinite(d) ? `$${d.toFixed(d >= 100 ? 0 : 2)}` : '—')

async function fetchThreads() {
  const now = Date.now()
  const [keys, spend] = await Promise.all([keysSnapshot(), spendSnapshot()])
  const dead = keys.results.filter((r) => r.status === 'dead')
  const odd = keys.results.filter((r) => !/^(live|dead)$/.test(r.status))
  const out = []

  out.push({
    ...base,
    id: 'keys:audit',
    kind: 'keeper',
    landmark: 'keyrack',
    title: '🔑 Keys',
    count: dead.length,
    roof: keys.results.length ? `${keys.results.length - dead.length}/${keys.results.length} live` : keys.error ? 'no access' : 'checking',
    preview: dead.length
      ? `${dead.length} dead key${dead.length > 1 ? 's' : ''}:${NL}${dead.map((d) => `• ${d.tag} in ${d.where.join(', ')}`).join(NL)}`
      : keys.error
        ? `Cannot audit: ${keys.error}`
        : `${keys.results.length} Anthropic keys in cluster secrets, all live`,
    details: {
      Live: String(keys.results.filter((r) => r.status === 'live').length),
      Dead: dead.length ? dead.map((d) => `${d.tag}: ${d.where.join(', ')}`).join(NL) : 'none',
      Unclear: odd.length ? odd.map((d) => `${d.tag}: ${d.status}`).join(NL) : '',
      Checked: keys.at ? new Date(keys.at).toLocaleString('en-US', { timeZone: 'America/Chicago' }) : 'not yet',
      Rule: 'One key per app, named for the app. Replace a dead one at console.anthropic.com; never share one across apps.',
    },
    cwd: 'anthropic',
    gitBranch: dead.length ? `${dead.length} dead` : keys.results.length ? 'all live' : '',
    model: '',
    createdAt: BORN,
    lastActivityAt: keys.at || now,
    hasError: dead.length > 0 || Boolean(keys.error),
    alertKey: dead.length ? `dead:${dead.map((d) => d.tag).sort().join(',')}` : keys.error ? `err:${keys.error}` : '',
    sizeBytes: 1000 * (1 + keys.results.length),
    source: 'anthropic-keys',
    ref: { url: 'https://console.anthropic.com/settings/keys' },
  })

  const total = spend.total
  out.push({
    ...base,
    id: 'keys:spend',
    kind: 'meter',
    landmark: 'meter',
    title: '💸 Spend today',
    plate: Number.isFinite(total) ? money(total) : '',
    roof: '',
    preview: Number.isFinite(total)
      ? `${money(total)} so far today${spend.rows.length ? `${NL}${spend.rows.slice(0, 5).map((r) => `• ${r.name}: ${money(r.dollars)}`).join(NL)}` : ''}`
      : `No spend figure: ${spend.error || 'no admin key'}`,
    details: {
      Today: money(total),
      Threshold: money(SPEND_ALERT),
      'By key': spend.rows.slice(0, 10).map((r) => `${r.name}: ${money(r.dollars)}`).join(NL),
      Updated: spend.at ? new Date(spend.at).toLocaleTimeString('en-US', { timeZone: 'America/Chicago' }) : '',
    },
    cwd: 'anthropic',
    gitBranch: Number.isFinite(total) ? (total > SPEND_ALERT ? 'over budget' : 'on budget') : 'no data',
    model: '',
    createdAt: BORN + 1,
    lastActivityAt: spend.at || now,
    hasError: Number.isFinite(total) ? total > SPEND_ALERT : Boolean(spend.error),
    alertKey: Number.isFinite(total) && total > SPEND_ALERT ? `over:${new Date().toISOString().slice(0, 10)}` : spend.error ? `err:${spend.error}` : '',
    sizeBytes: 3000,
    source: 'anthropic-admin',
    ref: { url: 'https://console.anthropic.com/settings/usage' },
  })
  return out
}

let cache = { at: 0, data: null, inflight: null }
async function scanThreads() {
  const age = Date.now() - cache.at
  if (cache.data && age < 60 * 1000) return cache.data
  if (!cache.inflight) {
    cache.inflight = fetchThreads()
      .then((data) => {
        cache = { at: Date.now(), data, inflight: null }
        return data
      })
      .catch((err) => {
        cache.inflight = null
        console.warn('keys:', err.message)
        return cache.data || []
      })
  }
  return cache.data || cache.inflight
}

export default {
  id: 'keys',
  name: 'Keys and spend',
  detect: async () => true,
  scanThreads,
  openThread: (ref) => ({ ok: true, browser: true, url: ref?.url || 'https://console.anthropic.com/' }),
  newSession: () => ({ ok: false, error: 'Keys are made at console.anthropic.com' }),
  setArchived: async () => ({ ok: false, error: 'These two stay on watch' }),
}
