/**
 * Harness adapter: the Newsroom — one correspondent per topic.
 *
 * Each desk writes one briefing a day (server/news.mjs). A fresh briefing Blake has not read
 * yet is a correspondent with a hand up; once he marks it read (on the card, or on the news
 * page) the correspondent goes back to idle. A desk with no paper after the morning hour has
 * come and gone is flagged. The card carries the headlines, the chat answers out of the
 * stories, and "Open" is the news page.
 *
 * Read-only against the store; the read flag is the one write, behind /api/act/news.
 */
import { TOPICS, NEWS_HOUR, kcNow, readDay, isRead, isGenerating, newsEnabled, providerName } from '../news.mjs'

const ZONE = 'Newsroom'
const NEWS_URL = (process.env.NEWS_URL || '/news/').replace(/\/?$/, '/')
const TTL_MS = 20 * 1000
/** How long after the morning hour an empty desk is a problem, not just early. */
const LATE_MS = 90 * 60 * 1000
/** Fixed creation stamp so the three keep their stand slots from day to day. */
const BORN = Date.parse('2026-09-04T12:00:00Z')

const ICON = { politics: '🏛️', tech: '🤖', selfhosted: '🧰' }

function fetchThreads() {
  const { date, hour, minute } = kcNow()
  const sinceHour = (hour - NEWS_HOUR) * 3600000 + minute * 60000
  return Promise.all(
    TOPICS.map(async (topic) => {
      const doc = await readDay(date)
      const b = doc?.topics?.[topic.id] || null
      const stories = Array.isArray(b?.stories) ? b.stories : []
      const has = stories.length > 0
      const read = has ? await isRead(topic.id, date) : false
      const writing = isGenerating(topic.id, date)
      const late = !has && sinceHour > LATE_MS
      const noKey = !newsEnabled()
      const lead = stories[0]
      const headlines = stories.map((s, i) => `${i + 1}. ${s.headline} (${s.source})`).join('\n')
      const preview = has
        ? `${stories.length} stories · ${lead.headline}`
        : writing
          ? 'Writing this morning’s briefing…'
          : noKey
            ? 'No key on this server: the desk cannot write'
            : b?.error
              ? `Could not write today’s briefing: ${b.error}`
              : hour < NEWS_HOUR
                ? `Briefing lands after ${NEWS_HOUR}:00`
                : 'No briefing yet today'
      return {
        id: `news:${topic.id}`,
        kind: 'briefing',
        title: `${ICON[topic.id] || '🗞️'} ${topic.desk}`,
        preview,
        project: ZONE,
        projectPath: 'news://desk',
        landmark: 'newsstand',
        roof: has ? `${stories.length} stories` : writing ? 'writing' : '',
        count: has && !read ? stories.length : 0,
        topic: topic.id,
        date,
        stories: stories.map(({ headline, summary, why, source, url, published }) => ({ headline, summary, why, source, url, published })),
        details: {
          Desk: topic.name,
          Date: date,
          Status: has ? (read ? 'read' : 'unread') : writing ? 'writing' : 'no briefing',
          Headlines: headlines,
          'Written by': b?.model ? `${providerName()}${b.generatedAt ? ` at ${new Date(b.generatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })} CT` : ''}` : '',
          Error: !has && b?.error ? b.error : '',
        },
        actions: has && !read ? ['read'] : [],
        alertKey: late ? `missing:${date}` : noKey ? 'nokey' : '',
        worktree: '',
        cwd: topic.name,
        gitBranch: has ? (read ? 'read' : 'unread') : 'no paper',
        model: has ? `${stories.length} stories` : '',
        effort: '',
        createdAt: BORN,
        lastActivityAt: b?.generatedAt || b?.failedAt || Date.now(),
        lastFocusedAt: 0,
        running: writing,
        unread: has && !read,
        hasError: (late && !writing) || noKey,
        starred: false,
        routine: '',
        prState: '',
        archived: false,
        hasTranscript: false,
        sizeBytes: 1000 * (1 + stories.length),
        source: 'news-desk',
        canOpen: true,
        canArchive: false,
        ref: { topic: topic.id, date },
      }
    })
  )
}

let cache = { at: 0, data: null, inflight: null }
/** Forget the last read: a flag just changed and the next scan must see it. */
export function refreshNews() {
  // Dropping the data too: keeping it would hand the next poll the stale desk and the
  // read one only after that, which is a button that does nothing until you look away.
  cache = { at: 0, data: null, inflight: null }
}
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
        console.warn('news:', err.message)
        return cache.data || []
      })
  }
  return cache.data || cache.inflight
}

export default {
  id: 'news',
  name: 'Newsroom',
  detect: async () => true,
  scanThreads,
  openThread: (ref) => ({ ok: true, browser: true, url: `${NEWS_URL}#${encodeURIComponent(ref?.topic || '')}` }),
  newSession: () => ({ ok: false, error: 'The desks write themselves each morning' }),
  setArchived: async () => ({ ok: false, error: 'Mark the briefing read; the desk stands down on its own' }),
}
