/**
 * Mascots: a couple of characters wandering the colony when nothing needs you. They carry
 * no data and never raise a hand; they are here so the place feels lived-in. Clawd the
 * lobster ambles the paths, and a dog trots between the hexes.
 *
 * Low-poly on purpose, built from primitives like the buildings. Each picks a spot near a
 * random hex, walks there following the ground, pauses, and picks another. Cheap: a handful
 * of meshes, one straight walk at a time, no navigation grid.
 */
import * as THREE from 'three'
import { FAMILY_IDS, build as buildFamily, preload as preloadFamily } from './family-builders.js'
import { createJohnny5 } from './johnny-five.js'
import { createTotoro } from './totoro.js'
import { createTotoroProcession } from './totoro-companions.js'
import { createSootSprite } from './soot-sprites.js'
import { createUmbrella } from './umbrella.js'

const WALK = 1.5 // m/s, an amble

function createClawd() {
  const g = new THREE.Group()
  const mat = (color) => new THREE.MeshStandardMaterial({
    color, roughness: 0.78, metalness: 0.02, flatShading: true
  })
  const shell = mat(0xc7402f)
  const bright = mat(0xe15b42)
  const joint = mat(0x79291f)
  const black = mat(0x151b20)
  const white = mat(0xffeed8)

  const oval = (x, y, z) => {
    const geo = new THREE.SphereGeometry(1, 10, 7)
    geo.scale(x, y, z)
    return geo
  }
  const add = (parent, geo, material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, material)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    parent.add(m)
    return m
  }

  const body = add(g, oval(0.27, 0.23, 0.34), shell, 0, 0.39, -0.08)
  body.rotation.x = 0.12
  add(g, oval(0.235, 0.115, 0.29), joint, 0, 0.27, -0.075)

  const hg = oval(0.245, 0.215, 0.24)
  hg.translate(0, 0.06, 0.1)
  const head = add(g, hg, bright, 0, 0.43, 0.16)
  g.userData.head = head

  for (const s of [-1, 1]) {
    const sg = new THREE.CylinderGeometry(0.04, 0.055, 0.2, 7)
    sg.translate(0, 0.1, 0)
    const stalk = add(head, sg, shell, s * 0.13, 0.2, 0.17)
    stalk.rotation.z = -s * 0.22
    add(stalk, oval(0.065, 0.074, 0.063), black, 0, 0.22, 0.012)
    add(stalk, oval(0.019, 0.021, 0.012), white, -0.015, 0.242, 0.066)

    const ag = new THREE.TorusGeometry(0.32, 0.018, 5, 12, 1.65)
    ag.translate(-0.32, 0, 0)
    ag.rotateY(-Math.PI / 2)
    const antenna = add(head, ag, joint, s * 0.18, 0.17, 0.06)
    antenna.rotation.y = s * 0.28
  }

  const legAngle = 2.48
  const legRootY = -0.34 * Math.cos(legAngle)
  for (const s of [-1, 1]) {
    for (const z of [-0.26, -0.055, 0.15]) {
      const lg = new THREE.ConeGeometry(0.065, 0.34, 6)
      lg.translate(0, 0.17, 0)
      lg.rotateZ(s * legAngle)
      add(g, lg, shell, s * 0.19, legRootY, z)
    }
  }

  const tg = oval(0.205, 0.12, 0.135)
  tg.translate(0, -0.025, -0.09)
  const tail = add(g, tg, shell, 0, 0.37, -0.31)
  g.userData.tail = tail
  add(tail, oval(0.181, 0.103, 0.055), joint, 0, -0.027, -0.178)
  add(tail, oval(0.17, 0.105, 0.115), shell, 0, -0.005, -0.235)
  add(tail, oval(0.146, 0.087, 0.048), joint, 0, 0.013, -0.307)
  add(tail, oval(0.135, 0.088, 0.095), bright, 0, 0.045, -0.36)

  for (const s of [-1, 0, 1]) {
    const fg = oval(0.09, 0.045, 0.115)
    fg.translate(0, 0, -0.065)
    const fan = add(tail, fg, shell, s * 0.065, 0.08, -0.37)
    fan.rotation.y = -s * 0.48
    fan.rotation.x = 0.24
  }

  g.userData.claws = []
  for (const s of [-1, 1]) {
    const arm = add(g, oval(0.09, 0.09, 0.205), joint,
      s * 0.285, 0.35, 0.25)
    arm.rotation.y = s * 0.5

    const claw = new THREE.Group()
    claw.position.set(s * 0.405, 0.37, 0.42)
    claw.rotation.y = s * 0.18
    g.add(claw)

    add(claw, oval(0.145, 0.115, 0.18), shell, 0, 0, 0.08)
    add(claw, oval(0.105, 0.06, 0.17), bright, 0, -0.065, 0.245)

    const jg = oval(0.12, 0.07, 0.2)
    jg.translate(0, 0.015, 0.18)
    claw.userData.jaw = add(claw, jg, bright, 0, 0.075, 0.025)
    g.userData.claws.push(claw)
  }

  g.scale.setScalar(0.85)
  return g
}

function createColonyDog() {
  const g = new THREE.Group()
  const mat = (color) => new THREE.MeshStandardMaterial({
    color, roughness: 0.82, metalness: 0.01, flatShading: true
  })
  const tan = mat(0xc48b52)
  const cream = mat(0xefcf96)
  const brown = mat(0x65402d)
  const black = mat(0x192026)
  const teal = mat(0x348f98)
  const white = mat(0xfff5dc)

  const oval = (x, y, z) => {
    const geo = new THREE.SphereGeometry(1, 10, 7)
    geo.scale(x, y, z)
    return geo
  }
  const add = (parent, geo, material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, material)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    parent.add(m)
    return m
  }

  add(g, oval(0.29, 0.285, 0.435), tan, 0, 0.385, -0.12)
  add(g, oval(0.215, 0.22, 0.15), cream, 0, 0.4, 0.2)

  for (const x of [-0.185, 0.185]) {
    for (const z of [-0.395, 0.16]) {
      add(g, new THREE.CylinderGeometry(0.09, 0.12, 0.28, 8),
        tan, x, 0.14, z)
    }
  }

  add(g, new THREE.TorusGeometry(0.205, 0.035, 6, 12),
    teal, 0, 0.48, 0.265)

  const hg = oval(0.255, 0.245, 0.255)
  hg.translate(0, 0.1, 0.065)
  const head = add(g, hg, tan, 0, 0.52, 0.265)
  g.userData.head = head

  add(head, oval(0.18, 0.115, 0.185), cream, 0, 0.025, 0.29)
  add(head, oval(0.105, 0.075, 0.065), black, 0, 0.07, 0.46)

  for (const s of [-1, 1]) {
    add(head, oval(0.048, 0.061, 0.035), black,
      s * 0.125, 0.18, 0.285)
    add(head, oval(0.014, 0.017, 0.012), white,
      s * 0.125 - 0.01, 0.201, 0.315)

    const eg = oval(0.1, 0.2, 0.115)
    eg.translate(0, -0.135, 0)
    const ear = add(head, eg, brown, s * 0.235, 0.2, 0.035)
    ear.rotation.z = s * 0.16
    ear.rotation.x = -0.15
  }

  const tg = new THREE.ConeGeometry(0.09, 0.4, 8)
  tg.translate(0, 0.2, 0)
  tg.rotateX(-1.05)
  g.userData.tail = add(g, tg, brown, 0, 0.45, -0.44)

  g.scale.setScalar(0.85)
  return g
}

function createPickle() {
  const g = new THREE.Group()
  const mat = (color) => new THREE.MeshStandardMaterial({
    color, roughness: 0.86, metalness: 0.01, flatShading: true
  })
  const sand = mat(0xe8c15a)
  const cream = mat(0xf4dda0)
  const spots = mat(0x765032)
  const eyes = mat(0x22242a)
  const white = mat(0xfff4d7)

  const oval = (x, y, z) => {
    const geo = new THREE.SphereGeometry(1, 10, 7)
    geo.scale(x, y, z)
    return geo
  }
  const add = (parent, geo, material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, material)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    parent.add(m)
    return m
  }

  add(g, oval(0.205, 0.14, 0.34), sand, 0, 0.245, 0.025)
  add(g, oval(0.18, 0.07, 0.29), cream, 0, 0.16, 0.055)

  for (const s of [-1, 1]) {
    for (const z of [-0.19, 0.23]) {
      const leg = add(g, oval(0.18, 0.075, 0.09), sand,
        s * 0.23, 0.12, z)
      leg.rotation.z = -s * 0.25
      leg.rotation.y = s * (z > 0 ? -0.35 : 0.35)
      add(g, oval(0.115, 0.055, 0.12), cream,
        s * 0.365, 0.055, z + 0.025)
    }
  }

  const hg = oval(0.265, 0.16, 0.24)
  hg.translate(0, 0.025, 0.1)
  const head = add(g, hg, sand, 0, 0.285, 0.34)
  g.userData.head = head
  add(head, oval(0.205, 0.075, 0.16), cream, 0, -0.045, 0.21)

  for (const s of [-1, 1]) {
    add(head, oval(0.077, 0.096, 0.075), eyes,
      s * 0.225, 0.095, 0.13)
    add(head, oval(0.022, 0.026, 0.018), white,
      s * 0.235, 0.125, 0.192)
    add(head, oval(0.019, 0.012, 0.012), spots,
      s * 0.08, 0.03, 0.335)
  }

  const smile = new THREE.TorusGeometry(0.12, 0.012, 5, 12, Math.PI)
  smile.scale(1.25, 0.38, 1)
  smile.rotateZ(Math.PI)
  add(head, smile, spots, 0, -0.025, 0.354)

  for (const [x, z, r] of [
    [-0.105, -0.14, 0.043],
    [0.09, -0.08, 0.05],
    [-0.1, 0.065, 0.048],
    [0.1, 0.15, 0.043],
    [0.015, 0.24, 0.038]
  ]) {
    const u = (x / 0.205) ** 2 + ((z - 0.025) / 0.34) ** 2
    const y = 0.245 + 0.14 * Math.sqrt(1 - u)
    add(g, oval(r, 0.018, r * 1.15), spots, x, y, z)
  }

  const profile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.085, 0),
    new THREE.Vector2(0.13, 0.09),
    new THREE.Vector2(0.155, 0.2),
    new THREE.Vector2(0.135, 0.31),
    new THREE.Vector2(0.09, 0.43),
    new THREE.Vector2(0.04, 0.53),
    new THREE.Vector2(0, 0.58)
  ]
  const tg = new THREE.LatheGeometry(profile, 12)
  tg.translate(0, -0.015, 0)
  tg.rotateX(-Math.PI / 2)
  const tail = add(g, tg, sand, 0, 0.23, -0.265)
  g.userData.tail = tail

  add(tail, oval(0.047, 0.016, 0.053), spots, -0.035, 0.146, -0.18)
  add(tail, oval(0.042, 0.016, 0.048), spots, 0.028, 0.126, -0.3)
  add(tail, oval(0.029, 0.014, 0.036), spots, 0, 0.073, -0.44)

  g.scale.setScalar(0.85)
  return g
}

function createBlake() {
  const g = new THREE.Group()

  const mat = (color) => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.8,
    metalness: 0.02,
    flatShading: true
  })

  const skin = mat(0xe4ae88)
  const hair = mat(0x514137)
  const beard = mat(0x79513c)
  const shirt = mat(0x159daf)
  const pants = mat(0x35465b)
  const shoes = mat(0x242830)
  const frames = mat(0x242322)
  const white = mat(0xfffcf3)
  const dark = mat(0x26201e)

  const add = (parent, geo, material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, material)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    parent.add(m)
    return m
  }

  const oval = (x, y, z) => {
    const g = new THREE.SphereGeometry(1, 12, 8)
    g.scale(x, y, z)
    return g
  }

  // Chunky shirt: wider at the bottom.
  add(g, new THREE.CylinderGeometry(
    0.235, 0.285, 0.49, 10
  ), shirt, 0, 0.665, 0)

  // Hip origins. Geometry extends downward from each joint.
  const legs = []
  for (const s of [-1, 1]) {
    const geo = new THREE.BoxGeometry(0.17, 0.25, 0.19)
    geo.translate(0, -0.125, 0)
    const leg = add(g, geo, pants, s * 0.125, 0.37, 0)

    // Shoe bottom is exactly y = 0 in the standing pose.
    add(
      leg,
      new THREE.BoxGeometry(0.205, 0.12, 0.29),
      shoes,
      0, -0.31, 0.045
    )
    legs.push(leg)
  }

  // Shoulder origins. Mitten hands inherit the arm swing.
  const arms = []
  for (const s of [-1, 1]) {
    const geo = oval(0.10, 0.155, 0.105)
    geo.translate(0, -0.135, 0)
    const arm = add(g, geo, shirt, s * 0.30, 0.855, 0)
    add(arm, oval(0.095, 0.09, 0.10), skin, 0, -0.305, 0.015)
    arms.push(arm)
  }

  // Head pivots at the neck; its center is above the origin.
  const headGeo = oval(0.365, 0.35, 0.29)
  headGeo.translate(0, 0.24, 0)
  const head = add(g, headGeo, skin, 0, 1.065, 0)

  // All following coordinates are local to the head.
  for (const s of [-1, 1]) {
    add(head, oval(0.065, 0.095, 0.065), skin,
      s * 0.35, 0.22, 0)
  }

  // Cropped hair: rear cap leaves the high forehead exposed.
  add(head, oval(0.351, 0.30, 0.175), hair, 0, 0.285, -0.13)
  add(head, oval(0.19, 0.045, 0.105), hair, 0, 0.566, -0.065)

  // Big South Park eyes with tiny fixed pupils.
  for (const s of [-1, 1]) {
    add(head, oval(0.112, 0.119, 0.035), white,
      s * 0.119, 0.285, 0.264)
    add(head, oval(0.019, 0.024, 0.012), dark,
      s * 0.105, 0.281, 0.300)
  }

  // Bold glasses. Flattened oval rings remain legible at map scale.
  for (const s of [-1, 1]) {
    const ring = new THREE.TorusGeometry(0.112, 0.014, 4, 12)
    ring.scale(1.10, 0.99, 0.65)
    add(head, ring, frames, s * 0.128, 0.285, 0.310)
  }
  add(head, new THREE.BoxGeometry(0.042, 0.023, 0.022),
    frames, 0, 0.308, 0.313)

  // Simple flat beard and moustache, behind expression mouths.
  add(head, oval(0.225, 0.115, 0.037), beard, 0, 0.074, 0.220)
  add(head, oval(0.107, 0.029, 0.015), beard, 0, 0.150, 0.270)

  // Face variants: every mesh belongs to the head.
  // Eyes and glasses stay fixed; only these meshes are toggled.
  const mouthLine = (width, height, y) =>
    add(head, new THREE.BoxGeometry(width, height, 0.012),
      dark, 0, y, 0.275)

  const brow = (x, y, angle = 0) => {
    const m = add(
      head,
      new THREE.BoxGeometry(0.092, 0.020, 0.012),
      hair, x, y, 0.268
    )
    m.rotation.z = angle
    return m
  }

  const mouthNeutral = mouthLine(0.080, 0.014, 0.094)

  // Lower semicircle: a clear U-shaped smile.
  const smileGeo = new THREE.TorusGeometry(
    0.061, 0.011, 4, 12, Math.PI
  )
  smileGeo.rotateZ(Math.PI)
  smileGeo.scale(1, 0.62, 0.55)
  const mouthSmile = add(head, smileGeo, dark, 0, 0.119, 0.279)
  const browHappyL = brow(-0.122, 0.424, -0.10)
  const browHappyR = brow(0.122, 0.424, 0.10)

  const mouthO = add(head, oval(0.031, 0.040, 0.010),
    dark, 0, 0.091, 0.278)
  const browUpL = brow(-0.122, 0.449, 0)
  const browUpR = brow(0.122, 0.449, 0)

  const mouthFlat = mouthLine(0.099, 0.017, 0.085)
  const browAngryL = brow(-0.119, 0.410, -0.28)
  const browAngryR = brow(0.119, 0.410, 0.28)

  const mouthSmall = mouthLine(0.043, 0.013, 0.087)

  // Flat upper-half eye covers, behind the glasses.
  // The underlying eye whites and pupils never change.
  const lidGeo = () => {
    const geo = new THREE.SphereGeometry(
      1, 12, 4, 0, Math.PI * 2, 0, Math.PI / 2
    )
    geo.scale(0.111, 0.119, 0.010)
    return geo
  }
  const eyelidL = add(head, lidGeo(), skin,
    -0.119, 0.285, 0.310)
  const eyelidR = add(head, lidGeo(), skin,
    0.119, 0.285, 0.310)

  g.userData.arms = arms
  g.userData.legs = legs
  g.userData.head = head

  g.userData.expressions = {
    neutral: [mouthNeutral],
    happy: [mouthSmile, browHappyL, browHappyR],
    surprised: [mouthO, browUpL, browUpR],
    annoyed: [mouthFlat, browAngryL, browAngryR],
    sleepy: [mouthSmall, eyelidL, eyelidR]
  }

  for (const [name, meshes] of Object.entries(g.userData.expressions)) {
    for (const mesh of meshes) mesh.visible = name === 'neutral'
  }

  g.scale.setScalar(0.85)
  return g
}

let _fridayCache = { at: 0, val: false }
/** True on a Kansas City Friday, cached to the minute — Pickle's cricket day. */
function isFridayKC() {
  const now = Date.now()
  if (now - _fridayCache.at < 60000) return _fridayCache.val
  const wd = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'America/Chicago' }).format(new Date())
  _fridayCache = { at: now, val: wd === 'Fri' }
  return _fridayCache.val
}

const KINDS = {
  dog: { build: createColonyDog, name: "Ja'Barkus", intro: "I'm Ja'Barkus, the house dog. I have no job on the map — I just trot between the hexes and wag at everyone. Good boy." },
  lobster: { build: createClawd, name: 'Clawd', intro: "I'm Clawd, the mascot. Red, chunky, mostly claws. I patrol the paths and pinch at nothing in particular. Named after the feral one in the cluster." },
  gecko: {
    build: createPickle,
    name: 'Carti',
    intro: "I'm Carti, Kai's leopard gecko. I amble the colony and store my snacks in my tail.",
    reminder: () => (isFridayKC() ? { badge: '🦗', say: "I'm hungry, buy me crickets", note: "Crickets today — Kai's gecko needs feeding." } : null),
  },
}

// The family: South Park-style people with photographic faces (ChatGPT's Bot_Farm_Family).
// Each walks the colony, swings its arms, and cycles expressions. Name and intro ride on the
// built group's userData, so these entries only need the builder.
for (const id of FAMILY_IDS) KINDS[id] = { build: () => buildFamily(id) }

// Johnny 5: a tracked robot who patrols the colony and reports what he's seen. He drives his
// own treads and arms; the click card is special (a 6-hour rundown), handled in main.js.
KINDS.johnny5 = { build: createJohnny5, name: 'Johnny 5', intro: 'Johnny 5 is alive! I roll the colony and log what I see. Input, please.' }

// Totoro: a big, quiet forest guardian who ambles the colony. Like Johnny 5 he drives his own
// limbs (paws, ears, tail, breathing) from userData.update, so the walk loop feeds him a speed
// and leaves the posing to him. No job, no hand up — he's here so the place feels looked after.
KINDS.totoro = { build: createTotoro, name: 'Totoro', intro: 'A quiet guardian of the colony. An enormous appetite, and a knack for turning up right when the rain starts.' }

/** Characters built to the people contract (arms, legs, swappable faces) walk and emote. */
const isPerson = (m) => Boolean(m.mesh.userData.arms || m.mesh.userData.legs)

/** A little name that floats over a pet's head, always facing the camera. */
function makeNameplate(text) {
  const cw = 256
  const ch = 72
  const cv = document.createElement('canvas')
  cv.width = cw
  cv.height = ch
  const ctx = cv.getContext('2d')
  ctx.font = "600 34px system-ui, -apple-system, 'Segoe UI', sans-serif"
  ctx.textBaseline = 'middle'
  const w = Math.min(cw - 12, ctx.measureText(text).width + 40)
  const x = (cw - w) / 2
  ctx.fillStyle = 'rgba(8,10,20,0.72)'
  const r = 20
  ctx.beginPath()
  ctx.moveTo(x + r, 8)
  ctx.arcTo(x + w, 8, x + w, ch - 8, r)
  ctx.arcTo(x + w, ch - 8, x, ch - 8, r)
  ctx.arcTo(x, ch - 8, x, 8, r)
  ctx.arcTo(x, 8, x + w, 8, r)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.fillText(text, cw / 2, ch / 2 + 1)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }))
  sp.scale.set(0.9, 0.9 * ch / cw, 1)
  sp.renderOrder = 12
  return sp
}

/**
 * A comic speech bubble that floats over a character's head: rounded white panel with a
 * tail pointing down at them, wrapped to at most three lines. Same canvas-sprite trick as
 * the nameplate, so it always faces the camera and costs one draw call.
 */
/** A little pink heart to float over a family member — Ema wears one when she's texted. */
function makeHeart() {
  const s = 128
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = c.getContext('2d')
  ctx.font = '96px system-ui, -apple-system, "Segoe UI Emoji", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('💗', s / 2, s / 2 + 6)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }))
  sp.scale.set(0.72, 0.72, 1)
  return sp
}

function makeSpeechBubble(text) {
  const cw = 512
  const pad = 26
  const lh = 44
  const tail = 22
  const font = "600 34px system-ui, -apple-system, 'Segoe UI', sans-serif"
  const measure = document.createElement('canvas').getContext('2d')
  measure.font = font

  // Wrap to the panel width, at most three lines, ellipsis on the last if it overruns.
  const maxText = cw - pad * 2 - 20
  const lines = []
  let line = ''
  let truncated = false
  const words = String(text).split(/\s+/).filter(Boolean)
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i]
    if (measure.measureText(next).width <= maxText || !line) {
      line = next
      continue
    }
    if (lines.length === 2) {
      // No room for a fourth line: this word and everything after it is dropped.
      truncated = true
      break
    }
    lines.push(line)
    line = words[i]
  }
  if (line) lines.push(line)
  if (truncated && lines.length) {
    let last = lines[lines.length - 1]
    while (last.length > 1 && measure.measureText(`${last}…`).width > maxText) last = last.slice(0, -1)
    lines[lines.length - 1] = `${last}…`
  }
  if (!lines.length) lines.push('…')

  const boxW = Math.min(cw - 8, Math.max(...lines.map((l) => measure.measureText(l).width)) + pad * 2)
  const boxH = lines.length * lh + pad * 2 - 12
  const ch = boxH + tail + 12
  const cv = document.createElement('canvas')
  cv.width = cw
  cv.height = ch
  const ctx = cv.getContext('2d')
  const x = (cw - boxW) / 2
  const r = 22

  ctx.font = font
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = 14
  ctx.shadowOffsetY = 3
  ctx.fillStyle = 'rgba(255,255,255,0.97)'
  ctx.beginPath()
  ctx.moveTo(x + r, 4)
  ctx.arcTo(x + boxW, 4, x + boxW, boxH, r)
  ctx.arcTo(x + boxW, boxH, x, boxH, r)
  // the tail, drawn as part of the same path so the shadow wraps it too
  ctx.lineTo(cw / 2 + 20, boxH)
  ctx.lineTo(cw / 2 - 4, boxH + tail)
  ctx.lineTo(cw / 2 - 14, boxH)
  ctx.arcTo(x, boxH, x, 4, r)
  ctx.arcTo(x, 4, x + boxW, 4, r)
  ctx.closePath()
  ctx.fill()

  ctx.shadowColor = 'transparent'
  ctx.fillStyle = '#0e1626'
  ctx.textAlign = 'center'
  lines.forEach((l, i) => ctx.fillText(l, cw / 2, pad + 6 + i * lh))

  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }))
  const worldW = 2.05
  sp.scale.set(worldW, worldW * ch / cw, 1)
  sp.renderOrder = 13
  sp.userData.worldH = worldW * ch / cw
  return sp
}

export class Mascots {
  constructor(scene, colony) {
    this.scene = scene
    this.colony = colony
    this.group = new THREE.Group()
    this.group.name = 'mascots'
    scene.add(this.group)
    this.list = []
    this._tmp = new THREE.Vector3()
    this.spawn('dog')
    this.spawn('lobster')
    this.spawn('gecko')
    // The whole family walks the colony. Warm their face textures, then spawn each one.
    preloadFamily()
    for (const id of FAMILY_IDS) this.spawn(id)
    this.spawn('johnny5')
    this.spawn('totoro')
    // Totoro's little ones — Chu (blue) and Chibi (white) — hop along behind him. They're not
    // wanderers with cards of their own; a procession controller trails the main Totoro, so
    // they stay out of this.list (no pick, no crew tile, no card) and just follow and hop.
    const totoro = this.list.find((m) => m.kind === 'totoro')
    if (totoro) {
      this.totoroCompanions = createTotoroProcession(totoro.mesh)
      this.group.add(this.totoroCompanions)
      // His umbrella rides on his back, held up over his head, and only shows when the weather
      // desk says it's actually raining in KC — the bus-stop pose. Child of his mesh so it
      // walks and sways with him.
      this.totoroUmbrella = createUmbrella()
      this.totoroUmbrella.position.set(0.28, 0.72, 0.06)
      this.totoroUmbrella.rotation.z = -0.14
      this.totoroUmbrella.visible = false
      totoro.mesh.add(this.totoroUmbrella)
    }
  }

  spawn(kind) {
    const spec = KINDS[kind]
    if (!spec) return
    const mesh = spec.build()
    if (!mesh) return
    this.group.add(mesh)
    // Pets carry name/intro on the KINDS entry; the family carries them on the built group.
    const name = spec.name || mesh.userData.displayName || 'Someone'
    const intro = spec.intro || mesh.userData.intro || ''
    const nameplate = makeNameplate(name)
    this.group.add(nameplate)
    const m = {
      kind,
      name,
      baseName: name,
      intro,
      baseIntro: intro,
      reminderFn: spec.reminder || null,
      reminderKey: '',
      nameplate,
      // Set from Chore Quest via setSays(); '' means no bubble.
      say: '',
      bubble: null,
      mesh,
      pos: new THREE.Vector3(0, 0, 0),
      target: new THREE.Vector3(),
      yaw: Math.random() * Math.PI * 2,
      speed: WALK * (0.85 + Math.random() * 0.3),
      pause: 1 + Math.random() * 2,
      phase: Math.random() * Math.PI * 2,
      // People walk (arms/legs swing eased by `gait`) and cycle a face (`expr`).
      gait: 0,
      expr: 'neutral',
      exprUntil: 0,
    }
    // Float the name just above whatever was built, so a tall person and a low gecko both clear.
    const box = new THREE.Box3().setFromObject(mesh)
    m.nameOffset = Math.max(1.15, (box.max.y - box.min.y) + 0.25)
    this._pickTarget(m)
    m.pos.copy(m.target) // start already somewhere on the map
    this._pickTarget(m)
    this.list.push(m)
    this._applyReminder(m)
  }

  /**
   * What each character is saying right now, keyed by mascot kind ({kai: 'hi', ...}).
   * A kind that is missing or empty loses its bubble.
   */
  setSays(map) {
    const says = map || {}
    for (const m of this.list) {
      const want = typeof says[m.kind] === 'string' ? says[m.kind].trim() : ''
      if (want === m.say) continue
      m.say = want
      if (m.bubble) {
        this.group.remove(m.bubble)
        m.bubble.material.map?.dispose?.()
        m.bubble.material.dispose?.()
        m.bubble = null
      }
      if (want) {
        m.bubble = makeSpeechBubble(want)
        this.group.add(m.bubble)
      }
    }
  }

  /** Float a heart over a family member (Ema when she's texted on the Dada chat), or clear it. */
  setAlert(kind, on) {
    const m = this.list.find((x) => x.kind === kind)
    if (!m) return
    if (on && !m.alert) {
      m.alert = makeHeart()
      this.group.add(m.alert)
    } else if (!on && m.alert) {
      this.group.remove(m.alert)
      m.alert.material.map?.dispose?.()
      m.alert.material.dispose?.()
      m.alert = null
    }
  }

  /** A pet with a reminder (Pickle on Fridays) wears a 🦗 on its name and adds a line to its card. */
  /** Blake dismissed a reminder (fed Carti): mute its badge/bubble until it's re-armed. */
  muteReminder(kind, muted) {
    const m = this.list.find((x) => x.kind === kind)
    if (m) m.reminderMuted = Boolean(muted)
  }

  _applyReminder(m) {
    if (!m.reminderFn) return
    const r = m.reminderMuted ? null : m.reminderFn()
    const key = r ? r.badge : ''
    if (key === m.reminderKey) return
    m.reminderKey = key
    m.name = r ? `${r.badge} ${m.baseName}` : m.baseName
    m.intro = r ? `${m.baseIntro}

${r.note}` : m.baseIntro
    this.group.remove(m.nameplate)
    m.nameplate.material.map?.dispose?.()
    m.nameplate.material.dispose?.()
    m.nameplate = makeNameplate(m.name)
    this.group.add(m.nameplate)
    // A reminder can also make the mascot say something out loud (Carti on Fridays).
    if (m.reminderBubble) {
      this.group.remove(m.reminderBubble)
      m.reminderBubble.material.map?.dispose?.()
      m.reminderBubble.material.dispose?.()
      m.reminderBubble = null
    }
    if (r && r.say) {
      m.reminderBubble = makeSpeechBubble(r.say)
      this.group.add(m.reminderBubble)
    }
  }

  /** Somewhere near a random hex, so the wanderers stay where they can be seen. */
  _pickTarget(m) {
    const plots = this.colony.plotOrder
    if (!plots || !plots.length) {
      m.target.set((Math.random() - 0.5) * 30, 0, (Math.random() - 0.5) * 30)
      return
    }
    const plot = plots[(Math.random() * plots.length) | 0]
    const c = plot.middle || plot.center
    m.target.set(c.x + (Math.random() - 0.5) * 6, 0, c.z + (Math.random() - 0.5) * 6)
  }

  // ── soot sprites: they own the dark ────────────────────────────────────────────────
  /** A random spot on some hex, for scattering the soot swarm across the whole colony. */
  _sootPoint(out) {
    const plots = this.colony.plotOrder
    if (!plots || !plots.length) return out.set((Math.random() - 0.5) * 40, 0, (Math.random() - 0.5) * 40)
    const c = plots[(Math.random() * plots.length) | 0]
    const m = c.middle || c.center
    return out.set(m.x + (Math.random() - 0.5) * 8, 0, m.z + (Math.random() - 0.5) * 8)
  }

  /** Fill every hex with susuwatari. They own the dark. */
  _spawnSoot() {
    const COUNT = 110
    const sprites = []
    for (let i = 0; i < COUNT; i++) {
      const g = createSootSprite({ seed: i * 7 + 3, phase: Math.random() * Math.PI * 2 })
      const scale = 0.5 + Math.random() * 0.35
      const pos = this._sootPoint(new THREE.Vector3())
      g.position.set(pos.x, this.colony.groundAt(pos.x, pos.z), pos.z)
      g.scale.setScalar(0.001) // pop in from nothing
      g.rotation.y = Math.random() * Math.PI * 2
      this.group.add(g)
      sprites.push({ g, scale, grow: 0, target: this._sootPoint(new THREE.Vector3()), pause: Math.random() * 2, speed: 0.5 + Math.random() * 0.6, vel: new THREE.Vector3(), spin: 0 })
    }
    this.soot = { phase: 'roam', sprites, t: 0 }
  }

  /**
   * The soot sprites live on darkness, not on any one switch: the nap automation, the night-
   * time slider and real nightfall all dim the sky the same way, and that's what they answer
   * to. When it goes dark they fill every hex; when the lights come back they freeze wide-eyed
   * for a beat, then panic and scatter like roaches, shrinking away to nothing. Hysteresis on
   * the darkness reading keeps them from flickering at dawn and dusk.
   */
  _updateSoot(dt, elapsed) {
    const night = this.colony.sky?.nightFactor ?? 0
    const soot = this.soot
    if (!soot || soot.phase === 'off') {
      if (night > 0.6) this._spawnSoot()
      return
    }
    if (soot.phase === 'roam' && night < 0.4) {
      // Lights up: freeze, eyes wide, before the scramble.
      soot.phase = 'alert'
      soot.t = 0
      for (const s of soot.sprites) s.g.userData.setExpression?.('surprised')
    }
    const tmp = this._tmp
    if (soot.phase === 'roam') {
      for (const s of soot.sprites) {
        if (s.grow < 1) {
          s.grow = Math.min(1, s.grow + dt * 2.2)
          s.g.scale.setScalar(s.scale * s.grow)
        }
        let walking = false
        if (s.pause > 0) s.pause -= dt
        else {
          const to = tmp.subVectors(s.target, s.g.position)
          to.y = 0
          const dist = to.length()
          if (dist < 0.4) {
            this._sootPoint(s.target)
            s.pause = 0.4 + Math.random() * 2.5
          } else {
            walking = true
            s.g.position.addScaledVector(to.multiplyScalar(1 / dist), Math.min(dist, s.speed * dt))
            s.g.rotation.y = Math.atan2(to.x, to.z)
          }
        }
        s.g.position.y = this.colony.groundAt(s.g.position.x, s.g.position.z)
        s.g.userData.update?.(dt, { speed: walking ? 1 : 0 })
      }
      return
    }
    if (soot.phase === 'alert') {
      soot.t += dt
      for (const s of soot.sprites) s.g.userData.update?.(dt, { speed: 0 })
      if (soot.t > 1.4) {
        soot.phase = 'panic'
        soot.t = 0
        for (const s of soot.sprites) {
          const a = Math.random() * Math.PI * 2 // every roach for itself
          s.vel.set(Math.sin(a), 0, Math.cos(a)).multiplyScalar(7 + Math.random() * 5)
          s.spin = (Math.random() - 0.5) * 14
        }
      }
      return
    }
    // panic: bolt outward, spin, shrink away; drop each one once it's gone.
    soot.t += dt
    for (let i = soot.sprites.length - 1; i >= 0; i--) {
      const s = soot.sprites[i]
      s.vel.x += (Math.random() - 0.5) * 24 * dt // jitter the heading, roach-like
      s.vel.z += (Math.random() - 0.5) * 24 * dt
      s.g.position.addScaledVector(s.vel, dt)
      s.g.position.y = this.colony.groundAt(s.g.position.x, s.g.position.z)
      s.g.rotation.y += s.spin * dt
      s.scale *= Math.max(0, 1 - dt * 2.6)
      s.g.scale.setScalar(s.scale)
      s.g.userData.update?.(dt, { speed: 1 })
      if (s.scale < 0.03) {
        s.g.userData.dispose?.()
        soot.sprites.splice(i, 1)
      }
    }
    if (!soot.sprites.length) this.soot = { phase: 'off', sprites: [], t: 0 }
  }

  update(dt, elapsed) {
    for (const m of this.list) {
      if (m.pause > 0) {
        m.pause -= dt
      } else {
        const to = this._tmp.subVectors(m.target, m.pos)
        to.y = 0
        const dist = to.length()
        if (dist < 0.4) {
          m.pause = 1.5 + Math.random() * 3
          this._pickTarget(m)
        } else {
          to.normalize()
          m.pos.addScaledVector(to, Math.min(dist, m.speed * dt))
          // Ease the heading toward travel, so a turn is a turn and not a snap.
          const want = Math.atan2(to.x, to.z)
          let d = want - m.yaw
          while (d > Math.PI) d -= Math.PI * 2
          while (d < -Math.PI) d += Math.PI * 2
          m.yaw += d * Math.min(1, dt * 6)
        }
      }
      const walking = m.pause <= 0
      const tracked = m.mesh.userData.locomotion === 'tracks'
      // Totoro (and Johnny 5) pose their own limbs and vertical motion from userData.update, so
      // they skip both the generic arm/leg swing and the whole-body walking bob.
      const selfDriven = !tracked && typeof m.mesh.userData.update === 'function'
      const ground = this.colony.groundAt(m.pos.x, m.pos.z)
      // A tracked robot rolls flat; a self-animated body handles its own bob; a plain legged
      // mascot gets the little walking bob here.
      m.mesh.position.set(m.pos.x, ground + (walking && !tracked && !selfDriven ? Math.abs(Math.sin(elapsed * 8 + m.phase)) * 0.04 : 0), m.pos.z)
      m.mesh.rotation.y = m.yaw
      this._applyReminder(m)
      if (m.nameplate) m.nameplate.position.set(m.pos.x, m.mesh.position.y + m.nameOffset, m.pos.z)
      if (m.bubble) {
        const lift = m.mesh.position.y + m.nameOffset + 0.32 + (m.bubble.userData.worldH || 0.6) / 2
        m.bubble.position.set(m.pos.x, lift + Math.sin(elapsed * 1.6 + m.phase) * 0.03, m.pos.z)
      }
      if (m.reminderBubble) {
        const lift = m.mesh.position.y + m.nameOffset + 0.32 + (m.reminderBubble.userData.worldH || 0.6) / 2
        m.reminderBubble.position.set(m.pos.x, lift + Math.sin(elapsed * 1.6 + m.phase) * 0.03, m.pos.z)
      }
      if (m.alert) {
        // A heartbeat bob just over the head; sits above a speech bubble if she has one too.
        const base = m.mesh.position.y + m.nameOffset + 0.5 + (m.bubble ? 0.7 : 0)
        m.alert.position.set(m.pos.x, base + Math.sin(elapsed * 2.4 + m.phase) * 0.05, m.pos.z)
        const beat = 1 + Math.max(0, Math.sin(elapsed * 3 + m.phase)) * 0.12
        m.alert.scale.set(0.72 * beat, 0.72 * beat, 1)
      }
      // Character: the dog wags, the lobster works its claws.
      if (m.kind === 'dog' && m.mesh.userData.tail) m.mesh.userData.tail.rotation.y = Math.sin(elapsed * 9 + m.phase) * 0.6
      if (m.kind === 'lobster' && m.mesh.userData.claws) {
        const open = (Math.sin(elapsed * 3 + m.phase) * 0.5 + 0.5) * 0.5
        for (const claw of m.mesh.userData.claws) claw.userData.jaw.rotation.x = -open
      }
      // Johnny 5 drives his own treads, head scan, and arms; Totoro his paws, ears and tail;
      // a person swings their limbs the generic way.
      if (tracked) {
        m.mesh.userData.update?.(dt, { speed: walking ? 1.1 : 0, turn: 0 })
      } else if (selfDriven) {
        m.mesh.userData.update?.(dt, { speed: walking ? 1 : 0 })
      } else if (isPerson(m)) {
        m.gait += ((walking ? 1 : 0) - m.gait) * Math.min(1, dt * 6)
        const swing = Math.sin(elapsed * 7 + m.phase) * m.gait
        const legs = m.mesh.userData.legs
        if (legs) {
          if (legs[0]) legs[0].rotation.x = swing * 0.5
          if (legs[1]) legs[1].rotation.x = -swing * 0.5
        }
        const arms = m.mesh.userData.arms
        if (arms) {
          if (arms[0]) arms[0].rotation.x = -swing * 0.4
          if (arms[1]) arms[1].rotation.x = swing * 0.4
        }
        if (m.mesh.userData.head) m.mesh.userData.head.rotation.y = Math.sin(elapsed * 0.6 + m.phase) * 0.22 * (1 - m.gait)
      }
      // A fresh random face every 2-3 seconds for anyone who has expressions (family + Johnny 5).
      if (m.mesh.userData.expressions && elapsed >= m.exprUntil) {
        this._setExpression(m, this._pickExpression(m))
        m.exprUntil = elapsed + 2 + Math.random()
      }
    }
    // After the leader (Totoro) has moved this frame, let his companions trail him.
    this.totoroCompanions?.userData.update(dt)
    // The soot swarm runs on its own nap/wake choreography.
    this._updateSoot(dt, elapsed)
    // Totoro raises his umbrella whenever it's really raining in KC.
    if (this.totoroUmbrella) this.totoroUmbrella.visible = Boolean(this.colony.sky?.weather?.rain)
  }

  /** A random face, never the same one twice in a row — the character cycles through them. */
  _pickExpression(m) {
    const keys = Object.keys(m.mesh.userData.expressions || {})
    if (keys.length <= 1) return keys[0] || 'neutral'
    let name = m.expr
    while (name === m.expr) name = keys[(Math.random() * keys.length) | 0]
    return name
  }

  /** Show one named face, hide the rest. Meshes were all built up front, one set per expression. */
  _setExpression(m, name) {
    const ex = m.mesh.userData.expressions
    if (!ex || m.expr === name) return
    if (!ex[name]) name = 'neutral'
    m.expr = name
    // Prefer the model's own switcher (Johnny 5 and the family both expose one) so poses tied to
    // an expression — Johnny 5's surprised arm-raise — fire; otherwise fall back to visibility.
    if (typeof m.mesh.userData.setExpression === 'function') {
      m.mesh.userData.setExpression(name)
      return
    }
    for (const [k, meshes] of Object.entries(ex)) {
      const on = k === name
      for (const mesh of meshes) mesh.visible = on
    }
  }

  /** The pet nearest the pointer, in screen space, or null. Head-height, like the astronaut picker. */
  pick(camera, ndcX, ndcY, aspect, maxDist = 0.06) {
    let best = null
    let bd = maxDist
    const v = this._tmp
    for (const m of this.list) {
      v.set(m.mesh.position.x, m.mesh.position.y + 0.8, m.mesh.position.z).project(camera)
      if (v.z > 1) continue
      const d = Math.hypot((v.x - ndcX) * aspect, v.y - ndcY)
      if (d < bd) {
        bd = d
        best = m
      }
    }
    return best
  }

  setVisible(on) {
    this.group.visible = on
  }
}
