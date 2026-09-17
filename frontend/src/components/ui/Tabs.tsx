import { useSearchParams } from 'react-router-dom'
import type { ReactNode } from 'react'

/**
 * The tab bar, once.
 *
 * There are **11 hand-rolled implementations** in `src`, and six of them differ only in
 * details nobody chose on purpose:
 *
 *   AIObservabilityPage  fontSize 12.5, padding 8px 14px,  colour hardcoded #4f46e5
 *   AIOpsPage            fontSize 13,   padding 8px 14px,  marginBottom -1, + count pill
 *   ObservabilityPage    fontSize 12.5, padding 9px 14px,  marginBottom -1
 *   QAWorkspacePage      fontSize 13,   padding 10px 14px, marginBottom -1
 *   ReverseEngineering   fontSize 13,   padding 8px 14px
 *   GatewayTab           fontSize 12.5, sub-tabs
 *
 * Two more use a theme hook's `gt.accent` and one uses a raw `#4a9eff`, so they can
 * never be restyled centrally at all.
 *
 * `marginBottom: -1` matters and is kept: it pulls the active tab's 2px underline over
 * the container's own 1px bottom border so the two read as one line. Four of the eleven
 * remembered it.
 *
 * VARIANTS ARE REAL, NOT COSMETIC. `OntologyDataLoaderPage` uses a rounded-top filled
 * tab because its bar sits INSIDE a bordered panel, where an underline would collide
 * with the panel's own edge. That is `variant="enclosed"`.
 */
export interface TabDef<Id extends string = string> {
  id: Id
  label: ReactNode
  /** Pass the element (`<Play size={13} />`), not the component. */
  icon?: ReactNode
  /** Rendered as a pill after the label. `0` shows; `undefined` does not. */
  count?: number
  disabled?: boolean
}

export interface TabsProps<Id extends string = string> {
  tabs: readonly TabDef<Id>[]
  value: Id
  onChange: (id: Id) => void
  /** Deep-link through a query parameter, usually `"tab"`. When set, the URL is the
   *  source of truth and `onChange` still fires — two pages already do this by hand
   *  because `NavLink ... end` makes real sub-routes lose their nav highlight. */
  param?: string
  /** `underline` (default) for a bar over page content; `enclosed` for a bar inside
   *  a bordered container. */
  variant?: 'underline' | 'enclosed'
  /** Right-aligned content on the same row — a filter, a refresh button. */
  actions?: ReactNode
  style?: React.CSSProperties
}

export function Tabs<Id extends string = string>({
  tabs, value, onChange, param, variant = 'underline', actions, style,
}: TabsProps<Id>) {
  const [params, setParams] = useSearchParams()
  const active = (param ? (params.get(param) as Id) : null) || value

  const select = (id: Id) => {
    if (param) {
      const next = new URLSearchParams(params)
      next.set(param, id)
      // `replace` so a tab change does not fill the back button with the same page.
      setParams(next, { replace: true })
    }
    onChange(id)
  }

  const enclosed = variant === 'enclosed'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
      borderBottom: '1px solid var(--color-border)',
      ...style,
    }}>
      {tabs.map(tab => {
        const on = tab.id === active
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={on}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && select(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
              padding: '8px 14px',
              background: enclosed && on ? 'var(--color-card)' : 'none',
              border: enclosed
                ? `1px solid ${on ? 'var(--color-border)' : 'transparent'}`
                : 'none',
              borderBottom: enclosed
                ? `1px solid ${on ? 'var(--color-card)' : 'var(--color-border)'}`
                : `2px solid ${on ? 'var(--color-primary)' : 'transparent'}`,
              borderRadius: enclosed ? 'var(--radius-sm) var(--radius-sm) 0 0' : 0,
              // Pulls the underline over the container's own border so they read as
              // one line rather than two stacked rules.
              marginBottom: -1,
              cursor: tab.disabled ? 'not-allowed' : 'pointer',
              opacity: tab.disabled ? 0.45 : 1,
              fontSize: 'var(--text-body)',
              fontWeight: on ? 700 : 500,
              color: on ? 'var(--color-primary)' : 'var(--color-muted)',
              whiteSpace: 'nowrap',
              transition: 'color .15s, border-color .15s',
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span style={{
                fontSize: 'var(--text-label)', fontWeight: 700,
                padding: '1px 6px', borderRadius: 999, lineHeight: 1.5,
                background: on ? 'var(--color-primary)' : 'var(--color-border)',
                color: on ? '#fff' : 'var(--color-muted)',
              }}>{tab.count}</span>
            )}
          </button>
        )
      })}
      {actions && (
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center',
                      gap: 'var(--space-1)', paddingBottom: 'var(--space-1)' }}>
          {actions}
        </div>
      )}
    </div>
  )
}

export default Tabs
