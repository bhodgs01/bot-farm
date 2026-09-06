/**
 * Harness adapter: domain renewals — one keeper on the Countdown hex who knows when every
 * domain expires, read from the public RDAP record rather than a hand-typed file.
 *
 * The count over the keeper's head is how many domains expire inside 60 days; a hand goes
 * up inside 30, because that is when a lapsed auto-renew card actually bites.
 *
 * Read-only: one RDAP GET per domain, twice a day. Env: DOMAINS = comma-separated list.
 */

const ZONE = 'Countdown'
const BORN = Date.parse('2026-09-06T12:00:00Z')
const NL = String.fromCharCode(10)
const TTL_MS = 12 * 60 * 60 * 1000
const DAY = 86400000
const DOMAINS = String(process.env.DOMAINS || 'kcproto.com,ngvtalent.com,cyber-grade.com,frances.care')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)
const fmtDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' })

async function expiry(domain) {
  const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, { headers: { Accept: 'application/rdap+json, application/json' }, redirect: 'follow', signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`rdap ${domain} → ${res.status}`)
  const json = await res.json()
  const ev = (json.events || []).find((e) => e.eventAction === 'expiration')
  const registrar = (json.entities || []).find((e) => (e.roles || []).includes('registrar'))
  const name = registrar?.vcardArray?.[1]?.find((v) => v[0] === 'fn')?.[3] || ''
  return { domain, expires: ev ? Date.parse(ev.eventDate) : 0, registrar: name, status: (json.status || []).join(', ') }
}

async function fetchThreads() {
  const now = Date.now()
  const rows = await Promise.all(DOMAINS.map((d) => expiry(d).catch((e) => (console.warn('domains:', e.message), { domain: d, expires: 0, registrar: '', status: 'lookup failed' }))))
  rows.sort((a, b) => (a.expires || Infinity) - (b.expires || Infinity))
  const days = (r) => (r.expires ? Math.floor((r.expires - now) / DAY) : null)
  const soon = rows.filter((r) => days(r) != null && days(r) <= 60)
  const urgent = rows.filter((r) => days(r) != null && days(r) <= 30)
  const first = rows.find((r) => r.expires)
  const line = (r) => `${r.domain}: ${r.expires ? `${fmtDate.format(new Date(r.expires))} (${days(r)}d)` : r.status || 'unknown'}${r.registrar ? ` · ${r.registrar}` : ''}`
  return [
    {
      id: 'domains:keeper',
      kind: 'keeper',
      title: '🌐 Domains',
      plate: soon.length ? `${soon.length} soon` : '',
      preview: urgent.length ? `Renew: ${urgent.map(line).join('; ')}` : first ? `Next up ${line(first)}` : 'No domains answered',
      details: { ...Object.fromEntries(rows.map((r) => [r.domain, line(r).replace(`${r.domain}: `, '')])), Rule: 'Hand up inside 30 days, counted inside 60. Read from RDAP.' },
      project: ZONE,
      projectPath: 'domains://rdap',
      worktree: '',
      cwd: `${rows.length} domains`,
      gitBranch: first ? `${days(first)}d` : '',
      model: '',
      effort: '',
      createdAt: BORN,
      lastActivityAt: now,
      lastFocusedAt: 0,
      running: false,
      unread: false,
      hasError: urgent.length > 0,
      alertKey: urgent.length ? `domains:${urgent.map((r) => r.domain).join(',')}` : '',
      starred: false,
      routine: '',
      prState: '',
      archived: false,
      hasTranscript: false,
      sizeBytes: 1500,
      source: 'rdap',
      canOpen: true,
      canArchive: false,
      ref: { url: 'https://dash.cloudflare.com/' },
    },
  ]
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
        console.warn('domains:', err.message)
        return cache.data || []
      })
  }
  return cache.data || cache.inflight
}

export default {
  id: 'domains',
  name: 'Domain renewals',
  detect: async () => DOMAINS.length > 0,
  scanThreads,
  openThread: (ref) => ({ ok: true, browser: true, url: ref?.url || 'https://dash.cloudflare.com/' }),
  newSession: () => ({ ok: false, error: 'Register domains at the registrar' }),
  setArchived: async () => ({ ok: false, error: 'The keeper stays' }),
}
