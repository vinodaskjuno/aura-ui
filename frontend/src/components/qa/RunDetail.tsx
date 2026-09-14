import { useEffect, useState } from 'react'
import {
  ArrowLeft, CheckCircle2, Clock, CloudOff, Laptop, MinusCircle, Play, RefreshCw,
  User, XCircle,
} from 'lucide-react'
import { qaApi } from '../../api/qa'
import type { CaseKind, QaActiveRun, QaCoverage, RunReport, RunStep,
              TestArtifact } from '../../api/qa'
import CaseTable from './CaseTable'
import CoverageSummary from './CoverageSummary'
import EmulatorTable from './EmulatorTable'
import ConsoleLog from './ConsoleLog'
import StepTimeline from './StepTimeline'
import ArtifactViewer from './ArtifactViewer'
import { RunEmulators } from './FlociContainerTable'
import FlociTerminal from './FlociTerminal'
import RunCost from './RunCost'
import { runMachineLabel, runMachineName } from './useQaRunners'
import { executionRate, hasCoverage } from './progress'

/**
 * One run, in full — and the only run detail there is.
 *
 * It replaces two views that disagreed: a 380px drawer showing counts and download
 * links but no steps, and a results panel showing steps but no artifacts. Neither
 * showed the cases, the emulators that failed, the console output, or how long the run
 * took. Everything below was already in the payload and simply never rendered.
 *
 * Inline rather than a drawer, because none of that fits in 380px — which is why the
 * drawer showed none of it.
 */
export default function RunDetail({ projectId, runId, status, onBack, onRerun, live,
                                   you }: {
  projectId: string
  runId: string
  /** From the list row, so the header paints before the fetch lands. */
  status?: string
  onBack: () => void
  onRerun?: (kinds: CaseKind[]) => void
  /** The queue's view of this run while it is still executing. Null once it has
   *  finished — S3 holds the report from then on. */
  live?: QaActiveRun | null
  you?: string
}) {
  const [report, setReport] = useState<RunReport | null>(null)
  const [steps, setSteps] = useState<RunStep[]>([])
  const [coverage, setCoverage] = useState<QaCoverage | null>(null)
  const [artifacts, setArtifacts] = useState<TestArtifact[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const liveMachine = live ? runMachineLabel(live, you) : ''   // prose
  const liveMachineName = live ? runMachineName(live) : ''     // chrome

  useEffect(() => {
    let stop = false
    setLoading(true)
    setError('')
    // Settled independently: a missing artifact listing must not blank the page.
    Promise.allSettled([
      qaApi.getResult(projectId, runId),
      qaApi.getArtifacts(runId),
    ]).then(([result, arts]) => {
      if (stop) return
      if (result.status === 'fulfilled') {
        setReport(result.value.data.report)
        setSteps(result.value.data.steps || [])
        setCoverage(result.value.data.coverage ?? result.value.data.report?.coverage ?? null)
      } else {
        setError('Could not read this run. Its evidence may still be uploading.')
      }
      if (arts.status === 'fulfilled') setArtifacts(arts.value.data || [])
      setLoading(false)
    })
    return () => { stop = true }
  }, [projectId, runId])

  const failedCases = report
    ? (report.cases || []).filter(c =>
        steps.some(s => s.caseId === c.case_id && s.status === 'failed'))
    : []

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <button onClick={onBack} style={backBtn}>
        <ArrowLeft size={13} /> All runs
      </button>

      {loading && <p style={muted}>Loading the run…</p>}
      {!!error && <p style={{ ...muted, color: '#ef4444' }}>{error}</p>}

      {report && (
        <>
          <header style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <StatusIcon status={report.status || status || ''} />
              <span style={{ fontSize: 14, fontWeight: 650,
                             fontFamily: 'var(--font-mono, monospace)' }}>
                {report.runId}
              </span>
              {!!report.selectedKinds?.length && (
                <span title="This run was deliberately partial"
                      style={badge}>
                  {report.selectedKinds.join(' + ')} only
                </span>
              )}
              {report.exploratory && <span style={badge}>exploratory</span>}

              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                {onRerun && (
                  <button onClick={() => onRerun(report.selectedKinds ?? [])} style={btn}>
                    <RefreshCw size={12} /> Re-run
                  </button>
                )}
                {onRerun && failedCases.length > 0 && (
                  <button
                    onClick={() => onRerun([...new Set(failedCases.map(c => c.kind))])}
                    style={btn}
                    title="Re-runs the kinds those failures belong to">
                    <Play size={12} /> Re-run failed ({failedCases.length})
                  </button>
                )}
              </div>
            </div>

            {!!report.reason && (
              <p style={{ fontSize: 12, color: '#f59e0b', margin: 0, lineHeight: 1.6 }}>
                {report.reason}
              </p>
            )}

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11,
                          color: 'var(--color-text-secondary)' }}>
              <Meta icon={<Clock size={11} />}>
                {report.startedAt ? new Date(report.startedAt).toLocaleString() : '—'}
              </Meta>
              {report.durationMs > 0 && (
                <Meta icon={<Clock size={11} />}>
                  {(report.durationMs / 1000).toFixed(1)}s
                </Meta>
              )}
              {!!report.ranBy && <Meta icon={<User size={11} />}>{report.ranBy}</Meta>}
              {/* Where it executed. Prose, so it names the owner — the section titles
                  below use the bare machine name. */}
              {!!liveMachine && (
                <Meta icon={<Laptop size={11} />}>executed locally on {liveMachine}</Meta>
              )}
              {!!report.appUrl && (
                <Meta>{report.appUrl}</Meta>
              )}
            </div>
          </header>

          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
            <Tally n={report.totalPassed} label="passed" colour="#10b981" />
            <Tally n={report.totalFailed} label="failed" colour="#ef4444" />
            <Tally n={report.totalSkipped} label="skipped" colour="#f59e0b" />
            {/* Never rendered before, and it is the difference between "your app is
                broken" and "we could not check". */}
            <Tally n={report.totalUnemulated} label="not emulated" colour="#8b5cf6" />
          </div>

          {hasCoverage(coverage)
            ? <Section title="Coverage"><CoverageSummary coverage={coverage} /></Section>
            : <Section title="Coverage"><FallbackCoverage report={report} steps={steps} /></Section>}

          {live?.emulators?.length ? (
            <Section title={`Floci, right now${liveMachineName ? ` — ${liveMachineName}` : ''}`}>
              <RunEmulators emulators={live.emulators} stale={live.emulatorsStale} />
            </Section>
          ) : null}

          {/* Only while it is still running. A finished run's console is the stored
              one below, which is a different thing and already has a section. */}
          {live && (
            <Section title="Output">
              <FlociTerminal activity={live.activity ?? []} machine={liveMachineName}
                             state={live.emulatorsStale ? 'stalled' : 'live'} />
            </Section>
          )}

          <Section title={`Test cases (${report.cases?.length ?? 0})`}>
            {report.cases?.length
              ? <CaseTable report={report} steps={steps} />
              : <StepTimeline steps={steps} />}
          </Section>

          <Section title="Cloud emulators">
            <EmulatorTable emulators={report.emulators || []} />
          </Section>

          <Section title="Model cost">
            <RunCost projectId={projectId} runId={runId} />
          </Section>

          <Section title="Console">
            <ConsoleLog projectId={projectId} runId={runId} />
          </Section>

          {artifacts.length > 0 && (
            <Section title={`Artifacts (${artifacts.length})`}>
              <ArtifactViewer runId={runId} steps={steps} />
            </Section>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Execution rate alone, when the backend has no coverage block.
 *
 * Derived entirely client-side from `report.cases` and `step.caseId`. Deliberately
 * does NOT fall back to `report.covered`: that counts nodes the plan TOUCHED, so a run
 * where every case failed would report full coverage — wrong in exactly the case that
 * matters.
 */
function FallbackCoverage({ report, steps }: { report: RunReport; steps: RunStep[] }) {
  const rate = executionRate(report, steps)
  return (
    <div>
      <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2 }}>
        {rate.pct === null ? '—' : `${rate.pct}%`}
      </div>
      <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
        {rate.executed} of {rate.planned} planned cases ran. Graph coverage needs a
        newer QualityMind API.
      </p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.07em',
                   color: 'var(--color-text-secondary)', margin: '0 0 10px',
                   fontWeight: 700 }}>
        {title}
      </h3>
      {children}
    </section>
  )
}

function Tally({ n, label, colour }: { n: number; label: string; colour: string }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, color: n ? colour : 'var(--color-text-secondary)',
                    fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{n ?? 0}</div>
      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{label}</div>
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'passed') return <CheckCircle2 size={16} color="#10b981" />
  if (status === 'failed') return <XCircle size={16} color="#ef4444" />
  if (status === 'unavailable') return <CloudOff size={16} color="#f59e0b" />
  return <MinusCircle size={16} color="var(--color-text-secondary)" />
}

function Meta({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      {icon}{children}
    </span>
  )
}

const muted: React.CSSProperties = { fontSize: 12, color: 'var(--color-text-secondary)' }
const badge: React.CSSProperties = {
  fontSize: 10, padding: '2px 7px', borderRadius: 4, fontWeight: 600,
  background: 'var(--color-surface-2, rgba(127,127,127,.15))',
  color: 'var(--color-text-secondary)',
}
const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11,
  padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
  border: '1px solid var(--color-border)', background: 'transparent',
  color: 'var(--color-text)',
}
const backBtn: React.CSSProperties = {
  ...btn, alignSelf: 'flex-start', border: 'none', padding: 0,
  color: 'var(--color-text-secondary)',
}
