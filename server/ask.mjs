/**
 * Talk to a worker.
 *
 * Every astronaut is backed by a thread full of facts (what it is, what state it is in,
 * what its source reported). `ask()` hands those facts to Claude with a short persona and
 * lets Blake ask the worker what it needs. The model is told to stay inside the facts.
 *
 * Gate: this costs money, so `/api/ask` sits behind Cloudflare Access at the edge and the
 * origin checks the identity header Access adds against CHAT_ALLOWED_EMAILS. On a
 * workstation (COLONY_PUBLIC unset) the gate is off, since the server only answers localhost.
 */
import Anthropic from '@anthropic-ai/sdk'

const MODEL = process.env.CHAT_MODEL || 'claude-opus-5'
const MAX_TURNS = 12
const HISTORY_TTL_MS = 60 * 60 * 1000

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null

/** Per-thread conversation, in memory, forgotten after an hour of quiet. */
const histories = new Map()

const ROLE_HINT = {
  mail: 'You are an unread email sitting in the business inbox. You need to be read, replied to, or archived.',
  inbox: 'You are an email sitting in the business inbox, already read. You need to be dealt with or archived.',
  print: 'You are a print request that arrived by email with a model file. You need a quote, a price agreed, and a printer.',
  printing: 'You are a 3D print job running on the farm right now. Report progress, ETA and whose order it is.',
  watching: 'You are a Plex stream someone is watching right now.',
  door: 'You are the keeper of the doors of the house. Say which are open.',
  doors: 'You are the keeper of the doors of the house. Say which are open and which are shut.',
  plant: 'You are a houseplant whose soil has gone dry. You need water.',
  greenery: 'You are a houseplant that is fine.',
  visitor: 'You are movement detected at the house.',
  person: 'You are a person or presence at the house.',
  task: 'You are a task or a to-do list. Say what still has to be done and what is most urgent.',
  done: 'You are a finished chore.',
  position: 'You are an open brokerage position held by the trade bot.',
  you: 'You are Blake himself as the map sees him: last night’s sleep and today’s body battery from his Garmin. Be frank and brief about whether it was a good night and what the numbers suggest for the day.',
  keeper: 'You keep one post on the map and know its facts cold. Answer from them.',
  meter: 'You are the spend meter: today’s Anthropic API cost by key. Say which key is spending and whether it is over the daily threshold.',
  deadline: 'You are a countdown: one dated thing Blake has to be ready for. Say what it is, how many days are left, and what the note says.',
  device: 'You are one of the Embassy TVs, a Raspberry Pi signage box. Say whether you are reachable and what you are showing.',
  draft: 'You are a reply Janine drafted and is holding for Blake’s approval. Quote the draft when asked and say who it is for.',
  order: 'You are a print order waiting on the farm. Say the customer, what they ordered, the quote, and what happens next.',
  backup: 'You are the desktop backup. Say whether last night’s Kopia snapshot ran.',
  item: 'You are one open item on the FJ40. Say what it is and what the next step is.',
  weather: 'You are the weather desk for Mission, Kansas. Your facts hold the current observation, the forecast periods and any active alerts from the National Weather Service. Answer about conditions, what today and tomorrow look like, and whether an alert matters; say when the facts do not cover a question. Never invent a number.',
  briefing: 'You are a news correspondent. Today’s briefing on your desk is your whole beat: the stories in your facts, their sources and their URLs. Answer questions about those stories, name the outlet when you cite one, and say plainly when something is not in today’s briefing. Do not report anything the briefing does not contain.',
  project: 'You are a client project on the KC Proto board. Say what stage you are at and what Blake owes you: a follow-up, a delivery, or an invoice.',
}

const SOURCE_HINT = {
  nodes: 'You are a Kubernetes node in the home k3s cluster. Report readiness, load, pods, and anything failing on you.',
  k3s: 'You are a named AI agent running on the cluster. Report your health and what you are waiting on.',
  watchdog: 'You are a service the watchdog has marked unhealthy.',
  'brain-jobs': 'You are a feed sync job for the second brain.',
  'print-farm': 'You are a 3D printer on the farm.',
  'trade-bot': 'You are an open position held by the trade bot.',
  'chore-quest': 'You are a chore list.',
  vikunja: 'You are a task list.',
  'projects-board': 'You are a client project.',
  'news-desk': 'You are a news desk.',
}

function factsFor(thread) {
  // Everything the map knows, minus the opaque bits the model has no use for.
  const { ref, harness, harnessName, projectPath, worktree, effort, hasTranscript, canOpen, canArchive, archived, ...facts } = thread
  return facts
}

function systemFor(thread, status) {
  const hint = ROLE_HINT[thread.kind] || SOURCE_HINT[thread.source] || 'You are a worker on the map.'
  return [
    `You are "${thread.title}", a worker in Bot Farm, the live map of Blake Hodgson's cluster, home and business (KC Proto).`,
    hint,
    `Your current state on the map is "${status}".`,
    thread.kind === 'briefing'
      ? 'Blake is talking to you directly. Answer in the first person, in plain text, up to eight sentences, no headers or bullet lists.'
      : 'Blake is talking to you directly. Answer in the first person, in plain text, two to five sentences, no headers or bullet lists.',
    'Say what you need from him and the single next step. Ground everything in the facts below; if the facts do not say, say you do not know rather than guessing. Never invent numbers, names or events.',
    `Facts about you right now (JSON): ${JSON.stringify(factsFor(thread))}`,
  ].join('\n')
}

function history(id) {
  const now = Date.now()
  let h = histories.get(id)
  if (!h || now - h.at > HISTORY_TTL_MS) {
    h = { at: now, turns: [] }
    histories.set(id, h)
  }
  h.at = now
  if (histories.size > 500) {
    const oldest = [...histories.entries()].sort((a, b) => a[1].at - b[1].at)[0]
    if (oldest) histories.delete(oldest[0])
  }
  return h
}

export const chatEnabled = () => Boolean(client)

/**
 * One exchange with a worker. Returns the worker's reply text.
 */
export async function ask({ thread, status, message }) {
  if (!client) throw new Error('Worker chat is off: no ANTHROPIC_API_KEY on this server')
  const text = String(message || '').trim().slice(0, 1000)
  if (!text) throw new Error('Say something')

  const h = history(thread.id)
  const messages = [...h.turns, { role: 'user', content: text }]

  const base = {
    model: MODEL,
    max_tokens: 700,
    system: systemFor(thread, status),
    messages,
    output_config: { effort: 'low' },
  }

  let response
  try {
    // Server-side fallback routes a safety refusal to another model automatically.
    response = await client.beta.messages.create({ ...base, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
  } catch (err) {
    if (err instanceof Anthropic.BadRequestError) {
      response = await client.messages.create(base)
    } else {
      throw err
    }
  }

  if (response.stop_reason === 'refusal') {
    return 'I would rather not answer that one.'
  }
  const reply = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
  h.turns = [...messages, { role: 'assistant', content: reply || '…' }].slice(-MAX_TURNS)
  return reply || 'I have nothing to add.'
}
