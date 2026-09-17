import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Boxes, Camera, CheckCircle2, Clock, Cloud, ExternalLink, Loader2, MinusCircle,
  PlayCircle, Rocket, X, XCircle,
} from 'lucide-react'
import { qaApi, type CaseKind, type QaActiveRun, type QaPlanPreview, type QaRunner,
         type RunReport, type RunStep } from '../../api/qa'
import ProgressBar from './ProgressBar'
import TestPlanPicker, { selectedCount } from './TestPlanPicker'
import { RunEmulators } from './FlociContainerTable'
import FlociTerminal from './FlociTerminal'
import { localState, runMachineLabel, runMachineName,
         runnerLabel } from './useQaRunners'
import { runProgress } from './progress' 
import { LAYERS } from '../ui/layers'

/**
 * Start a run and watch it happen, from the project list.
 *
 * One modal for the whole lifecycle — queue, provision, plan, execute, results —
 * because that IS the user's single question: "did my tests pass?". Making them press
 * a button in one place and then go hunting in a tab for the outcome is how the
 * previous two-control design lost people.
 *
 * A remote run reports by heartbeat, so this polls. The animation is doing real work
 * rather than decoration: a run spends most of its time in `provision` (npm ci, pip
 * install) with no per-case progress to show, and a still screen there is
 * indistinguishable from a hang.
 */

type Phase = {
  key: string
  label: string
  hint: string
  icon: React.ReactNode
  match: string[]
}

/**
 * Ordered, and canonical rather than derived — only the CURRENT phase is known from a
 * heartbeat, so the order is what places it. A phase a run legitimately skips (no
 * cloud dependency means no emulators) is drawn as passed-over, never as work done.
 */
const PHASES: Phase[] = [
  { key: 'queued', label: 'Queued', hint: 'waiting for a runner to claim it',
    icon: <Clock size={13} />, match: [] },
  { key: 'provision', label: 'Prepare code', hint: 'fetching the project and installing dependencies',
    icon: <Boxes size={13} />, match: ['provision'] },
  { key: 'plan', label: 'Build test cases', hint: 'deriving cases from the knowledge graph',
    icon: <Rocket size={13} />, match: ['plan', 'planned'] },
  { key: 'emulator', label: 'Cloud emulators', hint: 'starting floci where the project needs it',
    icon: <Cloud size={13} />, match: ['emulator'] },
  { key: 'app', label: 'Start the app', hint: 'API and UI on free ports',
    icon: <PlayCircle size={13} />, match: ['app'] },
  { key: 'running', label: 'Execute tests', hint: 'driving a real browser',
    icon: <Loader2 size={13} />, match: ['running', 'step'] },
  { key: 'evidence', label: 'Store evidence', hint: 'screenshots and step log',
    icon: <Camera size={13} />, match: ['evidence', 'graph'] },
]

function phaseIndex(run: QaActiveRun | null): number {
  if (!run) return 0
  if (run.status === 'queued') return 0
  const found = PHASES.findIndex(p => p.match.includes(run.phase))
  return found >= 0 ? found : 1
}

const STATUS_LOOK: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  passed: { color: '#10b981', icon: <CheckCircle2 size={13} />, label: 'Passed' },
  failed: { color: '#ef4444', icon: <XCircle size={13} />, label: 'Failed' },
  skipped: { color: 'var(--color-muted)', icon: <MinusCircle size={13} />, label: 'Skipped' },
  unemulated: { color: '#f59e0b', icon: <MinusCircle size={13} />, label: 'Not emulated' },
}

export default function RunLauncher({ project, canRun, reason, runners, you, onClose,
                                     onFinished }: {
  project: { projectId: string; name?: string }
  canRun: boolean
  reason: string
  /** The local machines that could claim this run. Empty means it will simply wait.
   *  The full list rather than a count, so the modal can say WHERE it will execute
   *  before anyone presses Start. */
  runners: QaRunner[]
  you?: string
  onClose: () => void
  onFinished: () => void
}) {
  const [appUrl, setAppUrl] = useState('')
  const [runId, setRunId] = useState('')
  const [active, setActive] = useState<QaActiveRun | null>(null)
  const [report, setReport] = useState<RunReport | null>(null)
  const [steps, setSteps] = useState<RunStep[]>([])
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [zoom, setZoom] = useState<RunStep | null>(null)
  const [kinds, setKinds] = useState<CaseKind[]>([])
  const [plan, setPlan] = useState<QaPlanPreview | null>(null)
  const startedAt = useRef<number>(0)
  const [, tick] = useState(0)

  // A one-second tick so the elapsed clock moves between polls. Without it the panel
  // is frozen for seconds at a time and reads as stalled.
  useEffect(() => {
    if (!runId || report) return
    const t = setInterval(() => tick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [runId, report])

  const start = async () => {
    setStarting(true); setError('')
    try {
      const { data } = await qaApi.enqueueRun(project.projectId, appUrl.trim(), kinds)
      setRunId(data.runId)
      startedAt.current = Date.now()
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { detail?: string } } }
      // 409 is the server refusing a run it knows cannot succeed — there is no working
      // copy to test. Its detail names the paths it looked in, so it is shown whole
      // rather than collapsed into a generic failure.
      setError(err?.response?.data?.detail || 'Could not queue the run.')
      setBlocked(err?.response?.status === 409)
    } finally { setStarting(false) }
  }

  const finish = useCallback(async (id: string) => {
    try {
      const { data } = await qaApi.getResult(project.projectId, id)
      setReport(data.report)
      setSteps(data.steps ?? [])
    } catch {
      setError('The run finished but its report could not be read.')
    }
    onFinished()
  }, [project.projectId, onFinished])

  // Poll while the run is in flight. It leaves /active the moment it finishes, which
  // is the signal to go and fetch the report.
  useEffect(() => {
    if (!runId || report) return
    let stop = false
    const poll = async () => {
      try {
        const { data } = await qaApi.activeRuns(project.projectId)
        if (stop) return
        const mine = data.active.find(r => r.runId === runId)
        if (mine) setActive(mine)
        else await finish(runId)
      } catch { /* a dropped poll is not a failed run */ }
    }
    poll()
    const t = setInterval(poll, 2000)
    return () => { stop = true; clearInterval(t) }
  }, [runId, report, project.projectId, finish])

  const { online } = localState(runners)
  // Any online machine can claim any queued run — the queue has no affinity — so with
  // more than one connected the honest answer is a count, not a name.
  const willRunOn = online.length === 1 ? runnerLabel(online[0], you)
                  : online.length ? `one of ${online.length} connected local machines`
                  : ''
  const at = phaseIndex(active)
  const progress = report
    ? runProgress({ totalPassed: report.totalPassed, totalFailed: report.totalFailed,
                    totalSkipped: report.totalSkipped,
                    totalUnemulated: report.totalUnemulated,
                    totalCases: report.cases?.length })
    : runProgress(active ?? {})
  const elapsed = startedAt.current
    ? Math.floor((Date.now() - startedAt.current) / 1000) : 0
  const shots = steps.filter(s => s.screenshotUrl)

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: LAYERS.MODAL, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 24,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}>
      <motion.div
        initial={{ scale: 0.96, y: 12, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.97, y: 8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        onClick={e => e.stopPropagation()}
        style={{ width: 'min(720px, 100%)', maxHeight: '86vh', overflowY: 'auto',
          background: 'var(--color-card)', border: '1px solid var(--color-border)',
          borderRadius: 14, boxShadow: 'var(--shadow-lg)', padding: 20 }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="section-label" style={{ marginBottom: 3 }}>Test run</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
              {project.name || project.projectId}
            </div>
          </div>
          {runId && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5,
              color: 'var(--color-muted)', paddingTop: 18 }}>{runId}</span>
          )}
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-muted)', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* ── Before starting ────────────────────────────────────────────── */}
        {!runId && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {!canRun && (
              <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 8,
                fontSize: 12.5, lineHeight: 1.6, color: '#f59e0b', whiteSpace: 'pre-line',
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.3)' }}>
                {reason || 'No runner is available.'}
              </div>
            )}
            {canRun && willRunOn && (
              /* Said before Start, not discovered afterwards: the single most common
                 misreading of this screen is that Aura runs the tests in the cloud. */
              <div style={{ fontSize: 11.5, lineHeight: 1.6,
                            color: 'var(--color-muted)' }}>
                This run executes locally on{' '}
                <strong style={{ color: 'var(--color-text)' }}>{willRunOn}</strong>,
                not in the cloud.
              </div>
            )}
            {canRun && online.length === 0 && (
              /* `canRun` can be true because THIS backend has podman and a browser —
                 which is the local-development case. But a queued run is claimed by a
                 self-hosted runner, and with none online it simply waits. Saying so
                 up front beats a run that sits at "queued" until the reaper takes it. */
              <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 8,
                fontSize: 12.5, lineHeight: 1.6, color: '#f59e0b',
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.3)' }}>
                No local runner is connected, so this run will wait in the queue. Start
                one where podman and Chromium are available:{' '}
                <code style={{ fontFamily: 'var(--font-mono)' }}>
                  python -m src.qatest.agent --api … --key gw-…
                </code>
              </div>
            )}
            <TestPlanPicker projectId={project.projectId} value={kinds}
                            onChange={setKinds} onPlan={setPlan} />

            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>
                Application URL (optional)
              </span>
              <input value={appUrl} onChange={e => setAppUrl(e.target.value)}
                placeholder="Leave empty and Aura will start the project's own app"
                style={{ background: 'var(--color-surface)', fontSize: 12.5,
                  border: '1px solid var(--color-border)', borderRadius: 7,
                  padding: '9px 11px', color: 'var(--color-text)',
                  fontFamily: 'var(--font-mono)' }} />
            </label>
            <span style={{ fontSize: 11.5, color: 'var(--color-muted)', lineHeight: 1.6 }}>
              {appUrl.trim()
                ? 'Tests will run against that URL, which must already be serving.'
                : 'Aura ships its own copy of the code to the runner, installs the dependencies, starts the API and UI, then tests them.'}
            </span>
            {error && (
              /* A refused run gets room to explain itself: the message lists every path
                 that was checked and the two ways to fix it, and squeezing that onto one
                 red line is how it went unread. */
              <div style={{ fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-line',
                            color: blocked ? '#f59e0b' : '#ef4444',
                            ...(blocked ? { padding: '10px 12px', borderRadius: 8,
                                            background: 'rgba(245,158,11,0.08)',
                                            border: '1px solid rgba(245,158,11,0.3)' }
                                        : {}) }}>
                {error}
              </div>
            )}
            <button type="button" className="ov-btn ov-btn-primary"
              disabled={!canRun || starting} onClick={start}
              style={{ justifyContent: 'center', gap: 7, padding: '10px',
                opacity: canRun ? 1 : 0.5,
                cursor: canRun ? 'pointer' : 'not-allowed' }}>
              {starting ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
              {plan ? `Run ${selectedCount(plan, kinds)} of ${plan.totalCases} cases`
                    : 'Start a run'}
            </button>
          </div>
        )}

        {/* ── While it runs ──────────────────────────────────────────────── */}
        {runId && !report && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {PHASES.map((phase, i) => {
                const state = i < at ? 'past' : i === at ? 'now' : 'future'
                const color = state === 'now' ? 'var(--color-primary)'
                  : state === 'past' ? '#10b981' : 'var(--color-muted)'
                return (
                  <motion.div key={phase.key}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: state === 'future' ? 0.42 : 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 11px', borderRadius: 8,
                      background: state === 'now' ? 'rgba(79,70,229,0.10)' : 'transparent',
                      border: `1px solid ${state === 'now' ? 'rgba(79,70,229,0.30)' : 'transparent'}` }}>
                    <motion.span
                      animate={state === 'now' ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                      transition={state === 'now'
                        ? { repeat: Infinity, duration: 1.5, ease: 'easeInOut' }
                        : { duration: 0.2 }}
                      style={{ display: 'flex', color, flexShrink: 0 }}>
                      {state === 'past' ? <CheckCircle2 size={13} /> : phase.icon}
                    </motion.span>
                    <span style={{ fontSize: 12.5, fontWeight: state === 'now' ? 700 : 500,
                      color: state === 'future' ? 'var(--color-muted)' : 'var(--color-text)',
                      flexShrink: 0 }}>
                      {phase.label}
                    </span>
                    <span style={{ fontSize: 11.5, color: 'var(--color-muted)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {state === 'now' ? phase.hint : ''}
                    </span>
                    {state === 'now' && (
                      <span style={{ marginLeft: 'auto', fontSize: 11, flexShrink: 0,
                        color: 'var(--color-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {elapsed}s
                      </span>
                    )}
                  </motion.div>
                )
              })}
            </div>

            {/* One bar, determinate or not. A queued run has not been claimed, so
                nothing has counted its cases yet — that is "unknown", not 0%. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11.5,
                fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ color: '#10b981' }}>{active?.totalPassed ?? 0} passed</span>
                <span style={{ color: (active?.totalFailed ?? 0) > 0 ? '#ef4444' : 'var(--color-muted)' }}>
                  {active?.totalFailed ?? 0} failed
                </span>
                <span style={{ color: 'var(--color-muted)' }}>
                  {active?.totalSkipped ?? 0} skipped
                </span>
                {(active?.totalUnemulated ?? 0) > 0 && (
                  <span style={{ color: '#8b5cf6' }}>
                    {active?.totalUnemulated} not emulated
                  </span>
                )}
              </div>
              <ProgressBar progress={progress} failing={(active?.totalFailed ?? 0) > 0} />
            </div>

            {/* Floci, as the runner reports it — the containers serving THIS run. */}
            {!!active?.emulators?.length && (
              <RunEmulators emulators={active.emulators}
                            stale={active.emulatorsStale} />
            )}

            {/* Every event the runner reported, in order — the Floci container
                being started and answering, the app coming up, each case as it
                runs. Without it a remote run is one sentence that keeps changing.
                This is the modal a user watches start to finish, so it is where
                watching the machine work matters most. */}
            <FlociTerminal
              activity={active?.activity ?? []}
              machine={active ? runMachineName(active, you) : ''}
              state={active?.emulatorsStale ? 'stalled' : 'live'}
              maxHeight={200} />

            <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
              {active && runMachineLabel(active, you)
                ? `Running locally on ${runMachineLabel(active, you)}. You can close `
                  + `this — the run continues.`
                : 'Waiting for a local runner to pick it up. You can close this safely.'}
            </span>
          </div>
        )}

        {/* ── Results ────────────────────────────────────────────────────── */}
        {report && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 15px',
                borderRadius: 10, background: 'var(--color-surface)',
                border: `1px solid ${report.status === 'passed' ? 'rgba(16,185,129,0.35)'
                  : report.status === 'failed' ? 'rgba(239,68,68,0.35)'
                  : 'rgba(245,158,11,0.35)'}` }}>
              <span style={{ color: report.status === 'passed' ? '#10b981'
                : report.status === 'failed' ? '#ef4444' : '#f59e0b', display: 'flex' }}>
                {report.status === 'passed' ? <CheckCircle2 size={22} />
                  : report.status === 'failed' ? <XCircle size={22} />
                  : <MinusCircle size={22} />}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)',
                  textTransform: 'capitalize' }}>{report.status}</span>
                <span style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>
                  {report.durationMs ? `${(report.durationMs / 1000).toFixed(1)}s` : ''}
                  {report.appUrl ? ` · ${report.appUrl}` : ''}
                </span>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 16,
                fontVariantNumeric: 'tabular-nums' }}>
                {([['passed', report.totalPassed], ['failed', report.totalFailed],
                   ['skipped', report.totalSkipped]] as const).map(([kind, n]) => (
                  <div key={kind} style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 17, fontWeight: 700,
                      color: STATUS_LOOK[kind].color }}>{n ?? 0}</div>
                    <div style={{ fontSize: 10, color: 'var(--color-muted)' }}>{kind}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {report.reason && (
              <div style={{ fontSize: 12, color: '#f59e0b', lineHeight: 1.6 }}>
                {report.reason}
              </div>
            )}

            {/* Every case, with its screenshot. This is the answer to "what happened",
                and it used to require finding the run in a different tab. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {steps.map((step, i) => {
                const look = STATUS_LOOK[step.status] ?? STATUS_LOOK.skipped
                return (
                  <motion.button key={step.index} type="button"
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    onClick={() => step.screenshotUrl && setZoom(step)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 11px', borderRadius: 8, textAlign: 'left',
                      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                      borderLeft: `3px solid ${look.color}`,
                      cursor: step.screenshotUrl ? 'zoom-in' : 'default' }}>
                    <span style={{ color: look.color, display: 'flex', flexShrink: 0 }}>
                      {look.icon}
                    </span>
                    <span style={{ fontSize: 11.5, color: 'var(--color-muted)',
                      fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                      {String(step.index).padStart(2, '0')}
                    </span>
                    <span style={{ fontSize: 12.5, color: 'var(--color-text)', flex: 1,
                      minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap' }}>
                      {step.action}
                      {step.error && (
                        <span style={{ color: '#ef4444' }}> — {step.error}</span>
                      )}
                    </span>
                    {step.screenshotUrl && (
                      <img src={step.screenshotUrl} alt=""
                        style={{ width: 40, height: 26, objectFit: 'cover', borderRadius: 4,
                          border: '1px solid var(--color-border)', flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: 11, color: 'var(--color-muted)', flexShrink: 0,
                      fontVariantNumeric: 'tabular-nums' }}>
                      {step.durationMs}ms
                    </span>
                  </motion.button>
                )
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>
                {shots.length} screenshot{shots.length === 1 ? '' : 's'} stored
                {shots.length > 0 && ' — click a step to enlarge'}
              </span>
              <button type="button" className="ov-btn ov-btn-ghost" onClick={onClose}
                style={{ marginLeft: 'auto' }}>
                <ExternalLink size={12} /> Done
              </button>
            </div>
          </div>
        )}

        {/* ── Screenshot lightbox ────────────────────────────────────────── */}
        <AnimatePresence>
          {zoom?.screenshotUrl && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setZoom(null)}
              style={{ position: 'fixed', inset: 0, zIndex: LAYERS.MODAL, padding: 32,
                display: 'flex', flexDirection: 'column', gap: 10,
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.85)', cursor: 'zoom-out' }}>
              <span style={{ fontSize: 12.5, color: '#fff' }}>
                {String(zoom.index).padStart(2, '0')} · {zoom.action}
              </span>
              <motion.img initial={{ scale: 0.96 }} animate={{ scale: 1 }}
                src={zoom.screenshotUrl} alt={zoom.action}
                style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain',
                  borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)' }} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
