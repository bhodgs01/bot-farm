/**
 * Fit the robot crew's hardware to the rig, and print the numbers to paste into
 * `LIMB_FIT` / `FOOT_FIT` in src/agents/astronauts.js.
 *
 *   node tools/fit-hardware.mjs
 *
 * The parts in src/agents/robot-parts.js are authored bone-local, but they were written without
 * the rest pose in hand, so their length along each limb and their direction along it are both
 * guesses — and both came back wrong. This reads crew.glb, works out which mannequin vertices
 * each bone actually owns, expresses that flesh in the bone's own frame, and solves the mirror,
 * scale and offset that lands each plate on it.
 *
 * The flesh is the target rather than the bone-to-child span, because the two differ a lot: the
 * foot bone reaches its toe joint in 0.149 rig units while the foot itself is 0.33 long, and a
 * foot fitted to the shorter number is buried in the ground.
 *
 * Re-run this whenever crew.glb or robot-parts.js changes.
 */
import * as THREE from 'three'
import { readFileSync } from 'fs'

const { PARTS, MANIFEST } = await import('../src/agents/robot-parts.js')

// ── the glb, by hand ────────────────────────────────────────────────────────────────────
// GLTFLoader wants a DOM, so the container is unpacked directly. Only the rest pose and the
// skin weights are wanted, both of which are plain accessors.
const buf = readFileSync(new URL('../public/assets/crew.glb', import.meta.url))
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
let json
let binOff
for (let o = 12; o < buf.byteLength; ) {
  const len = dv.getUint32(o, true)
  const type = dv.getUint32(o + 4, true)
  if (type === 0x4e4f534a) json = JSON.parse(buf.slice(o + 8, o + 8 + len).toString('utf8'))
  if (type === 0x004e4942) {
    binOff = o + 8
    break
  }
  o += 8 + len
}

const TYPES = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }
const COMPS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }

/** One accessor, de-interleaved. Byte strides are respected; sparse accessors are not used here. */
function accessor(i) {
  const a = json.accessors[i]
  const view = json.bufferViews[a.bufferView]
  const Arr = TYPES[a.componentType]
  const n = COMPS[a.type]
  const size = Arr.BYTES_PER_ELEMENT
  const base = binOff + (view.byteOffset || 0) + (a.byteOffset || 0)
  const stride = view.byteStride || n * size
  const out = new Arr(a.count * n)
  for (let k = 0; k < a.count; k++) {
    for (let c = 0; c < n; c++) out[k * n + c] = new Arr(buf.buffer, buf.byteOffset + base + k * stride + c * size, 1)[0]
  }
  return out
}

// Every bone's rest matrix, in the mesh's own space.
const rest = new Map()
const nameOf = []
function walk(i, parent) {
  const n = json.nodes[i]
  const m = new THREE.Matrix4()
  if (n.matrix) m.fromArray(n.matrix)
  else
    m.compose(
      new THREE.Vector3().fromArray(n.translation || [0, 0, 0]),
      new THREE.Quaternion().fromArray(n.rotation || [0, 0, 0, 1]),
      new THREE.Vector3().fromArray(n.scale || [1, 1, 1])
    )
  m.premultiply(parent)
  nameOf[i] = n.name
  if (n.name) rest.set(n.name, m)
  for (const c of n.children || []) walk(c, m)
}
for (const s of json.scenes[0].nodes) walk(s, new THREE.Matrix4())
const jointName = json.skins[0].joints.map((j) => nameOf[j])

// ── what the mannequin occupies around each bone ────────────────────────────────────────
// A vertex is credited to whichever bone pulls hardest on it. Blend weights would smear each
// box into its neighbours, and a hard assignment is what "which bone wears this" means.
const owned = new Map()
for (const mesh of json.meshes) {
  for (const prim of mesh.primitives) {
    if (prim.attributes.JOINTS_0 === undefined) continue
    const pos = accessor(prim.attributes.POSITION)
    const joints = accessor(prim.attributes.JOINTS_0)
    const weights = accessor(prim.attributes.WEIGHTS_0)
    for (let k = 0; k < pos.length / 3; k++) {
      let best = 0
      let bone = -1
      for (let c = 0; c < 4; c++) {
        if (weights[k * 4 + c] > best) {
          best = weights[k * 4 + c]
          bone = joints[k * 4 + c]
        }
      }
      const name = jointName[bone]
      if (!name) continue
      if (!owned.has(name)) owned.set(name, [])
      owned.get(name).push(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2])
    }
  }
}

/**
 * Each plated bone, with the child bones whose flesh belongs under the same shell — a forearm
 * plate has to cover the wrist too, and a foot pad the toes.
 */
const GROUPS = {
  head: ['head'],
  chest: ['chest', 'spine'],
  hips: ['hips'],
  'upperarm.l': ['upperarm.l'],
  'upperarm.r': ['upperarm.r'],
  'lowerarm.l': ['lowerarm.l', 'wrist.l'],
  'lowerarm.r': ['lowerarm.r', 'wrist.r'],
  'hand.l': ['hand.l'],
  'hand.r': ['hand.r'],
  'upperleg.l': ['upperleg.l'],
  'upperleg.r': ['upperleg.r'],
  'lowerleg.l': ['lowerleg.l'],
  'lowerleg.r': ['lowerleg.r'],
  'foot.l': ['foot.l', 'toes.l'],
  'foot.r': ['foot.r', 'toes.r'],
}

const flesh = {}
console.log("\n── the mannequin around each bone, in that bone's own frame (rig units) ──")
for (const [bone, members] of Object.entries(GROUPS)) {
  const inv = new THREE.Matrix4().copy(rest.get(bone)).invert()
  const box = new THREE.Box3()
  let n = 0
  for (const m of members) {
    for (const xyz of [owned.get(m) || []]) {
      for (let k = 0; k < xyz.length; k += 3) {
        box.expandByPoint(new THREE.Vector3(xyz[k], xyz[k + 1], xyz[k + 2]).applyMatrix4(inv))
        n++
      }
    }
  }
  if (!n) {
    console.log(`${bone.padEnd(14)} no vertices — is this bone still in the rig?`)
    continue
  }
  const f = (a, b) => `${a.toFixed(3).padStart(6)}..${b.toFixed(3).padStart(6)}`
  console.log(`${bone.padEnd(14)} x ${f(box.min.x, box.max.x)}  y ${f(box.min.y, box.max.y)}  z ${f(box.min.z, box.max.z)}   (${n} verts)`)
  flesh[bone] = box
}

// ── the fit ─────────────────────────────────────────────────────────────────────────────
/** How far past the flesh the armour stands, so it reads as bolted on rather than drawn on. */
const PROUD = 0.012
/** The parts that run down a limb, and so need mirroring and fitting along Y. */
const ALONG_LIMB = ['upperArmPlate', 'foreArmPlate', 'handUnit', 'thighPlate', 'shinPlate']

const table = {}
console.log('\n── the fit ──')
console.log('part               mirror & scale   offset y    where the plate lands vs the flesh')
for (const [name, spec] of Object.entries(MANIFEST)) {
  if (!ALONG_LIMB.includes(name.replace(/\.[lr]$/, ''))) continue
  const geo = PARTS[name]()
  geo.computeBoundingBox()
  const a = geo.boundingBox
  const target = flesh[spec.bone]
  const t0 = target.min.y - PROUD
  const t1 = target.max.y + PROUD
  // Authored running the wrong way down the bone: mirroring turns [min,max] into [-max,-min].
  const m0 = -a.max.y
  const m1 = -a.min.y
  const k = (t1 - t0) / (m1 - m0)
  const y = t0 - m0 * k
  table[name] = { k: +k.toFixed(4), y: +y.toFixed(4) }
  console.log(
    `${name.padEnd(17)} y × ${(-k).toFixed(4).padStart(8)}  ${y.toFixed(4).padStart(9)}    ` +
      `${(m0 * k + y).toFixed(3)}..${(m1 * k + y).toFixed(3)}  vs  ${target.min.y.toFixed(3)}..${target.max.y.toFixed(3)}`
  )
}

/**
 * The feet, which are a different problem. They are authored the way a foot sits in the world —
 * sole down at -Y, toe forward at +Z — but the foot bone is not framed that way: it is rolled
 * because the ankle carries the whole angle between shin and sole. Turning the part back through
 * that roll lays the sole flat and points the toe where the toe bone is.
 */
const e = rest.get('foot.l').elements
// World-down, written in the bone's own coordinates, is (-e1, -e5, -e9): the dot of (0,-1,0)
// with each of the bone's three axes. The roll wanted is the one whose Rx takes the part's
// authored down (0,-1,0) onto that, and Rx(t)·(0,-1,0) = (0,-cos t,-sin t), so cos t and sin t
// fall straight out of the Y components of the bone's own Y and Z axes.
//
// Beware of checking this by bounding box alone: the roll is close enough to 45 degrees that
// rolling the wrong way gives a box of almost identical dimensions, lying at right angles to
// the foot. Ask where the sole ends up, not how big the box is.
const rx = Math.atan2(e[9], e[5])
console.log(`\nfoot roll: ${rx.toFixed(4)} rad (${((rx * 180) / Math.PI).toFixed(1)}°)`)
for (const side of ['l', 'r']) {
  const target = flesh[`foot.${side}`]
  const geo = PARTS[`footPad.${side}`]()
  // Sized off the helmet reference, the pad came out almost exactly foot-length on its own;
  // only its width needs opening up to cover the flesh.
  const sx = 1.2
  geo.rotateX(rx).scale(sx, 1, 1)
  geo.computeBoundingBox()
  const a = geo.boundingBox
  const centre = (box) => box.getCenter(new THREE.Vector3())
  const off = centre(target).sub(centre(a))
  const size = a.getSize(new THREE.Vector3())
  const want = target.getSize(new THREE.Vector3())
  console.log(
    `footPad.${side}  roll ${rx.toFixed(4)}  widen ${sx}  offset [${off.toArray().map((v) => v.toFixed(4)).join(', ')}]\n` +
      `            pad ${size.toArray().map((v) => v.toFixed(3)).join(' × ')}  vs flesh ${want.toArray().map((v) => v.toFixed(3)).join(' × ')}`
  )
  table[`footPad.${side}`] = { rx: +rx.toFixed(4), sx, x: +off.x.toFixed(4), y: +off.y.toFixed(4), z: +off.z.toFixed(4) }
}

console.log('\n── paste into LIMB_FIT / FOOT_FIT in src/agents/astronauts.js ──')
console.log(JSON.stringify(table, null, 1))
