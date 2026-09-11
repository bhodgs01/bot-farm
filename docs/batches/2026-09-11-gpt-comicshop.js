comicshop(c, rand) {
  const box = (w, h, d, cell, o = {}) =>
    c.geom(new THREE.BoxGeometry(w, h, d), cell, o)
  const covers = [CELL.RED, CELL.WHITE, CELL.ROCK, CELL.GREY]
  const cover = () => covers[Math.floor(rand() * covers.length)]

  // Low shop backdrop and three simple faced-out comics.
  box(3.1, 0.1, 2.85, CELL.SLATE, { y: 0.05 })
  box(3.0, 1.43, 0.14, CELL.GREY, { y: 0.815, z: -1.27 })
  for (const x of [-0.1, 0.53, 1.16]) {
    box(0.43, 0.58, 0.075, cover(), {
      x, y: 1.12, z: -1.16
    })
  }

  // Blank hanging sign: the second and final explicit glow.
  for (const x of [-0.14, 1.13]) {
    box(0.075, 0.4, 0.09, CELL.SLATE, {
      x, y: 1.68, z: -1.22
    })
  }
  box(1.73, 0.45, 0.17, CELL.SLATE, {
    x: 0.495, y: 1.94, z: -1.22
  })
  box(1.51, 0.27, 0.065, CELL.TRIM, {
    x: 0.495, y: 1.94, z: -1.095, emissive: 0.55
  })

  // Dark counter with cutaway front glazing and a rear glass worktop.
  box(2.35, 0.4, 0.97, CELL.SLATE, {
    x: 0.25, y: 0.3, z: 0.555
  })
  box(2.35, 0.09, 0.25, CELL.SOLAR_B, {
    x: 0.25, y: 1.215, z: 0.205
  })
  box(2.2, 0.19, 0.065, CELL.SOLAR_A, {
    x: 0.25, y: 0.615, z: 1.025
  })
  for (const x of [-0.885, 1.385]) {
    box(0.08, 0.715, 0.09, CELL.GREY, {
      x, y: 0.8575, z: 1.005
    })
  }
  box(2.35, 0.065, 0.08, CELL.GREY, {
    x: 0.25, y: 1.205, z: 1.005
  })
  for (const x of [-0.885, 1.385]) {
    box(0.08, 0.065, 0.94, CELL.GREY, {
      x, y: 1.205, z: 0.555
    })
  }
  box(2.14, 0.065, 0.7, CELL.WHITE, {
    x: 0.25, y: 0.5325, z: 0.555, emissive: 0.72
  })

  // Four upright grading slabs with oversized white label strips.
  for (const x of [-0.59, -0.03, 0.53, 1.09]) {
    box(0.45, 0.57, 0.095, CELL.SOLAR_B, {
      x, y: 0.85, z: 0.64
    })
    box(0.31, 0.32, 0.055, cover(), {
      x, y: 0.79, z: 0.715
    })
    box(0.39, 0.12, 0.06, CELL.WHITE, {
      x, y: 1.035, z: 0.72
    })
  }

  // Spinner base and stationary spindle.
  c.geom(new THREE.CylinderGeometry(0.32, 0.39, 0.13, 10),
    CELL.SLATE, { x: -1.0, y: 0.165, z: -0.64 })
  c.geom(new THREE.CylinderGeometry(0.055, 0.075, 1.72, 8),
    CELL.GREY, { x: -1.0, y: 1.09, z: -0.64 })

  // One rotating assembly: every tier and comic shares the same pivot.
  const yaw = rand() * Math.PI * 2
  const speed = 0.4 + rand() * 0.25
  const spinning = (geometry, cell) => {
    geometry.rotateY(yaw)
    c.geom(geometry, cell, {
      x: -1.0, y: 1.0, z: -0.64, spin: speed
    })
  }
  for (const tierY of [-0.45, 0.24]) {
    const ring = new THREE.TorusGeometry(0.34, 0.035, 6, 16)
    ring.rotateX(Math.PI / 2)
    ring.translate(0, tierY, 0)
    spinning(ring, CELL.TRIM)

    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3
      const comic = new THREE.BoxGeometry(0.33, 0.48, 0.07)
      comic.translate(0, tierY + 0.24, 0.29)
      comic.rotateY(a)
      spinning(comic, cover())
    }
  }

  // Open longbox beside the counter, clear of the central approach.
  box(0.44, 0.07, 0.88, CELL.WHITE, {
    x: -1.24, y: 0.135, z: 0.57
  })
  for (const x of [-1.43, -1.05]) {
    box(0.06, 0.28, 0.88, CELL.WHITE, {
      x, y: 0.31, z: 0.57
    })
  }
  for (const z of [0.16, 0.98]) {
    box(0.38, 0.28, 0.06, CELL.WHITE, {
      x: -1.24, y: 0.31, z
    })
  }
  for (let i = 0; i < 5; i++) {
    box(0.3, 0.37, 0.075, cover(), {
      x: -1.24, y: 0.355, z: 0.27 + i * 0.145
    })
  }

  // Loupe rests on the rear worktop with a visible glass center.
  const loupeBody = new THREE.CylinderGeometry(
    0.125, 0.145, 0.15, 12, 1, true
  )
  const loupeGlass = new THREE.CylinderGeometry(
    0.105, 0.105, 0.055, 12
  )
  loupeGlass.translate(0, 0.045, 0)
  const lying = rand() > 0.5
  if (lying) {
    loupeBody.rotateX(Math.PI / 2)
    loupeGlass.rotateX(Math.PI / 2)
  }
  const loupeY = lying ? 1.405 : 1.335
  c.geom(loupeBody, CELL.GREY, {
    x: -0.59, y: loupeY, z: 0.205
  })
  c.geom(loupeGlass, CELL.SOLAR_B, {
    x: -0.59, y: loupeY, z: 0.205
  })

  // Coin appraisal tray and three unlit accent coins.
  box(0.83, 0.06, 0.25, CELL.SLATE, {
    x: 0.35, y: 1.29, z: 0.205
  })
  for (const x of [0.09, 0.35, 0.61]) {
    c.geom(new THREE.CylinderGeometry(0.085, 0.085, 0.055, 10),
      CELL.TRIM, { x, y: 1.3475, z: 0.205 })
  }

  // Two old hardbacks at the worktop's right end.
  box(0.36, 0.09, 0.23, CELL.ROCK, {
    x: 1.09, y: 1.305, z: 0.205
  })
  box(0.32, 0.075, 0.21, CELL.WHITE, {
    x: 1.09, y: 1.3875, z: 0.205
  })
  return 'Comic Shop'
},
