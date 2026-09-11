import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import type { EmulatorRecord } from '../../api/qa'

/**
 * Every emulator a run used — INCLUDING the ones that failed to start.
 *
 * The previous detail view filtered on `started`, which hid precisely the emulator
 * whose failure explains a run full of "not emulated" results. A missing row reads as
 * "no cloud needed"; a failed row says what actually happened.
 *
 * The digest rather than the tag, because `floci/floci:latest` is not a version and
 * two runs a week apart can be two different images under the same name.
 */
export default function EmulatorTable({ emulators }: { emulators: EmulatorRecord[] }) {
  if (!emulators?.length) {
    return (
      <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
        No cloud emulators were needed — this project's dependencies imply none.
      </p>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {emulators.map(e => (
        <div key={e.cloud} style={{ border: '1px solid var(--color-border)',
                                    borderRadius: 6, padding: '9px 11px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {e.started
              ? <CheckCircle2 size={13} color="#10b981" />
              : <XCircle size={13} color="#ef4444" />}
            <span style={{ fontSize: 12, fontWeight: 650 }}>{e.cloud}</span>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)',
                           fontVariantNumeric: 'tabular-nums' }}>:{e.port}</span>
            {e.container && (
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono, monospace)',
                             color: 'var(--color-text-secondary)' }}>{e.container}</span>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 11,
                           color: e.started ? '#10b981' : '#ef4444' }}>
              {e.started ? 'started' : 'failed to start'}
            </span>
          </div>

          {(e.image || e.digest) && (
            <div title={e.digest}
                 style={{ fontSize: 10, color: 'var(--color-text-secondary)',
                          marginTop: 5, fontFamily: 'var(--font-mono, monospace)' }}>
              {e.image}{e.digest ? ` @ ${e.digest.slice(0, 19)}…` : ''}
            </div>
          )}

          {!!e.error && (
            <p style={{ fontSize: 11, color: '#ef4444', margin: '7px 0 0',
                        display: 'flex', gap: 6, lineHeight: 1.6 }}>
              <AlertTriangle size={11} style={{ flexShrink: 0, marginTop: 2 }} />
              {e.error}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
