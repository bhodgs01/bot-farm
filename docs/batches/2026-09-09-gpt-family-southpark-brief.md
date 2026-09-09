# Bot Farm — South Park-style family characters (paste this whole file into the chat that has my photos)

You can see the photos I uploaded of my family. Turn **each person** into a **South Park-style**
low-poly character I can drop straight into my "Bot Farm" — a Three.js "moon colony" map with a
chunky KayKit toy look, seen from about 45 degrees above, zoomed out so ~20 hexagon tiles and a
few little characters are visible at once. These characters walk around the map, so build them to
the exact contract below and they import with no edits.

## The look

South Park: **flat colors, no textures, a big round head, huge simple eyes with tiny pupils,
short stubby arms and legs, mitten hands, a small simple mouth, and hair or a hat built from a
few flat shapes.** Chunky and instantly recognizable as that specific person from across the
room. Capture the **essence** — hair, glasses, facial hair, signature clothing color, skin tone —
not realism. When in doubt, simpler and bolder.

## For each person, read their photo and pick

- **skin tone** (a real hex color)
- **hair**: color + a rough style built as a flat cap of shapes (short, long, bald, bun,
  ponytail, curly, etc.)
- **glasses**: yes/no, frame color
- **facial hair**: yes/no, style
- **a signature outfit color** for the body (shirt/coat) and a second accent color
- **any obvious signature** (a hat, a favorite color, etc.)

Keep the head big and round; keep the eyes big, white, with small dark pupils. That combination
is what makes it read as South Park.

## The technical contract (build to this EXACTLY)

```js
// Return ONE function per person. It builds and returns a THREE.Group.
// `THREE` is a global. No imports. No external assets. Primitives only:
//   BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry, TorusGeometry, LatheGeometry.
//
// Frame & scale:
//   - y = 0 is the ground the character stands on. Build UPWARD. Nothing below y = 0.
//   - FORWARD is +Z. The face points toward +z; the back of the head is -z. (The engine turns
//     the whole group to face the way it walks, so this matters.)
//   - A person, a touch taller than the little astronauts: roughly 1.5-1.7 units tall BEFORE the
//     final scale. End the function with g.scale.setScalar(0.85).
//   - Keep it under ~40 parts. Flat colors, flatShading materials, strong shapes.
//
// Materials: make your own, real hex colors, e.g.
//   const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.02, flatShading: true })
//   Give every part castShadow = true (helper below does it).
//
// A tiny helper pattern (match this shape so the files all look alike):
//   const add = (parent, geo, material, x = 0, y = 0, z = 0) => {
//     const m = new THREE.Mesh(geo, material)
//     m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true
//     parent.add(m); return m
//   }
//   const oval = (x, y, z) => { const g = new THREE.SphereGeometry(1, 12, 8); g.scale(x, y, z); return g }
//
// Articulation for a walk — hang the moving parts on userData so my engine can swing them.
// A part that swings from a joint MUST have its geometry.translate(...) so the JOINT sits at the
// part's LOCAL origin, then be positioned where that joint belongs; I rotate the part around its
// x axis for the walk swing.
//   g.userData.arms = [leftArm, rightArm]   // each pivots at the SHOULDER
//   g.userData.legs = [leftLeg, rightLeg]   // each pivots at the HIP
//   g.userData.head = headMesh              // optional; I may add a gentle look-around
// Default motion I will always drive: arms and legs swinging opposite each other as they walk.
```

## Expressions (important — I want the faces to change)

Build the face so its **mouth and eyebrows can change**, and give me a set of named expressions
the engine can switch between. Keep the eyes (whites + pupils) fixed; vary the **mouth** shape and,
where it helps, small **eyebrow** pieces above the eyes.

- Build the pieces for **every** expression up front and add them all to the group, then hide all
  but `neutral` (`mesh.visible = false`). I'll flip visibility to change the face — you don't need
  to write any switching logic.
- Expose them as a map on userData, keyed by expression name, each value an array of the meshes
  that belong to that face:

```js
g.userData.expressions = {
  neutral:   [mouthNeutral],
  happy:     [mouthSmile, browHappyL, browHappyR],
  surprised: [mouthO, browUpL, browUpR],
  annoyed:   [mouthFlat, browAngryL, browAngryR],
  sleepy:    [mouthSmall, eyelidL, eyelidR],
}
// Everything in expressions starts hidden except the neutral set.
```

Give me at least these five: **neutral, happy, surprised, annoyed, sleepy.** A couple more (a big
grin, a worried face) are welcome. Keep each expression to a few flat shapes so the part count
stays reasonable.

## What I need back

- **One function per person** (any function names), each self-contained.
- For **each** function, also give me:
  - a short **display name** (I float it over their head), and
  - a **one-line intro in that person's voice** (I show it when I click the character).
- Tell me **which uploaded photo maps to which function**.

Return the functions in one code block. I'll drop each into the engine as a walking colony
character with a name tag and a click-to-meet intro, exactly like my existing pets.
