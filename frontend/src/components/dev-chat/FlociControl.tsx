import { useEffect, useMemo, useState } from 'react'
import { Boxes, ExternalLink, Loader2, Play, Search, Sparkles, Square, Terminal }
  from 'lucide-react'
import { qaApi } from '../../api/qa'
import type { QaRunner } from '../../api/qa'
import { runnerLabel } from '../qa/useQaRunners'
import EmulatorInspectModal from '../qa/EmulatorInspectModal'
import FlociLogPanel from './FlociLogPanel'

/**
 * Start this project's cloud emulators, and stop them when you choose.
 *
 * The emulators a run starts die with it, which makes them impossible to work against
 * and impossible to inspect afterwards. These are project-scoped
 * (`aura-dev-<cloud>-<projectId>`): they are yours, they outlive any number of runs, and
 * a run that finds them adopts them rather than tearing them down.
 *
 * NOT INSTANT, and the button says so. This server is on Fargate and cannot start a
 * container on a laptop; the runner has no inbound port and polls. So Start parks a
 * request that is collected on the next poll — up to ~15 seconds. A spinner implying a
 * local action would be a lie about where the work happens.
 *
 * Shown only to the machine's own operator. `localhost:4500` and "this project's
 * emulator" mean different machines for different viewers, so offering Start to someone
 * who does not own the runner would act on a machine they cannot see.
 */
//: Long enough for a slow image pull, short enough that a dead runner is not mistaken
//: for a slow one.
const GIVE_UP_MS = 120000
//: Populate is a different order of magnitude: it installs the project's dependencies on
//: the runner (up to 900s per directory) before it can even start the app. Judging it by
//: the emulator's window would abandon a perfectly healthy populate minutes early.
const POPULATE_GIVE_UP_MS = 900000

export default function FlociControl({ projectId, runners, you }: {
  projectId: string
  runners: QaRunner[]
  you?: string
}) {
  const [busy, setBusy] = useState<'start' | 'stop' | 'populate' | ''>('')
  const [command, setCommand] = useState('')
  const [error, setError] = useState('')
  const [inspect, setInspect] = useState('')
  // Remembered per project. Someone who keeps the terminal open is watching emulators
  // work and wants it open the next time too; someone who closed it does not want it
  // reappearing on every visit. Wrapped because storage throws in some privacy modes,
  // and a terminal preference must never be what stops the panel rendering.
  const [showTerminal, setShowTerminal] = useState(() => {
    try { return localStorage.getItem(`floci.terminal.${projectId}`) === '1' }
    catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem(`floci.terminal.${projectId}`, showTerminal ? '1' : '0') }
    catch { /* a preference is not worth an error */ }
  }, [showTerminal, projectId])

  // The runner this viewer owns. Ownership rather than "any online runner": Start on
  // someone else's machine is an action the presser cannot observe or undo.
  const mine = useMemo(
    () => runners.find(r => r.online && r.owner && you && r.owner === you),
    [runners, you])
  const online = useMemo(() => runners.filter(r => r.online), [runners])

  // Project-scoped containers, told apart from a run's own by name.
  const containers = useMemo(
    () => (mine?.containers || []).filter(c => c.name.startsWith(`aura-dev-`)
                                            && c.name.endsWith(projectId)),
    [mine, projectId])

  // Clearing on the container list alone was not enough: that only changes when the
  // command SUCCEEDS. A refused start — most often because another project already holds
  // the fixed port — left the button on "starting…" indefinitely while the reason sat
  // unread on the runner's row. So the outcome is polled, and a failure is shown.
  // Populate deliberately does NOT clear here: it leaves the container list untouched
  // (it fills the emulator rather than starting one), so only its command result can say
  // it is done.
  useEffect(() => { setBusy(b => (b === 'populate' ? b : '')) }, [containers.length])

  useEffect(() => {
    if (!command || !mine) return
    let stop = false
    const started = Date.now()
    const limit = busy === 'populate' ? POPULATE_GIVE_UP_MS : GIVE_UP_MS
    const timer = setInterval(async () => {
      if (stop) return
      try {
        const { data } = await qaApi.commandStatus(mine.name, command)
        if (stop) return
        if (data.status === 'failed') {
          setError(data.error || 'The runner could not carry that out.')
          setBusy(''); setCommand('')
        } else if (data.status === 'ready' || data.status === 'superseded') {
          // For start/stop, success is confirmed by the container list the next state
          // report brings. Populate changes no containers, so this IS its completion.
          setBusy(b => (b === 'populate' ? '' : b))
          setCommand('')
        } else if (Date.now() - started > limit) {
          setError('The runner did not report back. It may have gone offline.')
          setBusy(''); setCommand('')
        }
      } catch {
        if (Date.now() - started > limit) { setBusy(''); setCommand('') }
      }
    }, 3000)
    return () => { stop = true; clearInterval(timer) }
    // `busy` only picks the timeout; re-running on it would restart the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command, mine])

  // Explain rather than vanish. Rendering nothing when there is no usable runner leaves
  // the reader unable to tell a missing feature from an unmet precondition — which is
  // exactly the confusion the empty Floci panel caused before it learned to say why.
  if (!mine) {
    return (
      <Shell>
        <span style={{ fontSize: 11.5, color: 'var(--color-text-secondary)',
                       lineHeight: 1.6 }}>
          {!online.length
            ? 'No runner is connected, so there is no machine to start emulators on. '
              + 'Start one with `python -m src.qatest.agent`.'
            : `A runner is connected${online[0].owner ? ` (${online[0].owner}'s)` : ''}`
              + ', but it is not registered to you, so Aura will not start containers on '
              + 'it from here.'}
        </span>
      </Shell>
    )
  }

  const populate = async () => {
    if (!mine) return
    setBusy('populate')
    setError('')
    try {
      const { data } = await qaApi.populateEmulators(projectId, mine.name)
      setCommand(data.commandId)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not ask the runner to populate.')
      setBusy('')
    }
  }

  const act = async (action: 'start' | 'stop') => {
    setBusy(action)
    setError('')
    // Opened on the press, not on success: the panel's own header explains that it is
    // waiting on the runner's next poll, which is the part of the wait worth seeing.
    if (action === 'start') setShowTerminal(true)
    try {
      const { data } = await qaApi.controlEmulators(projectId, action, mine.name)
      setCommand(data.commandId)
    } catch (e: any) {
      setError(e?.response?.data?.detail || `Could not ${action} the emulators.`)
      setBusy('')
    }
  }

  const running = containers.length > 0
  const flociUi = mine.flociUi

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 8,
                  padding: '10px 12px', display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Boxes size={13} style={{ color: 'var(--color-text-secondary)' }} />
        <span style={{ fontSize: 12, fontWeight: 650 }}>Floci</span>
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)',
                       overflow: 'hidden', textOverflow: 'ellipsis',
                       whiteSpace: 'nowrap' }}>
          on {runnerLabel(mine, you)}
        </span>

        {running && (
          <button
            onClick={populate}
            disabled={!!busy}
            title="Boots your app once against this emulator so it creates its resources"
            style={{ ...linkBtn, marginLeft: 'auto',
                     cursor: busy ? 'default' : 'pointer' }}>
            {busy === 'populate' ? <Loader2 size={10} className="animate-spin" />
                                 : <Sparkles size={10} />}
            {busy === 'populate' ? 'populating…' : 'Populate'}
          </button>
        )}

        {running && (
          <button
            onClick={() => setShowTerminal(v => !v)}
            title={showTerminal ? 'Hide the emulator output'
                                : 'Watch what the emulator is printing'}
            style={{ ...linkBtn,
                     color: showTerminal ? 'var(--color-text)'
                                         : 'var(--color-text-secondary)' }}>
            <Terminal size={10} /> {showTerminal ? 'Hide terminal' : 'Terminal'}
          </button>
        )}

        <button
          onClick={() => act(running ? 'stop' : 'start')}
          disabled={!!busy}
          title={running
            ? 'Stop these emulators. Nothing else uses them.'
            : 'Start the emulators this project’s dependencies imply'}
          style={{ marginLeft: running ? 0 : 'auto', display: 'inline-flex',
                   alignItems: 'center',
                   gap: 5, fontSize: 11, fontWeight: 600, padding: '4px 10px',
                   borderRadius: 6, cursor: busy ? 'default' : 'pointer',
                   border: `1px solid ${running ? 'rgba(239,68,68,0.3)'
                                                : 'var(--color-border)'}`,
                   background: running ? 'rgba(239,68,68,0.08)' : 'transparent',
                   color: running ? '#ef4444' : 'var(--color-text)' }}>
          {busy ? <Loader2 size={11} className="animate-spin" />
                : running ? <Square size={11} /> : <Play size={11} />}
          {busy === 'start' ? 'starting…' : busy === 'stop' ? 'stopping…'
            : running ? 'Stop' : 'Start'}
        </button>
      </div>

      {/* Says WHY it is not instant, rather than leaving a long spinner unexplained. */}
      {busy === 'populate' ? (
        <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: 0,
                    lineHeight: 1.6 }}>
          Booting your app on {runnerLabel(mine, you)} so its startup code creates the
          resources. The first time also installs its dependencies, so this can take
          several minutes.
        </p>
      ) : !!busy && (
        <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: 0,
                    lineHeight: 1.6 }}>
          Asked {runnerLabel(mine, you)} to {busy}. It picks up requests on its next
          poll, so this takes a few seconds.
        </p>
      )}

      {!!error && (
        <p style={{ fontSize: 11.5, color: '#f59e0b', margin: 0, lineHeight: 1.6 }}>
          {error}
        </p>
      )}

      {running ? (
        <div style={{ display: 'grid', gap: 3 }}>
          {containers.map(c => (
            <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8,
                                       fontSize: 11.5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%',
                             background: '#10b981', flexShrink: 0 }} />
              <span style={{ fontWeight: 600, width: 42 }}>{c.cloud || '—'}</span>
              <span style={{ color: 'var(--color-text-secondary)',
                             fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                {c.ports || ''}
              </span>
              <button onClick={() => setInspect(c.cloud)} style={linkBtn}
                      title="What is inside this emulator right now">
                <Search size={10} /> Resources
              </button>
            </div>
          ))}
          {showTerminal && containers[0] && (
            <div style={{ marginTop: 4 }}>
              <FlociLogPanel runner={mine.name} container={containers[0].name}
                             label={runnerLabel(mine, you)} />
            </div>
          )}

          {flociUi?.running && (
            /* Only useful because these emulators outlive the run. Owner-only, and the
               link resolves on the viewer's own machine — which is this one. */
            <a href={`http://localhost:${flociUi.port || 4500}`} target="_blank"
               rel="noreferrer"
               style={{ ...linkBtn, justifySelf: 'start', marginTop: 2,
                        textDecoration: 'none' }}>
              <ExternalLink size={10} /> Open Floci dashboard
            </a>
          )}
        </div>
      ) : !busy && (
        <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: 0,
                    lineHeight: 1.6 }}>
          No emulators running for this project. Aura starts the ones your dependencies
          imply, and leaves them up until you stop them.
        </p>
      )}

      {inspect && (
        <EmulatorInspectModal runner={mine.name} cloud={inspect}
                               machine={runnerLabel(mine, you)}
                               onClose={() => setInspect('')} />
      )}
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 8,
                  padding: '10px 12px', display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Boxes size={13} style={{ color: 'var(--color-text-secondary)' }} />
        <span style={{ fontSize: 12, fontWeight: 650 }}>Floci</span>
      </div>
      {children}
    </div>
  )
}

const linkBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5,
  padding: '2px 7px', borderRadius: 5, cursor: 'pointer',
  border: '1px solid var(--color-border)', background: 'transparent',
  color: 'var(--color-text)',
}
