export type Point = [number, number]

export const tau = Math.PI * 2
export const mix = (a: number, b: number, t: number) => a + (b - a) * t
export const polar = (angle: number, radius: number): Point => [
  Math.cos(angle) * radius,
  Math.sin(angle) * radius,
]
export const between = (a: Point, b: Point, t: number): Point => [
  mix(a[0], b[0], t),
  mix(a[1], b[1], t),
]

export function line(ctx: CanvasRenderingContext2D, a: Point, b: Point) {
  ctx.moveTo(...a)
  ctx.lineTo(...b)
}

export function curve(ctx: CanvasRenderingContext2D, sample: (t: number) => Point, count = 128) {
  ctx.beginPath()
  ctx.moveTo(...sample(0))
  for (let n = 1; n <= count; n++) ctx.lineTo(...sample(n / count))
  ctx.stroke()
}

export function circle(ctx: CanvasRenderingContext2D, radius: number) {
  ctx.beginPath()
  ctx.arc(0, 0, radius, 0, tau)
  ctx.stroke()
}
