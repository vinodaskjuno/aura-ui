import { wsOrigin } from '../api/wsUrl'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FlaskConical, RefreshCw, Layers3, Activity, FileCheck,
  ChevronDown, ChevronUp, FileText, Server, ShieldCheck, ShieldX,
  X, Download, Camera, Play,
} from 'lucide-react'
import { qaApi, type TestRun, type TestArtifact } from '../api/qa'
import { useAuthStore } from '../store/authStore'
import SOPTab from '../components/sop/SOPTab'
import LocalRunView from '../components/qa/LocalRunView'
import ResultsBrowser from '../components/qa/ResultsBrowser'
import ProjectStatusBoard from '../components/qa/ProjectStatusBoard'
import TestExecutionModal from '../components/qa/TestExecutionModal'
import ActivityFeed from '../components/qa/ActivityFeed'
import ArtifactViewer from '../components/qa/ArtifactViewer'
import DemoScreenshots from '../components/qa/DemoScreenshots'
import { SAMPLE_PROJECT, SAMPLE_SUITES, DEMO_PROJECT_ID } from '../data/qa-sample'

// ── Tab definition ────────────────────────────────────────────────────────────
type Tab = 'runs' | 'results' | 'artifacts' | 'activity' | 'sop'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'runs',      label: 'Test Runs',    icon: <Layers3 size={13} /> },
  // Stored evidence, read from S3 — visible in every environment including this
  // one, because a run executed on a laptop writes to the same bucket.
  { id: 'results',   label: 'Results',      icon: <Camera size={13} /> },
  { id: 'artifacts', label: 'Artifacts',    icon: <FileCheck size={13} /> },
  { id: 'activity',  label: 'Activity',     icon: <Activity size={13} /> },
  { id: 'sop',       label: 'SOP',          icon: <FileText size={13} /> },
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
  const [running, setRunning]       = useState(false)
  const [showContainer, setShowContainer] = useState(false)

  useEffect(() => {
    qaApi.getArtifacts(run.testRunId).then(r => setArtifacts(r.data)).catch(() => {})
  }, [run.testRunId])

  const handleRun = async () => {
    setRunning(true)
    try { await qaApi.run(run.testRunId, undefined, projectId); onRefresh() } finally { setRunning(false) }
  }

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
          <motion.button className="ov-btn ov-btn-primary" onClick={handleRun}
            disabled={running} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
            style={{ width: '100%', justifyContent: 'center', gap: 6 }}>
            {running ? 'Running...' : 'Re-run Tests'}
          </motion.button>
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
          Click "Execute Tests" on a project to get started.
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
function StatsBar({ suites }: { suites: TestRun[] }) {
  if (!suites.length) return null

  const totalPassed = suites.reduce((s, r) => s + (r.totalPassed ?? 0), 0)
  const totalFailed = suites.reduce((s, r) => s + (r.totalFailed ?? 0), 0)
  const totalTests  = totalPassed + totalFailed
  const passRate    = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : null
  const lastRun     = suites[0]?.createdAt ? new Date(suites[0].createdAt) : null
  const artifactCount = suites.reduce((s, r) => s + (r.artifacts?.length ?? 0), 0)

  const stats = [
    { label: 'Total Runs',    value: String(suites.length), color: 'var(--color-primary)' },
    { label: 'Pass Rate',     value: passRate !== null ? `${passRate}%` : '—',
      color: passRate !== null ? (passRate >= 90 ? '#10b981' : passRate >= 70 ? '#f59e0b' : '#ef4444') : 'var(--color-muted)' },
    { label: 'Last Run',
      value: lastRun ? lastRun.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—',
      color: 'var(--color-text)' },
    { label: 'Artifacts',     value: String(artifactCount), color: '#8b5cf6' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
      padding: '14px 20px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
      {stats.map(s => (
        <div key={s.label} style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: 20, color: s.color }}>
            {s.value}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function QAWorkspacePage() {
  const { token } = useAuthStore()
  const wsUrl = wsOrigin()

  const [projects, setProjects]           = useState<any[]>([])
  const [selectedProject, setSelectedProject] = useState<any>(null)
  const [suites, setSuites]               = useState<TestRun[]>([])
  const [tab, setTab]                     = useState<Tab>('runs')
  const [showExecute, setShowExecute]     = useState(false)
  const [executeProject, setExecuteProject] = useState<any>(null)
  const [activeArtifactRunId, setActiveArtifactRunId] = useState<string | null>(null)
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [suitesLoading, setSuitesLoading]     = useState(false)
  const [demoMode, setDemoMode]               = useState(false)

  // ── Load projects ───────────────────────────────────────────────────────────
  const loadProjects = useCallback(async () => {
    setProjectsLoading(true)
    try {
      const r = await qaApi.listProjects()
      const data = r.data as any[]
      // Always pin the demo project at the top for leadership presentation
      setProjects([SAMPLE_PROJECT, ...data])
      setSelectedProject((prev: any) => prev === null ? SAMPLE_PROJECT : prev)
    } catch {
      setProjects([SAMPLE_PROJECT])
      setSelectedProject((prev: any) => prev === null ? SAMPLE_PROJECT : prev)
    }
    finally { setProjectsLoading(false) }
  }, [])

  // ── Load suites for selected project ────────────────────────────────────────
  const loadSuites = useCallback(async (projectId: string) => {
    if (projectId === DEMO_PROJECT_ID) {
      setSuites(SAMPLE_SUITES)
      return
    }
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

  // ── Sync demoMode whenever selected project changes ──────────────────────────
  useEffect(() => {
    setDemoMode(selectedProject?.projectId === DEMO_PROJECT_ID)
  }, [selectedProject])

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSelectProject = (p: any) => {
    setSelectedProject(p)
    setTab('runs')
    setActiveArtifactRunId(null)
  }

  const handleExecuteTests = (p: any) => {
    setExecuteProject(p)
    setShowExecute(true)
  }

  const handleExecuteComplete = (runId: string) => {
    setShowExecute(false)
    setExecuteProject(null)
    if (selectedProject) loadSuites(selectedProject.projectId as string)
    setActiveArtifactRunId(runId)
    setTab('artifacts')
  }

  const handleViewArtifacts = (runId: string) => {
    setActiveArtifactRunId(runId)
    setTab('artifacts')
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
            onExecuteTests={handleExecuteTests}
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
                  {demoMode && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 4,
                      background: 'rgba(124,58,237,0.15)', color: '#a78bfa',
                      border: '1px solid rgba(124,58,237,0.35)' }}>
                      DEMO
                    </span>
                  )}
                </div>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 800,
                  display: 'flex', alignItems: 'center', gap: 9, margin: 0 }}>
                  <FlaskConical size={20} color="var(--color-primary)" />
                  {selectedProject.name as string}
                </h2>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
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
            <StatsBar suites={suites} />

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
                <TestRunsTab
                  suites={suites}
                  projectId={selectedProject.projectId as string}
                  onViewArtifacts={handleViewArtifacts}
                  onRefresh={handleRefreshSuites}
                />
              )}

              {tab === 'results' && (
                <ResultsBrowser projectId={selectedProject.projectId as string} />
              )}

              {tab === 'artifacts' && (
                <>
                  {/* Demo screenshot gallery */}
                  {demoMode && (
                    <div style={{ marginBottom: 20 }}>
                      <DemoScreenshots runId={activeArtifactRunId} />
                    </div>
                  )}
                  {activeArtifactRunId && !demoMode ? (
                    <ArtifactViewer runId={activeArtifactRunId} />
                  ) : !demoMode && suites.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                        Select a run to view its artifacts, or pick one below:
                      </div>
                      {suites.slice(0, 8).map(run => (
                        <button key={run.testRunId}
                          onClick={() => setActiveArtifactRunId(run.testRunId)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                            background: 'var(--color-card)', border: '1px solid var(--color-border)',
                            borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                          <FileCheck size={14} color="var(--color-primary)" />
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)',
                              fontFamily: 'var(--font-mono)' }}>
                              Run #{run.testRunId.slice(0, 8).toUpperCase()}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                              {new Date(run.createdAt).toLocaleString()} · {run.artifacts?.length ?? 0} artifacts
                            </div>
                          </div>
                          <StatusBadge status={run.status} />
                        </button>
                      ))}
                    </div>
                  ) : !demoMode ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>
                      No artifacts yet. Run tests first.
                    </div>
                  ) : null}
                </>
              )}

              {tab === 'activity' && (
                <ActivityFeed
                  projectId={selectedProject.projectId as string}
                  runs={suites}
                />
              )}

              {tab === 'sop' && (
                <SOPTab
                  projectId={selectedProject.projectId as string}
                  stage="qa"
                  projectName={selectedProject.name as string}
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

      {/* ── Test Execution Modal ── */}
      <AnimatePresence>
        {showExecute && executeProject && (
          <TestExecutionModal
            project={executeProject}
            wsUrl={wsUrl}
            token={token ?? ''}
            onClose={() => { setShowExecute(false); setExecuteProject(null) }}
            onComplete={handleExecuteComplete}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
