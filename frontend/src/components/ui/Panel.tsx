import { useCallback, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * A bordered box with a title row. The single most duplicated thing in this codebase.
 *
 * A census of `src` found **114 files** declaring their own `border: '1px solid …'` +
 * `borderRadius` container, **67** of which also hand-build a title row, plus **8**
 * files carrying a private `card`/`panel`/`box` style const. Against that, the existing
 * `.ov-card` class is used by 9 files and the `ui/Card` component by exactly 1.
 *
 * They drifted, as copies do: radii of 6, 8 and 10 where the token says
 * `--radius-md: 10`; title rows at 11, 11.5, 12, 12.5 and 13px where the type scale has
 * six steps and says so ("a size not on this list is a bug", index.css:13-16).
 *
 * WHY NOT EXTEND `ui/Card`. `Card` is a thin `.ov-card` wrapper with a motion entrance
 * and no slots — it has no title, no actions, no collapse. Growing it would change the
 * one page using it. This is the composite; `Card` stays the plain surface.
 *
 * COLLAPSE STATE CAN PERSIST. Pass `storageKey` and the open/closed choice survives a
 * reload. Today exactly one piece of UI state in the whole dev-chat tree does
 * (`floci.terminal.<id>`); eight others are lost on every navigation. Reads and writes
 * are wrapped because storage throws in some privacy modes, and a panel preference must
 * never be the thing that stops a page rendering.
 */
export interface PanelProps {
  title?: ReactNode
  /** Rendered before the title at 13px. Pass the element, not the component. */
  icon?: ReactNode
  /** One quiet line under the title — units, provenance, scope. */
  subtitle?: ReactNode
  /** Right-aligned controls in the title row. Use this instead of absolute
   *  positioning: `PolicyPanel` used to place its Details button at
   *  `top: 9, right: 10`, overlapping its own header. */
  actions?: ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
  /** localStorage key for the open/closed state. Implies `collapsible`. */
  storageKey?: string
  /** Tighter padding, for a panel inside another panel or inside a rail. */
  dense?: boolean
  /** No border or padding — just the title row. For a section inside a Panel. */
  flush?: boolean
  children?: ReactNode
  style?: React.CSSProperties
  bodyStyle?: React.CSSProperties
}

function readStored(key: string | undefined, fallback: boolean): boolean {
  if (!key) return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : raw === '1'
  } catch {
    return fallback
  }
}

export function Panel({
  title, icon, subtitle, actions,
  collapsible, defaultOpen = true, storageKey,
  dense, flush, children, style, bodyStyle,
}: PanelProps) {
  const canCollapse = collapsible || !!storageKey
  const [open, setOpen] = useState(() => readStored(storageKey, defaultOpen))

  const toggle = useCallback(() => {
    setOpen(was => {
      const next = !was
      if (storageKey) {
        try { localStorage.setItem(storageKey, next ? '1' : '0') }
        catch { /* a preference is not worth an error */ }
      }
      return next
    })
  }, [storageKey])

  const pad = dense ? 'var(--space-2)' : 'var(--space-3)'
  const hasHeader = !!(title || actions)

  const header = hasHeader && (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
      padding: flush ? 0 : `${pad} ${pad}`,
      paddingBottom: children && open ? 'var(--space-2)' : undefined,
      minWidth: 0,
    }}>
      {canCollapse && (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          style={{
            display: 'flex', alignItems: 'center', background: 'none',
            border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0,
            color: 'var(--color-muted)',
          }}
        >
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
      )}
      {icon && (
        <span style={{ display: 'flex', flexShrink: 0, color: 'var(--color-muted)' }}>
          {icon}
        </span>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        {title && (
          <div style={{
            fontSize: 'var(--text-title)', fontWeight: 600,
            color: 'var(--color-text)', lineHeight: 1.3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{title}</div>
        )}
        {subtitle && (
          <div style={{
            fontSize: 'var(--text-caption)', color: 'var(--color-muted)',
            lineHeight: 1.4, marginTop: 1,
          }}>{subtitle}</div>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
                      flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  )

  const body = children && open && (
    <div style={{
      padding: flush ? 0 : pad,
      paddingTop: hasHeader && !flush ? 0 : undefined,
      minWidth: 0,
      ...bodyStyle,
    }}>{children}</div>
  )

  if (flush) {
    return <div style={style}>{header}{body}</div>
  }

  return (
    <div style={{
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      background: 'var(--color-card)',
      minWidth: 0,
      ...style,
    }}>
      {header}
      {body}
    </div>
  )
}

export default Panel
