import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ClipboardList, Palette, Code2, FlaskConical, Rocket, Wrench } from 'lucide-react'
import type { StationState } from './StationNode'
import type { SubStop, TestTabType } from './SubTrack'
import './TransitTracker.css'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Phase {
  name: string; order: number
  is_current: boolean; is_past: boolean; is_future: boolean; status: string
  progress_percent?: number; tasks_completed?: number; tasks_total?: number
}
interface PipelineStep {
  index: number; class_name: string; file_path: string
  status: string; tests_total: number; tests_passed: number; tests_failed: number; is_current: boolean
}
interface Pipeline {
  session_id: string; test_type: string; total_steps: number
  completed_steps: number; current_step: number; progress_percent: number; steps: PipelineStep[]
}
interface TrackerData {
  project_id: string; project_name: string
  current_phase: string; next_phase: string | null
  phases: Phase[]; overall_progress: number
}
interface TransitTrackerProps {
  projectId: string
  activeSession?: { sessionId: string; testType: TestTabType } | null
  onTestTabChange?: (tab: TestTabType) => void
  refreshTrigger?: number
}

// ── Config ────────────────────────────────────────────────────────────────────
const PHASE_ICONS: Record<string, React.ReactNode> = {
  Requirements: <ClipboardList size={14} />, Design:      <Palette size={14} />,
  Development:  <Code2 size={14} />,         Testing:     <FlaskConical size={14} />,
  Deployment:   <Rocket size={14} />,        Maintenance: <Wrench size={14} />,
}
const PHASE_COLORS: Record<string, string> = {
  Requirements: '#6366f1', Design: '#8b5cf6', Development: '#3b82f6',
  Testing: '#f59e0b', Deployment: '#10b981', Maintenance: '#64748b',
}
const LINE_COLORS: Record<TestTabType, string> = {
  unit: '#f59e0b', regression: '#3b82f6', integration: '#10b981',
}
const LINE_LABELS: Record<TestTabType, string> = {
  unit: 'Unit', regression: 'Regression', integration: 'Playwright',
}

// Circle size constants
const CIRCLE_SIZE = 38
const HALO        = CIRCLE_SIZE + 16

function phaseToState(p: Phase): StationState {
  if (p.is_past || p.status === 'completed') return 'completed'
  if (p.is_current || p.status === 'in-progress') return 'live'
  if (p.status === 'blocked') return 'blocked'
  if (p.status === 'failed') return 'failed'
  return 'pending'
}

// ── Metro Station Circle ──────────────────────────────────────────────────────
const MetroCircle: React.FC<{
  phase: Phase; isTransfer?: boolean
  branchOpen?: boolean; onClick?: () => void
}> = ({ phase, isTransfer, branchOpen, onClick }) => {
  const state = phaseToState(phase)
  const color = PHASE_COLORS[phase.name] ?? '#64748b'

  const bg = state === 'completed' ? color
           : state === 'live'      ? 'var(--color-surface)'
           : state === 'failed'    ? '#ef4444'
           : 'var(--color-surface)'

  const border    = state === 'pending' ? 'var(--color-border)' : state === 'failed' ? '#ef4444' : color
  const iconColor = state === 'completed' ? '#fff' : state === 'pending' ? 'var(--color-muted)' : color
  const shadow    = state === 'live'      ? `0 0 14px ${color}cc, 0 0 28px ${color}44`
                  : state === 'completed' ? `0 0 8px ${color}66`
                  : 'none'

  return (
    <div
      onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
               cursor: onClick ? 'pointer' : 'default', userSelect: 'none' }}
    >
      <div style={{ position: 'relative', width: HALO, height: HALO,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Surface mask cuts the track line at circle boundary */}
        <div style={{ position: 'absolute', width: CIRCLE_SIZE + 8, height: CIRCLE_SIZE + 8,
                      borderRadius: '50%', background: 'var(--color-surface)', zIndex: 0 }} />
        {state === 'live' && (<>
          <div style={{ position: 'absolute', width: HALO, height: HALO, borderRadius: '50%',
                        border: `2px solid ${color}`, animation: 'pulse-ring 1.4s ease-out infinite',
                        opacity: 0.7, zIndex: 1 }} />
          <div style={{ position: 'absolute', width: HALO, height: HALO, borderRadius: '50%',
                        border: `2px solid ${color}`, animation: 'pulse-ring 1.4s ease-out 0.7s infinite',
                        opacity: 0.4, zIndex: 1 }} />
        </>)}
        {isTransfer && (
          <div style={{ position: 'absolute', width: CIRCLE_SIZE + 8, height: CIRCLE_SIZE + 8,
                        borderRadius: '50%', border: `3px solid ${branchOpen ? color : 'var(--color-border)'}`,
                        transition: 'border-color 0.3s', zIndex: 1 }} />
        )}
        <div style={{
          position: 'relative', zIndex: 2,
          width: CIRCLE_SIZE, height: CIRCLE_SIZE, borderRadius: '50%',
          background: bg, border: `3px solid ${border}`, boxShadow: shadow,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: iconColor, opacity: state === 'pending' ? 0.5 : 1, transition: 'all 0.3s',
        }}>
          {PHASE_ICONS[phase.name]}
        </div>
      </div>

      <div style={{ textAlign: 'center', minWidth: 60 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                      color: state === 'pending' ? 'var(--color-muted)' : 'var(--color-text)' }}>
          {phase.name.toUpperCase()}
        </div>
        {state === 'completed' && <div style={{ fontSize: 9, color, fontWeight: 700, marginTop: 1 }}>✓ Done</div>}
        {state === 'live' && (
          <div style={{ fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: 3, color, fontWeight: 700, marginTop: 1 }}>
            <span className="blink-dot" style={{ width: 5, height: 5, background: color }} />
            LIVE {phase.progress_percent ? `${Math.round(phase.progress_percent)}%` : ''}
          </div>
        )}
        {state === 'pending' && <div style={{ fontSize: 9, color: 'var(--color-muted)', marginTop: 1 }}>○ Pending</div>}
        {state === 'failed'  && <div style={{ fontSize: 9, color: '#ef4444', marginTop: 1 }}>✗ Failed</div>}
      </div>
    </div>
  )
}

// ── Metro Stop (sub-line) ─────────────────────────────────────────────────────
const MetroStop: React.FC<{ stop: SubStop; color: string }> = ({ stop, color }) => {
  const [hovered, setHovered] = useState(false)
  const isLive = stop.is_current || stop.status === 'running'
  const isDone = stop.status === 'completed'
  const isFail = stop.status === 'failed'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, position: 'relative' }}
         onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div style={{ position: 'relative', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isLive && (
          <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: `2px solid ${color}`,
                        animation: 'pulse-ring 1.2s ease-out infinite', opacity: 0.7 }} />
        )}
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          background: isDone ? color : isLive ? 'var(--color-surface)' : isFail ? '#ef4444' : 'var(--color-surface)',
          border: `2.5px solid ${isFail ? '#ef4444' : color}`,
          boxShadow: !stop.status.includes('pend') ? `0 0 8px ${color}88` : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 900,
          color: isDone ? '#fff' : isLive ? color : 'var(--color-muted)',
          opacity: stop.status === 'pending' ? 0.4 : 1, transition: 'all 0.3s',
        }}>
          {isDone && '✓'}{isFail && '✗'}
        </div>
      </div>
      <div style={{ fontSize: 9, fontWeight: isLive ? 700 : 500, maxWidth: 64, textAlign: 'center',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    color: isLive ? color : isDone ? 'var(--color-text)' : isFail ? '#ef4444' : 'var(--color-muted)' }}>
        {stop.class_name}
      </div>
      {(isDone || isFail) && (
        <div style={{ fontSize: 8, color: isDone ? '#10b981' : '#ef4444' }}>
          {stop.tests_passed}/{stop.tests_total}
        </div>
      )}
      {isLive && (
        <div style={{ fontSize: 8, display: 'flex', alignItems: 'center', gap: 2, color }}>
          <span className="blink-dot" style={{ width: 4, height: 4, background: color }} />LIVE
        </div>
      )}
      {hovered && (
        <div style={{
          position: 'absolute', bottom: '105%', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--color-card)', border: '1px solid var(--color-border)',
          borderRadius: 6, padding: '5px 9px', fontSize: 10, color: 'var(--color-text)',
          whiteSpace: 'nowrap', zIndex: 20, pointerEvents: 'none', boxShadow: 'var(--shadow-md)',
        }}>
          <div style={{ fontWeight: 700 }}>{stop.class_name}</div>
          <div style={{ color: 'var(--color-muted)', marginTop: 2, fontSize: 9 }}>{stop.file_path}</div>
          <div style={{ marginTop: 2 }}>
            <span style={{ color: '#10b981' }}>{stop.tests_passed} pass</span>
            {stop.tests_failed > 0 && <span style={{ color: '#ef4444', marginLeft: 6 }}>{stop.tests_failed} fail</span>}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Metro Branch Lines ────────────────────────────────────────────────────────
const PLACEHOLDER_STOPS: SubStop[] = Array.from({ length: 4 }, (_, i) => ({
  index: i, class_name: '···', file_path: '',
  status: 'pending', tests_total: 0, tests_passed: 0, tests_failed: 0, is_current: false,
}))

const MetroBranch: React.FC<{
  stops: SubStop[]
  pipeline: Pipeline | null
  testingPct: number
}> = ({ stops, pipeline, testingPct }) => {
  const activeType = (pipeline?.test_type ?? 'unit') as TestTabType

  const lines: { type: TestTabType; label: string; color: string }[] = [
    { type: 'unit',        label: 'Unit',       color: LINE_COLORS.unit },
    { type: 'regression',  label: 'Regression', color: LINE_COLORS.regression },
    { type: 'integration', label: 'Playwright', color: LINE_COLORS.integration },
  ]

  return (
    <div style={{ position: 'relative', marginTop: 0, paddingTop: 4 }}>
      {/* Vertical connector stem */}
      <div style={{
        position: 'absolute', top: 0, left: `${testingPct}%`,
        width: 3, height: 32, background: PHASE_COLORS.Testing,
        transform: 'translateX(-50%)',
        boxShadow: `0 0 6px ${PHASE_COLORS.Testing}`,
        zIndex: 2,
      }} />
      <div style={{
        position: 'absolute', top: 28, left: `${testingPct}%`,
        transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
        borderTop: `6px solid ${PHASE_COLORS.Testing}`,
        zIndex: 2,
      }} />

      <div style={{ paddingTop: 36, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {lines.map(({ type, label, color }) => {
          const isActive  = activeType === type && stops.length > 0
          const lineStops = isActive ? stops : PLACEHOLDER_STOPS

          return (
            <motion.div key={type}
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: lines.findIndex(l => l.type === type) * 0.08 }}
              style={{ display: 'flex', alignItems: 'center', gap: 0 }}
            >
              {/* Label on left up to Testing x position */}
              <div style={{
                width: `${testingPct}%`, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                paddingRight: 10, gap: 6,
              }}>
                <div style={{ width: 24, height: 3, borderRadius: 2, background: color,
                              opacity: isActive ? 1 : 0.3 }} />
                <span style={{ fontSize: 9, fontWeight: 700,
                                color: isActive ? color : 'var(--color-muted)',
                                textTransform: 'uppercase', letterSpacing: '0.07em',
                                whiteSpace: 'nowrap' }}>
                  {label}
                </span>
              </div>

              {/* Horizontal rail + stops */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', position: 'relative', minHeight: 52 }}>
                <div style={{
                  position: 'absolute', top: '50%', left: 0, right: 0,
                  height: isActive ? 4 : 2, transform: 'translateY(-50%)',
                  background: isActive ? color : 'var(--color-border)',
                  borderRadius: 2,
                  boxShadow: isActive ? `0 0 8px ${color}88` : 'none',
                  opacity: isActive ? 1 : 0.3,
                  transition: 'all 0.4s',
                }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 0,
                              width: '100%', position: 'relative', zIndex: 1 }}>
                  {lineStops.map((stop, idx) => (
                    <React.Fragment key={idx}>
                      <div style={{ flex: 1 }} />
                      {isActive
                        ? <MetroStop stop={stop} color={color} />
                        : <div style={{ width: 14, height: 14, borderRadius: '50%',
                                        background: 'var(--color-surface)',
                                        border: `2px solid var(--color-border)`,
                                        opacity: 0.3 }} />
                      }
                      {idx === lineStops.length - 1 && <div style={{ flex: 1 }} />}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// Phases at or past Testing where sublanes are meaningful
const TESTING_REACHED = new Set(['Testing', 'Deployment', 'Maintenance'])

// ── Main Component ────────────────────────────────────────────────────────────
export const TransitTracker: React.FC<TransitTrackerProps> = ({
  projectId, activeSession, onTestTabChange, refreshTrigger,
}) => {
  const [trackerData, setTrackerData] = useState<TrackerData | null>(null)
  const [pipeline,    setPipeline]    = useState<Pipeline | null>(null)
  const [testingOpen, setTestingOpen] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Only open sublanes automatically when Testing phase is reached
  useEffect(() => {
    if (trackerData?.current_phase === 'Testing') setTestingOpen(true)
    // Close sublanes if we somehow go back to a pre-testing phase
    if (trackerData && !TESTING_REACHED.has(trackerData.current_phase)) setTestingOpen(false)
  }, [trackerData?.current_phase])

  // Smart polling: only poll while phase is live (Testing) or there's an active session.
  // For all other phases, fetch once then stop — no runaway polling.
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    fetchTracker().then((data) => {
      const shouldPoll = data && (TESTING_REACHED.has(data.current_phase) || !!activeSession)
      if (shouldPoll) {
        intervalRef.current = setInterval(fetchTracker, 3000)
      }
    })
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [projectId])

  // Re-evaluate polling when activeSession changes
  useEffect(() => {
    if (activeSession) {
      // Ensure polling is running
      if (!intervalRef.current) {
        intervalRef.current = setInterval(fetchTracker, 3000)
      }
    } else {
      // Stop polling if no longer in Testing phase
      if (trackerData && !TESTING_REACHED.has(trackerData.current_phase)) {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
      }
    }
  }, [activeSession])

  // Refresh tracker when refreshTrigger changes (e.g., after phase transition)
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      fetchTracker()
    }
  }, [refreshTrigger])

  useEffect(() => {
    if (!activeSession) { setPipeline(null); return }
    const pid = setInterval(() => fetchPipeline(activeSession.sessionId), 1500)
    fetchPipeline(activeSession.sessionId)
    return () => clearInterval(pid)
  }, [activeSession])

  async function fetchTracker(): Promise<TrackerData | null> {
    try {
      const r = await fetch(`/api/sdlc/projects/${projectId}/tracker`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('ov_token') ?? ''}` } })
      if (r.ok) { const d = await r.json(); setTrackerData(d); return d }
    } catch {}
    return null
  }
  async function fetchPipeline(sid: string) {
    try { const r = await fetch(`/api/sdlc/test-sessions/${sid}/pipeline`); if (r.ok) setPipeline(await r.json()) } catch {}
  }

  if (!trackerData) {
    return (
      <div className="transit-canvas" style={{ minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>Loading…</span>
      </div>
    )
  }

  const phases           = trackerData.phases
  const n                = phases.length
  const testingIdx       = phases.findIndex(p => p.name === 'Testing')
  const testingPct       = testingIdx >= 0 ? ((testingIdx + 0.5) / n) * 100 : 50
  const stops: SubStop[] = pipeline?.steps.map(s => ({ ...s })) ?? []
  const hasReachedTesting = TESTING_REACHED.has(trackerData.current_phase)

  return (
    <div className="transit-canvas">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 20, position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--color-text)' }}>{trackerData.project_name}</div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'var(--color-muted)', marginBottom: 2 }}>Overall Progress</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--color-primary)' }}>
            {trackerData.overall_progress.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Main track */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* SVG track segments — zIndex 0, behind circles */}
        <svg
          viewBox={`0 0 ${(n - 1) * 100} 6`}
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            top: HALO / 2 - 3,
            left: 0, width: '100%', height: 6,
            zIndex: 0, overflow: 'visible', pointerEvents: 'none',
          }}
        >
          {phases.slice(0, -1).map((phase, idx) => {
            const n2    = phases.length
            const segW  = 100 / (n2 - 1)
            const x1    = `${idx * segW}%`
            const x2    = `${(idx + 1) * segW}%`
            const color = PHASE_COLORS[phase.name] ?? '#64748b'
            return (
              <line key={idx} x1={x1} y1={3} x2={x2} y2={3}
                stroke={phase.is_past ? color : phase.is_current ? color : '#334155'}
                strokeWidth={7} strokeLinecap="round"
                strokeDasharray={phase.is_future ? '14 7' : 'none'}
                opacity={phase.is_future ? 0.35 : 1}
                style={phase.is_current ? { filter: `drop-shadow(0 0 3px ${color})` } : {}}
              />
            )
          })}
        </svg>

        {/* Station circles — zIndex 1, above track */}
        <div style={{ display: 'flex', justifyContent: 'space-around',
                      position: 'relative', zIndex: 1 }}>
          {phases.map(phase => (
            <MetroCircle
              key={phase.name}
              phase={phase}
              isTransfer={phase.name === 'Testing' && hasReachedTesting}
              branchOpen={phase.name === 'Testing' ? testingOpen : undefined}
              onClick={phase.name === 'Testing' && hasReachedTesting ? () => setTestingOpen(o => !o) : undefined}
            />
          ))}
        </div>
      </div>

      {/* Branch sub-lines — only render after Testing phase is reached */}
      <AnimatePresence>
        {hasReachedTesting && testingOpen && (
          <motion.div key="branch"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <MetroBranch stops={stops} pipeline={pipeline} testingPct={testingPct} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overall progress bar */}
      <div style={{ marginTop: 18, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10,
                      color: 'var(--color-muted)', marginBottom: 3 }}>
          <span>Requirements</span><span>Maintenance</span>
        </div>
        <div className="transit-progress-bar" style={{ height: 5 }}>
          <div className="transit-progress-fill" style={{ width: `${trackerData.overall_progress}%` }} />
        </div>
      </div>
    </div>
  )
}
