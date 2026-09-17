import type { ReactNode } from 'react'

/**
 * A page's title row.
 *
 * Sixteen hand-styled `h1`/`h2` blocks across twelve page files, at font sizes 20, 22,
 * 24, 26 and 30, some using `--font-heading` and some not. The type scale has
 * `--text-hero: 40px` and `--text-metric: 28px` and nothing between, which is part of
 * why everyone picked their own number.
 *
 * A page title is not a hero number, so it uses `--text-metric` with the heading face —
 * one decision, made here, instead of twelve.
 */
export function PageHeader({ title, subtitle, actions, style }: {
  title: ReactNode
  subtitle?: ReactNode
  /** Right-aligned controls, aligned to the TITLE's baseline rather than the block's
   *  centre — otherwise a two-line subtitle drags the buttons downward. */
  actions?: ReactNode
  style?: React.CSSProperties
}) {
  return (
    <header style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      gap: 'var(--space-4)', marginBottom: 'var(--space-4)', ...style,
    }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{
          margin: 0, fontFamily: 'var(--font-heading)',
          fontSize: 'var(--text-metric)', fontWeight: 700,
          color: 'var(--color-text)', lineHeight: 1.2, letterSpacing: '-0.01em',
        }}>{title}</h1>
        {subtitle && (
          <p style={{
            margin: 'var(--space-1) 0 0', fontSize: 'var(--text-body)',
            color: 'var(--color-subtext)', lineHeight: 1.5, maxWidth: '68ch',
          }}>{subtitle}</p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                      flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </header>
  )
}

export default PageHeader
