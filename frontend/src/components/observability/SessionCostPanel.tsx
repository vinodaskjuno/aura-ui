import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { Investigation, SessionCost } from '../../api/observability'
import type { RunState } from '../../hooks/useObservabilityStream'
import { AGENT_LABELS, fmtConfidence, fmtCost, fmtTokens, relTime } from './observabilityFormat'

/**
 * Investigation-scoped cost.
 *
 * MetricsDashboard.tsx is deliberately not embedded here: it is 878 lines, takes only
 * `onClose?`, and its data is GATEWAY-scoped. It answers "what has the platform spent
 * on LLMs" when this page needs "what did THIS investigation cost" — embedding it
 * would look wrong and mislead.
 *
 * Cost is never sample data. Fabricated dollar figures get quoted in budget meetings.
 */
interface Props {
  cost: SessionCost | null
  run: RunState
  history: Investigation[]
  onOpen: (id: string) => void
}

export default function SessionCostPanel({ cost, run, history, onOpen }: Props) {
  const perAgent = run.stages.flatMap((s) => s.agents)
    .filter((a) => (a.costDelta ?? 0) > 0)
    .map((a) => ({ agent: AGENT_LABELS[a.name] ?? a.name, cost: a.costDelta ?? 0 }))

  const trend = history.slice().reverse().map((i) => ({
    at: relTime(i.createdAt),
    cost: typeof i.cost?.totalCost === 'number' ? i.cost.totalCost : 0,
  }))

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section>
        <Title>This investigation</Title>
        {!cost ? (
          <Empty>—  no cost recorded for this run.</Empty>
        ) : (
          <div style={{ display: 'grid', gap: 10,
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
            <Stat label="Total cost" value={fmtCost(cost.totalCost)} accent />
            <Stat label="Input tokens" value={fmtTokens(cost.inputTokens)} />
            <Stat label="Output tokens" value={fmtTokens(cost.outputTokens)} />
            <Stat label="LLM calls" value={String(cost.calls ?? 0)} />
            <Stat label="Model" value={cost.model || '—'} />
          </div>
        )}
      </section>

      {perAgent.length > 0 && (
        <section>
          <Title>Cost by agent</Title>
          <div style={{ height: 26 * perAgent.length + 30 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perAgent} layout="vertical"
                margin={{ top: 4, right: 20, bottom: 4, left: 8 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="agent" width={130}
                  tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
                  axisLine={false} tickLine={false} />
                <Tooltip formatter={((v: number) => fmtCost(v)) as never}
                  contentStyle={{ fontSize: 11, background: 'var(--color-card)',
                    border: '1px solid var(--color-border)', borderRadius: 6 }} />
                <Bar dataKey="cost" radius={[0, 4, 4, 0]} barSize={14}>
                  {perAgent.map((_, i) => <Cell key={i} fill="var(--color-primary)" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {trend.length > 1 && (
        <section>
          <Title>Cost over recent investigations</Title>
          <div style={{ height: 130 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="gCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="at" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} width={46}
                  tickFormatter={(v: number) => `$${v.toFixed(3)}`} />
                <Tooltip formatter={((v: number) => fmtCost(v)) as never}
                  contentStyle={{ fontSize: 11, background: 'var(--color-card)',
                    border: '1px solid var(--color-border)', borderRadius: 6 }} />
                <Area type="monotone" dataKey="cost" stroke="var(--color-primary)"
                  fill="url(#gCost)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section>
        <Title>Session history</Title>
        {history.length === 0 && <Empty>No previous investigations.</Empty>}
        {history.map((i) => (
          <button key={i.investigationId} onClick={() => onOpen(i.investigationId)}
            style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 12,
              textAlign: 'left', padding: '9px 12px', marginBottom: 6, borderRadius: 7,
              cursor: 'pointer', background: 'var(--color-card)',
              border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5,
              color: 'var(--color-muted)', flexShrink: 0 }}>{i.investigationId}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.title}</span>
            {i.outcome?.verdict && i.outcome.verdict !== 'unknown' && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                background: i.outcome.verdict === 'confirmed' ? '#10b98122' : '#ef444422',
                color: i.outcome.verdict === 'confirmed' ? '#10b981' : '#ef4444' }}>
                {i.outcome.verdict}
              </span>
            )}
            <span style={{ fontSize: 10.5, color: 'var(--color-muted)' }}>
              {i.evidenceCount} ev
            </span>
            <span style={{ fontSize: 10.5, color: 'var(--color-muted)' }}>
              cites {fmtConfidence(Number(i.citationCoverage))}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--color-text)' }}>
              {typeof i.cost?.totalCost === 'number' ? fmtCost(i.cost.totalCost) : '—'}
            </span>
          </button>
        ))}
      </section>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ padding: 11, borderRadius: 8, background: 'var(--color-card)',
      border: '1px solid var(--color-border)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
        textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 5 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: accent ? 18 : 15,
        fontWeight: 700, color: accent ? 'var(--color-primary)' : 'var(--color-text)',
        overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  )
}

function Title({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em',
    textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 9 }}>{children}</div>
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 16, borderRadius: 8, background: 'var(--color-card)',
    border: '1px dashed var(--color-border)', fontSize: 12.5,
    color: 'var(--color-muted)' }}>{children}</div>
}
