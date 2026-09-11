/**
 * The role's working set — projects, runs, jobs.
 *
 * The only block type that gets a bordered surface, because a table needs an
 * edge to read as one object. Metrics get their own tiles; a table gets a frame.
 *
 * Rows fade in on a short stagger and lift their background on hover, so a
 * clickable row looks clickable. Wide tables scroll inside their own container
 * so the page body never scrolls sideways.
 */
import { motion, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import type { ListBlock } from '../../api/dashboardView'
import { stateColor } from '../ui/metricState'
import { SectionLabel } from './SectionLabel'
import { accentBorder, accentSurface } from './sectionAccent'

export function DataList({ block, delay = 0, accent }: {
  block: ListBlock; delay?: number; accent?: string
}) {
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const [hovered, setHovered] = useState<number | null>(null)

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <SectionLabel accent={accent}>{block.title}</SectionLabel>

      {block.rows.length === 0 ? (
        // Distinguishable from a failure: this says what would be here.
        <p style={{ fontSize: 'var(--text-body)', color: 'var(--color-subtext)',
                    margin: 0, padding: 'var(--space-4) 0' }}>
          {block.empty ?? 'Nothing to show yet.'}
        </p>
      ) : (
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] }}
          style={{
            border: `1px solid ${accent ? accentBorder(accent) : 'var(--color-border)'}`,
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-card)',
            overflowX: 'auto', overflowY: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse',
                          fontSize: 'var(--text-body)' }}>
            <thead>
              <tr>
                {block.columns.map(c => (
                  <th key={c.key} scope="col" style={{
                    textAlign: c.align ?? 'left',
                    padding: 'var(--space-3) var(--space-4)',
                    fontFamily: 'var(--font-heading)',
                    fontSize: 'var(--text-label)', fontWeight: 700,
                    letterSpacing: '0.11em', textTransform: 'uppercase',
                    color: accent
                      ? `color-mix(in srgb, ${accent} 62%, var(--color-muted))`
                      : 'var(--color-muted)',
                    background: accent
                      ? accentSurface(accent) : 'var(--color-surface)',
                    borderBottom: `1px solid ${
                      accent ? accentBorder(accent) : 'var(--color-border)'}`,
                    whiteSpace: 'nowrap',
                  }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <motion.tr
                  key={ri}
                  initial={reduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25, delay: reduced ? 0 : delay + ri * 0.03 }}
                  onMouseEnter={() => setHovered(ri)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={row.href ? () => navigate(row.href!) : undefined}
                  style={{
                    cursor: row.href ? 'pointer' : undefined,
                    background: hovered === ri && row.href
                      ? 'var(--color-card-hover)' : 'transparent',
                    transition: 'background 0.15s ease',
                    borderTop: ri === 0 ? 'none' : '1px solid var(--color-border)',
                  }}
                >
                  {row.cells.map((cell, ci) => {
                    const color = cell.state ? stateColor(cell.state) : null
                    return (
                      <td key={ci} style={{
                        textAlign: block.columns[ci]?.align ?? 'left',
                        padding: 'var(--space-3) var(--space-4)',
                        color: color ?? (ci === 0 ? 'var(--color-text)' : 'var(--color-subtext)'),
                        fontFamily: cell.mono ? 'var(--font-mono)' : undefined,
                        fontWeight: ci === 0 ? 500 : 400,
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                      }}>{cell.text}</td>
                    )
                  })}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}
    </section>
  )
}
