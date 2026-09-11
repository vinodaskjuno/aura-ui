/**
 * The one sentence at the top of a role's dashboard.
 *
 * Deliberately a sentence and not a KPI: the first thing a person reads in the
 * morning should be an answer ("2 of 5 systems are stalled"), not a quantity
 * they have to interpret. The old dashboard opened with "Total Entities 1,672",
 * which no role has ever needed to know.
 *
 * This is the only place a hero-sized number appears, the only place an entire
 * line may be coloured — when the headline IS the problem — and the only place
 * the ambient glow is used, so it reads as the page's single focal point.
 */
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { stateColor, type MetricState } from './metricState'
import { Gauge } from '../dashboard/Gauge'
import { TrendChart, type TrendData } from '../dashboard/TrendChart'

export interface HeadlineProps {
  text: string
  detail?: string
  state?: MetricState
  /** A percentage the text already states, drawn as an arc. */
  gauge?: number | null
  /** The hero metric's own history. A total cannot answer "is that normal?" */
  trend?: TrendData | null
  action?: { label: string; href: string }
  /** The hero band's identity colour, for the trend chart. */
  accent?: string
}

export function Headline({
  text, detail, state = 'ok', gauge, trend, action, accent,
}: HeadlineProps) {
  const reduced = useReducedMotion()
  const color = stateColor(state)

  return (
    <div style={{ position: 'relative', minWidth: 0 }}>
      {/* Ambient wash behind the hero only. Pointer-events none, and it sits
          under the text rather than tinting it. */}
      {/* The wash is allowed to bleed LEFT, into the page gutter, and nowhere
          else. It previously used a negative inset on all four sides:
          `top: -40` put it over the metrics strip once that moved to the top of
          the page, and `right: -80` put it under the attention rail. A
          decorative layer must never cross into a neighbouring column. */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: 0, left: -80, right: 0, height: 260,
        background: 'var(--glow-hero)', pointerEvents: 'none', zIndex: 0,
      }} />

      <motion.div
        initial={reduced ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'relative', zIndex: 1,
          display: 'flex', alignItems: 'center', gap: 'var(--space-6)',
          minWidth: 0,
        }}
      >
        {typeof gauge === 'number' && (
          <div style={{ color: color ?? 'var(--color-primary)' }}>
            <Gauge pct={gauge} />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column',
                      gap: 'var(--space-2)', minWidth: 0 }}>
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'var(--text-hero)', fontWeight: 700,
            letterSpacing: '-0.03em', lineHeight: 1.1,
            textWrap: 'balance',
            fontVariantNumeric: 'tabular-nums',
            color: color ?? 'var(--color-text)',
            margin: 0,
          }}>{text}</h1>

          {detail && (
            <motion.p
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              style={{
                fontSize: 'var(--text-body)', lineHeight: 1.55,
                color: 'var(--color-subtext)', margin: 0, maxWidth: '62ch',
              }}
            >{detail}</motion.p>
          )}

          {action && (
            <Link to={action.href} className="headline-action" style={{
              marginTop: 'var(--space-2)', alignSelf: 'flex-start',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontFamily: 'var(--font-heading)',
              fontSize: 'var(--text-body)', fontWeight: 600,
              color: 'var(--color-primary)', textDecoration: 'none',
            }}>
              {action.label}
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </motion.div>

      {trend && (
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          style={{ position: 'relative', zIndex: 1, marginTop: 'var(--space-8)' }}
        >
          <TrendChart trend={trend} accent={accent ?? 'var(--color-primary)'} />
        </motion.div>
      )}
    </div>
  )
}
