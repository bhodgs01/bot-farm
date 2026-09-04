# Bot Farm set-piece brief (paste this whole file into ChatGPT)

You are designing small low-poly 3D set pieces for **Bot Farm**, a Three.js "moon colony" map.
Every hexagonal tile is one part of the owner's life or business (Inbox, Print Service, Newsroom,
a client's yard, a home, a trading floor). Little astronauts walk around on the tiles. Each tile
has one or more **landmark buildings** that make the tile read as a place at a glance, from a
camera about 45 degrees above, zoomed out far enough to see 20 tiles at once.

The look is **KayKit Space Base**: chunky, clean, toy-like, few parts, strong silhouettes, flat
colours. No textures, no detail smaller than about 5 cm in world units, nothing that only reads
close up. Think "board game miniature", not "game asset".

Your job: write a **JavaScript function** that builds one set piece out of primitives using the
tiny helper API below. Return only the function. I will drop it straight into the engine.

## The helper API (this is all you get)

```js
// `c` is a Composer. `rand` is a seeded 0..1 random (same seed = same building every time).
// A set piece is a function:   name(c, rand) { ...; return 'Label' }
//
// c.geom(geometry, CELL, opts)   place a THREE geometry, painted one palette cell
//   geometry : any THREE.BufferGeometry, built in the building's own frame
//              (BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry, TorusGeometry ...).
//              You may call geometry.rotateX/Y/Z(rad) and geometry.translate(x,y,z) BEFORE
//              placing it, to tilt a part or offset it from its pivot.
//   CELL     : one palette cell (see below)
//   opts     : { x, y, z }   offset (units, see scale)         default 0
//              ry            yaw in radians                    default 0
//              s             uniform scale                     default 1
//              emissive      0..1, the part glows in the dark  default 0
//              spin          radians per second, the part rotates about its own {x,y,z}
//                            (use for a fan, a crank, a sprinkler head, a radar dish)
//
// c.add(kitPartName, opts)  place a ready-made KayKit part (same opts, no CELL). Available:
//   'lights' (a light pole), 'structure_tall' (a lattice tower), 'solarpanel',
//   'roofmodule_solarpanels', 'basemodule_garage', 'basemodule_E', 'lander_base',
//   'drill_structure', 'spacetruck_trailer', 'cargo_A', 'containers_A'..'containers_D',
//   'roofmodule_cargo_C'.  Prefer c.geom; use kit parts only when they fit.
//
// Handy local shortcut most pieces define first:
const box = (w, h, d, cell, o = {}) => c.geom(new THREE.BoxGeometry(w, h, d), cell, o)
```

## Palette (the only colours that exist)

| Cell | Looks like | Use for |
|---|---|---|
| `CELL.WHITE` | painted hull white | walls, desks, screens (with `emissive`) |
| `CELL.GREY` | painted steel, light | frames, posts, rails, machines |
| `CELL.SLATE` | dark blue-grey | floors, bases, dark furniture |
| `CELL.BLACK` | near black | tyres, monitors, shadows, doorways |
| `CELL.ROCK` | warm brown regolith | wood, soil, mulch, tree trunks, terracotta |
| `CELL.TRIM` | **the tile's accent colour** (gold, green, blue... set per tile) | anything that should carry the tile's colour: awnings, blankets, foliage, deck boards. **Glows softly at night.** |
| `CELL.RED` | signal red | accents, chairs, warning bits, lamps |
| `CELL.SOLAR_A` / `SOLAR_B` | dark glossy glass | windows, panels |

There is **no green, no blue, no yellow** cell. Foliage is `CELL.TRIM` on a tile whose accent is
green. If you need "warm light", use `CELL.WHITE` with `emissive: 0.8`.

## Scale and frame

- Units: 1 unit is roughly one astronaut height. The whole piece is later scaled 1.45x, so
  author it about **2.5 to 3.5 units wide** and **1 to 2.5 units tall**. A tile is about 7.6
  units across and holds up to 7 buildings, so keep the footprint inside a 3.2 x 3.2 square.
- `y = 0` is the tile surface. Build upward. Nothing below `y = 0`.
- The camera looks from `+z` toward `-z` at about 45 degrees down. Put the open, interesting
  side of a piece toward `+z` (the "front"). Walls go at the back (`-z`) or the left (`-x`).
- Origin `(0,0,0)` is the centre of the piece's slot. Astronauts stand around it, so leave the
  ground around the piece clear of low clutter that they would clip through.
- Keep it under about 60 parts. Fewer, bigger shapes read better than many small ones.
- Use `rand()` for small variety (a lamp vs a plant, a slight yaw) so three copies of a piece
  on one tile are not clones. Do not use `Math.random()`.
- One moving part per piece at most (`spin`), and only if it is obvious what moves.
- Two or three glowing points per piece at most (`emissive`): a lamp, a screen, a status light.

## Worked example 1: the CorrosionDC pumpjack (has a spinning crank)

```js
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
```

## Worked example 2: the Watchdog kennel (mixes a kit part with primitives)

```js
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
```

## What exists today (so you can improve rather than duplicate)

`dish` (Brain: satellite dish), `printer` (3D printer), `rack` (server rack), `planter`,
`theater` (Plex: screen + seats + projector), `pumpjack`, `bench` (workbench), `crate`,
`deck`, `gazebo`, `kennel`, `desk` (office desk, one per email), `yard` (landscaped yard),
`apartment` (a cut-away room), `newsstand` (kiosk with awning), plus KayKit habitats.

## How to answer

1. Ask which piece I want, or take the one I name, e.g. "a better newsstand", "a trading floor
   with a ticker", "a 3D printer that reads as a Bambu", "a mailroom sorting wall".
2. Reply with **one function** in the exact shape above, named in `lowerCamelCase`, ending in
   `return 'Label'`. Comment each group of parts in one short line. No prose outside the code
   block except a two-line description of the silhouette from the camera's view.
3. Stay inside the palette and the API. Do not import anything, do not use materials, textures,
   lights, groups, or `Math.random()`. `THREE` and `CELL` are already in scope.
4. If a part must tilt, build it, `rotateX/Y/Z` it, then place it. If a part must spin, give
   the spinning geometry its own `{x,y,z}` at the hub and the same `spin` on every part that
   turns with it (the crank and its counterweight above).
