/**
 * Bot Farm Family — five South Park-style people (Blake, Misa, Kai, Maya, Ema) with real
 * photographic faces on camera-facing sprites and low-poly walking bodies. From ChatGPT's
 * Bot_Farm_Family batch; converted here from its globalThis IIFE into an ES module that uses
 * the colony's own THREE and loads the face PNGs from /family/ (served out of public/).
 *
 * Each builder returns a THREE.Group with the mascot hooks the engine already drives:
 *   userData.arms / userData.legs  — shoulder/hip pivots, rotate .x for the walk
 *   userData.expressions           — { name: [Sprite] }, flip .visible to change the face
 *   userData.head                  — invisible pivot carrying the face sprites
 *   userData.displayName / intro   — name tag + click-to-meet line
 *   userData.ready                 — resolves once the five face images decode
 */
import * as THREE from 'three'

const EXPRESSIONS = ['neutral', 'happy', 'surprised', 'annoyed', 'sleepy']

const PEOPLE = {
  blake: { name: 'Blake', shirt: 0x159daf, skin: 0xe4ae88, height: 0.88, center: 1.245, intro: 'I could do the chore… or spend six hours automating it.' },
  misa: { name: 'Misa', shirt: 0xf4e8ce, skin: 0xe5ba95, height: 1.04, center: 1.16, intro: "Let's get this finished, then we can relax." },
  kai: { name: 'Kai', shirt: 0x292b30, skin: 0xe3b08a, height: 0.96, center: 1.22, intro: "Give me a mission. I'll handle it." },
  maya: { name: 'Maya', shirt: 0x63cc42, skin: 0xe7b58e, height: 1.08, center: 1.14, intro: "I've got a plan. Can we make it fun?" },
  ema: { name: 'Ema', shirt: 0x9cdeb7, skin: 0xe8bb95, height: 1.08, center: 1.14, intro: 'Okay, but do I get a star for this?' },
}

export const FAMILY_IDS = Object.keys(PEOPLE)

let assetBase = '/family/'
export function configure({ assetBase: base } = {}) {
  if (base) assetBase = base.replace(/\/?$/, '/')
}

const cache = new Map()
function textureFor(id, expression) {
  const url = `${assetBase}${id}-${expression}.png`
  if (!cache.has(url)) {
    cache.set(
      url,
      new Promise((resolve, reject) => {
        new THREE.TextureLoader().load(
          url,
          (t) => {
            t.colorSpace = THREE.SRGBColorSpace
            t.minFilter = THREE.LinearFilter
            t.magFilter = THREE.LinearFilter
            t.generateMipmaps = false
            // The face PNGs are 384x512 — not power-of-two. Mobile GL renders an NPOT texture
            // blank unless it's clamped with no mipmaps, which is exactly why the heads showed
            // on desktop but vanished on the phone. Clamp both axes.
            t.wrapS = THREE.ClampToEdgeWrapping
            t.wrapT = THREE.ClampToEdgeWrapping
            resolve(t)
          },
          undefined,
          () => {
            cache.delete(url)
            reject(new Error(`family texture failed: ${id}/${expression}`))
          }
        )
      })
    )
  }
  return cache.get(url)
}

/** Optional: warm every face before spawning, so nobody pops in blank. */
export function preload() {
  return Promise.all(FAMILY_IDS.flatMap((id) => EXPRESSIONS.map((e) => textureFor(id, e).catch(() => null))))
}

export function build(id) {
  const p = PEOPLE[id]
  if (!p) return null
  const g = new THREE.Group()
  g.name = `family-${id}`
  const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.02, flatShading: true })
  const skin = mat(p.skin)
  const shirt = mat(p.shirt)
  const trousers = mat(0x293e61)
  const shoe = mat(0x23272c)
  const add = (parent, geo, material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, material)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    parent.add(m)
    return m
  }
  const oval = (x, y, z) => {
    const geo = new THREE.SphereGeometry(1, 12, 8)
    geo.scale(x, y, z)
    return geo
  }

  const torso = add(g, new THREE.CylinderGeometry(0.225, 0.275, 0.43, 8), shirt, 0, 0.575, 0)
  torso.scale.z = 0.68
  add(g, new THREE.CylinderGeometry(0.075, 0.085, 0.16, 8), skin, 0, 0.85, 0)

  const legs = []
  const arms = []
  for (const s of [-1, 1]) {
    const geo = new THREE.BoxGeometry(0.17, 0.23, 0.16)
    geo.translate(0, -0.115, 0)
    const leg = add(g, geo, trousers, s * 0.12, 0.34, 0)
    leg.userData.restY = 0.34
    add(leg, new THREE.BoxGeometry(0.195, 0.11, 0.25), shoe, 0, -0.285, 0.035)
    legs.push(leg)
    const sleeve = new THREE.CylinderGeometry(0.077, 0.083, 0.225, 8)
    sleeve.translate(0, -0.1125, 0)
    const arm = add(g, sleeve, shirt, s * 0.29, 0.755, 0)
    add(arm, oval(0.076, 0.095, 0.072), skin, 0, -0.275, 0.014)
    arms.push(arm)
  }

  // Invisible mesh pivot preserves the head-pivot contract; the photographic faces are
  // camera-facing sprites hung on it, so the face reads from the map angle no matter which
  // way the body walks.
  const head = add(g, new THREE.BoxGeometry(0.01, 0.01, 0.01), new THREE.MeshBasicMaterial({ visible: false }), 0, 0.85, 0)
  head.name = 'head-pivot'
  head.castShadow = false
  head.receiveShadow = false
  const headFaces = new THREE.Group()
  headFaces.name = 'expression-faces'
  head.add(headFaces)

  const maps = {}
  const pending = []
  for (const e of EXPRESSIONS) {
    const material = new THREE.SpriteMaterial({ transparent: true, alphaTest: 0.12, depthTest: true, depthWrite: true, toneMapped: false })
    const face = new THREE.Sprite(material)
    face.name = `${id}-${e}`
    face.position.set(0, p.center - 0.85, 0.075)
    face.scale.set(p.height * 0.75, p.height, 1)
    face.visible = e === 'neutral'
    headFaces.add(face)
    maps[e] = [face]
    pending.push(
      textureFor(id, e)
        .then((t) => {
          material.map = t
          material.needsUpdate = true
        })
        // A single face that fails to load must never leave the whole head hidden.
        .catch(() => {})
    )
  }
  // Hold the faces hidden until they decode, then reveal with the requested state intact.
  headFaces.visible = false

  g.userData = {
    arms,
    legs,
    head,
    expressions: maps,
    displayName: p.name,
    intro: p.intro,
    personId: id,
    expression: 'neutral',
    ready: Promise.all(pending).then(() => {
      headFaces.visible = true
      return g
    }),
  }
  g.userData.setExpression = (name) => setExpression(g, name)

  g.scale.setScalar(0.85)
  return g
}

export function setExpression(g, name) {
  const ex = g.userData.expressions
  if (!ex?.[name]) return
  for (const [key, items] of Object.entries(ex)) for (const o of items) o.visible = key === name
  g.userData.expression = name
}

export const createBlake = () => build('blake')
export const createMisa = () => build('misa')
export const createKai = () => build('kai')
export const createMaya = () => build('maya')
export const createEma = () => build('ema')
