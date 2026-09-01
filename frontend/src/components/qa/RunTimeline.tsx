import {
  CheckCircle2, XCircle, Loader, Circle, MinusCircle, AlertTriangle, ListChecks,
  Cloud, Server, Camera, Database, Network, Flag,
} from 'lucide-react'

/**
 * Live progress of a run, as a timeline of stages with per-stage status.
 *
 * The stages are DERIVED from the event stream, not a fixed list, because what a run
 * does depends on the project: one with no cloud dependency starts no emulators, and
 * one with only a backend starts no UI. A fixed five-step bar would show those as
 * completed work that never happened.
 *
 * Rows come from structured event fields rather than parsed prose — the wording of a
 * progress message is not an interface.
 */

export interface RunEvent {
  type: string
  message?: string
  // planned
  cases?: number
  emulators?: string[]
  // emulator
  cloud?: string
  started?: boolean
  // app
  stage?: string
  kind?: string
  name?: string
  url?: string
  port?: number
  error?: string
  apps?: { kind: string; name: string; port: number; blocked: string }[]
  // step
  index?: number
  action?: string
  status?: string
  // done
  passed?: number
  failed?: number
  skipped?: number
  durationMs?: number
  reason?: string
}

// `skipped` means "this stage did not apply" — no cloud dependencies, say.
// `blocked` means "this could not run", which is a different thing entirely and was
// previously shown with the same "not needed" label: a run that failed to start read
// as work that was deliberately unnecessary.
type State = 'pending' | 'active' | 'done' | 'failed' | 'skipped' | 'blocked'

interface Row { text: string; state: State; hint?: string }
interface Stage { id: string; label: string; icon: React.ReactNode; state: State; detail?: string; rows: Row[] }

const ICON: Record<string, React.ReactNode> = {
  plan:     <ListChecks size={13} />,
  emulator: <Cloud size={13} />,
  app:      <Server size={13} />,
  running:  <Camera size={13} />,
  evidence: <Database size={13} />,
  graph:    <Network size={13} />,
  done:     <Flag size={13} />,
}

const LABEL: Record<string, string> = {
  plan:     'Plan from the knowledge graph',
  emulator: 'Cloud emulators',
  app:      'Start the application',
  running:  'Execute and capture',
  evidence: 'Store evidence in S3',
  graph:    'Write results back',
  done:     'Finished',
}

const ORDER = ['plan', 'emulator', 'app', 'running', 'evidence', 'graph', 'done']

/** Fold the event stream into stages. Pure, so it is trivially testable and the view
 *  cannot drift from the events. */
export function toStages(events: RunEvent[]): Stage[] {
  const stages = new Map<string, Stage>()
  const ensure = (id: string): Stage => {
    if (!stages.has(id)) {
      stages.set(id, { id, label: LABEL[id] ?? id, icon: ICON[id], state: 'active', rows: [] })
    }
    return stages.get(id)!
  }
  const close = (id: string, state: State = 'done') => {
    const s = stages.get(id)
    if (s && s.state === 'active') s.state = state
  }

  for (const ev of events) {
    switch (ev.type) {
      case 'plan':
        ensure('plan').detail = ev.message
        break

      case 'planned': {
        const plan = ensure('plan')
        plan.detail = ev.message
        plan.state = 'done'
        plan.rows = [{ text: `${ev.cases ?? 0} case(s) from the graph`, state: 'done' }]
        // Only now is it known whether emulators apply at all.
        const emu = ensure('emulator')
        if (!ev.emulators?.length) {
          emu.state = 'skipped'
          emu.detail = 'No cloud dependencies — nothing to emulate'
        } else {
          emu.state = 'active'
          emu.rows = ev.emulators.map(c => ({ text: c, state: 'pending' as State }))
        }
        break
      }

      case 'emulator': {
        const emu = ensure('emulator')
        const row = emu.rows.find(r => r.text === ev.cloud || r.text.startsWith(`${ev.cloud} `))
        const text = ev.started ? `${ev.cloud} ready` : `${ev.cloud} failed`
        if (row) { row.text = text; row.state = ev.started ? 'done' : 'failed'; row.hint = ev.message }
        else emu.rows.push({ text, state: ev.started ? 'done' : 'failed', hint: ev.message })
        if (emu.rows.every(r => r.state !== 'pending')) {
          emu.state = emu.rows.some(r => r.state === 'failed') ? 'failed' : 'done'
        }
        break
      }

      case 'app': {
        const app = ensure('app')
        if (ev.stage === 'detect') {
          app.detail = ev.message
          app.rows = (ev.apps ?? []).map(a => ({
            text: `${a.kind} (${a.name})`,
            state: a.blocked ? 'failed' : 'pending',
            hint: a.blocked || undefined,
          }))
          if (!ev.apps?.length) app.state = 'failed'
        } else if (ev.kind) {
          const row = app.rows.find(r => r.text.startsWith(`${ev.kind} `))
          const text = ev.started ? `${ev.kind} on ${ev.url}` : `${ev.kind} not started`
          if (row) { row.text = text; row.state = ev.started ? 'done' : 'failed'; row.hint = ev.error }
          else app.rows.push({ text, state: ev.started ? 'done' : 'failed', hint: ev.error })
        }
        break
      }

      case 'running': {
        // A URL was supplied, so nothing was started — say so rather than leaving an
        // empty stage that looks unfinished.
        const app = stages.get('app')
        if (!app) { const s = ensure('app'); s.state = 'skipped'; s.detail = 'Testing an already-running instance' }
        else if (app.state === 'active') {
          app.state = app.rows.some(r => r.state === 'done') ? 'done'
            : app.rows.some(r => r.state === 'failed') ? 'failed' : 'done'
        }
        close('emulator')
        ensure('running').detail = ev.message
        break
      }

      case 'step': {
        const run = ensure('running')
        run.rows.push({
          text: ev.action ?? `step ${ev.index}`,
          state: ev.status === 'passed' ? 'done'
            : ev.status === 'failed' ? 'failed' : 'skipped',
        })
        break
      }

      case 'evidence':
        close('running')
        ensure('evidence').detail = ev.message
        close('evidence')
        break

      case 'graph':
        ensure('graph').detail = ev.message
        close('graph')
        break

      case 'done': {
        close('running'); close('app'); close('emulator')
        const d = ensure('done')
        d.state = ev.status === 'failed' ? 'failed'
          : ev.status === 'unavailable' ? 'blocked' : 'done'
        d.detail = ev.status === 'unavailable'
          ? (ev.reason || ev.message || 'Could not run')
          : `${ev.passed ?? 0} passed · ${ev.failed ?? 0} failed · ${ev.skipped ?? 0} skipped`
            + (ev.durationMs ? ` · ${(ev.durationMs / 1000).toFixed(1)}s` : '')
        break
      }

      case 'error': {
        const d = ensure('done')
        d.state = 'failed'
        d.detail = ev.message
        break
      }
    }
  }

  return ORDER.filter(id => stages.has(id)).map(id => stages.get(id)!)
}

const LOOK: Record<State, { color: string; icon: React.ReactNode }> = {
  pending: { color: 'var(--color-muted)',   icon: <Circle size={13} /> },
  active:  { color: 'var(--color-primary)', icon: <Loader size={13} className="animate-spin" /> },
  done:    { color: '#10b981',              icon: <CheckCircle2 size={13} /> },
  failed:  { color: '#ef4444',              icon: <XCircle size={13} /> },
  skipped: { color: '#94a3b8',              icon: <MinusCircle size={13} /> },
  blocked: { color: '#f59e0b',              icon: <AlertTriangle size={13} /> },
}

const TAG: Partial<Record<State, { text: string; color: string }>> = {
  skipped: { text: 'not needed',  color: '#94a3b8' },
  blocked: { text: 'could not run', color: '#f59e0b' },
}

export default function RunTimeline({ events }: { events: RunEvent[] }) {
  const stages = toStages(events)
  if (!stages.length) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 16 }}>
      {stages.map((stage, i) => {
        const look = LOOK[stage.state]
        const last = i === stages.length - 1
        return (
          <div key={stage.id} style={{ display: 'grid', gridTemplateColumns: '22px 1fr',
            columnGap: 11, minWidth: 0 }}>
            {/* Rail */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ color: look.color, display: 'flex', marginTop: 2 }}>{look.icon}</span>
              {!last && <span style={{ flex: 1, width: 1, background: 'var(--color-border)',
                margin: '3px 0' }} />}
            </div>

            <div style={{ paddingBottom: last ? 0 : 14, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12.5, fontWeight: 600,
                  color: stage.state === 'pending' ? 'var(--color-muted)' : 'var(--color-text)' }}>
                  {stage.label}
                </span>
                {TAG[stage.state] && (
                  <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em',
                    color: TAG[stage.state]!.color }}>{TAG[stage.state]!.text}</span>
                )}
              </div>

              {stage.detail && (
                <div style={{ fontSize: 11.5, color: 'var(--color-subtext)', marginTop: 2,
                  lineHeight: 1.5, wordBreak: 'break-word' }}>{stage.detail}</div>
              )}

              {stage.rows.length > 0 && (
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3,
                  maxHeight: 210, overflowY: 'auto' }}>
                  {stage.rows.map((row, j) => {
                    const rl = LOOK[row.state]
                    return (
                      <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 7,
                        fontSize: 11.5, color: 'var(--color-subtext)', minWidth: 0 }}>
                        <span style={{ color: rl.color, display: 'flex', flexShrink: 0,
                          marginTop: 1 }}>{rl.icon}</span>
                        <span style={{ minWidth: 0, wordBreak: 'break-word' }}>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>{row.text}</span>
                          {row.hint && (
                            <span style={{ display: 'block', color: '#f59e0b', marginTop: 1 }}>
                              {row.hint}
                            </span>
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
