// ChatGPT round 2, 2026-09-05. 18 new pieces + 10 rebuilds. Imported with scripts/import_pieces.py.
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
