import { useState, useEffect, useCallback } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import {
  Activity, Cpu, Users, Shield, Key, HeartPulse,
  ClipboardList, RefreshCw, CheckCircle, AlertTriangle,
  XCircle, Trash2,
} from 'lucide-react'
import {
  aiopsGatewayApi,
  type GatewayOverview, type ByModelRow, type ByToolRow,
  type TimeseriesRow, type Provider, type ProviderHealth,
  type GatewayKey, type AuditLog, type BudgetStatus,
} from '../../api/aiopsGateway'

// ── Palette ──────────────────────────────────────────────────────────────────
const COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9', '#10b981', '#fb8c00']
const TOOL_COLORS: Record<string, string> = {
  'aura-plugin': '#3987e5',
  'claude-ext':  '#d55181',
  'claude-cli':  '#3987e5',
  'codex-cli':   '#d95926',
  'gemini-cli':  '#199e70',
  'copilot':     '#9085e9',
  'other':       '#9ca3af',
  'unknown':     '#9ca3af',
}
const TOOL_NAMES: Record<string, string> = {
  'aura-plugin': 'AURA Chat',
  'claude-ext':  'Claude Code Ext',
  'claude-cli':  'Claude Code CLI',
  'codex-cli':   'Codex CLI',
  'gemini-cli':  'Gemini CLI',
  'copilot':     'GitHub Copilot',
  'other':       'Other',
  'unknown':     'Unknown',
}

function fmt$(v: number) { return '$' + (v < 0.01 ? v.toFixed(4) : v.toFixed(2)) }
function fmtK(v: number) {
  return v >= 1_000_000 ? (v / 1_000_000).toFixed(1) + 'M'
    : v >= 1000 ? (v / 1000).toFixed(1) + 'K' : String(v)
}

// ── Sub-nav ──────────────────────────────────────────────────────────────────
type SubTab = 'overview' | 'by-model' | 'by-user' | 'providers' | 'budgets' | 'keys' | 'health' | 'audit'

const SUB_TABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview',  label: 'Overview',  icon: <Activity size={12} /> },
  { id: 'by-model',  label: 'By Model',  icon: <Cpu size={12} /> },
  { id: 'by-user',   label: 'By User',   icon: <Users size={12} /> },
  { id: 'providers', label: 'Providers', icon: <Shield size={12} /> },
  { id: 'budgets',   label: 'Budgets',   icon: <AlertTriangle size={12} /> },
  { id: 'keys',      label: 'Keys',      icon: <Key size={12} /> },
  { id: 'health',    label: 'Health',    icon: <HeartPulse size={12} /> },
  { id: 'audit',     label: 'Audit Logs',icon: <ClipboardList size={12} /> },
]

// ── Card / KPI tile ──────────────────────────────────────────────────────────
function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)',
      borderRadius: 10, padding: '14px 18px', minWidth: 140 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 3 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-primary)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── Overview ─────────────────────────────────────────────────────────────────
function OverviewPane() {
  const [period, setPeriod] = useState('today')
  const [overview, setOverview] = useState<GatewayOverview | null>(null)
  const [byTool, setByTool] = useState<ByToolRow[]>([])
  const [timeseries, setTimeseries] = useState<TimeseriesRow[]>([])
  const [budget, setBudget] = useState<BudgetStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ov, bt, ts, bs] = await Promise.all([
        aiopsGatewayApi.getOverview(period).then(r => r.data),
        aiopsGatewayApi.getByTool('7d').then(r => r.data.byTool),
        aiopsGatewayApi.getTimeseries('14d').then(r => r.data.timeseries),
        aiopsGatewayApi.getBudgetStatus().then(r => r.data).catch(() => null),
      ])
      setOverview(ov); setByTool(bt); setTimeseries(ts); setBudget(bs)
    } catch { /* non-fatal */ }
    setLoading(false)
  }, [period])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {['today', '7d', '30d'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--color-border)',
                background: period === p ? 'var(--color-primary)' : 'var(--color-card)',
                color: period === p ? '#fff' : 'var(--color-muted)', cursor: 'pointer' }}>
              {p}
            </button>
          ))}
        </div>
        <button onClick={load} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Budget progress */}
      {budget && budget.limitUsd > 0 && (
        <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-muted)', marginBottom: 6 }}>
            <span>Budget — {budget.tier}</span>
            <span>{fmt$(budget.spentUsd)} / {fmt$(budget.limitUsd)} ({budget.pct}%)</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--color-border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(100, budget.pct)}%`,
              background: budget.pct > 85 ? '#ef4444' : budget.pct > 60 ? '#fb8c00' : '#10b981', transition: 'width 0.4s' }} />
          </div>
        </div>
      )}

      {/* KPI tiles */}
      {overview && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <Tile label="Total Cost" value={fmt$(overview.totalCostUsd)} />
          <Tile label="Total Tokens" value={fmtK(overview.totalTokens)} />
          <Tile label="Total Calls" value={fmtK(overview.totalCalls)} />
          <Tile label="Gateway Calls" value={fmtK(overview.gatewayCalls)} sub={fmt$(overview.gatewayCostUsd) + ' via gateway'} />
          <Tile label="Active Users" value={String(overview.uniqueUsers)} />
        </div>
      )}

      {/* 14-day area chart */}
      {timeseries.length > 0 && (
        <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', marginBottom: 10 }}>Daily Cost — 14 days</div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={timeseries} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3987e5" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3987e5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => '$' + v.toFixed(2)} />
              <Tooltip formatter={(v: number) => fmt$(v)} />
              <Area type="monotone" dataKey="costUsd" stroke="#3987e5" fill="url(#costGrad)" strokeWidth={2} dot={false} name="Cost" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* By-tool horizontal bar */}
      {byTool.length > 0 && (
        <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', marginBottom: 10 }}>By Tool — Last 7 days</div>
          {byTool.map((row, i) => {
            const maxCost = byTool[0]?.costUsd || 1
            const pct = Math.max(2, (row.costUsd / maxCost) * 100)
            const color = TOOL_COLORS[row.tool] || COLORS[i % COLORS.length]
            const label = TOOL_NAMES[row.tool] || row.tool
            return (
              <div key={row.tool} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 80px 70px', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, marginRight: 6 }} />
                  {label}
                </span>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--color-border)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 2, background: color, width: `${pct}%` }} />
                </div>
                <span style={{ textAlign: 'right', color: 'var(--color-muted)' }}>{fmtK((row.inputTokens || 0) + (row.outputTokens || 0))} tok</span>
                <span style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-text)' }}>{fmt$(row.costUsd)}</span>
              </div>
            )
          })}
        </div>
      )}

      {loading && <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>Loading…</div>}
    </div>
  )
}

// ── By Model ─────────────────────────────────────────────────────────────────
function ByModelPane() {
  const [byModel, setByModel] = useState<ByModelRow[]>([])
  const [period, setPeriod] = useState('7d')

  useEffect(() => {
    aiopsGatewayApi.getByModel(period).then(r => setByModel(r.data.byModel)).catch(() => {})
  }, [period])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {['today', '7d', '30d'].map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--color-border)',
              background: period === p ? 'var(--color-primary)' : 'var(--color-card)',
              color: period === p ? '#fff' : 'var(--color-muted)', cursor: 'pointer' }}>
            {p}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {/* Pie */}
        <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 14, flex: '0 0 220px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>Cost Share</div>
          <PieChart width={190} height={190}>
            <Pie data={byModel.slice(0, 6)} dataKey="costUsd" nameKey="model" cx="50%" cy="50%" outerRadius={80} labelLine={false}
              label={({ pct }: any) => pct > 8 ? `${Math.round(pct)}%` : ''}>
              {byModel.slice(0, 6).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => fmt$(v)} />
          </PieChart>
        </div>
        {/* Table */}
        <div style={{ flex: 1, overflowX: 'auto', minWidth: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ color: 'var(--color-muted)', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '4px 8px' }}>Model</th>
                <th style={{ padding: '4px 8px', textAlign: 'right' }}>Tokens</th>
                <th style={{ padding: '4px 8px', textAlign: 'right' }}>Calls</th>
                <th style={{ padding: '4px 8px', textAlign: 'right' }}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {byModel.map((r, i) => (
                <tr key={r.model} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '6px 8px', color: 'var(--color-text)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], marginRight: 6 }} />
                    {r.model}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--color-muted)' }}>{fmtK(r.inputTokens + r.outputTokens)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--color-muted)' }}>{r.calls}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text)' }}>{fmt$(r.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── By User ──────────────────────────────────────────────────────────────────
function ByUserPane() {
  const [data, setData] = useState<any[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    aiopsGatewayApi.getByUser('7d').then(r => setData(r.data.byUser))
      .catch(() => setError('Admin access required'))
  }, [])

  if (error) return <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{error}</div>

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ color: 'var(--color-muted)', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
            <th style={{ padding: '4px 8px' }}>User</th>
            <th style={{ padding: '4px 8px', textAlign: 'right' }}>Tokens</th>
            <th style={{ padding: '4px 8px', textAlign: 'right' }}>Calls</th>
            <th style={{ padding: '4px 8px', textAlign: 'right' }}>Cost</th>
          </tr>
        </thead>
        <tbody>
          {data.map(r => (
            <tr key={r.userId} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text)' }}>{r.userId}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--color-muted)' }}>{fmtK(r.inputTokens + r.outputTokens)}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--color-muted)' }}>{r.calls}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text)' }}>{fmt$(r.costUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Providers ─────────────────────────────────────────────────────────────────
function ProvidersPane() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [health, setHealth] = useState<Record<string, ProviderHealth>>({})

  const load = useCallback(async () => {
    const [pr, hl] = await Promise.all([
      aiopsGatewayApi.getProviders().then(r => r.data).catch(() => [] as Provider[]),
      aiopsGatewayApi.getHealth().then(r => r.data.providers).catch(() => [] as ProviderHealth[]),
    ])
    setProviders(pr)
    setHealth(Object.fromEntries(hl.map(h => [h.providerId, h])))
  }, [])

  useEffect(() => { load() }, [load])

  const del = async (id: string) => {
    await aiopsGatewayApi.deleteProvider(id)
    load()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {providers.length === 0 && <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>No custom providers configured. The built-in Anthropic/OpenAI backends are always active.</div>}
      {providers.map(p => {
        const h = health[p.providerId]
        const healthy = h?.healthy
        return (
          <div key={p.providerId} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: healthy == null ? '#6b7280' : healthy ? '#10b981' : '#ef4444', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{p.name}</div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>{p.baseUrl}</div>
            </div>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'var(--color-border)', color: 'var(--color-muted)' }}>{p.protocol}</span>
            <button onClick={() => del(p.providerId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}><Trash2 size={14} /></button>
          </div>
        )
      })}
    </div>
  )
}

// ── Keys ──────────────────────────────────────────────────────────────────────
function KeysPane() {
  const [keys, setKeys] = useState<GatewayKey[]>([])

  const load = () => aiopsGatewayApi.getKeys().then(r => setKeys(r.data)).catch(() => {})
  useEffect(() => { load() }, [])

  const revoke = async (id: string) => {
    await aiopsGatewayApi.revokeKey(id)
    load()
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ color: 'var(--color-muted)', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
            <th style={{ padding: '4px 8px' }}>Key ID</th>
            <th style={{ padding: '4px 8px' }}>User</th>
            <th style={{ padding: '4px 8px' }}>Tool</th>
            <th style={{ padding: '4px 8px' }}>Status</th>
            <th style={{ padding: '4px 8px' }}>Created</th>
            <th style={{ padding: '4px 8px' }} />
          </tr>
        </thead>
        <tbody>
          {keys.map(k => (
            <tr key={k.keyId} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-muted)' }}>{k.keyHint ?? k.keyId.slice(0, 10)}</td>
              <td style={{ padding: '6px 8px', fontSize: 11, color: 'var(--color-text)' }}>{k.userId}</td>
              <td style={{ padding: '6px 8px', fontSize: 11, color: 'var(--color-muted)' }}>{k.toolLabel ?? k.label ?? '—'}</td>
              <td style={{ padding: '6px 8px' }}>
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: k.active ? '#10b98122' : '#ef444422', color: k.active ? '#10b981' : '#ef4444' }}>
                  {k.active ? 'Active' : 'Revoked'}
                </span>
              </td>
              <td style={{ padding: '6px 8px', fontSize: 10, color: 'var(--color-muted)' }}>{new Date(k.createdAt).toLocaleDateString()}</td>
              <td style={{ padding: '6px 8px' }}>
                {k.active && (
                  <button onClick={() => revoke(k.keyId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}><Trash2 size={13} /></button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Health ────────────────────────────────────────────────────────────────────
function HealthPane() {
  const [items, setItems] = useState<ProviderHealth[]>([])
  const load = () => aiopsGatewayApi.getHealth().then(r => setItems(r.data.providers)).catch(() => {})
  useEffect(() => { load() }, [])

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {/* Built-in Anthropic always shown */}
      {items.length === 0 && <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>No health data yet. Probes run every 60 s after startup.</div>}
      {items.map(h => (
        <div key={h.providerId} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {h.healthy ? <CheckCircle size={14} color="#10b981" /> : <XCircle size={14} color="#ef4444" />}
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{h.providerId}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>HTTP {h.statusCode || '—'}</div>
          {h.error && <div style={{ fontSize: 10, color: '#ef4444', wordBreak: 'break-all' }}>{h.error}</div>}
          <div style={{ fontSize: 10, color: 'var(--color-muted)' }}>{h.checkedAt ? new Date(h.checkedAt).toLocaleTimeString() : '—'}</div>
        </div>
      ))}
    </div>
  )
}

// ── Audit Logs ────────────────────────────────────────────────────────────────
function AuditPane() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [filterModel, setFilterModel] = useState('')
  const [filterTool, setFilterTool] = useState('')

  const load = () => {
    aiopsGatewayApi.getAuditLogs({ filter_model: filterModel || undefined, filter_tool: filterTool || undefined, limit: 100 })
      .then(r => setLogs(r.data.logs)).catch(() => {})
  }
  useEffect(() => { load() }, [filterModel, filterTool])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={filterModel} onChange={e => setFilterModel(e.target.value)} placeholder="Filter model…"
          style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-card)', color: 'var(--color-text)', width: 160 }} />
        <select value={filterTool} onChange={e => setFilterTool(e.target.value)}
          style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-card)', color: 'var(--color-text)' }}>
          <option value="">All tools</option>
          {Object.keys(TOOL_NAMES).map(t => <option key={t} value={t}>{TOOL_NAMES[t]}</option>)}
        </select>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ color: 'var(--color-muted)', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ padding: '4px 8px' }}>Time</th>
              <th style={{ padding: '4px 8px' }}>User</th>
              <th style={{ padding: '4px 8px' }}>Model</th>
              <th style={{ padding: '4px 8px' }}>Tool</th>
              <th style={{ padding: '4px 8px', textAlign: 'right' }}>Tokens</th>
              <th style={{ padding: '4px 8px', textAlign: 'right' }}>Cost</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '4px 8px', fontFamily: 'var(--font-mono)', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                  {new Date(l.timestamp).toLocaleTimeString()}
                </td>
                <td style={{ padding: '4px 8px', color: 'var(--color-text)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.userId}</td>
                <td style={{ padding: '4px 8px', fontFamily: 'var(--font-mono)', color: 'var(--color-muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.model}</td>
                <td style={{ padding: '4px 8px' }}>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: TOOL_COLORS[l.tool || 'other'] + '22', color: TOOL_COLORS[l.tool || 'other'] }}>
                    {TOOL_NAMES[l.tool || 'other'] || l.tool || '—'}
                  </span>
                </td>
                <td style={{ padding: '4px 8px', textAlign: 'right', color: 'var(--color-muted)' }}>{fmtK((l.inputTokens || 0) + (l.outputTokens || 0))}</td>
                <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--color-text)' }}>{fmt$(parseFloat(l.cost || '0'))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Root GatewayTab ───────────────────────────────────────────────────────────
export default function GatewayTab() {
  const [sub, setSub] = useState<SubTab>('overview')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Sub-nav */}
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', borderBottom: '1px solid var(--color-border)', paddingBottom: -1 }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
              padding: '6px 12px', fontSize: 12, fontWeight: sub === t.id ? 700 : 500,
              color: sub === t.id ? 'var(--color-primary)' : 'var(--color-muted)',
              borderBottom: `2px solid ${sub === t.id ? 'var(--color-primary)' : 'transparent'}`,
              display: 'flex', alignItems: 'center', gap: 5, marginBottom: -1 }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Pane */}
      <div style={{ paddingTop: 4 }}>
        {sub === 'overview'  && <OverviewPane />}
        {sub === 'by-model'  && <ByModelPane />}
        {sub === 'by-user'   && <ByUserPane />}
        {sub === 'providers' && <ProvidersPane />}
        {sub === 'budgets'   && <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>Budget management coming soon — backend ready.</div>}
        {sub === 'keys'      && <KeysPane />}
        {sub === 'health'    && <HealthPane />}
        {sub === 'audit'     && <AuditPane />}
      </div>
    </div>
  )
}
