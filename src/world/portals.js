import * as THREE from 'three'

/**
 * The Brain hex's gateway ring: eight portals that beam you out to the worlds of the JARVIS
 * Brain, Star-Trek style. The slugs are live pages on brain.kcproto.com; the labels and colors
 * are ours. Edit this list to change where the portals go — it's the whole configuration.
 */
export const BRAIN_BASE = 'https://brain.kcproto.com/'
// The eight departments of the School of Brain. Each portal beams straight to that category
// (the ?dept= deep link focuses the school on its island). Colors match the school's own.
export const BRAIN_PORTALS = [
  { label: '⚗️ Science', slug: 'school?dept=science', color: 0x4f7ec9 },
  { label: '⚙️ Machines', slug: 'school?dept=machines', color: 0xc97f4f },
  { label: '🏛️ History', slug: 'school?dept=history', color: 0xb8942a },
  { label: '🌿 Life', slug: 'school?dept=life', color: 0x4f9a63 },
  { label: '🍳 Kitchen', slug: 'school?dept=kitchen', color: 0xc96442 },
  { label: '📚 Letters', slug: 'school?dept=letters', color: 0x8b5cc9 },
  { label: '🛠️ Ops', slug: 'school?dept=ops', color: 0x3fa8a0 },
  { label: '🔒 Restricted', slug: 'school?dept=restricted', color: 0xb8493f },
]

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** A small floating name tag over a portal, drawn to a canvas so it needs no font assets. */
function labelSprite(text) {
  const font = 44
  const c = document.createElement('canvas')
  let ctx = c.getContext('2d')
  ctx.font = `600 ${font}px system-ui, sans-serif`
  const pad = 18
  c.width = Math.ceil(ctx.measureText(text).width) + pad * 2
  c.height = font + pad * 2
  ctx = c.getContext('2d')
  ctx.font = `600 ${font}px system-ui, sans-serif`
  ctx.fillStyle = 'rgba(8,10,18,0.72)'
  roundRect(ctx, 0, 0, c.width, c.height, 16)
  ctx.fill()
  ctx.fillStyle = '#eef1ff'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(text, c.width / 2, c.height / 2)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }))
  const h = 0.6
  s.scale.set((c.width / c.height) * h, h, 1)
  return s
}

export class BrainPortals {
  constructor(scene) {
    this.group = new THREE.Group()
    this.group.visible = false
    scene.add(this.group)
    this.portals = []
    const R = 5.4 // ring radius around the Brain hex's centre
    BRAIN_PORTALS.forEach((def, i) => {
      const a = (i / BRAIN_PORTALS.length) * Math.PI * 2
      const g = new THREE.Group()
      g.position.set(Math.cos(a) * R, 0, Math.sin(a) * R)
      g.rotation.y = -a - Math.PI / 2 // stand square-on to the ring's centre
      const col = new THREE.Color(def.color)
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.82, 0.1, 12, 40),
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.9, roughness: 0.4, metalness: 0.2 })
      )
      ring.position.y = 1.05
      g.add(ring)
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(0.76, 40),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false })
      )
      disc.position.y = 1.05
      g.add(disc)
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.92, 1.02, 0.12, 24),
        new THREE.MeshStandardMaterial({ color: 0x14151b, emissive: col, emissiveIntensity: 0.25, roughness: 0.7 })
      )
      pad.position.y = 0.06
      g.add(pad)
      const label = labelSprite(def.label)
      label.position.y = 2.25
      g.add(label)
      g.userData = { def, ring, disc, label }
      this.group.add(g)
      this.portals.push(g)
    })
  }

  /** Sit the ring on the Brain hex; called with its centre each frame so it follows a moved hex. */
  layout(center) {
    if (!center) {
      this.group.visible = false
      return
    }
    this.group.visible = true
    this.group.position.set(center.x, 0, center.z)
  }

  update(dt, elapsed, groundAt) {
    if (!this.group.visible) return
    for (let i = 0; i < this.portals.length; i++) {
      const g = this.portals[i]
      g.position.y = groundAt ? groundAt(this.group.position.x + g.position.x, this.group.position.z + g.position.z) : 0
      g.userData.disc.rotation.z += dt * 0.6
      g.userData.disc.material.opacity = 0.26 + Math.sin(elapsed * 2 + i) * 0.12
      g.userData.ring.rotation.z = Math.sin(elapsed * 0.8 + i) * 0.05
    }
  }

  /** The portal nearest the pointer in screen space, or null — mirrors the mascot picker. */
  pick(camera, ndcX, ndcY, aspect, maxDist = 0.07) {
    if (!this.group.visible) return null
    let best = null
    let bd = maxDist
    const v = new THREE.Vector3()
    for (const g of this.portals) {
      v.set(this.group.position.x + g.position.x, g.position.y + 1.05, this.group.position.z + g.position.z).project(camera)
      if (v.z > 1) continue
      const d = Math.hypot((v.x - ndcX) * aspect, v.y - ndcY)
      if (d < bd) {
        bd = d
        best = g
      }
    }
    return best ? { def: best.userData.def, url: BRAIN_BASE + best.userData.def.slug } : null
  }

  dispose() {
    this.group.traverse((o) => {
      o.geometry?.dispose?.()
      if (o.material) {
        o.material.map?.dispose?.()
        o.material.dispose?.()
      }
    })
    this.group.removeFromParent()
  }
}
