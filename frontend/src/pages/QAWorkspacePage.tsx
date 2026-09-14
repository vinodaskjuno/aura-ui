import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FlaskConical, RefreshCw, Layers3, Activity, FileCheck,
  ChevronDown, ChevronUp, FileText, Server, ShieldCheck, ShieldX,
  X, Download, Play,
} from 'lucide-react'
import { qaApi, type CaseKind, type QaCapabilities, type QaCoverage,
         type TestRun, type TestArtifact } from '../api/qa'
import LocalRunView from '../components/qa/LocalRunView'
import RunLauncher from '../components/qa/RunLauncher'
import RunDetail from '../components/qa/RunDetail'
import RunProgress from '../components/qa/RunProgress'
import RunnerPanel from '../components/qa/RunnerPanel'
import RunnerStatusChip from '../components/qa/RunnerStatusChip'
import ConfirmDeleteDialog from '../components/ui/ConfirmDeleteDialog'
import ProjectStatusBoard from '../components/qa/ProjectStatusBoard'
import ActivityFeed from '../components/qa/ActivityFeed'
import CoverageSummary from '../components/qa/CoverageSummary'
import { useQaRunners } from '../components/qa/useQaRunners'
import { Metric, type MetricProps } from '../components/ui/Metric'
import { pctState, inversePctState } from '../components/ui/metricState'
import { useAuthStore } from '../store/authStore'

// ── Tab definition ────────────────────────────────────────────────────────────
type Tab = 'runs' | 'coverage' | 'runner' | 'activity'

// Four, as before. `Results` was a second rendering of the same S3 data the Runs tab
// already lists, and `Artifacts` was a project-level picker for something that belongs
// to a single run — both now live inside RunDetail, which pays for the two new tabs.
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'runs',     label: 'Test Runs', icon: <Layers3 size={13} /> },
  { id: 'coverage', label: 'Coverage',  icon: <ShieldCheck size={13} /> },
  // The machine doing the work, and the Floci containers on it. The API runs on
  // Fargate and can never see them itself — everything here is reported by the runner.
  { id: 'runner',   label: 'Runner',    icon: <Server size={13} /> },
  { id: 'activity', label: 'Activity',  icon: <Activity size={13} /> },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
const RUN_STATUS_COLORS: Record<string, string> = {
  generated: '#10b981', completed: '#10b981', running: '#3b82f6',
  failed: '#ef4444', pending: '#f59e0b', simulated: '#8b5cf6',
}

function StatusBadge({ status }: { status: string }) {
  const color = RUN_STATUS_COLORS[status] ?? '#6b7280'
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
      background: `${color}20`, color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function PassRateBar({ passed = 0, failed = 0, skipped = 0 }: {
  passed?: number; failed?: number; skipped?: number
}) {
  const total = passed + failed + skipped
  if (!total) return null
  const pct = Math.round((passed / total) * 100)
  const color = pct >= 90 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: 'var(--color-card)',
        borderRadius: 3, overflow: 'hidden', minWidth: 80 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color,
          borderRadius: 3, transition: 'width 0.5s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 36 }}>{pct}%</span>
    </div>
  )
}

// ── Run Detail Drawer ─────────────────────────────────────────────────────────
function RunDetailDrawer({ run, projectId, onClose, onRefresh }: {
  run: TestRun; projectId: string; onClose: () => void; onRefresh: () => void
}) {
  const [artifacts, setArtifacts]   = useState<TestArtifact[]>([])
  const [showContainer, setShowContainer] = useState(false)

  useEffect(() => {
    qaApi.getArtifacts(run.testRunId).then(r => setArtifacts(r.data)).catch(() => {})
  }, [run.testRunId])

  const total = (run.totalPassed ?? 0) + (run.totalFailed ?? 0) + (run.totalSkipped ?? 0)

  return (
    <motion.div initial={{ x: 340, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
      exit={{ x: 340, opacity: 0 }}
      style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 380, zIndex: 100,
        background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)',
        overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)' }}>

      {/* Header */}
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--color-border)',
        position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 15,
            color: 'var(--color-text)' }}>
            Run Detail
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-muted)', display: 'flex', padding: 4 }}>
            <X size={15} />
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: 'var(--font-mono)',
          marginBottom: 8 }}>
          {run.testRunId}
        </div>
        <StatusBadge status={run.status} />
        {run.type === 'container_execution' && (
          <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
            background: 'rgba(16,185,129,0.12)', color: '#10b981',
            border: '1px solid rgba(16,185,129,0.3)',
            display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'middle' }}>
            <Server size={9} /> ECS Fargate
          </span>
        )}
      </div>

      <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Stats */}
        {total > 0 && (
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Results</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
              {[
                { label: 'Passed',  value: run.totalPassed  ?? 0, color: '#10b981', icon: <ShieldCheck size={14} /> },
                { label: 'Failed',  value: run.totalFailed  ?? 0, color: '#ef4444', icon: <ShieldX size={14} /> },
                { label: 'Skipped', value: run.totalSkipped ?? 0, color: '#f59e0b', icon: null },
              ].map(s => (
                <div key={s.label} style={{ background: `${s.color}12`, border: `1px solid ${s.color}30`,
                  borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: 22,
                    color: s.color }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{s.label}</div>
                </div>
              ))}
            </div>
            <PassRateBar passed={run.totalPassed} failed={run.totalFailed} skipped={run.totalSkipped} />
          </div>
        )}

        {/* Artifacts */}
        {artifacts.length > 0 && (
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Artifacts</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {artifacts.map((a, i) => (
                <a key={i} href={a.url} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                    background: 'var(--color-card)', border: '1px solid var(--color-border)',
                    borderRadius: 8, textDecoration: 'none', color: 'var(--color-primary)',
                    fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                  <Download size={12} />
                  {a.filename}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--color-border)',
          display: 'flex', flexDirection: 'column', gap: 8 }}>
          <motion.button
            onClick={() => setShowContainer(true)}
            style={{ width: '100%', justifyContent: 'center', gap: 6, padding: '7px',
              background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.35)',
              borderRadius: 8, cursor: 'pointer', color: '#10b981', fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}
            whileHover={{ scale: 1.01, background: 'rgba(16,185,129,0.18)' }}
            whileTap={{ scale: 0.98 }}>
            <Play size={13} /> Run tests
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {showContainer && (
          <LocalRunView
            projectId={projectId}
            defaultUrl={run.appUrl}
            onClose={() => setShowContainer(false)}
            onComplete={onRefresh}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Test Runs Table ───────────────────────────────────────────────────────────
function TestRunsTab({ suites, projectId, onViewArtifacts, onRefresh }: {
  suites: TestRun[]
  projectId: string
  onViewArtifacts: (runId: string) => void
  onRefresh: () => void
}) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [selectedRun, setSelectedRun]   = useState<TestRun | null>(null)

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (suites.length === 0) {
    return (
      <motion.div className="ov-card"
        style={{ padding: '48px 20px', textAlign: 'center' }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <FlaskConical size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }}
          color="var(--color-primary)" />
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15,
          color: 'var(--color-text)', marginBottom: 6 }}>
          No test runs yet
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
          Open a project, then press <strong>Start a run</strong> on its Results tab.
        </div>
      </motion.div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {suites.map((run, i) => {
          const expanded = expandedRows.has(run.testRunId)
          const results  = run.results ?? []
          return (
            <motion.div key={run.testRunId} className="ov-card"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.035 }}
              style={{ overflow: 'hidden' }}>

              {/* Row header */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px',
                cursor: 'pointer', gap: 12 }}
                onClick={() => toggleRow(run.testRunId)}>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13,
                      color: 'var(--color-text)' }}>
                      Run #{run.testRunId.slice(0, 8).toUpperCase()}
                    </span>
                    <StatusBadge status={run.status} />
                    {run.type === 'container_execution' && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                        background: 'rgba(16,185,129,0.12)', color: '#10b981',
                        border: '1px solid rgba(16,185,129,0.3)',
                        display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <Server size={9} /> ECS
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                      {new Date(run.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                      {run.totalTests ?? run.suiteCount ?? 0} tests
                    </span>
                    {(run.totalTests ?? 0) > 0 && (
                      <div style={{ flex: 1, maxWidth: 200 }}>
                        <PassRateBar
                          passed={run.totalPassed}
                          failed={run.totalFailed}
                          skipped={run.totalSkipped}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={e => { e.stopPropagation(); onViewArtifacts(run.testRunId) }}
                    className="ov-btn ov-btn-ghost"
                    style={{ fontSize: 11, padding: '4px 10px', gap: 4 }}>
                    <FileCheck size={11} /> Artifacts
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setSelectedRun(run) }}
                    className="ov-btn ov-btn-ghost"
                    style={{ fontSize: 11, padding: '4px 10px', gap: 4 }}>
                    <FileText size={11} /> Details
                  </button>
                  {expanded
                    ? <ChevronUp size={15} color="var(--color-muted)" />
                    : <ChevronDown size={15} color="var(--color-muted)" />}
                </div>
              </div>

              {/* Expanded file results */}
              <AnimatePresence>
                {expanded && results.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    style={{ overflow: 'hidden', borderTop: '1px solid var(--color-border)' }}>
                    <div style={{ padding: '12px 16px' }}>
                      <div className="section-label" style={{ marginBottom: 8 }}>File Results</div>
                      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                            {['File', 'Pass', 'Fail', 'Skip', 'Duration', 'Status'].map(h => (
                              <th key={h} style={{ padding: '5px 10px', textAlign: 'left', fontSize: 10,
                                fontWeight: 700, color: 'var(--color-muted)',
                                textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {results.map((r, j) => (
                            <tr key={j} style={{ borderBottom: '1px solid var(--color-border)' }}>
                              <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)',
                                color: 'var(--color-text)', fontSize: 11 }}>{r.file}</td>
                              <td style={{ padding: '7px 10px', color: '#10b981', fontWeight: 600 }}>{r.passed}</td>
                              <td style={{ padding: '7px 10px', color: '#ef4444', fontWeight: 600 }}>{r.failed}</td>
                              <td style={{ padding: '7px 10px', color: '#f59e0b', fontWeight: 600 }}>{r.skipped}</td>
                              <td style={{ padding: '7px 10px', color: 'var(--color-muted)' }}>
                                {r.duration?.toFixed(1)}s
                              </td>
                              <td style={{ padding: '7px 10px' }}><StatusBadge status={r.status} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>

      <AnimatePresence>
        {selectedRun && (
          <RunDetailDrawer
            run={selectedRun}
            projectId={projectId}
            onClose={() => setSelectedRun(null)}
            onRefresh={onRefresh}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ── Stats Bar ─────────────────────────────────────────────────────────────────
/**
 * What this screen reports depends on who is looking at it.
 *
 * A QA engineer needs to know what the last run could not reach; a developer
 * only wants to know whether their project is tested at all; an operator cares
 * about the fleet and the queue. One bar showing all of it serves none of them,
 * which is what "Total Runs · Pass Rate · Last Run · Coverage" was.
 *
 * Derived entirely from data this page has already fetched — no extra request.
 */
function StatsBar({ suites, coverage }: { suites: TestRun[]; coverage: QaCoverage | null }) {
  const role = useAuthStore(s => s.role)
  if (!suites.length) return null

  const latest = suites[0]
  const live = suites.filter(r => ['queued', 'claimed', 'running'].includes(r.status))
  const stuck = live.filter(r => r.createdAt &&
    Date.now() - new Date(r.createdAt).getTime() > 6 * 3600 * 1000)

  const planned = latest?.totalCases ?? coverage?.planned ?? 0
  const ran = (latest?.totalPassed ?? 0) + (latest?.totalFailed ?? 0)
  const untestableN = (latest?.totalUnemulated ?? 0) + (latest?.totalSkipped ?? 0)
  const untestable = planned ? Math.round((untestableN / planned) * 100) : null
  const executed = planned ? Math.round((ran / planned) * 100) : null
  const nodePct = coverage?.nodePct ?? null

  const lastResult = latest?.status === 'failed' ? 'failed'
    : latest?.status === 'unavailable' ? 'unavailable'
    : latest?.status === 'cancelled' ? 'cancelled'
    : latest ? `${latest.totalPassed ?? 0} of ${planned} passed` : null

  let items: MetricProps[]
  if (role === 'user_ops') {
    items = [
      { label: 'Runs', value: suites.length, basis: 'recorded' },
      { label: 'Live now', value: live.length,
        state: live.length ? 'attention' : 'ok', basis: 'queued or running' },
      { label: 'Stuck', value: stuck.length,
        state: stuck.length ? 'critical' : 'ok', basis: 'running over 6h' },
      { label: 'Coverage', value: nodePct, unit: '%', state: pctState(nodePct),
        basis: nodePct === null ? 'no run has completed' : 'of graph nodes' },
    ]
  } else if (role === 'user_dev' || role === 'ontology_maintainer') {
    items = [
      { label: 'Tested', value: coverage ? 'yes' : 'no',
        state: coverage ? 'ok' : 'attention',
        basis: coverage ? 'this project has coverage' : 'no run has verified it' },
      { label: 'Last result', value: lastResult,
        state: latest?.status === 'failed' ? 'critical'
             : latest?.status === 'unavailable' ? 'attention' : 'ok',
        basis: latest?.createdAt
          ? new Date(latest.createdAt).toLocaleDateString(undefined,
              { month: 'short', day: 'numeric' }) : '' },
      { label: 'Coverage', value: nodePct, unit: '%', state: pctState(nodePct),
        basis: nodePct === null ? 'no run has completed' : 'of graph nodes' },
    ]
  } else {
    // QA and admin: the run-quality view.
    items = [
      { label: 'Coverage', value: nodePct, unit: '%', state: pctState(nodePct),
        basis: nodePct !== null
          ? `${coverage?.nodeCovered ?? 0} of ${coverage?.nodeTotal ?? 0} verified`
          : 'no run has completed' },
      // The number that separates "everything passed" from "nothing ran".
      { label: 'Untestable', value: untestable, unit: '%',
        state: inversePctState(untestable),
        basis: untestable !== null
          ? `${untestableN} of ${planned} never ran` : 'no run has completed' },
      { label: 'Plan executed', value: executed, unit: '%',
        state: executed === null ? 'unmeasured' : 'ok',
        basis: planned ? `${ran} of ${planned} cases` : 'no run has completed' },
      { label: 'Runs', value: suites.length,
        basis: live.length ? `${live.length} live` : 'recorded' },
    ]
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
      gap: 'var(--space-4)',
      padding: 'var(--space-3) var(--space-6)',
      borderBottom: '1px solid var(--color-border)', flexShrink: 0,
    }}>
      {items.map((item, i) => (
        <Metric key={item.label} {...item} size="compact"
                surface={false} delay={i * 0.05} />
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function QAWorkspacePage() {
  const [projects, setProjects]           = useState<any[]>([])
  const [selectedProject, setSelectedProject] = useState<any>(null)
  const [suites, setSuites]               = useState<TestRun[]>([])
  const [tab, setTab]                     = useState<Tab>('runs')
  const [openRunId, setOpenRunId]         = useState<string | null>(null)
  const [launchProject, setLaunchProject] = useState<any>(null)
  const [doomed, setDoomed] = useState<any>(null)
  const [active, setActive]               = useState<any[]>([])
  const [coverage, setCoverage]           = useState<QaCoverage | null>(null)
  const [coverageRun, setCoverageRun]     = useState('')
  // Probed once here rather than inside the launcher, so the card can be pressed and
  // the modal can explain immediately instead of flashing a disabled button.
  const [caps, setCaps] = useState<QaCapabilities | null>(null)

  useEffect(() => {
    qaApi.capabilities()
      .then(r => setCaps(r.data))
      .catch(() => setCaps(null))
  }, [])

  const [projectsLoading, setProjectsLoading] = useState(true)
  const [suitesLoading, setSuitesLoading]     = useState(false)

  // One owner of the runner poll for the whole page. Three components polling
  // independently would be three requests a tick against shared state.
  const runnersState = useQaRunners({
    active: active.length > 0,
    watching: tab === 'runner',
  })

  // ── Load projects ───────────────────────────────────────────────────────────
  const loadProjects = useCallback(async () => {
    setProjectsLoading(true)
    try {
      const r = await qaApi.listProjects()
      const data = (r.data as any[]) ?? []
      // Real projects only. A sample project used to be pinned first and auto-selected
      // "for leadership presentation", so the default landing state showed a customer
      // a project they do not have, with a pass rate they did not earn — and two clicks
      // in, hand-drawn mock-ups of Aura's own login page. An empty state is better.
      setProjects(data)
      setSelectedProject((prev: any) => prev ?? data[0] ?? null)
    } catch {
      setProjects([])
    }
    finally { setProjectsLoading(false) }
  }, [])

  // ── Load suites for selected project ────────────────────────────────────────
  const loadSuites = useCallback(async (projectId: string) => {
    setSuitesLoading(true)
    try {
      const r = await qaApi.getSuites(projectId)
      setSuites(r.data)
    } catch { /**/ }
    finally { setSuitesLoading(false) }
  }, [])

  useEffect(() => { loadProjects() }, [loadProjects])
  useEffect(() => {
    if (selectedProject) loadSuites(selectedProject.projectId as string)
  }, [selectedProject, loadSuites])

  // ── In-flight runs, and this project's coverage ─────────────────────────────
  useEffect(() => {
    const projectId = selectedProject?.projectId
    if (!projectId) { setActive([]); return }
    let stop = false
    const poll = async () => {
      try {
        const { data } = await qaApi.activeRuns(projectId)
        if (!stop) setActive(data.active ?? [])
      } catch { /* a dropped poll is not a failed run */ }
    }
    poll()
    // Only while something is running. An idle project does not need a 2.5s poll
    // against an endpoint that scans.
    const t = setInterval(poll, active.length ? 2500 : 15000)
    return () => { stop = true; clearInterval(t) }
  }, [selectedProject, active.length])

  useEffect(() => {
    const projectId = selectedProject?.projectId
    if (!projectId) { setCoverage(null); return }
    let stop = false
    qaApi.projectCoverage(projectId)
      .then(({ data }) => {
        if (stop) return
        setCoverage(data.coverage)
        setCoverageRun(data.runId || '')
      })
      .catch(() => { if (!stop) { setCoverage(null); setCoverageRun('') } })
    return () => { stop = true }
  }, [selectedProject, suites.length])

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSelectProject = (p: any) => {
    setSelectedProject(p)
    setTab('runs')
    setOpenRunId(null)
  }

  const handleViewArtifacts = (runId: string) => {
    setOpenRunId(runId)
    setTab('runs')
  }

  /** Floci containers for a run that is still executing, from its heartbeat. A
   *  finished run has none — its emulators are in the stored report instead. */
  // The whole run, not just its emulators: RunDetail also shows the machine's console,
  // and threading one field at a time meant a prop change for every new thing it says.
  const liveFor = (runId: string) => active.find(r => r.runId === runId) ?? null

  /** Stop a run that is queued or wedged.
   *
   *  It cannot reach the runner — that polls and has no inbound port. What it does is
   *  take the run out of the live set, which is what stops the Results tab showing a
   *  run that will never finish, and what unblocks deleting the project.
   */
  const cancelRun = async (runId: string) => {
    if (!selectedProject) return
    try {
      await qaApi.cancelRun(selectedProject.projectId as string, runId)
    } catch { /* a 409 means it finished first — the refresh below shows the truth */ }
    try {
      const { data } = await qaApi.activeRuns(selectedProject.projectId as string)
      setActive(data.active ?? [])
    } catch { /* the poller will catch up */ }
    handleRefreshSuites()
  }

  const rerun = async (kinds: CaseKind[]) => {
    if (!selectedProject) return
    try {
      await qaApi.enqueueRun(selectedProject.projectId as string, '', kinds)
      setOpenRunId(null)
      handleRefreshSuites()
    } catch { /* the launcher surfaces failures; this is a shortcut */ }
  }

  const handleRefreshSuites = () => {
    if (selectedProject) loadSuites(selectedProject.projectId as string)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--color-bg)', overflow: 'hidden' }}>

      {/* ── Left sidebar: ProjectStatusBoard ── */}
      <div style={{ width: 340, flexShrink: 0, borderRight: '1px solid var(--color-border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Sidebar header */}
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FlaskConical size={16} color="var(--color-primary)" />
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 14,
              color: 'var(--color-text)' }}>
              Projects
            </span>
          </div>
          <button
            className="ov-btn ov-btn-ghost"
            onClick={loadProjects}
            disabled={projectsLoading}
            style={{ fontSize: 11, padding: '4px 8px', gap: 4 }}>
            <RefreshCw size={11}
              style={{ animation: projectsLoading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>

        {projectsLoading ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 12 }}>
            Loading projects...
          </div>
        ) : (
          <ProjectStatusBoard
            projects={projects}
            selectedProjectId={selectedProject?.projectId ?? null}
            onSelect={handleSelectProject}
            onStartRun={p => setLaunchProject(p)}
            onDelete={p => setDoomed(p)}
          />
        )}
      </div>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {selectedProject ? (
          <>
            {/* Page header */}
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--color-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <div className="section-label">QA Engineer</div>
                </div>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 800,
                  display: 'flex', alignItems: 'center', gap: 9, margin: 0 }}>
                  <FlaskConical size={20} color="var(--color-primary)" />
                  {selectedProject.name as string}
                </h2>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <RunnerStatusChip runners={runnersState.runners}
                                  you={runnersState.you}
                                  onClick={() => setTab('runner')} />
                <button
                  className="ov-btn ov-btn-ghost"
                  onClick={handleRefreshSuites}
                  style={{ gap: 5, fontSize: 12 }}>
                  <RefreshCw size={12}
                    style={{ animation: suitesLoading ? 'spin 1s linear infinite' : 'none' }} />
                  Refresh
                </button>
              </div>
            </div>

            {/* Stats bar */}
            <StatsBar suites={suites} coverage={coverage} />

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--color-border)',
              padding: '0 20px', flexShrink: 0 }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer',
                    padding: '10px 14px', fontSize: 13,
                    fontWeight: tab === t.id ? 700 : 500,
                    color: tab === t.id ? 'var(--color-primary)' : 'var(--color-subtext)',
                    borderBottom: `2px solid ${tab === t.id ? 'var(--color-primary)' : 'transparent'}`,
                    display: 'flex', alignItems: 'center', gap: 6,
                    marginBottom: -1, transition: 'all 0.15s' }}>
                  {t.icon}{t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px' }}>
              {tab === 'runs' && (
                openRunId ? (
                  <RunDetail
                    projectId={selectedProject.projectId as string}
                    runId={openRunId}
                    status={suites.find(r => r.testRunId === openRunId)?.status}
                    onBack={() => setOpenRunId(null)}
                    onRerun={rerun}
                    live={liveFor(openRunId)}
                    you={runnersState.you}
                  />
                ) : (
                  <>
                    {/* Queued and executing runs. S3 cannot see these at all —
                        report.json is written last and its presence is the done
                        signal — so they come from the queue. */}
                    {active.length > 0 && (
                      <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
                        {active.map(run => (
                          <RunProgress key={run.runId} run={run}
                                       runners={runnersState.runners}
                                       you={runnersState.you}
                                       onCancel={cancelRun} />
                        ))}
                      </div>
                    )}
                    <TestRunsTab
                      suites={suites}
                      projectId={selectedProject.projectId as string}
                      onViewArtifacts={handleViewArtifacts}
                      onRefresh={handleRefreshSuites}
                    />
                  </>
                )
              )}

              {tab === 'coverage' && (
                coverage ? (
                  <div style={{ display: 'grid', gap: 14 }}>
                    <CoverageSummary coverage={coverage} />
                    {!!coverageRun && (
                      <button onClick={() => { setOpenRunId(coverageRun); setTab('runs') }}
                        style={{ justifySelf: 'start', fontSize: 11, background: 'none',
                          border: 'none', cursor: 'pointer', padding: 0,
                          color: 'var(--color-primary)' }}>
                        From run {coverageRun} — open it
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '40px 20px', textAlign: 'center',
                    color: 'var(--color-muted)', fontSize: 13, lineHeight: 1.7 }}>
                    No coverage yet. Run the tests once and this will show which API and
                    Service nodes are verified — and which are not, with the reason.
                  </div>
                )
              )}

              {tab === 'runner' && (
                <RunnerPanel
                  runners={runnersState.runners}
                  caps={caps}
                  loading={runnersState.loading}
                  error={runnersState.error}
                  lastUpdated={runnersState.lastUpdated}
                  unauthorized={runnersState.unauthorized}
                  onRefresh={runnersState.refresh}
                />
              )}

              {tab === 'activity' && (
                <ActivityFeed
                  projectId={selectedProject.projectId as string}
                  runs={suites}
                />
              )}

            </div>
          </>
        ) : (
          /* No project selected placeholder */
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 14, color: 'var(--color-muted)' }}>
            <FlaskConical size={48} style={{ opacity: 0.2 }} />
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16,
              color: 'var(--color-subtext)' }}>
              QualityMind
            </div>
            <div style={{ fontSize: 13, textAlign: 'center', maxWidth: 280 }}>
              {projectsLoading
                ? 'Loading projects...'
                : projects.length === 0
                  ? 'No QA projects found. Analyse a project in Dev Workspace first.'
                  : 'Select a project from the sidebar to get started.'}
            </div>
          </div>
        )}
      </div>

      {doomed && (
        <ConfirmDeleteDialog
          projectId={doomed.projectId}
          projectName={doomed.name}
          onCancel={() => setDoomed(null)}
          onDeleted={id => {
            setDoomed(null)
            // `loadProjects` auto-selects with `prev ?? data[0]`, so a plain refetch
            // does NOT clear a stale selection — and two pollers key off
            // `selectedProject?.projectId` and would keep asking about a deleted one.
            if (selectedProject?.projectId === id) {
              setSelectedProject(null)
              setSuites([])
              setOpenRunId(null)
              setActive([])
              setCoverage(null)
            }
            loadProjects()
          }}
        />
      )}

      {/* ── Run launcher ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {launchProject && (
          <RunLauncher
            project={launchProject}
            canRun={caps?.canRun ?? false}
            reason={caps?.reason ?? ''}
            runners={runnersState.runners}
            you={runnersState.you}
            onClose={() => setLaunchProject(null)}
            onFinished={() => {
              if (selectedProject) loadSuites(selectedProject.projectId as string)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
