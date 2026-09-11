/**
 * A percentage, drawn as an arc beside the number it already states.
 *
 * Redundant on purpose — the arc adds no information the digits do not carry.
 * What it adds is instant magnitude: 62% and 18% read as the same amount of ink
 * until one of them is a shape. The track is a hairline and the fill inherits
 * the headline's state colour, so a healthy gauge stays as quiet as the rest
 * of the page.
 */
import { motion, useReducedMotion } from 'framer-motion'

export function Gauge({ pct, size = 76 }: { pct: number; size?: number }) {
  const reduced = useReducedMotion()
  const stroke = 5
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct))

  return (
    <svg width={size} height={size} aria-hidden="true"
         style={{ display: 'block', flexShrink: 0, transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke="var(--color-border)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c}
        initial={reduced ? { strokeDashoffset: c * (1 - clamped / 100) }
                         : { strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - clamped / 100) }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
      />
    </svg>
  )
}
