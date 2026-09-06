/**
 * VR: walk the colony at human scale and meet the crew.
 *
 * A thin sidecar over the live scene, the way the Brain's galaxy does it: nothing here
 * changes the desktop path. When a headset is present an ENTER VR button appears; the
 * session starts you standing on the Home hex facing the colony. Left stick walks where
 * you look, right stick snap-turns, point the right laser at an astronaut and pull the
 * trigger to meet them (a floating card: who they are, what they need), grip teleports
 * to where the laser lands. Panels are canvas textures on planes, because the DOM HUD
 * cannot be seen from inside a session.
 *
 * Scale is 1 unit = 1 metre: the astronauts come up to your chest, the hexes are rooms.
 */
import * as THREE from 'three'

const WALK_SPEED = 2.6 // m/s
const SNAP_TURN = Math.PI / 6
const REACH = 14 // how far the laser looks for someone
const PANEL_W = 1.15
const NL = String.fromCharCode(10)

export function installVr({ engine, colony, rig, hud, settings }) {
  const renderer = engine.renderer
  const scene = engine.scene
  const camera = engine.camera
  const state = { active: false, player: null, button: null, supported: false }

  // The player: a group the camera rides in. Locomotion moves the group; the headset
  // moves the camera inside it.
  const player = new THREE.Group()
  player.name = 'vr-player'
  state.player = player

  const controllers = []
  const lasers = []
  const tmpV = new THREE.Vector3()
  const tmpV2 = new THREE.Vector3()
  const tmpQ = new THREE.Quaternion()
  const tmpE = new THREE.Euler()
  const ray = new THREE.Ray()
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  let hovered = null
  let hoverTag = null
  let panel = null
  let helpPanel = null
  let helpUntil = 0
  let snapArmed = true
  let sessionStartedAt = 0

  // ── entry ─────────────────────────────────────────────────────────────────────────
  const wanted = new URLSearchParams(location.search).get('vr') === '1'
  if (!('xr' in navigator)) {
    if (wanted) hud.toast?.('This browser has no WebXR. Open it in the Quest browser.', 'err')
    return state
  }
  renderer.xr.enabled = true
  renderer.xr.setReferenceSpaceType('local-floor')
  navigator.xr
    .isSessionSupported('immersive-vr')
    .then((ok) => {
      state.supported = ok
      if (ok || wanted) addButton()
    })
    .catch(() => {
      if (wanted) addButton()
    })

  // The VR switch lives on the left rail with Home and Orbit; it only appears on a browser
  // that can open a headset session (or when the page is asked for it with ?vr=1).
  function addButton() {
    hud.setVrAvailable?.(true)
    // And a pill at the bottom of the screen: the Quest browser zooms and crops the page
    // in ways that can push the rail out of sight, and this is the one control that must
    // be reachable from a headset.
    const pill = document.createElement('button')
    pill.className = 'btn primary vr-pill'
    pill.textContent = 'Enter VR'
    pill.title = 'Walk the colony in a headset'
    pill.addEventListener('click', () => state.toggle())
    document.body.appendChild(pill)
    state.button = pill
  }
  state.toggle = async () => {
    if (renderer.xr.isPresenting) {
      renderer.xr.getSession()?.end()
      return
    }
    try {
      const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] })
      await renderer.xr.setSession(session)
    } catch (err) {
      hud.toast?.(`VR would not start: ${err.message}`, 'err')
    }
  }

  renderer.xr.addEventListener('sessionstart', onStart)
  renderer.xr.addEventListener('sessionend', onEnd)

  function onStart() {
    state.active = true
    sessionStartedAt = performance.now()
    hud.setVrActive?.(true)
    if (state.button?.textContent !== undefined) state.button.textContent = 'Leave VR'
    // The camera moves into the player group; the rig stops driving it.
    scene.add(player)
    player.add(camera)
    camera.position.set(0, 0, 0)
    camera.quaternion.identity()
    rig.enabled = false
    setupControllers()
    goHome()
    showHelp()
    hud.toast?.('In VR. Left stick walks, right stick turns, trigger meets someone, grip teleports.')
  }

  function onEnd() {
    state.active = false
    hud.setVrActive?.(false)
    if (state.button?.textContent !== undefined) state.button.textContent = 'Enter VR'
    hideHover()
    hidePanel()
    hideHelp()
    for (const c of controllers) player.remove(c)
    controllers.length = 0
    lasers.length = 0
    player.remove(camera)
    scene.remove(player)
    camera.position.set(0, 0, 0)
    camera.quaternion.identity()
    rig.enabled = true
    rig.resetView()
  }

  /** Stand on the Home hex, a step in from its edge, facing the middle of the colony. */
  function goHome() {
    const plot = colony.plots.get('Home') || colony.plotOrder?.[0]
    let x = 0
    let z = 0
    let face = 0
    if (plot) {
      const c = plot.middle || plot.center
      const away = tmpV.set(c.x, 0, c.z)
      const len = away.length() || 1
      // Two metres out from the hex centre on its far side, looking back across the map.
      x = c.x + (away.x / len) * 2
      z = c.z + (away.z / len) * 2
      face = Math.atan2(-x, -z)
    }
    player.position.set(x, colony.groundAt(x, z), z)
    player.rotation.set(0, face, 0)
  }

  // ── controllers ─────────────────────────────────────────────────────────────────────
  function setupControllers() {
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)])
    for (let i = 0; i < 2; i++) {
      const c = renderer.xr.getController(i)
      c.userData.index = i
      const laser = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.55 }))
      laser.scale.z = 6
      laser.visible = false
      c.add(laser)
      lasers.push(laser)
      c.addEventListener('selectstart', onSelect)
      c.addEventListener('squeezestart', onSqueeze)
      c.addEventListener('connected', (e) => {
        c.userData.hand = e.data?.handedness || (i === 0 ? 'left' : 'right')
        c.userData.gamepad = e.data?.gamepad || null
        laser.visible = c.userData.hand !== 'left'
      })
      c.addEventListener('disconnected', () => {
        c.userData.gamepad = null
      })
      player.add(c)
      controllers.push(c)
    }
  }

  const pointer = () => controllers.find((c) => c.userData.hand === 'right') || controllers[1] || controllers[0]

  function onSelect(e) {
    const c = e.target
    if (c.userData.hand === 'left' && controllers.length > 1) return
    hideHelp()
    const agent = agentUnder(c)
    if (agent) {
      showPanel(agent)
      pulse(c, 0.5, 40)
    } else hidePanel()
  }

  function onSqueeze(e) {
    // Teleport to where the laser meets the ground.
    const c = e.target
    if (!laserRay(c)) return
    const hit = ray.intersectPlane(ground, tmpV2)
    if (!hit) return
    player.position.set(hit.x, colony.groundAt(hit.x, hit.z), hit.z)
    pulse(c, 0.3, 30)
  }

  function laserRay(c) {
    c.updateMatrixWorld()
    ray.origin.setFromMatrixPosition(c.matrixWorld)
    ray.direction.set(0, 0, -1).applyQuaternion(c.getWorldQuaternion(tmpQ)).normalize()
    return true
  }

  /** The astronaut the laser is closest to, within reach. Chest height, like the picker. */
  function agentUnder(c) {
    if (!laserRay(c)) return null
    let best = null
    let bestD = 0.7
    for (const a of colony.astronauts.agents) {
      if (a.state === 'gone' || a.scale < 0.5 || !a.thread) continue
      tmpV.set(a.pos.x, a.pos.y + 0.7, a.pos.z)
      const along = tmpV2.subVectors(tmpV, ray.origin).dot(ray.direction)
      if (along < 0.3 || along > REACH) continue
      const d = ray.distanceToPoint(tmpV)
      if (d < bestD) {
        bestD = d
        best = a
      }
    }
    return best
  }

  function pulse(c, intensity, ms) {
    const gp = c?.userData?.gamepad
    const act = gp?.hapticActuators?.[0]
    try {
      act?.pulse?.(intensity, ms)
    } catch {}
  }

  // ── per frame ─────────────────────────────────────────────────────────────────────
  function update(dt) {
    if (!state.active) return
    // Walk: left stick, relative to where the head looks.
    for (const c of controllers) {
      const gp = c.userData.gamepad
      if (!gp || !gp.axes) continue
      const ax = gp.axes.length >= 4 ? gp.axes[2] : gp.axes[0]
      const ay = gp.axes.length >= 4 ? gp.axes[3] : gp.axes[1]
      if (c.userData.hand === 'left' || controllers.length === 1) {
        if (Math.abs(ax) > 0.15 || Math.abs(ay) > 0.15) {
          camera.getWorldQuaternion(tmpQ)
          tmpE.setFromQuaternion(tmpQ, 'YXZ')
          const yaw = tmpE.y
          const fx = -Math.sin(yaw)
          const fz = -Math.cos(yaw)
          const rx = Math.cos(yaw)
          const rz = -Math.sin(yaw)
          player.position.x += (fx * -ay + rx * ax) * WALK_SPEED * dt
          player.position.z += (fz * -ay + rz * ax) * WALK_SPEED * dt
        }
      } else {
        // Snap turn: right stick, one notch per flick.
        if (Math.abs(ax) < 0.3) snapArmed = true
        else if (snapArmed) {
          snapArmed = false
          player.rotation.y -= Math.sign(ax) * SNAP_TURN
          pulse(c, 0.2, 20)
        }
      }
    }
    // Feet on the ground: decks are a step up, the moon rolls a little.
    player.position.y += (colony.groundAt(player.position.x, player.position.z) - player.position.y) * Math.min(1, dt * 12)

    // Hover: whoever the laser rests on wears a name tag.
    const p = pointer()
    const a = p ? agentUnder(p) : null
    if (a !== hovered) {
      hovered = a
      hideHover()
      if (a) {
        hoverTag = makeTag(a)
        scene.add(hoverTag)
        pulse(p, 0.25, 20)
      }
    }
    if (hoverTag && hovered) {
      hoverTag.position.set(hovered.pos.x, hovered.pos.y + 1.75, hovered.pos.z)
      hoverTag.lookAt(camera.getWorldPosition(tmpV))
    }
    if (panel) {
      const who = colony.agentFor(panel.userData.id)
      if (!who || who.state === 'gone') hidePanel()
      else {
        panel.position.set(who.pos.x, who.pos.y + 1.55, who.pos.z)
        camera.getWorldPosition(tmpV)
        // The card floats a little toward you so it never sits inside the astronaut.
        tmpV2.subVectors(tmpV, panel.position).normalize().multiplyScalar(0.45)
        panel.position.add(tmpV2)
        panel.lookAt(tmpV)
        // A fresh thread snapshot every couple of seconds keeps the card honest.
        if (performance.now() - panel.userData.drawnAt > 2500 && who.thread) drawCard(panel, who)
      }
    }
    if (helpPanel) {
      camera.getWorldPosition(tmpV)
      camera.getWorldQuaternion(tmpQ)
      tmpV2.set(0, -0.15, -1.6).applyQuaternion(tmpQ).add(tmpV)
      helpPanel.position.lerp(tmpV2, Math.min(1, dt * 4))
      helpPanel.lookAt(tmpV)
      if (performance.now() > helpUntil) hideHelp()
    }
  }

  // ── panels ────────────────────────────────────────────────────────────────────────
  function canvasPlane(w, cw, ch) {
    const cv = document.createElement('canvas')
    cv.width = cw
    cv.height = ch
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, (w * ch) / cw), mat)
    mesh.renderOrder = 999
    mesh.userData.cv = cv
    mesh.userData.ctx = cv.getContext('2d')
    mesh.userData.tex = tex
    return mesh
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }
  function wrap(ctx, text, maxW) {
    const out = []
    for (const para of String(text || '').split(NL)) {
      let line = ''
      for (const word of para.split(/\s+/)) {
        const t = line ? `${line} ${word}` : word
        if (ctx.measureText(t).width > maxW && line) {
          out.push(line)
          line = word
        } else line = t
      }
      out.push(line)
    }
    return out
  }
  function dispose(mesh) {
    if (!mesh) return
    scene.remove(mesh)
    mesh.geometry.dispose()
    mesh.material.map?.dispose()
    mesh.material.dispose()
  }

  function makeTag(agent) {
    const mesh = canvasPlane(0.62, 512, 128)
    const { ctx, cv, tex } = mesh.userData
    const accent = `#${(agent.trim?.getHexString?.() || '9fd8ff')}`
    ctx.clearRect(0, 0, cv.width, cv.height)
    roundRect(ctx, 6, 6, cv.width - 12, cv.height - 12, 34)
    ctx.fillStyle = 'rgba(8,10,20,0.82)'
    ctx.fill()
    ctx.lineWidth = 4
    ctx.strokeStyle = accent
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.textBaseline = 'middle'
    ctx.font = '600 44px system-ui, sans-serif'
    let title = String(agent.thread?.title || '')
    while (title.length > 3 && ctx.measureText(title).width > cv.width - 60) title = `${title.slice(0, -2)}…`
    ctx.fillText(title, 30, cv.height / 2)
    tex.needsUpdate = true
    return mesh
  }

  function drawCard(mesh, agent) {
    const t = agent.thread || {}
    const { ctx, cv, tex } = mesh.userData
    const accent = `#${(agent.trim?.getHexString?.() || '9fd8ff')}`
    ctx.clearRect(0, 0, cv.width, cv.height)
    roundRect(ctx, 8, 8, cv.width - 16, cv.height - 16, 36)
    ctx.fillStyle = 'rgba(8,10,20,0.9)'
    ctx.fill()
    ctx.lineWidth = 5
    ctx.strokeStyle = accent
    ctx.stroke()
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#ffffff'
    ctx.font = '700 52px system-ui, sans-serif'
    let title = String(t.title || 'Someone')
    while (title.length > 3 && ctx.measureText(title).width > cv.width - 80) title = `${title.slice(0, -2)}…`
    ctx.fillText(title, 40, 36)
    ctx.fillStyle = accent
    ctx.font = '500 30px system-ui, sans-serif'
    ctx.fillText(`${agent.status || ''}${t.project ? ` · ${t.project}` : ''}`, 42, 102)
    let y = 158
    ctx.fillStyle = '#e6ecff'
    ctx.font = '400 32px system-ui, sans-serif'
    for (const line of wrap(ctx, t.intro || '', cv.width - 84).slice(0, 4)) {
      ctx.fillText(line, 42, y)
      y += 40
    }
    y += 14
    ctx.fillStyle = '#b9c6ea'
    ctx.font = '400 28px system-ui, sans-serif'
    const facts = String(t.preview || '')
    for (const line of wrap(ctx, facts, cv.width - 84).slice(0, 5)) {
      ctx.fillText(line, 42, y)
      y += 35
      if (y > cv.height - 60) break
    }
    if (t.hasError || t.unread) {
      ctx.fillStyle = '#ff8a7a'
      ctx.font = '600 28px system-ui, sans-serif'
      ctx.fillText(t.hasError ? '✋ needs you' : '✋ waiting on you', 42, cv.height - 52)
    }
    tex.needsUpdate = true
    mesh.userData.drawnAt = performance.now()
  }

  function showPanel(agent) {
    hidePanel()
    panel = canvasPlane(PANEL_W, 1024, 640)
    panel.userData.id = agent.id
    drawCard(panel, agent)
    scene.add(panel)
  }
  function hidePanel() {
    dispose(panel)
    panel = null
  }
  function hideHover() {
    dispose(hoverTag)
    hoverTag = null
  }
  function showHelp() {
    hideHelp()
    helpPanel = canvasPlane(1.3, 1024, 420)
    const { ctx, cv, tex } = helpPanel.userData
    ctx.clearRect(0, 0, cv.width, cv.height)
    roundRect(ctx, 8, 8, cv.width - 16, cv.height - 16, 36)
    ctx.fillStyle = 'rgba(8,10,20,0.88)'
    ctx.fill()
    ctx.lineWidth = 5
    ctx.strokeStyle = '#9fd8ff'
    ctx.stroke()
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#ffffff'
    ctx.font = '700 54px system-ui, sans-serif'
    ctx.fillText('Welcome to Bot Farm', 40, 36)
    ctx.fillStyle = '#e6ecff'
    ctx.font = '400 36px system-ui, sans-serif'
    const lines = ['Left stick: walk where you look', 'Right stick: turn', 'Point and pull the trigger: meet someone', 'Grip: teleport to where the laser lands', 'You are standing on the Home hex.']
    lines.forEach((l, i) => ctx.fillText(l, 42, 118 + i * 52))
    tex.needsUpdate = true
    camera.getWorldPosition(tmpV)
    camera.getWorldQuaternion(tmpQ)
    helpPanel.position.set(0, -0.15, -1.6).applyQuaternion(tmpQ).add(tmpV)
    scene.add(helpPanel)
    helpUntil = performance.now() + 14000
  }
  function hideHelp() {
    dispose(helpPanel)
    helpPanel = null
  }

  state.update = update
  state.goHome = goHome
  return state
}
