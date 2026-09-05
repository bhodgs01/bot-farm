/**
 * Harness adapter: the Mailroom — unread inbound mail as astronauts.
 *
 * Every message sitting in the business inbox (blake@kcproto.com, read through Janine's
 * Gmail OAuth) is one astronaut. It walks out of the ship to the client hex its sender
 * belongs to. Unread mail holds a mail glyph; read mail just stands there, and after three
 * days it sits down and sleeps. Archive it out of the inbox and it walks home. A message carrying a printable model file
 * is a print request instead: same walk, printer glyph, Print Service hex.
 *
 * Read-only. The adapter never modifies, labels or sends anything.
 *
 * Env: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN (the same three Janine
 * uses). Without them `detect()` is false and the mailroom simply is not on the map.
 */

const CLIENT_ID = process.env.GMAIL_CLIENT_ID || ''
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || ''
const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN || ''
const MAILBOX = process.env.MAILROOM_ADDRESS || 'blake@kcproto.com'

/** How long a mail scan is reused before Gmail is asked again. */
const MAIL_TTL_MS = 60 * 1000
/** Ignore anything older than this; a month-old unread mail is not "what is going on". */
const QUERY = 'in:inbox -category:promotions -category:social -category:updates newer_than:30d'
const PRINT_FILES = /\.(stl|3mf|step|stp|obj|iges|igs|f3d|scad)(\b|$)/i
const PRINT_WORDS = /\b(print|printing|3d|slice|filament|pla|petg)\b/i
const MAX_MESSAGES = 60

/**
 * Where a sender's mail lands. First match wins; `domain` matches the address domain
 * (and its subdomains), `match` is tested against "Name <address> | Subject".
 * Unmatched mail stands on the Inbox hex so nothing is ever invisible.
 */
export const CLIENTS = [
  { zone: 'CorrosionDC',       domain: ['corrosiondc.com'] },
  { zone: 'KC AI Club',        domain: ['kovac.ai', 'kansascity.ai'], match: /ai club|aiclub|kovac/i },
  { zone: 'Embassy Landscape', match: /embassy/i },
  { zone: 'NGV Talent',        match: /ngv|olesya|norton/i },
  { zone: 'CyberGrade',        match: /cybergrade|coppage/i },
  { zone: 'Frances',           match: /caregiver|hohulin|frances/i },
  { zone: 'NED Builds',        match: /nedbuilds|ned builds|\bned\b/i },
  { zone: 'Print Service',     match: /print request|3d print|print quote/i },
  { zone: 'Trade Floor',       match: /alpaca|brokerage|trade-bot/i },
]

const IGNORE_SENDERS = /no-?reply|noreply|notifications?@|mailer-daemon|calendar-notification/i

// ------------------------------------------------------------------------------------------
// Gmail, the minimum: refresh a token, list ids, fetch metadata.
// ------------------------------------------------------------------------------------------

let access = { token: '', expiresAt: 0 }
async function accessToken() {
  if (access.token && Date.now() < access.expiresAt - 60 * 1000) return access.token
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: REFRESH_TOKEN,
    grant_type: 'refresh_token',
  })
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`token refresh → ${res.status}`)
  const json = await res.json()
  access = { token: json.access_token, expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000 }
  return access.token
}

async function gmail(path) {
  const token = await accessToken()
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`gmail ${path.split('?')[0]} → ${res.status}`)
  return res.json()
}

/** Metadata is immutable per message id, so it is fetched once and kept. */
const metaCache = new Map()
async function messageMeta(id) {
  if (metaCache.has(id)) return metaCache.get(id)
  const m = await gmail(`messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`)
  const header = (name) => (m.payload?.headers || []).find((h) => h.name.toLowerCase() === name)?.value || ''
  const meta = {
    id: m.id,
    threadId: m.threadId,
    from: header('from'),
    to: header('to'),
    subject: header('subject') || '(no subject)',
    snippet: decodeEntities(m.snippet || ''),
    at: Number(m.internalDate) || Date.parse(header('date')) || Date.now(),
    size: Number(m.sizeEstimate) || 0,
    labels: m.labelIds || [],
  }
  metaCache.set(id, meta)
  if (metaCache.size > 2000) metaCache.delete(metaCache.keys().next().value)
  return meta
}

function decodeEntities(s) {
  return s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
}

function senderParts(from) {
  const m = from.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/) || from.match(/^\s*([^\s@]+@[^\s]+)/)
  const address = (m ? m[2] || m[1] : from).trim().toLowerCase()
  const name = (m && m[2] ? m[1] : '').trim() || address
  const domain = address.includes('@') ? address.split('@')[1] : ''
  return { name, address, domain }
}

function zoneFor(meta, isPrint) {
  const { domain } = senderParts(meta.from)
  const hay = `${meta.from} | ${meta.subject}`
  for (const c of CLIENTS) {
    if (c.domain && domain && c.domain.some((d) => domain === d || domain.endsWith('.' + d))) return c.zone
    if (c.match && c.match.test(hay)) return c.zone
  }
  return isPrint ? 'Print Service' : 'Inbox'
}

// ------------------------------------------------------------------------------------------
// Scan — stale-while-revalidate, like the cluster adapter.
// ------------------------------------------------------------------------------------------

async function fetchThreads() {
  const [unread, printy] = await Promise.all([
    gmail(`messages?q=${encodeURIComponent(QUERY)}&maxResults=${MAX_MESSAGES}`),
    gmail(`messages?q=${encodeURIComponent(`${QUERY} has:attachment (filename:stl OR filename:3mf OR filename:step OR filename:stp OR filename:obj)`)}&maxResults=${MAX_MESSAGES}`),
  ])
  const printIds = new Set((printy.messages || []).map((m) => m.id))
  const ids = (unread.messages || []).map((m) => m.id)
  const metas = await Promise.all(ids.map((id) => messageMeta(id).catch(() => null)))
  const out = []
  for (const meta of metas) {
    if (!meta) continue
    const { name, address } = senderParts(meta.from)
    if (IGNORE_SENDERS.test(address)) continue
    const isPrint = printIds.has(meta.id) || PRINT_FILES.test(meta.subject) || (PRINT_WORDS.test(meta.subject) && PRINT_WORDS.test(meta.snippet))
    const zone = zoneFor(meta, isPrint)
    const unread = meta.labels.includes('UNREAD')
    out.push({
      id: `mail:${meta.id}`,
      kind: isPrint ? 'print' : unread ? 'mail' : 'inbox',
      title: meta.subject.slice(0, 120),
      preview: `${name} · ${meta.snippet}`.slice(0, 240),
      project: zone,
      projectPath: `mail://${zone.toLowerCase().replace(/\s+/g, '-')}`,
      worktree: '',
      cwd: address,
      gitBranch: isPrint ? 'print request' : unread ? 'unread' : 'read',
      model: name,
      effort: '',
      createdAt: meta.at,
      lastActivityAt: meta.at,
      lastFocusedAt: 0,
      running: false,
      unread,
      hasError: false,
      starred: meta.labels.includes('STARRED'),
      routine: '',
      prState: '',
      archived: false,
      hasTranscript: false,
      sizeBytes: meta.size,
      source: 'gmail',
      canOpen: true,
      canArchive: false,
      ref: { threadId: meta.threadId, id: meta.id },
    })
  }
  return out
}

let cache = { at: 0, data: null, inflight: null }
async function scanThreads() {
  const age = Date.now() - cache.at
  if (cache.data && age < MAIL_TTL_MS) return cache.data
  if (!cache.inflight) {
    cache.inflight = fetchThreads()
      .then((data) => {
        cache = { at: Date.now(), data, inflight: null }
        return data
      })
      .catch((err) => {
        cache.inflight = null
        console.warn('mailroom:', err.message)
        return cache.data || []
      })
  }
  return cache.data || cache.inflight
}

const HEX = /^[0-9a-f]+$/i

/** "Open" is the thread in Gmail, in the mailbox's own account. */
function openThread(ref) {
  const id = ref?.threadId || ''
  if (!HEX.test(id)) return { ok: false, error: 'No Gmail thread on that message' }
  return { ok: true, browser: true, url: `https://mail.google.com/mail/?authuser=${encodeURIComponent(MAILBOX)}#inbox/${id}` }
}

export default {
  id: 'mailroom',
  name: 'Mailroom',
  detect: async () => Boolean(CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN),
  scanThreads,
  openThread,
  newSession: () => ({ ok: false, error: 'Mail is written in Gmail, not here' }),
  setArchived: async () => ({ ok: false, error: 'Read or reply to the message; it walks home on its own' }),
}
