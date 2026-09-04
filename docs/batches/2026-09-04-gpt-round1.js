// ChatGPT round 1, 2026-09-04. Imported with scripts/import_pieces.py.
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
