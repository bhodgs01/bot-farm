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
/**
 * Per-kind size on top of BUILDING_SCALE. Set pieces are authored to fill a slot, but a
 * printer or a workbench standing two astronauts tall reads as a monument, not a tool, and
 * several of them on one hex collide. These bring the furniture back to astronaut scale.
 */
const KIND_SCALE = { printer: 0.55, bench: 0.5, yard: 0.55, desk: 0.75, newsstand: 0.6 }

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
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Broad octagonal dwelling with a tiered roof.
    c.geom(new THREE.CylinderGeometry(1.33, 1.44, 0.18, 8), CELL.SLATE, { y: 0.09 })
    c.geom(new THREE.CylinderGeometry(1.2, 1.29, 0.96, 8), CELL.WHITE, { y: 0.66 })
    c.geom(new THREE.CylinderGeometry(1.28, 1.28, 0.14, 8), CELL.GREY, { y: 1.21 })
    c.geom(new THREE.CylinderGeometry(0.75, 1.24, 0.39, 8), CELL.TRIM, { y: 1.475 })
    c.geom(new THREE.CylinderGeometry(0.65, 0.75, 0.15, 8), CELL.WHITE, { y: 1.745 })

    // Projecting front airlock.
    box(0.88, 0.95, 0.42, CELL.GREY, { y: 0.565, z: 1.05 })
    box(0.62, 0.73, 0.1, CELL.SLATE, { y: 0.565, z: 1.31 })
    box(0.41, 0.53, 0.07, CELL.SOLAR_A, { y: 0.565, z: 1.4 })
    box(1.01, 0.13, 0.45, CELL.GREY, { y: 0.155, z: 1.28 })
    box(0.5, 0.09, 0.12, CELL.WHITE, {
      y: 1.08, z: 1.31, emissive: 0.65
    })

    // Broad side windows.
    for (const s of [-1, 1]) {
      const window = new THREE.CylinderGeometry(0.25, 0.25, 0.12, 12)
      window.rotateX(Math.PI / 2)
      c.geom(window, CELL.SOLAR_A, { x: s * 0.84, y: 0.77, z: 0.87, ry: s * 0.6 })
    }
    box(0.57, 0.19, 0.48, rand() > 0.5 ? CELL.GREY : CELL.SLATE, {
      x: 0.26, y: 1.915, z: -0.14
    })
    return 'Habitat'
  },

  solar(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)
    const tilt = 0.48 + rand() * 0.08

    // Unified mounting bed.
    box(3.0, 0.13, 2.15, CELL.SLATE, { y: 0.065 })
    for (const z of [-0.74, 0.74]) {
      box(2.87, 0.13, 0.15, CELL.GREY, { y: 0.23, z })
    }

    // Three broad panels with visible front-facing surfaces.
    for (const x of [-0.97, 0, 0.97]) {
      box(0.14, 0.6, 0.18, CELL.GREY, { x, y: 0.49 })
      const frame = new THREE.BoxGeometry(0.89, 0.13, 1.85)
      frame.rotateX(tilt)
      c.geom(frame, CELL.WHITE, { x, y: 0.94 })
      const glass = new THREE.BoxGeometry(0.73, 0.065, 1.68)
      glass.translate(0, 0.1, 0)
      glass.rotateX(tilt)
      c.geom(glass, CELL.SOLAR_A, { x, y: 0.94 })
      for (const z of [-0.43, 0.43]) {
        const rail = new THREE.BoxGeometry(0.74, 0.055, 0.07)
        rail.translate(0, 0.16, z)
        rail.rotateX(tilt)
        c.geom(rail, CELL.GREY, { x, y: 0.94 })
      }
    }
    return 'Solar Array'
  },

  antenna(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Stable base and tapered communications mast.
    c.geom(new THREE.CylinderGeometry(0.68, 0.85, 0.18, 8), CELL.SLATE, { y: 0.09 })
    c.geom(new THREE.CylinderGeometry(0.11, 0.24, 2.08, 8), CELL.WHITE, { y: 1.22 })
    box(0.61, 0.57, 0.5, CELL.GREY, { y: 0.465, z: 0.32 })
    box(0.37, 0.19, 0.07, CELL.SOLAR_A, { y: 0.51, z: 0.61 })

    // Broad fixed crossbars make the mast identifiable.
    for (const [y, w] of [[1.1, 1.13], [1.65, 1.63]]) {
      box(w, 0.13, 0.14, CELL.GREY, { y })
      for (const s of [-1, 1]) {
        box(0.13, 0.43, 0.15, CELL.TRIM, { x: s * (w / 2 - 0.065), y })
      }
    }

    // Single rotating antenna head.
    c.geom(new THREE.CylinderGeometry(0.2, 0.2, 0.17, 8), CELL.SLATE, { y: 2.345 })
    c.geom(new THREE.BoxGeometry(1.39, 0.26, 0.22), CELL.WHITE, {
      y: 2.56, spin: 0.17 + rand() * 0.07
    })
    c.geom(new THREE.SphereGeometry(0.11, 8, 6), CELL.RED, {
      y: 2.78, emissive: 0.7
    })
    return 'Relay Mast'
  },

  silo(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Twin storage vessels with broad collars.
    box(3.0, 0.16, 2.29, CELL.SLATE, { y: 0.08 })
    for (const x of [-0.74, 0.74]) {
      const h = x < 0 ? 1.37 : 1.18 + rand() * 0.13
      c.geom(new THREE.CylinderGeometry(0.61, 0.67, 0.24, 12), CELL.GREY, {
        x, y: 0.28, z: -0.17
      })
      c.geom(new THREE.CylinderGeometry(0.59, 0.59, h, 12), CELL.WHITE, {
        x, y: 0.4 + h / 2, z: -0.17
      })
      for (const y of [0.62, 1.29]) {
        c.geom(new THREE.CylinderGeometry(0.63, 0.63, 0.13, 12), CELL.TRIM, {
          x, y, z: -0.17
        })
      }
      c.geom(new THREE.ConeGeometry(0.65, 0.43, 12), CELL.GREY, {
        x, y: 0.4 + h + 0.215, z: -0.17
      })
      box(0.29, 0.3, 0.19, CELL.SLATE, { x, y: 0.44, z: 0.47 })
    }

    // Service bridge and front distribution box.
    box(1.45, 0.16, 0.46, CELL.GREY, { y: 1.56, z: -0.17 })
    box(0.59, 0.55, 0.48, CELL.SLATE, { y: 0.435, z: 0.72 })
    box(0.38, 0.16, 0.07, CELL.TRIM, { y: 0.52, z: 1.0 })
    return 'Storage'
  },

  greenhouse(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Conservatory base and rear glass wall.
    box(2.9, 0.18, 2.65, CELL.SLATE, { y: 0.09 })
    box(2.52, 1.17, 0.1, CELL.SOLAR_A, { y: 0.765, z: -1.03 })
    for (const x of [-1.22, 1.22]) {
      box(0.14, 1.28, 0.14, CELL.WHITE, { x, y: 0.82, z: -1.02 })
      box(0.14, 1.28, 0.14, CELL.WHITE, { x, y: 0.82, z: 0.97 })
      box(0.1, 0.63, 1.92, CELL.SOLAR_A, { x, y: 0.525 })
    }

    // Gabled glass roof with broad pale ribs.
    for (const s of [-1, 1]) {
      const roof = new THREE.BoxGeometry(1.44, 0.1, 2.16)
      roof.rotateZ(-s * 0.46)
      c.geom(roof, CELL.SOLAR_B, { x: s * 0.62, y: 1.72 })
      for (const z of [-1.05, 0, 1.05]) {
        const rib = new THREE.BoxGeometry(1.48, 0.14, 0.12)
        rib.rotateZ(-s * 0.46)
        c.geom(rib, CELL.WHITE, { x: s * 0.62, y: 1.77, z })
      }
    }
    box(0.15, 0.16, 2.26, CELL.WHITE, { y: 2.08 })

    // Open entrance and oversized plant beds.
    for (const x of [-0.34, 0.34]) {
      box(0.12, 1.31, 0.15, CELL.WHITE, { x, y: 0.835, z: 1.02 })
    }
    box(0.8, 0.15, 0.19, CELL.TRIM, { y: 1.56, z: 1.02 })
    for (const x of [-0.8, 0.8]) {
      box(0.57, 0.27, 1.54, CELL.ROCK, { x, y: 0.315 })
      for (const z of [-0.48, 0.4]) {
        const r = 0.25 + rand() * 0.04
        c.geom(new THREE.SphereGeometry(r, 8, 6), CELL.TRIM, {
          x, y: 0.45 + r, z
        })
      }
    }
    return 'Greenhouse'
  },

  reactor(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Armored central vessel with a single luminous band.
    c.geom(new THREE.CylinderGeometry(1.36, 1.47, 0.19, 8), CELL.SLATE, { y: 0.095 })
    c.geom(new THREE.CylinderGeometry(0.64, 0.8, 0.57, 12), CELL.GREY, { y: 0.475 })
    c.geom(new THREE.CylinderGeometry(0.6, 0.6, 0.63, 12), CELL.TRIM, {
      y: 1.075, emissive: 0.4 + rand() * 0.1
    })
    c.geom(new THREE.CylinderGeometry(0.78, 0.66, 0.26, 12), CELL.WHITE, { y: 1.52 })
    c.geom(new THREE.ConeGeometry(0.78, 0.43, 12), CELL.SLATE, { y: 1.865 })

    // Four heavy cooling columns framing the core.
    for (const x of [-0.92, 0.92]) {
      for (const z of [-0.65, 0.65]) {
        box(0.35, 1.26, 0.37, CELL.GREY, { x, y: 0.82, z })
        box(0.44, 0.16, 0.45, CELL.WHITE, { x, y: 1.53, z })
        box(0.2, 0.61, 0.08, CELL.SLATE, { x, y: 0.84, z: z + 0.23 })
        box(0.5, 0.15, 0.2, CELL.GREY, { x: x * 0.74, y: 1.35, z })
      }
    }
    box(0.61, 0.35, 0.26, CELL.SLATE, { y: 0.365, z: 1.02 })
    box(0.39, 0.17, 0.07, CELL.WHITE, {
      y: 0.39, z: 1.185, emissive: 0.6
    })
    return 'Reactor'
  },

  /**
   * The Brain's landmark: a deep-space dish on a mast, feed horn on three struts, beacon at
   * the focus. The pack has no antenna, so this one is lathed from a parabola and pinned to
   * the pack's white swatch; the mast and struts take the grey structural one.
   */
  dish(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Broad pedestal and fork.
    c.geom(new THREE.CylinderGeometry(0.82, 1.05, 0.22, 8), CELL.SLATE, { y: 0.11 })
    c.geom(new THREE.CylinderGeometry(0.42, 0.62, 0.65, 8), CELL.WHITE, { y: 0.53 })
    box(1.18, 0.22, 0.58, CELL.TRIM, { y: 0.94 })
    for (const x of [-0.5, 0.5]) {
      box(0.22, 0.52, 0.36, CELL.GREY, { x, y: 1.12 })
    }
    box(0.42, 0.18, 0.08, CELL.SOLAR_A, { y: 0.56, z: 0.56 })

    // Closed, thick-walled bowl tilted toward +z.
    const tilt = 0.72
    const place = (g, cell, o = {}) => {
      g.rotateX(tilt)
      c.geom(g, cell, { y: 1.42, z: -0.16, ...o })
    }
    const profile = [
      new THREE.Vector2(0, 0.08),
      new THREE.Vector2(0.3, 0.10),
      new THREE.Vector2(0.64, 0.19),
      new THREE.Vector2(0.96, 0.34),
      new THREE.Vector2(1.18, 0.49),
      new THREE.Vector2(1.23, 0.43),
      new THREE.Vector2(1.02, 0.26),
      new THREE.Vector2(0.69, 0.10),
      new THREE.Vector2(0.32, 0.01),
      new THREE.Vector2(0, 0)
    ]
    place(new THREE.LatheGeometry(profile, 20), CELL.WHITE)
    const rim = new THREE.TorusGeometry(1.19, 0.065, 6, 20)
    rim.rotateX(Math.PI / 2)
    rim.translate(0, 0.46, 0)
    place(rim, CELL.TRIM)

    // Oversized feed supported by two visible arms.
    for (const s of [-1, 1]) {
      const arm = new THREE.BoxGeometry(0.1, 1.02, 0.1)
      arm.rotateZ(s * 0.85)
      arm.translate(s * 0.43, 0.60, 0)
      place(arm, CELL.GREY)
    }
    const horn = new THREE.CylinderGeometry(0.18, 0.11, 0.25, 8)
    horn.translate(0, 0.94, 0)
    place(horn, CELL.SLATE)
    const beacon = new THREE.SphereGeometry(0.1, 8, 6)
    beacon.translate(0, 1.1, 0)
    place(beacon, CELL.RED, { emissive: 0.65 + rand() * 0.2 })
    return 'Antenna'
  },

  /**
   * A 3D printer: bed on a base, two uprights and a top bar, a gantry carrying the
   * toolhead, a lit screen on the front. The gantry takes the plot's accent so a farm of
   * them still reads as one client's machines.
   */
  printer(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)
    const headX = (rand() - 0.5) * 0.6

    // Open-front enclosure with a shallow rear wall.
    box(2.3, 0.28, 2.05, CELL.SLATE, { y: 0.14 })
    box(2.12, 0.22, 0.16, CELL.WHITE, { y: 0.35, z: 0.94 })
    box(2.1, 1.52, 0.16, CELL.GREY, { y: 1.03, z: -0.9 })
    for (const x of [-0.98, 0.98]) {
      box(0.22, 1.58, 0.24, CELL.WHITE, { x, y: 1.07, z: 0.78 })
      box(0.22, 0.18, 1.8, CELL.WHITE, { x, y: 1.82 })
    }
    box(2.18, 0.22, 0.28, CELL.TRIM, { y: 1.82, z: 0.78 })

    // Build plate, gantry, and oversized print head.
    box(1.7, 0.14, 1.48, CELL.BLACK, { y: 0.46 })
    box(1.56, 0.08, 1.32, CELL.GREY, { y: 0.57 })
    box(1.84, 0.16, 0.2, CELL.SLATE, { y: 1.37, z: 0.05 })
    box(0.45, 0.4, 0.4, CELL.WHITE, { x: headX, y: 1.27, z: 0.21 })
    box(0.28, 0.19, 0.07, CELL.BLACK, { x: headX, y: 1.29, z: 0.445 })
    c.geom(new THREE.ConeGeometry(0.1, 0.16, 6).rotateX(Math.PI), CELL.RED, {
      x: headX, y: 1.01, z: 0.21
    })
    c.geom(new THREE.CylinderGeometry(0.27, 0.38, 0.32, 6), CELL.TRIM, {
      x: headX, y: 0.77, z: 0.21
    })

    // Top spool with a visible central opening.
    box(0.16, 0.4, 0.18, CELL.GREY, { x: -0.45, y: 1.98, z: -0.3 })
    c.geom(new THREE.TorusGeometry(0.31, 0.105, 8, 16), CELL.TRIM, {
      x: -0.45, y: 2.17, z: -0.3
    })
    box(0.52, 0.25, 0.14, CELL.BLACK, { x: 0.61, y: 0.42, z: 1.05 })
    box(0.38, 0.14, 0.06, CELL.WHITE, {
      x: 0.61, y: 0.44, z: 1.15, emissive: 0.65
    })
    return 'Printer'
  },

  /**
   * A server: a tall dark cabinet with rows of status lights up the front and a vent
   * grille, standing on a plinth. Nineteen of them is a data hall.
   */
  rack(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)
    const status = rand() > 0.25 ? CELL.WHITE : CELL.RED

    // Armored cabinet with readable pale corners.
    box(1.7, 0.18, 1.5, CELL.SLATE, { y: 0.09 })
    box(1.4, 2.0, 1.16, CELL.SLATE, { y: 1.18 })
    for (const x of [-0.68, 0.68]) {
      box(0.16, 2.08, 0.2, CELL.GREY, { x, y: 1.22, z: 0.53 })
    }
    box(1.62, 0.2, 1.38, CELL.WHITE, { y: 2.26 })
    box(1.1, 0.12, 0.08, CELL.TRIM, { y: 2.25, z: 0.73 })

    // Five large server trays.
    for (let i = 0; i < 5; i++) {
      const y = 0.43 + i * 0.35
      box(1.13, 0.27, 0.14, CELL.GREY, { y, z: 0.63 })
      box(0.57, 0.1, 0.06, CELL.BLACK, { x: 0.12, y, z: 0.73 })
      box(0.13, 0.1, 0.06, i < 2 ? status : CELL.TRIM, {
        x: -0.41, y, z: 0.73, emissive: i < 2 ? 0.65 : 0
      })
    }

    // Twin recessed roof fans.
    for (const x of [-0.37, 0.37]) {
      c.geom(new THREE.CylinderGeometry(0.26, 0.26, 0.07, 12), CELL.BLACK, {
        x, y: 2.395
      })
      box(0.37, 0.06, 0.09, CELL.GREY, { x, y: 2.45 })
      box(0.09, 0.06, 0.37, CELL.GREY, { x, y: 2.45 })
    }
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
    const seatCell = rand() > 0.5 ? CELL.RED : CELL.TRIM

    // Screen and curtains form the skyline.
    box(3.0, 0.12, 3.0, CELL.SLATE, { y: 0.06 })
    box(2.82, 0.2, 0.54, CELL.GREY, { y: 0.22, z: -1.13 })
    box(2.72, 1.57, 0.18, CELL.BLACK, { y: 1.42, z: -1.25 })
    box(2.18, 1.17, 0.08, CELL.WHITE, {
      y: 1.45, z: -1.11, emissive: 0.6
    })
    for (const x of [-1.24, 1.24]) {
      box(0.23, 1.5, 0.3, CELL.RED, { x, y: 1.43, z: -1.06 })
    }
    box(2.9, 0.23, 0.36, CELL.TRIM, { y: 2.24, z: -1.17 })

    // Six substantial seats on two terraces.
    for (let r = 0; r < 2; r++) {
      const z = -0.16 + r * 0.85
      const floor = 0.12 + r * 0.14
      box(2.74, 0.14 + r * 0.14, 0.78, CELL.GREY, {
        y: (0.14 + r * 0.14) / 2 + 0.12, z
      })
      for (const x of [-0.86, 0, 0.86]) {
        box(0.58, 0.22, 0.51, CELL.SLATE, { x, y: floor + 0.25, z })
        box(0.61, 0.14, 0.51, seatCell, { x, y: floor + 0.43, z })
        box(0.61, 0.48, 0.16, seatCell, {
          x, y: floor + 0.56, z: z + 0.25
        })
      }
    }

    // Elevated rear projector clears the audience.
    box(0.34, 1.15, 0.28, CELL.SLATE, { y: 0.695, z: 1.29 })
    box(0.62, 0.32, 0.5, CELL.WHITE, { y: 1.4, z: 1.24 })
    const lens = new THREE.CylinderGeometry(0.13, 0.13, 0.14, 10)
    lens.rotateX(Math.PI / 2)
    c.geom(lens, CELL.SOLAR_A, { y: 1.4, z: 0.94, emissive: 0.7 })
    return 'Theater'
  },

  /**
   * CorrosionDC's landmark: a pumpjack. Concrete base, an A-frame samson post, the walking
   * beam with a horsehead at the well end, a counterweight crank turning at the back, and
   * the wellhead pipe. The crank is the moving part; the beam holds its nod.
   */
  pumpjack(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Wide skid and paired A-frames.
    box(3.0, 0.18, 1.95, CELL.SLATE, { y: 0.09 })
    for (const z of [-0.39, 0.39]) {
      for (const s of [-1, 1]) {
        const leg = new THREE.BoxGeometry(0.18, 1.62, 0.2)
        leg.rotateZ(s * 0.32)
        c.geom(leg, CELL.GREY, { x: s * 0.26, y: 0.99, z })
      }
      box(0.96, 0.15, 0.2, CELL.TRIM, { y: 0.7, z })
    }
    box(0.5, 0.24, 1.0, CELL.GREY, { y: 1.78 })

    // Long beam and broad horsehead.
    const beam = new THREE.BoxGeometry(2.56, 0.23, 0.37)
    beam.rotateZ(0.12)
    c.geom(beam, CELL.TRIM, { y: 1.98 })
    const head = new THREE.BoxGeometry(0.42, 0.7, 0.55)
    head.rotateZ(0.12)
    c.geom(head, CELL.RED, { x: -1.16, y: 1.66 })
    box(0.1, 0.94, 0.1, CELL.GREY, { x: -1.22, y: 0.87 })
    c.geom(new THREE.CylinderGeometry(0.2, 0.25, 0.35, 8), CELL.BLACK, {
      x: -1.22, y: 0.355
    })

    // Exposed flywheel and large off-center counterweight.
    box(0.66, 0.59, 0.64, CELL.GREY, { x: 0.87, y: 0.475 })
    c.geom(new THREE.TorusGeometry(0.35, 0.1, 6, 14), CELL.BLACK, {
      x: 0.84, y: 0.86, z: 0.46
    })
    box(0.7, 0.13, 0.12, CELL.GREY, {
      x: 0.84, y: 0.86, z: 0.46
    })
    box(0.3, 0.28, 0.18, CELL.RED, {
      x: 1.04, y: 0.65, z: 0.52
    })
    const arm = new THREE.BoxGeometry(0.13, 1.12, 0.14)
    arm.rotateZ(-0.13)
    c.geom(arm, CELL.GREY, { x: 0.83, y: 1.42, z: 0.48 })

    // Rear tank stays inside the skid.
    const tankH = 0.6 + rand() * 0.14
    c.geom(new THREE.CylinderGeometry(0.29, 0.29, tankH, 10), CELL.WHITE, {
      x: 0.66, y: 0.18 + tankH / 2, z: -0.65
    })
    box(0.32, 0.09, 0.08, CELL.RED, { x: 0.87, y: 0.51, z: 0.35 })
    return 'Pumpjack'
  },

  /**
   * A workbench: table, vise, a pegboard with a few tools, a stool. What a project looks
   * like while it is on the bench.
   */
  bench(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Heavy bench with a full-height tool wall.
    box(2.7, 0.12, 2.35, CELL.SLATE, { y: 0.06 })
    for (const x of [-0.9, 0.9]) {
      box(0.42, 0.78, 0.85, CELL.GREY, { x, y: 0.51, z: -0.3 })
    }
    box(2.48, 0.18, 1.12, CELL.ROCK, { y: 0.99, z: -0.3 })
    box(2.1, 0.14, 0.78, CELL.SLATE, { y: 0.4, z: -0.3 })
    box(2.4, 1.02, 0.16, CELL.SLATE, { y: 1.59, z: -0.92 })
    box(2.56, 0.18, 0.28, CELL.TRIM, { y: 2.14, z: -0.92 })

    // Large hammer, wrench, and hanging saw.
    box(0.14, 0.54, 0.12, CELL.ROCK, { x: -0.78, y: 1.57, z: -0.77 })
    box(0.43, 0.2, 0.16, CELL.GREY, { x: -0.78, y: 1.84, z: -0.76 })
    box(0.14, 0.47, 0.12, CELL.GREY, { x: -0.12, y: 1.55, z: -0.77 })
    c.geom(new THREE.TorusGeometry(0.16, 0.065, 6, 10, Math.PI * 1.5), CELL.GREY, {
      x: -0.12, y: 1.84, z: -0.77
    })
    box(0.48, 0.25, 0.12, CELL.GREY, { x: 0.62, y: 1.61, z: -0.77 })
    box(0.16, 0.36, 0.16, CELL.RED, { x: 0.91, y: 1.63, z: -0.75 })

    // Chunky vise and a single workpiece.
    box(0.55, 0.13, 0.44, CELL.SLATE, { x: 0.73, y: 1.145, z: 0.03 })
    for (const x of [0.55, 0.92]) {
      box(0.14, 0.29, 0.38, CELL.GREY, { x, y: 1.32, z: 0.03 })
    }
    box(0.76, 0.1, 0.1, CELL.BLACK, { x: 0.75, y: 1.23, z: 0.18 })
    box(0.1, 0.34, 0.1, CELL.RED, { x: 1.13, y: 1.23, z: 0.18 })
    box(0.46, 0.23, 0.4, rand() > 0.5 ? CELL.WHITE : CELL.TRIM, {
      x: -0.45, y: 1.195, z: -0.16
    })

    // Broad stool in front.
    c.geom(new THREE.CylinderGeometry(0.36, 0.36, 0.14, 10), CELL.RED, {
      x: -0.36, y: 0.66, z: 0.76
    })
    c.geom(new THREE.CylinderGeometry(0.1, 0.14, 0.47, 8), CELL.GREY, {
      x: -0.36, y: 0.355, z: 0.76
    })
    c.geom(new THREE.CylinderGeometry(0.33, 0.38, 0.1, 10), CELL.SLATE, {
      x: -0.36, y: 0.17, z: 0.76
    })
    return 'Workbench'
  },

  /**
   * A newsstand: the Newsroom's landmark. A kiosk with a counter, a back wall, an awning
   * in the zone's colour, a stack of the morning's papers on the counter and a headline
   * board out front.
   */
  newsstand(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Open kiosk with short side returns.
    box(2.9, 0.14, 2.65, CELL.SLATE, { y: 0.07 })
    box(2.4, 1.62, 0.16, CELL.GREY, { y: 0.95, z: -1.0 })
    for (const x of [-1.14, 1.14]) {
      box(0.16, 1.66, 0.58, CELL.WHITE, { x, y: 0.97, z: -0.79 })
      box(0.14, 1.7, 0.14, CELL.WHITE, { x, y: 0.99, z: 0.35 })
    }
    box(2.4, 0.63, 0.55, CELL.WHITE, { y: 0.455, z: 0.36 })
    box(2.58, 0.14, 0.7, CELL.SLATE, { y: 0.84, z: 0.36 })

    // Shallow striped canopy leaves the counter visible.
    box(2.7, 0.16, 1.82, CELL.TRIM, { y: 1.9, z: -0.36 })
    for (const x of [-0.96, 0, 0.96]) {
      box(0.29, 0.06, 1.8, CELL.WHITE, { x, y: 2.01, z: -0.36 })
    }
    box(2.7, 0.23, 0.16, CELL.TRIM, { y: 1.82, z: 0.5 })

    // Rooftop newspaper emblem.
    box(1.0, 0.43, 0.15, CELL.WHITE, { y: 2.235, z: -0.54 })
    box(0.7, 0.08, 0.06, CELL.BLACK, { y: 2.34, z: -0.43 })
    box(0.23, 0.15, 0.06, CELL.SOLAR_A, { x: -0.23, y: 2.18, z: -0.43 })
    box(0.32, 0.07, 0.06, CELL.GREY, { x: 0.16, y: 2.19, z: -0.43 })

    // Big paper stacks and upright covers.
    for (const x of [-0.76, 0, 0.76]) {
      const h = 0.12 + rand() * 0.12
      box(0.53, h, 0.43, CELL.WHITE, { x, y: 0.91 + h / 2, z: 0.38 })
      box(0.32, 0.06, 0.1, CELL.SLATE, { x, y: 0.94 + h, z: 0.43 })
      box(0.51, 0.4, 0.12, x === 0 ? CELL.RED : CELL.WHITE, {
        x, y: 1.31, z: -0.84
      })
    }
    box(2.15, 0.1, 0.36, CELL.SLATE, { y: 1.05, z: -0.78 })
    return 'Newsstand'
  },

  /** A packed crate: a finished job waiting to be paid for and shipped. */
  crate(c, rand) {
    c.add(rand() > 0.5 ? 'cargo_A_packed' : 'cargo_B_packed')
    c.add('cargo_A', { x: 0.9, z: 0.5, ry: rand() * 6.28, s: 0.7 })
    return 'Crate'
  },

  /** A deck: boards in the zone's colour on joists, with railing posts and a bench. */
  deck(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Raised foundation and six broad deck boards.
    box(2.78, 0.3, 2.16, CELL.SLATE, { y: 0.15, z: -0.27 })
    for (let i = 0; i < 6; i++) {
      box(0.44, 0.13, 2.24, CELL.ROCK, {
        x: -1.175 + i * 0.47, y: 0.365, z: -0.27
      })
    }

    // Rear and side rails leave the front entry open.
    for (const x of [-1.3, 1.3]) {
      for (const z of [-1.24, 0.6]) {
        box(0.15, 1.02, 0.15, CELL.WHITE, { x, y: 0.94, z })
        box(0.23, 0.1, 0.23, CELL.TRIM, { x, y: 1.5, z })
      }
      box(0.14, 0.14, 1.98, CELL.WHITE, { x, y: 1.35, z: -0.32 })
      box(0.1, 0.12, 1.92, CELL.GREY, { x, y: 0.87, z: -0.32 })
    }
    box(2.7, 0.14, 0.14, CELL.WHITE, { y: 1.35, z: -1.24 })
    box(2.62, 0.12, 0.1, CELL.GREY, { y: 0.87, z: -1.24 })

    // Broad steps fit entirely within the front boundary.
    box(1.22, 0.28, 0.34, CELL.ROCK, { y: 0.14, z: 0.98 })
    box(1.38, 0.14, 0.34, CELL.ROCK, { y: 0.07, z: 1.31 })

    // Built-in rear bench with an accent cushion.
    for (const x of [-0.77, 0.37]) {
      box(0.18, 0.38, 0.42, CELL.SLATE, { x, y: 0.62, z: -0.79 })
    }
    box(1.62, 0.15, 0.55, CELL.ROCK, { x: -0.2, y: 0.88, z: -0.79 })
    box(1.56, 0.38, 0.14, CELL.ROCK, { x: -0.2, y: 1.09, z: -1.02 })
    box(1.42, 0.1, 0.43, CELL.TRIM, { x: -0.2, y: 1.005, z: -0.74 })

    // Small side table with one substantial accessory.
    c.geom(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 10), CELL.WHITE, {
      x: 0.84, y: 0.86, z: 0.02
    })
    c.geom(new THREE.CylinderGeometry(0.1, 0.18, 0.38, 8), CELL.GREY, {
      x: 0.84, y: 0.62, z: 0.02
    })
    c.geom(new THREE.CylinderGeometry(0.13, 0.1, 0.19, 8), CELL.ROCK, {
      x: 0.84, y: 1.005, z: 0.02
    })
    c.geom(new THREE.SphereGeometry(0.18 + rand() * 0.03, 8, 6), CELL.TRIM, {
      x: 0.84, y: 1.24, z: 0.02
    })
    return 'Deck'
  },

  /** A gazebo: six posts, a low rail, an eight-sided roof with a finial, a lantern under it. */
  gazebo(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Octagonal platform with a broad front step.
    c.geom(new THREE.CylinderGeometry(1.36, 1.43, 0.2, 8), CELL.SLATE, { y: 0.1 })
    c.geom(new THREE.CylinderGeometry(1.29, 1.29, 0.1, 8), CELL.ROCK, { y: 0.25 })
    box(1.05, 0.14, 0.38, CELL.GREY, { y: 0.07, z: 1.33 })

    // Four stout posts frame an unobstructed entrance.
    for (const x of [-0.84, 0.84]) {
      for (const z of [-0.73, 0.73]) {
        box(0.24, 0.2, 0.24, CELL.GREY, { x, y: 0.4, z })
        box(0.16, 1.25, 0.16, CELL.WHITE, { x, y: 1.075, z })
        box(0.29, 0.16, 0.29, CELL.WHITE, { x, y: 1.7, z })
      }
      box(0.12, 0.14, 1.62, CELL.WHITE, { x, y: 0.91 })
    }
    box(1.8, 0.14, 0.12, CELL.WHITE, { y: 0.91, z: -0.73 })

    // Low, tiered roof keeps the pavilion airy.
    c.geom(new THREE.CylinderGeometry(1.45, 1.45, 0.13, 8), CELL.WHITE, { y: 1.845 })
    c.geom(new THREE.CylinderGeometry(0.38, 1.48, 0.43, 8), CELL.TRIM, { y: 2.125 })
    c.geom(new THREE.CylinderGeometry(0.26, 0.3, 0.17, 8), CELL.WHITE, { y: 2.425 })
    c.geom(new THREE.ConeGeometry(0.43, 0.22, 8), CELL.RED, { y: 2.62 })

    // Rear bench and suspended lantern.
    for (const x of [-0.46, 0.46]) {
      box(0.14, 0.3, 0.28, CELL.GREY, { x, y: 0.45, z: -0.56 })
    }
    box(1.24, 0.14, 0.4, CELL.ROCK, { y: 0.67, z: -0.56 })
    box(1.24, 0.3, 0.12, CELL.ROCK, { y: 0.89, z: -0.73 })
    c.geom(new THREE.CylinderGeometry(0.05, 0.05, 0.21, 6), CELL.SLATE, {
      y: 1.69
    })
    box(0.28, 0.1, 0.28, CELL.SLATE, { y: 1.57 })
    box(0.22, 0.26, 0.22, CELL.WHITE, {
      y: 1.39, emissive: 0.65 + rand() * 0.15
    })
    box(0.28, 0.08, 0.28, CELL.SLATE, { y: 1.22 })
    return 'Gazebo'
  },

  /**
   * The Watchdog's landmark: the tall tower with its lights, a kennel beside it, and the
   * dog itself sitting at the door: boxy, grey, red collar, ears up, watching the colony.
   */
  kennel(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Large doghouse with a genuinely open doorway.
    box(2.95, 0.12, 2.85, CELL.SLATE, { y: 0.06 })
    box(1.52, 1.1, 0.15, CELL.WHITE, { x: -0.36, y: 0.67, z: -1.01 })
    for (const x of [-1.04, 0.32]) {
      box(0.18, 1.1, 1.38, CELL.WHITE, { x, y: 0.67, z: -0.39 })
    }
    for (const x of [-0.91, 0.19]) {
      box(0.42, 1.1, 0.18, CELL.WHITE, { x, y: 0.67, z: 0.24 })
    }
    box(0.76, 0.26, 0.19, CELL.WHITE, { x: -0.36, y: 1.1, z: 0.24 })
    box(0.72, 0.12, 0.36, CELL.ROCK, { x: -0.36, y: 0.18, z: 0.35 })

    // Thick gabled roof with a ridge cap.
    for (const s of [-1, 1]) {
      const roof = new THREE.BoxGeometry(1.04, 0.16, 1.7)
      roof.rotateZ(-s * 0.49)
      c.geom(roof, CELL.RED, { x: -0.36 + s * 0.43, y: 1.42, z: -0.4 })
    }
    box(0.18, 0.16, 1.72, CELL.TRIM, { x: -0.36, y: 1.68, z: -0.4 })

    // Oversized robot dog sitting beside the entry.
    const dx = 0.77
    const dz = 0.59
    box(0.53, 0.55, 0.65, CELL.GREY, { x: dx, y: 0.53, z: dz })
    box(0.62, 0.48, 0.52, CELL.WHITE, { x: dx, y: 1.0, z: dz + 0.12 })
    box(0.44, 0.23, 0.3, CELL.SLATE, { x: dx, y: 0.91, z: dz + 0.45 })
    box(0.2, 0.13, 0.08, CELL.BLACK, { x: dx, y: 0.95, z: dz + 0.64 })
    box(0.59, 0.12, 0.56, CELL.RED, { x: dx, y: 0.76, z: dz + 0.08 })
    for (const s of [-1, 1]) {
      box(0.17, 0.32, 0.19, CELL.GREY, {
        x: dx + s * 0.23, y: 1.36, z: dz + 0.07
      })
      box(0.11, 0.11, 0.06, CELL.SOLAR_A, {
        x: dx + s * 0.17, y: 1.07, z: dz + 0.41, emissive: 0.45
      })
      box(0.16, 0.39, 0.2, CELL.GREY, {
        x: dx + s * 0.18, y: 0.315, z: dz + 0.29
      })
      box(0.23, 0.16, 0.29, CELL.WHITE, {
        x: dx + s * 0.18, y: 0.2, z: dz + 0.39
      })
    }
    const tail = new THREE.BoxGeometry(0.14, 0.14, 0.47)
    tail.rotateX(0.5 + rand() * 0.2)
    c.geom(tail, CELL.GREY, { x: dx, y: 0.65, z: dz - 0.44 })

    // Bowl placed on the clear front-left apron.
    c.geom(new THREE.CylinderGeometry(0.26, 0.3, 0.15, 10), CELL.RED, {
      x: -0.75, y: 0.195, z: 0.95
    })
    c.geom(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 10), CELL.SOLAR_A, {
      x: -0.75, y: 0.27, z: 0.95
    })
    return 'Kennel'
  },

  /**
   * One office desk per email: the Inbox hex reads as an open-plan office. Desk on two
   * pedestals, a lit monitor, a chair pulled up, papers, and by turns a lamp, a plant or a
   * filing cabinet so a row of them is not a row of clones.
   */
  desk(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Wide top and two substantial pedestals.
    box(2.8, 0.1, 2.45, CELL.SLATE, { y: 0.05 })
    for (const x of [-0.82, 0.82]) {
      box(0.48, 0.76, 0.83, CELL.GREY, { x, y: 0.48, z: -0.39 })
    }
    box(2.5, 0.16, 1.07, CELL.WHITE, { y: 0.94, z: -0.39 })
    box(1.6, 0.44, 0.12, CELL.TRIM, { y: 0.63, z: -0.79 })
    for (const y of [0.34, 0.59, 0.79]) {
      box(0.25, 0.07, 0.07, CELL.SLATE, { x: 0.82, y, z: 0.065 })
    }

    // Large screen with a clear desktop beneath.
    box(0.45, 0.08, 0.31, CELL.SLATE, { x: -0.13, y: 1.06, z: -0.55 })
    box(0.13, 0.28, 0.13, CELL.GREY, { x: -0.13, y: 1.22, z: -0.61 })
    box(1.18, 0.7, 0.17, CELL.SLATE, { x: -0.13, y: 1.62, z: -0.6 })
    box(1.0, 0.52, 0.06, CELL.WHITE, {
      x: -0.13, y: 1.62, z: -0.475, emissive: 0.5
    })
    box(0.68, 0.07, 0.25, CELL.SLATE, { x: -0.13, y: 1.055, z: -0.02 })
    box(0.15, 0.08, 0.21, CELL.GREY, { x: 0.4, y: 1.06, z: -0.02 })

    // Chunky task chair with low back to preserve the screen.
    c.geom(new THREE.CylinderGeometry(0.39, 0.43, 0.1, 8), CELL.BLACK, {
      y: 0.15, z: 0.69
    })
    c.geom(new THREE.CylinderGeometry(0.11, 0.11, 0.34, 8), CELL.GREY, {
      y: 0.37, z: 0.69
    })
    box(0.7, 0.17, 0.65, CELL.RED, { y: 0.62, z: 0.69 })
    box(0.7, 0.55, 0.17, CELL.RED, { y: 0.88, z: 0.98 })
    for (const x of [-0.37, 0.37]) {
      box(0.12, 0.27, 0.48, CELL.SLATE, { x, y: 0.79, z: 0.72 })
    }

    // One readable desktop accessory.
    if (rand() > 0.5) {
      c.geom(new THREE.CylinderGeometry(0.19, 0.15, 0.24, 8), CELL.ROCK, {
        x: 0.92, y: 1.14, z: -0.56
      })
      c.geom(new THREE.SphereGeometry(0.26, 8, 6), CELL.TRIM, {
        x: 0.92, y: 1.46, z: -0.56
      })
    } else {
      box(0.39, 0.16, 0.45, CELL.TRIM, { x: 0.92, y: 1.1, z: -0.48 })
      box(0.31, 0.12, 0.36, CELL.WHITE, { x: 0.92, y: 1.24, z: -0.48 })
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

    // Lawn, clipped back hedge, and broad stepping stones.
    box(3.0, 0.12, 2.9, CELL.SLATE, { y: 0.06 })
    box(2.8, 0.07, 2.7, CELL.TRIM, { y: 0.155 })
    for (const x of [-1.02, -0.34, 0.34, 1.02]) {
      const h = 0.5 + rand() * 0.1
      box(0.62, h, 0.39, CELL.TRIM, { x, y: 0.19 + h / 2, z: -1.09 })
    }
    for (let i = 0; i < 3; i++) {
      box(0.6, 0.09, 0.44, CELL.GREY, {
        x: 0.12 + i * 0.06, y: 0.235, z: 1.08 - i * 0.58,
        ry: (rand() - 0.5) * 0.12
      })
    }

    // Sculptural tree kept clear of the entrance.
    c.geom(new THREE.CylinderGeometry(0.49, 0.55, 0.16, 10), CELL.ROCK, {
      x: -0.81, y: 0.27, z: -0.31
    })
    c.geom(new THREE.CylinderGeometry(0.12, 0.18, 1.03, 8), CELL.ROCK, {
      x: -0.81, y: 0.845, z: -0.31
    })
    c.geom(new THREE.SphereGeometry(0.57, 8, 6), CELL.TRIM, {
      x: -0.81, y: 1.64, z: -0.31
    })
    c.geom(new THREE.SphereGeometry(0.38, 8, 6), CELL.TRIM, {
      x: -0.57, y: 1.92, z: -0.36
    })

    // Raised shrub bed on the opposite edge.
    box(0.65, 0.25, 1.12, CELL.ROCK, { x: 1.03, y: 0.315, z: -0.36 })
    for (const z of [-0.65, -0.08]) {
      c.geom(new THREE.SphereGeometry(0.3, 8, 6), CELL.TRIM, {
        x: 1.03, y: 0.68, z
      })
    }

    // One rotating sprinkler head with a centered pivot.
    c.geom(new THREE.CylinderGeometry(0.17, 0.22, 0.12, 8), CELL.SLATE, {
      x: -0.72, y: 0.25, z: 0.86
    })
    c.geom(new THREE.CylinderGeometry(0.07, 0.09, 0.4, 8), CELL.GREY, {
      x: -0.72, y: 0.51, z: 0.86
    })
    const head = new THREE.BoxGeometry(0.58, 0.12, 0.14)
    head.translate(0.06, 0, 0)
    c.geom(head, CELL.WHITE, {
      x: -0.72, y: 0.77, z: 0.86, spin: 0.8 + rand() * 0.3
    })
    return 'Yard'
  },

  /**
   * Frances's landmark: the inside of an apartment, walls cut away on the near side so you
   * can see in. A bed with a turned-down blanket, a nightstand with a lit lamp, an armchair
   * facing a television, a rug, a kitchenette with a kettle, a window in the back wall, and
   * the room sensor on the wall with its little status light: the thing Frances watches.
   */
  apartment(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)
    const blanket = rand() > 0.5 ? CELL.TRIM : CELL.RED

    // Open dollhouse shell with a short left return.
    box(3.1, 0.14, 2.95, CELL.ROCK, { y: 0.07 })
    box(3.1, 1.7, 0.14, CELL.WHITE, { y: 0.99, z: -1.405 })
    box(0.14, 1.7, 1.62, CELL.WHITE, { x: -1.48, y: 0.99, z: -0.59 })
    box(3.1, 0.13, 0.2, CELL.TRIM, { y: 1.905, z: -1.39 })

    // Large bed with a distinct pillow and folded blanket.
    box(1.0, 0.3, 1.8, CELL.SLATE, { x: -0.86, y: 0.29, z: -0.25 })
    box(0.95, 0.18, 1.72, CELL.WHITE, { x: -0.86, y: 0.53, z: -0.25 })
    box(1.02, 0.74, 0.14, CELL.SLATE, { x: -0.86, y: 0.51, z: -1.19 })
    box(0.64, 0.15, 0.37, CELL.WHITE, { x: -0.86, y: 0.695, z: -0.84 })
    box(0.98, 0.1, 1.05, blanket, { x: -0.86, y: 0.67, z: 0.09 })
    box(0.98, 0.14, 0.19, blanket, { x: -0.86, y: 0.73, z: -0.38 })

    // Rear kitchenette with clear dark worktop.
    box(1.28, 0.69, 0.48, CELL.WHITE, { x: 0.76, y: 0.485, z: -1.03 })
    box(1.34, 0.12, 0.56, CELL.SLATE, { x: 0.76, y: 0.89, z: -1.01 })
    box(0.44, 0.06, 0.29, CELL.SOLAR_A, { x: 0.47, y: 0.98, z: -1.0 })
    c.geom(new THREE.CylinderGeometry(0.14, 0.18, 0.24, 8), CELL.GREY, {
      x: 1.08, y: 1.07, z: -1.0
    })
    box(0.9, 0.49, 0.09, CELL.SLATE, { x: 0.69, y: 1.45, z: -1.28 })
    box(0.7, 0.32, 0.06, CELL.SOLAR_A, { x: 0.69, y: 1.45, z: -1.2 })

    // Armchair and low table occupy the open living area.
    box(1.37, 0.07, 1.3, CELL.TRIM, { x: 0.65, y: 0.175, z: 0.63 })
    box(0.68, 0.32, 0.63, CELL.RED, { x: 0.95, y: 0.37, z: 0.84 })
    box(0.72, 0.54, 0.17, CELL.RED, { x: 0.95, y: 0.65, z: 1.09 })
    for (const x of [0.6, 1.3]) {
      box(0.14, 0.27, 0.64, CELL.RED, { x, y: 0.6, z: 0.83 })
    }
    c.geom(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 10), CELL.WHITE, {
      x: 0.32, y: 0.55, z: 0.2
    })
    c.geom(new THREE.CylinderGeometry(0.1, 0.18, 0.29, 8), CELL.GREY, {
      x: 0.32, y: 0.355, z: 0.2
    })

    // Wall lamp and room sensor remain visible above furniture.
    box(0.29, 0.32, 0.2, CELL.WHITE, {
      x: -0.89, y: 1.4, z: -1.19, emissive: 0.65
    })
    box(0.24, 0.24, 0.11, CELL.GREY, { x: -0.08, y: 1.59, z: -1.26 })
    box(0.1, 0.1, 0.06, CELL.RED, {
      x: -0.08, y: 1.59, z: -1.16, emissive: 0.7
    })
    return 'Apartment'
  },

  hq(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Broad wings and central entrance.
    box(3.0, 0.16, 2.5, CELL.SLATE, { y: 0.08 })
    box(2.8, 1.05, 1.65, CELL.WHITE, { y: 0.685, z: -0.25 })
    box(2.94, 0.16, 1.8, CELL.GREY, { y: 1.29, z: -0.25 })
    box(0.88, 1.48, 1.8, CELL.GREY, { y: 0.9, z: -0.15 })
    for (const x of [-0.94, 0.94]) {
      box(0.72, 0.49, 0.08, CELL.SOLAR_A, { x, y: 0.83, z: 0.62 })
      box(0.08, 0.49, 0.08, CELL.WHITE, { x, y: 0.83, z: 0.7 })
    }
    box(0.6, 0.92, 0.1, CELL.BLACK, { y: 0.62, z: 0.8 })
    box(0.42, 0.72, 0.07, CELL.SOLAR_A, { y: 0.62, z: 0.9 })
    box(1.1, 0.16, 0.6, CELL.TRIM, { y: 1.22, z: 0.82 })
    box(0.72, 0.08, 0.26, CELL.WHITE, {
      y: 1.1, z: 0.89, emissive: 0.7
    })
    box(1.12, 0.12, 0.5, CELL.GREY, { y: 0.22, z: 0.98 })

    // Blank rooftop sign frame.
    for (const x of [-0.67, 0.67]) {
      box(0.13, 0.64, 0.13, CELL.SLATE, { x, y: 1.69, z: -0.35 })
    }
    box(1.7, 0.57, 0.18, CELL.SLATE, { y: 2.08, z: -0.35 })
    box(1.48, 0.35, 0.07, CELL.TRIM, { y: 2.08, z: -0.22 })

    // Forecourt flagpole.
    c.geom(new THREE.CylinderGeometry(0.065, 0.09, 1.94, 8), CELL.GREY, {
      x: -1.32, y: 1.13, z: 0.83
    })
    box(0.49, 0.34, 0.07, rand() > 0.5 ? CELL.RED : CELL.TRIM, {
      x: -1.045, y: 1.86, z: 0.83
    })
    return 'Headquarters'
  },

  clubhouse(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Open pavilion with a shallow stage canopy.
    box(3.0, 0.14, 2.95, CELL.SLATE, { y: 0.07 })
    box(2.7, 0.24, 0.86, CELL.GREY, { y: 0.26, z: -0.9 })
    for (const x of [-1.28, 1.28]) {
      box(0.18, 1.94, 0.18, CELL.WHITE, { x, y: 1.11, z: -0.95 })
    }
    box(2.94, 0.19, 0.98, CELL.TRIM, { y: 2.14, z: -0.93 })
    box(2.0, 1.05, 0.14, CELL.SLATE, { y: 1.38, z: -1.19 })
    box(1.78, 0.83, 0.07, CELL.WHITE, {
      y: 1.38, z: -1.08, emissive: 0.55
    })

    // Off-center lectern preserves the screen.
    box(0.4, 0.6, 0.34, CELL.WHITE, { x: -0.86, y: 0.68, z: -0.62 })
    const top = new THREE.BoxGeometry(0.57, 0.12, 0.48)
    top.rotateX(0.16)
    c.geom(top, CELL.SLATE, { x: -0.86, y: 1.04, z: -0.59 })

    // Six simplified folding chairs.
    const seats = rand() > 0.5 ? CELL.TRIM : CELL.RED
    for (const z of [0.05, 0.88]) {
      for (const x of [-0.87, 0, 0.87]) {
        for (const s of [-1, 1]) {
          const leg = new THREE.BoxGeometry(0.1, 0.45, 0.45)
          leg.rotateZ(s * 0.18)
          c.geom(leg, CELL.GREY, { x: x + s * 0.18, y: 0.37, z })
        }
        box(0.57, 0.12, 0.48, seats, { x, y: 0.6, z })
        box(0.57, 0.39, 0.12, seats, { x, y: 0.82, z: z + 0.2 })
      }
    }
    return 'Clubhouse'
  },

  house(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // House and adjoining driveway.
    box(3.05, 0.12, 2.95, CELL.SLATE, { y: 0.06 })
    box(0.72, 0.07, 2.64, CELL.GREY, { x: 1.09, y: 0.155 })
    box(1.92, 1.13, 1.62, CELL.WHITE, { x: -0.35, y: 0.685, z: -0.4 })

    // Solid triangular gable beneath two roof slopes.
    const gable = new THREE.CylinderGeometry(1.109, 1.109, 1.62, 3)
    gable.rotateX(Math.PI / 2)
    gable.rotateZ(Math.PI)
    c.geom(gable, CELL.WHITE, { x: -0.35, y: 0.695, z: -0.4 })
    for (const s of [-1, 1]) {
      const roof = new THREE.BoxGeometry(1.2, 0.15, 1.92)
      roof.rotateZ(-s * 0.5)
      c.geom(roof, CELL.SLATE, { x: -0.35 + s * 0.5, y: 1.53, z: -0.4 })
    }
    box(0.34, 0.68, 0.38, CELL.ROCK, { x: 0.18, y: 1.72, z: -0.86 })
    box(0.43, 0.12, 0.47, CELL.GREY, { x: 0.18, y: 2.1, z: -0.86 })

    // Entrance, one lit window, and porch.
    box(0.44, 0.8, 0.09, CELL.TRIM, { x: -0.08, y: 0.52, z: 0.46 })
    box(0.52, 0.48, 0.1, CELL.SLATE, { x: -0.91, y: 0.83, z: 0.46 })
    box(0.37, 0.33, 0.07, CELL.WHITE, {
      x: -0.91, y: 0.83, z: 0.55, emissive: 0.6 + rand() * 0.15
    })
    box(0.07, 0.36, 0.07, CELL.GREY, { x: -0.91, y: 0.83, z: 0.62 })
    box(1.52, 0.26, 0.57, CELL.ROCK, { x: -0.35, y: 0.25, z: 0.71 })
    box(0.79, 0.19, 0.25, CELL.GREY, { x: -0.12, y: 0.215, z: 1.09 })
    box(0.9, 0.1, 0.25, CELL.GREY, { x: -0.12, y: 0.17, z: 1.34 })
    for (const x of [-1.0, 0.3]) {
      box(0.12, 0.9, 0.12, CELL.WHITE, { x, y: 0.83, z: 0.9 })
    }
    box(1.59, 0.13, 0.7, CELL.TRIM, { x: -0.35, y: 1.34, z: 0.73 })

    // Curbside mailbox.
    box(0.1, 0.58, 0.1, CELL.GREY, { x: 1.1, y: 0.48, z: 1.03 })
    box(0.39, 0.26, 0.48, CELL.WHITE, { x: 1.1, y: 0.87, z: 1.03 })
    box(0.27, 0.13, 0.06, CELL.SLATE, { x: 1.1, y: 0.87, z: 1.3 })
    return 'Home'
  },

  tradingfloor(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Elevated ticker with a blank luminous strip.
    box(3.0, 0.14, 2.85, CELL.SLATE, { y: 0.07 })
    for (const x of [-1.24, 1.24]) {
      box(0.16, 2.03, 0.18, CELL.GREY, { x, y: 1.155, z: -1.07 })
    }
    box(2.91, 0.59, 0.26, CELL.SLATE, { y: 2.08, z: -1.07 })
    box(2.63, 0.31, 0.07, CELL.TRIM, {
      y: 2.08, z: -0.9, emissive: 0.6
    })

    // Paired trading desks and oversized monitors.
    for (const x of [-0.76, 0.76]) {
      box(0.58, 0.69, 0.6, CELL.GREY, { x, y: 0.485, z: -0.22 })
      box(1.13, 0.14, 0.87, CELL.WHITE, { x, y: 0.9, z: -0.22 })
      box(0.12, 0.23, 0.13, CELL.GREY, { x, y: 1.085, z: -0.43 })
      box(0.95, 0.57, 0.13, CELL.BLACK, { x, y: 1.43, z: -0.43 })
      box(0.78, 0.4, 0.06, CELL.WHITE, {
        x, y: 1.43, z: -0.33, emissive: 0.45
      })
      box(0.53, 0.07, 0.2, CELL.SLATE, { x, y: 1.005, z: 0.04 })
    }

    // Front cash pot with chunky coin stacks.
    c.geom(new THREE.CylinderGeometry(0.42, 0.52, 0.56, 8), CELL.GREY, {
      y: 0.42, z: 0.91
    })
    c.geom(new THREE.CylinderGeometry(0.51, 0.33, 0.31, 10), CELL.TRIM, {
      y: 0.855, z: 0.91
    })
    c.geom(new THREE.CylinderGeometry(0.41, 0.41, 0.06, 10), CELL.BLACK, {
      y: 1.015, z: 0.91
    })
    for (const x of [-0.2, 0.17]) {
      const h = 0.13 + rand() * 0.12
      c.geom(new THREE.CylinderGeometry(0.17, 0.17, h, 10), CELL.WHITE, {
        x, y: 1.04 + h / 2, z: 0.91
      })
    }
    return 'Trade Floor'
  },

  shield(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Low hexagonal armored bunker.
    const hex = (r, h, cell, y) => {
      const g = new THREE.CylinderGeometry(r, r, h, 6)
      g.rotateY(Math.PI / 6)
      c.geom(g, cell, { y })
    }
    hex(1.48, 0.18, CELL.SLATE, 0.09)
    hex(1.32, 1.18, CELL.GREY, 0.77)
    hex(1.43, 0.2, CELL.SLATE, 1.46)
    box(0.69, 1.04, 0.17, CELL.SLATE, { x: -0.35, y: 0.7, z: 1.16 })
    box(0.49, 0.82, 0.12, CELL.GREY, { x: -0.35, y: 0.7, z: 1.3 })
    for (const y of [0.43, 0.94]) {
      box(0.57, 0.12, 0.1, CELL.WHITE, { x: -0.35, y, z: 1.41 })
    }

    // Oversized pentagonal shield and center stripe.
    const badge = new THREE.CylinderGeometry(0.37, 0.37, 0.12, 5)
    badge.rotateX(Math.PI / 2)
    c.geom(badge, CELL.TRIM, { x: 0.56, y: 0.92, z: 1.18 })
    box(0.1, 0.4, 0.08, CELL.WHITE, { x: 0.56, y: 0.94, z: 1.29 })
    box(0.3, 0.1, 0.08, CELL.WHITE, { x: 0.56, y: 1.03, z: 1.29 })

    // Single rotating radar bar.
    c.geom(new THREE.CylinderGeometry(0.13, 0.21, 0.55, 8), CELL.WHITE, {
      y: 1.835, z: -0.25
    })
    c.geom(new THREE.BoxGeometry(1.07, 0.29, 0.19), CELL.TRIM, {
      y: 2.18, z: -0.25, spin: 0.2 + rand() * 0.08
    })
    box(0.25, 0.1, 0.09, CELL.RED, {
      x: -0.35, y: 1.3, z: 1.32, emissive: 0.65
    })
    return 'CyberGrade'
  },

  launchpad(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Split pad and recessed blast trench.
    box(3.0, 0.12, 2.9, CELL.SLATE, { y: 0.06 })
    for (const x of [-0.97, 0.97]) {
      box(0.96, 0.18, 2.63, CELL.GREY, { x, y: 0.21 })
    }
    box(0.76, 0.07, 2.6, CELL.BLACK, { y: 0.155 })
    box(1.43, 0.19, 0.89, CELL.SLATE, { y: 0.34, z: -0.28 })

    // Compact rocket with a red nose and broad fins.
    c.geom(new THREE.CylinderGeometry(0.32, 0.36, 1.23, 12), CELL.WHITE, {
      y: 1.26, z: -0.28
    })
    c.geom(new THREE.ConeGeometry(0.33, 0.57, 12), CELL.RED, {
      y: 2.16, z: -0.28
    })
    c.geom(new THREE.CylinderGeometry(0.26, 0.38, 0.22, 10), CELL.SLATE, {
      y: 0.54, z: -0.28
    })
    c.geom(new THREE.CylinderGeometry(0.34, 0.34, 0.18, 12), CELL.TRIM, {
      y: 1.55, z: -0.28
    })
    for (const s of [-1, 1]) {
      const fin = new THREE.BoxGeometry(0.18, 0.6, 0.39)
      fin.rotateZ(-s * 0.34)
      c.geom(fin, CELL.RED, { x: s * 0.37, y: 0.8, z: -0.28 })
    }

    // Tall open gantry with diagonal bracing.
    for (const x of [-1.32, -0.86]) {
      box(0.14, 2.16, 0.16, CELL.GREY, { x, y: 1.38, z: -0.84 })
    }
    for (const y of [0.62, 1.25, 1.9, 2.42]) {
      box(0.62, 0.12, 0.22, CELL.GREY, { x: -1.09, y, z: -0.84 })
    }
    for (const y of [0.94, 1.57]) {
      const brace = new THREE.BoxGeometry(0.1, 0.77, 0.12)
      brace.rotateZ(-0.62)
      c.geom(brace, CELL.GREY, { x: -1.09, y, z: -0.84 })
    }
    box(1.0, 0.14, 0.35, CELL.GREY, { x: -0.68, y: 1.92, z: -0.56 })

    // Twin fuel tanks.
    for (const z of [-0.67, 0.46]) {
      const h = 0.65 + rand() * 0.12
      c.geom(new THREE.CylinderGeometry(0.27, 0.27, h, 10), CELL.WHITE, {
        x: 1.05, y: 0.3 + h / 2, z
      })
      c.geom(new THREE.CylinderGeometry(0.29, 0.29, 0.1, 10), CELL.RED, {
        x: 1.05, y: 0.51, z
      })
    }
    return 'Launchpad'
  },

  recruitdesk(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Rear recruitment board and low reception desk.
    box(3.0, 0.12, 2.85, CELL.SLATE, { y: 0.06 })
    box(2.74, 1.6, 0.15, CELL.WHITE, { y: 0.92, z: -1.18 })
    box(1.48, 0.78, 0.12, CELL.ROCK, { x: -0.43, y: 1.2, z: -1.05 })
    for (const x of [-0.9, -0.42, 0.06]) {
      box(0.3, 0.36, 0.07, CELL.WHITE, { x, y: 1.19, z: -0.94 })
      box(0.08, 0.08, 0.06, CELL.RED, { x, y: 1.31, z: -0.86 })
    }
    box(1.7, 0.72, 0.57, CELL.GREY, { x: -0.37, y: 0.48, z: -0.6 })
    box(1.84, 0.14, 0.7, CELL.WHITE, { x: -0.37, y: 0.91, z: -0.6 })
    box(0.58, 0.22, 0.12, CELL.TRIM, { x: -0.37, y: 1.09, z: -0.34 })

    // Opposing interview chairs across a small table.
    for (const s of [-1, 1]) {
      box(0.48, 0.33, 0.57, CELL.GREY, { x: s * 0.8, y: 0.285, z: 0.64 })
      box(0.64, 0.14, 0.64, CELL.TRIM, { x: s * 0.8, y: 0.52, z: 0.64 })
      box(0.14, 0.57, 0.65, CELL.TRIM, {
        x: s * 1.08, y: 0.78, z: 0.64
      })
    }
    c.geom(new THREE.CylinderGeometry(0.35, 0.35, 0.12, 10), CELL.WHITE, {
      y: 0.7, z: 0.64
    })
    box(0.18, 0.46, 0.18, CELL.GREY, { y: 0.35, z: 0.64 })

    // Tall corner plant.
    c.geom(new THREE.CylinderGeometry(0.26, 0.2, 0.37, 8), CELL.ROCK, {
      x: 1.02, y: 0.305, z: -0.8
    })
    c.geom(new THREE.CylinderGeometry(0.07, 0.09, 0.55, 6), CELL.ROCK, {
      x: 1.02, y: 0.72, z: -0.8
    })
    c.geom(new THREE.SphereGeometry(0.33 + rand() * 0.05, 8, 6), CELL.TRIM, {
      x: 1.02, y: 1.08, z: -0.8
    })
    return 'Recruitment'
  },

  grill(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Large grill body with a glowing coal bed.
    box(3.0, 0.12, 2.55, CELL.SLATE, { y: 0.06 })
    box(1.36, 0.62, 0.93, CELL.GREY, { x: -0.63, y: 0.52, z: 0.06 })
    box(1.48, 0.2, 1.03, CELL.SLATE, { x: -0.63, y: 0.93, z: 0.06 })
    box(1.2, 0.08, 0.75, CELL.RED, {
      x: -0.63, y: 1.07, z: 0.06, emissive: 0.65 + rand() * 0.2
    })
    for (const x of [-1.1, -0.87, -0.64, -0.41, -0.18]) {
      box(0.09, 0.07, 0.81, CELL.BLACK, { x, y: 1.14, z: 0.06 })
    }
    box(1.48, 0.72, 0.14, CELL.SLATE, { x: -0.63, y: 1.4, z: -0.47 })
    box(0.58, 0.1, 0.14, CELL.GREY, { x: -0.63, y: 1.62, z: -0.32 })
    for (const x of [-0.99, -0.31]) {
      box(0.17, 0.17, 0.09, CELL.RED, { x, y: 0.83, z: 0.61 })
    }

    // Prep counter and large plate stack.
    box(0.87, 0.82, 0.88, CELL.WHITE, { x: 0.94, y: 0.53, z: 0.04 })
    box(1.02, 0.14, 1.01, CELL.ROCK, { x: 0.94, y: 1.01, z: 0.04 })
    for (const y of [1.13, 1.2, 1.27]) {
      c.geom(new THREE.CylinderGeometry(0.27, 0.27, 0.06, 12), CELL.WHITE, {
        x: 0.97, y, z: 0.12
      })
    }

    // Rear pot rack with two unmistakable pans.
    for (const x of [-1.24, 1.24]) {
      box(0.13, 1.94, 0.13, CELL.GREY, { x, y: 1.09, z: -0.95 })
    }
    box(2.64, 0.16, 0.16, CELL.GREY, { y: 2.13, z: -0.95 })
    for (const x of [-0.43, 0.51]) {
      box(0.09, 0.39, 0.1, CELL.SLATE, { x, y: 1.86, z: -0.91 })
      const pan = new THREE.CylinderGeometry(0.26, 0.26, 0.12, 10)
      pan.rotateX(Math.PI / 2)
      c.geom(pan, CELL.GREY, { x, y: 1.44, z: -0.91 })
    }
    return 'Grill'
  },

  vault(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)
    const disc = (r, d, cell, o) => {
      const g = new THREE.CylinderGeometry(r, r, d, 16)
      g.rotateX(Math.PI / 2)
      c.geom(g, cell, o)
    }

    // Heavy vault block and layered round door.
    box(3.0, 0.15, 2.35, CELL.SLATE, { y: 0.075 })
    box(1.83, 1.89, 1.53, CELL.GREY, { x: -0.48, y: 1.095, z: -0.2 })
    box(1.99, 0.16, 1.68, CELL.WHITE, { x: -0.48, y: 2.12, z: -0.2 })
    disc(0.79, 0.19, CELL.SLATE, { x: -0.48, y: 1.12, z: 0.63 })
    disc(0.65, 0.16, CELL.WHITE, { x: -0.48, y: 1.12, z: 0.8 })
    c.geom(new THREE.TorusGeometry(0.3, 0.065, 6, 14), CELL.SLATE, {
      x: -0.48, y: 1.12, z: 0.93
    })
    box(0.62, 0.09, 0.1, CELL.GREY, { x: -0.48, y: 1.12, z: 0.94 })
    box(0.09, 0.62, 0.1, CELL.GREY, { x: -0.48, y: 1.12, z: 0.94 })
    for (const y of [0.61, 1.63]) {
      box(0.2, 0.24, 0.22, CELL.SLATE, { x: -1.14, y, z: 0.77 })
    }

    // Adjacent tape library with six large cartridges.
    box(0.65, 1.4, 0.62, CELL.SLATE, { x: 1.0, y: 0.85, z: -0.5 })
    for (const y of [0.43, 0.85, 1.27]) {
      box(0.7, 0.09, 0.69, CELL.GREY, { x: 1.0, y: y - 0.16, z: -0.5 })
      for (const x of [0.84, 1.16]) {
        box(0.24, 0.26, 0.25, CELL.WHITE, { x, y, z: -0.23 })
        box(0.12, 0.09, 0.06, CELL.TRIM, { x, y, z: -0.075 })
      }
    }

    // Small front server with a steady status point.
    box(0.61, 0.65, 0.49, CELL.GREY, { x: 1.0, y: 0.475, z: 0.55 })
    box(0.37, 0.23, 0.06, CELL.BLACK, { x: 1.0, y: 0.55, z: 0.83 })
    box(0.12, 0.1, 0.06, CELL.RED, {
      x: 1.15, y: 0.31, z: 0.83, emissive: 0.6 + rand() * 0.2
    })
    return 'Vault'
  },

  controltower(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Slim shaft supporting an oversized glazed cab.
    c.geom(new THREE.CylinderGeometry(0.63, 0.86, 0.19, 8), CELL.SLATE, { y: 0.095 })
    box(0.62, 1.42, 0.67, CELL.WHITE, { y: 0.9 })
    box(0.32, 0.67, 0.08, CELL.SLATE, { y: 0.525, z: 0.38 })
    c.geom(new THREE.CylinderGeometry(1.02, 0.76, 0.21, 8), CELL.GREY, { y: 1.715 })
    c.geom(new THREE.CylinderGeometry(1.0, 0.9, 0.52, 8), CELL.SOLAR_A, { y: 2.08 })
    for (const x of [-0.61, 0.61]) {
      box(0.1, 0.54, 0.12, CELL.WHITE, { x, y: 2.08, z: 0.69 })
    }
    box(0.1, 0.54, 0.12, CELL.WHITE, { y: 2.08, z: 0.92 })
    c.geom(new THREE.CylinderGeometry(1.08, 1.08, 0.14, 8), CELL.TRIM, { y: 2.41 })

    // Roof radar and offset antenna.
    c.geom(new THREE.CylinderGeometry(0.09, 0.12, 0.2, 8), CELL.GREY, {
      y: 2.58, z: -0.1
    })
    c.geom(new THREE.BoxGeometry(0.9, 0.17, 0.15), CELL.WHITE, {
      y: 2.765, z: -0.1, spin: 0.2 + rand() * 0.05
    })
    box(0.07, 0.49, 0.07, CELL.GREY, { x: 0.68, y: 2.725, z: -0.23 })
    c.geom(new THREE.SphereGeometry(0.085, 8, 6), CELL.RED, {
      x: 0.68, y: 2.995, z: -0.23, emissive: 0.65
    })
    return 'Control Tower'
  },

  garage(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Open garage shell and raised door.
    box(3.06, 0.12, 2.94, CELL.SLATE, { y: 0.06 })
    box(2.88, 1.94, 0.14, CELL.GREY, { y: 1.09, z: -1.32 })
    for (const x of [-1.37, 1.37]) {
      box(0.15, 1.94, 0.66, CELL.WHITE, { x, y: 1.09, z: -1.06 })
      box(0.15, 1.94, 0.15, CELL.WHITE, { x, y: 1.09, z: 1.02 })
    }
    box(2.9, 0.18, 0.35, CELL.TRIM, { y: 2.12, z: 1.0 })
    box(2.7, 0.13, 0.94, CELL.GREY, { y: 2.11, z: 0.33 })

    // Two-post lift with arms under the truck.
    for (const x of [-0.88, 0.88]) {
      box(0.2, 1.67, 0.26, CELL.RED, { x, y: 0.955, z: -0.12 })
      box(0.6, 0.12, 0.17, CELL.GREY, { x: x * 0.68, y: 0.46, z: -0.12 })
    }

    // Boxy SUV facing into the garage, spare toward +z.
    box(1.08, 0.25, 1.94, CELL.SLATE, { y: 0.58, z: -0.04 })
    box(1.15, 0.4, 1.87, CELL.TRIM, { y: 0.86, z: -0.04 })
    box(1.03, 0.49, 1.06, CELL.SOLAR_A, { y: 1.305, z: 0.29 })
    box(1.15, 0.13, 1.2, CELL.TRIM, { y: 1.615, z: 0.29 })
    for (const x of [-0.5, 0.5]) {
      for (const z of [-0.21, 0.79]) {
        box(0.1, 0.53, 0.1, CELL.TRIM, { x, y: 1.305, z })
      }
    }
    for (const x of [-0.57, 0.57]) {
      for (const z of [-0.64, 0.58]) {
        const wheel = new THREE.CylinderGeometry(0.25, 0.25, 0.16, 12)
        wheel.rotateZ(Math.PI / 2)
        c.geom(wheel, CELL.BLACK, { x, y: 0.57, z })
      }
    }
    const spare = new THREE.CylinderGeometry(0.29, 0.29, 0.17, 12)
    spare.rotateX(Math.PI / 2)
    c.geom(spare, CELL.BLACK, { y: 1.01, z: 1.01 })
    box(1.21, 0.12, 0.15, CELL.GREY, { y: 0.66, z: 1.02 })
    for (const x of [-0.44, 0.44]) {
      box(0.15, 0.17, 0.07, CELL.RED, { x, y: 0.89, z: 0.94 })
    }

    // Side toolbox and oil drum.
    box(0.43, 0.58, 0.54, CELL.RED, { x: -1.13, y: 0.41, z: 0.57 })
    for (const y of [0.3, 0.5]) {
      box(0.25, 0.07, 0.07, CELL.GREY, { x: -1.13, y, z: 0.88 })
    }
    c.geom(new THREE.CylinderGeometry(0.23, 0.23, 0.6, 10),
      rand() > 0.5 ? CELL.GREY : CELL.SLATE, {
        x: 1.15, y: 0.42, z: -0.78
      })
    return 'Garage'
  },

  signpost(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Broad blank sign and substantial feet.
    for (const x of [-0.99, 0.99]) {
      box(0.43, 0.12, 0.57, CELL.SLATE, { x, y: 0.06 })
      box(0.17, 1.14, 0.2, CELL.GREY, { x, y: 0.69 })
    }
    box(2.88, 0.88, 0.23, CELL.SLATE, { y: 1.12 })
    box(2.63, 0.65, 0.08, CELL.TRIM, { y: 1.12, z: 0.16 })

    // Lamp over the blank front face.
    box(0.12, 0.34, 0.13, CELL.GREY, { y: 1.65, z: -0.1 })
    box(0.12, 0.12, 0.43, CELL.GREY, { y: 1.81, z: 0.06 })
    box(0.62, 0.16, 0.31, CELL.SLATE, { y: 1.77, z: 0.27 })
    box(0.43, 0.07, 0.22, CELL.WHITE, {
      y: 1.655, z: 0.27, emissive: 0.65 + rand() * 0.15
    })
    return 'Sign'
  },

  tvwall(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Shared slim support rack.
    for (const x of [-1.15, 1.15]) {
      box(0.48, 0.13, 0.78, CELL.SLATE, { x, y: 0.065 })
      box(0.14, 1.75, 0.15, CELL.GREY, { x, y: 1.0, z: -0.13 })
    }
    box(2.87, 0.14, 0.17, CELL.GREY, { y: 1.35, z: -0.13 })
    box(2.89, 0.12, 0.54, CELL.SLATE, { y: 0.74 })

    // Three screens and three separate controller boxes.
    const brightness = 0.5 + rand() * 0.12
    for (const x of [-0.98, 0, 0.98]) {
      box(0.92, 0.8, 0.16, CELL.BLACK, { x, y: 1.45 })
      box(0.76, 0.63, 0.06, CELL.WHITE, {
        x, y: 1.45, z: 0.12, emissive: brightness
      })
      box(0.36, 0.15, 0.31, CELL.WHITE, { x, y: 0.875 })
      box(0.07, 0.07, 0.05, CELL.RED, { x: x + 0.1, y: 0.88, z: 0.18 })
    }
    return 'TV Wall'
  },

  keyrack(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Cabinet mounted on a freestanding wall slab.
    box(2.86, 0.14, 1.5, CELL.SLATE, { y: 0.07 })
    box(1.78, 1.94, 0.2, CELL.GREY, { x: -0.35, y: 1.11, z: -0.3 })
    box(1.5, 1.45, 0.18, CELL.SLATE, { x: -0.35, y: 1.23, z: -0.11 })
    for (const x of [-1.1, 0.4]) {
      box(0.12, 1.58, 0.32, CELL.WHITE, { x, y: 1.23 })
    }
    for (const y of [0.44, 2.02]) {
      box(1.62, 0.12, 0.32, CELL.WHITE, { x: -0.35, y })
    }

    // Door swung toward the right.
    const door = new THREE.BoxGeometry(1.49, 1.5, 0.13)
    door.rotateY(-1.0)
    c.geom(door, CELL.WHITE, { x: 0.86, y: 1.23, z: 0.67 })
    const handle = new THREE.BoxGeometry(0.1, 0.32, 0.12)
    handle.rotateY(-1.0)
    c.geom(handle, CELL.SLATE, { x: 1.15, y: 1.2, z: 1.14 })

    // Six hooks; the upper middle hook stays empty.
    const tagY = 0.01 + rand() * 0.025
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const x = -0.85 + col * 0.5
        const y = 1.65 - row * 0.63
        box(0.1, 0.1, 0.23, CELL.GREY, { x, y, z: 0.12 })
        box(0.1, 0.16, 0.08, CELL.GREY, { x, y: y + 0.03, z: 0.27 })
        if (row === 0 && col === 1) continue
        c.geom(new THREE.TorusGeometry(0.105, 0.035, 6, 10), CELL.GREY, {
          x, y: y - 0.09, z: 0.29
        })
        box(0.23, 0.27, 0.08, CELL.TRIM, {
          x, y: y - 0.33 - tagY, z: 0.29
        })
      }
    }
    return 'Key Cabinet'
  },

  meter(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Pedestal and large circular instrument housing.
    c.geom(new THREE.CylinderGeometry(0.65, 0.82, 0.18, 10), CELL.SLATE, { y: 0.09 })
    box(0.78, 0.99, 0.66, CELL.GREY, { y: 0.675 })
    const body = new THREE.CylinderGeometry(0.79, 0.79, 0.36, 20)
    body.rotateX(Math.PI / 2)
    c.geom(body, CELL.SLATE, { y: 1.84 })
    const face = new THREE.CylinderGeometry(0.66, 0.66, 0.07, 20)
    face.rotateX(Math.PI / 2)
    c.geom(face, CELL.WHITE, { y: 1.84, z: 0.235 })
    c.geom(new THREE.TorusGeometry(0.73, 0.07, 6, 20), CELL.TRIM, {
      y: 1.84, z: 0.24
    })

    // Bold dial marks and one drifting needle.
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * 0.75 + i * Math.PI / 4
      const tick = new THREE.BoxGeometry(0.075, 0.16, 0.06)
      tick.rotateZ(-a)
      c.geom(tick, CELL.SLATE, {
        x: Math.sin(a) * 0.5, y: 1.84 + Math.cos(a) * 0.5, z: 0.31
      })
    }
    const needle = new THREE.BoxGeometry(0.09, 0.55, 0.07)
    needle.translate(0, 0.21, 0)
    needle.rotateZ((rand() - 0.5) * 1.6)
    c.geom(needle, CELL.RED, { y: 1.84, z: 0.4, spin: 0.15 })
    c.geom(new THREE.SphereGeometry(0.12, 8, 6), CELL.SLATE, {
      y: 1.84, z: 0.42
    })

    // Coin slot and illuminated blank readout.
    box(0.37, 0.1, 0.08, CELL.BLACK, { y: 0.94, z: 0.37 })
    box(0.59, 0.29, 0.14, CELL.SLATE, { y: 0.52, z: 0.38 })
    box(0.43, 0.16, 0.06, CELL.WHITE, {
      y: 0.52, z: 0.49, emissive: 0.6
    })
    return 'Spend Meter'
  },

  countdown(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Stout post with three blank flip-board faces.
    box(1.48, 0.18, 1.0, CELL.SLATE, { y: 0.09 })
    box(0.24, 2.08, 0.25, CELL.GREY, { y: 1.22, z: -0.18 })
    for (const y of [0.73, 1.36, 1.99]) {
      box(1.39, 0.57, 0.22, CELL.SLATE, { y })
      box(1.16, 0.41, 0.07, CELL.WHITE, { y, z: 0.15 })
      for (const x of [-0.65, 0.65]) {
        box(0.08, 0.13, 0.12, CELL.GREY, { x, y, z: 0.13 })
      }
    }

    // Broad overhead lamp.
    box(0.15, 0.24, 0.16, CELL.GREY, { y: 2.38, z: -0.13 })
    box(1.52, 0.17, 0.48, CELL.TRIM, { y: 2.55, z: 0.06 })
    box(1.17, 0.07, 0.27, CELL.WHITE, {
      y: 2.43, z: 0.13, emissive: 0.6 + rand() * 0.15
    })
    return 'Countdown'
  },

  mailbox(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Shared postal stand.
    for (const x of [-0.98, 0.98]) {
      box(0.45, 0.14, 0.71, CELL.SLATE, { x, y: 0.07 })
      box(0.15, 0.79, 0.17, CELL.GREY, { x, y: 0.535 })
    }
    box(2.9, 0.16, 1.06, CELL.GREY, { y: 1.01 })

    // Three rounded-top mailboxes.
    for (const x of [-0.98, 0, 0.98]) {
      box(0.77, 0.5, 0.89, CELL.WHITE, { x, y: 1.34 })
      const roof = new THREE.CylinderGeometry(0.385, 0.385, 0.89, 12)
      roof.rotateX(Math.PI / 2)
      c.geom(roof, CELL.WHITE, { x, y: 1.57 })
      box(0.59, 0.48, 0.08, CELL.TRIM, { x, y: 1.39, z: 0.49 })
      box(0.38, 0.08, 0.07, CELL.BLACK, { x, y: 1.5, z: 0.57 })
      box(0.22, 0.07, 0.09, CELL.GREY, { x, y: 1.22, z: 0.59 })
    }

    // One conspicuously raised postal flag.
    const flagX = rand() > 0.5 ? -0.55 : 0.43
    box(0.08, 0.56, 0.09, CELL.RED, { x: flagX, y: 1.73, z: 0.11 })
    box(0.09, 0.22, 0.3, CELL.RED, { x: flagX, y: 1.98, z: 0.22 })
    return 'Mailboxes'
  },

  outpost(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Small dome on an isolated low platform.
    box(3.0, 0.12, 2.8, CELL.SLATE, { y: 0.06 })
    c.geom(new THREE.CylinderGeometry(0.62, 0.69, 0.5, 12), CELL.WHITE, {
      x: -0.62, y: 0.37, z: 0.31
    })
    c.geom(new THREE.SphereGeometry(0.62, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      CELL.WHITE, { x: -0.62, y: 0.62, z: 0.31 })
    box(0.46, 0.58, 0.2, CELL.SLATE, { x: -0.62, y: 0.43, z: 0.94 })
    box(0.27, 0.39, 0.08, CELL.SOLAR_A, { x: -0.62, y: 0.43, z: 1.09 })

    // Tall lattice mast.
    for (const x of [0.61, 1.09]) {
      box(0.11, 2.15, 0.13, CELL.GREY, { x, y: 1.195, z: -0.77 })
    }
    for (const y of [0.48, 1.08, 1.68, 2.24]) {
      box(0.61, 0.1, 0.16, CELL.GREY, { x: 0.85, y, z: -0.77 })
    }
    for (let i = 0; i < 3; i++) {
      const brace = new THREE.BoxGeometry(0.09, 0.76, 0.1)
      brace.rotateZ(i % 2 ? 0.66 : -0.66)
      c.geom(brace, CELL.GREY, { x: 0.85, y: 0.78 + i * 0.59, z: -0.77 })
    }
    box(0.84, 0.18, 0.22, CELL.TRIM, { x: 0.85, y: 2.36, z: -0.77 })

    // Forward-tilted solar panel and fuel drum.
    box(0.15, 0.59, 0.15, CELL.GREY, { x: 0.75, y: 0.415, z: 0.59 })
    const frame = new THREE.BoxGeometry(1.1, 0.12, 0.86)
    frame.rotateX(0.48)
    c.geom(frame, CELL.GREY, { x: 0.75, y: 0.78, z: 0.59 })
    const panel = new THREE.BoxGeometry(0.94, 0.06, 0.7)
    panel.translate(0, 0.095, 0)
    panel.rotateX(0.48)
    c.geom(panel, CELL.SOLAR_A, { x: 0.75, y: 0.78, z: 0.59 })
    c.geom(new THREE.CylinderGeometry(0.25, 0.25, 0.57, 10), CELL.GREY, {
      x: -0.95, y: 0.405, z: -0.81
    })
    c.geom(new THREE.SphereGeometry(0.09, 8, 6), CELL.RED, {
      x: 0.85, y: 2.54, z: -0.77, emissive: 0.6 + rand() * 0.2
    })
    return 'Outpost'
  },

  tower(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Four legs with broad diagonal braces.
    box(1.95, 0.16, 1.95, CELL.SLATE, { y: 0.08 })
    for (const x of [-0.61, 0.61]) {
      for (const z of [-0.61, 0.61]) {
        box(0.18, 1.91, 0.18, CELL.GREY, { x, y: 1.115, z })
      }
    }
    for (const z of [-0.61, 0.61]) {
      for (const s of [-1, 1]) {
        const brace = new THREE.BoxGeometry(0.12, 1.78, 0.13)
        brace.rotateZ(s * 0.72)
        c.geom(brace, CELL.GREY, { y: 1.09, z })
      }
    }
    box(1.46, 0.16, 1.46, CELL.GREY, { y: 1.05 })
    box(1.89, 0.19, 1.89, CELL.WHITE, { y: 2.12 })

    // Lookout platform with an open front.
    for (const x of [-0.8, 0.8]) {
      box(0.12, 0.44, 0.12, CELL.WHITE, { x, y: 2.435, z: -0.77 })
      box(0.1, 0.11, 1.62, CELL.TRIM, { x, y: 2.58 })
    }
    box(1.7, 0.11, 0.1, CELL.TRIM, { y: 2.58, z: -0.77 })

    // Twin substantial beacon heads.
    for (const x of [-0.51, 0.51]) {
      box(0.1, 0.32, 0.12, CELL.GREY, { x, y: 2.375, z: 0.26 })
      box(0.49, 0.3, 0.29, CELL.SLATE, { x, y: 2.65, z: 0.26 })
      box(0.33, 0.17, 0.07, CELL.WHITE, {
        x, y: 2.65, z: 0.44, emissive: 0.6 + rand() * 0.15
      })
    }
    return 'Tower'
  },

  workshop(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Open fabrication shed with a rear roof strip.
    box(3.0, 0.14, 2.8, CELL.SLATE, { y: 0.07 })
    box(2.8, 1.84, 0.15, CELL.GREY, { y: 1.06, z: -1.19 })
    for (const x of [-1.31, 1.31]) {
      box(0.17, 1.93, 0.18, CELL.WHITE, { x, y: 1.105, z: 0.76 })
      box(0.17, 0.16, 2.04, CELL.WHITE, { x, y: 2.11, z: -0.21 })
    }
    box(2.95, 0.17, 0.7, CELL.TRIM, { y: 2.12, z: -0.96 })

    // Rear workbench and bold hanging tools.
    for (const x of [-0.86, 0.86]) {
      box(0.42, 0.72, 0.62, CELL.SLATE, { x, y: 0.5, z: -0.65 })
    }
    box(2.39, 0.16, 0.84, CELL.ROCK, { y: 0.94, z: -0.65 })
    box(1.73, 0.57, 0.1, CELL.SLATE, { y: 1.49, z: -1.06 })
    for (const x of [-0.61, 0, 0.61]) {
      box(0.12, 0.31, 0.11, CELL.GREY, { x, y: 1.46, z: -0.94 })
      box(0.32, 0.13, 0.13, CELL.RED, { x, y: 1.65, z: -0.93 })
    }

    // Overhead hoist and suspended hook.
    box(2.82, 0.2, 0.23, CELL.GREY, { y: 2.11, z: 0.32 })
    const hx = (rand() - 0.5) * 0.65
    box(0.48, 0.29, 0.4, CELL.RED, { x: hx, y: 1.97, z: 0.32 })
    box(0.075, 0.6, 0.075, CELL.BLACK, { x: hx, y: 1.525, z: 0.32 })
    c.geom(new THREE.TorusGeometry(0.15, 0.06, 6, 12, Math.PI * 1.6), CELL.GREY, {
      x: hx, y: 1.11, z: 0.32
    })

    // Large workpiece on a low assembly pallet.
    box(1.09, 0.14, 0.83, CELL.ROCK, { y: 0.21, z: 0.65 })
    box(0.76, 0.37, 0.62, CELL.WHITE, { y: 0.465, z: 0.65 })
    box(0.46, 0.13, 0.4, CELL.TRIM, { y: 0.715, z: 0.65 })
    return 'Workshop'
  },

  pad(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Octagonal landing platform with clear landing marks.
    c.geom(new THREE.CylinderGeometry(1.46, 1.53, 0.18, 8), CELL.SLATE, { y: 0.09 })
    c.geom(new THREE.CylinderGeometry(1.33, 1.33, 0.08, 8), CELL.GREY, { y: 0.22 })
    for (const x of [-1.05, 1.05]) {
      box(0.12, 0.055, 0.69, CELL.WHITE, { x, y: 0.287 })
    }

    // Compact lander with a broad cockpit.
    c.geom(new THREE.CylinderGeometry(0.58, 0.75, 0.43, 8), CELL.WHITE, { y: 1.0 })
    c.geom(new THREE.CylinderGeometry(0.36, 0.57, 0.4, 8), CELL.SOLAR_A, { y: 1.415 })
    c.geom(new THREE.CylinderGeometry(0.39, 0.39, 0.13, 8), CELL.TRIM, { y: 1.68 })
    c.geom(new THREE.CylinderGeometry(0.2, 0.34, 0.27, 10), CELL.SLATE, { y: 0.65 })
    box(0.14, 0.41, 0.1, CELL.WHITE, { y: 1.42, z: 0.47 })

    // Four substantial landing struts and feet.
    for (const x of [-0.74, 0.74]) {
      for (const z of [-0.69, 0.69]) {
        box(0.15, 0.48, 0.16, CELL.GREY, { x, y: 0.6, z })
        box(0.45, 0.13, 0.43, CELL.SLATE, { x, y: 0.325, z })
        box(0.39, 0.13, 0.17, CELL.GREY, { x: x * 0.81, y: 0.79, z })
      }
    }
    for (const x of [-1.02, 1.02]) {
      c.geom(new THREE.SphereGeometry(0.1, 8, 6), CELL.RED, {
        x, y: 0.37, z: 0.88, emissive: 0.6 + rand() * 0.1
      })
    }
    return 'Landing Pad'
  },

  lab(c, rand) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Open laboratory shell.
    box(3.0, 0.14, 2.76, CELL.SLATE, { y: 0.07 })
    box(2.8, 1.75, 0.16, CELL.WHITE, { y: 1.015, z: -1.16 })
    box(0.16, 1.75, 1.1, CELL.WHITE, { x: -1.32, y: 1.015, z: -0.69 })
    box(2.96, 0.18, 0.69, CELL.TRIM, { y: 1.98, z: -0.95 })
    box(1.13, 0.72, 0.09, CELL.SOLAR_A, { x: -0.52, y: 1.28, z: -1.02 })

    // Instrument bench with a large monitor.
    box(1.38, 0.66, 0.7, CELL.GREY, { x: -0.54, y: 0.47, z: -0.4 })
    box(1.52, 0.14, 0.86, CELL.WHITE, { x: -0.54, y: 0.87, z: -0.4 })
    box(0.7, 0.45, 0.13, CELL.SLATE, { x: -0.71, y: 1.19, z: -0.57 })
    box(0.53, 0.28, 0.06, CELL.WHITE, {
      x: -0.71, y: 1.19, z: -0.47, emissive: 0.55
    })
    c.geom(new THREE.CylinderGeometry(0.14, 0.21, 0.3, 8), CELL.WHITE, {
      x: -0.12, y: 1.09, z: -0.25
    })

    // Open specimen chamber with broad protective rings.
    c.geom(new THREE.CylinderGeometry(0.47, 0.53, 0.25, 10), CELL.GREY, {
      x: 0.83, y: 0.265, z: 0.19
    })
    c.geom(new THREE.CylinderGeometry(0.45, 0.45, 0.14, 10), CELL.WHITE, {
      x: 0.83, y: 1.56, z: 0.19
    })
    for (const x of [0.49, 1.17]) {
      box(0.1, 1.14, 0.12, CELL.GREY, { x, y: 0.96, z: -0.08 })
    }
    c.geom(new THREE.CylinderGeometry(0.16, 0.2, 0.36, 8), CELL.SLATE, {
      x: 0.83, y: 0.57, z: 0.19
    })
    c.geom(new THREE.SphereGeometry(0.25 + rand() * 0.05, 8, 6), CELL.TRIM, {
      x: 0.83, y: 0.99, z: 0.19, emissive: 0.35
    })
    return 'Laboratory'
  },
}

const KIND_IDS = Object.keys(KINDS).filter((k) => !['dish', 'printer', 'rack', 'planter', 'theater', 'pumpjack', 'bench', 'crate', 'deck', 'gazebo', 'kennel', 'desk', 'yard', 'apartment', 'newsstand', 'hq', 'clubhouse', 'house', 'tradingfloor', 'shield', 'launchpad', 'recruitdesk', 'grill', 'vault', 'controltower', 'garage', 'signpost', 'tvwall', 'keyrack', 'meter', 'countdown', 'mailbox', 'outpost'].includes(k))

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
  const k = BUILDING_SCALE * (KIND_SCALE[chosen] || 1)
  geo.scale(k, k, k)
  // `scale()` transforms position and normal and nothing else, so a custom attribute that
  // holds a *position* has to be taken along by hand. Miss this and a rotor turns about a
  // hub left behind at the unscaled height — the blades orbit a point below themselves.
  const pivot = geo.getAttribute('aPivot')
  if (pivot) {
    for (let i = 0; i < pivot.count * 3; i++) pivot.array[i] *= k
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
