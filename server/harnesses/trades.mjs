/**
 * Harness adapter: the Trade Floor — every open position is an astronaut.
 *
 * The bot itself runs on the Hetzner node, so the home cluster has nothing to watch; the
 * bot's own public status endpoint is the source. One astronaut per position, building
 * sized by market value. A position up 5% or more celebrates, one down 2% or more on the
 * day slumps, the rest potter about. The card reads P&L, entry and current price.
 *
 * Read-only: GET /api/status.
 */

const BASE = (process.env.TRADE_BOT_URL || 'https://trade-bot.kcproto.com').replace(/\/$/, '')
const TTL_MS = 60 * 1000
const ZONE = 'Trade Floor'

const money = (v) => {
  const n = Number(v) || 0
  return `${n < 0 ? '-' : '+'}$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}
const pct = (v) => `${(Number(v) || 0) >= 0 ? '+' : ''}${((Number(v) || 0) * 100).toFixed(1)}%`

async function fetchThreads() {
  const res = await fetch(`${BASE}/api/status`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`trade-bot status → ${res.status}`)
  const d = await res.json()
  const now = Date.now()
  const cycleAt = Date.parse(d.lastCycleTime || '') || 0
  const out = []
  for (const p of Array.isArray(d.positions) ? d.positions : []) {
    const plpc = Number(p.unrealized_plpc) || 0
    const today = Number(p.change_today) || 0
    const value = Number(p.market_value) || 0
    const green = plpc >= 0.05
    const red = today <= -0.02
    out.push({
      id: `trade:${p.symbol}`,
      kind: 'position',
      title: `${p.side === 'short' ? '📉' : '📈'} ${p.symbol} · ${p.qty} sh`,
      preview: `${money(p.unrealized_pl)} (${pct(plpc)}) · today ${pct(today)} · ${Number(p.avg_entry_price).toFixed(2)} → ${Number(p.current_price).toFixed(2)} · $${Math.round(value).toLocaleString('en-US')}`,
      project: ZONE,
      projectPath: 'trade://positions',
      worktree: '',
      cwd: p.exchange || '',
      gitBranch: p.side || 'long',
      model: pct(plpc),
      effort: '',
      createdAt: now - 7 * 86400000, // Alpaca does not say when a position opened; keep slots stable
      lastActivityAt: cycleAt || now,
      lastFocusedAt: 0,
      running: false,
      unread: false,
      hasError: red,
      starred: green,
      routine: '',
      prState: green ? 'MERGED' : '',
      archived: false,
      hasTranscript: false,
      sizeBytes: Math.round(1000 * (1 + value / 100)),
      source: 'trade-bot',
      canOpen: true,
      canArchive: false,
      ref: { symbol: p.symbol },
    })
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
        console.warn('trades:', err.message)
        return cache.data || []
      })
  }
  return cache.data || cache.inflight
}

let detectCache = { at: 0, ok: false }
async function detect() {
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
  id: 'trades',
  name: 'Trade Bot',
  detect,
  scanThreads,
  openThread: () => ({ ok: true, browser: true, url: BASE }),
  newSession: () => ({ ok: false, error: 'The bot decides what to buy' }),
  setArchived: async () => ({ ok: false, error: 'Close the position; it walks home on its own' }),
}
