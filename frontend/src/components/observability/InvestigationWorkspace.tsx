import { useMemo, useState } from 'react'
import { AlertTriangle, List, GitBranch } from 'lucide-react'
import type { Evidence, Finding, Investigation, PastCase, RunbookMatch } from '../../api/observability'
import type { RunState } from '../../hooks/useObservabilityStream'
import AgentRunTimeline from './AgentRunTimeline'
import EvidenceDrawer from './EvidenceDrawer'
import EvidenceTimeline from './EvidenceTimeline'
import FindingCard from './FindingCard'
import LearnedFromPanel from './LearnedFromPanel'
import RootCauseVerdict from './RootCauseVerdict'
import { fmtConfidence } from './observabilityFormat'
import type { Outcome } from '../../api/observability'

interface Props {
  run: RunState
  investigation: Investigation | null
  runbook: RunbookMatch | null
  cases: { cases: PastCase[]; negative_cases: PastCase[]; category_priors: Record<string, number>
           corpus_size: number; below_floor: boolean } | null
  demo: boolean
  onRecordOutcome: (o: Outcome) => void
  onRefreshCases: () => void
}

export default function InvestigationWorkspace({
  run, investigation, runbook, cases, demo, onRecordOutcome, onRefreshCases,
}: Props) {
  const [view, setView] = useState<'findings' | 'timeline'>('findings')
  const [hovered, setHovered] = useState<string | null>(null)
  const [pinned, setPinned] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [showCases, setShowCases] = useState(false)

  // Memoized on the SOURCE arrays, not on a value rebuilt every render — otherwise
  // the useMemo below never actually memoizes anything.
  const evidence: Evidence[] = useMemo(
    () => (run.evidence.length ? run.evidence : (investigation?.evidence ?? [])),
    [run.evidence, investigation?.evidence])
  const findings: Finding[] = useMemo(
    () => (run.findings.length ? run.findings : (investigation?.findings ?? [])),
    [run.findings, investigation?.findings])

  const evidenceById = useMemo(
    () => Object.fromEntries(evidence.map((e) => [e.evidenceId, e])),
    [evidence])

  const pinnedEvidence = pinned ? evidenceById[pinned] ?? null
    : hovered ? evidenceById[hovered] ?? null : null

  const jumpToFinding = (findingId: string) => {
    setFlash(findingId)
    document.getElementById(`finding-${findingId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => setFlash(null), 1200)
  }

  const investigationId = run.investigationId || investigation?.investigationId || ''
  const llmError = run.llmError || investigation?.llmError || null
  const rootCauseFinding = findings.find((f) => f.status === 'root_cause')

  return (
    <div style={{
      display: 'grid', gap: 14, minHeight: 0, flex: 1,
      gridTemplateColumns: 'minmax(210px, 250px) 1fr minmax(290px, 370px)',
    }}>
      {/* LEFT — live agent progress */}
      <aside style={{ ...panel, overflowY: 'auto' }}>
        <PanelTitle>Agent run</PanelTitle>
        <AgentRunTimeline state={run} />

        {runbook && (
          <div style={{ marginTop: 16, paddingTop: 12,
            borderTop: '1px solid var(--color-border)' }}>
            <PanelTitle>Runbook</PanelTitle>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)',
              marginBottom: 4 }}>{runbook.title}</div>
            <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
              {runbook.steps_satisfied}/{runbook.steps?.length ?? 0} steps satisfied
              {' · '}score {runbook.match_score?.toFixed(2)}
            </div>
          </div>
        )}

        {cases && !cases.below_floor && cases.cases.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 12,
            borderTop: '1px solid var(--color-border)' }}>
            <PanelTitle>Prior knowledge</PanelTitle>
            <button onClick={() => setShowCases((v) => !v)}
              style={{ fontSize: 11.5, color: '#8b5cf6', background: 'none',
                border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
              informed by {cases.cases.length} past incident
              {cases.cases.length === 1 ? '' : 's'}
            </button>
          </div>
        )}
      </aside>

      {/* CENTER — findings / timeline */}
      <section style={{ ...panel, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ display: 'flex', background: 'var(--color-surface)',
            borderRadius: 7, padding: 2, border: '1px solid var(--color-border)' }}>
            {([['findings', 'Findings', List], ['timeline', 'Timeline', GitBranch]] as const)
              .map(([id, label, Icon]) => (
              <button key={id} onClick={() => setView(id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5,
                  fontWeight: 600, padding: '4px 11px', borderRadius: 5, cursor: 'pointer',
                  border: 'none',
                  background: view === id ? 'var(--color-primary)' : 'transparent',
                  color: view === id ? '#fff' : 'var(--color-muted)',
                }}>
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          {run.citationCoverage > 0 && (
            <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
              citation coverage <b style={{ color: 'var(--color-text)' }}>
                {fmtConfidence(run.citationCoverage)}</b>
            </span>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {showCases && cases && (
            <LearnedFromPanel
              cases={cases.cases} negative={cases.negative_cases}
              priors={cases.category_priors} corpusSize={cases.corpus_size}
              belowFloor={cases.below_floor}
              onClose={() => setShowCases(false)}
              onForget={onRefreshCases}
            />
          )}

          {view === 'findings' ? (
            findings.length === 0 ? (
              llmError ? (
                /* An empty findings list with no explanation reads as a broken
                   feature. The provider's own reason is almost always something
                   the operator can fix — billing, an API key, a bad model id. */
                <div style={{ padding: 18, borderRadius: 8, background: '#f59e0b14',
                  border: '1px solid #f59e0b55', lineHeight: 1.65 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7,
                    fontSize: 13, fontWeight: 700, color: '#f59e0b', marginBottom: 7 }}>
                    <AlertTriangle size={14} /> The model could not be reached
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--color-text)',
                    fontFamily: 'var(--font-mono)', wordBreak: 'break-word' }}>
                    {llmError}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 9 }}>
                    Signals were still collected and correlated — open the
                    <b> Timeline</b> view to inspect the evidence. Only the
                    hypothesis and root-cause steps need the model.
                  </div>
                </div>
              ) : (
                <div style={{ padding: 26, textAlign: 'center', fontSize: 12.5,
                  color: 'var(--color-muted)', lineHeight: 1.7 }}>
                  {run.status === 'running'
                    ? 'Agents are still working — findings appear as they are established.'
                    : 'No findings yet. Start an investigation from the Incidents tab.'}
                </div>
              )
            ) : (
              <>
                {findings.map((f, i) => (
                  <FindingCard
                    key={f.findingId}
                    finding={f}
                    index={i + 1}
                    evidenceById={evidenceById}
                    hovered={hovered}
                    onHoverEvidence={setHovered}
                    onPinEvidence={setPinned}
                    onShowCases={() => setShowCases(true)}
                    flash={flash === f.findingId}
                  />
                ))}
                {rootCauseFinding && investigationId && !demo && (
                  <RootCauseVerdict
                    investigationId={investigationId}
                    outcome={investigation?.outcome ?? null}
                    onRecorded={onRecordOutcome}
                  />
                )}
                {demo && rootCauseFinding && (
                  <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--color-muted)' }}>
                    Verdict recording is disabled in demo mode — it would write to the
                    learning corpus.
                  </div>
                )}
              </>
            )
          ) : (
            <EvidenceTimeline
              evidence={evidence} hovered={hovered}
              onHover={setHovered} onPin={setPinned}
            />
          )}
        </div>
      </section>

      {/* RIGHT — evidence drawer */}
      <aside style={{ ...panel, padding: 0, display: 'flex', flexDirection: 'column',
        minHeight: 0 }}>
        <EvidenceDrawer
          investigationId={investigationId}
          evidence={pinnedEvidence}
          findings={findings}
          demo={demo}
          onJumpToFinding={jumpToFinding}
        />
      </aside>
    </div>
  )
}

const panel: React.CSSProperties = {
  background: 'var(--color-card)', border: '1px solid var(--color-border)',
  borderRadius: 10, padding: 14, minHeight: 0,
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em',
    textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 9 }}>{children}</div>
}
