/**
 * The news desk.
 *
 * A handful of topics, one paper per topic per day, written by a model with live web search
 * and kept as a small JSON file per day under DATA_DIR/news/. The Newsroom hex on the map
 * reads these files (server/harnesses/news.mjs), the news page reads them over /api/news,
 * and the correspondents' chat answers out of them (server/ask.mjs).
 *
 * Writer: Claude with the hosted web search tool, on the same ANTHROPIC_API_KEY the worker
 * chat uses.
 *
 * The day has two rhythms:
 *   - the morning edition: once the Kansas City clock passes NEWS_HOUR the day's missing
 *     briefings are written, one topic at a time; a failed topic is retried every RETRY_MS,
 *     a few times;
 *   - the trickle: at each hour in NEWS_UPDATE_HOURS a desk checks the wires again and adds
 *     only what is new since the paper was last written (0 to UPDATE_MAX stories, prepended,
 *     each stamped `addedAt`). A story is unread until Blake marks the desk read; marking read
 *     stamps the desk, so anything added after that stamp is new again.
 *
 * Nothing runs before the hour, nothing runs twice for a slot that already ran, and a restart
 * at noon costs at most the one slot that is due.
 */
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Anthropic from '@anthropic-ai/sdk'

const here = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.BOT_CROSSING_DATA || path.join(here, '..', 'data')
const NEWS_DIR = path.join(DATA_DIR, 'news')
const READ_FILE = path.join(NEWS_DIR, 'read.json')

export const TZ = process.env.NEWS_TZ || 'America/Chicago'
export const NEWS_HOUR = Number(process.env.NEWS_HOUR ?? 6)
/** Hours (Kansas City) at which each desk checks the wires again. Empty string = morning edition only. */
export const UPDATE_HOURS = (() => {
  const raw = process.env.NEWS_UPDATE_HOURS ?? '9,12,15,18,21'
  return [...new Set(String(raw).split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > NEWS_HOUR && n < 24))].sort((a, b) => a - b)
})()
const RETRY_MS = 30 * 60 * 1000
const MAX_TRIES = 4
/** An update slot gets fewer retries: the next slot is a retry of its own. */
const UPDATE_TRIES = 2
/** No update within this long of the last write to the same desk: the wires have not moved. */
const MIN_GAP_MS = 60 * 60 * 1000
const KEEP_DAYS = 30
const STORIES_MIN = 4
const STORIES_MAX = 7
/** Stories one update may add. The page is a briefing, not a feed. */
const UPDATE_MAX = Number(process.env.NEWS_UPDATE_MAX ?? 3)
/** Web searches per briefing. Ten was too few: the model spent them on broad queries and came up short. */
const SEARCH_BUDGET = Number(process.env.NEWS_SEARCHES ?? 30)
/** Web searches per update. The morning did the wide sweep; this is a look at the last few hours. */
const UPDATE_SEARCHES = Number(process.env.NEWS_UPDATE_SEARCHES ?? 12)

const DEFAULT_TOPICS = [
  {
    id: 'politics',
    name: 'Politics',
    desk: 'Politics desk',
    color: '#d3a94e',
    brief:
      'United States national politics first, then the world politics that matters this week: the White House and executive actions, Congress, the courts, elections and campaigns, foreign policy and conflicts. Straight reporting in neutral language, no partisan framing, no opinion pieces.',
  },
  {
    id: 'tech',
    name: 'Tech & AI',
    desk: 'Tech & AI desk',
    color: '#6fb1e8',
    brief:
      'Technology and artificial intelligence: model and product releases from the AI labs, developer tools and agents, chips and compute, big-tech strategy and regulation, notable open-source AI, and security incidents that matter to people who build software.',
  },
  {
    id: 'selfhosted',
    name: 'Self-hosted',
    desk: 'Self-hosted desk',
    color: '#7cc48a',
    brief:
      'Noteworthy self-hosted and open-source applications: new projects gaining traction (GitHub trending, r/selfhosted, Hacker News), major releases of established ones, and homelab tooling such as Kubernetes, Docker, Home Assistant, media servers, backup, networking and dashboards. Prefer things a homelab operator could actually install this week, and say what each one does.',
  },
]

const PALETTE = ['#d3a94e', '#6fb1e8', '#7cc48a', '#d98b7a', '#b48ee8', '#e8c46f', '#7fd0c9']

export const TOPICS = (() => {
  let list = DEFAULT_TOPICS
  try {
    const parsed = process.env.NEWS_TOPICS ? JSON.parse(process.env.NEWS_TOPICS) : null
    if (Array.isArray(parsed) && parsed.length) list = parsed
  } catch {}
  return list
    .filter((t) => t && typeof t === 'object' && /^[a-z][a-z0-9_-]*$/i.test(String(t.id || '')))
    .map((t, i) => ({
      id: String(t.id),
      name: String(t.name || t.id),
      desk: String(t.desk || `${t.name || t.id} desk`),
      color: /^#[0-9a-f]{6}$/i.test(String(t.color || '')) ? String(t.color) : PALETTE[i % PALETTE.length],
      brief: String(t.brief || t.name || t.id),
    }))
})()

export const topicById = (id) => TOPICS.find((t) => t.id === id) || null

// ------------------------------------------------------------------------------------------
// Clock
// ------------------------------------------------------------------------------------------

/** The calendar date and hour in Kansas City, whatever the pod's clock thinks. */
export function kcNow(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(d)
  const get = (t) => parts.find((p) => p.type === t)?.value
  const hour = Number(get('hour')) % 24
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour, minute: Number(get('minute')) || 0 }
}

export const todayKC = () => kcNow().date

const clockKC = (ms) => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ })

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const isDate = (s) => typeof s === 'string' && DATE_RE.test(s)

// ------------------------------------------------------------------------------------------
// Store
// ------------------------------------------------------------------------------------------

const fileFor = (date) => path.join(NEWS_DIR, `${date}.json`)

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fsp.readFile(file, 'utf8'))
  } catch {
    return fallback
  }
}

async function writeJson(file, value) {
  await fsp.mkdir(NEWS_DIR, { recursive: true })
  const tmp = `${file}.tmp`
  await fsp.writeFile(tmp, JSON.stringify(value, null, 2))
  await fsp.rename(tmp, file)
}

const emptyDay = (date) => ({ date, topics: {} })

/**
 * One day's briefings:
 * `{ date, topics: { [id]: { stories, generatedAt, updatedAt?, slots?, provider, model, error?, tries } } }`.
 * `slots` = `{ [hour]: { at, added, tries, error?, failedAt?, skipped? } }`, one per trickle hour that ran.
 */
export async function readDay(date) {
  if (!isDate(date)) return null
  const doc = await readJson(fileFor(date), null)
  if (!doc || typeof doc !== 'object') return null
  return { ...emptyDay(date), ...doc, topics: doc.topics && typeof doc.topics === 'object' ? doc.topics : {} }
}

/** The dates on disk, newest first. */
export async function listDays(limit = 14) {
  let names = []
  try {
    names = await fsp.readdir(NEWS_DIR)
  } catch {
    return []
  }
  return names
    .filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n))
    .map((n) => n.slice(0, 10))
    .sort()
    .reverse()
    .slice(0, limit)
}

/** Read flags: `{ "<topic>:<date>": { at, who } }`. `at` is the stamp: stories added after it are new. */
async function readFlags() {
  const raw = await readJson(READ_FILE, {})
  return raw && typeof raw === 'object' ? raw : {}
}

export async function markRead(topic, date, on = true, who = 'local') {
  if (!topicById(topic) || !isDate(date)) throw new Error('No such briefing')
  const flags = await readFlags()
  const key = `${topic}:${date}`
  if (on) flags[key] = { at: Date.now(), who }
  else delete flags[key]
  // Old flags are worthless once the day has scrolled off the page.
  const cutoff = Date.now() - KEEP_DAYS * 86400000
  for (const [k, v] of Object.entries(flags)) if (!v || v.at < cutoff) delete flags[k]
  await writeJson(READ_FILE, flags)
  return Boolean(on)
}

/** When the desk was last marked read, 0 if never. */
export async function readAt(topic, date) {
  const flags = await readFlags()
  return Number(flags[`${topic}:${date}`]?.at) || 0
}

/** When a story landed: its own stamp, else the edition's. Old papers have no per-story stamp. */
export const storyAt = (story, briefing) => Number(story?.addedAt) || Number(briefing?.generatedAt) || 0

/** The stories Blake has not seen: everything added after the desk was last marked read. */
export function unreadOf(briefing, at = 0) {
  const stories = Array.isArray(briefing?.stories) ? briefing.stories : []
  return stories.filter((s) => storyAt(s, briefing) > at)
}

/** Everything the page needs in one payload: the topics, the last `limit` days, and the read state. */
export async function snapshot(limit = 14) {
  const days = await listDays(limit)
  const docs = await Promise.all(days.map((d) => readDay(d)))
  const flags = await readFlags()
  const today = todayKC()
  const { hour } = kcNow()
  const nextHour = UPDATE_HOURS.find((h) => h > hour)
  return {
    today,
    hour: NEWS_HOUR,
    updateHours: UPDATE_HOURS,
    nextUpdate: nextHour ?? null,
    tz: TZ,
    provider: providerName(),
    generating: [...inflight],
    topics: TOPICS.map(({ id, name, desk, color }) => ({ id, name, desk, color })),
    days: docs.filter(Boolean).map((doc) => {
      const at = Object.fromEntries(TOPICS.map((t) => [t.id, Number(flags[`${t.id}:${doc.date}`]?.at) || 0]))
      return {
        ...doc,
        readAt: at,
        fresh: Object.fromEntries(TOPICS.map((t) => [t.id, unreadOf(doc.topics[t.id], at[t.id]).length])),
        read: Object.fromEntries(TOPICS.map((t) => [t.id, Boolean(doc.topics[t.id]?.stories?.length) && unreadOf(doc.topics[t.id], at[t.id]).length === 0])),
      }
    }),
  }
}

// ------------------------------------------------------------------------------------------
// Writers
// ------------------------------------------------------------------------------------------

const STORY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['stories'],
  properties: {
    stories: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['headline', 'summary', 'why', 'source', 'url'],
        properties: {
          headline: { type: 'string', description: 'A plain, specific headline. Under 90 characters.' },
          summary: { type: 'string', description: 'Two or three sentences of what happened, in plain English.' },
          why: { type: 'string', description: 'One sentence on why it matters.' },
          source: { type: 'string', description: 'The outlet the story came from, e.g. Reuters, The Verge, GitHub.' },
          url: { type: 'string', description: 'The URL of the source article or project page.' },
          published: { type: 'string', description: 'When it was published, as an ISO date or a short phrase like "today". Empty if unknown.' },
        },
      },
    },
  },
}

function longDate(date) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

const REPLY_SHAPE = 'When you are done, reply with the briefing as one JSON object inside a ```json fenced block and nothing after it, with the shape {"stories":[{"headline","summary","why","source","url","published"}]}.'
const HOUSE_STYLE = 'Write plainly. No hype words, no em dashes, American spelling. Every story needs a real source URL you actually saw in the search results.'

function systemFor(topic, date) {
  return [
    `You are the ${topic.desk} of a small private daily news briefing written for one reader, Blake, a software developer and homelab operator in Kansas City. Today is ${longDate(date)}.`,
    `Your beat: ${topic.brief}`,
    `Use web search to find what actually happened in the last 24 to 48 hours. Pick the ${STORIES_MIN} to ${STORIES_MAX} stories that matter most, lead with the biggest, and drop anything you could not confirm from a real source. No duplicates, no listicles, no stories older than three days unless they broke today.`,
    HOUSE_STYLE,
    REPLY_SHAPE,
  ].join('\n')
}

/** The afternoon look: only what is new since the paper was last written. */
function updateSystemFor(topic, date, existing, since) {
  const covered = existing.map((s, i) => `${i + 1}. ${s.headline} (${s.source})`).join('\n')
  return [
    `You are the ${topic.desk} of a small private daily news briefing written for one reader, Blake, a software developer and homelab operator in Kansas City. Today is ${longDate(date)}; it is now ${clockKC(Date.now())} in Kansas City.`,
    `Your beat: ${topic.brief}`,
    `Today's paper already carries these stories (last written ${clockKC(since)}):\n${covered || '(nothing yet)'}`,
    `Use web search to find what has happened on your beat in the last few hours that the paper does not have. Return only genuinely new developments, at most ${UPDATE_MAX}, biggest first. A story already on the list does not count, and neither does a fresh angle on one; a real new development in a covered story counts only if it changes what Blake would think. If nothing new and worth his time has happened, return an empty stories array. That is a fine answer and the usual one.`,
    HOUSE_STYLE,
    REPLY_SHAPE,
  ].join('\n')
}

const userPrompt = (topic) => `Write today's ${topic.name} briefing.`
const updatePrompt = (topic) => `What is new on the ${topic.name} desk since the paper was written? New stories only.`

/** The JSON object out of the model's text: the last fenced block, else the outermost braces. */
function parseStories(text) {
  const fences = [...String(text).matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1])
  const candidates = fences.length ? fences.reverse() : []
  const first = String(text).indexOf('{')
  const last = String(text).lastIndexOf('}')
  if (first >= 0 && last > first) candidates.push(String(text).slice(first, last + 1))
  for (const c of candidates) {
    try {
      const obj = JSON.parse(c)
      if (obj && Array.isArray(obj.stories)) return obj.stories
    } catch {}
  }
  return null
}

const clean = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
const headlineKey = (s) => clean(s, 200).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
const urlKey = (u) => {
  try {
    const x = new URL(u)
    return `${x.hostname.replace(/^www\./, '')}${x.pathname.replace(/\/+$/, '')}`.toLowerCase()
  } catch {
    return String(u).toLowerCase()
  }
}

/** Only real, well-formed stories make the page. `against` = stories already in the paper, never repeated. */
function normalize(stories, { max = STORIES_MAX, addedAt = Date.now(), against = [] } = {}) {
  const out = []
  const seen = new Set()
  for (const s of against) {
    seen.add(`h:${headlineKey(s.headline)}`)
    seen.add(`u:${urlKey(s.url)}`)
  }
  for (const s of Array.isArray(stories) ? stories : []) {
    if (!s || typeof s !== 'object') continue
    const headline = clean(s.headline, 160)
    const url = clean(s.url, 600)
    if (!headline || !/^https?:\/\//i.test(url)) continue
    const hk = `h:${headlineKey(headline)}`
    const uk = `u:${urlKey(url)}`
    if (seen.has(hk) || seen.has(uk)) continue
    seen.add(hk)
    seen.add(uk)
    let host = ''
    try {
      host = new URL(url).hostname.replace(/^www\./, '')
    } catch {}
    out.push({
      headline,
      summary: clean(s.summary, 900),
      why: clean(s.why, 300),
      source: clean(s.source, 80) || host,
      host,
      url,
      published: clean(s.published, 40),
      addedAt,
    })
    if (out.length >= max) break
  }
  return out
}

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null
const NEWS_MODEL = process.env.NEWS_MODEL || 'claude-opus-5'
const UPDATE_MODEL = process.env.NEWS_UPDATE_MODEL || NEWS_MODEL

export const providerName = () => (anthropic ? `Claude (${NEWS_MODEL})` : '')

export const newsEnabled = () => Boolean(anthropic)

const textOf = (content) =>
  (Array.isArray(content) ? content : [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')

/**
 * Claude with the hosted web search tool. Resumes a paused turn, then formats if the fence is
 * missing. `mode.existing` turns it from the morning sweep into the afternoon look.
 */
async function writeWithClaude(topic, date, mode = {}) {
  const updating = Array.isArray(mode.existing)
  const model = updating ? UPDATE_MODEL : NEWS_MODEL
  const messages = [{ role: 'user', content: updating ? updatePrompt(topic) : userPrompt(topic) }]
  const base = {
    model,
    max_tokens: 16000,
    system: updating ? updateSystemFor(topic, date, mode.existing, mode.since || Date.now()) : systemFor(topic, date),
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: updating ? UPDATE_SEARCHES : SEARCH_BUDGET }],
    output_config: { effort: updating ? 'low' : 'medium' },
    // A paused turn resends everything so far; the prefix is the same bytes, so let it cache.
    cache_control: { type: 'ephemeral' },
  }
  const label = `${topic.name}${updating ? ' update' : ''}`
  let response
  for (let i = 0; i < 4; i++) {
    response = await anthropic.messages.create({ ...base, messages })
    console.log(`news: ${label} round ${i + 1}: ${response.stop_reason}, ${response.usage?.server_tool_use?.web_search_requests ?? '?'} searches, ${response.usage?.output_tokens ?? '?'} out, ${response.usage?.cache_read_input_tokens ?? 0} cached`)
    if (response.stop_reason !== 'pause_turn') break
    messages.push({ role: 'assistant', content: response.content })
  }
  if (response.stop_reason === 'refusal') throw new Error('The model declined to write this briefing')
  const text = textOf(response.content)
  // The last reply, verbatim, next to the data: the first thing to read when a desk comes up short.
  await writeJson(path.join(NEWS_DIR, `raw-${topic.id}${updating ? '-update' : ''}.json`), { date, at: Date.now(), stop: response.stop_reason, usage: response.usage, text, blocks: response.content.map((b) => b.type) }).catch(() => {})
  let stories = parseStories(text)
  if (!stories) {
    // The prose is there but the fence is not: one more, cheap call to shape it.
    const shaped = await anthropic.messages.create({
      model,
      max_tokens: 8000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: STORY_SCHEMA } },
      messages: [{ role: 'user', content: `Turn this briefing into the JSON shape, keeping every story, source and URL exactly as written. If it says there is nothing new, the stories array is empty:\n\n${text.slice(0, 30000)}` }],
    })
    stories = parseStories(textOf(shaped.content))
  }
  if (!stories) throw new Error('No stories in the reply')
  const addedAt = Date.now()
  return {
    stories: updating ? normalize(stories, { max: UPDATE_MAX, addedAt, against: mode.existing }) : normalize(stories, { addedAt }),
    provider: 'claude',
    model,
    usage: response.usage,
  }
}

// ------------------------------------------------------------------------------------------
// Generation, one topic at a time, never twice at once
// ------------------------------------------------------------------------------------------

const inflight = new Set() // `${topic}:${date}`

/** The morning edition: the whole paper for one desk. `force` rewrites one that exists. */
export async function generate(topicId, date = todayKC(), { force = false } = {}) {
  const topic = topicById(topicId)
  if (!topic) throw new Error(`No topic "${topicId}"`)
  if (!isDate(date)) throw new Error('Bad date')
  if (!newsEnabled()) throw new Error('No news key: set ANTHROPIC_API_KEY')
  const key = `${topic.id}:${date}`
  if (inflight.has(key)) return { ok: false, busy: true }
  const doc = (await readDay(date)) || emptyDay(date)
  const have = doc.topics[topic.id]
  if (!force && have?.stories?.length) return { ok: true, cached: true, briefing: have }

  inflight.add(key)
  const t0 = Date.now()
  try {
    console.log(`news: writing ${topic.name} for ${date} with ${providerName()}`)
    const result = await writeWithClaude(topic, date)
    if (result.stories.length < Math.min(STORIES_MIN, 2)) throw new Error(`Only ${result.stories.length} usable stories`)
    const briefing = { ...result, generatedAt: Date.now(), updatedAt: Date.now(), ms: Date.now() - t0, tries: (have?.tries || 0) + 1, slots: {} }
    const fresh = (await readDay(date)) || emptyDay(date)
    fresh.topics[topic.id] = briefing
    await writeJson(fileFor(date), fresh)
    if (force) await markRead(topic.id, date, false).catch(() => {})
    console.log(`news: ${topic.name} ${date}: ${briefing.stories.length} stories in ${Math.round(briefing.ms / 1000)}s`)
    return { ok: true, briefing }
  } catch (err) {
    const msg = String(err?.message || err).slice(0, 300)
    console.warn(`news: ${topic.name} ${date} failed: ${msg}`)
    const fresh = (await readDay(date)) || emptyDay(date)
    const prev = fresh.topics[topic.id] || {}
    fresh.topics[topic.id] = { ...prev, stories: prev.stories || [], error: msg, failedAt: Date.now(), tries: (prev.tries || 0) + 1 }
    await writeJson(fileFor(date), fresh)
    return { ok: false, error: msg }
  } finally {
    inflight.delete(key)
  }
}

/**
 * The trickle: one look at the wires for one desk, adding only what the paper lacks. `slot` is
 * the hour that asked (or 'manual'); the paper remembers which slots ran so none runs twice.
 * A desk with no paper yet gets the morning edition instead.
 */
export async function update(topicId, date = todayKC(), { slot = 'manual' } = {}) {
  const topic = topicById(topicId)
  if (!topic) throw new Error(`No topic "${topicId}"`)
  if (!isDate(date)) throw new Error('Bad date')
  if (!newsEnabled()) throw new Error('No news key: set ANTHROPIC_API_KEY')
  const key = `${topic.id}:${date}`
  if (inflight.has(key)) return { ok: false, busy: true }
  const doc = (await readDay(date)) || emptyDay(date)
  const have = doc.topics[topic.id]
  if (!have?.stories?.length) return generate(topicId, date)

  inflight.add(key)
  const t0 = Date.now()
  const slotKey = String(slot)
  try {
    console.log(`news: ${topic.name} ${date}: checking the wires (slot ${slotKey})`)
    const result = await writeWithClaude(topic, date, { existing: have.stories, since: have.updatedAt || have.generatedAt })
    const fresh = (await readDay(date)) || emptyDay(date)
    const cur = fresh.topics[topic.id] || have
    // Merge against the paper as it is now, not as it was when the call started.
    const added = normalize(result.stories, { max: UPDATE_MAX, addedAt: Date.now(), against: cur.stories || [] })
    const slots = { ...(cur.slots || {}) }
    slots[slotKey] = { at: Date.now(), added: added.length, tries: (slots[slotKey]?.tries || 0) + 1, ms: Date.now() - t0 }
    fresh.topics[topic.id] = { ...cur, stories: [...added, ...(cur.stories || [])], updatedAt: added.length ? Date.now() : cur.updatedAt || cur.generatedAt, slots, lastUpdate: { at: Date.now(), added: added.length, usage: result.usage } }
    await writeJson(fileFor(date), fresh)
    console.log(`news: ${topic.name} ${date}: ${added.length} new ${added.length === 1 ? 'story' : 'stories'} in ${Math.round((Date.now() - t0) / 1000)}s (slot ${slotKey})`)
    return { ok: true, added }
  } catch (err) {
    const msg = String(err?.message || err).slice(0, 300)
    console.warn(`news: ${topic.name} ${date} update failed (slot ${slotKey}): ${msg}`)
    const fresh = (await readDay(date)) || emptyDay(date)
    const cur = fresh.topics[topic.id] || have
    const slots = { ...(cur.slots || {}) }
    slots[slotKey] = { ...(slots[slotKey] || {}), error: msg, failedAt: Date.now(), tries: (slots[slotKey]?.tries || 0) + 1 }
    fresh.topics[topic.id] = { ...cur, slots }
    await writeJson(fileFor(date), fresh)
    return { ok: false, error: msg }
  } finally {
    inflight.delete(key)
  }
}

export const isGenerating = (topicId, date = todayKC()) => inflight.has(`${topicId}:${date}`)

/**
 * What the ticker does each minute: the morning edition for whatever today still lacks once
 * the hour has come, then the one trickle slot that is due. Only the latest due slot counts: a
 * pod that comes back at four does not owe the morning three.
 */
let ticking = false
export async function tick() {
  if (!newsEnabled() || ticking) return
  ticking = true
  try {
    await sweep()
  } finally {
    ticking = false
  }
}

/** One pass over the desks. Runs alone: a tick that starts while the last one is still writing would put two desks on the wire at once. */
async function sweep() {
  const { date, hour } = kcNow()
  if (hour < NEWS_HOUR) return
  const due = UPDATE_HOURS.filter((h) => h <= hour).pop()
  for (const topic of TOPICS) {
    const doc = (await readDay(date)) || emptyDay(date)
    const have = doc.topics[topic.id]
    if (!have?.stories?.length) {
      if (have?.error) {
        if ((have.tries || 0) >= MAX_TRIES) continue
        if (Date.now() - (have.failedAt || 0) < RETRY_MS) continue
      }
      await generate(topic.id, date) // sequential on purpose: one search-heavy call at a time
      continue
    }
    if (due == null) continue
    const slot = have.slots?.[String(due)]
    if (slot?.at) continue
    if (slot?.error) {
      if ((slot.tries || 0) >= UPDATE_TRIES) continue
      if (Date.now() - (slot.failedAt || 0) < RETRY_MS) continue
    }
    const lastWrite = Math.max(Number(have.updatedAt) || 0, Number(have.generatedAt) || 0, ...Object.values(have.slots || {}).map((s) => Number(s?.at) || 0))
    if (Date.now() - lastWrite < MIN_GAP_MS) {
      // The paper was just written; this slot would find nothing. Mark it so it does not nag.
      const fresh = (await readDay(date)) || emptyDay(date)
      const cur = fresh.topics[topic.id]
      if (cur) {
        cur.slots = { ...(cur.slots || {}), [String(due)]: { at: Date.now(), added: 0, skipped: true } }
        await writeJson(fileFor(date), fresh)
      }
      continue
    }
    await update(topic.id, date, { slot: due })
  }
}

let timer = null
export function startScheduler() {
  if (timer || !newsEnabled()) return
  const run = () => tick().catch((err) => console.warn('news tick:', err.message))
  setTimeout(run, 5000)
  timer = setInterval(run, 60 * 1000)
  timer.unref?.()
  const trickle = UPDATE_HOURS.length ? `, wires checked at ${UPDATE_HOURS.map((h) => `${h}:00`).join(', ')}` : ''
  console.log(`News desk: ${TOPICS.length} topics, ${providerName()}, daily after ${NEWS_HOUR}:00 ${TZ}${trickle}`)
}
