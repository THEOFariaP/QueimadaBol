import type { ClassId } from './game'
export type Point = { x: number; y: number }
const templates: Record<ClassId, Point[]> = {
  padrao: Array.from({ length: 65 }, (_, i) => ({ x: Math.cos(i * Math.PI / 32), y: Math.sin(i * Math.PI / 32) })),
  tanque: [{ x: -1, y: -1 }, { x: 1, y: -1 }, { x: 0, y: 1 }, { x: -1, y: -1 }],
  dps: [{ x: -1, y: 1 }, { x: 1, y: -1 }],
  suporte: Array.from({ length: 65 }, (_, i) => {
    const t = i * Math.PI / 32
    return { x: 16 * Math.sin(t) ** 3, y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) }
  }),
}

function normalize(points: Point[]): Point[] {
  const xs = points.map(p => p.x), ys = points.map(p => p.y)
  const minX = Math.min(...xs), minY = Math.min(...ys)
  const scale = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY, 1e-6)
  return points.map(p => ({ x: (p.x - minX) / scale, y: (p.y - minY) / scale }))
}

function resample(points: Point[], count = 48): Point[] {
  const lengths = [0]
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y))
  const total = lengths[lengths.length - 1]
  if (total < 0.1) return []
  return Array.from({ length: count }, (_, n) => {
    const target = n * total / (count - 1)
    let i = 1
    while (i < lengths.length - 1 && lengths[i] < target) i++
    const ratio = (target - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1)
    return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * ratio,
      y: points[i - 1].y + (points[i].y - points[i - 1].y) * ratio }
  })
}

export function matchesGesture(points: Point[], classId: ClassId): boolean {
  if (points.length < 8) return false
  const sizeX = Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x))
  const sizeY = Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y))
  if (Math.max(sizeX, sizeY) < 60) return false
  const drawn = resample(normalize(points))
  const reference = resample(normalize(templates[classId]))
  const distance = (a: Point[], b: Point[]) => a.reduce((sum, point, i) => sum + Math.hypot(point.x - b[i].x, point.y - b[i].y), 0) / a.length
  // Figuras fechadas aceitam começo em qualquer ponto; figuras abertas aceitam direção invertida.
  const closed = classId !== 'dps'
  let best = Infinity
  for (const orientation of [drawn, [...drawn].reverse()]) {
    for (let offset = 0; offset < (closed ? orientation.length - 1 : 1); offset++) {
      const shifted = closed ? [...orientation.slice(offset, -1), ...orientation.slice(0, offset), orientation[offset]] : orientation
      best = Math.min(best, distance(shifted, reference))
    }
  }
  return best < (classId === 'suporte' ? 0.25 : 0.21)
}