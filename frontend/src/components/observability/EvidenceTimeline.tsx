import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import type { Evidence } from '../../api/observability'
import { EVIDENCE_KIND_META, clockTime } from './observabilityFormat'

/**
 * Correlated swimlanes on a shared time axis.
 *
 * Deploy and config events render as vertical ReferenceLines spanning EVERY lane —
 * that is the correlation payoff: the metric knee visibly lands on the deploy line,
 * and the reader reaches the conclusion before the agent states it.
 *
 * The Gantt is the transparent-first-bar offset trick already used by
 * AIOpsPage.IncidentTimeline — the cheapest correct Gantt in recharts, and it is
 * already proven in this codebase.
 */

const LANES: Evidence['kind'][] = ['deploy', 'config', 'metric', 'trace', 'log', 'alert']

interface Props {
  evidence: Evidence[]
  hovered: string | null
  onHover: (id: string | null) => void
  onPin: (id: string) => void
}

export default function EvidenceTimeline({ evidence, hovered, onHover, onPin }: Props) {
  if (evidence.length === 0) {
    return <div style={{ padding: 24, fontSize: 12.5, color: 'var(--color-muted)' }}>
      No evidence collected yet.
    </div>
  }

  const times = evidence.map((e) => new Date(e.timestamp).getTime()).filter((n) => !Number.isNaN(n))
  const t0 = Math.min(...times)
  const t1 = Math.max(...times)
  const span = Math.max(1, t1 - t0)

  const rows = LANES.map((kind) => {
    const items = evidence.filter((e) => e.kind === kind)
    return { kind, items }
  }).filter((r) => r.items.length > 0)

  // Change events are what the eye should snap to.
  const changeMarkers = evidence.filter((e) => e.kind === 'deploy' || e.kind === 'config')

  const chartData = rows.map((row) => {
    const first = Math.min(...row.items.map((i) => new Date(i.timestamp).getTime()))
    const last = Math.max(...row.items.map((i) => new Date(i.timestamp).getTime()))
    return {
      lane: EVIDENCE_KIND_META[row.kind].label,
      kind: row.kind,
      offset: ((first - t0) / span) * 100,
      width: Math.max(2, ((last - first) / span) * 100),
      count: row.items.length,
    }
  })

  return (
    <div>
      <div style={{ height: Math.max(160, rows.length * 44) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical"
            margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis type="category" dataKey="lane" width={64}
              tick={{ fontSize: 11, fill: 'var(--color-muted)' }} axisLine={false}
              tickLine={false} />
            <Tooltip
              cursor={{ fill: 'var(--color-border)', opacity: 0.3 }}
              contentStyle={{ fontSize: 11, background: 'var(--color-card)',
                border: '1px solid var(--color-border)', borderRadius: 6 }}
              formatter={(_v, _n, p) => [`${p.payload.count} record(s)`, p.payload.lane]} />
            {/* First bar transparent = the offset. */}
            <Bar dataKey="offset" stackId="a" fill="transparent" />
            <Bar dataKey="width" stackId="a" radius={[3, 3, 3, 3]} barSize={14}>
              {chartData.map((d) => (
                <Cell key={d.kind} fill={EVIDENCE_KIND_META[d.kind as Evidence['kind']].color} />
              ))}
            </Bar>
            {changeMarkers.map((m) => (
              <ReferenceLine
                key={m.evidenceId}
                x={((new Date(m.timestamp).getTime() - t0) / span) * 100}
                stroke={EVIDENCE_KIND_META[m.kind].color}
                strokeDasharray="4 3"
                strokeWidth={hovered === m.evidenceId ? 2.5 : 1.5}
                label={{ value: m.kind === 'deploy' ? 'deploy' : 'config',
                  position: 'top', fontSize: 9,
                  fill: EVIDENCE_KIND_META[m.kind].color }}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ marginTop: 10, borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
        {evidence.slice().sort((a, b) => a.timestamp.localeCompare(b.timestamp)).map((e) => {
          const meta = EVIDENCE_KIND_META[e.kind] ?? EVIDENCE_KIND_META.log
          const active = hovered === e.evidenceId
          return (
            <div
              key={e.evidenceId}
              onMouseEnter={() => onHover(e.evidenceId)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onPin(e.evidenceId)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '5px 8px',
                borderRadius: 5, cursor: 'pointer', marginBottom: 2,
                background: active ? `${meta.color}18` : 'transparent',
                borderLeft: `2px solid ${active ? meta.color : 'transparent'}`,
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, width: 62,
                flexShrink: 0, color: 'var(--color-muted)' }}>
                {clockTime(e.timestamp)}
              </span>
              <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: meta.color }} />
              <span style={{ fontSize: 11.5, flex: 1, minWidth: 0, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: 'var(--color-text)' }}>{e.summary}</span>
              <span style={{ fontSize: 10, color: 'var(--color-muted)', flexShrink: 0 }}>
                {e.provider}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
