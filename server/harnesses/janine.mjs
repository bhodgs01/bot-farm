/**
 * Harness adapter: Janine's desk — every reply she drafted and is holding for Blake.
 *
 * Janine (the Gmail receptionist) keeps pendingDrafts in her state. Each one is a worker on
 * the KC Proto hex with an envelope, the sender and subject on hover, and her draft on the
 * card. A held draft is by definition waiting on Blake, so his hand is up.
 *
 * Read-only: GET /api/state on Janine's service.
 */

const BASE = (process.env.JANINE_URL || 'http://janine.janine.svc.cluster.local:3120').replace(/\/$/, '')
const OPEN_URL = process.env.JANINE_OPEN_URL || 'https://mail.google.com/mail/u/0/#drafts'
const ZONE = 'KC Proto'
const TTL_MS = 60 * 1000
const NL = String.fromCharCode(10)

async function fetchThreads() {
  const res = await fetch(`${BASE}/api/state`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`janine → ${res.status}`)
  const state = await res.json()
  const drafts = Object.entries(state.pendingDrafts || {})
  const now = Date.now()
  return drafts.map(([key, d], i) => {
    const created = Date.parse(d.createdAt || d.draftedAt || d.at || '') || now - i * 60000
    const ageH = Math.max(0, Math.round((now - created) / 3600000))
    const who = String(d.senderName || d.senderEmail || 'someone').replace(/<.*>/, '').trim()
    return {
      id: `janine:draft:${d.emailId || key}`,
      kind: 'draft',
      title: `✉️ Draft for ${who}: ${String(d.subject || '(no subject)').slice(0, 70)}`,
      preview: [d.summary || '', d.draft ? `Janine's draft: ${String(d.draft).slice(0, 240)}` : ''].filter(Boolean).join(NL) || 'held for your approval',
      details: {
        From: d.senderEmail || who,
        Subject: d.subject || '',
        Summary: d.summary || '',
        Draft: d.draft || d.reply || '',
        Waiting: ageH >= 48 ? `${Math.round(ageH / 24)} days` : `${ageH} h`,
        Thread: d.threadId || '',
      },
      project: ZONE,
      projectPath: 'janine://drafts',
      worktree: '',
      cwd: 'janine',
      gitBranch: 'held draft',
      model: '',
      effort: '',
      createdAt: created,
      lastActivityAt: created,
      lastFocusedAt: 0,
      running: false,
      unread: true,
      hasError: false,
      starred: false,
      routine: '',
      prState: '',
      archived: false,
      hasTranscript: false,
      sizeBytes: 1000 * (1 + Math.min(20, String(d.draft || '').length / 100)),
      source: 'janine',
      canOpen: true,
      canArchive: false,
      exit: 'beam',
      ref: { emailId: d.emailId, threadId: d.threadId },
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
        console.warn('janine:', err.message)
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
    const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(8000) })
    detectCache = { at: Date.now(), ok: res.ok }
  } catch {
    detectCache = { at: Date.now(), ok: false }
  }
  return detectCache.ok
}

export default {
  id: 'janine',
  name: "Janine's desk",
  detect,
  scanThreads,
  openThread: (ref) => ({ ok: true, browser: true, url: ref?.threadId ? `https://mail.google.com/mail/u/0/#all/${ref.threadId}` : OPEN_URL }),
  newSession: () => ({ ok: false, error: 'Janine drafts these on her own' }),
  setArchived: async () => ({ ok: false, error: 'Approve or discard it in Gmail; she notices' }),
}
