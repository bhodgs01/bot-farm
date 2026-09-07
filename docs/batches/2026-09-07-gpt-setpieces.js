  coins(c, rand) {
    const box = (w, h, d, cell, o = {}) =>
      c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Gold comes from the tile's TRIM accent.
    const columns = [{ x: 0, z: 0, count: 9, radius: 0.34 }]
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3
      columns.push({
        x: Math.cos(a) * 0.83,
        z: Math.sin(a) * 0.83,
        count: 3 + Math.floor(rand() * 2),
        radius: 0.29
      })
    }

    // Every layer is emitted before the next higher layer.
    for (let level = 0; level < 9; level++) {
      const bottom = level * 0.13
      for (const column of columns) {
        if (level >= column.count) continue
        c.geom(
          new THREE.CylinderGeometry(
            column.radius, column.radius, 0.13, 12
          ),
          CELL.TRIM,
          {
            x: column.x,
            y: bottom + 0.065,
            z: column.z,
            ry: level * 0.13
          }
        )
      }

      // Bullion bars share the same bottom-up layer ordering.
      if (level < 2) {
        for (const s of [-1, 1]) {
          box(0.66, 0.13, 0.28, CELL.TRIM, {
            x: s * 0.88,
            y: bottom + 0.065,
            z: 1.04,
            ry: s * 0.12
          })
        }
      }
    }
    return 'Treasury'
  },

  chiefOfStaff(c, rand) {
    const box = (w, h, d, cell, o = {}) =>
      c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Raised office floor and dignified rear wall.
    box(3.0, 0.14, 2.9, CELL.SLATE, { y: 0.07 })
    box(2.8, 1.88, 0.16, CELL.GREY, { y: 1.08, z: -1.24 })
    for (const x of [-1.26, 1.26]) {
      box(0.14, 1.88, 0.2, CELL.ROCK, { x, y: 1.08, z: -1.1 })
    }
    box(2.92, 0.14, 0.23, CELL.TRIM, { y: 2.08, z: -1.2 })

    // Large status board with two luminous panels.
    box(2.28, 0.91, 0.13, CELL.SLATE, { y: 1.4, z: -1.1 })
    for (const x of [-0.55, 0.55]) {
      box(0.95, 0.68, 0.065, CELL.WHITE, {
        x, y: 1.4, z: -0.995, emissive: 0.4
      })
      for (let i = 0; i < 3; i++) {
        box(0.11, 0.17 + i * 0.12, 0.06, CELL.SLATE, {
          x: x - 0.25 + i * 0.24,
          y: 1.2 + (0.17 + i * 0.12) / 2,
          z: -0.925
        })
      }
    }

    // Broad desk with pale top and paneled front.
    for (const x of [-0.82, 0.82]) {
      box(0.46, 0.69, 0.68, CELL.ROCK, {
        x, y: 0.485, z: -0.28
      })
    }
    box(2.4, 0.17, 0.95, CELL.WHITE, {
      y: 0.915, z: -0.28
    })
    box(1.53, 0.43, 0.12, CELL.SLATE, {
      y: 0.615, z: 0.11
    })
    box(1.15, 0.08, 0.075, CELL.TRIM, {
      y: 0.73, z: 0.215
    })
    box(0.72, 0.065, 0.38, CELL.SLATE, {
      x: -0.12, y: 1.0325, z: -0.15
    })

    // Tall executive chair, pulled back from the desk.
    c.geom(new THREE.CylinderGeometry(0.36, 0.43, 0.1, 10),
      CELL.SLATE, { y: 0.19, z: 0.88 })
    box(0.14, 0.3, 0.14, CELL.GREY, { y: 0.39, z: 0.88 })
    box(0.73, 0.16, 0.64, CELL.SLATE, { y: 0.62, z: 0.88 })
    box(0.73, 0.69, 0.17, CELL.SLATE, {
      y: 0.995, z: 1.13
    })
    box(0.51, 0.47, 0.07, CELL.ROCK, {
      y: 1.02, z: 1.255
    })
    for (const x of [-0.39, 0.39]) {
      box(0.13, 0.27, 0.52, CELL.ROCK, {
        x, y: 0.785, z: 0.88
      })
    }

    // One warm-looking desk lamp.
    c.geom(new THREE.CylinderGeometry(0.17, 0.2, 0.08, 10),
      CELL.SLATE, { x: 0.86, y: 1.04, z: -0.49 })
    box(0.07, 0.36, 0.07, CELL.GREY, {
      x: 0.86, y: 1.26, z: -0.49
    })
    c.geom(new THREE.CylinderGeometry(0.17, 0.25, 0.23, 10),
      CELL.WHITE, {
        x: 0.86, y: 1.555, z: -0.49,
        emissive: 0.65 + rand() * 0.1
      })
    return 'Chief of Staff'
  },

  reception(c, rand) {
    const box = (w, h, d, cell, o = {}) =>
      c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Broad front desk with short welcoming wings.
    box(3.0, 0.13, 2.47, CELL.SLATE, { y: 0.065 })
    box(2.12, 0.89, 0.91, CELL.WHITE, {
      x: -0.23, y: 0.575, z: 0.16
    })
    box(2.29, 0.15, 1.06, CELL.ROCK, {
      x: -0.23, y: 1.095, z: 0.16
    })
    box(1.82, 0.4, 0.08, CELL.TRIM, {
      x: -0.23, y: 0.66, z: 0.655
    })
    box(0.12, 0.89, 1.36, CELL.GREY, {
      x: -1.23, y: 0.575, z: -0.12
    })

    // Blank nameplate on the counter.
    box(0.71, 0.25, 0.13, CELL.SLATE, {
      x: -0.4, y: 1.295, z: 0.48
    })
    box(0.57, 0.14, 0.06, CELL.WHITE, {
      x: -0.4, y: 1.295, z: 0.58
    })

    // Telephone with a chunky handset.
    box(0.41, 0.13, 0.38, CELL.GREY, {
      x: 0.46, y: 1.235, z: 0.12
    })
    box(0.47, 0.09, 0.12, CELL.SLATE, {
      x: 0.46, y: 1.38, z: 0.03
    })
    for (const x of [0.27, 0.65]) {
      box(0.12, 0.16, 0.18, CELL.SLATE, {
        x, y: 1.325, z: 0.03
      })
    }
    box(0.21, 0.06, 0.14, CELL.SOLAR_A, {
      x: 0.46, y: 1.33, z: 0.22
    })

    // Rear task chair.
    c.geom(new THREE.CylinderGeometry(0.29, 0.34, 0.1, 8),
      CELL.SLATE, { x: -0.38, y: 0.18, z: -0.82 })
    box(0.12, 0.31, 0.12, CELL.GREY, {
      x: -0.38, y: 0.385, z: -0.82
    })
    box(0.59, 0.14, 0.52, CELL.RED, {
      x: -0.38, y: 0.61, z: -0.82
    })
    box(0.59, 0.48, 0.14, CELL.RED, {
      x: -0.38, y: 0.87, z: -1.01
    })

    // Side planter stays clear of the desk silhouette.
    c.geom(new THREE.CylinderGeometry(0.25, 0.19, 0.38, 8),
      CELL.ROCK, { x: 1.17, y: 0.32, z: -0.22 })
    c.geom(new THREE.CylinderGeometry(0.055, 0.08, 0.44, 6),
      CELL.ROCK, { x: 1.17, y: 0.69, z: -0.22 })
    c.geom(new THREE.SphereGeometry(0.26 + rand() * 0.035, 8, 6),
      CELL.TRIM, { x: 1.17, y: 1.06, z: -0.22 })
    return "Janine's Reception"
  },

  orderCounter(c, rand) {
    const box = (w, h, d, cell, o = {}) =>
      c.geom(new THREE.BoxGeometry(w, h, d), cell, o)

    // Rear parcel shelves.
    box(3.0, 0.14, 2.72, CELL.SLATE, { y: 0.07 })
    box(2.66, 1.83, 0.14, CELL.GREY, {
      y: 1.055, z: -1.18
    })
    for (const x of [-1.23, 1.23]) {
      box(0.15, 1.89, 0.66, CELL.WHITE, {
        x, y: 1.085, z: -0.92
      })
    }
    for (const y of [0.32, 1.0, 1.72]) {
      box(2.56, 0.12, 0.66, CELL.SLATE, {
        y, z: -0.92
      })
    }
    box(2.78, 0.19, 0.75, CELL.TRIM, {
      y: 2.01, z: -0.92
    })

    // Large parcels with broad tape bands.
    for (const shelf of [0.38, 1.06]) {
      for (const x of [-0.8, 0, 0.8]) {
        const h = 0.36 + rand() * 0.13
        box(0.62, h, 0.49, CELL.ROCK, {
          x, y: shelf + h / 2, z: -0.88
        })
        box(0.1, h, 0.06, CELL.WHITE, {
          x, y: shelf + h / 2, z: -0.605
        })
        box(0.1, 0.055, 0.49, CELL.WHITE, {
          x, y: shelf + h + 0.0275, z: -0.88
        })
      }
    }

    // Pickup counter.
    box(2.64, 0.69, 0.78, CELL.WHITE, {
      y: 0.485, z: 0.57
    })
    box(2.82, 0.14, 0.94, CELL.SLATE, {
      y: 0.9, z: 0.57
    })
    box(1.93, 0.26, 0.08, CELL.TRIM, {
      y: 0.54, z: 1.01
    })

    // Two stacked outgoing packages and one separate pickup.
    for (let level = 0; level < 2; level++) {
      const bottom = 0.97 + level * 0.28
      box(0.72, 0.28, 0.53, CELL.ROCK, {
        x: -0.73, y: bottom + 0.14, z: 0.5
      })
      box(0.11, 0.28, 0.06, CELL.WHITE, {
        x: -0.73, y: bottom + 0.14, z: 0.795
      })
    }
    box(0.66, 0.38, 0.49, CELL.ROCK, {
      x: 0.35, y: 1.16, z: 0.49
    })
    box(0.26, 0.15, 0.06, CELL.WHITE, {
      x: 0.35, y: 1.17, z: 0.765
    })
    box(0.34, 0.13, 0.3, CELL.GREY, {
      x: 1.01, y: 1.035, z: 0.49
    })
    box(0.23, 0.07, 0.18, CELL.SOLAR_A, {
      x: 1.01, y: 1.135, z: 0.49
    })
    return 'Order Pickup'
  },
