import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { CASE_KINDS, qaApi } from '../../api/qa'
import type { CaseKind, QaPlanPreview } from '../../api/qa'

/**
 * Which kinds of case to run, chosen before the run starts.
 *
 * The counts come from the real plan, so the Start button can say "Run 23 of 26
 * cases" — which is the entire point of offering the choice.
 *
 * `ui` is shown but not selectable: the application-root case survives every filter
 * server-side, because it is the only case a frontend can be tested by. Presenting a
 * tick-box that cannot be unticked would be worse than saying so.
 */
const MAX_LISTED = 200

export default function TestPlanPicker({ projectId, value, onChange, onPlan }: {
  projectId: string
  value: CaseKind[]
  onChange: (kinds: CaseKind[]) => void
  onPlan?: (plan: QaPlanPreview | null) => void
}) {
  const [plan, setPlan] = useState<QaPlanPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [unsupported, setUnsupported] = useState(false)
  const [showCases, setShowCases] = useState(false)

  useEffect(() => {
    let stop = false
    setLoading(true)
    qaApi.planPreview(projectId)
      .then(({ data }) => {
        if (stop) return
        setPlan(data)
        onPlan?.(data)
      })
      .catch((e: any) => {
        if (stop) return
        // An older backend has no preview. Hide the picker entirely and send no
        // kinds — a control that cannot be honoured is worse than none.
        if (e?.response?.status === 404) setUnsupported(true)
        onPlan?.(null)
      })
      .finally(() => { if (!stop) setLoading(false) })
    return () => { stop = true }
  }, [projectId])

  if (unsupported) return null

  if (loading) {
    return (
      <p style={muted}><Loader2 size={12} className="animate-spin" /> Reading the plan…</p>
    )
  }

  if (plan && !plan.graphReady) {
    return <p style={{ ...muted, lineHeight: 1.6 }}>{plan.reason}</p>
  }
  if (!plan) return null

  const toggle = (kind: CaseKind) => {
    onChange(value.includes(kind) ? value.filter(k => k !== kind) : [...value, kind])
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {CASE_KINDS.map(k => {
          const n = plan.counts[k.id] ?? 0
          if (!n) return null
          const fixed = k.id === 'ui'          // always runs; see the note above
          const on = fixed || value.length === 0 || value.includes(k.id)
          return (
            <button
              key={k.id}
              onClick={() => !fixed && toggle(k.id)}
              disabled={fixed}
              title={fixed ? 'The application check always runs' : k.desc}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                gap: 2, padding: '7px 11px', borderRadius: 7, textAlign: 'left',
                cursor: fixed ? 'default' : 'pointer',
                border: `1px solid ${on ? k.color : 'var(--color-border)'}`,
                background: on ? `${k.color}14` : 'transparent',
                color: 'var(--color-text)', opacity: fixed ? 0.85 : 1,
              }}>
              <span style={{ fontSize: 12, fontWeight: 650 }}>
                {k.label} <span style={{ fontVariantNumeric: 'tabular-nums',
                                         color: 'var(--color-text-secondary)' }}>{n}</span>
              </span>
              <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>
                {fixed ? 'always runs' : k.desc}
              </span>
            </button>
          )
        })}
      </div>

      {value.length === 0 && (
        <p style={muted}>Nothing selected — the run will check only that the
          application loads.</p>
      )}

      {plan.runnableCases < plan.totalCases && (
        <p style={{ ...muted, lineHeight: 1.6 }}>
          {plan.totalCases - plan.runnableCases} of {plan.totalCases} cases cannot be
          executed — non-GET routes need a request body the graph does not describe,
          and parameterised paths have no known value. They are recorded as skipped
          with the reason.
        </p>
      )}

      <div>
        <button onClick={() => setShowCases(v => !v)} style={disclosure}>
          {showCases ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Show the {plan.totalCases} case{plan.totalCases === 1 ? '' : 's'}
        </button>
        {showCases && (
          <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none',
                       display: 'grid', gap: 3, maxHeight: 220, overflow: 'auto' }}>
            {plan.cases.slice(0, MAX_LISTED).map(c => (
              <li key={c.case_id} style={{ fontSize: 11, display: 'flex', gap: 8,
                                           fontFamily: 'var(--font-mono, monospace)',
                                           color: 'var(--color-text-secondary)' }}>
                <span style={{ minWidth: 44, opacity: .7 }}>{c.kind}</span>
                <span>{c.method ? `${c.method} ${c.path}` : c.name}</span>
                {c.skip_reason && (
                  <span style={{ marginLeft: 'auto', color: '#f59e0b', flexShrink: 0 }}>
                    skipped
                  </span>
                )}
              </li>
            ))}
            {plan.cases.length > MAX_LISTED && (
              <li style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                …and {plan.cases.length - MAX_LISTED} more
              </li>
            )}
          </ul>
        )}
      </div>

      {plan.clouds.length > 0 && (
        <p style={muted}>
          Floci emulators for this project: {plan.clouds.join(', ')}
        </p>
      )}
    </div>
  )
}

/** How many cases a selection will actually run — for the Start button's label. */
export function selectedCount(plan: QaPlanPreview | null, kinds: CaseKind[]): number {
  if (!plan) return 0
  if (!kinds.length) return plan.totalCases
  const chosen = new Set<CaseKind>([...kinds, 'ui'])
  return plan.cases.filter(c => chosen.has(c.kind)).length
}

const muted: React.CSSProperties = {
  fontSize: 11, color: 'var(--color-text-secondary)', margin: 0,
  display: 'flex', alignItems: 'center', gap: 6,
}
const disclosure: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11,
  background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
  color: 'var(--color-text-secondary)',
}
