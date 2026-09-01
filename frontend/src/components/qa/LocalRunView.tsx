import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  X, Play, CheckCircle2, XCircle, Loader, Ban,
} from 'lucide-react'
import { wsOrigin } from '../../api/wsUrl'
import { qaApi, type QaCapabilities, type RunReport } from '../../api/qa'
import { useAuthStore } from '../../store/authStore'
import StepTimeline from './StepTimeline'
import RunTimeline, { type RunEvent } from './RunTimeline'
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

type Phase = 'idle' | 'plan' | 'planned' | 'emulator' | 'app' | 'running' | 'evidence' | 'graph' | 'done' | 'error'

const ORDER: Phase[] = ['plan', 'planned', 'emulator', 'app', 'running', 'evidence', 'graph', 'done']

interface Props {
  projectId: string
  defaultUrl?: string
  onClose: () => void
  onComplete?: () => void
}

export default function LocalRunView({ projectId, defaultUrl, onClose, onComplete }: Props) {
  const token = useAuthStore(s => s.token)
  const [caps, setCaps] = useState<QaCapabilities | null>(null)
  // Empty means "start the project's own application". A URL targets something
  // already running instead — which is what you want against a deployed environment.
  const [appUrl, setAppUrl] = useState(defaultUrl || '')
  const [phase, setPhase] = useState<Phase>('idle')
  const [events, setEvents] = useState<RunEvent[]>([])
  const [steps, setSteps] = useState<RunStep[]>([])
  const [report, setReport] = useState<RunReport | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    qaApi.capabilities().then(r => setCaps(r.data)).catch(() => setCaps(null))
  }, [])

  useEffect(() => () => wsRef.current?.close(), [])

  const start = useCallback(() => {
    setEvents([]); setSteps([]); setReport(null); setPhase('plan')

    const ws = new WebSocket(`${wsOrigin()}/api/qa/ws/local-run`)
    wsRef.current = ws

    ws.onopen = () => ws.send(JSON.stringify({
      token, project_id: projectId, app_url: appUrl.trim(),
    }))

    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)

      if (msg.type === 'report') {
        setReport(msg as RunReport)
        setPhase('done')
        // The streamed steps carry status only; the stored ones carry screenshots.
        qaApi.getResult(projectId, msg.runId)
          .then(r => setSteps(r.data.steps))
          .catch(() => { /* the report already carries the summary */ })
        onComplete?.()
        return
      }

      // Everything else is timeline material. Accumulating the events rather than
      // formatting them here keeps one interpretation of the stream, in RunTimeline.
      setEvents(e => [...e, msg as RunEvent])
      if (msg.type === 'error') { setPhase('error'); return }
      if (ORDER.includes(msg.type)) setPhase(msg.type as Phase)
    }

    ws.onerror = () => {
      setPhase('error')
      setEvents(e => [...e, { type: 'error', message: 'connection to the run failed' }])
    }
  }, [appUrl, projectId, token, onComplete])

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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <input value={appUrl} onChange={e => setAppUrl(e.target.value)}
              disabled={busy}
              placeholder="Leave empty to start this project's own app"
              style={{ flex: 1, minWidth: 260, background: 'var(--color-surface)',
                border: '1px solid var(--color-border)', borderRadius: 7,
                padding: '8px 11px', color: 'var(--color-text)', fontSize: 12.5,
                fontFamily: 'var(--font-mono)' }} />
            <button type="button" className="ov-btn ov-btn-primary"
              disabled={busy || blocked} onClick={start}>
              {busy ? <Loader size={13} className="animate-spin" /> : <Play size={13} />}
              {busy ? 'Running…' : 'Start run'}
            </button>
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
            {appUrl.trim()
              ? 'Tests will run against the URL above, which must already be serving.'
              : 'QualityMind will start the project\u2019s API and UI from its working copy, on free ports, and stop them afterwards.'}
          </span>
        </div>

        <RunTimeline events={events} />

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
            {/* The reason is shown on the Finished stage above; repeating it here
                just made the same paragraph appear twice. */}
          </div>
        )}

        {steps.length > 0 && <StepTimeline steps={steps} />}
      </motion.div>
    </motion.div>
  )
}
