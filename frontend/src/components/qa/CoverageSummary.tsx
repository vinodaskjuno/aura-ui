import { useState } from 'react'
import { ChevronDown, ChevronRight, Info } from 'lucide-react'
import type { QaCoverage } from '../../api/qa'
import { pctColor } from './progress'

/**
 * Two numbers, side by side, with the sentence that keeps them apart.
 *
 * They answer different questions and either alone misleads. Without the explanatory
 * line, "62%" and "91%" next to each other read as a contradiction rather than as
 * coverage-of-the-app versus how-much-of-the-plan-ran.
 *
 * The graph number is LOW on a real project — a third is typical — because non-GET
 * routes need a request body the graph does not describe, parameterised paths have no
 * known value, and a Service node has no address. That is the honest answer, and the
 * uncovered list below is what makes it actionable rather than demoralising.
 */
export default function CoverageSummary({ coverage, compact = false }: {
  coverage: QaCoverage
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ display: 'grid', gap: compact ? 8 : 12 }}>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <Metric label="Graph coverage" pct={coverage.nodePct}
                detail={`${coverage.nodeCovered} of ${coverage.nodeTotal} API and Service nodes verified by a passing test`} />
        <Metric label="Plan executed" pct={coverage.executionPct}
                detail={`${coverage.executed} of ${coverage.planned} planned cases ran`} />
      </div>

      {coverage.denominatorFromPlan && coverage.nodeTotal > 0 && (
        <p style={note}>
          <Info size={11} /> Measured against this run's own plan, not the whole
          project — so it understates coverage of the application.
        </p>
      )}

      {coverage.service.total > 0 && coverage.service.covered === 0 && (
        <p style={note}><Info size={11} /> {coverage.service.note}</p>
      )}

      {coverage.notPlanned > 0 && (
        <p style={note}>
          <Info size={11} /> {coverage.notPlanned} more node
          {coverage.notPlanned === 1 ? ' was' : 's were'} not in this run's plan — a
          kind you excluded, or added to the graph since.
        </p>
      )}

      {coverage.uncovered.length > 0 && (
        <div>
          <button onClick={() => setOpen(v => !v)} style={disclosure}>
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {coverage.uncovered.length} not covered
          </button>
          {open && <UncoveredNodes nodes={coverage.uncovered} />}
        </div>
      )}
    </div>
  )
}

function Metric({ label, pct, detail }: {
  label: string; pct: number | null; detail: string
}) {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em',
                    color: 'var(--color-text-secondary)', fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2,
                    fontVariantNumeric: 'tabular-nums', color: pctColor(pct) }}>
        {/* Never 0% when there is nothing to measure — that says "nothing works",
            which is a different and untrue statement. */}
        {pct === null ? '—' : `${pct}%`}
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
        {detail}
      </div>
    </div>
  )
}

/** What was not covered, grouped by why. The reason is the actionable part. */
export function UncoveredNodes({ nodes }: { nodes: QaCoverage['uncovered'] }) {
  const groups = nodes.reduce<Record<string, QaCoverage['uncovered']>>((acc, n) => {
    const key = n.reason || n.result || 'not covered'
    ;(acc[key] ||= []).push(n)
    return acc
  }, {})

  return (
    <div style={{ display: 'grid', gap: 12, marginTop: 10 }}>
      {Object.entries(groups).map(([reason, items]) => (
        <div key={reason}>
          <div style={{ fontSize: 11, fontWeight: 650, marginBottom: 5 }}>
            {reason} <span style={{ color: 'var(--color-text-secondary)',
                                    fontWeight: 400 }}>({items.length})</span>
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 3 }}>
            {items.slice(0, 60).map(n => (
              <li key={n.externalId} style={{ fontSize: 11,
                                              fontFamily: 'var(--font-mono, monospace)',
                                              color: 'var(--color-text-secondary)' }}>
                {n.method ? `${n.method} ${n.path}` : n.name}
                <span style={{ opacity: .6 }}> · {n.label}</span>
              </li>
            ))}
            {items.length > 60 && (
              <li style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                …and {items.length - 60} more
              </li>
            )}
          </ul>
        </div>
      ))}
    </div>
  )
}

const note: React.CSSProperties = {
  fontSize: 11, color: 'var(--color-text-secondary)', display: 'flex',
  alignItems: 'flex-start', gap: 6, margin: 0, lineHeight: 1.6,
}
const disclosure: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11,
  background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
  color: 'var(--color-text-secondary)',
}
