import { useEffect, useState } from 'react'
import {
  Boxes, Camera, CheckCircle2, Clock, Cloud, Loader2, PlayCircle, Rocket, XCircle,
} from 'lucide-react'
import type { QaActiveRun } from '../../api/qa'
import ProgressBar from './ProgressBar'
import { RunEmulators } from './FlociContainerTable'
import LiveActivity from './LiveActivity'
import { runProgress } from './progress' 

/**
 * What a run is doing, right now.
 *
 * A remote run executes on a self-hosted runner and reports by heartbeat, so this
 * screen learns about it by polling — there is no event stream to replay. Before this
 * component the only signal was a one-line row reading "running", which for a
 * twelve-case run looks identical to a run that has hung.
 *
 * Two things fix that: a stepper that says WHICH phase, and live counts that move.
 * Both come from the heartbeat.
 *
 * The phase list is canonical and ordered rather than derived, which is the opposite
 * of RunTimeline's choice — and deliberately so. RunTimeline replays a completed
 * event stream and can show exactly what happened; here only the CURRENT phase is
 * known, so the order has to be assumed to place it. Phases a run legitimately skips
 * (emulators, when a project has no cloud dependency) are therefore drawn as skipped
 * once passed, never as completed work that never happened.
 */

type Look = { key: string; label: string; icon: React.ReactNode }

/** Ordered. `match` maps the backend's phase strings onto a row. */
const PHASES: (Look & { match: string[] })[] = [
  { key: 'queued',    label: 'Queued',      icon: <Clock size={12} />,      match: [] },
  { key: 'provision', label: 'Get code',    icon: <Boxes size={12} />,      match: ['provision'] },
  { key: 'plan',      label: 'Plan',        icon: <Rocket size={12} />,     match: ['plan', 'planned'] },
  { key: 'emulator',  label: 'Emulators',   icon: <Cloud size={12} />,      match: ['emulator'] },
  { key: 'app',       label: 'Start app',   icon: <PlayCircle size={12} />, match: ['app'] },
  { key: 'running',   label: 'Testing',     icon: <Loader2 size={12} />,    match: ['running', 'step'] },
  { key: 'evidence',  label: 'Evidence',    icon: <Camera size={12} />,     match: ['evidence', 'graph'] },
  { key: 'done',      label: 'Done',        icon: <CheckCircle2 size={12} />, match: ['done'] },
]

function phaseIndex(run: QaActiveRun): number {
  if (run.status === 'queued') return 0
  const found = PHASES.findIndex(p => p.match.includes(run.phase))
  // Claimed but no phase yet: past Queued, not yet anywhere useful.
  return found >= 0 ? found : 1
}

/** Nothing reported for 10 minutes. The reaper's own threshold is 15. */
function stale(since: string): boolean {
  const ms = Date.now() - new Date(since).getTime()
  return Number.isFinite(ms) && ms > 10 * 60 * 1000
}

function elapsed(from: string): string {
  const ms = Date.now() - new Date(from).getTime()
  if (!Number.isFinite(ms) || ms < 0) return ''
  const s = Math.floor(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

export default function RunProgress({ run, onCancel }: {
  run: QaActiveRun
  /** Absent means no cancel control. */
  onCancel?: (runId: string) => void
}) {
  const [cancelling, setCancelling] = useState(false)
  // Re-render once a second so the elapsed clock moves between polls. Without it the
  // whole panel is frozen for five seconds at a time and reads as stalled.
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const at = phaseIndex(run)
  const progress = runProgress(run)
  const failing = (run.totalFailed ?? 0) > 0

  return (
    <div className="ov-card" style={{ display: 'flex', flexDirection: 'column', gap: 12,
      padding: '13px 15px', borderLeft: `3px solid ${failing ? '#ef4444' : 'var(--color-primary)'}` }}>

      {/* Identity and where it is happening */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Loader2 size={14} className="animate-spin"
          style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 700,
          color: 'var(--color-text)' }}>{run.runId}</span>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 20,
          color: '#f59e0b', background: 'rgba(245,158,11,0.12)',
          border: '1px solid rgba(245,158,11,0.3)' }}>
          {run.status}
        </span>
        {onCancel && (
          <button
            onClick={async () => { setCancelling(true); await onCancel(run.runId) }}
            disabled={cancelling}
            title="Stop this run"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
                     fontSize: 10.5, fontWeight: 700, padding: '2px 8px',
                     borderRadius: 20, cursor: cancelling ? 'default' : 'pointer',
                     background: 'rgba(239,68,68,0.10)',
                     border: '1px solid rgba(239,68,68,0.30)', color: '#ef4444' }}>
            {cancelling ? <Loader2 size={10} className="animate-spin" />
                        : <XCircle size={10} />}
            Stop
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-muted)' }}>
          {run.runner
            ? `on ${run.runner}`
            : 'waiting for a runner to pick it up'}
          {run.createdAt && ` · ${elapsed(run.createdAt)}`}
        </span>
      </div>

      {/* The stepper. Answers "which part is slow" without opening anything. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap' }}>
        {PHASES.map((phase, i) => {
          const state = i < at ? 'past' : i === at ? 'now' : 'future'
          const color = state === 'now' ? 'var(--color-primary)'
            : state === 'past' ? '#10b981' : 'var(--color-muted)'
          return (
            <div key={phase.key} style={{ display: 'flex', alignItems: 'center' }}>
              <div title={phase.label} style={{ display: 'flex', alignItems: 'center', gap: 5,
                padding: '3px 8px', borderRadius: 20, color,
                background: state === 'now' ? 'rgba(79,70,229,0.12)' : 'transparent',
                border: `1px solid ${state === 'now' ? 'rgba(79,70,229,0.35)' : 'transparent'}`,
                opacity: state === 'future' ? 0.45 : 1 }}>
                <span style={{ display: 'flex' }}>{phase.icon}</span>
                <span style={{ fontSize: 11, fontWeight: state === 'now' ? 700 : 500 }}>
                  {phase.label}
                </span>
              </div>
              {i < PHASES.length - 1 && (
                <span aria-hidden style={{ width: 10, height: 1, flexShrink: 0,
                  background: i < at ? '#10b981' : 'var(--color-border)' }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Always shown. When the plan size is not known yet the bar sweeps and says
          so, rather than reading 0% — which would claim nothing has worked. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11.5,
            fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#10b981' }}>
              <CheckCircle2 size={11} /> {run.totalPassed ?? 0} passed
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4,
              color: failing ? '#ef4444' : 'var(--color-muted)' }}>
              <XCircle size={11} /> {run.totalFailed ?? 0} failed
            </span>
            <span style={{ color: 'var(--color-muted)' }}>
              {run.totalSkipped ?? 0} skipped
            </span>
            {(run.totalUnemulated ?? 0) > 0 && (
              <span style={{ color: '#8b5cf6' }}>{run.totalUnemulated} not emulated</span>
            )}
          </div>
          <ProgressBar progress={progress} failing={failing} height={4} />
        </div>

      {/* A run that has not moved in a long time is the reason Stop exists: the
          reaper only catches one that has gone QUIET, and a wedged runner keeps
          reporting. */}
      {run.updatedAt && stale(run.updatedAt) && (
        <span style={{ fontSize: 11, color: '#f59e0b' }}>
          No progress for {elapsed(run.updatedAt)} — the runner may have wedged.
          Stop it if it is not coming back.
        </span>
      )}

      {/* The Floci containers serving this run, live from its heartbeat. */}
      {!!run.emulators?.length && (
        <RunEmulators emulators={run.emulators} stale={run.emulatorsStale} />
      )}

      {/* And what it is actually doing, line by line. */}
      {!!run.activity?.length && (
        <LiveActivity activity={run.activity} maxHeight={160} />
      )}
    </div>
  )
}
