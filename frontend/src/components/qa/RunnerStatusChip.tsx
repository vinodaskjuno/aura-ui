import { Circle } from 'lucide-react'
import type { QaRunner } from '../../api/qa'
import { localState, runnerLabel } from './useQaRunners'

/**
 * The one-line answer to "where do tests run, and is anything running right now".
 *
 * Sits in the page header on every tab, which is what makes the local machine ambient
 * rather than something you have to go and look for.
 *
 * Two things this has to say that the previous version did not. First the word LOCAL:
 * QualityMind executes on a self-hosted machine and never in the cloud, and a chip
 * reading `vinoth/qa-runner · podman ✓` states neither of those. Second, whether
 * anything is happening — it used to render identically whether a podman container was
 * live on someone's desk or the machine had been idle all afternoon, so the dot pulses
 * only while a run is actually in flight.
 */
export default function RunnerStatusChip({ runners, you, onClick }: {
  runners: QaRunner[]
  you?: string
  onClick: () => void
}) {
  const { online, connected, busy, containers, unhealthy, settingUp } =
    localState(runners)

  const colour = !connected ? 'var(--color-text-secondary)'
               : unhealthy ? '#f59e0b' : '#10b981'
  const problems = online.reduce(
    (n, r) => n + (r.health && !r.health.ok ? r.health.findings.length : 0), 0)

  // One machine is the normal case and gets named. Several is rare enough that a count
  // reads better than a truncated list.
  const where = online.length === 1 ? runnerLabel(online[0], you)
                                    : `${online.length} local machines`

  const label = !connected
    ? 'No local runner — tests cannot run'
    : settingUp.length
      ? `${where} · setting up…`
      : busy.length
        // What is true at this instant leads. The machine name still follows, because
        // "running locally" without saying where is only half an answer.
        ? [`Floci running locally`, where,
           containers ? `${containers} container${containers === 1 ? '' : 's'}` : null,
          ].filter(Boolean).join(' · ')
        : ['Floci ready', 'local', where,
           online.every(r => r.podman) ? null : 'no podman',
           problems ? `${problems} problem${problems === 1 ? '' : 's'}` : null,
          ].filter(Boolean).join(' · ')

  return (
    <button onClick={onClick} title="Show the local machine and its Floci containers"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                     fontSize: 11, padding: '5px 10px', borderRadius: 999,
                     border: '1px solid var(--color-border)', background: 'transparent',
                     color: 'var(--color-text-secondary)', cursor: 'pointer',
                     maxWidth: 420, overflow: 'hidden', whiteSpace: 'nowrap',
                     textOverflow: 'ellipsis' }}>
      {/* Pulsing ONLY while a run is in flight. A dot that always pulses says nothing;
          reusing .pulse-dot also picks up the reduced-motion rule for free. */}
      {busy.length && !unhealthy ? (
        <span className="pulse-dot" aria-hidden
              style={{ background: colour, flexShrink: 0 }} />
      ) : (
        <Circle size={8} fill={colour} color={colour} style={{ flexShrink: 0 }} />
      )}
      {label}
    </button>
  )
}
