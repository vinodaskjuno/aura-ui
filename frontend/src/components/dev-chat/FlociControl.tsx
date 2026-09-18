import { useCallback, useEffect, useMemo, useState } from 'react'
import { Boxes, Check, ChevronRight, Copy, ExternalLink, Loader2, Play, Search, Sparkles,
         Square, Terminal } from 'lucide-react'
import { qaApi } from '../../api/qa'
import type { QaJob, QaRunner } from '../../api/qa'
import { runnerLabel } from '../qa/useQaRunners'
import EmulatorInspectModal from '../qa/EmulatorInspectModal'
import FlociLogPanel from './FlociLogPanel'
import ProgressBar from '../qa/ProgressBar'
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
//: Start now includes a first-time image pull on its own 600s budget, which the old
//: 120s window would have abandoned while the download was still running.
const START_GIVE_UP_MS = 660000

/** `354122663620` → `3541-2266-3620`, which is exactly how Floci's own ACCOUNT chip
 *  renders it. Checking that Aura and the console agree should be a glance, not a
 *  character-by-character comparison. The raw value is what gets copied. */
function groupAccount(account: string): string {
  return /^\d{12}$/.test(account) ? account.replace(/(\d{4})(?=\d)/g, '$1-') : account
}

//: What each job's stages are called, so a bar can list the ones still to come rather
//: than only the one running. Kept in step with the agent's own `progress.step` calls;
//: a mismatch costs a label, never correctness — `index`/`total` come from the runner.
const JOB_STAGES: Record<string, (clouds: string[]) => string[]> = {
  populate: () => [
    'Fetching the working copy and installing dependencies',
    'Locating the app on this machine',
    'Detecting how the app starts',
    'Checking the emulator is up',
    'Starting the app so it creates its resources',
    'Reading what it created',
    'Done',
  ],
  'emulator-start': clouds => [
    'Checking podman',
    ...clouds.flatMap(c => [`Fetching the ${c} emulator image`,
                            `Starting aura-dev-${c}`,
                            `Waiting for ${c} to answer on :4566`]),
  ],
  'emulator-stop': clouds => [
    'Checking podman', ...clouds.map(c => `Stopping aura-dev-${c}`),
  ],
}

const JOB_TITLE: Record<string, string> = {
  populate: 'Populating',
  'emulator-start': 'Starting the emulator',
  'emulator-stop': 'Stopping the emulator',
}

/**
 * One runner job, as a bar and the stages behind it.
 *
 * Modelled on `SetupProgress` in RunnerPanel, which already renders a runner-reported
 * multi-step job exactly this way — same `ProgressBar`, same `Progress` union. A second
 * pattern for the same idea would be a second thing to keep in step.
 *
 * The percentage is stages COMPLETED over total, never an interpolation. Populate's
 * dominant cost is installing dependencies, which has no progress signal at all, so a
 * smooth bar would park at 90% on a cold install and finish at 40% on a warm one. It
 * sits at 14% for most of a populate, and the moving part is the log inside stage one —
 * which is the honest signal that work is happening.
 */
function JobProgress({ job, clouds, queued = false }:
                     { job: QaJob; clouds: string[]; queued?: boolean }) {
  const labels = (JOB_STAGES[job.kind] || (() => []))(clouds.length ? clouds : ['aws'])
  const failed = !job.active && !job.ok
  const pct = job.total > 0 ? Math.round((job.index / job.total) * 100) : 0
  const title = failed ? `${JOB_TITLE[job.kind] || job.kind} failed`
                       : JOB_TITLE[job.kind] || job.kind

  return (
    <div style={{ display: 'grid', gap: 6,
                  padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 'var(--text-caption)' }}>
        {job.active && <Loader2 size={11} className="animate-spin"
                                color="var(--color-primary)" />}
        <span style={{ fontWeight: 650,
                       color: failed ? 'var(--color-danger)' : undefined }}>{title}</span>
        {/* A job on a runner that has gone quiet is LAST KNOWN. Without this a frozen
            bar and a slow one look identical. */}
        {job.stale && <span style={{ color: 'var(--color-warning)' }}>· last known</span>}
        {job.total > 0 && !queued && (
          <span style={{ marginLeft: 'auto', color: 'var(--color-text-secondary)',
                         fontVariantNumeric: 'tabular-nums' }}>
            {job.index} of {job.total} · {pct}%
          </span>
        )}
        {queued && (
          <span style={{ marginLeft: 'auto', color: 'var(--color-text-secondary)' }}>
            queued
          </span>
        )}
      </div>

      {/* Indeterminate while queued, and that is the honest shape rather than a
          shortcut: the runner has not picked the command up, so no stage has run and a
          bar sitting at 0% would claim work that has not started. ProgressBar's own
          note makes the same argument for an unclaimed run. */}
      <ProgressBar height={4} failing={failed}
                   progress={queued || job.total <= 0
                     ? { known: false, done: 0, label: job.step }
                     : { known: true, done: job.index, total: job.total, pct,
                         label: job.step }} />

      <div style={{ display: 'grid', gap: 2, fontSize: 'var(--text-label)' }}>
        {labels.map((label, i) => {
          // Queued means NOTHING has started, so no stage is marked as running. The
          // list is still shown, greyed, because "here is what is about to happen" is
          // worth more than an empty box while the runner gets to it.
          const done = !queued && i < job.index
          const now = !queued && i === job.index
          const isFailure = now && failed
          return (
            <div key={label + i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                            color: done ? 'var(--color-text-secondary)'
                              : isFailure ? 'var(--color-danger)'
                              : now ? 'var(--color-text)' : 'var(--color-muted)' }}>
                <span aria-hidden style={{ width: 9 }}>
                  {done ? '✓' : isFailure ? '✗' : now ? '◐' : '○'}
                </span>
                <span>{label}</span>
              </div>
              {/* The stage that failed carries its reason inline rather than one amber
                  line at the top of the panel: a readiness timeout embeds the container's
                  own log, and a multi-cloud stop needs the failure pinned to the cloud
                  that produced it. Monospace and wrapped, never ellipsised. */}
              {isFailure && !!job.error && (
                <div style={{ margin: '2px 0 2px 15px', padding: '4px 6px',
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--color-surface-2)',
                              color: 'var(--color-danger)',
                              fontFamily: 'var(--font-mono)',
                              whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {job.error}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Stage one of a populate is minutes long and has no stages of its own, so its
          own output is what shows the work is alive. */}
      {job.active && !!job.log?.length && (
        <div style={{ display: 'grid', gap: 1, marginLeft: 15,
                      fontFamily: 'var(--font-mono)', fontSize: 'var(--text-label)',
                      color: 'var(--color-text-secondary)' }}>
          {job.log.slice(-3).map((line, i) => (
            <span key={i} style={{ overflow: 'hidden', textOverflow: 'ellipsis',
                                   whiteSpace: 'nowrap' }}>{line.text}</span>
          ))}
        </div>
      )}
    </div>
  )
}

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
function FlociSummary({ containers, machine, busy, flociUi, account, failed, onOpen }: {
  containers: { name: string; cloud?: string; ports?: string }[]
  machine: string
  busy: string
  flociUi?: { running?: boolean; port?: number }
  account: string
  /** The last emulator job on this project, if it ended badly. The popup used to be the
   *  only place a failure showed, so closing it made a refused Start indistinguishable
   *  from one never pressed. */
  failed?: QaJob
  onOpen: () => void
}) {
  const running = containers.length > 0
  const clouds = containers.map(c => c.cloud).filter(Boolean).join(' ')

  return (
    <div style={{ display: 'grid', gap: 'var(--space-1)', minWidth: 0 }}>
    <button
      type="button"
      onClick={onOpen}
      title={failed ? `${failed.step || failed.kind} failed: ${failed.error}`
        : running
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
        {busy ? `${busy}…`
          : failed ? `${failed.kind === 'emulator-stop' ? 'stop' : 'start'} failed`
          : running ? clouds || 'running' : 'stopped'}
      </span>
      <span aria-hidden style={{
        marginLeft: 'auto', flexShrink: 0,
        width: 6, height: 6, borderRadius: '50%',
        background: busy ? 'var(--color-warning)'
          : failed ? 'var(--color-danger)'
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
      /* `?account=` because Floci's console reads the account ONLY from localStorage,
         once, when its bundle loads — it never looks at the URL. The branded page Aura
         bind-mounts (floci-ui-brand/index.html) reads the parameter in an inline script
         that runs before that bundle, writes it, and strips it from the address bar.

         Without it the console opens on Floci's DEFAULT account, where this project has
         nothing, and reports every resource page empty for an emulator that is up and
         answering — which reads as Aura being broken. */
      <a href={`http://localhost:${flociUi.port || 4500}/${
                 account ? `?account=${account}` : ''}`}
         target="_blank" rel="noreferrer"
         title={account
           ? `Opens Floci's console on this project's account, ${groupAccount(account)}`
           : "Opens Floci's console"}
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
    <AccountLine account={account} />
    </div>
  )
}

/**
 * Which AWS account inside the shared emulator this project's resources live in.
 *
 * Nothing in Aura used to say. One Floci emulator serves every project on a machine and
 * they are separated by account, so a console on the wrong one reports every page empty
 * for resources that are demonstrably there — and the only way to find the right number
 * was to derive it by hand from a project id that is itself not shown anywhere.
 *
 * ABSENT IS NOT ZERO: a project with no cloud dependency has no account, and naming
 * Floci's default `000000000000` would point the reader at precisely the wrong one.
 */
function AccountLine({ account }: { account: string }) {
  const [copied, setCopied] = useState(false)

  if (!account) {
    return (
      <span style={{ fontSize: 'var(--text-label)', color: 'var(--color-muted)',
                     paddingLeft: 'var(--space-2)', fontStyle: 'italic' }}>
        # account unavailable
      </span>
    )
  }
  return (
    <button
      type="button"
      // The RAW value, not the grouped one: every CLI, header and env var wants the
      // twelve digits, and a reader who pastes `3541-2266-3620` gets Floci's default
      // account back with no error, which is the failure this whole line exists to end.
      onClick={() => {
        navigator.clipboard?.writeText(account).then(
          () => { setCopied(true); setTimeout(() => setCopied(false), 1200) },
          () => {},
        )
      }}
      title={`AWS account for this project inside the shared emulator. Click to copy ${account}`}
      style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none',
               border: 'none', padding: '2px var(--space-2)', cursor: 'pointer',
               justifySelf: 'start', color: 'var(--color-text-secondary)',
               fontSize: 'var(--text-label)', fontFamily: 'var(--font-mono)' }}>
      <span aria-hidden style={{ color: 'var(--color-muted)' }}>#</span>
      {groupAccount(account)}
      {copied ? <Check size={10} color="var(--color-success)" />
              : <Copy size={10} style={{ color: 'var(--color-muted)' }} />}
    </button>
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
  //: This project's Floci identity and whatever a runner is doing about it. Polled,
  //: because the jobs on it are the progress bar's source.
  const [emulators, setEmulators] = useState<{ account: string; clouds: string[]
                                               jobs: QaJob[] }>(
    { account: '', clouds: [], jobs: [] })
  //: Whether Floci's console answered US, just now. See `probeConsole`.
  const [consoleUp, setConsoleUp] = useState(false)
  /**
   * The command we just asked for, before any runner has said anything about it.
   *
   * A command is parked for a pull-based agent, so up to one poll passes before the
   * job even exists — 15s at the idle report cadence. Rendering nothing for that long
   * is what made the press feel like it had not registered. This is the request itself,
   * shown immediately and honestly: the stage list it is ABOUT to run, greyed, under a
   * sweeping bar that claims no progress, because none has happened.
   *
   * It carries the `commandId` the POST returned, so the moment the real job appears
   * this is dropped rather than racing it.
   */
  const [queued, setQueued] = useState<{ kind: QaJob['kind']; commandId: string } | null>(null)
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

  /**
   * Ask Floci's console directly whether it is up.
   *
   * The runner already reports this, and that stays the fallback — but it reports on its
   * own cadence and the panel polls on another, so "I started the console" took 13-45s
   * to become a link. This is the same machine the page is being read on, and the
   * console answers cross-origin, so it costs one bounded request and is near-instant.
   *
   * The runner's answer is kept because of exactly what `QaRunner.flociUi` documents: a
   * page served over HTTPS cannot fetch `http://localhost` without tripping
   * mixed-content. Aura is HTTP today, so this works; the day it is not, this quietly
   * fails and the runner's report is still there. A failed probe therefore means
   * "cannot tell from here", never "not running".
   */
  const probeConsole = useCallback((port: number) => {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 1500)
    fetch(`http://localhost:${port}/api/clouds`, { signal: ctl.signal })
      .then(r => setConsoleUp(r.ok))
      .catch(() => { /* blocked, refused or aborted — the runner still gets a say */ })
      .finally(() => clearTimeout(timer))
  }, [])

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

  // The account and the live jobs. Polled fast only while something is running: the
  // rest of the time this is a static property of the project and one read is enough.
  const loadEmulators = useCallback(() => {
    if (!projectId) return
    qaApi.getEmulators(projectId)
      .then(({ data }) => setEmulators({ account: data.account || '',
                                         clouds: data.clouds || [],
                                         jobs: data.jobs || [] }))
      .catch(() => { /* the panel works without it; the account line says unavailable */ })
  }, [projectId])

  const active = emulators.jobs.some(j => j.active)
  //: The one to render: whatever is running, else the most recent thing that ended.
  //: `project_jobs` already sorts active-first then newest, so this is the head of it.
  const realJob = emulators.jobs[0]

  // The runner has spoken about the command we queued, so the placeholder has served
  // its purpose. Matched on `commandId` rather than kind: a dedupe window can hand back
  // a different command's id, and a stale placeholder over a live job is worse than
  // none at all.
  useEffect(() => {
    if (queued && emulators.jobs.some(j => j.commandId === queued.commandId)) {
      setQueued(null)
    }
  }, [emulators.jobs, queued])

  //: The request, shaped like the job it is about to become. `total` is derived from the
  //: same stage lists the real job is rendered with, so the bar does not resize when the
  //: runner takes over.
  const queuedJob: QaJob | null = useMemo(() => {
    if (!queued) return null
    const clouds = emulators.clouds.length ? emulators.clouds : ['aws']
    const total = (JOB_STAGES[queued.kind] || (() => []))(clouds).length
    return {
      kind: queued.kind, projectId, commandId: queued.commandId, active: true,
      step: 'Waiting for the runner to pick this up', index: 0, total,
      ok: false, error: '', startedAt: '', endedAt: '',
    }
  }, [queued, emulators.clouds, projectId])

  const job = realJob || queuedJob
  //: An emulator job that ended badly, for the rail. Populate has the popup's own error
  //: line; Start and Stop are the ones a reader presses and then closes the popup on.
  const lastFailure = useMemo(
    () => emulators.jobs.find(j => !j.active && !j.ok && j.kind.startsWith('emulator-')),
    [emulators.jobs])
  useEffect(() => {
    loadEmulators()
    if (!active && !busy) return
    const timer = setInterval(loadEmulators, 3000)
    return () => clearInterval(timer)
  }, [loadEmulators, active, busy])

  // Probe on mount, on project change, and whenever a command settles — the three
  // moments the answer can have just changed.
  useEffect(() => {
    if (!mine) return
    probeConsole(mine.flociUi?.port || 4500)
  }, [mine, probeConsole, busy])

  useEffect(() => {
    if (!command || !mine) return
    let stop = false
    const started = Date.now()
    const limit = busy === 'populate' ? POPULATE_GIVE_UP_MS
      // A first Start pulls the image on its own 600s budget. The old 120s window
      // abandoned a healthy Start while the download was still running and blamed the
      // runner for going quiet.
      : busy === 'start' ? START_GIVE_UP_MS
      : GIVE_UP_MS
    const timer = setInterval(async () => {
      if (stop) return
      try {
        const { data } = await qaApi.commandStatus(mine.name, command)
        if (stop) return
        if (data.status === 'failed') {
          setError(data.error || 'The runner could not carry that out.')
          // The placeholder goes with it. A request that was refused before any stage
          // ran has no progress to show, and leaving a sweeping bar under an error
          // reads as "still working" next to "it failed".
          setBusy(''); setCommand(''); setQueued(null)
        } else if (data.status === 'ready' || data.status === 'superseded') {
          // For start/stop, success is confirmed by the container list the next state
          // report brings. Populate changes no containers, so this IS its completion.
          setBusy(b => (b === 'populate' ? '' : b))
          setCommand('')
        } else if (Date.now() - started > limit) {
          setError('The runner did not report back. It may have gone offline.')
          setBusy(''); setCommand(''); setQueued(null)
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
      // Straight away, so the press has a visible consequence rather than a spinner
      // for the poll the runner has yet to make.
      setQueued({ kind: 'populate', commandId: data.commandId })
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not ask the runner to populate.')
      setBusy(''); setQueued(null)
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
      setQueued({ kind: action === 'start' ? 'emulator-start' : 'emulator-stop',
                  commandId: data.commandId })
    } catch (e: any) {
      setError(e?.response?.data?.detail || `Could not ${action} the emulators.`)
      setBusy(''); setQueued(null)
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
        // Either source saying yes is enough: the probe is fast and the runner's report
        // is the one that survives an HTTPS page. See `probeConsole`.
        flociUi={{ running: consoleUp || !!flociUi?.running, port: flociUi?.port || 4500 }}
        account={emulators.account}
        failed={lastFailure}
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

      {/* The stages, whenever the runner has any to report. It supersedes the prose
          below while it is running: a bar naming the stage it is on answers "why is
          this taking so long" better than a sentence explaining that it might. */}
      {!!job && <JobProgress job={job} clouds={emulators.clouds}
                             queued={!realJob && !!queuedJob} />}

      {/* Says WHY it is not instant, rather than leaving a long spinner unexplained.
          Kept for the gap before the runner picks the command up, and for agents too
          old to report jobs at all. */}
      {job?.active ? null : busy === 'populate' ? (
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

      {/* Suppressed while a job carries the same failure: the stage block says WHICH
          stage failed and pins the reason to it, and repeating the string above it just
          reads as two problems. Amber became `--color-danger` because a refused Start is
          an error, not a warning — and because a hard-coded hex is not a token. */}
      {!!error && !(job && !job.active && !job.ok) && (
        <p style={{ fontSize: 'var(--text-caption)', color: 'var(--color-danger)',
                    margin: 0, lineHeight: 1.6 }}>
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
