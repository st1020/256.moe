import { tau } from './geometry.ts'
import { scenes, type Scene } from './scenes.ts'

const RIPPLE_DURATION_MS = 1600
const TRANSITION_DURATION_MS = 800

const stage = document.querySelector<HTMLButtonElement>('#universe')!
const expression = document.querySelector<HTMLSpanElement>('#expression')!
const announcement = document.querySelector<HTMLSpanElement>('#announcement')!
const canvas = document.querySelector<HTMLCanvasElement>('#field')!
const ctx = canvas.getContext('2d')!
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
const points = Array.from({ length: 256 }, (_, i) => ({
  x: 0,
  y: 0,
  seed: Math.sin(i * 127.1) * 0.5 + 0.5,
}))
let width = 0,
  height = 0,
  radius = 0,
  frame = 0,
  lastTime = 0,
  time = 0,
  sceneIndex = 0
let scene = scenes[0],
  previousScene = scene,
  changedAt = 0
let transitioning = false
let halo: CanvasGradient, shade: CanvasGradient
let ripples: { x: number; y: number; start: number }[] = []

function renderScene(announce = false) {
  stage.dataset.background = scene.id
  expression.innerHTML = scene.html
  expression.style.setProperty('--size', String(scene.size))
  stage.setAttribute('aria-label', `${scene.label}. Show next expression`)
  if (announce) announcement.textContent = scene.label
}

function resize() {
  width = innerWidth
  height = innerHeight
  radius = Math.min(width * 0.37, height * 0.39, 390)
  const dpr = Math.min(devicePixelRatio || 1, 2)
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  // Gradients use the same coordinate space as the centered drawing loop.
  ctx.save()
  ctx.translate(width / 2, height / 2)
  halo = ctx.createRadialGradient(0, 0, radius * 0.3, 0, 0, radius * 1.45)
  halo.addColorStop(0, 'rgba(255,255,255,0)')
  halo.addColorStop(0.65, 'rgba(255,255,255,.018)')
  halo.addColorStop(1, 'rgba(255,255,255,0)')
  shade = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.8)
  shade.addColorStop(0, 'rgba(0,0,0,.9)')
  shade.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.restore()

  points.forEach((p, i) => {
    const [x, y] = scene.target(i, time)
    p.x = x * radius
    p.y = y * radius
  })
  if (reducedMotion.matches) draw(performance.now())
}

function drawGuides(scene: Scene) {
  ctx.save()
  ctx.scale(radius, radius)
  ctx.lineWidth = 0.75 / radius
  ctx.strokeStyle = 'rgba(255,255,255,.075)'
  scene.drawGuides?.(ctx, time)
  ctx.restore()
}

function draw(now: number) {
  const dt = Math.min(Math.max(0, now - lastTime) / 1000 || 1 / 60, 0.05)
  lastTime = now
  if (!reducedMotion.matches) time += dt
  ctx.clearRect(0, 0, width, height)
  ctx.save()
  ctx.translate(width / 2, height / 2)

  ctx.fillStyle = halo
  ctx.fillRect(-width / 2, -height / 2, width, height)

  const blend = reducedMotion.matches
    ? 1
    : Math.min(1, Math.max(0, now - changedAt) / TRANSITION_DURATION_MS)
  ctx.save()
  if (blend < 1 && previousScene !== scene) {
    ctx.globalAlpha = 1 - blend
    drawGuides(previousScene)
  }
  ctx.globalAlpha = previousScene === scene ? 1 : blend
  drawGuides(scene)
  ctx.restore()

  ripples = ripples.filter((r) => now - r.start < RIPPLE_DURATION_MS)
  const ease = reducedMotion.matches ? 1 : 1 - Math.exp(-dt * 4)
  points.forEach((p, i) => {
    const [tx, ty] = scene.target(i, time)
    p.x += (tx * radius - p.x) * ease
    p.y += (ty * radius - p.y) * ease
    let x = p.x,
      y = p.y,
      light = 0
    for (const ripple of ripples) {
      const age = Math.max(0, now - ripple.start) / RIPPLE_DURATION_MS
      const dx = p.x - ripple.x,
        dy = p.y - ripple.y
      const distance = Math.hypot(dx, dy) || 1
      const wave =
        Math.exp(-(((distance - age * Math.max(width, height) * 1.1) / 85) ** 2)) * (1 - age)
      x += (dx / distance) * wave * 38
      y += (dy / distance) * wave * 38
      light += wave * 0.5
    }
    const breathe = reducedMotion.matches ? 0.5 : 0.5 + 0.5 * Math.sin(time * 0.65 + p.seed * tau)
    ctx.fillStyle = `rgba(255,255,255,${0.12 + p.seed * 0.2 + breathe * 0.11 + light})`
    ctx.beginPath()
    ctx.arc(x, y, 0.65 + p.seed * 0.55 + light, 0, tau)
    ctx.fill()
  })

  ctx.fillStyle = shade
  ctx.fillRect(-width / 2, -height / 2, width, height)

  for (const ripple of ripples) {
    const age = Math.max(0, now - ripple.start) / RIPPLE_DURATION_MS
    ctx.strokeStyle = `rgba(255,255,255,${(1 - age) ** 3 * 0.14})`
    ctx.lineWidth = 0.65
    ctx.beginPath()
    ctx.arc(ripple.x, ripple.y, age * Math.max(width, height) * 1.1, 0, tau)
    ctx.stroke()
  }
  ctx.restore()
  if (!reducedMotion.matches && !document.hidden) frame = requestAnimationFrame(draw)
}

async function advance(event: MouseEvent) {
  sceneIndex = (sceneIndex + 1) % scenes.length
  if (!reducedMotion.matches) {
    ripples.push({
      x: event.detail ? event.clientX - width / 2 : 0,
      y: event.detail ? event.clientY - height / 2 : 0,
      start: performance.now(),
    })
    ripples = ripples.slice(-6)
  }

  // Finish the current transition, then honor the latest requested scene.
  if (transitioning) return
  transitioning = true
  try {
    while (scene !== scenes[sceneIndex]) {
      if (!reducedMotion.matches) {
        const outgoing = expression.animate(
          [
            { opacity: 1, filter: 'blur(0px)', transform: 'translateY(0) scale(1)' },
            { opacity: 0, filter: 'blur(16px)', transform: 'translateY(-12px) scale(1.06)' },
          ],
          { duration: 240, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' },
        )
        await outgoing.finished
        outgoing.cancel()
      }

      previousScene = scene
      scene = scenes[sceneIndex]
      changedAt = performance.now()
      renderScene(true)
      if (reducedMotion.matches) {
        draw(changedAt)
      } else {
        await expression.animate(
          [
            { opacity: 0, filter: 'blur(18px)', transform: 'translateY(14px) scale(.94)' },
            { opacity: 1, filter: 'blur(0px)', transform: 'translateY(0) scale(1)' },
          ],
          { duration: TRANSITION_DURATION_MS, easing: 'cubic-bezier(.16,1,.3,1)' },
        ).finished
      }
    }
  } finally {
    transitioning = false
  }
}

function resume() {
  cancelAnimationFrame(frame)
  ripples = []
  lastTime = performance.now()
  if (!document.hidden) draw(lastTime)
}

stage.addEventListener('click', advance)
window.addEventListener('resize', resize)
document.addEventListener('visibilitychange', resume)
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) expression.getAnimations().forEach((animation) => animation.finish())
  resume()
})
renderScene()
resize()
resume()
