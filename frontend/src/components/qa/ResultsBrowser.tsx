import { useCallback, useEffect, useState } from 'react'
import {
  Loader2, CheckCircle2, XCircle, AlertTriangle, ChevronLeft, Cloud, Clock, User,
  Play, RefreshCw,
} from 'lucide-react'
import { qaApi, type QaActiveRun, type QaCapabilities, type RunReport, type RunStep }
  from '../../api/qa'
import LocalRunView from './LocalRunView'
import RunProgress from './RunProgress'
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
  // Runs that have been queued but not finished. These cannot come from S3: report.json
  // is written last and its presence IS the done signal, so an unfinished run is
  // invisible there. Without this the Start button appeared to do nothing for minutes.
  const [active, setActive] = useState<QaActiveRun[]>([])
  const [queueing, setQueueing] = useState(false)
  // Where to point a REMOTE run. The local path has this field already
  // (LocalRunView), and the queue path shipped without it — so a remote run could only
  // ever try to start the project's own app from a working copy on the runner, and a
  // project not cloned there failed with "No working copy found" and no way to say
  // "test this URL instead".
  const [remoteUrl, setRemoteUrl] = useState('')

  const load = useCallback(async () => {
    if (!projectId) { setRuns([]); setActive([]); setLoading(false); return }
    setLoading(true); setError('')
    try {
      const { data } = await qaApi.listResults(projectId)
      // Defensive: tolerate both the array and the short-lived {runs} envelope. A
      // cached bundle meeting a newer backend is exactly how "n.map is not a
      // function" happened, and an empty list beats a crashed panel.
      setRuns(Array.isArray(data) ? data : ((data as { runs?: RunReport[] }).runs ?? []))
      try {
        setActive((await qaApi.activeRuns(projectId)).data.active ?? [])
      } catch {
        // An older backend has no /active endpoint. Stored results still render.
        setActive([])
      }
    } catch {
      setError('Could not read stored results.')
    } finally { setLoading(false); setFirstLoad(false) }
  }, [projectId])

  useEffect(() => { load() }, [load])

  // Poll only while something is in flight. A remote run takes minutes and the runner
  // reports progress to the API, not to this tab — so polling is the only way this
  // screen learns anything, and stopping when idle keeps it off the API the rest of
  // the time.
  useEffect(() => {
    if (!active.length) return
    // 2.5s, not 5s. A remote run finishes in about twenty seconds, so a 5s poll
    // shows roughly four frames of an eight-phase run — the stepper would jump.
    const t = setInterval(load, 2500)
    return () => clearInterval(t)
  }, [active.length, load])

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
  // Two ways a run can execute, and they need different UI. Locally the WebSocket view
  // streams it live. Remotely it is queued for a self-hosted runner, so the only honest
  // thing to show is the queue state — the run is not happening in this tab.
  const runsHere = caps?.local ?? false

  const start = async () => {
    if (runsHere) { setStarting(true); return }
    setQueueing(true)
    try {
      await qaApi.enqueueRun(projectId, remoteUrl.trim())
      await load()
    } catch {
      setError('Could not queue the run.')
    } finally { setQueueing(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* The entry point for a FIRST run. Without this the only way to start one was
          to open an existing run's detail drawer — which a project with no runs does
          not have. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        marginBottom: 4 }}>
        <button type="button" className="ov-btn ov-btn-primary"
          disabled={!canRun || !projectId || queueing}
          title={canRun ? 'Start a test run' : (caps?.reason || 'Checking…')}
          onClick={start}
          style={{ opacity: canRun ? 1 : 0.5, cursor: canRun ? 'pointer' : 'not-allowed' }}>
          {queueing ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
          Start a run
        </button>
        {/* Only for the remote path — the local one has this field in LocalRunView. */}
        {!runsHere && (
          <input value={remoteUrl} onChange={e => setRemoteUrl(e.target.value)}
            disabled={queueing}
            placeholder="Leave empty to start this project's own app on the runner"
            title="A URL that is already serving, or empty to build and start the project's own app from its working copy on the runner machine"
            style={{ flex: '1 1 300px', minWidth: 240, background: 'var(--color-surface)',
              border: '1px solid var(--color-border)', borderRadius: 7,
              padding: '7px 10px', color: 'var(--color-text)', fontSize: 12.5,
              fontFamily: 'var(--font-mono)' }} />
        )}
        <button type="button" className="ov-btn ov-btn-ghost" onClick={load} disabled={loading}>
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Refresh
        </button>
        <span style={{ fontSize: 11.5, color: 'var(--color-muted)', lineHeight: 1.5,
          whiteSpace: 'pre-line' }}>
          {caps === null
            ? 'Checking what this environment can do…'
            : runsHere
              ? `${runs.length} stored run(s). Runs execute here.`
              : caps.runners.length
                ? `${runs.length} stored run(s). Runs execute on ${caps.runners
                    .map(r => r.name).join(', ')}. ` + (remoteUrl.trim()
                      ? 'Tests will run against the URL above, which must already be serving.'
                      : "The runner will start the project's own app from its working copy — that copy has to exist on the runner machine.")
                : `${runs.length} stored run(s). ${caps.reason}`}
        </span>
      </div>

      {/* In-flight runs. Deliberately above the stored list: this is the only place a
          queued run appears at all, because S3 cannot see one — report.json is written
          last and its presence IS the done signal. */}
      {active.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {active.map(run => <RunProgress key={run.runId} run={run} />)}
        </div>
      )}

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
          No stored runs for this project yet. Runs execute where podman and a browser
          are available: connect a self-hosted runner and press Start a run, or run one
          directly with{' '}
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
