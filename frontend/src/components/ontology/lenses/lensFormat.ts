/**
 * Value formatting for lens cards and KPI tiles.
 *
 * Kept separate from the registry so definitions stay declarative — a card
 * says `{ key: 'linesOfCode', format: 'compact' }` rather than carrying a
 * render function.
 */
import type { FieldFormat, FieldThresholds } from './lensTypes'

const MS_DAY = 86_400_000

export function compact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e9) return `${(n / 1e9).toFixed(abs >= 1e10 ? 0 : 1)}b`
  if (abs >= 1e6) return `${(n / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}m`
  if (abs >= 1e3) return `${(n / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}k`
  return String(n)
}

export function duration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

/** Days between an ISO timestamp and now; null when unparseable. */
export function daysSince(iso: unknown): number | null {
  if (typeof iso !== 'string' || !iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return (Date.now() - t) / MS_DAY
}

export function relative(iso: unknown): string {
  const d = daysSince(iso)
  if (d === null) return '—'
  if (d < 0) {
    const f = Math.abs(d)
    if (f < 1) return 'soon'
    if (f < 30) return `in ${Math.round(f)}d`
    if (f < 365) return `in ${Math.round(f / 30)}mo`
    return `in ${(f / 365).toFixed(1)}y`
  }
  if (d < 1) return 'today'
  if (d < 30) return `${Math.round(d)}d ago`
  if (d < 365) return `${Math.round(d / 30)}mo ago`
  return `${(d / 365).toFixed(1)}y ago`
}

/** Trim a path to its last two segments: 'src/adjudication/engine.py' → 'adjudication/engine.py'. */
export function pathTail(p: unknown): string {
  const s = String(p ?? '')
  const parts = s.split('/').filter(Boolean)
  return parts.length <= 2 ? s : parts.slice(-2).join('/')
}

export function formatField(value: unknown, format: FieldFormat = 'text'): string {
  if (value === null || value === undefined || value === '') return '—'
  const num = typeof value === 'number' ? value : Number(value)
  const isNum = typeof value === 'number' || (value !== '' && !Number.isNaN(num))

  switch (format) {
    case 'number':   return isNum ? num.toLocaleString() : String(value)
    case 'compact':  return isNum ? compact(num) : String(value)
    // 'percent' takes a 0–1 ratio; 'ratio' takes an already-scaled 0–100 value.
    case 'percent':  return isNum ? `${(num * 100).toFixed(num >= 0.995 ? 0 : 0)}%` : String(value)
    case 'ratio':    return isNum ? `${num.toFixed(1)}%` : String(value)
    case 'duration': return isNum ? duration(num) : String(value)
    case 'bytes':    return isNum ? `${compact(num)}B` : String(value)
    case 'mb':       return isNum ? `${num.toLocaleString()} MB` : String(value)
    case 'gb':       return isNum ? `${num.toLocaleString()} GB` : String(value)
    case 'currency': return isNum ? `$${compact(num)}` : String(value)
    case 'relative': return relative(value)
    case 'date':     return typeof value === 'string' ? value.slice(0, 10) : String(value)
    case 'bool':     return value === true ? '✓' : value === false ? '✗' : '—'
    case 'pathTail': return pathTail(value)
    case 'mono':
    case 'text':
    default:         return String(value)
  }
}

/**
 * Resolve a threshold colour, or null when the value says nothing.
 * Returns null (not green) for missing data — absent evidence must never
 * render as a pass.
 */
export function thresholdColor(value: unknown, t?: FieldThresholds): string | null {
  if (!t || value === null || value === undefined) return null
  const n = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(n)) return null

  const GREEN = '#22c55e', AMBER = '#f59e0b', RED = '#ef4444'
  const higher = t.direction === 'higher-is-better'

  if (higher) {
    if (t.bad !== undefined && n <= t.bad) return RED
    if (t.warn !== undefined && n <= t.warn) return AMBER
    if (t.good !== undefined && n >= t.good) return GREEN
    return null
  }
  if (t.bad !== undefined && n >= t.bad) return RED
  if (t.warn !== undefined && n >= t.warn) return AMBER
  if (t.good !== undefined && n <= t.good) return GREEN
  return null
}

/**
 * Stable colour for a label with no configured palette entry.
 * Re-exported from nodePalette so the canvas, legend and cards all derive
 * unmapped colours from one implementation.
 */
export { fallbackColor as hashColor } from './nodePalette'
