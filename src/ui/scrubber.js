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
  let pages = []
  let index = 0
  let open = false
  let playing = false
  let timer = 0
  let stepMs = STEP_MS
  let stopAt = Infinity
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
          pages = Array.isArray(payload?.pages) ? payload.pages : []
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
    if (!on) {
      stepMs = STEP_MS
      stopAt = Infinity
      return
    }
    timer = setInterval(() => {
      if (index >= Math.min(snaps.length - 1, stopAt)) {
        setPlaying(false)
        return
      }
      show(index + 1)
    }, stepMs)
  }

  /**
   * Play one stretch of the recording in a fixed amount of time, whatever it holds — the
   * night is forty snapshots and a quiet afternoon is four, and both should take about ten
   * seconds to watch. Used for the overnight replay the morning opens with.
   */
  async function playWindow(fromAt, toAt, totalMs = 10000) {
    const first = snaps.findIndex((s) => s.at >= fromAt)
    if (first < 0) return false
    let last = first
    while (last + 1 < snaps.length && snaps[last + 1].at <= toAt) last++
    if (last - first < 2) return false
    // Open first and let it settle on "now"; the window is then wound back onto the night.
    await toggle(true)
    stopAt = last
    stepMs = Math.max(140, Math.round(totalMs / (last - first)))
    show(first)
    setPlaying(true)
    return true
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

  // A replay that started on its own must stop the moment he reaches for the map: the
  // colony he is touching is the live one, and a recording playing over it is a lie.
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (playing && !root.contains(e.target)) setPlaying(false)
    },
    true,
  )

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

  function renderCard(since, before, now, { overnight } = {}) {
    const then = handsOf(before)
    const nowHands = handsOf(now)
    const fresh = [...nowHands.values()].filter((h) => !then.has(h.id))
    const gone = [...then.values()].filter((h) => !nowHands.has(h.id))
    const delivered = [...marksOf(now).values()].filter((m) => !marksOf(before).has(m.id))
    // Anything the pager rang for while he was away. This goes first and stays even when
    // nothing else changed: being woken and not being told why is the worst of both.
    const rang = pages.filter((p) => p.at >= since)
    if (!fresh.length && !gone.length && !delivered.length && !rang.length) return false

    const hours = Math.round((Date.now() - since) / 3600000)
    const ago = hours >= 24 ? `${Math.round(hours / 24)} day${hours >= 48 ? 's' : ''}` : hours >= 1 ? `${hours} hour${hours === 1 ? '' : 's'}` : 'a while'
    const list = (items, glyph) =>
      items
        .slice(0, 6)
        .map((h) => `<li><span>${glyph}</span> ${escapeHtml(h.title)} <i>${escapeHtml(h.project || '')}</i></li>`)
        .join('')
    const paged = rang
      .slice(0, 4)
      .map((p) => `<li><span>🔔</span> ${escapeHtml(String(p.title || 'Paged you').replace(/^Bot Farm: /, ''))} <i>${escapeHtml(clock(p.at))}</i></li>`)
      .join('')
    card.innerHTML = `
      <header>While you were out <button class="btn icon ghost" data-act="dismiss" title="Dismiss">✕</button></header>
      <p class="sub">Since you last looked, ${escapeHtml(ago)} ago.</p>
      ${rang.length ? `<h4 class="paged">${rang.length === 1 ? 'The pager went off' : `The pager went off ${rang.length} times`}</h4><ul>${paged}${rang.length > 4 ? `<li class="more">+${rang.length - 4} more</li>` : ''}</ul>` : ''}
      ${fresh.length ? `<h4>${plural(fresh.length, 'new hand', 'new hands')}</h4><ul>${list(fresh, '▲')}${fresh.length > 6 ? `<li class="more">+${fresh.length - 6} more</li>` : ''}</ul>` : ''}
      ${gone.length ? `<h4>${plural(gone.length, 'came down', 'came down')}</h4><ul>${list(gone, '▼')}${gone.length > 6 ? `<li class="more">+${gone.length - 6} more</li>` : ''}</ul>` : ''}
      ${delivered.length ? `<h4>Delivered</h4><ul>${list(delivered, '✅')}</ul>` : ''}
      <div class="acts"><button class="btn" data-act="replay">${overnight ? 'Play the night back' : 'Play the day back'}</button></div>`
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
    const overnight = sleptThrough(since)
    if (renderCard(since, before, now, { overnight })) {
      hud?.hint?.(overnight ? 'Last night, in ten seconds — the summary is top-left' : 'While you were out — the summary is top-left')
    }
    // The first look of the morning gets the night played back at it: the hexes light up the
    // way they did at 2am, which is the only way anyone ever sees the hours the colony works
    // alone. Ten seconds, once, and any touch of the map stops it.
    if (overnight) await playWindow(since, Date.now(), 10000)
  }

  /**
   * True when the gap he was away for was the night — he stopped looking last evening and
   * this is the next morning. Not merely "a long time": an afternoon away is not a night,
   * and should not trigger a replay of hours he was awake for.
   */
  function sleptThrough(since) {
    const hourKC = (at) => Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Chicago' }).format(new Date(at)))
    const now = Date.now()
    const gapHours = (now - since) / 3600000
    const wakingUp = hourKC(now) >= 4 && hourKC(now) < 12
    const wentToBed = hourKC(since) >= 20 || hourKC(since) < 5
    return gapHours >= 3 && gapHours <= 20 && wakingUp && wentToBed
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
