import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Loader2, Trash2, ShieldOff } from 'lucide-react'
import {
  getWipeStatus, wipeGraph, type WipeResult, type WipeStatus,
} from '../../api/graphConfig'

/**
 * Deleting the graph, from the UI.
 *
 * Shown to every admin, but inert unless the server was explicitly armed
 * (AURA_ALLOW_GRAPH_WIPE). Rendering it disabled rather than hiding it is
 * deliberate: an operator can then tell "not permitted in this environment" from
 * "this build does not have the feature", which is the difference between moving on
 * and filing a bug.
 */
export default function DangerZonePanel() {
  const [status, setStatus] = useState<WipeStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [result, setResult] = useState<WipeResult | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try { setStatus(await getWipeStatus()) }
    catch { setError('Could not read wipe status.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const run = async (scope: 'demo' | 'all') => {
    setBusy(true); setError(''); setResult(null)
    try {
      setResult(await wipeGraph(scope, scope === 'all' ? confirm : ''))
      setConfirm('')
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
      setError(detail || 'The wipe failed.')
    } finally { setBusy(false) }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5,
        color: 'var(--color-subtext)' }}>
        <Loader2 size={14} className="animate-spin" /> Checking…
      </div>
    )
  }

  const armed = !!status?.enabled
  const targets = status?.targets ?? []
  const word = status?.confirmWord ?? 'DELETE'

  const btn = (danger: boolean, disabled: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
    borderRadius: 7, fontSize: 12.5, fontWeight: 600,
    border: `1px solid ${danger ? 'rgba(239,68,68,.5)' : 'var(--color-border)'}`,
    background: danger ? 'rgba(239,68,68,.12)' : 'var(--color-surface)',
    color: danger ? '#fca5a5' : 'var(--color-text)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {!armed && (
        <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 12.5,
          color: 'var(--color-subtext)', background: 'var(--color-surface)',
          border: '1px solid var(--color-border)', borderRadius: 8, padding: '11px 13px' }}>
          <ShieldOff size={14} style={{ color: 'var(--color-muted)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Disabled in this environment.</strong>{' '}
            {status?.reason}
            <div style={{ marginTop: 5, color: 'var(--color-muted)', lineHeight: 1.55 }}>
              It is switched on per environment and is off unless a deployment
              deliberately enables it — so a new environment is safe without anyone
              having to remember to lock it down.
            </div>
          </div>
        </div>
      )}

      <div style={{ fontSize: 12.5, color: 'var(--color-subtext)', lineHeight: 1.6 }}>
        Clears graph data from{' '}
        <strong>{targets.length ? targets.join(' and ') : 'every configured engine'}</strong>.
        Both engines are cleared together — emptying only one leaves the other
        populated, and the deleted data reappears the moment the read source changes.
      </div>

      {/* Recoverable action first, and without a typing ritual. Making the safe
          action equally tedious trains people to type the word without reading. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" disabled={!armed || busy} style={btn(false, !armed || busy)}
          onClick={() => run('demo')}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          Clear demo data
        </button>
        <span style={{ fontSize: 11.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
          Removes seeded and mock-connector nodes only. Analysed projects and audit
          history are kept. Restore by re-running the seed script.
        </span>
      </div>

      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 13,
        display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12,
          color: '#fca5a5' }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            <strong>Clear everything</strong> deletes every node, including the
            in-graph audit history and any analysed projects. There is no undo —
            recovery needs an EFS snapshot.
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
          <input
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            disabled={!armed || busy}
            placeholder={`Type ${word} to enable`}
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 6, padding: '7px 10px', color: 'var(--color-text)',
              fontSize: 12.5, width: 190, fontFamily: 'var(--font-mono)' }}
          />
          <button type="button" style={btn(true, !armed || busy || confirm.trim() !== word)}
            disabled={!armed || busy || confirm.trim() !== word}
            onClick={() => run('all')}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Clear everything
          </button>
        </div>
      </div>

      {error && <div style={{ fontSize: 12, color: '#ef4444', lineHeight: 1.55 }}>{error}</div>}

      {result && (
        <div style={{ fontSize: 12.5, color: 'var(--color-text)', background: 'var(--color-surface)',
          border: '1px solid var(--color-border)', borderRadius: 8, padding: '11px 13px' }}>
          <div style={{ fontWeight: 700, marginBottom: 6,
            color: result.ok ? '#10b981' : '#f59e0b' }}>
            {result.ok
              ? `Cleared — ${result.totalDeleted} node(s) removed`
              : 'Finished with problems'}
          </div>
          {/* Before/after per engine, not a bare success: the operator should see
              what actually happened on each store. */}
          {result.results.map(r => (
            <div key={r.backend} style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5,
              color: r.ok ? 'var(--color-subtext)' : '#f59e0b' }}>
              {r.backend}: {r.error ? r.error : `${r.before} → ${r.after}`}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
