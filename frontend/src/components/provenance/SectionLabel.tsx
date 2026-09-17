import type { ReactNode } from 'react'
import { useGraphTheme } from '../../hooks/useGraphTheme'

/**
 * The micro-heading used inside graph and provenance panels.
 *
 * Was written twice, identically in everything but a rounding error: `TracePanel`
 * used `fontSize: 9, letterSpacing: 1.2px` and `LineageExplorerPage` used
 * `fontSize: 9.5, letterSpacing: 1.4px`. Both read `gt.sectionLabel`.
 *
 * DELIBERATELY NOT `components/dashboard/SectionLabel`. That one carries a section
 * accent and a fading rule, and takes its colour from CSS custom properties. This one
 * takes its colour from the GRAPH theme hook, because it sits inside panels whose
 * palette is driven by the canvas rather than by the page. Folding them together would
 * mean importing the graph theme into the dashboard, which is the wrong direction.
 *
 * Both sizes were off the type scale — there is no 9 or 9.5 step — so this uses
 * `--text-label`, the step they were both approximating.
 */
export function SectionLabel({ children, inline }: {
  children: ReactNode
  /** No bottom margin, for a label that sits on the same row as its content. */
  inline?: boolean
}) {
  const gt = useGraphTheme()
  return (
    <div style={{
      fontSize: 'var(--text-label)', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.12em',
      color: gt.sectionLabel,
      marginBottom: inline ? 0 : 'var(--space-2)',
    }}>
      {children}
    </div>
  )
}

export default SectionLabel
