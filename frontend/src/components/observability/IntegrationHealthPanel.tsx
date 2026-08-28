import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, ExternalLink, Loader2 } from 'lucide-react'
import observabilityApi, { type IntegrationHealth } from '../../api/observability'
import { useAuthStore } from '../../store/authStore'
import { PROVIDER_LABELS, PROVIDER_STATUS_META, relTime } from './observabilityFormat'

/**
 * Read-only. Credentials are configured on the existing Connectors page: a second
 * secret form would mean a second secret store, a second test path, and two places
 * to revoke a leaked Datadog key. That is a security duplication, not a UX choice.
 *
 * Health is NEVER sample data — a green dot for an unconfigured provider is exactly
 * what this panel exists to prevent.
 */
export default function IntegrationHealthPanel() {
  const [rows, setRows] = useState<IntegrationHealth[] | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const permissions = useAuthStore((s) => s.permissions)
  const canConfigure = permissions.includes('connectors')

  const load = () => {
    setRows(null)
    observabilityApi.getIntegrationHealth().then(setRows)
  }
  useEffect(load, [])

  const test = async (providerId: string) => {
    setTesting(providerId)
    try { await observabilityApi.testProvider(providerId) } catch { /* surfaced by reload */ }
    finally { setTesting(null); load() }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
          Connected integrations
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={load} style={ghostBtn}>
          <RefreshCw size={12} /> Refresh
        </button>
        {canConfigure ? (
          <Link to="/connectors" style={{ ...ghostBtn, textDecoration: 'none' }}>
            <ExternalLink size={12} /> Configure
          </Link>
        ) : (
          <span style={{ ...ghostBtn, cursor: 'default', opacity: 0.6 }}
            title="Ask an administrator to configure observability connectors">
            Ask an administrator to configure
          </span>
        )}
      </div>

      {rows === null && (
        <div style={{ fontSize: 12, color: 'var(--color-muted)',
          display: 'flex', alignItems: 'center', gap: 7 }}>
          <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
          Probing providers…
        </div>
      )}

      {rows?.length === 0 && (
        <div style={{ padding: 18, borderRadius: 8, background: 'var(--color-card)',
          border: '1px dashed var(--color-border)', fontSize: 12.5,
          color: 'var(--color-muted)', lineHeight: 1.7 }}>
          No observability providers are configured yet. Add a Grafana, Datadog, Sentry,
          Elasticsearch, Kubernetes or PagerDuty connector to start investigating.
          {canConfigure && <> <Link to="/connectors" style={{ color: 'var(--color-primary)' }}>
            Open Connectors →</Link></>}
        </div>
      )}

      <div style={{ display: 'grid', gap: 10,
        gridTemplateColumns: 'repeat(auto-fill, minmax(232px, 1fr))' }}>
        {(rows ?? []).map((p) => {
          const meta = PROVIDER_STATUS_META[p.status] ?? PROVIDER_STATUS_META.not_configured
          return (
            <div key={p.providerId} style={{ padding: 13, borderRadius: 8,
              background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: meta.color,
                  boxShadow: p.status === 'connected' ? `0 0 6px ${meta.color}` : 'none' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)',
                  flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap' }}>
                  {PROVIDER_LABELS[p.providerType] ?? p.displayName ?? p.providerType}
                </span>
              </div>
              <div style={{ fontSize: 11, color: meta.color, fontWeight: 600,
                marginBottom: 5 }}>{meta.label}</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                {p.capabilities.map((c) => (
                  <span key={c} style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px',
                    borderRadius: 3, background: 'var(--color-surface)',
                    color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>{c}</span>
                ))}
              </div>
              {p.message && (
                <div style={{ fontSize: 10.5, color: 'var(--color-muted)', marginBottom: 7,
                  lineHeight: 1.5, wordBreak: 'break-word' }}>{p.message.slice(0, 120)}</div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5,
                color: 'var(--color-muted)' }}>
                <span>{p.latencyMs ? `${p.latencyMs}ms` : '—'}</span>
                <span>{p.lastCheckedAt ? relTime(p.lastCheckedAt) : 'never'}</span>
                <div style={{ flex: 1 }} />
                <button onClick={() => test(p.providerId)} disabled={testing === p.providerId}
                  style={{ ...ghostBtn, fontSize: 10.5, padding: '3px 8px' }}>
                  {testing === p.providerId
                    ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />
                    : null}
                  Test
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600,
  padding: '5px 10px', borderRadius: 6, cursor: 'pointer', background: 'transparent',
  color: 'var(--color-muted)', border: '1px solid var(--color-border)',
}
