import { Circle } from 'lucide-react'
import type { QaRunner } from '../../api/qa'

/**
 * The one-line answer to "can anything run right now, and is anything running".
 *
 * Sits in the page header on every tab, which is what makes the Floci state ambient
 * rather than something you have to go and look for.
 */
export default function RunnerStatusChip({ runners, onClick }: {
  runners: QaRunner[]
  onClick: () => void
}) {
  const online = runners.filter(r => r.online)
  const containers = online.reduce((n, r) => n + (r.containers?.length || 0), 0)
  const connected = online.length > 0
  const unhealthy = online.some(r => r.health && !r.health.ok)
  const colour = !connected ? 'var(--color-text-secondary)'
               : unhealthy ? '#f59e0b' : '#10b981'

  const setting = online.filter(r => r.setup?.active).length
  const problems = online.reduce(
    (n, r) => n + (r.health && !r.health.ok ? r.health.findings.length : 0), 0)

  const label = !connected
    ? 'No runner connected'
    : setting
      ? `${online.length === 1 ? online[0].name : `${setting} runners`} · setting up…`
      : [online.length === 1 ? online[0].name : `${online.length} runners`,
         online.every(r => r.podman) ? 'podman ✓' : 'no podman',
         containers ? `${containers} container${containers === 1 ? '' : 's'}` : null,
         problems ? `${problems} problem${problems === 1 ? '' : 's'}` : null,
        ].filter(Boolean).join(' · ')

  return (
    <button onClick={onClick} title="Show the runner and its Floci containers"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                     fontSize: 11, padding: '5px 10px', borderRadius: 999,
                     border: '1px solid var(--color-border)', background: 'transparent',
                     color: 'var(--color-text-secondary)', cursor: 'pointer',
                     maxWidth: 320, overflow: 'hidden', whiteSpace: 'nowrap',
                     textOverflow: 'ellipsis' }}>
      <Circle size={8} fill={colour} color={colour} />
      {label}
    </button>
  )
}
