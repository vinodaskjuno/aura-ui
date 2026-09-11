/**
 * The hero metric's own history, filling the column beneath the headline.
 *
 * The headline states a total — "$1.38 spent in the last 30 days" — and a total
 * on its own cannot answer the question that immediately follows it: is that
 * normal? This chart is the answer, and it is why the space under the headline
 * exists rather than being empty.
 *
 * Hand-built rather than recharts: the two chart styles already in this app
 * disagree (one token-driven, one hardcoded dark-only), it keeps the same
 * drawing conventions as Sparkline, and nothing here needs an axis library.
 *
 * DRAWN IN REAL PIXELS, measured. The first version used a 0–100 viewBox with
 * `preserveAspectRatio="none"`, which stretches the coordinate space ~8x
 * horizontally — so the endpoint `<circle>` rendered as a wide flat ellipse and,
 * with `overflow: visible`, spilled out of the column and over the attention
 * rail beside it. Non-uniform scaling and round markers cannot coexist; the fix
 * is to scale nothing and compute the geometry against the measured width.
 */
import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useId, useRef, useState } from 'react'

export interface TrendData {
  label: string
  series: number[]
  unit?: string
  /** Formats the readout as currency rather than a count. */
  money?: boolean
}

const H = 150
const PAD_TOP = 14
const PAD_BOTTOM = 22
/** Room for the endpoint marker and the line cap, so neither is clipped. */
const PAD_X = 6

/** The container's content width, tracked so the chart can draw unscaled. */
function useWidth() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? 0
      // Round: sub-pixel churn would re-render this on every scrollbar reflow.
      setWidth(Math.round(w))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return [ref, width] as const
}

export function TrendChart({ trend, accent = 'var(--color-primary)' }: {
  trend: TrendData
  accent?: string
}) {
  const reduced = useReducedMotion()
  const gradientId = useId()
  const [hover, setHover] = useState<number | null>(null)
  const [ref, width] = useWidth()
  const { series, label, unit, money } = trend

  const enough = series.length >= 3
  const max = enough ? Math.max(...series) : 0
  const min = enough ? Math.min(0, ...series) : 0   // a count chart sits on zero
  const span = max - min || 1

  const fmt = (v: number) =>
    money ? `$${v.toFixed(2)}` : `${Math.round(v).toLocaleString()}${unit ?? ''}`

  // Geometry only once the container has been measured. Until then the wrapper
  // still reserves its height, so nothing jumps when the numbers arrive.
  const inner = Math.max(0, width - PAD_X * 2)
  const ready = enough && inner > 0

  const x = (i: number) => PAD_X + (i / (series.length - 1)) * inner
  const y = (v: number) => PAD_TOP + (1 - (v - min) / span) * (H - PAD_TOP - PAD_BOTTOM)

  const pts = ready ? series.map((v, i) => [x(i), y(v)] as const) : []
  const line = pts.map(([px, py], i) =>
    `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ')
  const area = ready
    ? `${line} L${x(series.length - 1).toFixed(1)},${H - PAD_BOTTOM} `
      + `L${PAD_X},${H - PAD_BOTTOM} Z`
    : ''

  const active = hover ?? series.length - 1
  const [ax, ay] = pts[active] ?? [0, 0]
  const step = ready ? inner / (series.length - 1) : 0

  if (!enough) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
                  minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline',
                    justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <span style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'var(--text-label)', fontWeight: 700,
          letterSpacing: '0.11em', textTransform: 'uppercase',
          color: 'var(--color-muted)',
        }}>{label}</span>
        <span style={{
          fontSize: 'var(--text-caption)', fontVariantNumeric: 'tabular-nums',
          color: hover === null ? 'var(--color-subtext)' : 'var(--color-text)',
          fontWeight: hover === null ? 400 : 600, whiteSpace: 'nowrap',
        }}>
          {hover === null
            ? `peak ${fmt(max)}`
            : `${daysAgoLabel(series.length - 1 - hover)} · ${fmt(series[hover])}`}
        </span>
      </div>

      <div
        ref={ref}
        onMouseLeave={() => setHover(null)}
        style={{
          position: 'relative', color: accent, height: H,
          // Belt and braces: even if the geometry were ever wrong again, it
          // cannot reach the column next door.
          overflow: 'hidden', minWidth: 0,
        }}
      >
        {ready && (
          <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`}
               role="img"
               aria-label={`${label}: ${series.length} days, peak ${fmt(max)}`}
               style={{ display: 'block' }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity={0.28} />
                <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* Three hairlines. Enough to judge magnitude, not a grid. */}
            {[0, 0.5, 1].map(f => (
              <line key={f} x1={0} x2={width}
                    y1={y(min + span * f)} y2={y(min + span * f)}
                    stroke="var(--color-border)" strokeWidth={1}
                    opacity={f === 0 ? 1 : 0.45} />
            ))}

            <motion.path d={area} fill={`url(#${gradientId})`}
                         initial={reduced ? false : { opacity: 0 }}
                         animate={{ opacity: 1 }}
                         transition={{ duration: 0.6, delay: 0.3 }} />
            <motion.path d={line} fill="none" stroke="currentColor" strokeWidth={2}
                         strokeLinecap="round" strokeLinejoin="round"
                         initial={reduced ? false : { pathLength: 0 }}
                         animate={{ pathLength: 1 }}
                         transition={{ duration: 1, ease: 'easeOut' }} />

            {hover !== null && (
              <line x1={ax} x2={ax} y1={PAD_TOP} y2={H - PAD_BOTTOM}
                    stroke="currentColor" strokeWidth={1} opacity={0.4} />
            )}
            {/* A real circle now, because the coordinate space is square. */}
            <circle cx={ax} cy={ay} r={3.5} fill="var(--color-bg)"
                    stroke="currentColor" strokeWidth={2} />

            {/* Invisible hit targets — one per day, full height, so the readout
                tracks the pointer without needing pixel maths at the call site. */}
            {series.map((_, i) => (
              <rect key={i} x={x(i) - step / 2} y={0} width={step || 1} height={H}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)} style={{ cursor: 'crosshair' }} />
            ))}
          </svg>
        )}
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 'var(--text-caption)', color: 'var(--color-muted)',
      }}>
        {/* index 0 of a 30-point series is 29 days back, not 30. */}
        <span>{series.length - 1} days ago</span>
        <span>today</span>
      </div>
    </div>
  )
}

function daysAgoLabel(n: number): string {
  if (n === 0) return 'today'
  return n === 1 ? 'yesterday' : `${n} days ago`
}
