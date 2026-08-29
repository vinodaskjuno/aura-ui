import { useCallback, useEffect, useState } from 'react'
import { Database, Check, Loader2, AlertTriangle, RefreshCw } from 'lucide-react'
import {
  drainOutbox, getGraphConfig, setGraphConfig, type GraphConfig,
} from '../../api/graphConfig'

/**
 * Which graph engine is read from, and which are written to.
 *
 * The product is deployed per client and each client permits a different engine,
 * so this is a deployment choice rather than a code dependency. Switching the read
 * source takes effect immediately — no backend restart — because the setting lives
 * in DynamoDB rather than the process-cached Settings object.
 */
export default function GraphBackendPanel() {
  const [config, setConfig] = useState<GraphConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try {
      setConfig(await getGraphConfig())
      setError('')
    } catch {
      setError('Could not read the graph backend configuration.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const apply = async (readSource: string, writeTargets: string[]) => {
    setBusy(true); setError(''); setNotice('')
    try {
      setConfig(await setGraphConfig({ readSource, writeTargets }))
      setNotice(`Reads now come from ${readSource}. No restart was needed.`)
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
      setError(detail || 'Could not change the graph backend.')
    } finally {
      setBusy(false)
    }
  }

  const drain = async (backend: string) => {
    setBusy(true); setError(''); setNotice('')
    try {
      const res = await drainOutbox(backend)
      setNotice(res.error
        ? `Replayed ${res.replayed}, ${res.remaining} still queued — ${res.error}`
        : `Replayed ${res.replayed} write(s); ${res.remaining} remaining.`)
      await load()
    } catch {
      setError('Drain failed.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--color-subtext)' }}>
        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading graph backends…
      </div>
    )
  }

  if (!config || config.backends.length === 0) {
    return (
      <div style={{ fontSize: 12.5, color: 'var(--color-subtext)', lineHeight: 1.6 }}>
        No graph engine is configured for this deployment.
      </div>
    )
  }

  const totalPending = Object.values(config.pending || {}).reduce((a, b) => a + b, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 12, color: 'var(--color-subtext)', lineHeight: 1.6 }}>
        Data is written to every selected engine. Reads come from one. Changing the
        read source takes effect immediately — the backend is not restarted.
      </div>

      {config.backends.map(backend => {
        const isSource = config.readSource === backend.name
        const isTarget = config.writeTargets.includes(backend.name)
        const pending = config.pending?.[backend.name] ?? 0
        const blocked = busy || isSource || !backend.available || pending > 0
        return (
          <div key={backend.name} style={{
            border: `1px solid ${isSource ? '#4f46e5' : 'var(--color-border)'}`,
            background: isSource ? 'rgba(79,70,229,0.06)' : 'var(--color-card)',
            borderRadius: 10, padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <Database size={16} style={{ color: backend.available ? '#10b981' : '#ef4444', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text)' }}>
                  {backend.name}
                </span>
                {isSource && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#a5b4fc',
                    background: 'rgba(79,70,229,0.18)', padding: '2px 7px', borderRadius: 4 }}>
                    READ SOURCE
                  </span>
                )}
                {isTarget && !isSource && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-subtext)',
                    border: '1px solid var(--color-border)', padding: '2px 7px', borderRadius: 4 }}>
                    MIRRORED
                  </span>
                )}
                {!backend.available && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444' }}>UNREACHABLE</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: 'var(--font-mono)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {backend.uri} · {backend.dialect}
                {!backend.supportsFulltext && ' · no full-text index'}
              </div>
              {pending > 0 && (
                <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 3, display: 'flex',
                  alignItems: 'center', gap: 5 }}>
                  <AlertTriangle size={11} />
                  {pending} write(s) behind — cannot be the read source until drained
                </div>
              )}
            </div>

            {pending > 0 && (
              <button type="button" disabled={busy} onClick={() => drain(backend.name)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px',
                  borderRadius: 7, fontSize: 11.5, cursor: busy ? 'not-allowed' : 'pointer',
                  background: 'var(--color-surface)', color: 'var(--color-text)',
                  border: '1px solid var(--color-border)' }}>
                <RefreshCw size={11} /> Drain
              </button>
            )}

            <button
              type="button"
              disabled={blocked}
              onClick={() => apply(backend.name, Array.from(new Set([...config.writeTargets, backend.name])))}
              title={pending > 0 ? 'Drain the queued writes first' : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px',
                borderRadius: 7, fontSize: 12, fontWeight: 600, border: 'none',
                background: isSource ? 'transparent' : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                color: isSource ? 'var(--color-subtext)' : '#fff',
                cursor: blocked ? 'not-allowed' : 'pointer',
                opacity: blocked && !isSource ? 0.5 : 1,
                whiteSpace: 'nowrap',
              }}>
              {isSource ? <><Check size={12} /> Active</> : 'Read from this'}
            </button>
          </div>
        )
      })}

      {totalPending > 0 && (
        <div style={{ fontSize: 11.5, color: '#f59e0b', lineHeight: 1.6 }}>
          Writes queued for a mirror are replayed in order. The primary already
          committed them, so nothing is lost — but a store that is behind cannot
          serve reads until it catches up.
        </div>
      )}
      {notice && <div style={{ fontSize: 12, color: '#10b981' }}>{notice}</div>}
      {error && <div style={{ fontSize: 12, color: '#ef4444' }}>{error}</div>}
      {config.updatedBy && (
        <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
          Last changed by {config.updatedBy}
          {config.updatedAt ? ` on ${new Date(config.updatedAt).toLocaleString()}` : ''}
        </div>
      )}
    </div>
  )
}
