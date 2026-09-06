// ChatGPT, 2026-09-05: the FJ40 on the lift, landmark for the Garage tile.
fj40(c, rand) {
  const box = (w, h, d, cell, o = {}) =>
    c.geom(new THREE.BoxGeometry(w, h, d), cell, o)
  const disc = (r, depth, cell, o) => {
    const g = new THREE.CylinderGeometry(r, r, depth, 12)
    g.rotateX(Math.PI / 2)
    c.geom(g, cell, o)
  }

  // Open garage shell with the raised door stored overhead.
  box(3.12, 0.12, 3.08, CELL.SLATE, { y: 0.06 })
  box(2.98, 2.3, 0.14, CELL.GREY, {
    y: 1.27, z: -1.45
  })
  for (const x of [-1.44, 1.44]) {
    box(0.14, 2.3, 0.54, CELL.WHITE, {
      x, y: 1.27, z: -1.11
    })
    box(0.14, 2.3, 0.14, CELL.WHITE, {
      x, y: 1.27, z: 1.31
    })
  }
  box(3.04, 0.18, 0.23, CELL.TRIM, {
    y: 2.49, z: 1.31
  })
  box(2.75, 0.13, 0.52, CELL.GREY, {
    y: 2.48, z: -1.08
  })

  // Red two-post lift and grey arms beneath the chassis.
  for (const s of [-1, 1]) {
    box(0.19, 1.92, 0.25, CELL.RED, {
      x: s * 0.83, y: 1.08, z: -0.13
    })
    for (const z of [-0.4, 0.31]) {
      box(0.64, 0.12, 0.15, CELL.GREY, {
        x: s * 0.53, y: 0.65, z,
        ry: s * (z < 0 ? -0.42 : 0.42)
      })
    }
  }

  // Short wheelbase chassis and separate rear body tub.
  box(1.04, 0.17, 2.03, CELL.SLATE, {
    y: 0.77, z: -0.04
  })
  box(1.09, 0.39, 1.05, CELL.TRIM, {
    y: 1.03, z: -0.53
  })
  for (const x of [-0.47, 0.47]) {
    box(0.25, 0.16, 0.97, CELL.TRIM, {
      x, y: 1.1, z: 0.47
    })
  }

  // Open engine bay with the cylinder head absent.
  box(0.68, 0.1, 0.75, CELL.BLACK, {
    y: 0.93, z: 0.48
  })
  box(0.32, 0.18, 0.49, CELL.GREY, {
    y: 1.07, z: 0.45
  })
  box(0.25, 0.055, 0.41, CELL.BLACK, {
    y: 1.1875, z: 0.45
  })

  // Hood hinged at the windshield and raised toward the rear.
  const hood = new THREE.BoxGeometry(0.87, 0.09, 0.81)
  hood.translate(0, 0, 0.405)
  hood.rotateX(-1.1)
  c.geom(hood, CELL.TRIM, {
    y: 1.26, z: 0.035
  })

  // Flat white grille, wide slot, round headlights, exposed bumper.
  box(1.08, 0.4, 0.13, CELL.WHITE, {
    y: 1.06, z: 0.99
  })
  box(0.55, 0.15, 0.065, CELL.BLACK, {
    y: 1.065, z: 1.09
  })
  for (const x of [-0.4, 0.4]) {
    disc(0.115, 0.075, CELL.WHITE, {
      x, y: 1.095, z: 1.115, emissive: 0.4
    })
  }
  box(1.3, 0.14, 0.22, CELL.GREY, {
    y: 0.82, z: 1.12
  })

  // Dark cab glazing beneath the removable white hardtop.
  box(0.97, 0.5, 0.99, CELL.SOLAR_A, {
    y: 1.48, z: -0.52
  })
  box(1.16, 0.12, 1.2, CELL.WHITE, {
    y: 1.8, z: -0.52
  })
  box(0.97, 0.11, 1.04, CELL.WHITE, {
    y: 1.915, z: -0.52
  })
  for (const x of [-0.49, 0.49]) {
    for (const z of [-0.98, -0.025]) {
      box(0.085, 0.54, 0.085, CELL.WHITE, {
        x, y: 1.48, z
      })
    }
  }

  // Fold-down windshield frame with visible hinge blocks.
  for (const y of [1.225, 1.73]) {
    box(1.04, 0.085, 0.095, CELL.TRIM, {
      y, z: 0.025
    })
  }
  for (const x of [-0.4, 0.4]) {
    box(0.14, 0.09, 0.13, CELL.GREY, {
      x, y: 1.225, z: 0.07
    })
  }

  // Low expedition roof rack with an open center.
  for (const x of [-0.48, 0.48]) {
    box(0.085, 0.14, 1.03, CELL.SLATE, {
      x, y: 2.04, z: -0.52
    })
  }
  for (const z of [-0.95, -0.09]) {
    box(1.04, 0.085, 0.095, CELL.SLATE, {
      y: 2.04, z
    })
  }

  // Chunky faceted tires and exposed grey hubs.
  for (const s of [-1, 1]) {
    for (const z of [-0.71, 0.65]) {
      const tire = new THREE.TorusGeometry(0.195, 0.095, 4, 12)
      tire.rotateY(Math.PI / 2)
      c.geom(tire, CELL.BLACK, {
        x: s * 0.57, y: 0.71, z
      })
      const hub = new THREE.CylinderGeometry(0.135, 0.135, 0.08, 10)
      hub.rotateZ(Math.PI / 2)
      c.geom(hub, CELL.GREY, {
        x: s * 0.64, y: 0.71, z
      })
    }
  }

  // Rear swing-door spare and its mounting hub.
  c.geom(new THREE.TorusGeometry(0.195, 0.095, 4, 12), CELL.BLACK, {
    x: 0.17, y: 1.22, z: -1.15
  })
  disc(0.135, 0.12, CELL.GREY, {
    x: 0.17, y: 1.22, z: -1.19
  })

  // Small side mirrors beside the windshield.
  for (const s of [-1, 1]) {
    box(0.18, 0.06, 0.065, CELL.GREY, {
      x: s * 0.59, y: 1.46, z: 0.015
    })
    box(0.095, 0.18, 0.1, CELL.SLATE, {
      x: s * 0.7, y: 1.51, z: 0.015
    })
  }

  // Machine-shop bench and the removed cylinder head.
  for (const z of [-0.35, 0.37]) {
    box(0.4, 0.68, 0.13, CELL.GREY, {
      x: 1.17, y: 0.46, z
    })
  }
  box(0.57, 0.13, 1.02, CELL.ROCK, {
    x: 1.17, y: 0.865
  })
  box(0.35, 0.19, 0.73, CELL.GREY, {
    x: 1.17, y: 1.025, z: 0.01
  })
  for (const z of [-0.2, 0.01, 0.22]) {
    box(0.2, 0.055, 0.12, CELL.BLACK, {
      x: 1.17, y: 1.1475, z
    })
  }

  // Red toolbox and rear oil drum.
  box(0.43, 0.57, 0.55, CELL.RED, {
    x: -1.16, y: 0.405, z: 0.64
  })
  box(0.29, 0.08, 0.065, CELL.GREY, {
    x: -1.16, y: 0.45, z: 0.95
  })
  c.geom(new THREE.CylinderGeometry(0.23, 0.23, 0.59, 10),
    rand() > 0.5 ? CELL.GREY : CELL.SLATE, {
      x: 1.14, y: 0.415, z: -0.96
    })
  return 'FJ40'
},
