/**
 * Fourteen or thirty days of one number, drawn small.
 *
 * Monochrome and inheriting `currentColor`, so it takes the state colour of the
 * metric it belongs to and adds no colour of its own. The line draws itself in
 * once on mount — the motion is what tells you it is live data rather than an
 * illustration — and the final point is emphasised because "where it is now"
 * is the only point anyone reads precisely.
 *
 * Never rendered for a series the server did not send. A decorative sparkline
 * is the same lie as a zero standing in for an unmeasured value.
 */
import { motion, useReducedMotion } from 'framer-motion'
import { useId } from 'react'

export function Sparkline({ data, width = 96, height = 28 }: {
  data: number[]
  width?: number
  height?: number
}) {
  const reduced = useReducedMotion()
  const gradientId = useId()

  if (!data || data.length < 3) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const span = max - min || 1
  const pad = 2
  const stepX = (width - pad * 2) / (data.length - 1)
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2)

  const points = data.map((v, i) => [pad + i * stepX, y(v)] as const)
  const line = points.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ')
  const area = `${line} L${points[points.length - 1][0].toFixed(1)},${height} L${pad},${height} Z`
  const [lastX, lastY] = points[points.length - 1]

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}
         aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.18} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>

      <motion.path
        d={area} fill={`url(#${gradientId})`}
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.35 }}
      />
      <motion.path
        d={line} fill="none" stroke="currentColor" strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round" opacity={0.65}
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
      <motion.circle
        cx={lastX} cy={lastY} r={2.5} fill="currentColor"
        initial={reduced ? false : { scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.25, delay: 0.75 }}
      />
    </svg>
  )
}
