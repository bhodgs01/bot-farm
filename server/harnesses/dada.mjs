/**
 * Harness adapter: Dada chat — Blake's chat with his daughter Ema (dada-chat.kcproto.com).
 *
 * Ema stands on the Home hex. When the last word in the thread is hers, she wears a heart
 * (instead of the generic ? or i) and raises a hand in Needs-you; her card shows the message
 * and lets Blake reply inline. When Blake answered last, she is just there, calm.
 *
 * Read-only here except the reply, which goes through server/act.mjs. Auth to the chat is
 * Blake's own dada-chat user id (the `uid` cookie), kept in a secret.
 */
const URL = process.env.DADA_URL || 'http://dada-chat.dada-chat.svc.cluster.local:3130'
const UID = process.env.DADA_UID || ''
const OPEN_URL = process.env.DADA_OPEN_URL || 'https://dada-chat.kcproto.com'
const ZONE = 'Home'
const TTL_MS = 20 * 1000
const NL = String.fromCharCode(10)

async function getJson(path, auth) {
  const res = await fetch(`${URL}${path}`, {
    headers: { Accept: 'application/json', ...(auth && UID ? { Cookie: `uid=${UID}` } : {}) },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`dada ${path.split('?')[0]} → ${res.status}`)
  return res.json()
}

/** The last few lines of the thread, newest last, as a short preview. */
function transcript(messages, users) {
  const name = (id) => users.find((u) => u.id === id)?.name || 'someone'
  return messages
    .slice(-6)
    .map((m) => `${name(m.from)}: ${m.type === 'text' ? m.text : m.type === 'photo' ? '📷 photo' : m.type === 'video' ? '🎬 video' : '…'}`)
    .join(NL)
}

async function fetchThreads() {
  const hud = await getJson('/api/hud-status').catch(() => null)
  if (!hud || hud.ts == null) return [] // no conversation yet
  const now = Date.now()
  let messages = []
  let users = []
  let last = ''
  try {
    const data = await getJson('/api/messages?limit=20', true)
    messages = Array.isArray(data.messages) ? data.messages : []
    users = Array.isArray(data.users) ? data.users : []
    const tail = messages[messages.length - 1]
    last = tail ? (tail.type === 'text' ? tail.text : tail.type === 'photo' ? '📷 sent a photo' : tail.type === 'video' ? '🎬 sent a video' : 'sent something') : ''
  } catch {
    /* hud-status alone still tells us who spoke last */
  }
  const who = hud.from || 'Ema'
  const unread = Boolean(hud.unread)
  const preview = unread ? (last ? `${who}: ${last}` : `${who} sent you a message`) : last ? `You: ${last}` : 'All caught up.'

  return [
    {
      id: 'dada:ema',
      kind: 'dada',
      title: `${hud.emoji ? `${hud.emoji} ` : '💗 '}${who}`,
      preview: preview.slice(0, 240),
      details: {
        From: who,
        Latest: last || '(no messages yet)',
        Thread: messages.length ? transcript(messages, users) : '',
        When: hud.ts ? new Date(hud.ts).toLocaleString('en-US', { timeZone: 'America/Chicago' }) : '',
      },
      project: ZONE,
      projectPath: 'dada://chat',
      worktree: '',
      cwd: 'dada-chat',
      gitBranch: unread ? 'she messaged you' : 'up to date',
      model: '',
      effort: '',
      createdAt: Date.parse('2026-09-05T12:00:00Z') + 5,
      lastActivityAt: hud.ts || now,
      lastFocusedAt: 0,
      running: false,
      unread, // hand up (heart) only when she spoke last
      hasError: false,
      starred: false,
      routine: '',
      prState: '',
      archived: false,
      hasTranscript: false,
      sizeBytes: 3000,
      source: 'dada-chat',
      canOpen: true,
      canArchive: false,
      actions: ['reply'],
      ref: {},
    },
  ]
}

let cache = { at: 0, data: null, inflight: null }
export function refreshDada() {
  cache = { at: 0, data: null, inflight: null }
}
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
        console.warn('dada:', err.message)
        return cache.data || []
      })
  }
  return cache.data || cache.inflight
}

/** Send a reply into the chat as Blake (the host uid). */
export async function dadaReply(text) {
  if (!UID) return { ok: false, error: 'chat not linked' }
  const t = String(text || '').trim()
  if (!t) return { ok: false, error: 'empty' }
  const res = await fetch(`${URL}/api/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `uid=${UID}` },
    body: JSON.stringify({ text: t.slice(0, 2000) }),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return { ok: false, error: `send → ${res.status}` }
  refreshDada()
  return { ok: true }
}

let detectCache = { at: 0, ok: false }
async function detect() {
  if (Date.now() - detectCache.at < 60 * 1000) return detectCache.ok
  try {
    const res = await fetch(`${URL}/health`, { signal: AbortSignal.timeout(8000) })
    detectCache = { at: Date.now(), ok: res.ok }
  } catch {
    detectCache = { at: Date.now(), ok: false }
  }
  return detectCache.ok
}

export default {
  id: 'dada',
  name: 'Dada chat',
  detect,
  scanThreads,
  openThread: () => ({ ok: true, browser: true, url: OPEN_URL }),
  newSession: () => ({ ok: false, error: 'Reply from the card' }),
  setArchived: async () => ({ ok: false, error: 'Family stays on the map' }),
}
