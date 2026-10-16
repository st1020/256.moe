import { between, circle, curve, line, mix, polar, tau, type Point } from './geometry.ts'

export interface Scene {
  id: string
  html: string
  size: number
  label: string
  // Both callbacks use coordinates relative to the field radius; time is in seconds.
  target: (particle: number, time: number) => Point
  drawGuides?: (ctx: CanvasRenderingContext2D, time: number) => void
}

const math = (body: string) =>
  `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">${body}</math>`

// The golden angle spreads particle phases without lining them up.
const goldenAngle = 2.399963

function path(i: number, time: number, node: (i: number, level: number) => Point): Point {
  const depth = 4 - 4 * Math.cos(time * 0.22 + i * goldenAngle)
  const level = Math.min(7, Math.floor(depth))
  return between(node(i, level), node(i, level + 1), depth - level)
}

function scatter(n: number) {
  const value = Math.sin(n * 127.1) * 43758.5453
  return value - Math.floor(value)
}

const dust: Scene = {
  id: 'dust',
  html: '256',
  size: 25,
  label: 'Two hundred and fifty-six',
  target(i, time) {
    const x = (scatter(i + 1) - 0.5) * 2.7
    const y = (scatter(i + 257) - 0.5) * 2.3
    return [x + 0.1 * Math.sin(time * 0.13 + y * 2), y + 0.08 * Math.cos(time * 0.09 + x * 3)]
  },
}

function branchNode(i: number, level: number): Point {
  return [-1 + level / 4, ((Math.floor(i / 2 ** (8 - level)) + 0.5) / 2 ** level - 0.5) * 1.85]
}

const branching: Scene = {
  id: 'branching',
  html: math('<msup><mn>2</mn><mn>8</mn></msup>'),
  size: 27,
  label: 'Two to the eighth power equals 256',
  target: (i, time) => path(i, time, branchNode),
  drawGuides(ctx, time) {
    for (let level = 1; level <= 8; level++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.025 + 0.05 * (0.5 + 0.5 * Math.cos(level - time * 0.5))})`
      ctx.beginPath()
      for (let n = 0; n < 2 ** level; n++) {
        const leaf = n * 2 ** (8 - level)
        line(ctx, branchNode(leaf, level - 1), branchNode(leaf, level))
      }
      ctx.stroke()
    }
  },
}

function spiral(step: number, time: number): Point {
  // A logarithmic radial projection keeps all sixteen multiplications visible.
  return polar((step * Math.PI) / 4 + time * 0.055, Math.log1p(2 ** (step / 2)) / Math.log(257))
}

const complex: Scene = {
  id: 'complex',
  html: math(
    '<msup><mrow><mo>(</mo><mn>1</mn><mo>+</mo><mi>i</mi><mo>)</mo></mrow><mn>16</mn></msup>',
  ),
  size: 17,
  label: 'One plus i, raised to the sixteenth power, equals 256',
  target: (i, time) => spiral((i / 255) * 16, time),
  drawGuides(ctx, time) {
    curve(ctx, (t) => spiral(t * 16, time), 256)
    ctx.beginPath()
    for (let n = 1; n <= 16; n++) line(ctx, spiral(n - 1, time), spiral(n, time))
    ctx.stroke()
  },
}

function bitWave(x: number, bit: number, time: number): Point {
  return [x, (bit - 3.5) * 0.235 + Math.tanh(Math.sin(x * 8 + time * 0.8 + bit * 1.7) * 7) * 0.038]
}

const byte: Scene = {
  id: 'byte',
  html: '<span class="byte"><span>8</span><span class="word">bits</span></span>',
  size: 24,
  label: 'Eight bits have 256 possible states',
  target: (i, time) =>
    bitWave(Math.cos(((i % 32) / 32) * tau + time * 0.2), Math.floor(i / 32), time),
  drawGuides(ctx, time) {
    for (let bit = 0; bit < 8; bit++) curve(ctx, (t) => bitWave(t * 2 - 1, bit, time))
  },
}

function pascalNode(i: number, level: number): Point {
  const bits = (i >> (8 - level)).toString(2).replaceAll('0', '').length
  return [(2 * bits - level) / 8, -0.95 + (level / 8) * 1.9]
}

// Pascal's eighth row counts all subsets of an eight-element set.
const pascal: Scene = {
  id: 'pascal',
  html: math(`
    <munderover>
      <mo>∑</mo>
      <mrow><mi>k</mi><mo>=</mo><mn>0</mn></mrow>
      <mn>8</mn>
    </munderover>
    <mrow>
      <mo>(</mo>
      <mfrac linethickness="0"><mn>8</mn><mi>k</mi></mfrac>
      <mo>)</mo>
    </mrow>
  `),
  size: 18,
  label: 'The sum of eight choose k, for k from zero to eight, equals 256',
  target: (i, time) => path(i, time, pascalNode),
  drawGuides(ctx) {
    ctx.beginPath()
    for (let row = 0; row < 8; row++) {
      for (let n = 0; n <= row; n++) {
        const from: Point = [(2 * n - row) / 8, -0.95 + (row / 8) * 1.9]
        line(ctx, from, [from[0] - 0.125, from[1] + 1.9 / 8])
        line(ctx, from, [from[0] + 0.125, from[1] + 1.9 / 8])
      }
    }
    ctx.stroke()
  },
}

function square(t: number, radius: number): Point {
  const side = (((t % 1) + 1) % 1) * 4
  if (side < 1) return [mix(-radius, radius, side), -radius]
  if (side < 2) return [radius, mix(-radius, radius, side - 1)]
  if (side < 3) return [mix(radius, -radius, side - 2), radius]
  return [-radius, mix(radius, -radius, side - 3)]
}

const hex: Scene = {
  id: 'hex',
  html: '<span class="code">0x100</span>',
  size: 18,
  label: 'Hexadecimal 100 equals decimal 256',
  target: (i, time) =>
    square(
      (i % 16) / 16 + time * 0.025 * (i % 2 ? 1 : -1),
      0.13 + (Math.floor(i / 16) / 15) * 0.87,
    ),
  drawGuides(ctx, time) {
    for (let ring = 0; ring < 16; ring++) {
      const radius = 0.13 + (ring / 15) * 0.87
      ctx.strokeStyle = `rgba(255,255,255,${0.035 + 0.05 * (0.5 + 0.5 * Math.sin(ring * 0.5 - time * 0.6))})`
      ctx.strokeRect(-radius, -radius, radius * 2, radius * 2)
    }
  },
}

const totient: Scene = {
  id: 'totient',
  html: math('<mi>φ</mi><mo>(</mo><mn>257</mn><mo>)</mo>'),
  size: 18,
  label: 'Euler’s totient of the prime 257 equals 256',
  target(i, time) {
    const n = i + 1
    const rotation = time * 0.025
    return between(
      polar((n / 257) * tau + rotation, 1),
      polar((((n * 3) % 257) / 257) * tau + rotation, 1),
      0.5 - 0.5 * Math.cos(time * 0.24 + (i / 256) * tau),
    )
  },
  drawGuides(ctx, time) {
    circle(ctx, 1)
    ctx.strokeStyle = 'rgba(255,255,255,.05)'
    ctx.beginPath()
    for (let n = 1; n <= 256; n++)
      line(
        ctx,
        polar((n / 257) * tau + time * 0.025, 1),
        polar((((n * 3) % 257) / 257) * tau + time * 0.025, 1),
      )
    ctx.stroke()
  },
}

function secantWave(x: number, k: number, time: number): Point {
  return [x, (k - 4.5) * 0.12 + Math.cos((x * k * Math.PI) / 1.7 + time * 0.3) * 0.32]
}

// By sin(2x) = 2 sin(x) cos(x), the eight factors 2 cos(kπ/17) multiply to one:
// doubling the sine angles permutes the same factors. https://dlmf.nist.gov/4.21.E27
const secants: Scene = {
  id: 'secants',
  html: math(`
    <munderover>
      <mo>∏</mo>
      <mrow><mi>k</mi><mo>=</mo><mn>1</mn></mrow>
      <mn>8</mn>
    </munderover>
    <mi>sec</mi><mo>⁡</mo>
    <mrow>
      <mo>(</mo>
      <mfrac>
        <mrow><mi>k</mi><mi>π</mi></mrow>
        <mn>17</mn>
      </mfrac>
      <mo>)</mo>
    </mrow>
  `),
  size: 12.5,
  label: 'The product of secant of k pi over seventeen, for k from one to eight, equals 256',
  target: (i, time) =>
    secantWave(Math.cos(((i % 32) / 32) * tau + time * 0.12) * 1.05, Math.floor(i / 32) + 1, time),
  drawGuides(ctx, time) {
    for (let k = 1; k <= 8; k++) curve(ctx, (t) => secantWave((t * 2 - 1) * 1.05, k, time))
  },
}

const grid = (i: number): Point => [((i % 16) - 7.5) / 8, (Math.floor(i / 16) - 7.5) / 8]
// Multiplication by x in GF(2^8), using x^8 + x^4 + x^3 + x + 1.
const double = (i: number) => ((i << 1) ^ (i & 128 ? 0x11b : 0)) & 255

const field: Scene = {
  id: 'field',
  html: math('<mo>|</mo><msub><mi>𝔽</mi><msup><mn>2</mn><mn>8</mn></msup></msub><mo>|</mo>'),
  size: 23,
  label: 'The finite field of order two to the eighth power has 256 elements',
  target: (i, time) => between(grid(i), grid(double(i)), 0.5 - 0.5 * Math.cos(time * 0.25)),
  drawGuides(ctx) {
    ctx.beginPath()
    for (let n = 0; n < 16; n++) {
      const a = (n - 7.5) / 8
      line(ctx, [a, -0.9375], [a, 0.9375])
      line(ctx, [-0.9375, a], [0.9375, a])
    }
    ctx.stroke()
  },
}

function carry(step: number): Point {
  const n = Math.min(8, Math.floor(step))
  const progress = step - n
  return [
    -0.96 + ((n + Math.min(1, progress * 2)) / 9) * 1.92,
    0.96 - ((n + Math.max(0, progress * 2 - 1)) / 9) * 1.92,
  ]
}

const binary: Scene = {
  id: 'binary',
  html: math('<msub class="code"><mn>100000000</mn><mn>2</mn></msub>'),
  size: 10,
  label: 'Binary one followed by eight zeros equals decimal 256',
  target: (i, time) => carry(4.5 - 4.5 * Math.cos(i * goldenAngle + time * 0.28)),
  drawGuides(ctx) {
    curve(ctx, (t) => carry(t * 9), 180)
    ctx.beginPath()
    for (let n = 0; n <= 9; n++) {
      const [x, y] = carry(n)
      ctx.moveTo(x + 0.035, y)
      ctx.arc(x, y, 0.035, 0, tau)
    }
    ctx.stroke()
  },
}

const divisorOrbits = [
  { count: 1, radius: 0.28 },
  { count: 7, radius: 0.5 },
  { count: 31, radius: 0.75 },
  { count: 217, radius: 1.03 },
]

const divisors: Scene = {
  id: 'divisors',
  html: math('<mi>σ</mi><mo>(</mo><mn>217</mn><mo>)</mo>'),
  size: 18,
  label: 'The positive divisors of 217 sum to 256: one, seven, thirty-one, and 217',
  target(i, time) {
    let group = 0
    while (i >= divisorOrbits[group].count) {
      i -= divisorOrbits[group].count
      group++
    }
    const { count, radius } = divisorOrbits[group]
    return polar((i / count) * tau + (time * 0.16) / (group + 1) + group * 0.7, radius)
  },
  drawGuides(ctx) {
    for (const { radius } of divisorOrbits) circle(ctx, radius)
  },
}

// Display order. Every scene describes the same number and animates the same 256 particles.
export const scenes: Scene[] = [
  dust,
  branching,
  complex,
  byte,
  pascal,
  hex,
  totient,
  secants,
  field,
  binary,
  divisors,
]
