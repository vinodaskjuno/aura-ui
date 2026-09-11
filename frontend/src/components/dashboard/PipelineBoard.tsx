/**
 * Where each system has got to, derived from evidence.
 *
 * A stage is marked done because a pipeline actually ran and succeeded against
 * that project — not because someone ticked a box. There is no project plan in
 * this product to read from, so the run history IS the plan.
 *
 * SHAPE carries the state here, not colour. Four marks are distinguishable at a
 * glance without a legend lookup, and a board of twenty rows stays calm. Only
 * `failed` takes colour, because only `failed` is something to act on — and
 * that keeps this block consistent with the rule the rest of the page follows.
 */
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import type { PipelineBlock, PipelineMark } from '../../api/dashboardView'
import { SectionLabel } from './SectionLabel'
import { accentBorder, accentSurface } from './sectionAccent'

const R = 5

function Mark({ mark }: { mark: PipelineMark }) {
  const neutral = 'var(--color-subtext)'
  const faint = 'var(--color-muted)'
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden="true"
         style={{ display: 'block' }}>
      {mark === 'done' && <circle cx={7} cy={7} r={R} fill={neutral} />}
      {mark === 'partial' && (
        <>
          <circle cx={7} cy={7} r={R} fill="none" stroke={neutral} strokeWidth={1.5} />
          {/* Half-filled: unambiguous at 14px in a way a lighter tint is not. */}
          <path d={`M7,${7 - R} A${R},${R} 0 0 1 7,${7 + R} Z`} fill={neutral} />
        </>
      )}
      {mark === 'failed' && (
        <>
          <circle cx={7} cy={7} r={R} fill="none"
                  stroke="var(--color-danger)" strokeWidth={1.5} />
          <path d="M4.8,4.8 L9.2,9.2 M9.2,4.8 L4.8,9.2"
                stroke="var(--color-danger)" strokeWidth={1.5} strokeLinecap="round" />
        </>
      )}
      {mark === 'none' && (
        <circle cx={7} cy={7} r={R} fill="none" stroke={faint} strokeWidth={1} />
      )}
      {/* A dash, not an empty circle: "we cannot tell" must not look like
          "nothing happened here", which is what an empty circle says. */}
      {mark === 'unknown' && (
        <path d="M3,7 L11,7" stroke={faint} strokeWidth={1.5} strokeLinecap="round" />
      )}
    </svg>
  )
}

const LABELS: Record<PipelineMark, string> = {
  done: 'done', partial: 'partial', failed: 'failed',
  none: 'not started', unknown: 'cannot be determined',
}

export function PipelineBoard({ block, delay = 0, accent }: {
  block: PipelineBlock; delay?: number; accent?: string
}) {
  const cols = `minmax(150px, 1.4fr) repeat(${block.stages.length}, minmax(72px, 1fr))`

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <SectionLabel accent={accent}>{block.title}</SectionLabel>

      {block.rows.length === 0 ? (
        <p style={{ fontSize: 'var(--text-body)', color: 'var(--color-subtext)', margin: 0 }}>
          No systems registered yet.
        </p>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] }}
          style={{
            border: `1px solid ${accent ? accentBorder(accent) : 'var(--color-border)'}`,
            borderRadius: 'var(--radius-md)',
            background: accent
              ? `linear-gradient(160deg, ${accentSurface(accent)} 0%, var(--color-card) 60%)`
              : 'var(--color-card)',
            padding: 'var(--space-4)',
            overflowX: 'auto',
          }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols,
                        alignItems: 'center', rowGap: 'var(--space-3)',
                        minWidth: 520 }}>
            <span />
            {block.stages.map(s => (
              <span key={s} style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'var(--text-label)', fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'var(--color-muted)', textAlign: 'center',
              }}>{s}</span>
            ))}

            {block.rows.map(row => (
              <Row key={row.label} row={row} stages={block.stages} />
            ))}
          </div>
        </motion.div>
      )}

      <p style={{ fontSize: 'var(--text-caption)', color: 'var(--color-muted)', margin: 0 }}>
        {block.legend ?? 'Stage reached is derived from pipeline runs, not self-reported.'}
      </p>
    </section>
  )
}

function Row({ row, stages }: { row: PipelineBlock['rows'][number]; stages: string[] }) {
  const name = (
    <span style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)',
                   whiteSpace: 'nowrap', overflow: 'hidden',
                   textOverflow: 'ellipsis', paddingRight: 'var(--space-3)' }}>
      {row.label}
    </span>
  )
  return (
    <>
      {row.href
        ? <Link to={row.href} style={{ textDecoration: 'none', minWidth: 0 }}>{name}</Link>
        : name}
      {stages.map((stage, i) => {
        const mark = row.marks[i] ?? 'none'
        return (
          <div key={stage} style={{ display: 'flex', justifyContent: 'center',
                                    alignItems: 'center', position: 'relative' }}>
            {/* Connector, drawn behind the mark so the run reads as one track. */}
            {i > 0 && (
              <span aria-hidden="true" style={{
                position: 'absolute', right: '50%', width: '100%', height: 1,
                background: 'var(--color-border)',
              }} />
            )}
            <span title={`${stage}: ${LABELS[mark]}`}
                  style={{ position: 'relative', background: 'var(--color-card)',
                           padding: '0 4px', display: 'flex' }}>
              <Mark mark={mark} />
            </span>
          </div>
        )
      })}
    </>
  )
}
