import * as THREE from 'three'
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js'
import { mulberry } from './planet.js'
import { ATLAS, CELL, atlasTexture, cellMask, part } from './kit.js'

/**
 * Colony buildings — one per thread, assembled out of KayKit's *Space Base Bits* (CC0) and
 * seeded from the thread's own id, so a given session always builds the same structure on
 * every reload and on every planet.
 *
 * The pack is a modular one, which is the whole reason the ten kinds below can stay short:
 * a habitat is a base module with a roof module on it, a workshop is the garage variant
 * with a rover parked outside. Every part shares one gradient atlas, so a nine-part
 * greenhouse still merges down to a single geometry and a single draw call.
 *
 * Three things ride on top of the pack's own art:
 *
 * 1. **Construction progress sinks the building into the ground.** The vertex stage lowers
 *    the whole structure and the fragment stage discards whatever ends up below the deck, so
 *    a thread's building rises as it grows without ever touching a vertex buffer — and what
 *    is on screen is always a *complete* building, part of it buried. Slicing the top off
 *    instead, which is what this used to do, guts a kit of closed shells: at two-thirds
 *    finished a biodome loses its entire dome and becomes an empty ring.
 * 2. **The accent is a repainted atlas cell.** Kay's gold trim band is cell 11 of the 8x4
 *    atlas; the fragment stage swaps its hue for the repo's accent while keeping the
 *    swatch's own light-to-dark gradient. One repo, one colour, no extra material.
 * 3. **PBR comes from the atlas too.** Roughness and metalness are looked up per cell, so
 *    the grey structural swatch behaves like brushed metal and the solar swatch like glass
 *    even though both arrive as flat colour in a single texture.
 */

/** Shared across every building, so night falling is one uniform write for the whole colony. */
export const buildingUniforms = {
  uNight: { value: 0 },
  /** Seconds, for anything that turns. One write drives every rotor in the colony. */
  uTime: { value: 0 },
}

/**
 * Every structure is authored on the pack's 2-unit module grid and scaled once, here.
 *
 * The number is set against the crew, not the plot: an astronaut is about 1.1 units tall,
 * and a habitat you can see over is not a habitat. At 1.45 a base module clears the crew's
 * heads and a mast is three of them, while the widest footprint still leaves a walkable
 * gap at the plot's 4.4-unit slot spacing.
 */
const BUILDING_SCALE = 1.45

/** The top face of a base module — where roof modules and masts stack. */
const DECK = 1.0

/**
 * Surface response per atlas cell. The pack ships one material for everything; this is what
 * gives a colony made of it any specular variety at all under the environment map.
 *
 * Metalness is kept deliberately low almost everywhere. These are *painted* surfaces, and a
 * fully metallic one has no diffuse term at all — with only a soft sky to reflect, the grey
 * structural swatch is the largest surface in the pack and turns black the moment it is
 * treated as bare metal. A quarter is enough to pick up the horizon along an edge.
 *
 * Defaults are Kay's own (roughness 0.6, metalness 0) so an unlisted swatch still looks right.
 */
const SURFACE = {
  [CELL.WHITE]: [0.55, 0.0], // painted hull panel
  [CELL.GREY]: [0.46, 0.22], // structural frame — painted metal, not bare
  [CELL.SLATE]: [0.5, 0.3],
  [CELL.BLACK]: [0.6, 0.18],
  [CELL.ROCK]: [0.95, 0.0], // regolith and terrain chunks — never shiny
  [CELL.TRIM]: [0.42, 0.08], // painted trim, semi-gloss
  [CELL.RED]: [0.55, 0.04],
  [CELL.SOLAR_A]: [0.16, 0.7], // photovoltaic glass, and dark on purpose
  [CELL.SOLAR_B]: [0.16, 0.7],
}

const CELL_COUNT = ATLAS.cols * ATLAS.rows
const ROUGHNESS = new Float32Array(CELL_COUNT).fill(0.6)
const METALNESS = new Float32Array(CELL_COUNT).fill(0.0)
for (const [cell, [r, m]] of Object.entries(SURFACE)) {
  ROUGHNESS[cell] = r
  METALNESS[cell] = m
}

/** The one swatch the accent repaints, and the one that lights up after dark. */
const ACCENT_MASK = cellMask([CELL.TRIM])

// ── composition ───────────────────────────────────────────────────────────────────────

/**
 * A tiny placement helper. Parts are baked to the building's own frame as they are added,
 * each carrying a per-vertex emissive flag, so the whole lot merges into one buffer.
 */
class Composer {
  constructor() {
    this.parts = []
  }

  /**
   * @param {string} name  a node name from the kit
   * @param {object} [o]   `x`/`y`/`z` offset, `ry` yaw, `s` uniform scale, `emissive` 0..1
   */
  add(name, o = {}) {
    const geo = part(name, 'base', { solo: o.solo })
    const s = o.s ?? 1
    if (s !== 1) geo.scale(s, s, s)
    if (o.ry) geo.rotateY(o.ry)
    geo.translate(o.x || 0, o.y || 0, o.z || 0)

    const count = geo.attributes.position.count
    geo.setAttribute('aEmissive', new THREE.BufferAttribute(new Float32Array(count).fill(o.emissive || 0), 1))

    // Rotors turn in the vertex shader rather than as child meshes, so a turbine is still
    // one merged geometry and one draw call. Each spinning vertex carries the hub it turns
    // about and how fast, which is what lets one building hold several of them.
    const rate = o.spin || 0
    const spin = new Float32Array(count).fill(rate)
    const pivot = new Float32Array(count * 3)
    if (rate) {
      for (let i = 0; i < count; i++) {
        pivot[i * 3] = o.x || 0
        pivot[i * 3 + 1] = o.y || 0
        pivot[i * 3 + 2] = o.z || 0
      }
    }
    geo.setAttribute('aSpin', new THREE.BufferAttribute(spin, 1))
    geo.setAttribute('aPivot', new THREE.BufferAttribute(pivot, 3))

    this.parts.push(geo)
    return this
  }

  /**
   * A procedural part, for the few things the pack does not ship. The geometry's UVs are
   * pinned to one atlas cell so it takes that swatch's colour and surface response and
   * merges into the same draw call as everything else.
   * @param {THREE.BufferGeometry} geo  built in the building's own frame
   * @param {number} cell                atlas cell index (see kit.js CELL)
   */
  geom(geo, cell, o = {}) {
    const ref = this.parts[0]
    if (ref && !ref.index && geo.index) geo = geo.toNonIndexed()
    const count = geo.attributes.position.count
    const u = ((cell % ATLAS.cols) + 0.5) / ATLAS.cols
    const v = (Math.floor(cell / ATLAS.cols) + 0.5) / ATLAS.rows
    const uv = new Float32Array(count * 2)
    for (let i = 0; i < count; i++) {
      uv[i * 2] = u
      uv[i * 2 + 1] = v
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    if (!geo.getAttribute('normal')) geo.computeVertexNormals()
    const s = o.s ?? 1
    if (s !== 1) geo.scale(s, s, s)
    if (o.ry) geo.rotateY(o.ry)
    geo.translate(o.x || 0, o.y || 0, o.z || 0)
    geo.setAttribute('aEmissive', new THREE.BufferAttribute(new Float32Array(count).fill(o.emissive || 0), 1))
    const rate = o.spin || 0
    const spin = new Float32Array(count).fill(rate)
    const pivot = new Float32Array(count * 3)
    if (rate) {
      for (let i = 0; i < count; i++) {
        pivot[i * 3] = o.x || 0
        pivot[i * 3 + 1] = o.y || 0
        pivot[i * 3 + 2] = o.z || 0
      }
    }
    geo.setAttribute('aSpin', new THREE.BufferAttribute(spin, 1))
    geo.setAttribute('aPivot', new THREE.BufferAttribute(pivot, 3))
    this.parts.push(geo)
    return this
  }
  /** Scatter `count` copies of a part around a ring, jittered so it never reads as a pattern. */
  ring(name, count, radius, rand, o = {}) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rand() * 0.5
      const r = radius * (0.85 + rand() * 0.3)
      this.add(name, { ...o, x: Math.cos(a) * r, z: Math.sin(a) * r, ry: a + Math.PI / 2 })
    }
    return this
  }

  finish() {
    const merged = BufferGeometryUtils.mergeGeometries(this.parts, false)
    for (const p of this.parts) p.dispose()
    merged.computeBoundingBox()
    return merged
  }
}

const pick = (rand, list) => list[Math.floor(rand() * list.length)]

// ── the building catalogue ────────────────────────────────────────────────────────────

/**
 * Each generator gets a placer, a seeded RNG and the repo's accent. They stay deliberately
 * varied in silhouette — dome, mast, slab, derrick — so a plot full of them reads as a town
 * rather than a row of the same shed.
 */
const KINDS = {
  habitat(c, rand) {
    c.add(pick(rand, ['basemodule_A', 'basemodule_B', 'basemodule_C', 'basemodule_D']))
    c.add(pick(rand, ['roofmodule_base', 'roofmodule_cargo_A', 'roofmodule_cargo_B']), { y: DECK })
    if (rand() > 0.45) c.add('lights', { x: 1.15, z: 0.85, s: 0.85, ry: rand() * 6.28 })
    if (rand() > 0.6) c.add('containers_A', { x: -1.15, z: 0.9, ry: rand() * 6.28 })
    return 'Habitat'
  },

  solar(c, rand) {
    const cols = 2 + Math.floor(rand() * 2)
    const rows = 2 + Math.floor(rand() * 2)
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        c.add('solarpanel', {
          x: (i - (cols - 1) / 2) * 1.05,
          z: (j - (rows - 1) / 2) * 0.62,
          // A whole field tilted the same way is what makes an array read as an array.
          ry: 0.06 * (rand() - 0.5),
        })
      }
    }
    c.add('lights', { x: cols * 0.6, z: -rows * 0.4, s: 0.8 })
    c.add('containers_B', { x: -cols * 0.6, z: rows * 0.35, ry: 0.4 })
    return 'Solar array'
  },

  antenna(c, rand) {
    // The tall turbine mast — the only silhouette in the pack that breaks the skyline. The
    // tower is taken *solo* so the rotor can be put back on as a part that turns.
    const tall = rand() > 0.3
    const [tower, hub] = tall ? ['windturbine_tall', 2.05] : ['windturbine_low', 0.89]
    c.add(tower, { solo: true })
    // Slow: a turbine that whips round reads as a desk fan. A little over half a minute a
    // turn, jittered so a row of them never falls into step.
    c.add(`${tower}_fan`, { y: hub, spin: 0.17 + rand() * 0.09 })
    c.add('containers_C', { x: 0.9, z: 0.75, ry: rand() * 6.28 })
    if (rand() > 0.5) c.add('lights', { x: -0.95, z: -0.7, s: 0.8 })
    return 'Relay mast'
  },

  silo(c, rand) {
    c.add(pick(rand, ['cargodepot_A', 'cargodepot_B', 'cargodepot_C']))
    if (rand() > 0.5) c.add(pick(rand, ['cargo_A_stacked', 'cargo_B_stacked']), { x: 1.35, z: 0.4, ry: rand() * 6.28 })
    return 'Storage'
  },

  greenhouse(c, rand) {
    // The geodesic-topped module — the pack's own biodome.
    c.add('basemodule_E')
    c.ring('containers_D', 2 + Math.floor(rand() * 2), 1.45, rand)
    return 'Greenhouse'
  },

  reactor(c, rand) {
    c.add('drill_structure')
    c.ring('cargo_A', 3, 1.35, rand)
    if (rand() > 0.5) c.add('lights', { x: -1.2, z: 1.0, s: 0.9 })
    return 'Reactor'
  },

  /**
   * The Brain's landmark: a deep-space dish on a mast, feed horn on three struts, beacon at
   * the focus. The pack has no antenna, so this one is lathed from a parabola and pinned to
   * the pack's white swatch; the mast and struts take the grey structural one.
   */
  dish(c, rand) {
    c.add('basemodule_E')
    c.add('containers_D', { x: 1.25, z: -0.9, ry: rand() * 6.28 })

    const mastH = 1.5
    c.geom(new THREE.CylinderGeometry(0.11, 0.17, mastH, 10), CELL.GREY, { y: DECK + mastH / 2 })
    c.geom(new THREE.CylinderGeometry(0.26, 0.26, 0.22, 12), CELL.SLATE, { y: DECK + mastH })

    // Dish and feed, built on their own axis (+y) and then tilted together toward the sky.
    const R = 1.35
    const K = 0.24 // depth = K * r^2, focus at 1 / (4K)
    const profile = []
    for (let i = 0; i <= 14; i++) {
      const x = (i / 14) * R
      profile.push(new THREE.Vector2(x, K * x * x))
    }
    const bowl = new THREE.LatheGeometry(profile, 32)
    const rim = new THREE.TorusGeometry(R, 0.035, 8, 40)
    rim.rotateX(Math.PI / 2)
    rim.translate(0, K * R * R, 0)
    const focus = 1 / (4 * K)
    const horn = new THREE.CylinderGeometry(0.09, 0.05, 0.28, 8)
    horn.translate(0, focus, 0)
    const struts = []
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      const foot = new THREE.Vector3(Math.cos(a) * R * 0.82, K * (R * 0.82) ** 2, Math.sin(a) * R * 0.82)
      const tip = new THREE.Vector3(0, focus - 0.08, 0)
      const len = foot.distanceTo(tip)
      const strut = new THREE.CylinderGeometry(0.022, 0.022, len, 5)
      const mid = foot.clone().add(tip).multiplyScalar(0.5)
      const dir = tip.clone().sub(foot).normalize()
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
      strut.applyQuaternion(q)
      strut.translate(mid.x, mid.y, mid.z)
      struts.push(strut)
    }
    const tilt = -0.95 // radians about X: face up and toward the front of the plot
    const place = (g) => {
      g.rotateX(tilt)
      g.translate(0, DECK + mastH + 0.18, 0)
      return g
    }
    const bowlTwin = bowl.clone()
    c.geom(place(bowl), CELL.WHITE)
    c.geom(place(rim), CELL.SLATE)
    c.geom(place(horn), CELL.GREY)
    for (const s of struts) c.geom(place(s), CELL.GREY)
    // The beacon at the feed, lit: it is what reads as "receiving" from across the colony.
    const beacon = new THREE.SphereGeometry(0.075, 10, 8)
    beacon.translate(0, focus + 0.18, 0)
    c.geom(place(beacon), CELL.RED, { emissive: 1 })
    // The lathe faces one way and the material is single-sided, so the bowl needs an
    // inward-facing twin or it is culled from exactly the angle you look at it from.
    const inner = bowlTwin
    const idx = inner.index.array
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i + 1]
      idx[i + 1] = idx[i + 2]
      idx[i + 2] = t
    }
    const nrm = inner.attributes.normal.array
    for (let i = 0; i < nrm.length; i++) nrm[i] = -nrm[i]
    inner.translate(0, 0.012, 0)
    c.geom(place(inner), CELL.WHITE)
    return 'Antenna'
  },

  /**
   * A 3D printer: bed on a base, two uprights and a top bar, a gantry carrying the
   * toolhead, a lit screen on the front. The gantry takes the plot's accent so a farm of
   * them still reads as one client's machines.
   */
  printer(c) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)
    box(1.5, 0.16, 1.3, CELL.SLATE, { y: 0.08 })
    box(1.1, 0.05, 1.0, CELL.WHITE, { y: 0.19 })
    box(0.09, 1.25, 0.09, CELL.GREY, { x: -0.62, y: 0.16 + 0.62, z: -0.5 })
    box(0.09, 1.25, 0.09, CELL.GREY, { x: 0.62, y: 0.16 + 0.62, z: -0.5 })
    box(1.4, 0.09, 0.09, CELL.GREY, { y: 1.42, z: -0.5 })
    box(1.28, 0.07, 0.07, CELL.TRIM, { y: 0.85, z: -0.36 })
    box(0.2, 0.24, 0.2, CELL.BLACK, { x: 0.15, y: 0.8, z: -0.25 })
    box(0.06, 0.12, 0.06, CELL.RED, { x: 0.15, y: 0.6, z: -0.25, emissive: 0.8 })
    box(0.36, 0.18, 0.04, CELL.RED, { x: 0.45, y: 0.3, z: 0.66, emissive: 1 })
    box(0.3, 0.35, 0.3, CELL.WHITE, { x: -0.9, y: 0.34, z: 0.45 })
    return 'Printer'
  },

  /**
   * A server: a tall dark cabinet with rows of status lights up the front and a vent
   * grille, standing on a plinth. Nineteen of them is a data hall.
   */
  rack(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)
    box(1.1, 0.1, 1.1, CELL.SLATE, { y: 0.05 })
    box(0.9, 2.3, 0.9, CELL.BLACK, { y: 0.1 + 1.15 })
    box(0.94, 0.06, 0.94, CELL.GREY, { y: 2.43 })
    for (let i = 0; i < 9; i++) {
      const y = 0.35 + i * 0.22
      box(0.72, 0.05, 0.03, CELL.GREY, { y, z: 0.46 })
      const lit = rand() > 0.35
      box(0.05, 0.05, 0.03, lit ? CELL.RED : CELL.SLATE, { x: -0.3, y, z: 0.47, emissive: lit ? 1 : 0 })
      if (rand() > 0.5) box(0.05, 0.05, 0.03, CELL.SOLAR_A, { x: -0.2, y, z: 0.47, emissive: 0.9 })
    }
    box(0.5, 0.4, 0.02, CELL.GREY, { y: 2.2, z: 0.46 })
    return 'Server'
  },

  /**
   * A planter: a pot, dark soil, and a clump of foliage in the plot's accent. A thirsty
   * plant slumps beside it; a happy one stands guard.
   */
  planter(c, rand) {
    c.geom(new THREE.CylinderGeometry(0.42, 0.32, 0.5, 14), CELL.ROCK, { y: 0.25 })
    c.geom(new THREE.CylinderGeometry(0.38, 0.38, 0.04, 14), CELL.BLACK, { y: 0.5 })
    const leaves = 4 + Math.floor(rand() * 3)
    for (let i = 0; i < leaves; i++) {
      const a = rand() * Math.PI * 2
      const r = 0.12 + rand() * 0.2
      const s = 0.18 + rand() * 0.16
      c.geom(new THREE.SphereGeometry(s, 10, 8), CELL.TRIM, { x: Math.cos(a) * r, y: 0.55 + s * 0.6 + rand() * 0.25, z: Math.sin(a) * r })
    }
    c.geom(new THREE.CylinderGeometry(0.03, 0.04, 0.5, 6), CELL.ROCK, { y: 0.75 })
    return 'Planter'
  },

  /**
   * The Plex hex's landmark: a cinema. A lit screen on two posts with a dark frame, four
   * rows of seats facing it, a projector on a post at the back, and a little marquee light.
   * The screen glows on its own at night; who is in the seats is the astronauts' business.
   */
  theater(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)
    // floor slab and a low stage under the screen
    box(3.2, 0.1, 2.9, CELL.SLATE, { y: 0.05 })
    box(2.9, 0.14, 0.6, CELL.GREY, { y: 0.17, z: -1.05 })
    // posts, frame, screen
    box(0.08, 1.7, 0.08, CELL.GREY, { x: -1.2, y: 0.95, z: -1.2 })
    box(0.08, 1.7, 0.08, CELL.GREY, { x: 1.2, y: 0.95, z: -1.2 })
    box(2.6, 1.5, 0.06, CELL.BLACK, { y: 1.15, z: -1.2 })
    box(2.4, 1.3, 0.05, CELL.WHITE, { y: 1.15, z: -1.16, emissive: 0.9 })
    // seats: four rows, five across, red cushions on dark bases, stepped up toward the back
    for (let r = 0; r < 4; r++) {
      for (let i = 0; i < 5; i++) {
        const x = -1.0 + i * 0.5
        const z = -0.35 + r * 0.42
        const y = 0.1 + r * 0.07
        box(0.36, 0.1, 0.34, CELL.BLACK, { x, y: y + 0.12, z })
        box(0.36, 0.22, 0.34, CELL.RED, { x, y: y + 0.28, z })
        box(0.36, 0.34, 0.08, CELL.RED, { x, y: y + 0.45, z: z + 0.15 })
      }
      box(3.0, 0.07, 0.5, CELL.SLATE, { y: 0.1 + r * 0.07 + 0.03, z: -0.35 + r * 0.42 })
    }
    // projector on a post at the back, lens lit
    box(0.1, 1.5, 0.1, CELL.GREY, { y: 0.85, z: 1.35 })
    box(0.42, 0.24, 0.5, CELL.SLATE, { y: 1.7, z: 1.35 })
    box(0.1, 0.1, 0.08, CELL.RED, { y: 1.7, z: 1.06, emissive: 1 })
    // marquee light on each post
    box(0.14, 0.14, 0.14, CELL.RED, { x: -1.2, y: 1.88, z: -1.2, emissive: 0.8 })
    box(0.14, 0.14, 0.14, CELL.RED, { x: 1.2, y: 1.88, z: -1.2, emissive: 0.8 })
    return 'Theater'
  },

  /**
   * CorrosionDC's landmark: a pumpjack. Concrete base, an A-frame samson post, the walking
   * beam with a horsehead at the well end, a counterweight crank turning at the back, and
   * the wellhead pipe. The crank is the moving part; the beam holds its nod.
   */
  pumpjack(c) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)
    box(2.6, 0.14, 1.2, CELL.SLATE, { y: 0.07 })
    // samson post: two legs leaning in to a cap
    for (const s of [-1, 1]) {
      const leg = new THREE.BoxGeometry(0.1, 1.7, 0.1)
      leg.rotateZ(s * 0.22)
      c.geom(leg, CELL.GREY, { x: s * 0.2, y: 0.95, z: 0 })
      const leg2 = new THREE.BoxGeometry(0.1, 1.7, 0.1)
      leg2.rotateX(s * 0.22)
      c.geom(leg2, CELL.GREY, { x: 0, y: 0.95, z: s * 0.2 })
    }
    box(0.3, 0.12, 0.3, CELL.GREY, { y: 1.78 })
    // walking beam, nodded toward the well
    const beam = new THREE.BoxGeometry(2.3, 0.12, 0.16)
    beam.rotateZ(0.12)
    c.geom(beam, CELL.GREY, { y: 1.9 })
    // horsehead at the well end
    const head = new THREE.BoxGeometry(0.22, 0.5, 0.24)
    head.rotateZ(0.12)
    c.geom(head, CELL.RED, { x: -1.18, y: 1.62 })
    box(0.05, 0.9, 0.05, CELL.BLACK, { x: -1.18, y: 0.95 })
    // wellhead
    c.geom(new THREE.CylinderGeometry(0.12, 0.14, 0.5, 10), CELL.BLACK, { x: -1.18, y: 0.39 })
    c.geom(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 8), CELL.GREY, { x: -1.18, y: 0.9 })
    // gearbox and the counterweight crank at the back: a disc on an axle along Z, turning
    box(0.6, 0.5, 0.6, CELL.SLATE, { x: 0.95, y: 0.39 })
    const crank = new THREE.CylinderGeometry(0.34, 0.34, 0.08, 20)
    crank.rotateX(Math.PI / 2)
    c.geom(crank, CELL.BLACK, { x: 0.95, y: 0.9, z: 0.34, spin: 1.1 })
    const weight = new THREE.BoxGeometry(0.16, 0.16, 0.1)
    weight.translate(0, 0.24, 0)
    c.geom(weight, CELL.RED, { x: 0.95, y: 0.9, z: 0.4, spin: 1.1 })
    // pitman arm up to the beam
    const arm = new THREE.BoxGeometry(0.05, 1.0, 0.05)
    arm.rotateZ(-0.1)
    c.geom(arm, CELL.GREY, { x: 1.0, y: 1.45, z: 0.34 })
    // a tank and a pipe run
    c.geom(new THREE.CylinderGeometry(0.32, 0.32, 0.7, 14), CELL.SLATE, { x: 0.2, y: 0.42, z: -0.85 })
    return 'Pumpjack'
  },

  /**
   * A workbench: table, vise, a pegboard with a few tools, a stool. What a project looks
   * like while it is on the bench.
   */
  bench(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)
    box(1.5, 0.08, 0.7, CELL.TRIM, { y: 0.74 })
    for (const [x, z] of [[-0.65, -0.28], [0.65, -0.28], [-0.65, 0.28], [0.65, 0.28]]) box(0.08, 0.7, 0.08, CELL.SLATE, { x, y: 0.35, z })
    box(1.3, 0.04, 0.5, CELL.SLATE, { y: 0.22 })
    // vise at one end
    box(0.22, 0.16, 0.18, CELL.BLACK, { x: 0.55, y: 0.86, z: 0 })
    c.geom(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), CELL.GREY, { x: 0.55, y: 0.86, z: 0.16 })
    // pegboard behind, with hanging tools
    box(1.4, 0.8, 0.05, CELL.SLATE, { y: 1.3, z: -0.38 })
    for (let i = 0; i < 4; i++) box(0.05, 0.28 + rand() * 0.1, 0.05, i % 2 ? CELL.RED : CELL.GREY, { x: -0.5 + i * 0.33, y: 1.28, z: -0.33 })
    // a couple of parts on the bench and a stool
    box(0.2, 0.12, 0.14, CELL.WHITE, { x: -0.3, y: 0.84, z: 0.1 })
    box(0.14, 0.14, 0.14, CELL.RED, { x: -0.05, y: 0.85, z: -0.12 })
    c.geom(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 12), CELL.SLATE, { x: 0.2, y: 0.5, z: 0.7 })
    c.geom(new THREE.CylinderGeometry(0.03, 0.03, 0.48, 6), CELL.GREY, { x: 0.2, y: 0.24, z: 0.7 })
    return 'Workbench'
  },

  /** A packed crate: a finished job waiting to be paid for and shipped. */
  crate(c, rand) {
    c.add(rand() > 0.5 ? 'cargo_A_packed' : 'cargo_B_packed')
    c.add('cargo_A', { x: 0.9, z: 0.5, ry: rand() * 6.28, s: 0.7 })
    return 'Crate'
  },

  /** A deck: boards in the zone's colour on joists, with railing posts and a bench. */
  deck(c) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)
    for (let i = 0; i < 9; i++) box(0.26, 0.06, 2.2, CELL.TRIM, { x: -1.2 + i * 0.3, y: 0.42 })
    for (const z of [-1.0, 0, 1.0]) box(2.8, 0.14, 0.12, CELL.SLATE, { y: 0.32, z })
    for (const [x, z] of [[-1.35, -1.05], [-1.35, 1.05], [1.35, -1.05], [1.35, 1.05], [0, -1.05], [0, 1.05]]) {
      box(0.1, 0.42, 0.1, CELL.SLATE, { x, y: 0.2, z })
      box(0.08, 0.9, 0.08, CELL.GREY, { x, y: 0.9, z })
    }
    for (const z of [-1.05, 1.05]) box(2.8, 0.06, 0.06, CELL.GREY, { y: 1.33, z })
    for (const x of [-1.35, 1.35]) box(0.06, 0.06, 2.2, CELL.GREY, { x, y: 1.33 })
    // steps down and a bench
    box(0.8, 0.12, 0.3, CELL.TRIM, { x: 1.7, y: 0.28, z: 0 })
    box(0.8, 0.12, 0.3, CELL.TRIM, { x: 2.0, y: 0.14, z: 0 })
    box(1.2, 0.06, 0.3, CELL.SLATE, { x: -0.4, y: 0.72, z: -0.7 })
    return 'Deck'
  },

  /** A gazebo: six posts, a low rail, an eight-sided roof with a finial, a lantern under it. */
  gazebo(c) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)
    c.geom(new THREE.CylinderGeometry(1.35, 1.35, 0.14, 8), CELL.SLATE, { y: 0.07 })
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      box(0.09, 1.6, 0.09, CELL.WHITE, { x: Math.cos(a) * 1.1, y: 0.94, z: Math.sin(a) * 1.1 })
    }
    const rail = new THREE.TorusGeometry(1.1, 0.03, 6, 24)
    rail.rotateX(Math.PI / 2)
    c.geom(rail, CELL.WHITE, { y: 0.6 })
    const roof = new THREE.ConeGeometry(1.55, 0.85, 8)
    c.geom(roof, CELL.RED, { y: 2.15 })
    c.geom(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 8), CELL.WHITE, { y: 1.78 })
    c.geom(new THREE.SphereGeometry(0.09, 8, 6), CELL.WHITE, { y: 2.62 })
    c.geom(new THREE.SphereGeometry(0.1, 8, 6), CELL.RED, { y: 1.55, emissive: 0.9 })
    return 'Gazebo'
  },

  /**
   * The Watchdog's landmark: the tall tower with its lights, a kennel beside it, and the
   * dog itself sitting at the door: boxy, grey, red collar, ears up, watching the colony.
   */
  kennel(c) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)
    c.add('structure_tall')
    c.add('lights', { y: 2.0, s: 0.7 })
    // kennel: a small hut with a pitched roof and a dark doorway
    box(0.9, 0.6, 0.8, CELL.WHITE, { x: 1.35, y: 0.3, z: 0.6 })
    const roof = new THREE.ConeGeometry(0.72, 0.42, 4)
    roof.rotateY(Math.PI / 4)
    c.geom(roof, CELL.RED, { x: 1.35, y: 0.81, z: 0.6 })
    box(0.3, 0.36, 0.04, CELL.BLACK, { x: 1.35, y: 0.22, z: 1.0 })
    // the dog, sitting, facing out from the kennel
    const dx = 1.35
    const dz = 1.45
    box(0.3, 0.32, 0.5, CELL.GREY, { x: dx, y: 0.3, z: dz }) // body
    box(0.26, 0.26, 0.3, CELL.GREY, { x: dx, y: 0.62, z: dz + 0.25 }) // head
    box(0.16, 0.14, 0.16, CELL.SLATE, { x: dx, y: 0.56, z: dz + 0.45 }) // snout
    box(0.06, 0.06, 0.05, CELL.BLACK, { x: dx, y: 0.6, z: dz + 0.54 }) // nose
    box(0.06, 0.16, 0.05, CELL.GREY, { x: dx - 0.1, y: 0.82, z: dz + 0.2 }) // ears
    box(0.06, 0.16, 0.05, CELL.GREY, { x: dx + 0.1, y: 0.82, z: dz + 0.2 })
    box(0.28, 0.06, 0.06, CELL.RED, { x: dx, y: 0.5, z: dz + 0.16 }) // collar
    box(0.08, 0.22, 0.08, CELL.GREY, { x: dx - 0.1, y: 0.11, z: dz + 0.16 }) // front legs
    box(0.08, 0.22, 0.08, CELL.GREY, { x: dx + 0.1, y: 0.11, z: dz + 0.16 })
    box(0.12, 0.14, 0.14, CELL.GREY, { x: dx - 0.12, y: 0.12, z: dz - 0.12 }) // haunches
    box(0.12, 0.14, 0.14, CELL.GREY, { x: dx + 0.12, y: 0.12, z: dz - 0.12 })
    const tail = new THREE.BoxGeometry(0.05, 0.05, 0.3)
    tail.rotateX(-0.6)
    c.geom(tail, CELL.GREY, { x: dx, y: 0.34, z: dz - 0.34 })
    // a bowl
    c.geom(new THREE.CylinderGeometry(0.12, 0.09, 0.07, 10), CELL.RED, { x: dx + 0.45, y: 0.04, z: dz + 0.1 })
    return 'Kennel'
  },

  /**
   * One office desk per email: the Inbox hex reads as an open-plan office. Desk on two
   * pedestals, a lit monitor, a chair pulled up, papers, and by turns a lamp, a plant or a
   * filing cabinet so a row of them is not a row of clones.
   */
  desk(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)
    // carpet tile under the whole thing
    box(1.7, 0.04, 1.5, CELL.SLATE, { y: 0.02 })
    // desk: top on two pedestals, a modesty panel at the back
    box(1.3, 0.06, 0.6, CELL.WHITE, { y: 0.72, z: -0.2 })
    box(0.34, 0.66, 0.54, CELL.GREY, { x: -0.45, y: 0.36, z: -0.2 })
    box(0.34, 0.66, 0.54, CELL.GREY, { x: 0.45, y: 0.36, z: -0.2 })
    box(1.3, 0.4, 0.04, CELL.GREY, { y: 0.5, z: -0.48 })
    // drawer handles
    for (const y of [0.2, 0.42, 0.62]) box(0.14, 0.03, 0.03, CELL.BLACK, { x: 0.45, y, z: 0.08 })
    // monitor on a stand, screen lit, keyboard and mouse in front of it
    box(0.16, 0.05, 0.12, CELL.BLACK, { x: -0.1, y: 0.78, z: -0.3 })
    box(0.04, 0.16, 0.04, CELL.BLACK, { x: -0.1, y: 0.86, z: -0.3 })
    box(0.62, 0.4, 0.04, CELL.BLACK, { x: -0.1, y: 1.12, z: -0.31 })
    box(0.56, 0.34, 0.02, CELL.WHITE, { x: -0.1, y: 1.12, z: -0.285, emissive: 0.55 + rand() * 0.3 })
    box(0.42, 0.02, 0.14, CELL.SLATE, { x: -0.1, y: 0.76, z: -0.06 })
    box(0.06, 0.02, 0.09, CELL.WHITE, { x: 0.22, y: 0.76, z: -0.06 })
    // papers: a small stack and a loose sheet
    box(0.24, 0.05, 0.3, CELL.WHITE, { x: 0.42, y: 0.775, z: -0.16 })
    box(0.22, 0.01, 0.28, CELL.WHITE, { x: 0.3, y: 0.755, z: 0.02, ry: 0.4 })
    // task chair: seat, back, star base, pulled up to the desk
    c.geom(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 10), CELL.BLACK, { y: 0.24, z: 0.32 })
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      box(0.36, 0.03, 0.05, CELL.BLACK, { x: Math.cos(a) * 0.17, y: 0.06, z: 0.32 + Math.sin(a) * 0.17, ry: -a })
    }
    c.geom(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 6), CELL.GREY, { y: 0.24, z: 0.32 })
    box(0.42, 0.08, 0.42, CELL.RED, { y: 0.44, z: 0.32 })
    box(0.4, 0.42, 0.07, CELL.RED, { y: 0.68, z: 0.53 })
    // one of three accessories, so desks differ
    const pick = Math.floor(rand() * 3)
    if (pick === 0) {
      // desk lamp, lit
      c.geom(new THREE.CylinderGeometry(0.08, 0.1, 0.02, 10), CELL.BLACK, { x: -0.55, y: 0.76, z: -0.36 })
      c.geom(new THREE.CylinderGeometry(0.015, 0.015, 0.36, 6), CELL.BLACK, { x: -0.55, y: 0.94, z: -0.36 })
      c.geom(new THREE.ConeGeometry(0.09, 0.12, 10), CELL.BLACK, { x: -0.5, y: 1.12, z: -0.3 })
      c.geom(new THREE.SphereGeometry(0.035, 8, 6), CELL.WHITE, { x: -0.5, y: 1.07, z: -0.3, emissive: 1 })
    } else if (pick === 1) {
      // desk plant
      c.geom(new THREE.CylinderGeometry(0.08, 0.06, 0.12, 10), CELL.ROCK, { x: -0.55, y: 0.81, z: -0.34 })
      c.geom(new THREE.SphereGeometry(0.12, 9, 7), CELL.TRIM, { x: -0.55, y: 0.98, z: -0.34 })
      c.geom(new THREE.SphereGeometry(0.08, 8, 6), CELL.TRIM, { x: -0.47, y: 1.06, z: -0.28 })
    } else {
      // filing cabinet beside the desk
      box(0.4, 0.9, 0.5, CELL.GREY, { x: -0.95, y: 0.45, z: -0.2 })
      for (const y of [0.22, 0.5, 0.78]) box(0.16, 0.03, 0.03, CELL.BLACK, { x: -0.95, y, z: 0.06 })
    }
    return 'Desk'
  },

  /**
   * Embassy's landmark: a landscaped yard. A flagstone path across a lawn, a clipped hedge,
   * a mulch bed with shrubs, a tree, and the crew's gear. Foliage takes the zone colour, so
   * it is green because the zone is. Which gear shows depends on the worker: a rotating
   * sprinkler, a mower, or a wheelbarrow with a rake.
   */
  yard(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)
    const bush = (x, z, s, y = 0) => c.geom(new THREE.SphereGeometry(s, 10, 8), CELL.TRIM, { x, y: y + s * 0.85, z })
    // lawn as a low slab with a mulch bed cut into one corner
    box(3.0, 0.06, 2.6, CELL.SLATE, { y: 0.03 })
    box(1.2, 0.08, 0.9, CELL.ROCK, { x: 0.85, y: 0.04, z: -0.75 })
    // flagstone path, stepping across the lawn
    for (let i = 0; i < 5; i++) box(0.38, 0.03, 0.3, CELL.GREY, { x: -1.1 + i * 0.5, y: 0.07, z: 0.85 + Math.sin(i * 1.7) * 0.12, ry: rand() * 0.5 - 0.25 })
    // clipped hedge along the back, with square shoulders
    for (let i = 0; i < 6; i++) box(0.5, 0.6 + rand() * 0.08, 0.42, CELL.TRIM, { x: -1.25 + i * 0.5, y: 0.32, z: -1.12 })
    // shrubs in the mulch bed
    bush(0.55, -0.85, 0.22)
    bush(1.0, -0.6, 0.18)
    bush(1.25, -0.95, 0.2)
    // a tree: trunk, three crowns
    c.geom(new THREE.CylinderGeometry(0.07, 0.1, 1.1, 8), CELL.ROCK, { x: -1.05, y: 0.55, z: -0.25 })
    bush(-1.05, -0.25, 0.42, 0.75)
    bush(-0.8, -0.05, 0.3, 0.95)
    bush(-1.3, -0.4, 0.28, 0.9)
    // edging around the bed
    box(1.24, 0.1, 0.06, CELL.GREY, { x: 0.85, y: 0.06, z: -0.29 })
    box(0.06, 0.1, 0.94, CELL.GREY, { x: 0.23, y: 0.06, z: -0.75 })
    const pick = Math.floor(rand() * 3)
    if (pick === 0) {
      // impact sprinkler on a riser, turning
      c.geom(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), CELL.GREY, { x: 0.3, y: 0.26, z: 0.2 })
      const head = new THREE.BoxGeometry(0.34, 0.05, 0.05)
      head.translate(0.12, 0, 0)
      c.geom(head, CELL.BLACK, { x: 0.3, y: 0.48, z: 0.2, spin: 2.2 })
      const jet = new THREE.BoxGeometry(0.5, 0.02, 0.02)
      jet.translate(0.5, 0.04, 0)
      c.geom(jet, CELL.WHITE, { x: 0.3, y: 0.48, z: 0.2, spin: 2.2, emissive: 0.35 })
    } else if (pick === 1) {
      // push mower parked on the lawn
      box(0.5, 0.18, 0.4, CELL.RED, { x: 0.4, y: 0.16, z: 0.35 })
      box(0.3, 0.14, 0.24, CELL.BLACK, { x: 0.4, y: 0.32, z: 0.35 })
      for (const [x, z] of [[0.18, 0.15], [0.62, 0.15], [0.18, 0.55], [0.62, 0.55]]) {
        const w = new THREE.CylinderGeometry(0.07, 0.07, 0.05, 10)
        w.rotateZ(Math.PI / 2)
        c.geom(w, CELL.BLACK, { x, y: 0.07, z })
      }
      const bar = new THREE.BoxGeometry(0.04, 0.04, 0.8)
      bar.rotateX(-0.9)
      c.geom(bar, CELL.GREY, { x: 0.25, y: 0.5, z: 0.75 })
      c.geom(bar.clone(), CELL.GREY, { x: 0.55, y: 0.5, z: 0.75 })
      box(0.36, 0.04, 0.05, CELL.BLACK, { x: 0.4, y: 0.81, z: 1.05 })
    } else {
      // wheelbarrow of mulch and a rake leaning on the hedge
      box(0.56, 0.24, 0.38, CELL.GREY, { x: 0.5, y: 0.3, z: 0.3, ry: 0.5 })
      box(0.5, 0.1, 0.32, CELL.ROCK, { x: 0.5, y: 0.45, z: 0.3, ry: 0.5 })
      const w = new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10)
      w.rotateZ(Math.PI / 2)
      c.geom(w, CELL.BLACK, { x: 0.72, y: 0.1, z: 0.42 })
      box(0.04, 0.04, 0.5, CELL.GREY, { x: 0.28, y: 0.22, z: 0.45, ry: 0.5 })
      const rake = new THREE.BoxGeometry(0.03, 1.2, 0.03)
      rake.rotateX(0.35)
      c.geom(rake, CELL.ROCK, { x: 0.1, y: 0.6, z: -0.7 })
      box(0.34, 0.04, 0.03, CELL.BLACK, { x: 0.1, y: 0.06, z: -0.5 })
    }
    return 'Yard'
  },

  /**
   * Frances's landmark: the inside of an apartment, walls cut away on the near side so you
   * can see in. A bed with a turned-down blanket, a nightstand with a lit lamp, an armchair
   * facing a television, a rug, a kitchenette with a kettle, a window in the back wall, and
   * the room sensor on the wall with its little status light: the thing Frances watches.
   */
  apartment(c) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)
    // floor and two walls in an L, open toward the camera
    box(3.2, 0.08, 2.8, CELL.ROCK, { y: 0.04 })
    box(3.2, 1.7, 0.08, CELL.WHITE, { y: 0.93, z: -1.36 })
    box(0.08, 1.7, 2.8, CELL.WHITE, { x: -1.56, y: 0.93 })
    box(3.2, 0.06, 0.1, CELL.SLATE, { y: 0.11, z: -1.32 })
    box(0.1, 0.06, 2.8, CELL.SLATE, { x: -1.52, y: 0.11 })
    // window in the back wall: frame, glass, a curtain either side
    box(0.9, 0.7, 0.05, CELL.SLATE, { x: 0.4, y: 1.15, z: -1.33 })
    box(0.8, 0.6, 0.03, CELL.SOLAR_A, { x: 0.4, y: 1.15, z: -1.31 })
    box(0.12, 1.0, 0.06, CELL.RED, { x: -0.12, y: 1.05, z: -1.3 })
    box(0.12, 1.0, 0.06, CELL.RED, { x: 0.92, y: 1.05, z: -1.3 })
    // bed against the left wall: frame, mattress, pillow, blanket in the zone colour
    box(0.9, 0.3, 1.5, CELL.SLATE, { x: -1.05, y: 0.19, z: -0.5 })
    box(0.86, 0.14, 1.46, CELL.WHITE, { x: -1.05, y: 0.41, z: -0.5 })
    box(0.9, 0.5, 0.08, CELL.SLATE, { x: -1.05, y: 0.45, z: -1.26 })
    box(0.5, 0.1, 0.3, CELL.WHITE, { x: -1.05, y: 0.53, z: -1.05 })
    box(0.88, 0.06, 0.95, CELL.TRIM, { x: -1.05, y: 0.51, z: -0.2 })
    // nightstand with a lit lamp
    box(0.36, 0.5, 0.36, CELL.GREY, { x: -0.4, y: 0.29, z: -1.1 })
    c.geom(new THREE.CylinderGeometry(0.02, 0.03, 0.2, 6), CELL.BLACK, { x: -0.4, y: 0.64, z: -1.1 })
    c.geom(new THREE.CylinderGeometry(0.1, 0.14, 0.16, 12, 1, true), CELL.WHITE, { x: -0.4, y: 0.82, z: -1.1, emissive: 0.9 })
    // rug, armchair, side table, television on the back wall
    c.geom(new THREE.CylinderGeometry(0.75, 0.75, 0.03, 20), CELL.RED, { x: 0.55, y: 0.085, z: 0.25 })
    box(0.6, 0.3, 0.6, CELL.TRIM, { x: 0.55, y: 0.27, z: 0.7 })
    box(0.6, 0.5, 0.14, CELL.TRIM, { x: 0.55, y: 0.6, z: 0.95 })
    box(0.12, 0.26, 0.6, CELL.TRIM, { x: 0.25, y: 0.55, z: 0.7 })
    box(0.12, 0.26, 0.6, CELL.TRIM, { x: 0.85, y: 0.55, z: 0.7 })
    box(0.9, 0.5, 0.06, CELL.BLACK, { x: 0.55, y: 0.95, z: -1.3 })
    box(0.82, 0.42, 0.02, CELL.WHITE, { x: 0.55, y: 0.95, z: -1.26, emissive: 0.5 })
    box(0.9, 0.36, 0.3, CELL.GREY, { x: 0.55, y: 0.18, z: -1.18 })
    // kitchenette on the right: counter, a kettle, an upper cabinet
    box(0.5, 0.8, 1.1, CELL.WHITE, { x: 1.35, y: 0.4, z: -0.75 })
    box(0.54, 0.04, 1.14, CELL.SLATE, { x: 1.35, y: 0.82, z: -0.75 })
    c.geom(new THREE.CylinderGeometry(0.1, 0.12, 0.2, 10), CELL.GREY, { x: 1.35, y: 0.94, z: -1.05 })
    box(0.3, 0.3, 0.3, CELL.SLATE, { x: 1.35, y: 0.99, z: -0.45 })
    // a walker parked by the bed: two front wheels, four legs, a top rail
    for (const [x, z] of [[-0.6, 0.4], [-0.25, 0.4], [-0.6, 0.75], [-0.25, 0.75]]) box(0.03, 0.7, 0.03, CELL.GREY, { x, y: 0.4, z })
    box(0.38, 0.04, 0.04, CELL.GREY, { x: -0.425, y: 0.75, z: 0.4 })
    box(0.38, 0.04, 0.04, CELL.GREY, { x: -0.425, y: 0.75, z: 0.75 })
    box(0.04, 0.04, 0.38, CELL.GREY, { x: -0.6, y: 0.75, z: 0.575 })
    box(0.04, 0.04, 0.38, CELL.GREY, { x: -0.25, y: 0.75, z: 0.575 })
    // the room sensor, high on the back wall, with its status light
    box(0.16, 0.16, 0.05, CELL.WHITE, { x: -0.7, y: 1.5, z: -1.31 })
    box(0.04, 0.04, 0.02, CELL.RED, { x: -0.7, y: 1.5, z: -1.28, emissive: 1 })
    return 'Apartment'
  },

  tower(c, rand) {
    c.add('structure_tall')
    c.add('lights', { y: 2.0, s: 0.7 })
    if (rand() > 0.5) c.add('containers_A', { x: 1.15, z: 0.95, ry: rand() * 6.28 })
    return 'Tower'
  },

  workshop(c, rand) {
    c.add('basemodule_garage')
    c.add('roofmodule_solarpanels', { y: DECK })
    // Something parked outside: an empty forecourt reads as unfinished.
    if (rand() > 0.3) {
      c.add(pick(rand, ['spacetruck', 'spacetruck_large']), { x: 1.55, z: 0.3, ry: Math.PI / 2 + (rand() - 0.5) * 0.5 })
    }
    if (rand() > 0.5) c.add('spacetruck_trailer', { x: 1.55, z: 1.35, ry: Math.PI / 2 })
    return 'Workshop'
  },

  pad(c, rand) {
    c.add(rand() > 0.35 ? 'landingpad_large' : 'landingpad_small')
    if (rand() > 0.4) c.add(pick(rand, ['lander_A', 'lander_B']), { y: 0.5, ry: rand() * 6.28 })
    else c.add('lander_base', { y: 0.5, ry: rand() * 6.28 })
    return 'Landing pad'
  },

  lab(c, rand) {
    c.add(pick(rand, ['basemodule_C', 'basemodule_A']))
    c.add('roofmodule_cargo_C', { y: DECK })
    c.ring(pick(rand, ['containers_B', 'containers_C']), 2, 1.4, rand)
    return 'Lab'
  },
}

const KIND_IDS = Object.keys(KINDS).filter((k) => !['dish', 'printer', 'rack', 'planter', 'theater', 'pumpjack', 'bench', 'crate', 'deck', 'gazebo', 'kennel', 'desk', 'yard', 'apartment'].includes(k))

// ── the reveal shader ─────────────────────────────────────────────────────────────────

/**
 * Everything the atlas makes possible, in one `onBeforeCompile`.
 *
 * Progress lowers the building and discards whatever falls below ground, with the band just
 * above that line painted in the accent — the "under construction" glow.
 * The accent also replaces the gold trim swatch outright, and per-cell roughness and
 * metalness turn one flat texture into a surface with metal, paint and glass in it.
 */
function decorate(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute float aEmissive;
         attribute float aSpin;
         attribute vec3 aPivot;
         varying float vEmissive;
         varying vec2 vAtlasUv;
         varying float vLocalY;
         uniform float uProgress;
         uniform float uMaxY;
         uniform float uMinY;
         uniform float uTime;

         // Turn a point about the Z axis through a hub. The pack's rotors are modelled as
         // vertical discs facing along Z, which is the axis a wind turbine actually turns on.
         vec3 botSpin( vec3 p, vec3 hub, float angle ) {
           vec3 r = p - hub;
           float s = sin( angle );
           float c = cos( angle );
           return hub + vec3( r.x * c - r.y * s, r.x * s + r.y * c, r.z );
         }`
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
         if ( aSpin > 0.0 ) objectNormal = botSpin( objectNormal, vec3( 0.0 ), uTime * aSpin );`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vEmissive = aEmissive;
         // Our own copy of the UV: three renames its map varying between versions, and the
         // cell lookup below has to survive that.
         vAtlasUv = uv;
         if ( aSpin > 0.0 ) transformed = botSpin( transformed, aPivot, uTime * aSpin );
         // Measured *after* the rotor has turned, so a blade sweeping past the ground line
         // is revealed and hidden by the same rule as everything else.
         vLocalY = transformed.y;
         // The whole structure is lowered into the ground, and the fragment stage throws
         // away whatever ends up below the deck. What is on screen is therefore always a
         // *complete* building, part of it buried — never a sliced one.
         transformed.y -= ( 1.0 - uProgress ) * ( uMaxY - uMinY );`
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying float vEmissive;
         varying vec2 vAtlasUv;
         varying float vLocalY;
         uniform float uProgress;
         uniform float uMaxY;
         uniform float uMinY;
         uniform vec3 uAccent;
         uniform float uNight;
         uniform float uCellAccent[ ${CELL_COUNT} ];
         uniform float uCellRoughness[ ${CELL_COUNT} ];
         uniform float uCellMetalness[ ${CELL_COUNT} ];

         // Which swatch of the 8x4 gradient atlas this fragment landed in.
         int atlasCell() {
           int cx = int( clamp( floor( vAtlasUv.x * ${ATLAS.cols}.0 ), 0.0, ${ATLAS.cols - 1}.0 ) );
           int cy = int( clamp( floor( vAtlasUv.y * ${ATLAS.rows}.0 ), 0.0, ${ATLAS.rows - 1}.0 ) );
           return cy * ${ATLAS.cols} + cx;
         }`
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
         // Ground level, in the building's own frame, as it sinks. Measured from the
         // geometry's real floor rather than from zero: a few parts of the kit — a rover's
         // wheels, a crate's skids — sit a little proud of it, and testing against zero
         // would cut them off a building that is otherwise finished.
         float ground = uMinY + ( 1.0 - uProgress ) * ( uMaxY - uMinY );
         if ( vLocalY < ground - 0.001 ) discard;
         int cell = atlasCell();`
      )
      // The accent repaint. Luminance carries the swatch's own gradient across, so the trim
      // keeps its shading instead of going flat the moment it changes colour.
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float accentAmount = uCellAccent[ cell ];
         if ( accentAmount > 0.0 ) {
           float lum = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
           diffuseColor.rgb = mix( diffuseColor.rgb, uAccent * clamp( lum * 1.9, 0.3, 1.5 ), accentAmount );
         }`
      )
      // Per-cell PBR: painted panels, brushed metal and photovoltaic glass in one texture.
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = uCellRoughness[ cell ];')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = uCellMetalness[ cell ];')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         // Lamps and beacons, flagged per vertex when the recipe placed them.
         totalEmissiveRadiance += diffuseColor.rgb * vEmissive * ( 0.25 + uNight * 2.4 );
         // Window strips and trim come on after dark, in the repo's own colour.
         totalEmissiveRadiance += uAccent * uCellAccent[ cell ] * uNight * 1.15;
         // The construction line: a bright band riding just above the ground it rises from.
         float band = 1.0 - smoothstep( 0.0, 0.22, vLocalY - ground );
         totalEmissiveRadiance += uAccent * band * ( 1.0 - step( 0.999, uProgress ) ) * 1.5;`
      )
  }
  return material
}

/**
 * Shadows are rendered with three's own depth material, which knows nothing about the
 * sink — so without this a building at ten percent still casts its finished silhouette from
 * its finished position. The depth pass gets the same offset and the same discard, reading
 * the very same uniform objects.
 */
function depthMaterial(uniforms) {
  const mat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute float aSpin;
         attribute vec3 aPivot;
         varying float vLocalY;
         uniform float uProgress;
         uniform float uMaxY;
         uniform float uMinY;
         uniform float uTime;

         vec3 botSpin( vec3 p, vec3 hub, float angle ) {
           vec3 r = p - hub;
           float s = sin( angle );
           float c = cos( angle );
           return hub + vec3( r.x * c - r.y * s, r.x * s + r.y * c, r.z );
         }`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         if ( aSpin > 0.0 ) transformed = botSpin( transformed, aPivot, uTime * aSpin );
         vLocalY = transformed.y;
         transformed.y -= ( 1.0 - uProgress ) * ( uMaxY - uMinY );`
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying float vLocalY;
         uniform float uProgress;
         uniform float uMaxY;
         uniform float uMinY;`
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
         if ( vLocalY < uMinY + ( 1.0 - uProgress ) * ( uMaxY - uMinY ) - 0.001 ) discard;`
      )
  }
  return mat
}

/**
 * Build one structure. `seed` is derived from the thread id, so the same session always
 * gets the same building; `kind` can be forced, otherwise the seed picks it.
 *
 * Requires `loadKit()` to have resolved — boot awaits it before the first roster arrives.
 */
export function createBuilding({ seed = 1, accent = 0xc96442, kind = null } = {}) {
  const rand = mulberry(seed)
  const chosen = kind && KINDS[kind] ? kind : KIND_IDS[Math.floor(rand() * KIND_IDS.length)]

  const c = new Composer()
  const label = KINDS[chosen](c, rand, accent)
  const geo = c.finish()
  // Trimmed to fit a slot: the catalogue is authored on the pack's module grid and scaled
  // once here, so tuning the plot lattice never means re-tuning ten recipes.
  geo.scale(BUILDING_SCALE, BUILDING_SCALE, BUILDING_SCALE)
  // `scale()` transforms position and normal and nothing else, so a custom attribute that
  // holds a *position* has to be taken along by hand. Miss this and a rotor turns about a
  // hub left behind at the unscaled height — the blades orbit a point below themselves.
  const pivot = geo.getAttribute('aPivot')
  if (pivot) {
    for (let i = 0; i < pivot.count * 3; i++) pivot.array[i] *= BUILDING_SCALE
    pivot.needsUpdate = true
  }
  geo.computeBoundingBox()
  const height = geo.boundingBox.max.y
  const footprint = Math.max(
    Math.abs(geo.boundingBox.max.x),
    Math.abs(geo.boundingBox.min.x),
    Math.abs(geo.boundingBox.max.z),
    Math.abs(geo.boundingBox.min.z)
  )

  // One uniform block, shared by the surface pass and the shadow pass.
  const uniforms = {
    uProgress: { value: 1 },
    uMaxY: { value: height },
    uMinY: { value: geo.boundingBox.min.y },
    uAccent: { value: new THREE.Color(accent) },
    uNight: buildingUniforms.uNight,
    uTime: buildingUniforms.uTime,
    uCellAccent: { value: ACCENT_MASK },
    uCellRoughness: { value: ROUGHNESS },
    uCellMetalness: { value: METALNESS },
  }

  const material = decorate(
    new THREE.MeshStandardMaterial({
      map: atlasTexture(),
      // Roughness and metalness arrive per atlas cell; these are only the fallback values.
      roughness: 0.6,
      metalness: 0,
      emissive: 0x000000, // additions in the shader are the only emission
      // Single-sided, unlike the procedural buildings this replaced.
      //
      // The pack's models are closed solids, so there is nothing to see through — and being
      // closed is exactly why they must not be drawn double-sided. They are modelled as
      // stacked boxes, which leaves a floor and the ceiling under it sharing a plane all
      // over the kit: a landing pad and the lander standing on it put 38 up-facing and 17
      // down-facing triangles at one height. Drawn double-sided both halves of every such
      // pair rasterise at identical depth and the winner is decided by floating-point
      // noise, which is a whole colony of surfaces flickering. Back-face culling throws the
      // downward half away before it can fight.
      side: THREE.FrontSide,
    }),
    uniforms
  )

  const mesh = new THREE.Mesh(geo, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  const depth = depthMaterial(uniforms)
  depth.side = THREE.BackSide
  mesh.customDepthMaterial = depth

  mesh.userData.kind = chosen
  mesh.userData.label = label
  mesh.userData.height = height
  mesh.userData.footprint = footprint
  mesh.userData.uniforms = uniforms
  mesh.userData.progress = 1
  mesh.userData.setProgress = (p) => {
    const v = THREE.MathUtils.clamp(p, 0, 1)
    mesh.userData.progress = v
    uniforms.uProgress.value = v
    mesh.visible = v > 0.02
  }

  return mesh
}

/** Scaffolding around anything still going up. One instanced mesh for the whole colony. */
export class Scaffolds {
  constructor(scene, capacity = 256) {
    const geo = new THREE.CylinderGeometry(0.045, 0.045, 1, 5)
    geo.translate(0, 0.5, 0) // pivot at the foot, so scaling grows it upward
    this.mesh = new THREE.InstancedMesh(
      geo,
      new THREE.MeshStandardMaterial({ color: 0xb08d52, roughness: 0.85, flatShading: true }),
      capacity
    )
    this.mesh.castShadow = true
    this.mesh.count = 0
    this.mesh.frustumCulled = false
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    scene.add(this.mesh)
    this.scene = scene
    this.capacity = capacity
    this._dummy = new THREE.Object3D()
  }

  /** `sites` are `{ x, y, z, radius, height }` for every building not yet finished. */
  update(sites) {
    const d = this._dummy
    let n = 0
    for (const site of sites) {
      for (let i = 0; i < 4 && n < this.capacity; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.78
        d.position.set(site.x + Math.cos(a) * site.radius, site.y, site.z + Math.sin(a) * site.radius)
        d.rotation.set(0, a, 0)
        d.scale.set(1, Math.max(0.4, site.height), 1)
        d.updateMatrix()
        this.mesh.setMatrixAt(n++, d.matrix)
      }
    }
    this.mesh.count = n
    this.mesh.instanceMatrix.needsUpdate = true
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
    this.scene.remove(this.mesh)
  }
}
