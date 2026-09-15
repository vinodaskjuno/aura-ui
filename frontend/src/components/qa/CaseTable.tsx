import { useMemo, useState } from 'react'
import {
  CheckCircle2, ChevronDown, ChevronRight, CircleSlash, CloudOff, MinusCircle, XCircle,
} from 'lucide-react'
import type { CaseKind, RunReport, RunStep } from '../../api/qa'
import StepTimeline from './StepTimeline'
import { caseOutcome, notRunReason, stepsByCase, type CaseOutcome } from './progress'

/**
 * The test cases themselves — what was planned, what each one verifies, and how it
 * went.
 *
 * `report.cases` has always been in the payload and was never rendered anywhere, so
 * the UI could show you a list of actions but never which requirement or graph node
 * they covered. That is the question a reviewer actually asks.
 */

const OUTCOME: Record<CaseOutcome, { label: string; colour: string; icon: React.ReactNode }> = {
  passed:     { label: 'passed',        colour: '#10b981', icon: <CheckCircle2 size={13} /> },
  failed:     { label: 'failed',        colour: '#ef4444', icon: <XCircle size={13} /> },
  skipped:    { label: 'skipped',       colour: '#f59e0b', icon: <MinusCircle size={13} /> },
  unemulated: { label: 'not emulated',  colour: '#8b5cf6', icon: <CloudOff size={13} /> },
  'not-run':  { label: 'did not run',   colour: 'var(--color-text-secondary)', icon: <CircleSlash size={13} /> },
}

const KIND_COLOUR: Record<CaseKind, string> = {
  ui: '#4f8ef7', api: '#10b981', smoke: '#8b5cf6', structure: '#f59e0b',
  stack: '#06b6d4',
  // Rose, and deliberately unlike the pass/fail palette: a policy case is a control,
  // not a test of the application, and the colour should not imply otherwise.
  policy: '#f43f5e',
}

type Filter = 'all' | 'failed' | 'not-run' | CaseKind

export default function CaseTable({ report, steps }: {
  report: RunReport
  steps: RunStep[]
}) {
  const byCase = useMemo(() => stepsByCase(steps), [steps])
  const rows = useMemo(() => (report.cases || []).map(c => ({
    testCase: c,
    steps: byCase[c.case_id] || [],
    outcome: caseOutcome(byCase[c.case_id] || []),
  })), [report.cases, byCase])

  // Default to the failures when there are any — that is the question being asked.
  const [filter, setFilter] = useState<Filter>(
    report.totalFailed > 0 ? 'failed' : 'all')
  const [open, setOpen] = useState<string | null>(null)

  const shown = rows.filter(r =>
    filter === 'all' ? true
    : filter === 'failed' ? r.outcome === 'failed'
    : filter === 'not-run' ? r.outcome === 'not-run'
    : r.testCase.kind === filter)

  const counts = {
    failed: rows.filter(r => r.outcome === 'failed').length,
    notRun: rows.filter(r => r.outcome === 'not-run').length,
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <Chip on={filter === 'all'} onClick={() => setFilter('all')}>
          All {rows.length}
        </Chip>
        {counts.failed > 0 && (
          <Chip on={filter === 'failed'} onClick={() => setFilter('failed')} colour="#ef4444">
            Failed {counts.failed}
          </Chip>
        )}
        {counts.notRun > 0 && (
          <Chip on={filter === 'not-run'} onClick={() => setFilter('not-run')}>
            Did not run {counts.notRun}
          </Chip>
        )}
        {/* `policy` was omitted, so policy cases were reachable only through All or
          Failed — they have their own colour and their own meaning and should be
          filterable like every other kind. */}
      {(['ui', 'api', 'smoke', 'structure', 'stack',
         'policy'] as CaseKind[]).map(k => {
          const n = rows.filter(r => r.testCase.kind === k).length
          return n ? (
            <Chip key={k} on={filter === k} onClick={() => setFilter(k)} colour={KIND_COLOUR[k]}>
              {k} {n}
            </Chip>
          ) : null
        })}
      </div>

      <div style={{ display: 'grid', gap: 2 }}>
        {shown.map(({ testCase, steps: caseSteps, outcome }) => {
          const look = OUTCOME[outcome]
          const expanded = open === testCase.case_id
          return (
            <div key={testCase.case_id}
                 style={{ border: '1px solid var(--color-border)', borderRadius: 6 }}>
              <button
                onClick={() => setOpen(expanded ? null : testCase.case_id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                         padding: '9px 11px', background: 'transparent', border: 'none',
                         cursor: 'pointer', textAlign: 'left', color: 'var(--color-text)' }}>
                {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span style={{ color: look.colour, display: 'flex' }}>{look.icon}</span>

                <span style={{ fontSize: 12, fontWeight: 600, minWidth: 0,
                               overflow: 'hidden', textOverflow: 'ellipsis',
                               whiteSpace: 'nowrap' }}>
                  {testCase.name}
                </span>

                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 5px',
                               borderRadius: 3, textTransform: 'uppercase',
                               color: KIND_COLOUR[testCase.kind],
                               background: `${KIND_COLOUR[testCase.kind]}1f` }}>
                  {testCase.kind}
                </span>

                {testCase.verifies_eid && (
                  <span title={testCase.verifies_eid}
                        style={{ fontSize: 10, color: 'var(--color-text-secondary)',
                                 fontFamily: 'var(--font-mono, monospace)' }}>
                    {testCase.verifies_label}
                  </span>
                )}

                <span style={{ marginLeft: 'auto', fontSize: 11, color: look.colour }}>
                  {look.label}
                </span>
              </button>

              {expanded && (
                <div style={{ padding: '0 11px 11px 33px' }}>
                  <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr',
                               gap: '3px 12px', fontSize: 11, margin: '0 0 10px' }}>
                    {testCase.method && (
                      <>
                        <dt style={dt}>Route</dt>
                        <dd style={dd}>{testCase.method} {testCase.path}</dd>
                      </>
                    )}
                    {testCase.verifies_eid && (
                      <>
                        <dt style={dt}>Verifies</dt>
                        <dd style={dd}>{testCase.verifies_label} · {testCase.verifies_eid}</dd>
                      </>
                    )}
                    {testCase.source_file && (
                      <>
                        <dt style={dt}>Source</dt>
                        <dd style={dd} title={testCase.source_file}>
                          {testCase.source_file.split('/').pop()}
                        </dd>
                      </>
                    )}
                    {outcome === 'not-run' && (
                      <>
                        <dt style={dt}>Why</dt>
                        <dd style={{ ...dd, color: '#f59e0b' }}>
                          {notRunReason(testCase, report)}
                        </dd>
                      </>
                    )}
                  </dl>
                  {caseSteps.length
                    ? <StepTimeline steps={caseSteps} />
                    : <p style={{ fontSize: 11, color: 'var(--color-text-secondary)',
                                  margin: 0 }}>
                        This case produced no steps.
                      </p>}
                </div>
              )}
            </div>
          )
        })}
        {!shown.length && (
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
            No cases match that filter.
          </p>
        )}
      </div>
    </div>
  )
}

function Chip({ on, onClick, colour, children }: {
  on: boolean; onClick: () => void; colour?: string; children: React.ReactNode
}) {
  const c = colour ?? 'var(--color-primary)'
  return (
    <button onClick={onClick}
            style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, cursor: 'pointer',
                     border: `1px solid ${on ? c : 'var(--color-border)'}`,
                     background: on ? `${c}1f` : 'transparent',
                     color: on ? c : 'var(--color-text-secondary)',
                     textTransform: 'capitalize' }}>
      {children}
    </button>
  )
}

const dt: React.CSSProperties = { color: 'var(--color-text-secondary)', margin: 0 }
const dd: React.CSSProperties = {
  margin: 0, fontFamily: 'var(--font-mono, monospace)', wordBreak: 'break-all',
}
