// Bot Farm: every set piece as it exists today. Same API as docs/design-brief.md.
// Each entry is one function inside the KINDS object. Rebuild any of them and send the
// whole function back with the SAME name; it replaces the old one on import.

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

  /**
   * A newsstand: the Newsroom's landmark. A kiosk with a counter, a back wall, an awning
   * in the zone's colour, a stack of the morning's papers on the counter and a headline
   * board out front.
   */
  newsstand(c) {
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)
    box(1.9, 0.12, 1.5, CELL.SLATE, { y: 0.06 })
    // back wall and two sides
    box(1.7, 1.5, 0.12, CELL.GREY, { y: 0.12 + 0.75, z: -0.6 })
    box(0.12, 1.5, 1.2, CELL.GREY, { x: -0.79, y: 0.12 + 0.75, z: -0.05 })
    box(0.12, 1.5, 1.2, CELL.GREY, { x: 0.79, y: 0.12 + 0.75, z: -0.05 })
    // counter across the front
    box(1.7, 0.5, 0.5, CELL.WHITE, { y: 0.12 + 0.25, z: 0.3 })
    box(1.8, 0.06, 0.6, CELL.SLATE, { y: 0.65, z: 0.3 })
    // the roof, and the awning in the accent hanging out over the counter
    box(1.9, 0.1, 1.5, CELL.SLATE, { y: 1.67, z: -0.05 })
    box(1.9, 0.07, 0.7, CELL.TRIM, { y: 1.62, z: 0.85 })
    box(0.05, 0.14, 0.7, CELL.TRIM, { x: -0.92, y: 1.52, z: 0.85 })
    box(0.05, 0.14, 0.7, CELL.TRIM, { x: 0.92, y: 1.52, z: 0.85 })
    // three stacks of papers on the counter, and shelves of them on the back wall
    for (const x of [-0.5, 0, 0.5]) box(0.34, 0.12, 0.26, CELL.WHITE, { x, y: 0.74, z: 0.3 })
    for (const y of [0.9, 1.25]) {
      box(1.5, 0.04, 0.3, CELL.SLATE, { y, z: -0.4 })
      for (const x of [-0.5, 0, 0.5]) box(0.34, 0.1, 0.22, CELL.WHITE, { x, y: y + 0.07, z: -0.4 })
    }
    // headline board out front, a sandwich board leaning by the counter
    box(0.5, 0.6, 0.05, CELL.BLACK, { x: 1.15, y: 0.42, z: 0.55 })
    box(0.46, 0.18, 0.06, CELL.WHITE, { x: 1.15, y: 0.6, z: 0.55 })
    box(0.05, 0.3, 0.3, CELL.GREY, { x: 1.15, y: 0.27, z: 0.4 })
    return 'Newsstand'
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
    const first = c.parts.length
    const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)
    const bush = (x, z, s, y = 0) => c.geom(new THREE.SphereGeometry(s, 10, 8), CELL.TRIM, { x, y: y + s * 0.85, z })
    // lawn as a low slab with a mulch bed cut into one corner
    box(3.0, 0.06, 2.6, CELL.SLATE, { y: 0.03 })
    box(1.2, 0.08, 0.9, CELL.ROCK, { x: 0.85, y: 0.04, z: -0.75 })
    // flagstone path, stepping across the lawn
    for (let i = 0; i < 5; i++) box(0.38, 0.03, 0.3, CELL.GREY, { x: -1.1 + i * 0.5, y: 0.07, z: 0.85 + Math.sin(i * 1.7) * 0.12, ry: rand() * 0.5 - 0.25 })
    // clipped hedge along the back, with square shoulders
    for (let i = 0; i < 6; i++) box(0.44, 0.6 + rand() * 0.08, 0.42, CELL.TRIM, { x: -1.25 + i * 0.5, y: 0.32, z: -1.12 })
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
    // A yard is a place, not a fixture: scale the lot up so it fills its ground. Spin
    // pivots ride along, or the sprinkler would turn about a point it no longer sits on.
    const S = 1.45
    for (const g of c.parts.slice(first)) {
      g.scale(S, S, S)
      const pv = g.getAttribute('aPivot')
      for (let i = 0; i < pv.count; i++) pv.setXYZ(i, pv.getX(i) * S, pv.getY(i) * S, pv.getZ(i) * S)
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
