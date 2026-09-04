/**
 * The news desk.
 *
 * Three topics, one briefing per topic per day, written by a model with live web search and
 * kept as a small JSON file per day under DATA_DIR/news/. The Newsroom hex on the map reads
 * these files (server/harnesses/news.mjs), the news page reads them over /api/news, and the
 * correspondents' chat answers out of them (server/ask.mjs).
 *
 * Writer: Claude with the hosted web search tool, on the same ANTHROPIC_API_KEY the worker
 * chat uses. One search-heavy call per topic per day.
 *
 * Schedule: an in-process ticker. Once the Kansas City clock passes NEWS_HOUR the day's
 * missing briefings are written, one topic at a time; a failed topic is retried every
 * RETRY_MS, a few times. Nothing runs before the hour, and nothing runs twice for a day
 * that already has its briefing, so a restart at noon costs nothing.
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
const RETRY_MS = 30 * 60 * 1000
const MAX_TRIES = 4
const KEEP_DAYS = 30
const STORIES_MIN = 4
const STORIES_MAX = 7
/** Web searches per briefing. Ten was too few: the model spent them on broad queries and came up short. */
const SEARCH_BUDGET = Number(process.env.NEWS_SEARCHES ?? 30)

const DEFAULT_TOPICS = [
  {
    id: 'politics',
    name: 'Politics',
    desk: 'Politics desk',
    brief:
      'United States national politics first, then the world politics that matters this week: the White House and executive actions, Congress, the courts, elections and campaigns, foreign policy and conflicts. Straight reporting in neutral language, no partisan framing, no opinion pieces.',
  },
  {
    id: 'tech',
    name: 'Tech & AI',
    desk: 'Tech & AI desk',
    brief:
      'Technology and artificial intelligence: model and product releases from the AI labs, developer tools and agents, chips and compute, big-tech strategy and regulation, notable open-source AI, and security incidents that matter to people who build software.',
  },
  {
    id: 'selfhosted',
    name: 'Self-hosted',
    desk: 'Self-hosted desk',
    brief:
      'Noteworthy self-hosted and open-source applications: new projects gaining traction (GitHub trending, r/selfhosted, Hacker News), major releases of established ones, and homelab tooling such as Kubernetes, Docker, Home Assistant, media servers, backup, networking and dashboards. Prefer things a homelab operator could actually install this week, and say what each one does.',
  },
]

export const TOPICS = (() => {
  try {
    const parsed = process.env.NEWS_TOPICS ? JSON.parse(process.env.NEWS_TOPICS) : null
    if (Array.isArray(parsed) && parsed.length) return parsed
  } catch {}
  return DEFAULT_TOPICS
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

/** One day's briefings: `{ date, topics: { [id]: { stories, generatedAt, provider, model, error?, tries } } }`. */
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

/** Read flags: `{ "<topic>:<date>": { at, who } }`. */
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

export async function isRead(topic, date) {
  const flags = await readFlags()
  return Boolean(flags[`${topic}:${date}`])
}

/** Everything the page needs in one payload: the topics, the last `limit` days, and the read flags. */
export async function snapshot(limit = 14) {
  const days = await listDays(limit)
  const docs = await Promise.all(days.map((d) => readDay(d)))
  const flags = await readFlags()
  const today = todayKC()
  return {
    today,
    hour: NEWS_HOUR,
    tz: TZ,
    provider: providerName(),
    generating: [...inflight],
    topics: TOPICS.map(({ id, name, desk }) => ({ id, name, desk })),
    days: docs.filter(Boolean).map((doc) => ({
      ...doc,
      read: Object.fromEntries(TOPICS.map((t) => [t.id, Boolean(flags[`${t.id}:${doc.date}`])])),
    })),
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

function systemFor(topic, date) {
  return [
    `You are the ${topic.desk} of a small private daily news briefing written for one reader, Blake, a software developer and homelab operator in Kansas City. Today is ${longDate(date)}.`,
    `Your beat: ${topic.brief}`,
    `Use web search to find what actually happened in the last 24 to 48 hours. Pick the ${STORIES_MIN} to ${STORIES_MAX} stories that matter most, lead with the biggest, and drop anything you could not confirm from a real source. No duplicates, no listicles, no stories older than three days unless they broke today.`,
    'Write plainly. No hype words, no em dashes, American spelling. Every story needs a real source URL you actually saw in the search results.',
    'When you are done, reply with the briefing as one JSON object inside a ```json fenced block and nothing after it, with the shape {"stories":[{"headline","summary","why","source","url","published"}]}.',
  ].join('\n')
}

const userPrompt = (topic) => `Write today's ${topic.name} briefing.`

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

/** Only real, well-formed stories make the page. */
function normalize(stories) {
  const out = []
  const seen = new Set()
  for (const s of Array.isArray(stories) ? stories : []) {
    if (!s || typeof s !== 'object') continue
    const headline = clean(s.headline, 160)
    const url = clean(s.url, 600)
    if (!headline || !/^https?:\/\//i.test(url)) continue
    const key = headline.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
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
    })
    if (out.length >= STORIES_MAX) break
  }
  return out
}

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null
const NEWS_MODEL = process.env.NEWS_MODEL || 'claude-opus-5'

export const providerName = () => (anthropic ? `Claude (${NEWS_MODEL})` : '')

export const newsEnabled = () => Boolean(anthropic)

const textOf = (content) =>
  (Array.isArray(content) ? content : [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')

/** Claude with the hosted web search tool. Resumes a paused turn, then formats if the fence is missing. */
async function writeWithClaude(topic, date) {
  const messages = [{ role: 'user', content: userPrompt(topic) }]
  const base = {
    model: NEWS_MODEL,
    max_tokens: 16000,
    system: systemFor(topic, date),
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: SEARCH_BUDGET }],
    output_config: { effort: 'medium' },
  }
  let response
  for (let i = 0; i < 4; i++) {
    response = await anthropic.messages.create({ ...base, messages })
    console.log(`news: ${topic.name} round ${i + 1}: ${response.stop_reason}, ${response.usage?.server_tool_use?.web_search_requests ?? '?'} searches, ${response.usage?.output_tokens ?? '?'} out`)
    if (response.stop_reason !== 'pause_turn') break
    messages.push({ role: 'assistant', content: response.content })
  }
  if (response.stop_reason === 'refusal') throw new Error('The model declined to write this briefing')
  const text = textOf(response.content)
  // The last reply, verbatim, next to the data: the first thing to read when a desk comes up short.
  await writeJson(path.join(NEWS_DIR, `raw-${topic.id}.json`), { date, at: Date.now(), stop: response.stop_reason, usage: response.usage, text, blocks: response.content.map((b) => b.type) }).catch(() => {})
  let stories = parseStories(text)
  if (!stories) {
    // The prose is there but the fence is not: one more, cheap call to shape it.
    const shaped = await anthropic.messages.create({
      model: NEWS_MODEL,
      max_tokens: 8000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: STORY_SCHEMA } },
      messages: [{ role: 'user', content: `Turn this briefing into the JSON shape, keeping every story, source and URL exactly as written:\n\n${text.slice(0, 30000)}` }],
    })
    stories = parseStories(textOf(shaped.content))
  }
  if (!stories) throw new Error('No stories in the reply')
  return { stories: normalize(stories), provider: 'claude', model: NEWS_MODEL, usage: response.usage }
}

// ------------------------------------------------------------------------------------------
// Generation, one topic at a time, never twice at once
// ------------------------------------------------------------------------------------------

const inflight = new Set() // `${topic}:${date}`

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
    const briefing = { ...result, generatedAt: Date.now(), ms: Date.now() - t0, tries: (have?.tries || 0) + 1 }
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

export const isGenerating = (topicId, date = todayKC()) => inflight.has(`${topicId}:${date}`)

/** What the ticker does each minute: write whatever today still lacks, once the hour has come. */
export async function tick() {
  if (!newsEnabled()) return
  const { date, hour } = kcNow()
  if (hour < NEWS_HOUR) return
  const doc = (await readDay(date)) || emptyDay(date)
  for (const topic of TOPICS) {
    const have = doc.topics[topic.id]
    if (have?.stories?.length) continue
    if (have?.error) {
      if ((have.tries || 0) >= MAX_TRIES) continue
      if (Date.now() - (have.failedAt || 0) < RETRY_MS) continue
    }
    await generate(topic.id, date) // sequential on purpose: one search-heavy call at a time
  }
}

let timer = null
export function startScheduler() {
  if (timer || !newsEnabled()) return
  const run = () => tick().catch((err) => console.warn('news tick:', err.message))
  setTimeout(run, 5000)
  timer = setInterval(run, 60 * 1000)
  timer.unref?.()
  console.log(`News desk: ${TOPICS.length} topics, ${providerName()}, daily after ${NEWS_HOUR}:00 ${TZ}`)
}
