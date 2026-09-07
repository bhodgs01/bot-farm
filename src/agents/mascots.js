/**
 * Mascots: a couple of characters wandering the colony when nothing needs you. They carry
 * no data and never raise a hand; they are here so the place feels lived-in. Clawd the
 * lobster ambles the paths, and a dog trots between the hexes.
 *
 * Low-poly on purpose, built from primitives like the buildings. Each picks a spot near a
 * random hex, walks there following the ground, pauses, and picks another. Cheap: a handful
 * of meshes, one straight walk at a time, no navigation grid.
 */
import * as THREE from 'three'

const WALK = 1.5 // m/s, an amble

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.02, flatShading: true, ...opts })
}
function box(group, w, h, d, color, x, y, z, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts))
  m.position.set(x, y, z)
  m.castShadow = true
  group.add(m)
  return m
}

/** A stubby, friendly dog: body, head, snout, ears, four legs, a tail that wags. */
function buildDog() {
  const g = new THREE.Group()
  const tan = 0xb9834f
  const dark = 0x6b4a2b
  box(g, 0.62, 0.34, 0.3, tan, 0, 0.5, 0) // body
  const head = box(g, 0.3, 0.3, 0.28, tan, 0.42, 0.62, 0) // head
  box(g, 0.2, 0.16, 0.16, tan, 0.58, 0.55, 0) // snout
  box(g, 0.06, 0.05, 0.1, 0x222222, 0.69, 0.58, 0) // nose
  for (const s of [-1, 1]) box(g, 0.06, 0.14, 0.1, dark, 0.36, 0.78, 0.1 * s) // ears
  for (const [x, z] of [[0.26, 0.11], [0.26, -0.11], [-0.24, 0.11], [-0.24, -0.11]]) box(g, 0.09, 0.34, 0.09, dark, x, 0.17, z) // legs
  const tail = box(g, 0.08, 0.08, 0.26, tan, -0.34, 0.56, 0)
  tail.geometry.translate(0, 0, -0.13) // pivot at the rump
  tail.position.z = 0.13
  g.userData.tail = tail
  g.userData.head = head
  g.scale.setScalar(0.85)
  return g
}

/** Clawd the lobster: a red segmented body, two big claws, antennae, a tail fan. */
function buildLobster() {
  const g = new THREE.Group()
  const red = 0xc7402f
  const dark = 0x8f2b1e
  for (let i = 0; i < 4; i++) box(g, 0.34 - i * 0.03, 0.2, 0.24, i % 2 ? dark : red, -i * 0.2, 0.24, 0) // segmented body
  box(g, 0.26, 0.24, 0.3, red, 0.24, 0.26, 0) // head
  // Tail fan.
  box(g, 0.14, 0.1, 0.34, dark, -0.78, 0.2, 0)
  for (const s of [-1, 1]) box(g, 0.1, 0.08, 0.16, red, -0.86, 0.2, 0.12 * s)
  // Two arms, each ending in a claw that opens and shuts.
  const claws = []
  for (const s of [-1, 1]) {
    box(g, 0.24, 0.07, 0.07, red, 0.42, 0.24, 0.16 * s) // arm
    const claw = new THREE.Group()
    claw.position.set(0.58, 0.24, 0.2 * s)
    box(claw, 0.18, 0.14, 0.12, red, 0.06, 0, 0)
    const jaw = box(claw, 0.16, 0.06, 0.1, dark, 0.14, 0.05, 0)
    jaw.geometry.translate(-0.08, 0, 0)
    jaw.position.x = 0.22
    claw.userData.jaw = jaw
    g.add(claw)
    claws.push(claw)
  }
  // Eye stalks and antennae.
  for (const s of [-1, 1]) {
    box(g, 0.04, 0.14, 0.04, dark, 0.34, 0.42, 0.07 * s)
    box(g, 0.04, 0.04, 0.04, 0x111111, 0.34, 0.5, 0.07 * s)
    const ant = box(g, 0.02, 0.02, 0.5, dark, 0.4, 0.34, 0.05 * s)
    ant.rotation.x = 0.5 * s
  }
  g.userData.claws = claws
  g.scale.setScalar(0.8)
  return g
}

const KINDS = { dog: buildDog, lobster: buildLobster }

export class Mascots {
  constructor(scene, colony) {
    this.scene = scene
    this.colony = colony
    this.group = new THREE.Group()
    this.group.name = 'mascots'
    scene.add(this.group)
    this.list = []
    this._tmp = new THREE.Vector3()
    this.spawn('dog')
    this.spawn('lobster')
  }

  spawn(kind) {
    const build = KINDS[kind]
    if (!build) return
    const mesh = build()
    this.group.add(mesh)
    const m = {
      kind,
      mesh,
      pos: new THREE.Vector3(0, 0, 0),
      target: new THREE.Vector3(),
      yaw: Math.random() * Math.PI * 2,
      speed: WALK * (0.85 + Math.random() * 0.3),
      pause: 1 + Math.random() * 2,
      phase: Math.random() * Math.PI * 2,
    }
    this._pickTarget(m)
    m.pos.copy(m.target) // start already somewhere on the map
    this._pickTarget(m)
    this.list.push(m)
  }

  /** Somewhere near a random hex, so the wanderers stay where they can be seen. */
  _pickTarget(m) {
    const plots = this.colony.plotOrder
    if (!plots || !plots.length) {
      m.target.set((Math.random() - 0.5) * 30, 0, (Math.random() - 0.5) * 30)
      return
    }
    const plot = plots[(Math.random() * plots.length) | 0]
    const c = plot.middle || plot.center
    m.target.set(c.x + (Math.random() - 0.5) * 6, 0, c.z + (Math.random() - 0.5) * 6)
  }

  update(dt, elapsed) {
    for (const m of this.list) {
      if (m.pause > 0) {
        m.pause -= dt
      } else {
        const to = this._tmp.subVectors(m.target, m.pos)
        to.y = 0
        const dist = to.length()
        if (dist < 0.4) {
          m.pause = 1.5 + Math.random() * 3
          this._pickTarget(m)
        } else {
          to.normalize()
          m.pos.addScaledVector(to, Math.min(dist, m.speed * dt))
          // Ease the heading toward travel, so a turn is a turn and not a snap.
          const want = Math.atan2(to.x, to.z)
          let d = want - m.yaw
          while (d > Math.PI) d -= Math.PI * 2
          while (d < -Math.PI) d += Math.PI * 2
          m.yaw += d * Math.min(1, dt * 6)
        }
      }
      const walking = m.pause <= 0
      const ground = this.colony.groundAt(m.pos.x, m.pos.z)
      m.mesh.position.set(m.pos.x, ground + (walking ? Math.abs(Math.sin(elapsed * 8 + m.phase)) * 0.04 : 0), m.pos.z)
      m.mesh.rotation.y = m.yaw
      // Character: the dog wags, the lobster works its claws.
      if (m.kind === 'dog' && m.mesh.userData.tail) m.mesh.userData.tail.rotation.y = Math.sin(elapsed * 9 + m.phase) * 0.6
      if (m.kind === 'lobster' && m.mesh.userData.claws) {
        const open = (Math.sin(elapsed * 3 + m.phase) * 0.5 + 0.5) * 0.5
        for (const claw of m.mesh.userData.claws) claw.userData.jaw.rotation.y = -open
      }
    }
  }

  setVisible(on) {
    this.group.visible = on
  }
}
