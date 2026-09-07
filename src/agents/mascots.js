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

function createClawd() {
  const g = new THREE.Group()
  const mat = (color) => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.78,
    metalness: 0.02,
    flatShading: true
  })
  const shell = mat(0xc7402f)
  const highlight = mat(0xe15b42)
  const joint = mat(0x79291f)
  const black = mat(0x151b20)
  const white = mat(0xffeed8)

  const mesh = (parent, geometry, material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geometry, material)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    parent.add(m)
    return m
  }
  const oval = (rx, ry, rz) => {
    const geometry = new THREE.SphereGeometry(1, 10, 7)
    geometry.scale(rx, ry, rz)
    return geometry
  }

  // Rounded shell, pitched slightly toward the face.
  const body = mesh(g, oval(0.27, 0.23, 0.34), shell, 0, 0.39, -0.08)
  body.rotation.x = 0.12
  mesh(g, oval(0.235, 0.115, 0.29), joint, 0, 0.27, -0.075)

  // The head mesh owns its face, stalks, and antennae.
  const headGeometry = oval(0.245, 0.215, 0.24)
  headGeometry.translate(0, 0.06, 0.1)
  const head = mesh(g, headGeometry, highlight, 0, 0.43, 0.16)
  g.userData.head = head

  for (const s of [-1, 1]) {
    const stalkGeometry = new THREE.CylinderGeometry(0.04, 0.055, 0.2, 7)
    stalkGeometry.translate(0, 0.1, 0)
    const stalk = mesh(head, stalkGeometry, shell, s * 0.13, 0.2, 0.17)
    stalk.rotation.z = -s * 0.22

    mesh(stalk, oval(0.065, 0.074, 0.063), black, 0, 0.22, 0.012)
    mesh(stalk, oval(0.019, 0.021, 0.012), white, -0.015, 0.242, 0.066)

    // One curved primitive per antenna, sweeping upward and backward.
    const antennaGeometry = new THREE.TorusGeometry(
      0.32, 0.018, 5, 12, 1.65
    )
    antennaGeometry.translate(-0.32, 0, 0)
    antennaGeometry.rotateY(-Math.PI / 2)
    const antenna = mesh(
      head, antennaGeometry, joint, s * 0.18, 0.17, 0.06
    )
    antenna.rotation.y = s * 0.28
  }

  // Six short walking legs terminate above the ground plane.
  for (const s of [-1, 1]) {
    for (const z of [-0.26, -0.055, 0.15]) {
      const legGeometry = new THREE.ConeGeometry(0.065, 0.32, 6)
      legGeometry.translate(0, 0.16, 0)
      legGeometry.rotateZ(s * 2.48)
      mesh(g, legGeometry, shell, s * 0.19, 0.3, z)
    }
  }

  // Tail root is a single mesh with its geometry offset from the rump pivot.
  const tailGeometry = oval(0.205, 0.12, 0.135)
  tailGeometry.translate(0, -0.025, -0.09)
  const tail = mesh(g, tailGeometry, shell, 0, 0.37, -0.31)
  g.userData.tail = tail

  // Child segments follow the root mesh through the entire wag.
  mesh(tail, oval(0.181, 0.103, 0.055), joint, 0, -0.027, -0.178)
  mesh(tail, oval(0.17, 0.105, 0.115), shell, 0, -0.005, -0.235)
  mesh(tail, oval(0.146, 0.087, 0.048), joint, 0, 0.013, -0.307)
  mesh(tail, oval(0.135, 0.088, 0.095), highlight, 0, 0.045, -0.36)

  // Three broad fan lobes finish the upward-curving tail.
  for (const s of [-1, 0, 1]) {
    const fanGeometry = oval(0.09, 0.045, 0.115)
    fanGeometry.translate(0, 0, -0.07)
    const fan = mesh(tail, fanGeometry, shell, s * 0.065, 0.08, -0.39)
    fan.rotation.y = -s * 0.48
    fan.rotation.x = 0.24
  }

  // Forward-reaching arms and two independent claw assemblies.
  g.userData.claws = []
  for (const s of [-1, 1]) {
    const armGeometry = oval(0.09, 0.09, 0.205)
    const arm = mesh(g, armGeometry, joint, s * 0.285, 0.35, 0.25)
    arm.rotation.y = s * 0.5

    const claw = new THREE.Group()
    claw.position.set(s * 0.405, 0.37, 0.42)
    claw.rotation.y = s * 0.18
    g.add(claw)

    // Rounded palm and fixed lower finger.
    mesh(claw, oval(0.145, 0.115, 0.18), shell, 0, 0, 0.08)
    mesh(claw, oval(0.105, 0.06, 0.17), highlight, 0, -0.065, 0.245)

    // Offset geometry puts the opening hinge at the jaw's rear.
    // Engine: jaw.rotation.x = -open; negative X lifts the +Z tip.
    const jawGeometry = oval(0.12, 0.07, 0.2)
    jawGeometry.translate(0, 0.015, 0.18)
    const jaw = mesh(claw, jawGeometry, highlight, 0, 0.075, 0.025)
    claw.userData.jaw = jaw
    g.userData.claws.push(claw)
  }

  g.scale.setScalar(0.85)
  return g
}

function createColonyDog() {
  const g = new THREE.Group()
  const mat = (color) => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.82,
    metalness: 0.01,
    flatShading: true
  })
  const tan = mat(0xc48b52)
  const cream = mat(0xefcf96)
  const brown = mat(0x65402d)
  const black = mat(0x192026)
  const collarMaterial = mat(0x348f98)
  const white = mat(0xfff5dc)

  const mesh = (parent, geometry, material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geometry, material)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    parent.add(m)
    return m
  }
  const oval = (rx, ry, rz) => {
    const geometry = new THREE.SphereGeometry(1, 10, 7)
    geometry.scale(rx, ry, rz)
    return geometry
  }

  // Low barrel body and broad cream chest.
  mesh(g, oval(0.29, 0.285, 0.435), tan, 0, 0.385, -0.12)
  mesh(g, oval(0.215, 0.22, 0.15), cream, 0, 0.4, 0.2)

  // Four sturdy, flat-bottomed paws.
  for (const x of [-0.185, 0.185]) {
    for (const z of [-0.395, 0.16]) {
      mesh(
        g,
        new THREE.CylinderGeometry(0.09, 0.12, 0.28, 8),
        tan,
        x, 0.14, z
      )
    }
  }

  // Collar wraps the forward neck.
  mesh(
    g,
    new THREE.TorusGeometry(0.205, 0.035, 6, 12),
    collarMaterial,
    0, 0.48, 0.265
  )

  // Neck-pivoted head owns all facial features.
  const headGeometry = oval(0.255, 0.245, 0.255)
  headGeometry.translate(0, 0.1, 0.065)
  const head = mesh(g, headGeometry, tan, 0, 0.52, 0.275)
  g.userData.head = head

  // Rounded muzzle, oversized nose, and bright forward-facing eyes.
  mesh(head, oval(0.18, 0.115, 0.185), cream, 0, 0.025, 0.29)
  mesh(head, oval(0.105, 0.075, 0.065), black, 0, 0.07, 0.47)
  for (const s of [-1, 1]) {
    mesh(head, oval(0.048, 0.061, 0.035), black, s * 0.125, 0.18, 0.285)
    mesh(head, oval(0.014, 0.017, 0.012), white, s * 0.125 - 0.01, 0.201, 0.315)

    // Floppy ears are attached to the head and hang from their roots.
    const earGeometry = oval(0.1, 0.2, 0.115)
    earGeometry.translate(0, -0.135, 0)
    const ear = mesh(head, earGeometry, brown, s * 0.235, 0.2, 0.035)
    ear.rotation.z = s * 0.16
    ear.rotation.x = -0.15
  }

  // Single tail mesh: base at the rump, tip rising toward -Z.
  // Engine: tail.rotation.y = wag; the authored upward angle is in geometry.
  const tailGeometry = new THREE.ConeGeometry(0.09, 0.4, 8)
  tailGeometry.translate(0, 0.2, 0)
  tailGeometry.rotateX(-1.05)
  const tail = mesh(g, tailGeometry, brown, 0, 0.45, -0.44)
  g.userData.tail = tail

  g.scale.setScalar(0.85)
  return g
}

const KINDS = {
  dog: { build: createColonyDog, name: "Ja'Barkus", intro: "I'm Ja'Barkus, the house dog. I have no job on the map — I just trot between the hexes and wag at everyone. Good boy." },
  lobster: { build: createClawd, name: 'Clawd', intro: "I'm Clawd, the mascot. Red, chunky, mostly claws. I patrol the paths and pinch at nothing in particular. Named after the feral one in the cluster." },
}

/** A little name that floats over a pet's head, always facing the camera. */
function makeNameplate(text) {
  const cw = 256
  const ch = 72
  const cv = document.createElement('canvas')
  cv.width = cw
  cv.height = ch
  const ctx = cv.getContext('2d')
  ctx.font = "600 34px system-ui, -apple-system, 'Segoe UI', sans-serif"
  ctx.textBaseline = 'middle'
  const w = Math.min(cw - 12, ctx.measureText(text).width + 40)
  const x = (cw - w) / 2
  ctx.fillStyle = 'rgba(8,10,20,0.72)'
  const r = 20
  ctx.beginPath()
  ctx.moveTo(x + r, 8)
  ctx.arcTo(x + w, 8, x + w, ch - 8, r)
  ctx.arcTo(x + w, ch - 8, x, ch - 8, r)
  ctx.arcTo(x, ch - 8, x, 8, r)
  ctx.arcTo(x, 8, x + w, 8, r)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.fillText(text, cw / 2, ch / 2 + 1)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }))
  sp.scale.set(0.9, 0.9 * ch / cw, 1)
  sp.renderOrder = 12
  return sp
}

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
    const spec = KINDS[kind]
    if (!spec) return
    const mesh = spec.build()
    this.group.add(mesh)
    const nameplate = makeNameplate(spec.name)
    this.group.add(nameplate)
    const m = {
      kind,
      name: spec.name,
      intro: spec.intro,
      nameplate,
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
      if (m.nameplate) m.nameplate.position.set(m.pos.x, m.mesh.position.y + 1.15, m.pos.z)
      // Character: the dog wags, the lobster works its claws.
      if (m.kind === 'dog' && m.mesh.userData.tail) m.mesh.userData.tail.rotation.y = Math.sin(elapsed * 9 + m.phase) * 0.6
      if (m.kind === 'lobster' && m.mesh.userData.claws) {
        const open = (Math.sin(elapsed * 3 + m.phase) * 0.5 + 0.5) * 0.5
        for (const claw of m.mesh.userData.claws) claw.userData.jaw.rotation.x = -open
      }
    }
  }

  /** The pet nearest the pointer, in screen space, or null. Head-height, like the astronaut picker. */
  pick(camera, ndcX, ndcY, aspect, maxDist = 0.06) {
    let best = null
    let bd = maxDist
    const v = this._tmp
    for (const m of this.list) {
      v.set(m.mesh.position.x, m.mesh.position.y + 0.8, m.mesh.position.z).project(camera)
      if (v.z > 1) continue
      const d = Math.hypot((v.x - ndcX) * aspect, v.y - ndcY)
      if (d < bd) {
        bd = d
        best = m
      }
    }
    return best
  }

  setVisible(on) {
    this.group.visible = on
  }
}
