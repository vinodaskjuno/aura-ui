import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ExternalLink, Loader2, Play, Radio, Square, Terminal }
  from 'lucide-react'
import { qaApi } from '../../api/qa'
import type { QaAppSession, QaRunner } from '../../api/qa'
import { getIngestStatus } from '../../api/aiObservability'
import { Panel } from '../ui/Panel'
import { Modal } from '../ui/Overlay'
import type { IngestStatus } from '../../api/aiObservability'

/**
 * Run this project locally, and keep it running.
 *
 * The sibling of FlociControl, and deliberately shaped like it — same ownership rule,
 * same "this is parked, not instant" honesty. The difference is lifetime: Populate
 * boots the app so its startup creates cloud resources and then STOPS it, which is
 * why nothing was ever up long enough to be worth observing. This leaves it running.
 *
 * THE URL IS NOT A LINK FOR EVERYONE. `http://127.0.0.1:5173` resolves on the RUNNER's
 * machine — the developer's laptop — and on the viewer's own machine it resolves to
 * something else entirely, or nothing. A colleague clicking it would be pointed at
 * their own computer. So it is a link for its owner and plain text for anybody else,
 * exactly as FlociControl already does for the Floci dashboard.
 *
 * TELEMETRY IS REPORTED, NOT ASSUMED. `/otlp/*` always answers 200 by design — a
 * non-2xx would make the exporter retry in a loop inside the reader's own application
 * — so "no spans yet" and "your key was refused" are indistinguishable from the wire.
 * The chip is the only place that difference is ever visible.
 */
//: A start installs dependencies before it can run anything, so it is judged on the
//: populate timescale rather than the emulator one.
const GIVE_UP_MS = 900000
//: The runner reports every ~15s, so anything faster just re-reads the same row.
const POLL_MS = 5000

//: The runner protocol `app-start` needs. Mirrors `_APP_SESSION_PROTOCOL` in
//: `routers/qa.py`, which is the side that actually enforces it — this copy exists
//: only so the button can explain itself BEFORE it is pressed.
//:
//: The skew is knowable the moment a runner reports: protocol rides every state
//: report, ~15s apart. Withholding it until someone clicks and gets a 409 turned a
//: detectable precondition into a dead end, discovered by whoever pressed the button
//: rather than by whoever started the process.
const APP_SESSION_PROTOCOL = 3

export default function AppRunControl({ projectId, runners, you }: {
  projectId: string
  runners: QaRunner[]
  you?: string
}) {
  const [busy, setBusy] = useState<'start' | 'stop' | ''>('')
  const [command, setCommand] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [apps, setApps] = useState<QaAppSession[]>([])
  const [ingest, setIngest] = useState<IngestStatus | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const [instrument, setInstrument] = useState(false)

  // Ownership rather than "any online runner": starting something on a machine the
  // presser cannot see is an action they can neither observe nor undo.
  const mine = useMemo(
    () => runners.find(r => r.online && r.owner && you && r.owner === you),
    [runners, you])

  const refresh = useCallback(async () => {
    try {
      const { data } = await qaApi.appState(projectId)
      setApps(data.apps || [])
    } catch { /* a poll that fails is not news; the next one will say */ }
    try {
      setIngest(await getIngestStatus(projectId))
    } catch { setIngest(null) }
  }, [projectId])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, POLL_MS)
    return () => clearInterval(timer)
  }, [refresh])

  // Watch the parked command so a REFUSED start surfaces as a reason rather than as a
  // spinner that eventually gives up and blames the runner for being slow.
  useEffect(() => {
    if (!command || !mine) return
    const started = Date.now()
    const timer = setInterval(async () => {
      if (Date.now() - started > GIVE_UP_MS) {
        setBusy(''); setCommand('')
        setError('The runner did not answer. It may be offline.')
        return
      }
      try {
        const { data } = await qaApi.commandStatus(mine.name, command)
        if (data.status === 'pending') return
        setBusy(''); setCommand('')
        if (data.status === 'failed') setError(data.error || data.reason || 'It failed.')
        refresh()
      } catch { /* keep waiting */ }
    }, 2000)
    return () => clearInterval(timer)
  }, [command, mine, refresh])

  // `protocol` is absent on a runner that has never reported; treat that as 1, which
  // is what the server does, rather than as "fine".
  const speaks = mine ? Number(mine.protocol ?? 1) : 0
  const tooOld = !!mine && speaks < APP_SESSION_PROTOCOL

  const running = apps.filter(a => !a.stale)
  const owned = running.filter(a => !a.ownerId || !you || a.runner === mine?.name)

  const start = async () => {
    if (!mine) return
    setBusy('start'); setError(''); setNotice('')
    try {
      const { data } = await qaApi.startApp(projectId, mine.name, instrument)
      setCommand(data.commandId)
      if (!data.telemetry?.configured && data.telemetry?.skipped) {
        // A NOTICE, not an error — and it used to be `setError`, which rendered it
        // amber in the failure slot. The app starts either way; only the tracing env
        // was withheld. Showing "your app is starting" in the same place and colour
        // as "your app could not start" is how a working feature reads as broken.
        setNotice(data.telemetry.skipped)
      }
    } catch (e: any) {
      setBusy('')
      setError(e?.response?.data?.detail || 'Could not start the app.')
    }
  }

  const act = async (action: 'start' | 'stop') => {
    if (action === 'start') return start()
    if (!mine) return
    setBusy(action); setError('')
    try {
      const { data } = await qaApi.stopApp(projectId, mine.name)
      setCommand(data.commandId)
    } catch (e: any) {
      setBusy('')
      setError(e?.response?.data?.detail || `Could not ${action} the app.`)
    }
  }

  const loadLogs = async () => {
    if (!mine) return
    setShowLogs(s => !s)
    try {
      const { data } = await qaApi.appLogs(projectId, mine.name)
      setLogs(data.lines || [])
    } catch { setLogs([]) }
  }

  if (!mine) {
    return (
      <div style={{ fontSize: 'var(--text-caption)', opacity: 0.6, padding: '6px 0' }}>
        {running.length > 0
          ? `Running on ${running[0].runner}, which is not your machine.`
          : 'Connect a runner on your own machine to run this project locally.'}
      </div>
    )
  }

  return (
    <Panel title="Run locally" icon={<Play size={12} />} dense
           subtitle={running.length ? undefined : 'Start this project on your machine'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={!!busy || (tooOld && !running.length)}
          onClick={() => act(running.length ? 'stop' : 'start')}
          title={tooOld && !running.length
            ? `This machine's runner speaks protocol ${speaks}; starting a project needs ${APP_SESSION_PROTOCOL}.`
            : undefined}
          style={{ ...btn,
                   opacity: tooOld && !running.length ? 0.5 : 1,
                   cursor: tooOld && !running.length ? 'not-allowed' : 'pointer' }}
        >
          {busy ? <Loader2 size={10} className="animate-spin" />
            : running.length ? <Square size={10} /> : <Play size={10} />}
          {busy === 'start' ? 'starting…' : busy === 'stop' ? 'stopping…'
            : running.length ? 'Stop app' : 'Run locally'}
        </button>

        {!running.length && (
          <label style={{ ...hint, display: 'flex', alignItems: 'center', gap: 4 }}
                 title="Installs an OpenTelemetry sidecar beside the project — never into
                        its own environment — so LLM calls appear as span trees. Skipped,
                        with a reason, for a compose stack or a project that already
                        traces itself.">
            <input type="checkbox" checked={instrument}
                   onChange={e => setInstrument(e.target.checked)} />
            trace LLM calls
          </label>
        )}

        {running.length > 0 && <TelemetryChip status={ingest} />}

        {running.length > 0 && (
          <button type="button" onClick={loadLogs} style={btn}>
            <Terminal size={10} /> {showLogs ? 'hide output' : 'output'}
          </button>
        )}
      </div>

      {running.map(app => (
        <div key={app.sessionId + app.kind} style={row}>
          <span style={{ opacity: 0.7 }}>{app.kind}</span>
          {owned.includes(app)
            ? <a href={app.url} target="_blank" rel="noreferrer" style={link}>
                {app.url} <ExternalLink size={9} />
              </a>
            // Plain text, not a link: this address resolves on THEIR machine.
            : <span style={{ opacity: 0.55 }}>{app.url} (on {app.runner})</span>}
          {!app.healthy && <span style={warn}>not answering</span>}
          {app.instrumented && <span style={{ ...hint, color: '#10b981' }}>traced</span>}
          {app.instrumentationError && (
            <span style={warn} title={app.instrumentationError}>
              <AlertTriangle size={9} /> tracing off
            </span>
          )}
        </div>
      ))}

      {apps.some(a => a.stale) && (
        <div style={hint}>
          The runner has not reported recently — this is the last known state, not a
          live one.
        </div>
      )}

      {/* Same reasoning as the emulator terminal: application output is wide, and a
          320px rail is the wrong container for it. */}
      <Modal
        open={showLogs}
        onClose={() => setShowLogs(false)}
        title="Application output"
        subtitle={running[0] ? `${running[0].kind} · ${running[0].runner}` : undefined}
        width="min(960px, 94vw)"
      >
        <pre style={pre}>{logs.length ? logs.join('\n') : 'No output yet.'}</pre>
      </Modal>

      {/* Stated up front, not on failure. The server enforces this and will refuse a
          start anyway; the point is that the reason is visible to whoever is looking
          at the panel, at the moment they wonder why the button is greyed, rather
          than being delivered as a 409 to whoever happens to click. */}
      {tooOld && !running.length && (
        <div style={{ ...hint, color: 'var(--color-warning)', lineHeight: 1.5 }}>
          This machine's runner speaks protocol {speaks}; running a project locally
          needs {APP_SESSION_PROTOCOL}. It is almost certainly a process that started
          before this feature existed — restart the agent on{' '}
          {mine?.machine || 'that machine'}.
        </div>
      )}

      {/* Quiet, and visually distinct from a failure. */}
      {notice && (
        <div style={{ ...hint, lineHeight: 1.5 }}>{notice}</div>
      )}

      {error && <div style={{ ...hint, color: 'var(--color-warning)' }}>{error}</div>}
      </div>
    </Panel>
  )
}

/** Connected / quiet / refused / nothing-yet — the distinction the always-200 ingest
 *  contract erases everywhere else. */
function TelemetryChip({ status }: { status: IngestStatus | null }) {
  if (!status) return null
  const look: Record<string, { color: string; label: string }> = {
    connected: { color: '#10b981', label: 'traces arriving' },
    'no-spans-yet': { color: '#64748b', label: 'no traces yet' },
    'key-refused': { color: '#ef4444', label: 'telemetry key refused' },
    disabled: { color: '#64748b', label: 'ingest off' },
    unknown: { color: '#64748b', label: 'telemetry unknown' },
  }
  const seen = look[status.state] || look.unknown
  const label = status.state === 'connected' && status.quiet ? 'traces quiet' : seen.label
  return (
    <span style={{ ...hint, color: seen.color, display: 'flex', alignItems: 'center',
                   gap: 3 }}
          title={status.detail}>
      <Radio size={9} /> {label}
    </span>
  )
}

const btn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-caption)',
  padding: '3px 8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
  border: '1px solid var(--color-border)', background: 'none',
  color: 'var(--color-text)',
}
const hint: React.CSSProperties = { fontSize: 'var(--text-label)', opacity: 0.7 }
const warn: React.CSSProperties = { ...hint, color: '#f59e0b', display: 'flex',
                                    alignItems: 'center', gap: 3 }
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8,
                                   fontSize: 'var(--text-caption)' }
const link: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 3,
                                    color: '#6366f1', textDecoration: 'none' }
const pre: React.CSSProperties = {
  margin: 0, padding: 'var(--space-3)', fontSize: 'var(--text-caption)',
  lineHeight: 1.55, fontFamily: 'var(--font-mono)',
  background: 'var(--color-bg-subtle, rgba(0,0,0,.25))',
  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
}
