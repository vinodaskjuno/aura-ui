import { useCallback, useEffect, useState } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import { AlertTriangle, Coins, Gauge, Hash, Loader2, RefreshCw, ShieldAlert } from 'lucide-react'
import * as api from '../../api/aiObservability'
import { CHART_COLORS, card, ghost, money, mono, tokens } from './styles'

/**
 * Project overview: volume, latency, cost, error rate and judge scores.
 *
 * Reads GET /summary, which aggregates the most recent N traces rather than running
 * a store-specific aggregation query. That bound is surfaced rather than hidden —
 * `window.exact === false` means these are recent-activity numbers, not totals, and
 * the banner says so. A dashboard that presents a partial sum as a total is worse
 * than one that admits its limits.
 */

function Kpi({ label, value, icon, color, hint }: {
  label: string; value: string; icon: React.ReactNode; color: string; hint?: string
}) {
  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 6 }} title={hint}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.05em',
        color: 'var(--color-muted)', fontWeight: 600 }}>
        <span style={{ color }}>{icon}</span>{label}
      </div>
      <div style={{ ...mono, fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>
        {value}
      </div>
    </div>
  )
}

export default function OverviewTab({ project }: { project: string }) {
  const [data, setData] = useState<api.Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(() => {
    if (!project) return
    setLoading(true); setErr('')
    api.getSummary(project)
      .then(setData)
      .catch(() => setErr('Could not load the summary.'))
      .finally(() => setLoading(false))
  }, [project])

  useEffect(() => { load() }, [load])

  if (!project) {
    return <div style={{ fontSize: 12.5, color: 'var(--color-subtext)', padding: 16 }}>
      No project has sent traces yet. Use the <strong>Onboard</strong> tab to instrument an agent.
    </div>
  }

  const k = data?.kpis

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={load} style={ghost}>
          <RefreshCw size={12} /> Refresh
        </button>
        {loading && <Loader2 size={14} className="animate-spin" style={{ color: '#818cf8' }} />}
        {err && <span style={{ fontSize: 12, color: '#ef4444' }}>{err}</span>}

        {/* An unreachable Opik must read as an outage, not as a quiet empty project. */}
        {data?.degraded && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto',
            fontSize: 11, color: '#f59e0b' }}>
            <ShieldAlert size={12} />
            {data.store} is unreachable — these figures may be stale or empty
          </span>
        )}
      </div>

      {/* The honesty banner. window.exact is false when the page bound truncated the
          window, which means every number below is "recent", not "total". */}
      {data && !data.window.exact && (
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 8,
          borderColor: 'rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.06)',
          fontSize: 11.5, color: 'var(--color-subtext)', padding: '9px 12px' }}>
          <AlertTriangle size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />
          Aggregated over the most recent {data.window.traces} traces (the page limit),
          so these are recent-activity figures rather than project totals.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <Kpi label="Traces" value={String(k?.traces ?? 0)}
          icon={<Hash size={12} />} color="#6366f1" />
        <Kpi label="Error rate" value={`${((k?.errorRate ?? 0) * 100).toFixed(1)}%`}
          icon={<AlertTriangle size={12} />} color="#ef4444"
          hint={`${k?.errors ?? 0} errored traces`} />
        <Kpi label="p50 latency" value={`${k?.p50LatencyMs ?? 0}ms`}
          icon={<Gauge size={12} />} color="#10b981" />
        <Kpi label="p95 latency" value={`${k?.p95LatencyMs ?? 0}ms`}
          icon={<Gauge size={12} />} color="#f59e0b"
          hint="Nearest-rank, not interpolated" />
        <Kpi label="Cost" value={money(k?.costUsd)}
          icon={<Coins size={12} />} color="#10b981"
          hint="Aura's own calculate_cost_v2 figure — the same table the invoice uses" />
        <Kpi label="Tokens" value={tokens(k?.totalTokens)}
          icon={<Hash size={12} />} color="#8b5cf6" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 12 }}>
        <div style={card}>
          <div className="section-label" style={{ marginBottom: 10 }}>Traces per day</div>
          <div style={{ height: 190 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.daily ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--color-muted)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--color-muted)' }} />
                <Tooltip contentStyle={{ background: 'var(--color-card)',
                  border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="traces" stroke={CHART_COLORS[0]}
                  fill={CHART_COLORS[0]} fillOpacity={0.18} />
                <Area type="monotone" dataKey="errors" stroke="#ef4444"
                  fill="#ef4444" fillOpacity={0.18} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={card}>
          <div className="section-label" style={{ marginBottom: 10 }}>Cost per day</div>
          <div style={{ height: 190 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.daily ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--color-muted)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--color-muted)' }} />
                {/* recharts 3 types the formatter against a union ValueType, so the
                    value is narrowed rather than annotated as number. */}
                <Tooltip formatter={(v) => money(typeof v === 'number' ? v : Number(v))}
                  contentStyle={{ background: 'var(--color-card)',
                    border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="costUsd" fill={CHART_COLORS[4]} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <div style={card}>
          <div className="section-label" style={{ marginBottom: 10 }}>Judge scores</div>
          {(data?.scores ?? []).length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
              Nothing scored yet. Enable sampled scoring in the <strong>Evaluations</strong> tab.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data!.scores.map(s => (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, width: 110, color: 'var(--color-text)' }}>{s.name}</span>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--color-surface)' }}>
                    <div style={{ width: `${s.mean * 100}%`, height: '100%', borderRadius: 3,
                      background: s.mean >= 0.7 ? '#10b981' : '#f59e0b' }} />
                  </div>
                  <span style={{ ...mono, fontSize: 11.5, color: 'var(--color-subtext)', width: 76,
                    textAlign: 'right' }}>
                    {s.mean.toFixed(2)} · n={s.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={card}>
          <div className="section-label" style={{ marginBottom: 10 }}>Providers</div>
          {(data?.providers ?? []).length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
              No provider recorded. Set <code>gen_ai.system</code> on your LLM spans.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {data!.providers.map((p, i) => (
                <div key={p.provider} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%',
                    background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                  <span style={{ fontSize: 12, flex: 1, color: 'var(--color-text)' }}>{p.provider}</span>
                  <span style={{ ...mono, fontSize: 11.5, color: 'var(--color-subtext)' }}>
                    {p.traces}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
