import { AlertTriangle, Circle, FileText, Loader2, Search } from 'lucide-react'
import type { QaContainer } from '../../api/qa'

/**
 * The Floci containers running on someone's machine.
 *
 * Everything here is second-hand: the API runs on Fargate and can never see a
 * developer's podman, so these rows are what a runner last reported. When that report
 * has gone stale the rows are dimmed and labelled rather than presented as current —
 * a sleeping laptop must not leave a panel claiming four emulators are running.
 */

export interface Row extends QaContainer {
  runner: string
  stale?: boolean
}

const CLOUD_COLOUR: Record<string, string> = {
  aws: '#f59e0b', azure: '#38bdf8', gcp: '#ef4444', oci: '#a78bfa',
}

function state(row: Row): { colour: string; label: string } {
  if (row.stale) return { colour: 'var(--color-text-secondary)', label: 'last known' }
  const status = (row.status || '').toLowerCase()
  if (status.startsWith('up')) return { colour: '#10b981', label: row.status }
  if (status.includes('exited') || status.includes('dead'))
    return { colour: '#ef4444', label: row.status }
  return { colour: '#f59e0b', label: row.status || 'starting' }
}

export default function FlociContainerTable({ rows, onLogs, onInspect,
                                             showRunner = false }: {
  rows: Row[]
  onLogs?: (row: Row) => void
  /** Look inside the emulator. Absent means no inspect control — the caller has no
   *  runner to ask. */
  onInspect?: (row: Row) => void
  showRunner?: boolean
}) {
  if (!rows.length) {
    return (
      <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '10px 0',
                  lineHeight: 1.6 }}>
        No Floci containers are running locally. QualityMind starts one per cloud your
        project depends on, only for the duration of a run.
      </p>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--color-text-secondary)',
                       fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            <th style={th}>Container</th>
            <th style={th}>Cloud</th>
            <th style={th}>Port</th>
            <th style={th}>State</th>
            {showRunner && <th style={th}>Runner</th>}
            <th style={th} />
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const s = state(row)
            return (
              <tr key={`${row.runner}/${row.name}`}
                  style={{ borderTop: '1px solid var(--color-border)',
                           opacity: row.stale ? 0.55 : 1 }}>
                <td style={{ ...td, fontFamily: 'var(--font-mono, monospace)' }}>
                  {row.name}
                  {row.image && (
                    <div style={{ fontSize: 10, color: 'var(--color-text-secondary)',
                                  marginTop: 2 }} title={row.image}>
                      {row.image}
                    </div>
                  )}
                </td>
                <td style={td}>
                  {row.cloud ? (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px',
                                   borderRadius: 4,
                                   color: CLOUD_COLOUR[row.cloud] ?? 'var(--color-text)',
                                   background: `${CLOUD_COLOUR[row.cloud] ?? '#888'}22` }}>
                      {row.cloud.toUpperCase()}
                    </span>
                  ) : '—'}
                </td>
                <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>
                  {row.ports || '—'}
                </td>
                <td style={td}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                                 color: s.colour }}>
                    {row.stale
                      ? <AlertTriangle size={11} />
                      : <Circle size={8} fill="currentColor" />}
                    {s.label}
                  </span>
                </td>
                {showRunner && (
                  <td style={{ ...td, color: 'var(--color-text-secondary)' }}>{row.runner}</td>
                )}
                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {/* What is IN it, as opposed to what it printed. Only for a live
                      container: a stale row would answer about nothing. */}
                  {onInspect && row.cloud && !row.stale && (
                    <button onClick={() => onInspect(row)} style={linkBtn}
                            title="Look inside this emulator">
                      <Search size={11} /> Inspect
                    </button>
                  )}
                  {/* Only containers Aura started. The backend refuses the rest too. */}
                  {onLogs && row.managed && (
                    <button onClick={() => onLogs(row)}
                            style={{ ...linkBtn, marginLeft: 6 }}>
                      <FileText size={11} /> Logs
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** The same table, scoped to one run, fed from its heartbeat rather than podman. */
export function RunEmulators({ emulators, stale, onLogs }: {
  emulators: { cloud: string; port?: number; container?: string; image?: string
               started?: boolean; stopped?: boolean; error?: string
               adopted?: boolean }[]
  stale?: boolean
  /** Absent means no logs control — the caller has no runner to ask. */
  onLogs?: (container: string) => void
}) {
  if (!emulators.length) return null
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {stale && (
        <p style={{ fontSize: 11, color: '#f59e0b', display: 'flex', gap: 6,
                    alignItems: 'center', margin: 0 }}>
          <AlertTriangle size={11} /> The runner stopped reporting — these may already
          be gone.
        </p>
      )}
      {emulators.map(e => (
        <div key={e.cloud} style={{ display: 'flex', alignItems: 'center', gap: 8,
                                    fontSize: 12 }}>
          {e.stopped
            ? <Circle size={8} color="var(--color-text-secondary)" />
            : e.started
              ? <Circle size={8} fill="#10b981" color="#10b981" />
              : e.error
                ? <AlertTriangle size={11} color="#ef4444" />
                : <Loader2 size={11} className="animate-spin" color="#f59e0b" />}
          <span style={{ fontWeight: 600 }}>{e.cloud}</span>
          {e.port ? <span style={{ color: 'var(--color-text-secondary)' }}>:{e.port}</span> : null}
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11,
                         color: 'var(--color-text-secondary)' }}>{e.container}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11,
                         color: e.error ? '#ef4444' : 'var(--color-text-secondary)' }}>
            {/* "Who will stop this" is the reader's real question, and adoption is the
                answer that changes: an adopted emulator outlives the run. */}
            {e.adopted ? 'yours, left running'
              : e.stopped ? 'stopped'
              : e.started ? 'ready'
              : e.error ? e.error.slice(0, 90) : 'starting…'}
          </span>
          {/* Reachable from the run itself. It used to exist only in the Runner tab,
              which is not where anyone is looking while a run is in flight. */}
          {onLogs && e.container && !e.stopped && (
            <button onClick={() => onLogs(e.container!)} style={linkBtn}>
              <FileText size={11} /> Logs
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

const th: React.CSSProperties = { padding: '6px 10px', fontWeight: 600 }
const td: React.CSSProperties = { padding: '8px 10px', verticalAlign: 'top' }
const linkBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11,
  padding: '3px 8px', borderRadius: 5, cursor: 'pointer',
  border: '1px solid var(--color-border)', background: 'transparent',
  color: 'var(--color-text)',
}
