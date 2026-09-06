import fsp from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  defaultHarness,
  harnessAppStartedAt,
  harnessStatus,
  newSession as harnessNewSession,
  openThread as harnessOpenThread,
  scanThreads,
  setThreadArchived,
} from './scan.mjs'
import { ask, chatEnabled } from './ask.mjs'
import { setProjectStatus, closeTask, completeChores, createTicket, janineDraftAction, nudgeClient } from './act.mjs'
import { applyAcks, ack, unack, applyStars, setStar } from './acks.mjs'
import { snapshot as newsSnapshot, markRead as newsMarkRead, generate as newsGenerate, update as newsUpdate, topicById, todayKC, newsEnabled } from './news.mjs'
import { refreshNews } from './harnesses/news.mjs'
import { napMode, fetchNap } from './harnesses/home.mjs'
import { plexArt } from './harnesses/plex.mjs'
import { withIntros } from './intro.mjs'

// ── history: who had a hand up, hour by hour ─────────────────────────────────────────────
// Resolved on use: DATA_DIR is declared further down and this block loads with the module.
const historyDir = () => path.join(DATA_DIR, 'history')
let lastHistoryAt = 0
async function readHistory(day) {
  try {
    return JSON.parse(await fsp.readFile(path.join(historyDir(), `${day}.json`), 'utf8'))
  } catch {
    return []
  }
}
async function recordHistory(threads) {
  if (Date.now() - lastHistoryAt < 60 * 60 * 1000) return
  lastHistoryAt = Date.now()
  const day = todayKC()
  const hands = threads
    .filter((t) => !t.archived && (t.unread || t.hasError))
    .map((t) => ({ id: t.id, title: t.title, project: t.project, kind: t.hasError ? 'blocked' : 'waiting' }))
  const list = await readHistory(day)
  list.push({ at: Date.now(), hands })
  await fsp.mkdir(historyDir(), { recursive: true })
  await fsp.writeFile(path.join(historyDir(), `${day}.json`), JSON.stringify(list))
  // thirty days is plenty
  try {
    const files = (await fsp.readdir(historyDir())).filter((f) => f.endsWith('.json')).sort()
    for (const f of files.slice(0, Math.max(0, files.length - 30))) await fsp.unlink(path.join(historyDir(), f))
  } catch {
    /* fine */
  }
}
/** "10:00 ▲ Rusty (CorrosionDC)" lines from today's snapshots. */
async function timelineToday() {
  const list = await readHistory(todayKC())
  const fmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })
  const lines = []
  let prev = new Map()
  for (const snap of list) {
    const now = new Map(snap.hands.map((h) => [h.id, h]))
    for (const [id, h] of now) if (!prev.has(id)) lines.push(`${fmt.format(new Date(snap.at))} ▲ ${h.title} (${h.project})`)
    for (const [id, h] of prev) if (!now.has(id)) lines.push(`${fmt.format(new Date(snap.at))} ▼ ${h.title} (${h.project})`)
    prev = now
  }
  return lines.slice(-14)
}

// ── the ledger: money on the map, added up ───────────────────────────────────────────────
const dollars = (s) => Number(String(s || '').replace(/[^0-9.]/g, '')) || 0
function withLedger(threads) {
  const projects = threads.filter((t) => t.id.startsWith('project:'))
  const owed = projects.filter((t) => t.project === 'Completed').map((t) => ({ t, amount: dollars(t.roof || t.details?.Total) }))
  const owedTotal = owed.reduce((n, o) => n + o.amount, 0)
  const retainers = projects.map((t) => ({ t, r: String(t.details?.Retainer || '') })).filter((x) => x.r)
  const monthly = retainers.reduce((n, x) => n + dollars(x.r) * (/year|annual/i.test(x.r) ? 1 / 12 : /week/i.test(x.r) ? 4.33 : 1), 0)
  const inProcess = projects.filter((t) => t.project === 'In Process').reduce((n, t) => n + dollars(t.details?.Total), 0)
  const pipeline = projects.filter((t) => t.project === 'Active Projects').reduce((n, t) => n + dollars(t.details?.Total), 0)
  const orders = threads.filter((t) => t.id.startsWith('order:')).reduce((n, t) => n + dollars(t.model), 0)
  const spend = dollars(threads.find((t) => t.id === 'keys:spend')?.details?.Today)
  const pot = dollars(threads.find((t) => t.id === 'trade:pot')?.roof)
  const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`
  const nl = String.fromCharCode(10)
  const ledger = {
    id: 'ledger:now',
    kind: 'keeper',
    landmark: 'signpost',
    title: '📒 Ledger',
    // No figures over the keeper's head: the map gets shown around. The numbers are on
    // the card, one click away.
    preview: `The books: ${owed.length} finished job${owed.length === 1 ? '' : 's'} owed, ${retainers.length} retainer${retainers.length === 1 ? '' : 's'} on the board. Click me for the figures.`,
    details: {
      Owed: owed.length ? owed.map((o) => `${o.t.title.replace(/^[^\w]+/, '')}: ${money(o.amount)} (${o.t.plate || ''})`).join(nl) : 'nothing outstanding',
      'In process': money(inProcess),
      Pipeline: `${money(pipeline)} across ${projects.filter((t) => t.project === 'Active Projects').length} active or prospect`,
      Retainers: retainers.length ? retainers.map((x) => `${x.t.title.replace(/^[^\w]+/, '')}: ${x.r}`).join(nl) : 'none on the board',
      'Print orders open': orders ? money(orders) : 'none',
      'API spend today': money(spend),
      'Trade pot': pot ? money(pot) : '',
    },
    project: 'pay me mother fucker',
    projectPath: 'ledger://now',
    worktree: '',
    cwd: 'ledger',
    gitBranch: owedTotal ? `${money(owedTotal)} owed` : 'clear',
    model: '',
    effort: '',
    createdAt: Date.parse('2026-09-05T12:00:00Z') - 2,
    lastActivityAt: Date.now(),
    lastFocusedAt: 0,
    running: false,
    unread: false,
    hasError: false,
    starred: false,
    routine: '',
    prState: '',
    archived: false,
    hasTranscript: false,
    sizeBytes: 4000,
    source: 'bot-farm',
    harness: 'projects',
    harnessName: 'Projects board',
    canOpen: false,
    canArchive: false,
    ref: {},
  }
  return [...threads, ledger]
}

/**
 * The chief of staff: a synthetic worker who carries the whole map's facts, so Blake can
 * ask one astronaut "what's my day" and get the needs-you list, the next deadline, the
 * weather, his sleep and today's spend in one answer. Stands at the countdown post.
 */
let chiefTimeline = []
// unref: this module is also loaded by the Vite config at build time, and a live timer there
// would keep the build process from ever exiting.
setInterval(() => timelineToday().then((l) => (chiefTimeline = l)).catch(() => {}), 5 * 60 * 1000).unref?.()
timelineToday().then((l) => (chiefTimeline = l)).catch(() => {})
function withChief(threads) {
  const by = new Map(threads.map((t) => [t.id, t]))
  const wants = threads.filter((t) => !t.archived && (t.unread || t.hasError) && !t.id.startsWith('chief:'))
  const blocked = wants.filter((t) => t.hasError)
  const waiting = wants.filter((t) => !t.hasError)
  const deadlines = threads.filter((t) => t.id.startsWith('deadline:') && t.id !== 'deadline:post').sort((a, b) => Number(String(a.plate).replace(/\D/g, '') || 999) - Number(String(b.plate).replace(/\D/g, '') || 999))
  const weather = by.get('weather:now')
  const you = by.get('home:you')
  const spend = by.get('keys:spend')
  const nl = String.fromCharCode(10)
  const line = (t) => `${t.title} (${t.project})`
  const details = {
    'Needs you': `${wants.length}: ${blocked.length} blocked, ${waiting.length} waiting`,
    Blocked: blocked.slice(0, 12).map(line).join(nl) || 'nothing',
    Waiting: waiting.slice(0, 15).map(line).join(nl) || 'nothing',
    'Next deadline': deadlines[0] ? `${deadlines[0].title.replace(/^⏳ /, '')} in ${deadlines[0].plate}` : 'none',
    Deadlines: deadlines.map((d) => `${d.plate}: ${d.title.replace(/^⏳ /, '')}`).join(nl),
    Weather: weather ? `${weather.details?.Now || weather.preview}${weather.details?.Alerts && weather.details.Alerts !== 'none' ? ` · alerts: ${weather.details.Alerts}` : ''}` : '',
    You: you ? you.preview : '',
    Spend: spend ? spend.details?.Today || '' : '',
    Crew: `${threads.length} on the map`,
    Today: chiefTimeline.join(nl) || 'no changes recorded yet',
  }
  const chief = {
    id: 'chief:day',
    kind: 'chief',
    title: '🎖️ Chief of staff',
    plate: wants.length ? `${wants.length}` : '',
    preview: `${wants.length} need you${deadlines[0] ? ` · next: ${deadlines[0].title.replace(/^⏳ /, '')} in ${deadlines[0].plate}` : ''}${weather ? ` · ${weather.details?.Now || ''}` : ''}`,
    details,
    project: 'Countdown',
    projectPath: 'chief://day',
    worktree: '',
    cwd: 'chief',
    gitBranch: wants.length ? `${wants.length} need you` : 'clear',
    model: '',
    effort: '',
    createdAt: Date.parse('2026-09-05T12:00:00Z') - 1,
    lastActivityAt: Date.now(),
    lastFocusedAt: 0,
    running: false,
    unread: false,
    hasError: false,
    starred: false,
    routine: '',
    prState: '',
    archived: false,
    hasTranscript: false,
    sizeBytes: 4000,
    source: 'bot-farm',
    harness: 'deadlines',
    harnessName: 'Countdown',
    canOpen: false,
    canArchive: false,
    ref: {},
  }
  return [...threads, chief]
}

/**
 * The id of the build being served: the hash Vite put in the main bundle's file name.
 * The page reads the same hash off its own script tag, so the two agree exactly when the
 * page is running what the server is serving.
 */
let _build
async function buildId() {
  if (_build !== undefined) return _build
  try {
    const html = await fsp.readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'index.html'), 'utf8')
    const m = html.match(/assets\/index-([A-Za-z0-9_-]+)\.js/)
    _build = m ? m[1] : ''
  } catch {
    _build = ''
  }
  return _build
}

const here = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.BOT_CROSSING_DATA || path.join(here, '..', 'data')
const STATE_FILE = path.join(DATA_DIR, 'colony.json')

const STATE_VERSION = 1

/**
 * Colony state is only ever the things the *game* invents — which plot a project got,
 * what a thread's building looks like, what you archived. The threads themselves stay
 * read-only: nothing here ever writes to a harness's data except the one archive flag.
 */
const emptyState = () => ({
  version: STATE_VERSION,
  archived: [],
  archivedAt: {},
  opened: [],
  plots: {},
  seen: {},
  settings: null,
  updatedAt: 0,
})

const asObject = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {})
const asArray = (v) => (Array.isArray(v) ? v : [])

/** Blake's own names for workers, by thread id. */
function asNames(v) {
  if (!v || typeof v !== 'object') return {}
  const out = {}
  for (const [id, name] of Object.entries(v)) if (typeof name === 'string' && name.trim() && id.length < 200) out[id] = name.trim().slice(0, 40)
  return out
}

/** The saved home view: angle, tilt, zoom and the ground point it looks at. Null when unset. */
function asPose(v) {
  if (!v || typeof v !== 'object') return null
  const n = (k) => Number(v[k])
  const pose = { azimuth: n('azimuth'), polar: n('polar'), distance: n('distance'), x: n('x'), z: n('z') }
  return Object.values(pose).every(Number.isFinite) ? pose : null
}

/** Homes keyed by screen (`WxH`): each carries a pose and the kind of device that saved it. */
function asHomes(v) {
  if (!v || typeof v !== 'object') return {}
  const out = {}
  for (const [key, h] of Object.entries(v)) {
    if (!/^\d{2,5}x\d{2,5}$/.test(key)) continue
    const pose = asPose(h)
    if (!pose) continue
    out[key] = { ...pose, kind: ['phone', 'laptop', 'desktop'].includes(h.kind) ? h.kind : 'desktop', savedAt: Number(h.savedAt) || 0 }
  }
  return out
}

async function readState() {
  try {
    const raw = JSON.parse(await fsp.readFile(STATE_FILE, 'utf8'))
    return {
      version: STATE_VERSION,
      archived: asArray(raw.archived),
      archivedAt: asObject(raw.archivedAt),
      opened: asArray(raw.opened),
      plots: asObject(raw.plots),
      seen: asObject(raw.seen),
      names: asNames(raw.names),
      settings: raw.settings && typeof raw.settings === 'object' ? raw.settings : null,
      home: asPose(raw.home),
      homes: asHomes(raw.homes),
      updatedAt: Number(raw.updatedAt) || 0,
    }
  } catch {
    return emptyState()
  }
}

/**
 * One writer: the browser owns this file and PUTs it whole. `/api/archive` deliberately
 * does not touch it — if it did, the next save from a page holding older state would
 * silently drop every archive made since that page loaded.
 */
async function writeState(next) {
  const state = {
    version: STATE_VERSION,
    archived: asArray(next.archived),
    archivedAt: asObject(next.archivedAt),
    opened: asArray(next.opened),
    plots: asObject(next.plots),
    seen: asObject(next.seen),
    names: asNames(next.names),
    settings: next.settings && typeof next.settings === 'object' ? next.settings : null,
    home: asPose(next.home),
    homes: asHomes(next.homes),
    updatedAt: Date.now(),
  }
  await fsp.mkdir(DATA_DIR, { recursive: true })
  const tmp = STATE_FILE + '.tmp'
  await fsp.writeFile(tmp, JSON.stringify(state, null, 2))
  await fsp.rename(tmp, STATE_FILE)
  return state
}

/** Hand a `harness://…` deep link to the OS. `open` gets an argument list, never a shell string. */
function launch(url) {
  const child = spawn('open', [url], { stdio: 'ignore', detached: true })
  child.unref()
}

/**
 * A folder is openable only if it is still on this machine and still a directory. Paths
 * arrive from the page, which got them from a scan that may be minutes old — a repo that
 * has since been moved or deleted must fail here rather than hand `open` a dead path.
 */
async function resolveFolder(folder) {
  if (typeof folder !== 'string' || !folder.startsWith('/')) return null
  const dir = path.resolve(folder)
  const stat = await fsp.stat(dir).catch(() => null)
  return stat && stat.isDirectory() ? dir : null
}

/**
 * A harness loads its session records at launch and rewrites them whenever it touches one,
 * which silently clears an archive flag set from outside. So the colony keeps its own list
 * and re-asserts the flag on every scan; an archive that gets stomped comes back within one
 * poll. `archivePending` is true while the flag is on disk but the running app has not read
 * it yet — that astronaut is walking to the ship but has not boarded.
 */
async function reconcileArchived(threads) {
  const state = await readState()
  if (!state.archived.length) return threads
  const wanted = new Set(state.archived)

  // One `ps` sweep per harness rather than one per thread.
  const startedAt = new Map()
  for (const id of new Set(threads.map((t) => t.harness))) {
    startedAt.set(id, await harnessAppStartedAt(id))
  }

  return Promise.all(
    threads.map(async (thread) => {
      if (!wanted.has(thread.id)) return thread
      if (!thread.archived && thread.canArchive) {
        await setThreadArchived(thread.harness, thread.ref, true).catch(() => {})
      }
      const at = state.archivedAt[thread.id] ?? 0
      const appStart = startedAt.get(thread.harness) || 0
      return { ...thread, archived: true, archivePending: !(appStart && appStart > at) }
    })
  )
}

/**
 * Who may talk to the workers. Behind Cloudflare Access the edge adds the signed-in email
 * as `cf-access-authenticated-user-email`; the origin only trusts it when the request came
 * through the tunnel (COLONY_PUBLIC) and the address is on the list. A workstation server
 * only answers localhost, so there the gate is off.
 */
const CHAT_ALLOWED = new Set(
  String(process.env.CHAT_ALLOWED_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
)
function chatIdentity(req) {
  if (process.env.COLONY_PUBLIC !== '1') return 'local'
  const email = String(req.headers['cf-access-authenticated-user-email'] || '').toLowerCase()
  return email && CHAT_ALLOWED.has(email) ? email : ''
}

/** A small bucket per caller: the workers are chatty but not that chatty. */
const chatBuckets = new Map()
function chatAllowed(who) {
  const now = Date.now()
  const b = chatBuckets.get(who) || { start: now, n: 0 }
  if (now - b.start > 10 * 60 * 1000) Object.assign(b, { start: now, n: 0 })
  b.n++
  chatBuckets.set(who, b)
  return b.n <= 40
}

/** The same first-match precedence the page uses, so the worker describes itself the way the map draws it. */
function statusWord(t) {
  if (t.kind === 'briefing') return t.unread ? 'fresh briefing, unread' : t.running ? 'writing' : t.hasError ? 'no briefing today' : t.stories?.length ? 'briefing read' : 'waiting for the morning'
  if (t.kind === 'mail') return 'new mail'
  if (t.kind === 'print') return 'print request'
  if (t.kind === 'watching') return 'streaming'
  if (t.kind === 'printing') return 'printing'
  if (t.kind === 'door' || t.kind === 'doors') return t.hasError ? 'left open' : 'all shut'
  if (t.kind === 'plant') return 'needs water'
  if (t.kind === 'visitor') return 'movement'
  if (t.hasError) return 'blocked'
  if (t.running) return 'working'
  if (t.prState === 'MERGED') return 'shipped'
  if (t.unread) return 'waiting on you'
  if (Date.now() - (t.lastActivityAt || 0) > 3 * 24 * 60 * 60 * 1000) return 'dormant'
  return 'idle'
}

function send(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

/** Hostname out of a `Host:` or `Origin:` value, with the port and any brackets stripped. */
function hostnameOf(value) {
  if (!value) return ''
  const raw = String(value).includes('://') ? value : `http://${value}`
  try {
    return new URL(raw).hostname.replace(/^\[|\]$/g, '')
  } catch {
    return ''
  }
}

/**
 * Only a page this server itself served may drive it. Two checks, against two different
 * attacks, both of which a localhost server with an `open`-the-desktop-app button is a
 * genuinely attractive target for:
 *
 *   - **Host** stops DNS rebinding. Binding to 127.0.0.1 is not on its own enough: an
 *     attacker who points `evil.com` at 127.0.0.1 reaches us *as a same-origin page*, and
 *     can then read every response. The rebound request still carries `Host: evil.com`.
 *   - **Origin** stops CSRF. A cross-site `fetch` with a `text/plain` body is not
 *     preflighted, so without this check any page you happened to be visiting could POST
 *     here — spawning sessions, opening Finder windows, or wiping the colony layout —
 *     even though it could never read the reply.
 *
 * A state-changing request with no `Origin` at all is refused: browsers always send one on
 * POST/PUT, so its absence means the caller is not the page. That does mean a bare `curl`
 * POST is rejected; pass `-H 'Origin: http://localhost:5274'` if you are scripting this.
 */
/**
 * COLONY_PUBLIC=1 is for the cluster deployment, where the page is served behind a tunnel
 * on a real hostname. The Host pin goes; the Origin check stays, so a state-changing
 * request must still come from the page itself. Writes that matter sit behind Cloudflare
 * Access in front of this.
 */
const PUBLIC = process.env.COLONY_PUBLIC === '1'
const sameHost = (req, value) => hostnameOf(value) === hostnameOf(req.headers.host)

function isLocalRequest(req) {
  if (PUBLIC) {
    const origin = req.headers.origin
    if (origin && origin !== 'null') return sameHost(req, origin)
    return req.method === 'GET' || req.method === 'HEAD'
  }
  if (!LOCAL_HOSTS.has(hostnameOf(req.headers.host))) return false

  const origin = req.headers.origin
  if (origin && origin !== 'null') return LOCAL_HOSTS.has(hostnameOf(origin))
  return req.method === 'GET' || req.method === 'HEAD'
}

function readJsonBody(req, limit = 4 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        reject(new Error('Body too large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

/** Connect-style middleware: handles /api/*, passes everything else through. */
export async function apiMiddleware(req, res, next) {
  const url = new URL(req.url, 'http://localhost')
  if (!url.pathname.startsWith('/api/')) return next ? next() : send(res, 404, { error: 'Not found' })

  if (!isLocalRequest(req)) {
    return send(res, 403, { error: 'Bot Crossing only answers its own page on this machine' })
  }

  try {
    if (url.pathname === '/api/threads' && req.method === 'GET') {
      const scanned = await applyStars(await applyAcks(await reconcileArchived(await scanThreads())))
      recordHistory(scanned).catch(() => {})
      const threads = withIntros(withChief(withLedger(scanned)))
      return send(res, 200, { nap: napMode(), threads, scannedAt: Date.now() })
    }

    // A GET here exists only so the browser can complete the Access login in a tab.
    if (url.pathname === '/api/ask/auth' && req.method === 'GET') {
      const who = chatIdentity(req)
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
      return res.end(`<!doctype html><meta charset=utf-8><title>Bot Farm</title><body style="font:15px system-ui;background:#0f1117;color:#e6e8ef;display:grid;place-items:center;height:100vh;margin:0"><div>${who ? 'Signed in. You can close this tab and talk to the workers.' : 'Signed in, but this address is not on the list for worker chat.'}</div>`)
    }

    if (url.pathname === '/api/act/auth' && req.method === 'GET') {
      const who = chatIdentity(req)
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
      return res.end(`<!doctype html><meta charset=utf-8><title>Bot Farm</title><body style="font:15px system-ui;background:#0f1117;color:#e6e8ef;display:grid;place-items:center;height:100vh;margin:0"><div>${who ? 'Signed in. You can close this tab and move things on the map.' : 'Signed in, but this address is not on the list for actions.'}</div>`)
    }

    // Star a worker to keep an eye on it. A star is a note to self, not a signal from the source.
    if (url.pathname === '/api/act/star' && req.method === 'POST') {
      const who = chatIdentity(req)
      if (!who) return send(res, 401, { error: 'Sign in to star things', signIn: '/api/act/auth' })
      if (!chatAllowed(`act:${who}`)) return send(res, 429, { error: 'Slow down' })
      const { id, on } = await readJsonBody(req, 16 * 1024)
      if (typeof id !== 'string' || !id) return send(res, 400, { error: 'Bad id' })
      const starred = await setStar(id, on !== false, who)
      return send(res, 200, { ok: true, starred })
    }

    // Remove (or restore) a flag Blake already knows about. Pinned to the current failure.
    if (url.pathname === '/api/act/ack' && req.method === 'POST') {
      const who = chatIdentity(req)
      if (!who) return send(res, 401, { error: 'Sign in to change flags', signIn: '/api/act/auth' })
      if (!chatAllowed(`act:${who}`)) return send(res, 429, { error: 'Slow down' })
      const { id, on } = await readJsonBody(req, 16 * 1024)
      if (typeof id !== 'string' || !id) return send(res, 400, { error: 'Bad id' })
      if (on === false) {
        await unack(id)
        return send(res, 200, { ok: true, acked: false })
      }
      const thread = (await scanThreads()).find((t) => t.id === id)
      if (!thread) return send(res, 404, { error: 'That worker is not on the map' })
      if (!thread.hasError) return send(res, 200, { ok: true, acked: false, note: 'Nothing flagged on it' })
      const a = await ack(thread, who)
      console.log(`act: ${who} removed the flag on ${id} (${a.key.slice(0, 80)})`)
      return send(res, 200, { ok: true, acked: true })
    }

    if (url.pathname === '/api/act/task' && req.method === 'POST') {
      const who = chatIdentity(req)
      if (!who) return send(res, 401, { error: 'Sign in to close tickets', signIn: '/api/act/auth' })
      if (!chatAllowed(`act:${who}`)) return send(res, 429, { error: 'Slow down' })
      const { id } = await readJsonBody(req, 16 * 1024)
      const n = Number(id)
      if (!Number.isInteger(n) || n <= 0) return send(res, 400, { error: 'Bad ticket id' })
      try {
        const task = await closeTask({ id: n, who })
        return send(res, 200, { ok: true, done: Boolean(task.done) })
      } catch (err) {
        return send(res, 409, { ok: false, error: String(err?.message || err) })
      }
    }

    // One of Blake's chores, done. Several ids when reminders were folded into one astronaut.
    if (url.pathname === '/api/act/chore' && req.method === 'POST') {
      const who = chatIdentity(req)
      if (!who) return send(res, 401, { error: 'Sign in to mark chores done', signIn: '/api/act/auth' })
      if (!chatAllowed(`act:${who}`)) return send(res, 429, { error: 'Slow down' })
      const { ids } = await readJsonBody(req, 16 * 1024)
      const list = (Array.isArray(ids) ? ids : [ids]).map(String).filter((s) => /^[\w-]{1,40}$/.test(s))
      if (!list.length) return send(res, 400, { error: 'Bad chore id' })
      try {
        const changed = await completeChores({ ids: list, who })
        return send(res, 200, { ok: true, changed })
      } catch (err) {
        return send(res, 409, { ok: false, error: String(err?.message || err) })
      }
    }

    // A raised hand becomes a Vikunja ticket in the hex's client project.
    if (url.pathname === '/api/act/ticket' && req.method === 'POST') {
      const who = chatIdentity(req)
      if (!who) return send(res, 401, { error: 'Sign in to file tickets', signIn: '/api/act/auth' })
      if (!chatAllowed(`act:${who}`)) return send(res, 429, { error: 'Slow down' })
      const { id } = await readJsonBody(req, 16 * 1024)
      const thread = (await scanThreads()).find((t) => t.id === id)
      if (!thread) return send(res, 404, { error: 'That worker has walked off the map' })
      try {
        const task = await createTicket({ thread, who })
        return send(res, 200, { ok: true, task: { id: task.id, title: task.title, project: task.project_id } })
      } catch (err) {
        return send(res, 409, { ok: false, error: String(err?.message || err) })
      }
    }

    // A polite payment reminder, drafted into Gmail for Blake to send (never sent from here).
    if (url.pathname === '/api/act/nudge' && req.method === 'POST') {
      const who = chatIdentity(req)
      if (!who) return send(res, 401, { error: 'Sign in to draft reminders', signIn: '/api/act/auth' })
      if (!chatAllowed(`act:${who}`)) return send(res, 429, { error: 'Slow down' })
      const { id } = await readJsonBody(req, 16 * 1024)
      const thread = (await scanThreads()).find((t) => t.id === id)
      if (!thread) return send(res, 404, { error: 'That worker has walked off the map' })
      try {
        const draft = await nudgeClient({ thread, who })
        return send(res, 200, { ok: true, draft })
      } catch (err) {
        return send(res, 409, { ok: false, error: String(err?.message || err) })
      }
    }

    // Janine's held draft: send it or skip it, from the card.
    if (url.pathname === '/api/act/janine' && req.method === 'POST') {
      const who = chatIdentity(req)
      if (!who) return send(res, 401, { error: 'Sign in to act on drafts', signIn: '/api/act/auth' })
      if (!chatAllowed(`act:${who}`)) return send(res, 429, { error: 'Slow down' })
      const { id, action } = await readJsonBody(req, 16 * 1024)
      const thread = (await scanThreads()).find((t) => t.id === id)
      if (!thread?.ref?.key) return send(res, 404, { error: 'That draft is gone' })
      try {
        const r = await janineDraftAction({ draftKey: thread.ref.key, action: String(action), who })
        return send(res, 200, { ok: true, message: r.message || '' })
      } catch (err) {
        return send(res, 409, { ok: false, error: String(err?.message || err) })
      }
    }

    // The day so far: hourly snapshots of who had a hand up.
    if (url.pathname === '/api/history' && req.method === 'GET') {
      const day = url.searchParams.get('day') || todayKC()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return send(res, 400, { error: 'Bad day' })
      return send(res, 200, { day, snapshots: await readHistory(day) })
    }

    if (url.pathname === '/api/act/project' && req.method === 'POST') {
      const who = chatIdentity(req)
      if (!who) return send(res, 401, { error: 'Sign in to change the board', signIn: '/api/act/auth' })
      if (!chatAllowed(`act:${who}`)) return send(res, 429, { error: 'Slow down' })
      const { id, status } = await readJsonBody(req, 16 * 1024)
      if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return send(res, 400, { error: 'Bad project id' })
      try {
        const project = await setProjectStatus({ id, status: String(status || ''), who })
        return send(res, 200, { ok: true, status: project.status })
      } catch (err) {
        return send(res, 409, { ok: false, error: String(err?.message || err) })
      }
    }

    if (url.pathname === '/api/ask' && req.method === 'POST') {
      if (!chatEnabled()) return send(res, 503, { error: 'Worker chat is off on this server' })
      const who = chatIdentity(req)
      if (!who) return send(res, 401, { error: 'Sign in to talk to the workers', signIn: '/api/ask/auth' })
      if (!chatAllowed(who)) return send(res, 429, { error: 'Give the workers a minute' })
      const { id, message } = await readJsonBody(req, 64 * 1024)
      const threads = await scanThreads()
      const thread = threads.find((t) => t.id === id)
      if (!thread) return send(res, 404, { error: 'That worker has walked off the map' })
      const reply = await ask({ thread, status: statusWord(thread), message })
      return send(res, 200, { reply })
    }

    // The paper: every briefing on disk for the last two weeks, plus the read flags.
    if (url.pathname === '/api/news' && req.method === 'GET') {
      return send(res, 200, await newsSnapshot(14))
    }

    // Mark a briefing read (or unread). Same gate as every other write.
    if (url.pathname === '/api/act/news' && req.method === 'POST') {
      const who = chatIdentity(req)
      if (!who) return send(res, 401, { error: 'Sign in to mark briefings read', signIn: '/api/act/auth' })
      if (!chatAllowed(`act:${who}`)) return send(res, 429, { error: 'Slow down' })
      const { topic, date, on } = await readJsonBody(req, 16 * 1024)
      if (!topicById(String(topic || ''))) return send(res, 400, { error: 'Bad topic' })
      try {
        const read = await newsMarkRead(String(topic), String(date || todayKC()), on !== false, who)
        refreshNews()
        return send(res, 200, { ok: true, read })
      } catch (err) {
        return send(res, 400, { error: String(err?.message || err) })
      }
    }

    // Write today's briefing again, on request. One topic, or every desk when none is named.
    // `update: true` checks the wires instead: adds what is new, keeps what is there.
    if (url.pathname === '/api/act/news/refresh' && req.method === 'POST') {
      const who = chatIdentity(req)
      if (!who) return send(res, 401, { error: 'Sign in to refresh the paper', signIn: '/api/act/auth' })
      if (!chatAllowed(`news:${who}`)) return send(res, 429, { error: 'Slow down' })
      if (!newsEnabled()) return send(res, 503, { error: 'No news key on this server' })
      const { topic, update } = await readJsonBody(req, 16 * 1024)
      const ids = topic ? [String(topic)] : (await newsSnapshot(1)).topics.map((t) => t.id)
      if (ids.some((id) => !topicById(id))) return send(res, 400, { error: 'Bad topic' })
      const updating = update === true
      console.log(`news: ${who} asked for ${updating ? 'a check of the wires on' : 'a rewrite of'} ${ids.join(', ')}`)
      // Fire and return: a briefing takes a minute or two, longer than the tunnel will wait.
      ;(async () => {
        for (const id of ids) {
          if (updating) await newsUpdate(id, todayKC(), { slot: 'manual' })
          else await newsGenerate(id, todayKC(), { force: true })
          refreshNews()
        }
      })().catch((err) => console.warn('news refresh:', err.message))
      return send(res, 202, { ok: true, writing: ids, update: updating })
    }

    if (url.pathname === '/api/harnesses' && req.method === 'GET') {
      return send(res, 200, { harnesses: await harnessStatus() })
    }

    // Nap time, on its own so the page can ask every few seconds without a full scan.
    // Artwork for the theater screen. The Plex token stays here; the page only ever sees
    // a library path, and only library art paths are fetched.
    if (url.pathname === '/api/plex/art' && req.method === 'GET') {
      try {
        const a = await plexArt(url.searchParams.get('key'))
        if (!a) return send(res, 400, { error: 'Not a library art path' })
        res.writeHead(200, { 'Content-Type': a.type, 'Content-Length': a.body.length, 'Cache-Control': 'public, max-age=600' })
        return res.end(a.body)
      } catch (err) {
        return send(res, 502, { error: err.message })
      }
    }

    if (url.pathname === '/api/nap' && req.method === 'GET') {
      return send(res, 200, { nap: await fetchNap() })
    }

    if (url.pathname === '/api/state' && req.method === 'GET') {
      return send(res, 200, { ...(await readState()), build: await buildId() })
    }

    // Only a page running the current build may write the layout. A tab left open across a
    // release keeps re-saving whatever it has in memory, undoing every move made since,
    // so a stale build is turned away and told to reload itself.
    if (url.pathname === '/api/state' && req.method === 'PUT') {
      const build = await buildId()
      const theirs = String(req.headers['x-botfarm-build'] || '')
      if (build && theirs !== build && !(theirs === 'dev' && !process.env.COLONY_PUBLIC)) {
        return send(res, 409, { error: 'stale build', build })
      }
      const next = await readJsonBody(req)
      // A layout that keeps almost none of the zones where they were is not an edit, it is
      // a page that never loaded the file laying the colony out from scratch. Refuse it
      // unless the caller says the rewrite is deliberate.
      const current = await readState()
      const before = current.plots || {}
      const after = asObject(next.plots)
      const known = Object.keys(before).filter((z) => z in after)
      const kept = known.filter((z) => JSON.stringify(before[z]) === JSON.stringify(after[z])).length
      const deliberate = req.headers['x-botfarm-layout'] === 'rewrite'
      if (Object.keys(before).length >= 5 && known.length >= 5 && kept / known.length < 0.3 && !deliberate) {
        console.warn(`state: refused a layout rewrite (${kept}/${known.length} zones kept)`)
        return send(res, 409, { error: 'layout rewrite refused', kept, known: known.length })
      }
      return send(res, 200, await writeState(next))
    }

    if (url.pathname === '/api/open' && req.method === 'POST') {
      const { harness, ref } = await readJsonBody(req)
      const result = harnessOpenThread(harness, ref)
      // A plain web URL is the page's to open; only harness:// deep links go to the OS.
      if (result.ok && !result.browser) launch(result.url)
      return send(res, result.ok ? 200 : 400, result)
    }

    if ((url.pathname === '/api/new-session' || url.pathname === '/api/reveal') && req.method === 'POST') {
      const { folder, harness } = await readJsonBody(req)
      const dir = await resolveFolder(folder)
      if (!dir) return send(res, 400, { ok: false, error: 'That folder is not on this machine any more' })

      if (url.pathname === '/api/reveal') {
        launch(dir)
        return send(res, 200, { ok: true })
      }
      const result = harnessNewSession(harness || (await defaultHarness()), dir)
      if (result.ok) launch(result.url)
      return send(res, result.ok ? 200 : 400, result)
    }

    if (url.pathname === '/api/archive' && req.method === 'POST') {
      const { id, harness, ref, archived } = await readJsonBody(req)
      if (!id) return send(res, 400, { ok: false, error: 'Missing thread id' })

      // Only the harness's own records are touched here — the page records the intent.
      if (!ref || !harness) {
        return send(res, 200, {
          ok: true,
          archived: Boolean(archived),
          harnessRecord: false,
          note: 'Archived in the colony. That harness has no session record for this thread.',
        })
      }
      const result = await setThreadArchived(harness, ref, archived)
      return send(res, 200, { ...result, ok: true, archived: Boolean(archived), harnessRecord: result.ok })
    }

    return send(res, 404, { error: 'Unknown endpoint' })
  } catch (err) {
    return send(res, 500, { error: String(err && err.message ? err.message : err) })
  }
}
