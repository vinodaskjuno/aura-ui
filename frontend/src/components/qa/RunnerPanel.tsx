import { useState } from 'react'
import {
  AlertTriangle, CheckCircle2, Circle, Copy, Cpu, HelpCircle, Loader2, Monitor,
  RefreshCw, XCircle,
} from 'lucide-react'
import type { QaCapabilities, QaRunner, QaRunnerHealth } from '../../api/qa'
import LiveActivity from './LiveActivity'
import ProgressBar from './ProgressBar'

/**
 * A capability chip's state. A runner that reports no health at all is an older agent
 * — "unknown", not "broken".
 */
function capState(runner: QaRunner, flag: boolean): 'ok' | 'bad' | 'unknown' {
  if (!runner.reportsState && !runner.health) return 'unknown'
  return flag ? 'ok' : 'bad'
}
import FlociContainerTable, { type Row } from './FlociContainerTable'
import ContainerLogsDrawer from './ContainerLogsDrawer'
import EmulatorInspectDrawer from './EmulatorInspectDrawer'
import { allContainers, runnerLabel } from './useQaRunners'

/**
 * The machine that actually runs the tests, and the Floci containers on it.
 *
 * Idle is the normal state — a run lasts a minute and the rest of the day there is
 * nothing executing — so this is designed for idle first rather than treating it as an
 * empty state to apologise for.
 *
 * When nothing is connected the container section is not rendered at all. A disabled
 * table with dead Logs buttons tells the reader less than one honest sentence and the
 * command that fixes it.
 */
export default function RunnerPanel({ runners, caps, loading, error, lastUpdated,
                                     unauthorized, you, onRefresh }: {
  runners: QaRunner[]
  /** The viewer, so a machine can be called "yours" instead of named. */
  you?: string
  caps: QaCapabilities | null
  loading: boolean
  error: string
  lastUpdated: number
  /** A poll the server REFUSED, recently. Never a runner — a rejected poll carries no
   *  identity — but the reason the list below may be empty. */
  unauthorized?: { at: string; hint?: string } | null
  onRefresh: () => void
}) {
  const [logsFor, setLogsFor] = useState<Row | null>(null)
  const [inspectFor, setInspectFor] = useState<Row | null>(null)
  const rows = allContainers(runners) as Row[]
  const anyPodman = runners.some(r => r.online && r.podman)

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section>
        <Heading>Runners</Heading>
        {loading && !runners.length && (
          <p style={muted}><Loader2 size={12} className="animate-spin" /> Looking for runners…</p>
        )}
        {!!error && <p style={{ ...muted, color: '#ef4444' }}>{error}</p>}

        {/* Shown ABOVE the list, and whether or not the list is empty: a refused key
            explains a missing runner, and with two machines it explains why only one
            of them is here. */}
        {unauthorized && <RejectedKey seen={unauthorized} />}

        {!loading && !runners.length && !error && <NoRunner caps={caps} />}

        <div style={{ display: 'grid', gap: 10 }}>
          {runners.map(r => <RunnerCard key={r.name} runner={r} you={you} />)}
        </div>
      </section>

      {/* Only when a machine could actually have containers. */}
      {runners.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <Heading>Floci containers</Heading>
            <span style={{ marginLeft: 'auto', fontSize: 11,
                           color: 'var(--color-text-secondary)' }}>
              {lastUpdated ? `as of ${new Date(lastUpdated).toLocaleTimeString()}` : ''}
            </span>
            <button onClick={onRefresh} style={iconBtn} title="Refresh">
              <RefreshCw size={12} />
            </button>
          </div>

          {anyPodman ? (
            <FlociContainerTable rows={rows} showRunner={runners.length > 1}
                                 onLogs={setLogsFor} onInspect={setInspectFor} />
          ) : (
            <p style={{ ...muted, lineHeight: 1.6 }}>
              No connected runner has podman, so no cloud emulator can start. Tests that
              need one are reported as <em>not emulated</em> rather than failing — the
              application may be perfectly correct and the harness simply cannot answer.
            </p>
          )}

          {runners.some(r => !r.reportsState) && (
            <p style={{ ...muted, marginTop: 10 }}>
              <AlertTriangle size={11} /> A connected runner is on an older protocol and
              does not report what it is running. Upgrade it to see its containers.
            </p>
          )}
        </section>
      )}

      {logsFor && (
        <ContainerLogsDrawer runner={logsFor.runner} container={logsFor.name}
                             onClose={() => setLogsFor(null)} />
      )}

      {inspectFor && (
        <EmulatorInspectDrawer runner={inspectFor.runner} cloud={inspectFor.cloud}
                               onClose={() => setInspectFor(null)} />
      )}
    </div>
  )
}

function RunnerCard({ runner, you }: { runner: QaRunner; you?: string }) {
  const dot = runner.online ? '#10b981' : 'var(--color-text-secondary)'
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 8,
                  padding: '12px 14px', background: 'var(--color-surface-2, transparent)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Circle size={9} fill={dot} color={dot} />
        <span style={{ fontSize: 13, fontWeight: 650,
                       fontFamily: 'var(--font-mono, monospace)' }}>
          {/* The hostname is reported and stored, but never shown: a personal device
              name does not belong on a shared screen. */}
          {runnerLabel(runner, you)}
        </span>
        {runner.busyRunId && (
          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4,
                         background: '#4f8ef722', color: '#4f8ef7' }}>running a test</span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11,
                       color: runner.stale ? '#f59e0b' : 'var(--color-text-secondary)' }}>
          {runner.stale ? 'stopped reporting' : 'last seen'}{' '}
          {runner.lastSeen ? new Date(runner.lastSeen).toLocaleTimeString() : '—'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
        <Capability state={capState(runner, runner.podman)} icon={<Cpu size={12} />}
                    label={runner.podmanVersion ? `podman ${runner.podmanVersion}` : 'podman'} />
        <Capability state={capState(runner, runner.browser)} icon={<Monitor size={12} />}
                    label={runner.browserVersion ? `Chromium ${runner.browserVersion}` : 'Chromium'} />
        {runner.os && (
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{runner.os}</span>
        )}
      </div>

      {runner.stale && (
        <p style={{ ...muted, marginTop: 10, lineHeight: 1.6 }}>
          <AlertTriangle size={11} /> This runner has gone quiet. Anything listed below
          for it is the last thing it reported, not what is running now.
        </p>
      )}

      {/* A setup the USER started, streamed outward as it runs. It takes precedence
          over the problems list, because those are the things it is busy fixing. */}
      {runner.setup?.active
        ? <SetupProgress setup={runner.setup} />
        : <Problems health={runner.health} />}
    </div>
  )
}

/** What this machine cannot do, and exactly what to type to fix it. */
function Problems({ health }: { health?: QaRunnerHealth }) {
  if (!health || health.ok || !health.findings?.length) return null
  const blocking = health.findings.filter(f => f.severity === 'blocks')
  const limiting = health.findings.filter(f => f.severity !== 'blocks')

  return (
    <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
      {[...blocking, ...limiting].map(finding => {
        const blocks = finding.severity === 'blocks'
        return (
          <div key={finding.check}
               style={{ borderLeft: `2px solid ${blocks ? '#ef4444' : '#f59e0b'}`,
                        paddingLeft: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                          fontWeight: 600, color: blocks ? '#ef4444' : '#f59e0b' }}>
              <AlertTriangle size={11} />
              {finding.title}
              <span style={{ fontSize: 10, fontWeight: 400,
                             color: 'var(--color-text-secondary)' }}>
                {blocks ? 'blocks runs' : 'limits runs'}
              </span>
            </div>
            {finding.detail && (
              <p style={{ ...muted, margin: '4px 0 0', lineHeight: 1.6,
                          display: 'block' }}>
                {finding.detail}
              </p>
            )}
            {/* Copy it and run it yourself. Aura will not run it for you — nothing
                here is a button that touches your machine. */}
            {(finding.remedy || []).map(command => (
              <CommandLine key={command} command={command} />
            ))}
          </div>
        )
      })}
    </div>
  )
}

/** A setup in flight on the runner's machine. */
function SetupProgress({ setup }: { setup: NonNullable<QaRunner['setup']> }) {
  const known = setup.total > 0
  return (
    <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        <Loader2 size={12} className="animate-spin" color="#4f8ef7" />
        <span style={{ fontWeight: 600 }}>Setting up</span>
        <span style={{ color: 'var(--color-text-secondary)' }}>{setup.step}</span>
        {known && (
          <span style={{ marginLeft: 'auto', fontSize: 11,
                         color: 'var(--color-text-secondary)',
                         fontVariantNumeric: 'tabular-nums' }}>
            {setup.index} of {setup.total}
          </span>
        )}
      </div>
      <ProgressBar progress={known
        ? { known: true, done: setup.index, total: setup.total,
            pct: Math.round((setup.index / setup.total) * 100),
            label: setup.step }
        : { known: false, done: setup.index, label: setup.step }} height={4} />
      <LiveActivity activity={setup.log.map(l => ({ ...l, phase: 'provision' }))}
                    maxHeight={140} />
    </div>
  )
}

/** A command to copy. Three call sites and counting. */
function CommandLine({ command }: { command: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6,
                  border: '1px solid var(--color-border)', borderRadius: 6,
                  padding: '6px 9px', background: 'var(--color-surface-2, transparent)' }}>
      <code style={{ fontSize: 11, flex: 1, overflowX: 'auto', whiteSpace: 'nowrap',
                     fontFamily: 'var(--font-mono, monospace)' }}>{command}</code>
      <button onClick={() => navigator.clipboard?.writeText(command)} style={iconBtn}
              title="Copy">
        <Copy size={12} />
      </button>
    </div>
  )
}

/**
 * Three states, not two. An older agent reports nothing about itself, and rendering a
 * cross for "we did not ask" is the same class of lie this whole change exists to fix
 * — the panel already draws that distinction for containers.
 */
function Capability({ state, icon, label }: {
  state: 'ok' | 'bad' | 'unknown'
  icon: React.ReactNode
  label: string
}) {
  const colour = state === 'ok' ? 'var(--color-text)'
               : state === 'bad' ? '#f59e0b' : 'var(--color-text-secondary)'
  return (
    <span title={state === 'unknown' ? 'this runner does not report its own state' : undefined}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11,
                   color: colour, opacity: state === 'unknown' ? 0.7 : 1 }}>
      {icon}{label}
      {state === 'ok' ? <CheckCircle2 size={11} color="#10b981" />
       : state === 'bad' ? <XCircle size={11} color="#f59e0b" />
       : <HelpCircle size={11} />}
    </span>
  )
}

/**
 * A runner IS running — it just cannot authenticate.
 *
 * This is the single most expensive thing this panel could not say. A rotated key left
 * an agent polling dev every five seconds for four days; every poll was refused, so no
 * runner row was ever written, so the panel said "no runner is connected" — which is
 * true, useless, and points at the wrong problem entirely.
 */
function RejectedKey({ seen }: { seen: { at: string; hint?: string } }) {
  return (
    <div style={{ border: '1px solid rgba(239,68,68,0.35)', borderRadius: 8,
                  background: 'rgba(239,68,68,0.06)', padding: '12px 14px',
                  marginBottom: 12 }}>
      <p style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '0 0 6px',
                  fontSize: 13, fontWeight: 650, color: '#ef4444' }}>
        <AlertTriangle size={13} />
        A runner is connecting, but its API key is being rejected
      </p>
      <p style={{ ...muted, display: 'block', lineHeight: 1.7, margin: '0 0 10px' }}>
        Last refused {seen.at ? new Date(seen.at).toLocaleTimeString() : 'just now'}
        {seen.hint ? <> — the key ended <code>…{seen.hint}</code>.</> : '.'}{' '}
        The key was most likely rotated or revoked. A running agent cannot pick up a new
        one, so it has to be restarted with a fresh key — until then it will keep polling
        and keep being refused.
      </p>
      <CommandLine command="python -m src.qatest.agent --doctor --api <this-host> --key gw-…" />
    </div>
  )
}

function NoRunner({ caps }: { caps: QaCapabilities | null }) {
  // The backend composes these, including the host — repeating them here would be a
  // second place to get out of date. `commands` is structured; scraping the prose for
  // a `python -m` line is the fallback for a backend that predates it, and is exactly
  // the heuristic that broke when the prose gained a second command.
  const commands = caps?.commands?.length ? caps.commands
    : [(caps?.reason || '').split('\n').map(l => l.trim())
         .find(l => l.startsWith('python -m'))
       || 'python -m src.qatest.agent --api <this-host> --key gw-…']
  return (
    <div style={{ border: '1px dashed var(--color-border)', borderRadius: 8, padding: 16 }}>
      <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 6px' }}>
        No local runner is connected.
      </p>
      <p style={{ ...muted, lineHeight: 1.7, margin: '0 0 12px' }}>
        Tests execute locally, on a machine with podman and Chromium — this backend has
        neither, and cannot. Start a runner and it will appear here within a few seconds.
      </p>
      {commands.map(command => <CommandLine key={command} command={command} />)}
    </div>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.07em',
                 color: 'var(--color-text-secondary)', margin: '0 0 10px', fontWeight: 700 }}>
      {children}
    </h3>
  )
}

const muted: React.CSSProperties = {
  fontSize: 12, color: 'var(--color-text-secondary)',
  display: 'flex', alignItems: 'center', gap: 6, margin: 0,
}
const iconBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 26, height: 26, borderRadius: 6, cursor: 'pointer',
  border: '1px solid var(--color-border)', background: 'transparent',
  color: 'var(--color-text)',
}
