import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  X, Play, CheckCircle2, XCircle, Loader, Ban, Network, Cloud, Camera,
  Database, ListChecks,
} from 'lucide-react'
import { wsOrigin } from '../../api/wsUrl'
import { qaApi, type QaCapabilities, type RunReport } from '../../api/qa'
import { useAuthStore } from '../../store/authStore'
import StepTimeline from './StepTimeline'
import type { RunStep } from '../../api/qa'

/**
 * Start a run and watch it happen.
 *
 * The lifecycle shown is the real one — plan from the graph, start only the
 * emulators the project's dependencies imply, execute, store evidence, write back to
 * the graph. The view this replaced showed ECS "scale up / scale down" steps for a
 * container that is no longer created, and inferred which step it was on by
 * pattern-matching substrings in log lines.
 */

type Phase = 'idle' | 'plan' | 'planned' | 'emulator' | 'running' | 'evidence' | 'graph' | 'done' | 'error'

const PHASES: { id: Phase; label: string; icon: React.ReactNode }[] = [
  { id: 'plan',     label: 'Plan from graph', icon: <ListChecks size={13} /> },
  { id: 'emulator', label: 'Cloud emulators', icon: <Cloud size={13} /> },
  { id: 'running',  label: 'Run + capture',   icon: <Camera size={13} /> },
  { id: 'evidence', label: 'Evidence to S3',  icon: <Database size={13} /> },
  { id: 'graph',    label: 'Write back',      icon: <Network size={13} /> },
]

const ORDER: Phase[] = ['plan', 'planned', 'emulator', 'running', 'evidence', 'graph', 'done']

interface Props {
  projectId: string
  defaultUrl?: string
  onClose: () => void
  onComplete?: () => void
}

export default function LocalRunView({ projectId, defaultUrl, onClose, onComplete }: Props) {
  const token = useAuthStore(s => s.token)
  const [caps, setCaps] = useState<QaCapabilities | null>(null)
  const [appUrl, setAppUrl] = useState(defaultUrl || 'http://localhost:3000')
  const [phase, setPhase] = useState<Phase>('idle')
  const [lines, setLines] = useState<string[]>([])
  const [steps, setSteps] = useState<RunStep[]>([])
  const [report, setReport] = useState<RunReport | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const logRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    qaApi.capabilities().then(r => setCaps(r.data)).catch(() => setCaps(null))
  }, [])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [lines])

  useEffect(() => () => wsRef.current?.close(), [])

  const start = useCallback(() => {
    setLines([]); setSteps([]); setReport(null); setPhase('plan')

    const ws = new WebSocket(`${wsOrigin()}/api/qa/ws/local-run`)
    wsRef.current = ws

    ws.onopen = () => ws.send(JSON.stringify({
      token, project_id: projectId, app_url: appUrl,
    }))

    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.type === 'step') {
        // Streamed for progress; the full step record with its screenshot comes from
        // S3 in the report, so this only advances the visible count.
        setLines(l => [...l, `  ${msg.status.padEnd(9)} ${msg.action}`])
        return
      }
      if (msg.type === 'report') {
        setReport(msg as RunReport)
        setPhase('done')
        qaApi.getResult(projectId, msg.runId)
          .then(r => setSteps(r.data.steps))
          .catch(() => { /* the report already carries the summary */ })
        onComplete?.()
        return
      }
      if (msg.type === 'error') {
        setLines(l => [...l, `error: ${msg.message}`])
        setPhase('error')
        return
      }
      if (msg.message) setLines(l => [...l, msg.message])
      if (ORDER.includes(msg.type)) setPhase(msg.type as Phase)
    }

    ws.onerror = () => { setPhase('error'); setLines(l => [...l, 'connection failed']) }
  }, [appUrl, projectId, token, onComplete])

  const reached = (p: Phase) => ORDER.indexOf(phase) >= ORDER.indexOf(p)
  const busy = phase !== 'idle' && phase !== 'done' && phase !== 'error'
  const blocked = caps ? !caps.canRun : false

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 900,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}>
      <motion.div initial={{ scale: .97, y: 8 }} animate={{ scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)',
          borderRadius: 14, width: 'min(860px, 100%)', maxHeight: '90vh',
          overflowY: 'auto', padding: 22 }}>

        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div className="section-label">QualityMind</div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 800,
              margin: '3px 0 0' }}>Run tests for {projectId}</h3>
          </div>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-muted)', display: 'flex' }}>
            <X size={17} />
          </button>
        </div>

        {/* Say plainly that this environment cannot run, rather than offering a
            button that fails — which is exactly what the retired ECS path did. */}
        {blocked && (
          <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start',
            background: 'var(--color-card)', border: '1px solid var(--color-border)',
            borderLeft: '3px solid #f59e0b', borderRadius: 8, padding: '11px 13px',
            marginBottom: 14, fontSize: 12.5, color: 'var(--color-subtext)',
            lineHeight: 1.6 }}>
            <Ban size={15} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Runs cannot execute here.</strong> {caps?.reason}
              <div style={{ marginTop: 5, color: 'var(--color-muted)' }}>
                Tests need podman and a browser, so they run on a developer machine or
                in CI. Evidence goes to the shared S3 bucket, so anything run elsewhere
                is still reviewable in the Results tab here.
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 9, marginBottom: 16, flexWrap: 'wrap' }}>
          <input value={appUrl} onChange={e => setAppUrl(e.target.value)}
            disabled={busy} placeholder="http://localhost:3000"
            style={{ flex: 1, minWidth: 240, background: 'var(--color-surface)',
              border: '1px solid var(--color-border)', borderRadius: 7,
              padding: '8px 11px', color: 'var(--color-text)', fontSize: 12.5,
              fontFamily: 'var(--font-mono)' }} />
          <button type="button" className="ov-btn ov-btn-primary"
            disabled={busy || blocked || !appUrl.trim()} onClick={start}>
            {busy ? <Loader size={13} className="animate-spin" /> : <Play size={13} />}
            {busy ? 'Running…' : 'Start run'}
          </button>
        </div>

        {/* Lifecycle */}
        <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
          {PHASES.map(p => {
            const on = reached(p.id)
            const active = phase === p.id
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 11.5, padding: '6px 10px', borderRadius: 20,
                border: `1px solid ${on ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: on ? 'rgba(79,142,247,.10)' : 'transparent',
                color: on ? 'var(--color-primary)' : 'var(--color-muted)',
                fontWeight: active ? 700 : 500 }}>
                {p.icon}{p.label}
              </div>
            )
          })}
        </div>

        {lines.length > 0 && (
          <div ref={logRef} style={{ background: 'var(--color-surface)',
            border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 12px',
            maxHeight: 190, overflowY: 'auto', fontFamily: 'var(--font-mono)',
            fontSize: 11.5, lineHeight: 1.65, color: 'var(--color-subtext)',
            whiteSpace: 'pre-wrap', marginBottom: 14 }}>
            {lines.join('\n')}
          </div>
        )}

        {report && (
          <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10,
            flexWrap: 'wrap', fontSize: 13 }}>
            {report.status === 'passed'
              ? <CheckCircle2 size={15} style={{ color: '#10b981' }} />
              : report.status === 'failed'
                ? <XCircle size={15} style={{ color: '#ef4444' }} />
                : <Ban size={15} style={{ color: '#f59e0b' }} />}
            <strong style={{ fontFamily: 'var(--font-mono)' }}>{report.runId}</strong>
            <span style={{ color: 'var(--color-subtext)' }}>
              {report.totalPassed} passed · {report.totalFailed} failed
              {report.totalSkipped > 0 && ` · ${report.totalSkipped} skipped`}
            </span>
            {report.reason && (
              <span style={{ color: '#fbbf24', fontSize: 12 }}>{report.reason}</span>
            )}
          </div>
        )}

        {steps.length > 0 && <StepTimeline steps={steps} />}
      </motion.div>
    </motion.div>
  )
}
