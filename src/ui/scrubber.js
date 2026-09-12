/**
 * The day scrubber, and "while you were out".
 *
 * The colony already keeps a snapshot of who had a hand up every twenty minutes. That is a
 * recording of the day nobody was watching, so this plays it back: drag along the bottom
 * and the hexes light up the way they did at that moment, with the list of what wanted him
 * underneath. It is the same glow the live map uses, pointed at the past.
 *
 * The card that goes with it answers the question Blake actually asks first thing: what
 * happened since I last looked. New hands, hands that came down on their own, jobs
 * delivered — measured against the snapshot nearest his last visit, not guessed at.
 *
 * Nothing here writes anything. The only state it keeps is the timestamp of the last look,
 * per device, in localStorage.
 */
import { fetchHistory } from '../game/api.js'

const LAST_LOOK = 'botfarm.lastlook'
/** Below this, "since you last looked" is just "now" and the card would be noise. */
const MIN_GAP_MS = 40 * 60 * 1000
/** How long one snapshot lingers when the day is playing back on its own. */
const STEP_MS = 700

const read = (k) => {
  try {
    return Number(localStorage.getItem(k)) || 0
  } catch {
    return 0
  }
}
const write = (k, v) => {
  try {
    localStorage.setItem(k, String(v))
  } catch {
    /* private window: the scrubber still works, the card just always shows the day */
  }
}

const clock = (at) => new Date(at).toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' })
const dayName = (at) => new Date(at).toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'short' })

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

/**
 * Every snapshot from the days we asked for, oldest first. A day with no snapshots (the pod
 * was down, or it is 00:10) simply is not there.
 */
function flatten(payload) {
  const days = Array.isArray(payload?.days) ? payload.days : payload?.snapshots ? [{ day: payload.day, snapshots: payload.snapshots }] : []
  const out = []
  for (const d of days) for (const snap of d.snapshots || []) out.push({ ...snap, day: d.day })
  out.sort((a, b) => a.at - b.at)
  return out
}

const handsOf = (snap) => new Map((snap?.hands || []).map((h) => [h.id, h]))
const marksOf = (snap) => new Map((snap?.marks || []).map((m) => [m.id, m]))

export function installScrubber({ colony, hud, onFly }) {
  let snaps = []
  let index = 0
  let open = false
  let playing = false
  let timer = 0
  let loading = null

  const root = document.createElement('div')
  root.className = 'scrubber panel'
  root.hidden = true
  root.innerHTML = `
    <div class="row">
      <button class="btn icon ghost" data-act="play" title="Play the day back">▶</button>
      <input type="range" min="0" max="0" value="0" step="1" aria-label="Time of day" />
      <span class="at">—</span>
      <button class="btn icon ghost" data-act="close" title="Back to now (Y)">✕</button>
    </div>
    <div class="caption">Loading the day…</div>`
  document.body.appendChild(root)

  const card = document.createElement('div')
  card.className = 'wywo panel'
  card.hidden = true
  document.body.appendChild(card)

  const range = root.querySelector('input')
  const atLabel = root.querySelector('.at')
  const caption = root.querySelector('.caption')
  const playBtn = root.querySelector('[data-act="play"]')

  async function load(force) {
    if (snaps.length && !force) return snaps
    if (!loading) {
      loading = fetchHistory(2)
        .then((payload) => {
          snaps = flatten(payload)
          loading = null
          return snaps
        })
        .catch(() => {
          loading = null
          return []
        })
    }
    return loading
  }

  /** Paint the map and the caption at one moment. */
  function show(i) {
    if (!snaps.length) return
    index = Math.max(0, Math.min(snaps.length - 1, i))
    const snap = snaps[index]
    const hands = snap.hands || []
    const zones = new Set(hands.map((h) => h.project).filter(Boolean))
    colony.setReplay(zones)
    range.value = String(index)
    const sameDay = snaps[snaps.length - 1]?.day === snap.day
    atLabel.textContent = `${sameDay ? '' : `${dayName(snap.at)} `}${clock(snap.at)}`
    const blocked = hands.filter((h) => h.kind === 'blocked')
    const names = hands.slice(0, 8).map((h) => `${h.kind === 'blocked' ? '!' : '?'} ${escapeHtml(h.title)} <i>${escapeHtml(h.project || '')}</i>`)
    caption.innerHTML = hands.length
      ? `<b>${plural(hands.length, 'hand', 'hands')} up</b>${blocked.length ? `, ${blocked.length} blocked` : ''} · ${names.join(' · ')}${hands.length > 8 ? ` · +${hands.length - 8} more` : ''}`
      : '<b>Nothing wanted you</b> at this point in the day.'
  }

  function setPlaying(on) {
    playing = on
    playBtn.textContent = on ? '❚❚' : '▶'
    playBtn.title = on ? 'Pause' : 'Play the day back'
    clearInterval(timer)
    if (!on) return
    timer = setInterval(() => {
      if (index >= snaps.length - 1) {
        setPlaying(false)
        return
      }
      show(index + 1)
    }, STEP_MS)
  }

  async function toggle(on) {
    open = on === undefined ? !open : Boolean(on)
    root.hidden = !open
    if (!open) {
      setPlaying(false)
      colony.setReplay(null)
      return
    }
    card.hidden = true
    const list = await load()
    if (!list.length) {
      caption.textContent = 'No history recorded yet. The map keeps a snapshot every twenty minutes.'
      range.max = '0'
      return
    }
    range.max = String(list.length - 1)
    show(list.length - 1)
  }

  range.addEventListener('input', () => {
    setPlaying(false)
    show(Number(range.value))
  })
  root.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act
    if (act === 'close') toggle(false)
    if (act === 'play') {
      if (!playing && index >= snaps.length - 1) show(0)
      setPlaying(!playing)
    }
  })

  // ── while you were out ──────────────────────────────────────────────────────────────
  function stampLook() {
    write(LAST_LOOK, Date.now())
  }

  /** The snapshot that was current when he last looked; null when we have nothing that old. */
  function snapshotAt(when) {
    let found = null
    for (const s of snaps) {
      if (s.at <= when) found = s
      else break
    }
    return found
  }

  function renderCard(since, before, now) {
    const then = handsOf(before)
    const nowHands = handsOf(now)
    const fresh = [...nowHands.values()].filter((h) => !then.has(h.id))
    const gone = [...then.values()].filter((h) => !nowHands.has(h.id))
    const delivered = [...marksOf(now).values()].filter((m) => !marksOf(before).has(m.id))
    if (!fresh.length && !gone.length && !delivered.length) return false

    const hours = Math.round((Date.now() - since) / 3600000)
    const ago = hours >= 24 ? `${Math.round(hours / 24)} day${hours >= 48 ? 's' : ''}` : hours >= 1 ? `${hours} hour${hours === 1 ? '' : 's'}` : 'a while'
    const list = (items, glyph) =>
      items
        .slice(0, 6)
        .map((h) => `<li><span>${glyph}</span> ${escapeHtml(h.title)} <i>${escapeHtml(h.project || '')}</i></li>`)
        .join('')
    card.innerHTML = `
      <header>While you were out <button class="btn icon ghost" data-act="dismiss" title="Dismiss">✕</button></header>
      <p class="sub">Since you last looked, ${escapeHtml(ago)} ago.</p>
      ${fresh.length ? `<h4>${plural(fresh.length, 'new hand', 'new hands')}</h4><ul>${list(fresh, '▲')}${fresh.length > 6 ? `<li class="more">+${fresh.length - 6} more</li>` : ''}</ul>` : ''}
      ${gone.length ? `<h4>${plural(gone.length, 'came down', 'came down')}</h4><ul>${list(gone, '▼')}${gone.length > 6 ? `<li class="more">+${gone.length - 6} more</li>` : ''}</ul>` : ''}
      ${delivered.length ? `<h4>Delivered</h4><ul>${list(delivered, '✅')}</ul>` : ''}
      <div class="acts"><button class="btn" data-act="replay">Play the day back</button></div>`
    card.hidden = false
    return true
  }

  card.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act
    if (act === 'dismiss') card.hidden = true
    if (act === 'replay') {
      card.hidden = true
      toggle(true)
    }
  })

  /** Called once the first roster is on the map, so the card lands on a colony, not a void. */
  async function greet() {
    const since = read(LAST_LOOK)
    stampLook()
    if (!since || Date.now() - since < MIN_GAP_MS) return
    const list = await load()
    if (list.length < 2) return
    const before = snapshotAt(since)
    const now = list[list.length - 1]
    if (!before || before === now) return
    if (renderCard(since, before, now)) hud?.hint?.('While you were out — the summary is top-left')
  }

  // A tab left open while he is actually at the desk should not later claim he was away.
  // Focus, not merely visibility: a window behind others, or a machine with its screen off,
  // is not somebody watching the map.
  const stampIfWatching = () => {
    if (document.visibilityState === 'visible' && document.hasFocus()) stampLook()
  }
  window.addEventListener('beforeunload', stampIfWatching)
  document.addEventListener('visibilitychange', stampIfWatching)
  window.addEventListener('focus', stampIfWatching)
  setInterval(stampIfWatching, 5 * 60 * 1000)

  return {
    toggle,
    greet,
    get open() {
      return open
    },
    /** Fly to a zone from the caption, if anything ever wants that. */
    fly: onFly,
  }
}
