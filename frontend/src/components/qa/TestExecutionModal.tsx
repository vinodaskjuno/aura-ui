import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Settings2, MonitorPlay, Webhook, Network, GitCompare,
  ShieldX, Gauge, Globe, Target, CirclePlay, FilePlus2,
  Package, FlaskConical, Upload, Server, CheckCircle2,
  AlertCircle, Loader,
} from 'lucide-react'
import { qaApi } from '../../api/qa'

// ── Types ─────────────────────────────────────────────────────────────────────
type ModalStep = 'config' | 'executing'

type ExecPhase =
  | 'idle'
  | 'generating'
  | 'scaling_up'
  | 'setup'
  | 'running'
  | 'upload'
  | 'scaling_down'
  | 'complete'
  | 'error'

export interface TestExecutionModalProps {
  project: any
  onClose: () => void
  onComplete: (runId: string) => void
  wsUrl: string
  token: string
}

// ── Test type config ──────────────────────────────────────────────────────────
const TEST_TYPES: {
  key: string
  label: string
  subtitle: string
  description: string
  icon: React.ComponentType<{ size?: number; color?: string }>
  color: string
}[] = [
  { key: 'playwright_ui', label: 'Browser E2E Tests', subtitle: 'Playwright TypeScript', description: 'Full browser automation with screenshot capture at every step', icon: MonitorPlay, color: '#3b82f6' },
  { key: 'api',           label: 'REST API Tests',    subtitle: 'pytest requests',        description: 'Endpoint validation, status codes, and response schemas',   icon: Webhook,     color: '#10b981' },
  { key: 'integration',   label: 'Integration Tests', subtitle: 'Cross-service flows',    description: 'Multi-service workflows and data propagation checks',      icon: Network,     color: '#8b5cf6' },
  { key: 'regression',    label: 'Regression Tests',  subtitle: 'Change-based diff',      description: 'Diff-based detection of regressions from code changes',    icon: GitCompare,  color: '#f59e0b' },
  { key: 'negative',      label: 'Negative Tests',    subtitle: 'Invalid inputs',         description: 'Malformed requests, auth failures, and edge-case inputs',  icon: ShieldX,     color: '#ef4444' },
  { key: 'boundary',      label: 'Boundary Tests',    subtitle: 'Min/max/null values',    description: 'Overflow, empty, null, and boundary-condition coverage',   icon: Gauge,       color: '#06b6d4' },
]

// ── Timeline phases ───────────────────────────────────────────────────────────
const TIMELINE: {
  phase: ExecPhase
  label: string
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  containerOnly?: boolean
}[] = [
  { phase: 'generating',  label: 'Generating Scripts',        icon: FilePlus2 },
  { phase: 'scaling_up',  label: 'Scaling Container',         icon: Server,       containerOnly: true },
  { phase: 'setup',       label: 'Installing Dependencies',   icon: Package,      containerOnly: true },
  { phase: 'running',     label: 'Running Tests',             icon: FlaskConical },
  { phase: 'upload',      label: 'Collecting Results',        icon: Upload,       containerOnly: true },
  { phase: 'scaling_down',label: 'Scaling Down',              icon: Server,       containerOnly: true },
  { phase: 'complete',    label: 'Complete',                  icon: CheckCircle2 },
]

const PHASE_ORDER: ExecPhase[] = [
  'generating', 'scaling_up', 'setup', 'running', 'upload', 'scaling_down', 'complete',
]

type PhaseStatus = 'pending' | 'active' | 'done' | 'skipped' | 'error'

function getPhaseStatus(current: ExecPhase, phase: ExecPhase, hasContainer: boolean): PhaseStatus {
  if (current === 'error') {
    return phase === PHASE_ORDER[0] ? 'error' : 'pending'
  }
  const ci = PHASE_ORDER.indexOf(current)
  const pi = PHASE_ORDER.indexOf(phase)
  const step = TIMELINE.find(t => t.phase === phase)
  if (step?.containerOnly && !hasContainer && current === 'complete') return 'skipped'
  if (ci === -1 || pi === -1) return 'pending'
  if (pi < ci) return 'done'
  if (pi === ci) return 'active'
  return 'pending'
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function TestExecutionModal({
  project, onClose, onComplete, wsUrl, token,
}: TestExecutionModalProps) {
  // Step 1: config
  const [modalStep, setModalStep]     = useState<ModalStep>('config')
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['playwright_ui', 'api'])
  const [appUrl, setAppUrl]           = useState('')
  const [coverage, setCoverage]       = useState(80)
  const [configError, setConfigError] = useState('')

  // Step 2: execution
  const [phase, setPhase]             = useState<ExecPhase>('idle')
  const [logs, setLogs]               = useState<string[]>([])
  const [generateRunId, setGenerateRunId] = useState<string | null>(null)
  const [execError, setExecError]     = useState('')
  const [phaseTimes, setPhaseTimes]   = useState<Partial<Record<ExecPhase, number>>>({})
  const [totalTests, setTotalTests]   = useState(0)
  const [finalRunId, setFinalRunId]   = useState<string | null>(null)

  const [elapsedSecs, setElapsedSecs] = useState(0)

  const logsEndRef     = useRef<HTMLDivElement>(null)
  const genWsRef       = useRef<WebSocket | null>(null)
  const runWsRef       = useRef<WebSocket | null>(null)
  const startTimeRef   = useRef<number>(0)
  const watchdogRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const hasContainer = selectedTypes.includes('playwright_ui')

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  useEffect(() => () => {
    genWsRef.current?.close()
    runWsRef.current?.close()
    if (watchdogRef.current) clearTimeout(watchdogRef.current)
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current)
  }, [])

  // Elapsed counter — runs while executing, stops on completion or error
  useEffect(() => {
    if (modalStep === 'executing' && phase !== 'complete' && phase !== 'error') {
      elapsedTimerRef.current = setInterval(() => {
        setElapsedSecs(Math.round((Date.now() - startTimeRef.current) / 1000))
      }, 1000)
    } else {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current)
    }
    return () => { if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current) }
  }, [modalStep, phase])

  // ── Toggle test type ────────────────────────────────────────────────────────
  const toggleType = (key: string) => {
    setSelectedTypes(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const addLog = useCallback((msg: string) => {
    setLogs(l => [...l, msg])
  }, [])

  const elapsed = useCallback((): number => {
    return Math.round((Date.now() - startTimeRef.current) / 1000)
  }, [])

  const recordPhaseTime = useCallback((p: ExecPhase) => {
    setPhaseTimes(t => ({ ...t, [p]: elapsed() }))
  }, [elapsed])

  // ── Container run WebSocket ─────────────────────────────────────────────────
  const startContainerRun = useCallback((runId: string) => {
    if (!appUrl.trim()) {
      // No app URL → just mark complete
      setPhase('complete')
      recordPhaseTime('complete')
      setFinalRunId(runId)
      onComplete(runId)
      return
    }

    setPhase('scaling_up')
    recordPhaseTime('scaling_up')

    const ws = new WebSocket(`${wsUrl}/api/qa/ws/container-run`)
    runWsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({
        token,
        run_id: runId,
        project_id: project.projectId as string,
        app_url: appUrl.trim(),
      }))
    }

    ws.onmessage = (e: MessageEvent<string>) => {
      const ev = JSON.parse(e.data) as Record<string, unknown>
      if (ev.message) addLog(ev.message as string)

      switch (ev.type as string) {
        case 'scale_up':
          setPhase('scaling_up')
          recordPhaseTime('scaling_up')
          break
        case 'setup':
          setPhase('setup')
          recordPhaseTime('setup')
          break
        case 'running':
          setPhase('running')
          recordPhaseTime('running')
          break
        case 'upload':
          setPhase('upload')
          recordPhaseTime('upload')
          break
        case 'scale_down':
          setPhase('scaling_down')
          recordPhaseTime('scaling_down')
          break
        case 'done':
          setPhase('complete')
          recordPhaseTime('complete')
          setFinalRunId(runId)
          onComplete(runId)
          break
        case 'error':
          setPhase('error')
          setExecError((ev.message as string) ?? 'Container run failed')
          break
      }
    }

    ws.onerror = () => {
      setPhase('error')
      setExecError('Container WebSocket connection failed')
    }
    ws.onclose = () => {
      // If still running, mark error
      setPhase(p => (p === 'complete' || p === 'error') ? p : 'error')
    }
  }, [wsUrl, token, project, appUrl, addLog, recordPhaseTime, onComplete])

  // ── Generate WebSocket ──────────────────────────────────────────────────────
  const startGenerate = useCallback(() => {
    setPhase('generating')
    recordPhaseTime('generating')
    startTimeRef.current = Date.now()
    setElapsedSecs(0)

    // 3-minute client-side watchdog — closes WS and shows error if backend never responds
    if (watchdogRef.current) clearTimeout(watchdogRef.current)
    watchdogRef.current = setTimeout(() => {
      genWsRef.current?.close()
      runWsRef.current?.close()
      setPhase('error')
      setExecError(
        'Test generation timed out after 3 minutes. ' +
        'The backend may be busy or Bedrock is unavailable. Please retry.'
      )
    }, 3 * 60 * 1000)

    const ws = new WebSocket(`${wsUrl}/api/qa/ws/generate`)
    genWsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({
        token,
        project_id: project.projectId as string,
        test_types: selectedTypes,
        coverage_target: coverage,
      }))
    }

    ws.onmessage = (e: MessageEvent<string>) => {
      const ev = JSON.parse(e.data) as Record<string, unknown>
      const type = ev.type as string

      if (type === 'status' || type === 'progress') {
        addLog(ev.message as string)
      } else if (type === 'artifact') {
        addLog(`✓ Artifact: ${ev.filename as string}`)
      } else if (type === 'done') {
        if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null }
        const runId = ev.runId as string
        setGenerateRunId(runId)
        setTotalTests((ev.totalTests as number) ?? 0)
        addLog(`✓ Generation complete — ${ev.totalTests ?? 0} tests across ${selectedTypes.length} suites`)

        if (hasContainer && appUrl.trim()) {
          // Continue to container run
          startContainerRun(runId)
        } else {
          // API-only: fire POST /api/qa/run
          setPhase('running')
          recordPhaseTime('running')
          qaApi.run(runId, selectedTypes, project.projectId as string)
            .then(() => {
              setPhase('complete')
              recordPhaseTime('complete')
              setFinalRunId(runId)
              onComplete(runId)
            })
            .catch(err => {
              setPhase('error')
              setExecError((err as Error).message ?? 'Test execution failed')
            })
        }
      } else if (type === 'error') {
        if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null }
        setPhase('error')
        setExecError((ev.message as string) ?? 'Generation failed')
      }
    }

    ws.onerror = () => {
      if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null }
      setPhase('error')
      setExecError('WebSocket connection failed')
    }
    ws.onclose = () => {
      setPhase(p => (p === 'generating') ? 'error' : p)
    }
  }, [wsUrl, token, project, selectedTypes, coverage, hasContainer, appUrl,
      addLog, recordPhaseTime, startContainerRun, onComplete])

  // ── Handle "Generate & Execute" click ───────────────────────────────────────
  const handleExecute = () => {
    if (!selectedTypes.length) {
      setConfigError('Select at least one test type.')
      return
    }
    if (hasContainer && !appUrl.trim()) {
      setConfigError('App URL is required for Browser E2E Tests.')
      return
    }
    setConfigError('')
    setModalStep('executing')
    startGenerate()
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const isRunning = modalStep === 'executing' && phase !== 'complete' && phase !== 'error'

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={() => { if (!isRunning) onClose() }}>
      <motion.div
        initial={{ scale: 0.94, y: 20 }} animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 18, width: '100%',
          maxWidth: modalStep === 'executing' ? 920 : 620,
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          overflow: 'hidden', transition: 'max-width 0.3s' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--color-primary)18',
              border: '1px solid var(--color-primary)30',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Settings2 size={17} color="var(--color-primary)" />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16,
                color: 'var(--color-text)' }}>
                {modalStep === 'config' ? 'Configure Test Suite' : 'Executing Tests'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{project.name as string}</div>
            </div>
          </div>

          {!isRunning && (
            <button onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-muted)', display: 'flex', padding: 4, borderRadius: 6 }}>
              <X size={16} />
            </button>
          )}
        </div>

        {/* ── Step 1: Configuration ── */}
        <AnimatePresence mode="wait">
          {modalStep === 'config' && (
            <motion.div key="config"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ flex: 1, overflowY: 'auto', padding: '22px 22px' }}>

              {/* Test type selector */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-subtext)',
                  fontFamily: 'var(--font-heading)', textTransform: 'uppercase',
                  letterSpacing: '0.08em', marginBottom: 12 }}>
                  Test Types
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {TEST_TYPES.map(({ key, label, subtitle, description, icon: Icon, color }) => {
                    const active = selectedTypes.includes(key)
                    return (
                      <motion.button key={key} onClick={() => toggleType(key)}
                        whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.97 }}
                        style={{ background: active ? `${color}14` : 'var(--color-card)',
                          border: `1.5px solid ${active ? color : 'var(--color-border)'}`,
                          borderRadius: 10, padding: '10px 13px', cursor: 'pointer', textAlign: 'left',
                          display: 'flex', alignItems: 'flex-start', gap: 10, transition: 'all 0.15s' }}>

                        {/* Checkbox */}
                        <div style={{ width: 17, height: 17, borderRadius: 5, flexShrink: 0, marginTop: 1,
                          background: active ? color : 'transparent',
                          border: `2px solid ${active ? color : 'var(--color-border)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                          {active && <div style={{ width: 7, height: 7, borderRadius: 2, background: '#fff' }} />}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                            <Icon size={13} color={active ? color : 'var(--color-muted)'} />
                            <span style={{ fontSize: 12, fontWeight: 700,
                              color: active ? 'var(--color-text)' : 'var(--color-subtext)' }}>
                              {label}
                            </span>
                          </div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: active ? color : 'var(--color-muted)',
                            marginBottom: 3 }}>{subtitle}</div>
                          <div style={{ fontSize: 11, color: 'var(--color-muted)', lineHeight: 1.4 }}>
                            {description}
                          </div>
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
              </div>

              {/* App URL (shown when playwright_ui selected) */}
              <AnimatePresence>
                {hasContainer && (
                  <motion.div key="appurl"
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden', marginBottom: 22 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-subtext)',
                      fontFamily: 'var(--font-heading)', textTransform: 'uppercase',
                      letterSpacing: '0.08em', marginBottom: 8 }}>
                      Application URL
                    </div>
                    <div style={{ position: 'relative' }}>
                      <Globe size={13} style={{ position: 'absolute', left: 11, top: '50%',
                        transform: 'translateY(-50%)', color: 'var(--color-muted)', pointerEvents: 'none' }} />
                      <input
                        className="ov-input"
                        value={appUrl}
                        onChange={e => setAppUrl(e.target.value)}
                        placeholder="https://staging.myapp.com"
                        style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 34 }}
                      />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 5 }}>
                      Playwright will open this URL and screenshot every test step.
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Coverage target */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Target size={12} color="var(--color-muted)" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-subtext)',
                      fontFamily: 'var(--font-heading)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Coverage Target
                    </span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-primary)',
                    fontFamily: 'var(--font-heading)' }}>
                    {coverage}%
                  </span>
                </div>
                <div style={{ position: 'relative', height: 6, background: 'var(--color-card)',
                  borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ position: 'absolute', height: '100%', width: `${coverage}%`,
                    background: 'var(--color-primary)', borderRadius: 3, transition: 'width 0.15s' }} />
                </div>
                <input type="range" min={50} max={100} step={5} value={coverage}
                  onChange={e => setCoverage(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--color-primary)' }} />
              </div>

              {/* Error */}
              {configError && (
                <div style={{ padding: '8px 12px', background: '#ef444415', border: '1px solid #ef4444',
                  borderRadius: 8, fontSize: 12, color: '#ef4444', marginBottom: 16 }}>
                  {configError}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="ov-btn ov-btn-ghost" onClick={onClose}>Cancel</button>
                <motion.button className="ov-btn ov-btn-primary"
                  onClick={handleExecute}
                  disabled={!selectedTypes.length}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  style={{ gap: 6 }}>
                  <CirclePlay size={14} /> Generate &amp; Execute Tests
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Live Execution ── */}
          {modalStep === 'executing' && (
            <motion.div key="executing"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ flex: 1, display: 'grid', gridTemplateColumns: '240px 1fr',
                minHeight: 0, overflow: 'hidden' }}>

              {/* Left: Phase timeline */}
              <div style={{ borderRight: '1px solid var(--color-border)',
                padding: '18px 14px', display: 'flex', flexDirection: 'column',
                gap: 2, overflowY: 'auto', background: 'var(--color-card)' }}>

                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                  Execution Timeline
                </div>

                {TIMELINE.map(({ phase: p, label, icon: Icon, containerOnly }) => {
                  const show = !containerOnly || hasContainer
                  const st = show
                    ? getPhaseStatus(phase, p, hasContainer)
                    : 'skipped'

                  const color = st === 'done'    ? '#10b981'
                              : st === 'active'  ? 'var(--color-primary)'
                              : st === 'error'   ? '#ef4444'
                              : st === 'skipped' ? '#4b5563'
                              : 'var(--color-muted)'

                  const ptSecs = phaseTimes[p]
                  const timeLabel = ptSecs !== undefined ? `${ptSecs}s` : ''

                  return (
                    <div key={p}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 8px',
                        borderRadius: 8, opacity: st === 'skipped' ? 0.4 : 1,
                        background: st === 'active' ? 'var(--color-primary)12' : 'transparent' }}>

                      {/* Circle indicator */}
                      <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                        background: `${color}18`, border: `1.5px solid ${color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color, marginTop: 1 }}>
                        {st === 'done'   ? <CheckCircle2 size={12} /> :
                         st === 'error'  ? <AlertCircle size={12} /> :
                         st === 'active' ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> :
                         <Icon size={12} />}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: st === 'active' ? 700 : 500,
                          color: st === 'active' ? 'var(--color-text)'
                               : st === 'done'   ? '#10b981'
                               : 'var(--color-muted)',
                          lineHeight: 1.3 }}>
                          {label}
                        </div>
                        {timeLabel && (
                          <div style={{ fontSize: 10, color: 'var(--color-muted)',
                            fontFamily: 'var(--font-mono)', marginTop: 1 }}>
                            +{timeLabel}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Summary after complete */}
                {phase === 'complete' && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    style={{ marginTop: 14, padding: '12px 12px', borderRadius: 10,
                      background: '#10b98115', border: '1px solid #10b98133' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', marginBottom: 4 }}>
                      Tests Complete
                    </div>
                    {totalTests > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                        {totalTests} tests generated
                      </div>
                    )}
                    {finalRunId && (
                      <div style={{ fontSize: 10, color: 'var(--color-muted)', fontFamily: 'var(--font-mono)',
                        marginTop: 4, wordBreak: 'break-all' }}>
                        {finalRunId.slice(0, 12)}...
                      </div>
                    )}
                    <button className="ov-btn ov-btn-ghost" onClick={onClose}
                      style={{ marginTop: 10, width: '100%', justifyContent: 'center', fontSize: 11 }}>
                      Close
                    </button>
                  </motion.div>
                )}

                {phase === 'error' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    style={{ marginTop: 14, padding: '10px 12px', borderRadius: 8,
                      background: '#ef444415', border: '1px solid #ef4444' }}>
                    <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 8 }}>{execError}</div>
                    <button className="ov-btn ov-btn-ghost" onClick={onClose}
                      style={{ fontSize: 11 }}>Close</button>
                  </motion.div>
                )}
              </div>

              {/* Right: Live log stream */}
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid var(--color-border)',
                  display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <FlaskConical size={13} color="var(--color-primary)" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>
                    Live Output
                  </span>
                  {isRunning && (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                      background: '#3b82f615', color: '#3b82f6', border: '1px solid #3b82f630',
                      display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#3b82f6',
                        animation: 'statusPulse 1.2s ease-in-out infinite', display: 'inline-block' }} />
                      Running · {elapsedSecs}s
                    </span>
                  )}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px',
                  background: 'rgba(0,0,0,0.25)', fontFamily: 'var(--font-mono)' }}>
                  {logs.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--color-muted)', opacity: 0.6 }}>
                      Connecting...
                    </div>
                  )}
                  {logs.map((line, i) => {
                    const isSuccess = line.startsWith('✓') || line.toLowerCase().includes('complete')
                    const isError   = line.toLowerCase().includes('error') || line.toLowerCase().includes('fail')
                    const color = isSuccess ? '#10b981' : isError ? '#ef4444' : 'var(--color-subtext)'
                    return (
                      <div key={i} style={{ fontSize: 12, color, marginBottom: 3, lineHeight: 1.5 }}>
                        {line}
                      </div>
                    )
                  })}
                  {isRunning && (
                    <div style={{ color: 'var(--color-primary)', fontSize: 12 }}>▌</div>
                  )}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
