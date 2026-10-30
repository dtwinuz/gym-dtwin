// Landing backdrop: a loaded barbell, chalk dust and a heart-rate monitor line.
// The scene is driven by scroll progress (chapters) and scroll speed (pulse).
import type * as THREE_NS from 'three'

type Three = typeof THREE_NS

export interface SceneHandle {
  setProgress: (p: number) => void
  setLight: (light: boolean) => void
  /** Free screen area for the hero barbell, as viewport fractions (0..1). */
  setSafe: (r: SafeRect) => void
  kick: (v: number) => void
  dispose: () => void
}

export interface SafeRect { left: number; top: number; right: number; bottom: number }

export interface SceneOpts {
  host: HTMLElement
  progress: number
  light: boolean
  reduced: boolean
  onBpm: (bpm: number) => void
}

interface Frame { x: number; y: number; s: number; rx: number; ry: number; rz: number; plates: number; ecg: number; ey: number }

// one frame per chapter: hero, plan, log, progress, body, roadmap, trust, final
const WIDE: Frame[] = [
  { x: 2.4, y: -0.05, s: 0.8, rx: 0.32, ry: -0.62, rz: 0.1, plates: 2, ecg: 0.75, ey: -2.7 },
  { x: 2.5, y: 0.1, s: 0.9, rx: 0.42, ry: 0.72, rz: -0.08, plates: 2.6, ecg: 0.5, ey: -2.5 },
  { x: -2.45, y: -0.1, s: 1.0, rx: 0.12, ry: 1.28, rz: 0.04, plates: 4, ecg: 0.5, ey: -2.5 },
  { x: 2.45, y: 0.3, s: 0.8, rx: 0.5, ry: -0.3, rz: 0.2, plates: 4, ecg: 1, ey: -1.1 },
  { x: -2.5, y: 0, s: 0.85, rx: 0.25, ry: -0.5, rz: 0.22, plates: 4, ecg: 0.6, ey: -2.5 },
  { x: 0, y: -1.1, s: 0.95, rx: 0.55, ry: 0.2, rz: -0.06, plates: 4, ecg: 0.6, ey: -2.6 },
  { x: 3.1, y: -1.85, s: 0.7, rx: 0.3, ry: -0.9, rz: 0.06, plates: 4, ecg: 0.5, ey: -2.5 },
  { x: 0, y: 0.15, s: 1.2, rx: 0.28, ry: 0.0, rz: 0, plates: 4, ecg: 0.9, ey: -1.9 },
]

const PLATES = [
  { r: 1.0, h: 0.17, c: '#e5322d' },
  { r: 1.0, h: 0.15, c: '#2f6fe4' },
  { r: 0.84, h: 0.13, c: '#f5c518' },
  { r: 0.7, h: 0.11, c: '#2fb35a' },
]

const smooth = (x: number) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k) }
const lerp = (a: number, b: number, k: number) => a + (b - a) * k

// one heartbeat in [0,1): P wave, QRS spike, T wave
function beat(u: number) {
  const g = (c: number, w: number) => Math.exp(-((u - c) * (u - c)) / (2 * w * w))
  return 0.12 * g(0.18, 0.025) - 0.14 * g(0.3, 0.008) + 1.0 * g(0.33, 0.009) - 0.28 * g(0.36, 0.01) + 0.24 * g(0.56, 0.04)
}

function plateGeometry(T: Three, r: number, h: number) {
  const hh = h / 2
  const pts = [
    [0.058, -hh], [0.2, -hh], [0.22, -hh * 0.55], [r * 0.83, -hh * 0.55], [r * 0.88, -hh], [r, -hh],
    [r, hh], [r * 0.88, hh], [r * 0.83, hh * 0.55], [0.22, hh * 0.55], [0.2, hh], [0.058, hh], [0.058, -hh],
  ].map(([a, b]) => new T.Vector2(a, b))
  const g = new T.LatheGeometry(pts, 72)
  g.rotateZ(Math.PI / 2)
  return g
}

function glowTexture(T: Three, color: string) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const x = c.getContext('2d')!
  const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128)
  gr.addColorStop(0, color)
  gr.addColorStop(1, 'rgba(0,0,0,0)')
  x.fillStyle = gr
  x.fillRect(0, 0, 256, 256)
  const t = new T.CanvasTexture(c)
  t.colorSpace = T.SRGBColorSpace
  return t
}

export async function mountScene(o: SceneOpts): Promise<SceneHandle> {
  const T = await import('three')
  const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js')
  const { Line2 } = await import('three/examples/jsm/lines/Line2.js')
  const { LineGeometry } = await import('three/examples/jsm/lines/LineGeometry.js')
  const { LineMaterial } = await import('three/examples/jsm/lines/LineMaterial.js')

  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  const DPR = Math.min(1.5, devicePixelRatio || 1)
  renderer.setPixelRatio(DPR)
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = T.ACESFilmicToneMapping
  renderer.outputColorSpace = T.SRGBColorSpace
  const canvas = renderer.domElement
  canvas.className = 'ld-canvas'
  o.host.append(canvas)

  const scene = new T.Scene()
  const pmrem = new T.PMREMGenerator(renderer)
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = env
  const camera = new T.PerspectiveCamera(34, 1, 0.1, 100)
  camera.position.set(0, 0, 10)

  scene.add(new T.HemisphereLight(0xffffff, 0x223322, 0.6))
  const key = new T.DirectionalLight(0xffffff, 2.2)
  key.position.set(4, 6, 6)
  scene.add(key)
  const rimA = new T.PointLight(0xc6f432, 30, 20)
  rimA.position.set(-4, 2, 2)
  const rimB = new T.PointLight(0xff5a36, 26, 20)
  rimB.position.set(4, -2, 3)
  scene.add(rimA, rimB)

  // barbell
  const rig = new T.Group()
  const bell = new T.Group()
  rig.add(bell)
  scene.add(rig)
  const steel = new T.MeshStandardMaterial({ color: 0xd9dde2, metalness: 1, roughness: 0.28 })
  const dark = new T.MeshStandardMaterial({ color: 0x2a2d31, metalness: 0.8, roughness: 0.4 })
  const bar = new T.Mesh(new T.CylinderGeometry(0.034, 0.034, 3.1, 24), steel)
  bar.rotation.z = Math.PI / 2
  bell.add(bar)
  const knurl = new T.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 1, roughness: 0.62 })
  for (const sx of [-1, 1]) {
    const kn = new T.Mesh(new T.CylinderGeometry(0.036, 0.036, 0.9, 24), knurl)
    kn.rotation.z = Math.PI / 2
    kn.position.x = sx * 0.82
    bell.add(kn)
    const collar = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 0.08, 32), dark)
    collar.rotation.z = Math.PI / 2
    collar.position.x = sx * 1.55
    bell.add(collar)
    const sleeve = new T.Mesh(new T.CylinderGeometry(0.056, 0.056, 1.3, 32), steel)
    sleeve.rotation.z = Math.PI / 2
    sleeve.position.x = sx * 2.24
    bell.add(sleeve)
    const cap = new T.Mesh(new T.CylinderGeometry(0.062, 0.062, 0.04, 32), dark)
    cap.rotation.z = Math.PI / 2
    cap.position.x = sx * 2.9
    bell.add(cap)
  }
  const plates: { mesh: THREE_NS.Mesh; sx: number; x: number }[] = []
  for (const sx of [-1, 1]) {
    let off = 1.62
    PLATES.forEach(p => {
      const mat = new T.MeshStandardMaterial({ color: p.c, metalness: 0.05, roughness: 0.52, envMapIntensity: 0.6 })
      const mesh = new T.Mesh(plateGeometry(T, p.r, p.h), mat)
      const x = sx * (off + p.h / 2)
      off += p.h + 0.012
      mesh.position.x = x
      bell.add(mesh)
      plates.push({ mesh, sx, x })
    })
  }

  // floor glow
  const glowMat = new T.SpriteMaterial({ map: glowTexture(T, 'rgba(198,244,50,0.55)'), transparent: true, depthWrite: false, blending: T.AdditiveBlending })
  const glow = new T.Sprite(glowMat)
  glow.scale.set(9, 5, 1)
  glow.position.z = -1.5
  rig.add(glow)

  // chalk dust
  const N = 260
  const pos = new Float32Array(N * 3)
  const spd = new Float32Array(N)
  for (let k = 0; k < N; k++) {
    pos[k * 3] = (Math.random() - 0.5) * 18
    pos[k * 3 + 1] = (Math.random() - 0.5) * 11
    pos[k * 3 + 2] = (Math.random() - 0.5) * 6 - 1
    spd[k] = 0.08 + Math.random() * 0.22
  }
  const dustGeo = new T.BufferGeometry()
  dustGeo.setAttribute('position', new T.BufferAttribute(pos, 3))
  const dustMat = new T.PointsMaterial({ size: 0.035, color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, sizeAttenuation: true })
  const dust = new T.Points(dustGeo, dustMat)
  scene.add(dust)

  // heart-rate line
  const M = 320
  const X0 = -10, X1 = 10
  const linePos = new Float32Array(M * 3)
  const lineCol = new Float32Array(M * 3)
  const ecgGeo = new LineGeometry()
  const ecgMat = new LineMaterial({ color: 0xffffff, linewidth: 2.6, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false })
  const ecg = new Line2(ecgGeo, ecgMat)
  ecg.position.z = -2.4
  scene.add(ecg)
  let ecgInit = false
  const ecgColor = new T.Color('#ff5a36')

  let W = 1, H = 1, portrait = false
  function resize() {
    W = o.host.clientWidth || innerWidth
    H = o.host.clientHeight || innerHeight
    portrait = H > W * 1.05
    renderer.setSize(W, H, false)
    camera.aspect = W / H
    camera.fov = portrait ? 46 : 34
    camera.updateProjectionMatrix()
    ecgMat.resolution.set(W * DPR, H * DPR)
  }
  resize()

  let progress = o.progress, light = o.light
  let intensity = 0, phase = 0, bpmShown = 0, bpmAt = 0
  let px = 0, py = 0, tx = 0, ty = 0
  const cur: Frame = { ...WIDE[0] }
  let safe: SafeRect | null = null
  let hero: Frame = { ...WIDE[0] }
  const box = new T.Box3()

  // Fit the hero barbell (its projected bounding box) into the free rect so it never covers copy.
  const corner = new T.Vector3()
  function project(f: Frame) {
    rig.position.set(f.x, f.y, 0); rig.scale.setScalar(f.s)
    bell.rotation.set(f.rx, f.ry, f.rz)
    rig.updateMatrixWorld(true)
    box.setFromObject(bell)
    let l = 1, r = 0, t = 1, btm = 0
    for (let k = 0; k < 8; k++) {
      corner.set(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z).project(camera)
      const fx = (corner.x + 1) / 2, fy = (1 - corner.y) / 2
      l = Math.min(l, fx); r = Math.max(r, fx); t = Math.min(t, fy); btm = Math.max(btm, fy)
    }
    return { l, r, t, b: btm }
  }
  function fitHero() {
    const f = { ...WIDE[0] }
    if (portrait) { f.ey = -0.4 + (f.ey + 2) * 0.3 }
    if (!safe) { hero = f; return }
    const saved = plates.map(p => [p.mesh.position.x, p.mesh.rotation.x])
    plates.forEach(p => { p.mesh.position.x = p.x; p.mesh.rotation.x = 0 })
    camera.updateMatrixWorld()
    const h = camera.position.z * Math.tan((camera.fov * Math.PI) / 360), w = h * camera.aspect
    const aw = safe.right - safe.left, ah = safe.bottom - safe.top
    f.x = ((safe.left + safe.right) - 1) * w
    f.y = (1 - (safe.top + safe.bottom)) * h
    for (let it = 0; it < 4; it++) {
      const q = project(f)
      // margin covers the idle spin and pointer parallax
      const k = Math.min(aw * 0.88 / (q.r - q.l), ah * 0.86 / (q.b - q.t))
      f.s = Math.max(0.15, Math.min(portrait ? 0.9 : 1, f.s * k))
      const q2 = project(f)
      f.x += ((safe.left + safe.right) / 2 - (q2.l + q2.r) / 2) * 2 * w
      f.y -= ((safe.top + safe.bottom) / 2 - (q2.t + q2.b) / 2) * 2 * h
    }
    plates.forEach((p, k) => { p.mesh.position.x = saved[k][0]; p.mesh.rotation.x = saved[k][1] })
    hero = f
  }
  let intro = o.reduced ? 1 : 0

  function applyTheme() {
    dustMat.color.set(light ? 0x5b6470 : 0xffffff)
    dustMat.opacity = light ? 0.35 : 0.5
    glowMat.map = glowTexture(T, light ? 'rgba(120,160,0,0.28)' : 'rgba(198,244,50,0.5)')
    glowMat.needsUpdate = true
    ecgColor.set(light ? '#e8431f' : '#ff5a36')
    renderer.toneMappingExposure = light ? 1.05 : 1.15
  }
  applyTheme()

  function frameAt(p: number, out: Frame) {
    const last = WIDE.length - 1
    const q = Math.max(0, Math.min(last, p))
    const i = Math.min(last - 1, Math.floor(q))
    const k = smooth(q - i)
    const a = i === 0 ? hero : place(WIDE[i]), b = place(WIDE[i + 1])
    for (const key of Object.keys(out) as (keyof Frame)[]) out[key] = lerp(a[key], b[key], k)
  }
  const tmp: Frame = { ...WIDE[0] }
  function place(f: Frame): Frame {
    if (!portrait) return f
    Object.assign(tmp, f)
    tmp.x *= 0.12
    tmp.y = f.y * 0.5 - 3.3
    tmp.s *= 0.66
    tmp.ey = -0.4 + (f.ey + 2) * 0.3
    return { ...tmp }
  }

  function writeEcg(time: number) {
    const amp = (0.55 + intensity * 0.6) * (portrait ? 0.7 : 1)
    const period = 3.2
    for (let k = 0; k < M; k++) {
      const u = k / (M - 1)
      const xw = X0 + (X1 - X0) * u
      const v = (((xw / period - phase) % 1) + 1) % 1
      linePos[k * 3] = xw
      linePos[k * 3 + 1] = beat(v) * amp
      linePos[k * 3 + 2] = 0
      const head = (((u - (time * 0.11) % 1) % 1) + 1) % 1
      const fade = 0.18 + 0.82 * Math.pow(1 - head, 2.2)
      lineCol[k * 3] = ecgColor.r * fade
      lineCol[k * 3 + 1] = ecgColor.g * fade
      lineCol[k * 3 + 2] = ecgColor.b * fade
    }
    ecgGeo.setPositions(linePos)
    ecgGeo.setColors(lineCol)
    if (!ecgInit) { ecg.computeLineDistances(); ecgInit = true }
  }

  let last = performance.now(), raf = 0, alive = true
  function render(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    const t = now / 1000
    frameAt(progress, cur)
    if (!o.reduced) {
      intro = Math.min(1, intro + dt / 1.8)
      intensity = Math.max(0, intensity - dt * 0.55)
      phase += dt * ((64 + intensity * 92) / 60) * 0.32
      px += (tx - px) * 0.05
      py += (ty - py) * 0.05
    }
    const bpm = Math.round(64 + intensity * 92)
    if (now - bpmAt > 250 && bpm !== bpmShown) { bpmShown = bpm; bpmAt = now; o.onBpm(bpm) }

    rig.position.set(cur.x, cur.y, 0)
    rig.scale.setScalar(cur.s)
    const spin = o.reduced ? 0 : Math.sin(t * 0.35) * 0.08
    bell.rotation.set(cur.rx + py * 0.12, cur.ry + spin + px * 0.2, cur.rz)
    const loaded = cur.plates * smooth(intro * 1.15)
    plates.forEach((p, k) => {
      const idx = k % PLATES.length
      const kk = smooth(Math.max(0, Math.min(1, loaded - idx)))
      p.mesh.visible = kk > 0.01
      p.mesh.position.x = p.x + p.sx * (1 - kk) * 3.2
      p.mesh.rotation.x = (1 - kk) * 2.4 * p.sx
    })

    ecg.position.y = cur.ey
    ecgMat.opacity = Math.min(1, cur.ecg * (0.85 + intensity * 0.5))
    writeEcg(o.reduced ? 0 : t)

    if (!o.reduced) {
      const a = dustGeo.attributes.position.array as Float32Array
      for (let k = 0; k < N; k++) {
        a[k * 3 + 1] += spd[k] * dt * (1 + intensity * 2)
        if (a[k * 3 + 1] > 5.5) a[k * 3 + 1] = -5.5
      }
      dustGeo.attributes.position.needsUpdate = true
    }
    renderer.render(scene, camera)
  }
  function loop(now: number) {
    if (!alive) return
    raf = requestAnimationFrame(loop)
    if (document.hidden) return
    render(now)
  }
  fitHero()
  const once = () => render(performance.now())
  if (o.reduced) once()
  else raf = requestAnimationFrame(loop)

  const onResize = () => { resize(); fitHero(); if (o.reduced) once() }
  const onMove = (e: PointerEvent) => { tx = (e.clientX / innerWidth - 0.5) * 2; ty = (e.clientY / innerHeight - 0.5) * 2 }
  addEventListener('resize', onResize)
  addEventListener('pointermove', onMove, { passive: true })
  canvas.addEventListener('webglcontextlost', e => e.preventDefault())

  return {
    setProgress(p) { progress = p; if (o.reduced) once() },
    setSafe(r) { safe = r; fitHero(); if (o.reduced) once() },
    setLight(l) { light = l; applyTheme(); if (o.reduced) once() },
    kick(v) { intensity = Math.min(1, intensity + v) },
    dispose() {
      alive = false
      cancelAnimationFrame(raf)
      removeEventListener('resize', onResize)
      removeEventListener('pointermove', onMove)
      scene.traverse(obj => {
        const m = obj as THREE_NS.Mesh
        m.geometry?.dispose?.()
        const mat = m.material as THREE_NS.Material | THREE_NS.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach(x => x.dispose()); else mat?.dispose?.()
      })
      env.dispose()
      pmrem.dispose()
      renderer.dispose()
      canvas.remove()
    },
  }
}
