/**
 * The heading above every dashboard section.
 *
 * Carries the section's accent — this is where most of the page's colour
 * actually lives. The rule beside it fades accent → transparent, which gives
 * each section a visible top edge without boxing it in a card.
 *
 * The existing global `.section-label` class is primary-coloured with a glow
 * and is the same on every section, so it could not do this job.
 */
import type { ReactNode } from 'react'

export function SectionLabel({ children, accent, trailing }: {
  children: ReactNode
  accent?: string
  trailing?: ReactNode
}) {
  const color = accent ?? 'var(--color-muted)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
      {accent && (
        <span aria-hidden="true" style={{
          width: 3, height: 13, borderRadius: 2, background: accent, flexShrink: 0,
        }} />
      )}
      <h2 style={{
        fontFamily: 'var(--font-heading)',
        fontSize: 'var(--text-label)', fontWeight: 700,
        letterSpacing: '0.11em', textTransform: 'uppercase',
        color, margin: 0, whiteSpace: 'nowrap',
      }}>{children}</h2>

      {trailing}

      <span aria-hidden="true" style={{
        flex: 1, height: 1, minWidth: 12,
        background: `linear-gradient(90deg, ${
          accent ? `color-mix(in srgb, ${accent} 45%, transparent)` : 'var(--color-border)'
        } 0%, transparent 100%)`,
      }} />
    </div>
  )
}
