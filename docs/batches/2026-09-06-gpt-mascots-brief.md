# Bot Farm — mascot models for ChatGPT (paste this whole file)

You are designing **animated low-poly creatures** for **Bot Farm**, a Three.js "moon colony"
map. Little astronauts and a couple of pet mascots walk around chunky hexagonal tiles, seen
from about 45 degrees above, zoomed out to see ~20 tiles at once. The look is **KayKit Space
Base**: chunky, clean, toy-like, few parts, strong silhouettes, flat colours, no textures.
Think "board-game miniature", not "game asset".

These creatures are **not** buildings, so they do **not** use the set-piece Composer API. They
are built directly from `three` and are allowed to use `new THREE.Mesh`, `THREE.Group`, and
real hex colours (they get their own materials, not the tile palette). Each is **articulated**:
you return a `THREE.Group` and hang the moving parts on `userData` so the engine can wag a tail
or open a claw every frame.

## The contract (build to this exactly)

```js
// Return ONE function per creature. It builds and returns a THREE.Group.
// `THREE` is a global. No imports. No external assets. Primitives only:
//   BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry, TorusGeometry, LatheGeometry.
//
// Frame & scale:
//   - y = 0 is the ground the creature stands on. Build UPWARD. Nothing below y = 0.
//   - FORWARD is +Z. The head/face points toward +z; the tail is at -z. (The engine turns the
//     whole group to face the way it walks, so this matters.)
//   - Size it to about an astronaut's knee-to-waist height: roughly 0.7-1.0 units tall and
//     1.2-1.6 units long BEFORE the final scale. End the function with g.scale.setScalar(~0.85).
//   - Keep it under ~40 parts. Flat colours, flatShading materials, strong shapes.
//
// Materials: make your own, e.g.
//   const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.02, flatShading: true })
//   Use real hex colours. Give parts castShadow = true.
//
// Articulation — the engine drives these every frame, so put them on userData:
//   - A part that swings from a pivot must have its geometry.translate(...) so the pivot is at
//     the part's LOCAL origin, then be positioned where the pivot belongs. The engine rotates
//     the part, so the pivot has to be the joint, not the centre.
//   - Handles the engine looks for (name them exactly):
//       g.userData.tail        -> a single mesh; engine sets tail.rotation.y = wag  (side to side)
//       g.userData.claws       -> an array of claw sub-Groups; each claw.userData.jaw is a mesh;
//                                 engine sets jaw.rotation.x = -open (the jaw hinges open/shut)
//       g.userData.head (opt)  -> a mesh; reserved for a future look-around, fine to include
//   - If your creature has different moving parts (flapping ears, a bobbing antenna), add them
//     under a `g.userData.wag = [meshes]` array and tell me in a comment what should move; I'll
//     wire it. Default motion I can always drive: tail (wag) and claws[].jaw (open).
```

## What I need

### 1. Clawd the lobster  (the hero — the current one is too blocky)
Clawd is Blake's mascot, a friendly cartoon lobster. Deep red shell (`0xc7402f`-ish) with
darker segment joints. Wants: a **segmented curved tail** at the back that tapers to a fan, a
rounded **carapace/head** at the front with two **eye stalks** and little black eyes, two long
**antennae** sweeping back, two **arms reaching forward** each ending in a **big claw** that
opens and shuts (`claws` = the two claw groups, each with a `jaw`). Give him personality:
oversized claws, a slight forward lean, a chunky friendly silhouette. Six small walking legs
along the underside are a nice touch if the part count allows. Forward = +z.

### 2. A dog  (a stubby, happy colony dog)
A short-legged, barrel-bodied cartoon dog, tan/brown, floppy dark ears, a black nose, four
sturdy legs, and a **tail that wags** (`userData.tail`, pivot at the rump, wags side to side).
Friendly, alert, head up, facing +z. Keep it toy-like and readable from far away.

Return each as its own function (any names). I will drop them straight into the engine.

---

## Also worth your time (these ARE set pieces — use the OTHER brief, `docs/design-brief.md`)

These are static tile landmarks and go through the normal set-piece pipeline (Composer API,
`c.geom`/`box`, `rand` not `Math.random`, no raw `Mesh`). Ask me for `design-brief.md` and send
them as a set-piece batch:

- **Treasure / money pile** (`coins`): a proper pile of gold coins and a few bars, tallest in
  the centre, built strictly **bottom-up** (the engine reveals it from the deck upward to show
  how much money there is, so height = wealth). Must read as money from far away. Replaces the
  plain token stack that's there now.
- **Chief-of-staff office**: a small, distinguished HQ — a clean desk, a big status board or
  monitor wall behind it, a good chair, one warm lamp. It should read as "the important
  person's office," a step dressier than the other desks.
- **Janine's reception desk** (KC Proto): a welcoming front desk with a nameplate, a phone/
  headset, a little plant.
- **Order counter** (Print Service): a pickup counter with stacked parcels/boxes waiting to go
  out.

---

## 3. Kai's leopard gecko (new pet, same contract as Clawd/the dog above)

A cute cartoon leopard gecko for Kai — a wandering pet, built to the **same contract** as the
lobster and dog above (return a THREE.Group, feet at y=0, FORWARD is +z, own MeshStandardMaterial
with flatShading, ~40 parts, end with `g.scale.setScalar(~0.85)`; low-poly, board-game-toy look).

Leopard gecko specifics:
- Long low body, four splayed short legs, a **fat tapering tail** (they store fat there), a
  rounded snout with a wide friendly mouth and two big dark eyes on the sides of the head.
- Sandy-yellow base (`0xE8C15A`-ish) with darker leopard **spots** (a scatter of small dark
  patches — a handful of little boxes/spheres on the back is enough; do not overdo it).
- A slow side-to-side amble; no articulated parts required, but if you add a moving part put a
  gentle **tail sway** on `g.userData.tail` (single mesh, pivot at the hips) — the engine can
  wag it. No claws.
- Cute over accurate. It should read as a friendly gecko from across the room.

Return it as its own function (any name). I'll wire it in as a pet named "Pickle" (or tell me
Kai's name for it) and add a **Friday reminder to buy crickets** — on Fridays the gecko shows a
🦗 note over its head and its card says "Crickets today — Kai's gecko needs feeding."
