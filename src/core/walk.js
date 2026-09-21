/**
 * Drop in and walk. The orbit rig is for looking at the campus; this is for being in it.
 *
 * WASD (or the arrows) to move, drag to look, shift to jog, and on a phone a thumbstick in
 * the bottom-left corner with a drag anywhere else to look. Refused steps come from the same
 * navigation grid the crew walks on, so you cannot walk through a hex's buildings, and the
 * ground under you is the planet's own height, hills and all.
 */
import * as THREE from 'three'

const EYE = 1.68
const WALK = 3.2
const JOG = 6.4
const ACCEL = 14
const LOOK = 0.0032

export class WalkMode {
  constructor({ engine, rig, campus, nav, hud }) {
    this.engine = engine
    this.rig = rig
    this.campus = campus
    this.nav = nav
    this.hud = hud
    this.active = false
    this.pos = new THREE.Vector3()
    this.vel = new THREE.Vector3()
    this.yaw = 0
    this.pitch = -0.05
    this.keys = new Set()
    this.stick = null
    this.look = null
    this.bob = 0
    this._v = new THREE.Vector3()
    this._bind()
  }

  _bind() {
    const canvas = this.engine.canvas
    addEventListener('keydown', (e) => {
      if (!this.active) return
      if (e.target && /input|textarea/i.test(e.target.tagName)) return
      this.keys.add(e.code)
      // Escape closes an open chat first; a second press leaves walk mode
      if (e.code === 'Escape' && !this.hud?.chatOpen) this.exit()
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault()
    })
    addEventListener('keyup', (e) => this.keys.delete(e.code))
    addEventListener('blur', () => this.keys.clear())

    canvas.addEventListener('pointerdown', (e) => {
      if (!this.active) return
      const r = canvas.getBoundingClientRect()
      // bottom-left corner is the thumbstick on a touch screen; anywhere else looks around
      if (e.pointerType === 'touch' && e.clientX - r.left < r.width * 0.42 && e.clientY - r.top > r.height * 0.55) {
        this.stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 }
      } else {
        this.look = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 }
      }
    })
    canvas.addEventListener('pointermove', (e) => {
      if (!this.active) return
      if (this.stick && e.pointerId === this.stick.id) {
        this.stick.dx = THREE.MathUtils.clamp((e.clientX - this.stick.x0) / 60, -1, 1)
        this.stick.dy = THREE.MathUtils.clamp((e.clientY - this.stick.y0) / 60, -1, 1)
        return
      }
      if (this.look && e.pointerId === this.look.id) {
        const dx = e.clientX - this.look.x
        const dy = e.clientY - this.look.y
        this.look.x = e.clientX
        this.look.y = e.clientY
        this.look.moved += Math.abs(dx) + Math.abs(dy)
        this.travel = null
        this.yaw -= dx * LOOK
        this.pitch = THREE.MathUtils.clamp(this.pitch - dy * LOOK, -1.2, 1.0)
      }
    })
    const up = (e) => {
      if (this.stick && e.pointerId === this.stick.id) this.stick = null
      if (this.look && e.pointerId === this.look.id) this.look = null
    }
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
  }

  /**
   * Walk yourself over to something you clicked. Stops `stop` metres short, facing it, and
   * calls `onArrive`. Any key or drag of your own cancels the trip — you are still driving.
   */
  goTo(x, z, { stop = 2.3, onArrive = null } = {}) {
    if (!this.active) return
    // route round the buildings the same way the crowd does; a straight line gets stuck on corners
    let path = null
    try {
      path = this.nav?.findPath?.(this.pos.x, this.pos.z, x, z) || null
    } catch {
      path = null
    }
    this.travel = { x, z, stop, onArrive, path, at: 0, stall: 0, best: Infinity }
  }

  cancelTravel() {
    this.travel = null
  }

  /** True while the pointer is being dragged to look, so a click is not also a pick. */
  get dragging() {
    return Boolean(this.look && this.look.moved > 6)
  }

  enter() {
    if (this.active) return
    this.saved = this.rig.pose()
    const t = this.rig.target
    this.pos.set(t.x, 0, t.z)
    // face the way the camera was already facing
    this.yaw = Math.atan2(this.engine.camera.position.x - t.x, this.engine.camera.position.z - t.z) + Math.PI
    this.pitch = -0.08
    this.vel.set(0, 0, 0)
    this.travel = null
    this.active = true
    this.rig.unfollow?.()
    this.engine.canvas.style.cursor = 'grab'
    this.hud?.setWalk?.(true)
  }

  exit() {
    if (!this.active) return
    this.active = false
    this.keys.clear()
    this.stick = null
    this.look = null
    this.engine.canvas.style.cursor = ''
    this.hud?.setWalk?.(false)
    // come back up to the view you dropped from, above where you walked to
    const pose = { ...(this.saved || {}), x: this.pos.x, z: this.pos.z }
    this.rig.setHome(pose, { jump: false })
    this.rig.resetView?.()
  }

  toggle() {
    if (this.active) this.exit()
    else this.enter()
  }

  groundAt(x, z) {
    return this.campus?.groundAt ? this.campus.groundAt(x, z) : 0
  }

  /** Can a person stand here? The nav grid knows buildings, trees and water. */
  _free(x, z) {
    if (this.nav?.isBlocked?.(x, z)) return false
    return true
  }

  update(dt) {
    if (!this.active) return
    dt = Math.min(dt, 0.05)
    const k = this.keys
    let fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0)
    let side = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0)
    if (this.stick) {
      fwd += -this.stick.dy
      side += this.stick.dx
    }
    const len = Math.hypot(fwd, side) || 1
    let speed = k.has('ShiftLeft') || k.has('ShiftRight') ? JOG : WALK

    // travelling to something you clicked: steer yourself until you are there
    if (this.travel) {
      if (Math.abs(fwd) + Math.abs(side) > 0.01) this.travel = null
      else {
        const t = this.travel
        const dx = t.x - this.pos.x
        const dz = t.z - this.pos.z
        const left = Math.hypot(dx, dz)
        // getting no closer for a while means this is as near as the ground allows (someone
        // standing on a stage, say): stop there and count it as arriving if you are close.
        // only count a stall once actually walking: turning to face the target takes a moment,
        // and the first metre of a route can head away from the target
        const turning = t.turning || 0
        if (left < t.best - 0.05) {
          t.best = left
          t.stall = 0
        } else if (!turning) t.stall += dt
        if (left <= t.stop || t.stall > 2.5) {
          const done = t.onArrive
          const near = left < 12
          this.travel = null
          this.vel.set(0, 0, 0)
          if (done && near) done()
        } else {
          // steer at the next waypoint of the route, but measure the trip by the target itself
          let ax = t.x
          let az = t.z
          if (t.path && t.path.length) {
            while (t.at < t.path.length - 1 && Math.hypot(t.path[t.at].x - this.pos.x, t.path[t.at].z - this.pos.z) < 1.4) t.at++
            const wp = t.path[t.at]
            if (wp) {
              ax = wp.x
              az = wp.z
            }
          }
          const want = Math.atan2(ax - this.pos.x, az - this.pos.z)
          let turn = want - this.yaw
          turn = Math.atan2(Math.sin(turn), Math.cos(turn))
          this.yaw += turn * Math.min(1, dt * 5)
          // slow into the last couple of metres, and only walk on once roughly facing it
          t.turning = Math.abs(turn) > 0.7
          speed = Math.min(JOG, Math.max(1.8, left - t.stop)) * (Math.abs(turn) > 1.1 ? 0.35 : 1)
          fwd = 1
          side = 0
        }
      }
    }
    const norm = Math.hypot(fwd, side) || 1
    // The camera looks along (sin yaw, cos yaw), so its right hand is (-cos yaw, sin yaw): the
    // cross of forward with up. This used to move along (cos yaw, -sin yaw), which is its LEFT,
    // so D strafed left and A right (and the phone thumbstick with them). Alan caught it.
    const wantX = ((Math.sin(this.yaw) * fwd - Math.cos(this.yaw) * side) / norm) * speed
    const wantZ = ((Math.cos(this.yaw) * fwd + Math.sin(this.yaw) * side) / norm) * speed
    const moving = Math.abs(fwd) + Math.abs(side) > 0.01
    void len
    this.vel.x = THREE.MathUtils.damp(this.vel.x, moving ? wantX : 0, ACCEL, dt)
    this.vel.z = THREE.MathUtils.damp(this.vel.z, moving ? wantZ : 0, ACCEL, dt)

    // step, sliding along whatever refuses the step so corners don't trap you. If you somehow
    // start inside something (dropped in on a building, walked onto a stage), collision is off
    // until you are clear, so you can always walk out.
    const nx = this.pos.x + this.vel.x * dt
    const nz = this.pos.z + this.vel.z * dt
    if (!this._free(this.pos.x, this.pos.z)) {
      this.pos.x = nx
      this.pos.z = nz
    } else if (this._free(nx, nz)) {
      this.pos.x = nx
      this.pos.z = nz
    } else if (this._free(nx, this.pos.z)) {
      this.pos.x = nx
      this.vel.z = 0
    } else if (this._free(this.pos.x, nz)) {
      this.pos.z = nz
      this.vel.z = this.vel.z
      this.vel.x = 0
    } else {
      this.vel.set(0, 0, 0)
    }

    const groundY = this.groundAt(this.pos.x, this.pos.z)
    const sp = Math.hypot(this.vel.x, this.vel.z)
    this.bob += dt * sp * 2.2
    const cam = this.engine.camera
    cam.position.set(this.pos.x, groundY + EYE + Math.sin(this.bob) * 0.035 * Math.min(1, sp / WALK), this.pos.z)
    this._v.set(cam.position.x + Math.sin(this.yaw) * Math.cos(this.pitch), cam.position.y + Math.sin(this.pitch), cam.position.z + Math.cos(this.yaw) * Math.cos(this.pitch))
    cam.lookAt(this._v)
    // keep the rig's own idea of where it is looking in step, so leaving walk mode is smooth
    this.rig.target.set(this.pos.x, 0, this.pos.z)
  }
}
