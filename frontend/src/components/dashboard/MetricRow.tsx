/**
 * A row of standing metrics.
 *
 * `auto-fit`/`minmax` rather than a fixed column count: the old dashboard used
 * `repeat(8, 1fr)` with no breakpoints, so eight tiles were squeezed to 90px on
 * a laptop and stretched 200px apart on a monitor. The number of metrics in a
 * block is decided by the role, so the grid cannot assume a count.
 *
 * Tiles reveal left to right on a short stagger. It reads as the panel filling
 * in, and it gives the eye an order to follow on a screen with no colour to
 * lead it.
 */
import type { MetricsBlock } from '../../api/dashboardView'
import { Metric } from '../ui/Metric'
import { SectionLabel } from './SectionLabel'

export function MetricRow({ block, delay = 0, accent }: {
  block: MetricsBlock; delay?: number; accent?: string
}) {
  if (block.items.length === 0) return null
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {block.title && <SectionLabel accent={accent}>{block.title}</SectionLabel>}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        gap: 'var(--space-3)',
        alignItems: 'stretch',
      }}>
        {block.items.map((m, i) => (
          <Metric key={m.label} label={m.label} value={m.value} unit={m.unit}
                  state={m.state} basis={m.basis} reason={m.reason}
                  href={m.href} spark={m.spark} delay={delay + i * 0.05}
                  accent={accent} />
        ))}
      </div>
    </section>
  )
}
