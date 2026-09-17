import { useCallback, useEffect, useState } from 'react'
import { qaApi } from '../../api/qa'
import type { QaAppSession, QaRunner } from '../../api/qa'
import { getIngestStatus } from '../../api/aiObservability'
import { getProjectObservability } from '../../api/devmateView'
import { useDevmateRailStore } from '../../store/devmateRailStore'
import type { RailTab } from '../../store/devmateRailStore'

/**
 * One line that says everything the rail would say, when the rail is closed.
 *
 * This is the whole justification for moving four panels off the page. Detail in a
 * rail is fine; detail that DISAPPEARS is not, and a reader who has to open a panel to
 * discover that nothing is wrong will stop opening it. So every segment here reports a
 * state, and clicking one opens the rail on the tab that explains it.
 *
 * ABSENT IS NOT ZERO. A segment whose source could not be read says `unavailable`,
 * never `0` — the same rule `ui/Metric` enforces and `role_metrics` enforces on the
 * wire. "0 traces" and "we could not ask about traces" mean opposite things to
 * somebody deciding whether their instrumentation works.
 */
const POLL_MS = 15000       // the runner reports every ~15s; faster just re-reads a row

type Tone = 'ok' | 'warn' | 'bad' | 'idle' | 'absent'

const TONE: Record<Tone, string> = {
  ok: 'var(--color-success)',
  warn: 'var(--color-warning)',
  bad: 'var(--color-danger)',
  idle: 'var(--color-muted)',
  absent: 'var(--color-muted)',
}

interface Segment {
  key: string
  glyph: string
  text: string
  tone: Tone
  tab: RailTab
  title: string
}

export default function ProjectStatusStrip({ projectId, runners, you }: {
  projectId: string
  runners: QaRunner[]
  you?: string
}) {
  const show = useDevmateRailStore(s => s.show)
  const [apps, setApps] = useState<QaAppSession[] | null>(null)
  const [telemetry, setTelemetry] = useState<{ state: string; detail?: string } | null>(null)
  const [obs, setObs] = useState<Awaited<ReturnType<typeof getProjectObservability>> | null>(null)
  const [failed, setFailed] = useState<Set<string>>(new Set())

  const refresh = useCallback(async () => {
    const bad = new Set<string>()
    await Promise.all([
      qaApi.appState(projectId).then(r => setApps(r.data.apps || []))
        .catch(() => { bad.add('apps'); setApps(null) }),
      getIngestStatus(projectId).then(setTelemetry)
        .catch(() => { bad.add('telemetry'); setTelemetry(null) }),
      getProjectObservability(projectId).then(setObs)
        .catch(() => { bad.add('checks'); setObs(null) }),
    ])
    setFailed(bad)
  }, [projectId])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, POLL_MS)
    return () => clearInterval(timer)
  }, [refresh])

  const mine = runners.find(r => r.online && r.owner && you && r.owner === you)
  const containers = (mine?.containers || []).filter(c => c.name.startsWith('aura-dev-'))
  const running = (apps || []).filter(a => !a.stale)

  const segments: Segment[] = []

  // ── Emulators ──
  segments.push(
    containers.length
      ? { key: 'floci', glyph: '●', tone: 'ok', tab: 'env',
          text: `Floci ${containers.map(c => c.cloud || '').filter(Boolean).join(' ') || 'running'}`,
          title: 'Cloud emulators are running on your machine.' }
      : { key: 'floci', glyph: '○', tone: 'idle', tab: 'env', text: 'Floci stopped',
          title: 'No cloud emulator is running. Start one from the Environment tab.' })

  // ── The app itself ──
  if (failed.has('apps')) {
    segments.push({ key: 'app', glyph: '◌', tone: 'absent', tab: 'env',
                    text: 'run state unavailable',
                    title: 'Could not read the runner state — this is not the same as "not running".' })
  } else if (running.length) {
    const first = running[0]
    segments.push({ key: 'app', glyph: '▶', tone: first.healthy ? 'ok' : 'warn', tab: 'env',
                    text: first.healthy ? `running :${first.port}` : 'running, not answering',
                    title: `${first.kind} on ${first.runner}` })
  } else {
    segments.push({ key: 'app', glyph: '▶', tone: 'idle', tab: 'env', text: 'not running',
                    title: 'This project is not running locally.' })
  }

  // ── Policy ──
  const policy = obs?.checks
  if (failed.has('checks')) {
    segments.push({ key: 'policy', glyph: '◌', tone: 'absent', tab: 'checks',
                    text: 'checks unavailable',
                    title: 'Could not read policy findings.' })
  } else if (policy?.findings) {
    segments.push({ key: 'policy', glyph: '⚠', tone: 'warn', tab: 'checks',
                    text: `${policy.findings} finding${policy.findings > 1 ? 's' : ''}`,
                    title: 'NIST 800-53 findings against this project’s IaC.' })
  } else if (policy) {
    segments.push({ key: 'policy', glyph: '✓', tone: 'ok', tab: 'checks',
                    text: `${policy.resources ?? 0} passing`, title: 'No policy findings.' })
  }

  // ── Telemetry ──
  const traces = obs?.traces?.count
  if (telemetry?.state === 'key-refused') {
    segments.push({ key: 'traces', glyph: '⊘', tone: 'bad', tab: 'checks',
                    text: 'telemetry key refused',
                    title: telemetry.detail || 'A telemetry credential was rejected; its spans were dropped.' })
  } else if (failed.has('telemetry') || failed.has('checks') || traces === null || traces === undefined) {
    segments.push({ key: 'traces', glyph: '◌', tone: 'absent', tab: 'checks',
                    text: 'traces unavailable',
                    title: 'Could not read the trace store. This is not the same as zero traces.' })
  } else {
    segments.push({ key: 'traces', glyph: traces ? '◉' : '◌',
                    tone: traces ? 'ok' : 'idle', tab: 'checks',
                    text: `${traces} trace${traces === 1 ? '' : 's'}`,
                    title: telemetry?.detail || 'Traces recorded for this project.' })
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', flexWrap: 'wrap',
      gap: 'var(--space-1)', padding: '4px 0', flexShrink: 0,
      fontSize: 'var(--text-caption)',
    }}>
      {segments.map((seg, i) => (
        <span key={seg.key} style={{ display: 'flex', alignItems: 'center' }}>
          {i > 0 && (
            <span aria-hidden style={{ color: 'var(--color-border)', padding: '0 6px' }}>·</span>
          )}
          <button
            type="button"
            onClick={() => show(seg.tab)}
            title={seg.title}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'none', border: 'none', padding: '2px 4px',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              fontSize: 'inherit', color: 'var(--color-subtext)',
            }}
          >
            <span aria-hidden style={{ color: TONE[seg.tone] }}>{seg.glyph}</span>
            <span style={{ color: seg.tone === 'absent' ? 'var(--color-muted)' : undefined,
                           fontStyle: seg.tone === 'absent' ? 'italic' : undefined }}>
              {seg.text}
            </span>
          </button>
        </span>
      ))}
    </div>
  )
}
