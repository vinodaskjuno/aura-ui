/**
 * The one metric component.
 *
 * Replaces nine near-duplicate KPI cards — three of which (DashboardPage,
 * MetricsDashboard, DevChatbotPage) were the same card written three times,
 * down to the 2px gradient bar and the `${color}15` icon chip.
 *
 * Three rules are enforced here rather than left to each caller:
 *
 *   1. No `icon` prop exists. Icons belong on things you can click, not beside
 *      a number. The old tiles carried a perpetually-wobbling icon chip that
 *      conveyed nothing.
 *   2. No per-metric colour. A tile gets a surface so it has weight on the
 *      page, but that surface is the same for every metric — what varies is
 *      the NUMBER's colour, and only when something is wrong.
 *   3. Colour comes from `state` and nowhere else — see ui/metricState.ts.
 *
 * Motion earns its place: the value counts up so the eye follows it, and the
 * sparkline draws itself so the panel reads as live rather than printed. Both
 * run once, and neither runs under `prefers-reduced-motion`.
 */
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useState, type ReactNode } from 'react'
import { formatValue, isAbsent, stateColor, type MetricState } from './metricState'
import { Sparkline } from '../dashboard/Sparkline'
import { useCountUp } from '../dashboard/useCountUp'
import { accentBorder, accentSurface } from '../dashboard/sectionAccent'

export interface MetricProps {
  /** Uppercase micro-label above the value. The metric's name. */
  label: string
  value: number | string | null
  /** Appended directly to the value — '%', 'ms'. A '$' goes in `value`. */
  unit?: string
  state?: MetricState
  /** What the number is *of*: "18 of 29 verified", "no run has completed". */
  basis?: ReactNode
  /** Why a value is unavailable. Surfaces as the native tooltip. */
  reason?: string
  href?: string
  /** Real daily history. Never synthesise one to fill the space. */
  spark?: number[]
  size?: 'metric' | 'compact'
  /** Entrance stagger, seconds. */
  delay?: number
  /** Panel chrome. Off for in-page strips that sit on their own surface. */
  surface?: boolean
  /** The owning section's identity colour. Applied to CHROME only — wash,
   *  border, and the sparkline at rest. Never to the value: that belongs to
   *  `state`, so a critical number stays red inside any section. */
  accent?: string
}

export function Metric({
  label, value, unit, state = 'ok', basis, reason, href,
  spark, size = 'metric', delay = 0, surface = true, accent,
}: MetricProps) {
  const reduced = useReducedMotion()
  const [hover, setHover] = useState(false)
  const color = stateColor(state)

  // Only a bare number counts up. A currency string or an em-dash is untouched.
  const numeric = typeof value === 'number' && !isAbsent(state) ? value : null
  const counted = useCountUp(numeric)
  const shown = formatValue(numeric !== null ? counted : value, state, unit)

  const compact = size === 'compact'
  const interactive = Boolean(href)

  const body = (
    <motion.div
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
        height: '100%',
        ...(surface ? {
          // The wash reads as "this tile belongs to that section". It is kept
          // under 8% so text contrast is unaffected in all three themes.
          background: accent
            ? `linear-gradient(145deg, ${accentSurface(accent)} 0%, var(--color-card) 70%)`
            : 'var(--color-card)',
          border: '1px solid var(--color-border)',
          borderColor: accent
            ? accentBorder(accent, hover && interactive ? 52 : 22)
            : (hover && interactive ? 'var(--color-border-hi)' : 'var(--color-border)'),
          borderRadius: 'var(--radius-md)',
          padding: compact ? 'var(--space-3) var(--space-4)' : 'var(--space-4)',
          // A lift on hover, and only when there is somewhere to go.
          transform: hover && interactive && !reduced ? 'translateY(-2px)' : 'none',
          boxShadow: hover && interactive
            ? (accent ? `0 6px 20px color-mix(in srgb, ${accent} 16%, transparent)`
                      : 'var(--shadow-md)')
            : 'none',
          transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
        } : {}),
      }}
    >
      <span style={{
        fontFamily: 'var(--font-heading)',
        fontSize: 'var(--text-label)', fontWeight: 700,
        letterSpacing: '0.11em', textTransform: 'uppercase',
        // Tinted toward the section, not fully saturated — a wall of accent
        // labels at full strength competes with the values above them.
        color: accent
          ? `color-mix(in srgb, ${accent} 62%, var(--color-muted))`
          : 'var(--color-muted)',
      }}>{label}</span>

      <div style={{
        display: 'flex', alignItems: 'flex-end',
        justifyContent: 'space-between', gap: 'var(--space-3)',
        // The sparkline inherits the value's colour through currentColor, so a
        // metric in trouble carries its state all the way through the chart.
        color: color ?? 'var(--color-text)',
      }}>
        <span
          title={state === 'unavailable' && reason ? reason : undefined}
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: compact ? 'var(--text-title)' : 'var(--text-metric)',
            fontWeight: compact ? 700 : 600,
            letterSpacing: compact ? 0 : '-0.02em',
            lineHeight: 1.05,
            fontVariantNumeric: 'tabular-nums',
            color: 'inherit',
            cursor: state === 'unavailable' && reason ? 'help' : undefined,
          }}
        >{shown}</span>

        {spark && !isAbsent(state) && (
          // A healthy chart wears the section accent; a chart in trouble keeps
          // the state colour it inherits, so the warning still carries.
          <span style={{ color: color ?? accent ?? 'var(--color-primary)' }}>
            <Sparkline data={spark} width={compact ? 64 : 88} height={compact ? 20 : 26} />
          </span>
        )}
      </div>

      {basis && (
        <span style={{
          fontSize: 'var(--text-caption)', lineHeight: 1.35,
          color: isAbsent(state) ? 'var(--color-muted)' : 'var(--color-subtext)',
          marginTop: 'auto',
        }}>{basis}</span>
      )}
    </motion.div>
  )

  if (!href) return body

  // Every number navigates somewhere that explains it. A metric you cannot
  // drill into is a number you have to take on faith.
  return <Link to={href} style={{ textDecoration: 'none', display: 'block',
                                  height: '100%' }}>{body}</Link>
}
