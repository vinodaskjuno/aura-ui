import { useEffect, useMemo, useState } from 'react'
import { Boxes, ChevronRight, ExternalLink, Loader2, Play, Search, Sparkles, Square, Terminal }
  from 'lucide-react'
import { qaApi } from '../../api/qa'
import type { QaRunner } from '../../api/qa'
import { runnerLabel } from '../qa/useQaRunners'
import EmulatorInspectModal from '../qa/EmulatorInspectModal'
import FlociLogPanel from './FlociLogPanel'
import { Modal } from '../ui/Overlay'

/**
 * Start this project's cloud emulators, and stop them when you choose.
 *
 * The emulators a run starts die with it, which makes them impossible to work against
 * and impossible to inspect afterwards. These are machine-scoped (`aura-dev-<cloud>`):
 * ONE per cloud, shared by every project here, outliving any number of runs. Floci's
 * ports are fixed, so a container per project could never run at the same time as
 * another — projects are kept apart by AWS account INSIDE the emulator instead, and each
 * one sees only its own resources.
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

/**
 * Floci, in one rail-width line.
 *
 * Reports state and nothing else — every control is in the popup. The split is on
 * "what is true" versus "what can I change", which is the split a rail is good at:
 * the answer to "are my emulators up?" should cost a glance, and the seven buttons
 * that act on them should cost a click and then have room.
 *
 * Renders the same three states the full panel does, including `busy`, so the rail
 * does not claim the emulators are stopped while a start is in flight.
 */
function FlociSummary({ containers, machine, busy, flociUi, onOpen }: {
  containers: { name: string; cloud?: string; ports?: string }[]
  machine: string
  busy: string
  flociUi?: { running?: boolean; port?: number }
  onOpen: () => void
}) {
  const running = containers.length > 0
  const clouds = containers.map(c => c.cloud).filter(Boolean).join(' ')

  return (
    <div style={{ display: 'grid', gap: 'var(--space-1)', minWidth: 0 }}>
    <button
      type="button"
      onClick={onOpen}
      title={running
        ? `${containers.length} emulator(s) on ${machine}. Open to populate, inspect or stop them.`
        : `No emulator running on ${machine}. Open to start one.`}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-2)', width: '100%',
        padding: 'var(--space-2)', textAlign: 'left', cursor: 'pointer',
        border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
        background: 'var(--color-card)', color: 'var(--color-text)', minWidth: 0,
      }}
    >
      <Boxes size={13} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
      <span style={{ fontSize: 'var(--text-body)', fontWeight: 650, flexShrink: 0 }}>
        Floci
      </span>
      <span style={{
        fontSize: 'var(--text-caption)', color: 'var(--color-text-secondary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
      }}>
        {busy ? `${busy}…` : running ? clouds || 'running' : 'stopped'}
      </span>
      <span aria-hidden style={{
        marginLeft: 'auto', flexShrink: 0,
        width: 6, height: 6, borderRadius: '50%',
        background: busy ? 'var(--color-warning)'
          : running ? 'var(--color-success)' : 'var(--color-muted)',
      }} />
      <ChevronRight size={12} style={{ color: 'var(--color-muted)', flexShrink: 0 }} />
    </button>

    {/* In the rail rather than in the popup: this opens Floci's OWN console in a new
        tab, so it is navigation, not a control. Burying a one-click destination behind
        a dialog you then have to dismiss is the wrong trade — and unlike the seven
        buttons inside, it needs no room.

        A sibling of the button above, never a child: an <a> inside a <button> is
        invalid HTML and browsers resolve the nesting in ways that break both.

        Owner-only by construction — the whole component is behind the viewer's own
        runner — and `localhost` resolves on the machine reading this, which is that
        same machine. */}
    {flociUi?.running ? (
      <a href={`http://localhost:${flociUi.port || 4500}`} target="_blank"
         rel="noreferrer"
         style={{ ...linkBtn, justifySelf: 'start', paddingLeft: 'var(--space-2)',
                  textDecoration: 'none' }}>
        <ExternalLink size={10} /> Open Floci dashboard
      </a>
    ) : running && (
      /* SAYS WHY, rather than simply not being there.

         This link is the one thing on the panel Aura does not control: the emulators
         on 4566 are containers Aura starts, but Floci's console on 4500 is a separate
         process the operator runs, and Aura only probes for it. So with emulators
         plainly running, the missing link looks like a bug in Aura rather than a
         process nobody started — which is precisely the "absent vs zero" confusion
         the status strip exists to prevent. Shown only while the emulators are up,
         since that is when anyone goes looking for it. */
      <span style={{ fontSize: 'var(--text-label)', color: 'var(--color-muted)',
                     paddingLeft: 'var(--space-2)', lineHeight: 1.5 }}>
        Floci's own console is not running on {machine}. Aura starts the emulators,
        not the console — start it there to get a link.
      </span>
    )}
    </div>
  )
}

export default function FlociControl({ projectId, runners, you }: {
  projectId: string
  runners: QaRunner[]
  you?: string
}) {
  const [busy, setBusy] = useState<'start' | 'stop' | 'populate' | ''>('')
  const [command, setCommand] = useState('')
  const [error, setError] = useState('')
  const [inspect, setInspect] = useState('')
  const [showPanel, setShowPanel] = useState(false)
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

  // Aura's DevMate emulators on this machine, told apart from a run's own by name.
  const containers = useMemo(
    // Every DevMate emulator, not this project's own. There is ONE per cloud for the
    // whole machine now — Floci's ports are fixed, so per-project containers could never
    // run together — and projects are separated by AWS account inside it instead. The
    // old `endsWith(projectId)` filter is exactly what made the panel go blank when a
    // colleague's, or your own other project's, emulator held the port.
    () => (mine?.containers || []).filter(c => c.name.startsWith(`aura-dev-`)),
    [mine])

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
        <span style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-secondary)',
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
    // NOT force-opened any more. Opening it on the press meant one Start left a
    // ~290px log panel pinned open for that project forever — the preference below
    // is per-project and persists, so the panel never closed itself again. The
    // header's own busy line already explains that we are waiting on the runner's
    // next poll, which is the part of the wait worth seeing; the console is for
    // when something looks wrong, and that is a decision the reader makes.
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
    <>
      {/* In the rail: one line saying what is true. Everything you can DO to the
          emulators lives in the popup below.

          Floci has seven controls, a container list, a console and a dashboard link —
          a machine-level concern with more surface than the project-level rail it was
          crammed into. At 320px the buttons wrapped, the ports and the log lines both
          overflowed, and the section that is checked most often was the one hardest
          to read. A summary answers "is it up?" in the rail; the popup answers
          everything else with room to spare. */}
      <FlociSummary
        containers={containers}
        machine={runnerLabel(mine, you)}
        busy={busy}
        flociUi={flociUi}
        onOpen={() => setShowPanel(true)}
      />

      <Modal
        open={showPanel}
        onClose={() => setShowPanel(false)}
        title="Floci emulators"
        subtitle={`on ${runnerLabel(mine, you)}`}
        width="min(960px, 94vw)"
      >
    <div style={{ padding: 'var(--space-3)', display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Boxes size={13} style={{ color: 'var(--color-text-secondary)' }} />
        <span style={{ fontSize: 'var(--text-body)', fontWeight: 650 }}>Floci</span>
        <span style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-secondary)',
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
            ? 'Stop the shared emulator. This affects every project on this machine, '
              + 'and Floci keeps state in memory, so their resources go too.'
            : 'Start the emulators this project’s dependencies imply'}
          style={{ marginLeft: running ? 0 : 'auto', display: 'inline-flex',
                   alignItems: 'center',
                   gap: 5, fontSize: 'var(--text-caption)', fontWeight: 600, padding: '4px 10px',
                   borderRadius: 'var(--radius-sm)', cursor: busy ? 'default' : 'pointer',
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
        <p style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-secondary)', margin: 0,
                    lineHeight: 1.6 }}>
          Booting your app on {runnerLabel(mine, you)} so its startup code creates the
          resources. The first time also installs its dependencies, so this can take
          several minutes.
        </p>
      ) : !!busy && (
        <p style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-secondary)', margin: 0,
                    lineHeight: 1.6 }}>
          Asked {runnerLabel(mine, you)} to {busy}. It picks up requests on its next
          poll, so this takes a few seconds.
        </p>
      )}

      {!!error && (
        <p style={{ fontSize: 'var(--text-caption)', color: '#f59e0b', margin: 0, lineHeight: 1.6 }}>
          {error}
        </p>
      )}

      {running ? (
        <div style={{ display: 'grid', gap: 3 }}>
          {containers.map(c => (
            <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8,
                                       fontSize: 'var(--text-caption)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%',
                             background: '#10b981', flexShrink: 0 }} />
              <span style={{ fontWeight: 600, width: 42 }}>{c.cloud || '—'}</span>
              <span style={{ color: 'var(--color-text-secondary)',
                             fontFamily: 'var(--font-mono)', fontSize: 'var(--text-caption)' }}>
                {c.ports || ''}
              </span>
              <button onClick={() => setInspect(c.cloud)} style={linkBtn}
                      title="What is inside this emulator right now">
                <Search size={10} /> Resources
              </button>
            </div>
          ))}
          {/* Inline again, because the whole section is now inside a 960px popup and
              a log line finally has room. It was briefly its own modal, opened from
              this panel while this panel sat in a 320px rail — a modal inside a modal
              once the section itself moved, which is a nesting worth not having. */}
          {showTerminal && containers[0] && (
            <div style={{ marginTop: 4 }}>
              <FlociLogPanel runner={mine.name} container={containers[0].name}
                             label={runnerLabel(mine, you)} />
            </div>
          )}

        </div>
      ) : !busy && (
        <p style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-secondary)', margin: 0,
                    lineHeight: 1.6 }}>
          No emulators running on this machine. Aura starts the ones your dependencies
          imply and leaves them up until you stop them — one per cloud, shared by every
          project here, each project seeing only its own resources.
        </p>
      )}

      {inspect && (
        <EmulatorInspectModal runner={mine.name} cloud={inspect} projectId={projectId}
                               machine={runnerLabel(mine, you)}
                               onClose={() => setInspect('')} />
      )}
    </div>
      </Modal>
    </>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    // --radius-md, matching FlociSummary above and the Panel that AppRunControl uses.
    // These three are siblings in the rail and were rendering at two different radii.
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-2)', display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Boxes size={13} style={{ color: 'var(--color-text-secondary)' }} />
        <span style={{ fontSize: 'var(--text-body)', fontWeight: 650 }}>Floci</span>
      </div>
      {children}
    </div>
  )
}

const linkBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-caption)',
  padding: '2px 7px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
  border: '1px solid var(--color-border)', background: 'transparent',
  color: 'var(--color-text)',
}
