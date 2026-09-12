/**
 * Harness adapter: Embassy DOT compliance — the roster gaps that stop the app doing its job.
 *
 * The inspection app is live and texting crews every morning. What is still owed is roster
 * data: units filing inspections that are not on the truck list, crew leads with no phone to
 * text, divisions with no manager to escalate to, and supervisors the importer could not
 * resolve. Those are Blake's to chase with the fleet manager, so they stand on the Embassy
 * hex as one keeper with the figures on its card.
 *
 * It never raises a hand. Blake's call: worth knowing, not worth interrupting a day over.
 * The figures live on the card and the headline sits under the keeper's name, so the state
 * of the roster is one click away and never in the Needs-you queue.
 *
 * Read-only: GET /api/compliance/daily, /api/unmatched-units, /api/crew-leads,
 * /api/divisions, /api/supervisors/unresolved, /api/queue.
 */

const BASE = (process.env.DOT_URL || 'http://dot-app.dot-app.svc.cluster.local:8070').replace(/\/$/, '')
const OPEN_URL = (process.env.DOT_OPEN_URL || 'https://dot.kcproto.com').replace(/\/$/, '')
const ZONE = 'Embassy Landscape'
const TTL_MS = 5 * 60 * 1000
const BORN = Date.parse('2026-09-12T06:00:01Z')
/** A stranger unit is worth asking about while it is still filing; after this it is history. */
const FRESH_DAYS = Number(process.env.DOT_FRESH_DAYS || 7)
const NL = String.fromCharCode(10)

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`dot ${path} → ${res.status}`)
  return res.json()
}

/** Every call is optional: one dead endpoint costs that line on the card, not the keeper. */
const soft = (p, fallback) => getJson(p).catch(() => fallback)

const daysAgo = (iso) => {
  const t = Date.parse(iso || '')
  return Number.isFinite(t) ? (Date.now() - t) / 86400000 : Infinity
}

const count = (n, one, many) => `${n} ${n === 1 ? one : many}`

async function fetchThreads() {
  const now = Date.now()
  const [compliance, unmatched, crewLeads, divisions, supervisors, queue] = await Promise.all([
    soft('/api/compliance/daily', { days: [] }),
    soft('/api/unmatched-units', { unmatched: [] }),
    soft('/api/crew-leads', { crew_leads: [] }),
    soft('/api/divisions', { divisions: [] }),
    soft('/api/supervisors/unresolved', { unresolved: [] }),
    soft('/api/queue', { queue: [] }),
  ])

  const days = Array.isArray(compliance.days) ? compliance.days : []
  const today = days[0] || null
  const strangers = (Array.isArray(unmatched.unmatched) ? unmatched.unmatched : []).filter((u) => !u.resolved_truck_id)
  const freshStrangers = strangers.filter((u) => daysAgo(u.last_seen) <= FRESH_DAYS)
  const leads = Array.isArray(crewLeads.crew_leads) ? crewLeads.crew_leads : Array.isArray(crewLeads) ? crewLeads : []
  const noPhone = leads.filter((c) => !c.has_phone)
  const divs = Array.isArray(divisions.divisions) ? divisions.divisions : []
  const noManager = divs.filter((d) => !d.division_manager_email)
  const unresolvedSups = Array.isArray(supervisors.unresolved) ? supervisors.unresolved : []
  const pending = Array.isArray(queue.queue) ? queue.queue : []
  const waitingDates = pending.map((q) => q.business_date).filter(Boolean).sort()

  const badToday = today ? (today.violation || 0) + (today.out_of_service || 0) : 0

  // The headline is whichever thing is actually wrong today; otherwise the compliance figure.
  const headline = badToday
    ? `${count(badToday, 'truck', 'trucks')} out of compliance on ${today.business_date}`
    : freshStrangers.length
      ? `${count(freshStrangers.length, 'unit', 'units')} filing under a number the roster does not know`
      : today
        ? `${today.compliance_pct}% compliant on ${today.business_date}, ${count(today.open_items || 0, 'item', 'items')} still open`
        : 'no inspection day loaded yet'

  const keeper = {
    id: 'dot:gaps',
    kind: 'keeper',
    title: '🚚 DOT compliance',
    plate: today ? `${today.compliance_pct}%` : '',
    preview: headline,
    details: {
      Today: today
        ? `${today.business_date}: ${today.compliant} compliant, ${today.violation} violation${today.violation === 1 ? '' : 's'}, ${today.out_of_service} out of service, ${today.open_items} open`
        : 'no day loaded',
      'Unknown units': strangers.length
        ? strangers
            .map((u) => `• ${u.raw_value} — ${count(u.hit_count || 0, 'filing', 'filings')}, last ${String(u.last_seen || '').slice(0, 10)}`)
            .join(NL)
        : 'none',
      'Crew leads with no phone': noPhone.length ? `${noPhone.length} of ${leads.length} — the morning text cannot reach them` : 'none',
      'Divisions with no manager email': noManager.length ? `${noManager.length} of ${divs.length}: ${noManager.map((d) => d.name).join(', ')}` : 'none',
      'Supervisors unresolved': unresolvedSups.length ? `${unresolvedSups.length} crew leads the importer could not place` : 'none',
      'Texts awaiting a reply': pending.length ? `${pending.length}${waitingDates.length ? `, oldest ${waitingDates[0]}` : ''}` : 'none',
      Trend: days
        .slice(0, 7)
        .map((d) => `${d.business_date}: ${d.compliance_pct}% (${d.compliant} in, ${d.open_items} open)`)
        .join(NL),
      Owed: 'Crew lead phone numbers, division manager emails, and why 399 and 367 file while marked exempt.',
    },
    project: ZONE,
    projectPath: 'dot://compliance',
    worktree: '',
    cwd: 'dot-app',
    gitBranch: badToday ? `${badToday} out of compliance` : freshStrangers.length ? `${freshStrangers.length} unknown units` : today ? `${today.compliance_pct}%` : 'no data',
    model: '',
    effort: '',
    createdAt: BORN,
    lastActivityAt: now,
    lastFocusedAt: 0,
    running: false,
    // Never flags, by Blake's instruction. Everything it knows is on the card.
    unread: false,
    hasError: false,
    alertKey: '',
    starred: false,
    routine: '',
    prState: '',
    archived: false,
    hasTranscript: false,
    sizeBytes: 5000,
    source: 'dot-app',
    canOpen: true,
    canArchive: false,
    ref: { url: OPEN_URL },
  }

  return [keeper]
}

let cache = { at: 0, data: null, inflight: null }
async function scanThreads() {
  if (cache.data && Date.now() - cache.at < TTL_MS) return cache.data
  if (!cache.inflight) {
    cache.inflight = fetchThreads()
      .then((data) => {
        cache = { at: Date.now(), data, inflight: null }
        return data
      })
      .catch((err) => {
        cache.inflight = null
        console.warn('dot:', err.message)
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
    const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(8000) })
    detectCache = { at: Date.now(), ok: res.ok }
  } catch {
    detectCache = { at: Date.now(), ok: false }
  }
  return detectCache.ok
}

export default {
  id: 'dot',
  name: 'DOT compliance',
  detect,
  scanThreads,
  openThread: (ref) => ({ ok: true, browser: true, url: ref?.url || OPEN_URL }),
  newSession: () => ({ ok: false, error: 'The app files these itself' }),
  setArchived: async () => ({ ok: false, error: 'Fix the roster in the DOT app' }),
}
