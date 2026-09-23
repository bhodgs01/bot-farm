/**
 * Putting an event from the Events desk on the calendar.
 *
 * The desk's stories are written for a person to read, not for a machine: a story carries a
 * headline and a paragraph, and the when and where live inside the prose — "Saturday,
 * September 26 at 8:00 p.m. in Helzberg Hall at the Kauffman Center, 1601 Broadway Blvd".
 * There is no date field to copy. So the story is read back out into a date, a time and a
 * place before anything is written, and Blake is shown that reading before it is saved: a
 * date lifted out of a sentence is a guess, and a wrong one lands silently in his week.
 *
 * Two steps for the same reason as the client emails: `readEvent` only reads, `addEvent`
 * writes. The page previews, shows him the result, and waits.
 *
 * Deliberately the KC Proto calendar. It is the only one this account can write to — his
 * personal calendar is shared with it read-only — so that is said out loud rather than
 * discovered when a taco festival fails to appear on his phone.
 */
import Anthropic from '@anthropic-ai/sdk'

const MODEL = process.env.CHAT_MODEL || 'claude-opus-5'
const CAL_API = 'https://www.googleapis.com/calendar/v3'
/** The calendar this account owns. `primary` is blake@kcproto.com. */
const CALENDAR_ID = process.env.CALENDAR_WRITE_ID || 'primary'
const TZ = process.env.CALENDAR_TZ || 'America/Chicago'

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null

const GMAIL = { id: process.env.GMAIL_CLIENT_ID || '', secret: process.env.GMAIL_CLIENT_SECRET || '', refresh: process.env.GMAIL_REFRESH_TOKEN || '' }
let access = { token: '', expiresAt: 0 }
/** The same Google credentials the mailroom uses; they carry the calendar scopes too. */
async function googleToken() {
  if (access.token && Date.now() < access.expiresAt - 60000) return access.token
  if (!GMAIL.id || !GMAIL.secret || !GMAIL.refresh) throw new Error('No Google credentials on this server')
  const body = new URLSearchParams({ client_id: GMAIL.id, client_secret: GMAIL.secret, refresh_token: GMAIL.refresh, grant_type: 'refresh_token' })
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`google token → ${res.status}`)
  const json = await res.json()
  access = { token: json.access_token, expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000 }
  return access.token
}

/** Today in Blake's clock, so "Saturday" in a story resolves to the right Saturday. */
function todayKC() {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ }).format(new Date())
}

/**
 * Read a story back out into an event. Returns `{ title, date, start, end, allDay, location }`
 * with times as HH:MM, or throws if the story does not actually say when it is — a story with
 * no date is not an event, and inventing one is worse than refusing.
 */
export async function readEvent(story) {
  if (!client) throw new Error('No Anthropic key on this server, so the date cannot be read out')
  const text = [story.headline, story.summary, story.why].filter(Boolean).join('\n')
  const res = await client.messages.create({
    model: MODEL,
    // Room for the model to think AND still finish the JSON: at 400 the thinking block ate
    // the budget and the object came back truncated, which reads as "no date in this story".
    max_tokens: 1500,
    system:
      'You turn a short news item about a local event into calendar fields. Today is ' +
      todayKC() +
      ` and the reader is in ${TZ}. Reply with JSON only, no prose, shaped: ` +
      '{"title":string,"date":"YYYY-MM-DD","end_date":"YYYY-MM-DD"|null,"start":"HH:MM"|null,' +
      '"end":"HH:MM"|null,"location":string|null,"confident":boolean}. ' +
      'Use 24-hour times. `start` is null when the item gives no clock time — that is an all-day ' +
      'event, which is correct and normal. `end_date` is only for something running across ' +
      'several days. Set confident false if the item never actually says which day it is on; ' +
      'do not guess a date from nothing.',
    messages: [{ role: 'user', content: text.slice(0, 4000) }],
  })
  const raw = (res.content || []).map((b) => b.text || '').join('').trim()
  const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
  let out
  try {
    out = JSON.parse(json)
  } catch {
    throw new Error('Could not read a date out of that story')
  }
  if (!out.confident || !/^\d{4}-\d{2}-\d{2}$/.test(String(out.date || ''))) {
    throw new Error("That story doesn't say which day it's on")
  }
  const time = (v) => (/^\d{2}:\d{2}$/.test(String(v || '')) ? v : null)
  return {
    title: String(out.title || story.headline || 'Event').slice(0, 200),
    date: out.date,
    endDate: /^\d{4}-\d{2}-\d{2}$/.test(String(out.end_date || '')) ? out.end_date : null,
    start: time(out.start),
    end: time(out.end),
    allDay: !time(out.start),
    location: out.location ? String(out.location).slice(0, 300) : '',
  }
}

/** The day after a date, for an all-day event's exclusive end. */
function nextDay(date) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** Write it to the calendar. Returns the event's id and its link. */
export async function addEvent({ event, story, who }) {
  const token = await googleToken()
  const body = {
    summary: event.title,
    location: event.location || undefined,
    description: [story?.summary, story?.url].filter(Boolean).join('\n\n').slice(0, 2000) || undefined,
    ...(event.allDay
      ? { start: { date: event.date }, end: { date: nextDay(event.endDate || event.date) } }
      : {
          start: { dateTime: `${event.date}T${event.start}:00`, timeZone: TZ },
          // No end time given: an hour is a better guess than a zero-length event, and it is
          // easy to stretch once it is on the calendar.
          end: {
            dateTime: `${event.endDate || event.date}T${event.end || String(Math.min(23, Number(event.start.slice(0, 2)) + 1)).padStart(2, '0') + event.start.slice(2)}:00`,
            timeZone: TZ,
          },
        }),
  }
  const res = await fetch(`${CAL_API}/calendars/${encodeURIComponent(CALENDAR_ID)}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`calendar → ${res.status} ${(await res.text().catch(() => '')).slice(0, 140)}`)
  const made = await res.json()
  console.log(`act: ${who} put "${event.title}" on the calendar for ${event.date}${event.start ? ' ' + event.start : ' (all day)'}`)
  return { id: made.id, link: made.htmlLink, title: event.title }
}
