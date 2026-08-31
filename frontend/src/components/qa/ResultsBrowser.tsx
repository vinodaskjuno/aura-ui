import { useCallback, useEffect, useState } from 'react'
import {
  Loader2, CheckCircle2, XCircle, AlertTriangle, ChevronLeft, Cloud, Clock, User,
  Play, RefreshCw,
} from 'lucide-react'
import { qaApi, type QaCapabilities, type RunReport, type RunStep } from '../../api/qa'
import LocalRunView from './LocalRunView'
import StepTimeline from './StepTimeline'

/**
 * Past runs for a project, read from S3.
 *
 * Works in every environment including the deployed one, because evidence lives in
 * the shared bucket rather than on whichever machine produced it — a run executed on
 * a laptop is reviewable here. Listing is by key prefix, so it is neither a table
 * scan nor capped at 500 items the way the endpoint it replaced was.
 */

function statusLook(status: RunReport['status']) {
  if (status === 'passed') return { color: '#10b981', icon: <CheckCircle2 size={14} />, label: 'passed' }
  if (status === 'failed') return { color: '#ef4444', icon: <XCircle size={14} />, label: 'failed' }
  return { color: '#f59e0b', icon: <AlertTriangle size={14} />, label: 'could not run' }
}

function when(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

function Meta({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5,
      color: 'var(--color-muted)' }}>
      {icon}{children}
    </span>
  )
}

export default function ResultsBrowser({ projectId }: { projectId: string }) {
  const [runs, setRuns] = useState<RunReport[]>([])
  // `firstLoad` gates the full-panel spinner. Using `loading` for it meant a refresh
  // — including the one a finished run triggers — replaced the whole panel and
  // UNMOUNTED the open run modal, discarding its log and summary mid-view.
  const [firstLoad, setFirstLoad] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<{ report: RunReport; steps: RunStep[] } | null>(null)
  const [openLoading, setOpenLoading] = useState(false)
  const [starting, setStarting] = useState(false)
  const [caps, setCaps] = useState<QaCapabilities | null>(null)

  const load = useCallback(async () => {
    if (!projectId) { setRuns([]); setLoading(false); return }
    setLoading(true); setError('')
    try {
      setRuns((await qaApi.listResults(projectId)).data)
    } catch {
      setError('Could not read stored results.')
    } finally { setLoading(false); setFirstLoad(false) }
  }, [projectId])

  useEffect(() => { load() }, [load])

  // Whether a run can be STARTED here is separate from whether results can be READ:
  // evidence lives in shared S3, so this list works everywhere, but execution needs
  // podman and a browser.
  useEffect(() => {
    qaApi.capabilities().then(r => setCaps(r.data)).catch(() => setCaps(null))
  }, [])

  const openRun = async (runId: string) => {
    setOpenLoading(true)
    try {
      setOpen((await qaApi.getResult(projectId, runId)).data)
    } catch {
      setError(`Could not open run ${runId}.`)
    } finally { setOpenLoading(false) }
  }

  if (firstLoad && loading) {
    return <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5,
      color: 'var(--color-subtext)', padding: '18px 0' }}>
      <Loader2 size={14} className="animate-spin" /> Reading stored results…
    </div>
  }

  if (open) {
    const look = statusLook(open.report.status)
    const emus = open.report.emulators.filter(e => e.started)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <button type="button" onClick={() => setOpen(null)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none',
            border: 'none', color: 'var(--color-primary)', cursor: 'pointer',
            fontSize: 12.5, padding: 0, alignSelf: 'flex-start' }}>
          <ChevronLeft size={14} /> All runs
        </button>

        <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)',
          borderRadius: 10, padding: '13px 15px', display: 'flex',
          flexDirection: 'column', gap: 9 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ color: look.color, display: 'flex' }}>{look.icon}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13,
              fontWeight: 700, color: 'var(--color-text)' }}>{open.report.runId}</span>
            <span style={{ fontSize: 12, color: look.color, fontWeight: 600 }}>{look.label}</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: 'var(--color-subtext)' }}>
              {open.report.totalPassed} passed · {open.report.totalFailed} failed
              {open.report.totalSkipped > 0 && ` · ${open.report.totalSkipped} skipped`}
            </span>
          </div>

          {open.report.reason && (
            <div style={{ fontSize: 12, color: '#fbbf24', lineHeight: 1.55 }}>
              {open.report.reason}
            </div>
          )}

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Meta icon={<Clock size={12} />}>{when(open.report.startedAt)}</Meta>
            <Meta icon={<User size={12} />}>{open.report.ranBy || 'unknown'}</Meta>
            <Meta icon={<Cloud size={12} />}>
              {emus.length
                ? emus.map(e => `${e.cloud}:${e.port}`).join(', ')
                : 'no cloud emulators needed'}
            </Meta>
            <Meta icon={null}>
              {open.report.covered.length} graph node(s) covered
            </Meta>
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--color-muted)', wordBreak: 'break-all' }}>
            {open.report.appUrl}
          </div>

          {/* The digest, not the tag: a result is only evidence if the thing that
              produced it is identifiable, and `latest` moves. */}
          {emus.length > 0 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10,
              color: 'var(--color-muted)', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {emus.map(e => (
                <span key={e.cloud}>{e.image} @ {e.digest.slice(0, 19)}…</span>
              ))}
            </div>
          )}
        </div>

        <StepTimeline steps={open.steps} />
      </div>
    )
  }

  const canRun = caps?.canRun ?? false

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* The entry point for a FIRST run. Without this the only way to start one was
          to open an existing run's detail drawer — which a project with no runs does
          not have. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        marginBottom: 4 }}>
        <button type="button" className="ov-btn ov-btn-primary"
          disabled={!canRun || !projectId}
          title={canRun ? 'Start a test run' : (caps?.reason || 'Checking…')}
          onClick={() => setStarting(true)}
          style={{ opacity: canRun ? 1 : 0.5, cursor: canRun ? 'pointer' : 'not-allowed' }}>
          <Play size={13} /> Start a run
        </button>
        <button type="button" className="ov-btn ov-btn-ghost" onClick={load} disabled={loading}>
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Refresh
        </button>
        <span style={{ fontSize: 11.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
          {caps === null
            ? 'Checking what this environment can do…'
            : canRun
              ? `${runs.length} stored run(s). Runs execute here.`
              : `${runs.length} stored run(s). ${caps.reason} — start a run where podman is available; results still appear here.`}
        </span>
      </div>

      {starting && (
        <LocalRunView
          projectId={projectId}
          onClose={() => setStarting(false)}
          onComplete={load}
        />
      )}

      {error && <div style={{ fontSize: 12, color: '#ef4444' }}>{error}</div>}

      {!runs.length && !error && (
        <div style={{ fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.6 }}>
          No stored runs for this project yet. Start one where podman and a browser are
          available — locally, or with{' '}
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
            python -m src.qatest --project {projectId || '<id>'} --url &lt;app-url&gt;
          </code>
          . Results appear here wherever they were run.
        </div>
      )}

      {openLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5,
          color: 'var(--color-subtext)' }}>
          <Loader2 size={13} className="animate-spin" /> Opening run…
        </div>
      )}

      {runs.map(run => {
        const look = statusLook(run.status)
        return (
          <button key={run.runId} type="button" onClick={() => openRun(run.runId)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%',
              background: 'var(--color-card)', border: '1px solid var(--color-border)',
              borderLeft: `3px solid ${look.color}`, borderRadius: 8,
              padding: '11px 13px', cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ color: look.color, display: 'flex', flexShrink: 0 }}>{look.icon}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5,
              fontWeight: 700, color: 'var(--color-text)', flexShrink: 0 }}>
              {run.runId}
            </span>
            <span style={{ fontSize: 12, color: 'var(--color-subtext)', flex: 1,
              minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap' }}>
              {run.appUrl}
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--color-subtext)', flexShrink: 0,
              fontVariantNumeric: 'tabular-nums' }}>
              {run.totalPassed}/{run.totalPassed + run.totalFailed + run.totalSkipped}
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--color-muted)', flexShrink: 0 }}>
              {when(run.startedAt)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
