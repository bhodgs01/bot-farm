# Bot Farm — robot crew hardware (Boston Dynamics / Tesla Optimus)

## What you are building

Bot Farm is a live map of Blake's company and home: every real thing — a running print, an unread
email, a failing server — is one character walking a hex-tiled colony. Those characters currently
wear a borrowed spaceman skin, and we are replacing it with **detailed humanoid robots**:
hard-shell plating, visible actuators, cable runs, a dark sensor visor.

You are NOT building a character or its animation. The skeleton and its walk, run, hammer, sit,
wave and cheer cycles already exist and are staying exactly as they are. You are building the
**hardware that bolts onto that skeleton** — a shopping list of rigid parts, each authored around
one named bone, each a single merged `THREE.BufferGeometry`. The engine bolts them on and the
existing animation carries them.

## How it is seen — READ THIS, IT HAS CHANGED

Earlier briefs for Blake's projects said the models were tiny specks and to use the fewest,
biggest shapes. **That advice is wrong here and must be ignored.**

- The map view is isometric. A crew member stands about **1 world unit** tall beside a **7.5 unit**
  hex tile and **4 unit** buildings — roughly 40–90 px at normal zoom.
- **But the colony now has a walk mode and a VR mode.** Blake drops in at eye height and walks
  among them, and the robots are then seen **life size, a metre away, from every angle including
  behind and below**. That is the bar. A knee actuator or a panel seam that reads as a smudge from
  orbit is still worth modelling, because he will stand next to it.
- Lighting is a low warm key against a dark sky, and he runs the map dark most of the day.
  Emissive detail (an eye bar, a chest status strip) carries a long way — which is exactly why it
  must be rationed.
- There can be **180 of these on screen at once**. Detail has to come from silhouette and shape,
  not from part count per robot. See the budget.

## The contract

Every part is a function returning ONE merged `BufferGeometry`, authored in **bone-local space** —
the origin is the bone itself, and the engine multiplies by that bone's live matrix every frame.
Nothing else: no `Mesh`, no `Group`, no `Object3D`, no materials, textures, lights or animation.

```js
export function chestPlate() {
  const a = roundedBox(0.52, 0.46, 0.30, 0.06)
  a.translate(0, 0.06, 0.02)
  const b = new THREE.CylinderGeometry(0.05, 0.05, 0.28, 8)
  b.rotateZ(Math.PI / 2)
  b.translate(0, 0.20, 0.14)
  const merged = BufferGeometryUtils.mergeGeometries([a, b], false)
  a.dispose(); b.dispose()
  return merged
}
```

`THREE`, `BufferGeometryUtils`, `roundedBox`, `sphereCap` and `paint` are supplied by the engine.
Do not import anything. Do not reference `window`, `document`, `fetch`, `Math.random` or `eval`.

### Axes and units

- **+Y is up, +Z is the way the robot faces, +X is its left.**
- Units are rig units; the engine scales everything by 0.56 to reach world units. **Author in rig
  units and ignore the 0.56.**
- The parts you are replacing, for scale: helmet radius **0.48**, centred **0.46 above** the head
  bone; backpack **0.43 × 0.44 × 0.26**, sitting 0.06 up and 0.30 behind the chest bone.
- A bone's origin is the **joint**, not the middle of the limb. An upper-arm plate hangs *below*
  its bone origin; a head shell sits *above* it.

🚨 **The hand bone's +Y runs back down the forearm**, not up out of the fist. A tool authored
standing along +Y hangs through the floor. The shipped hammer below deals with this — read it.

## Palette — roles, not colours

Colour is per-robot and applied by the engine at runtime, so **do not bake brand colours**. Each
part declares one role:

| role | what it is |
|---|---|
| `suit` | the shell: large plated surfaces |
| `trim` | secondary hardware: packs, actuators, cable runs |
| `glow` | emissive: eye bar, status strip |

If a part genuinely needs two fixed colours baked in — as the shipped hammer does for its wooden
shaft and steel head — bake them as **vertex colours** with `paint()` and say so in your manifest.

## Budget — the hard constraint

Each distinct part is **one instanced draw call for the whole crew**: parts are cheap in count,
but every part is paid for 180 times in vertices.

- **Target ≤ 400 triangles per part**, hard ceiling 900. A 16-segment sphere is 480 on its own.
  Use 8–12 segments; nobody counts facets on a 1-unit robot, even up close, and facets read as
  machined where smooth spheres read as toys.
- No part may exceed **1.2 rig units** in any dimension.

## The real API (verbatim from the engine)

```js
function roundedBox(w, h, d, r) {
  const geo = new THREE.BoxGeometry(w, h, d, 2, 2, 2)
  const pos = geo.attributes.position
  const v = new THREE.Vector3()
  const half = new THREE.Vector3(w / 2 - r, h / 2 - r, d / 2 - r)
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const inner = new THREE.Vector3(
      THREE.MathUtils.clamp(v.x, -half.x, half.x),
      THREE.MathUtils.clamp(v.y, -half.y, half.y),
      THREE.MathUtils.clamp(v.z, -half.z, half.z)
    )
    const out = v.clone().sub(inner)
    if (out.lengthSq() > 0) out.setLength(r)
    pos.setXYZ(i, inner.x + out.x, inner.y + out.y, inner.z + out.z)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

/**
 * A patch of sphere centred on +Z — the direction the astronaut faces. Three's own
 * parametrisation puts phi=0 at -X, so the patch is offset by a quarter turn to land
 * the cap on the front of the helmet rather than its cheek.
 */
function sphereCap(radius, phiSpread, thetaSpread, wSeg = 18, hSeg = 12) {
  return new THREE.SphereGeometry(
    radius, wSeg, hSeg,
    Math.PI / 2 - phiSpread / 2, phiSpread,
    Math.PI / 2 - thetaSpread / 2, thetaSpread
  )
}

/** Bake a flat colour into a geometry's vertex colours. */
function paint(geo, hex) { /* writes a 'color' attribute */ }
```

### A part that shipped, in full — note the axis fix

```js
function hammerGeometry(R) {
  const shaft = new THREE.CylinderGeometry(R * 0.055, R * 0.07, R * 1.15, 6)
  shaft.translate(0, R * 0.24, 0)
  paint(shaft, 0x8a6440)

  // The head crosses the shaft. It is authored long along X, which is already square to the
  // shaft's Y — turning it a quarter turn about Z, as this used to, stood the head *up in
  // line with* the handle, so the astronaut appeared to be swinging a mallet end-on.
  const head = roundedBox(R * 0.5, R * 0.19, R * 0.19, R * 0.05)
  head.translate(0, R * 0.82, 0)
  paint(head, 0x9aa0a8)

  const merged = BufferGeometryUtils.mergeGeometries([shaft, head], false)
  shaft.dispose()
  head.dispose()
  return merged
}
```

## What to build

One file, `robot_parts.js`, exporting **one object** keyed by the exact names below (several
contain a dot, so an object is required rather than named exports):

```js
export const PARTS = { headShell, headVisor, 'shoulderPod.l': shoulderPodL, /* ... */ }
```

| name | bone | what it must read as |
|---|---|---|
| `headShell` | `head` | the skull: a hard, slightly tapered helmet form with a panel seam and a chin. Leave the FRONT open — the visor is separate |
| `headVisor` | `head` | a dark glossy sensor band across the face, Optimus-like; slightly proud of the shell, not poking through it |
| `headLamp` | `head` | a small emissive eye bar or twin sensors (`glow`) |
| `earPods` | `head` | actuator housings at the temples, where a jaw hinge would be — mirrored left and right in ONE geometry |
| `neckStack` | `head` | exposed neck actuator below the bone: stacked rings and a cable loop. This is what sells "robot" from behind |
| `chestPlate` | `chest` | torso shell: a raised sternum plate with a shoulder yoke |
| `chestCore` | `chest` | a small emissive status panel set into the chest (`glow`) |
| `backPack` | `chest` | battery/compute pack with cooling fins, sitting behind |
| `shoulderPod.l` / `shoulderPod.r` | `upperarm.l` / `upperarm.r` | a rounded shoulder actuator cap over the joint |
| `upperArmPlate.l` / `.r` | `upperarm.l` / `upperarm.r` | a plate along the bicep with a visible piston |
| `foreArmPlate.l` / `.r` | `lowerarm.l` / `lowerarm.r` | forearm shell, tapering to the wrist |
| `handUnit.l` / `.r` | `hand.l` / `hand.r` | a three-finger gripper, closed/neutral — mind the hand-bone axis trap |
| `hipBlock` | `hips` | the pelvis housing joining the leg actuators |
| `thighPlate.l` / `.r` | `upperleg.l` / `upperleg.r` | thigh shell with a knee actuator at the lower end |
| `shinPlate.l` / `.r` | `lowerleg.l` / `lowerleg.r` | shin shell; leave the ankle exposed and mechanical |
| `footPad.l` / `.r` | `foot.l` / `foot.r` | a flat robot foot with a toe break and a heel pad — this reads on every walk cycle |

Deliver a manifest in the same file:

```js
export const MANIFEST = {
  chestPlate: { bone: 'chest', role: 'suit', offset: [0, 0.06, 0.02], rot: [0, 0, 0] },
  chestCore:  { bone: 'chest', role: 'glow', offset: [0, 0.10, 0.16], rot: [0, 0, 0] },
  // ...one line per part
}
```

Offset and rotation are your placement of that part relative to its bone, and the engine applies
them. Getting these roughly right matters more than perfect geometry: a beautiful shoulder pod
0.3 units inside the chest is worth nothing.

## Traps that have actually bitten this project

1. **A part authored around the world origin instead of its bone** ends up in a heap at the
   colony's centre. Every part is bone-local.
2. **Mixing indexed and non-indexed geometry fails `mergeGeometries` outright** ("all geometries
   must have compatible attributes"). Boxes are indexed, extrusions are not. If you mix them, call
   `.toNonIndexed()` on all of them first. This cost a whole afternoon on a castle.
3. **Foreign palette constants.** This is *not* the set-piece Composer: there is no `CELL`, no
   `c.geom`, no `c.group`. Raw THREE geometry only. A piece written against the other API resolves
   every colour to `undefined` and takes the whole map down with no error in the console.
4. **`Math.random` is rejected by the importer.** Every robot is identical; variation comes from
   the engine's per-instance colour, not from you.
5. **Smooth high-segment spheres** blow the triangle budget and read as toys. Facet them.
6. **Emissive everywhere** turns the night map into a christmas tree. Two glow parts, no more.

## Before you send

- [ ] Every name in the table appears in `PARTS`, spelled exactly; nothing missing, nothing extra.
- [ ] `MANIFEST` has one entry per part, each naming a bone from the table.
- [ ] No `import`, `window`, `document`, `fetch`, `Math.random`, `eval`, `new THREE.Mesh`,
      `new THREE.Group`, materials, textures or lights anywhere in the file.
- [ ] Every function returns ONE merged BufferGeometry and disposes its parts.
- [ ] Nothing exceeds 1.2 units in any dimension; each part is under ~400 triangles.
- [ ] Left/right parts are mirrored, not copies.
- [ ] One line per part saying what it is meant to read as, so a wrong guess is obvious on sight.
