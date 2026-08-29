import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props { children: ReactNode; routeKey: string }
interface State { error: Error | null }

/**
 * Keeps one page's render error from taking down the whole SPA.
 *
 * React unmounts the entire root on an uncaught render error, and this app had no
 * boundary anywhere — so a bad API response shape on a single page blanked the
 * window, sidebar included, with the cause visible only in the devtools console.
 * Two pages did exactly that: ConnectorsPage called .filter on a non-array
 * response, LogsPage called Object.entries on a missing field.
 *
 * Resetting on `routeKey` matters: without it the boundary latches, and every
 * later navigation keeps showing the first page's error.
 */
export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidUpdate(prev: Props) {
    if (prev.routeKey !== this.props.routeKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the stack in the console for anyone with devtools open.
    console.error('Page crashed:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', flex: 1, minHeight: 320, gap: 14, padding: 32,
        textAlign: 'center', color: 'var(--color-subtext)',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: 18, background: '#f59e0b18',
          border: '1.5px solid #f59e0b44', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <AlertTriangle size={32} color="#f59e0b" />
        </div>
        <div style={{
          fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18,
          color: 'var(--color-text)',
        }}>
          This page failed to load
        </div>
        <code style={{
          fontSize: 12, color: '#f59e0b', background: 'var(--color-surface)',
          border: '1px solid var(--color-border)', borderRadius: 6,
          padding: '8px 12px', maxWidth: 620, overflowX: 'auto',
        }}>
          {error.message || String(error)}
        </code>
        <div style={{ fontSize: 12, maxWidth: 460, lineHeight: 1.6 }}>
          The rest of the app still works — use the sidebar to go elsewhere. If this
          keeps happening, the message above is what to report.
        </div>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, marginTop: 4,
            padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
            background: 'var(--color-surface)', color: 'var(--color-text)',
            border: '1px solid var(--color-border)', fontSize: 12.5,
          }}
        >
          <RotateCcw size={13} /> Try again
        </button>
      </div>
    )
  }
}
