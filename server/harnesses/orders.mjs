/**
 * Harness adapter: print orders — the self-serve orders that are not finished yet.
 *
 * The farm proxies print-service's order list at /api/approvals. Every order that is not
 * done is a worker on the Print Service hex: pending = hand up (Blake approves on
 * print.kcproto.com), approved/printing = working, ready = waiting for pickup with the
 * dollars on hover. The printers show machines; these show money.
 */

const FARM_URL = (process.env.PRINT_FARM_URL || 'http://print-farm.print-farm.svc.cluster.local').replace(/\/$/, '')
const OPEN_URL = process.env.PRINT_FARM_OPEN_URL || 'https://print.kcproto.com'
const ZONE = 'Print Service'
const TTL_MS = 60 * 1000
const NL = String.fromCharCode(10)
const DONE = /^(done|complete|completed|shipped|picked|cancel|cancelled|rejected|declined)/i

const money = (cents) => (Number.isFinite(Number(cents)) ? `$${(Number(cents) / 100).toFixed(2)}` : '')

async function fetchThreads() {
  const res = await fetch(`${FARM_URL}/api/approvals`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(25000) })
  if (!res.ok) throw new Error(`approvals → ${res.status}`)
  const list = await res.json()
  const now = Date.now()
  return (Array.isArray(list) ? list : [])
    .filter((o) => !DONE.test(String(o.status || '')))
    .map((o) => {
      const status = String(o.status || 'pending').toLowerCase()
      const pending = /pending|new|quoted|awaiting/.test(status)
      const active = /approved|printing|queued|running/.test(status)
      const created = Date.parse(o.created_at || '') || now
      const who = o.name || o.email || 'customer'
      return {
        id: `order:${o.id}`,
        kind: 'order',
        title: `🧾 ${who}${o.quantity ? ` ×${o.quantity}` : ''}`,
        preview: [`${status}${o.quoted_cents ? ` · ${money(o.quoted_cents)}` : ''}`, [o.printer_name, o.color_name, o.material].filter(Boolean).join(' · '), o.note || ''].filter(Boolean).join(NL),
        details: {
          Customer: `${who}${o.email ? ` <${o.email}>` : ''}${o.phone ? ` · ${o.phone}` : ''}`,
          Status: status,
          Quote: money(o.quoted_cents),
          Job: [o.printer_name, o.color_name, o.material, o.quantity ? `qty ${o.quantity}` : ''].filter(Boolean).join(' · '),
          Estimate: [o.est_grams ? `${o.est_grams} g` : '', o.est_minutes ? `${o.est_minutes} min` : '', o.plates ? `${o.plates} plate${o.plates > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · '),
          Note: o.note || '',
          Placed: new Date(created).toLocaleString('en-US', { timeZone: 'America/Chicago' }),
        },
        project: ZONE,
        projectPath: 'farm://orders',
        worktree: '',
        cwd: `order ${o.id}`,
        gitBranch: status,
        model: money(o.quoted_cents),
        effort: '',
        createdAt: created,
        lastActivityAt: Date.parse(o.decided_at || '') || created,
        lastFocusedAt: 0,
        running: active,
        unread: pending,
        hasError: false,
        starred: false,
        routine: '',
        prState: '',
        archived: false,
        hasTranscript: false,
        sizeBytes: 1000 * (1 + (Number(o.quoted_cents) || 0) / 500),
        source: 'print-orders',
        canOpen: true,
        canArchive: false,
        exit: 'beam',
        ref: { order: o.id },
      }
    })
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
        console.warn('orders:', err.message)
        return cache.data || []
      })
  }
  return cache.data || cache.inflight
}

export default {
  id: 'orders',
  name: 'Print orders',
  detect: async () => true,
  scanThreads,
  openThread: () => ({ ok: true, browser: true, url: OPEN_URL }),
  newSession: () => ({ ok: false, error: 'Orders come in from the print service site' }),
  setArchived: async () => ({ ok: false, error: 'Approve or close it on print.kcproto.com' }),
}
