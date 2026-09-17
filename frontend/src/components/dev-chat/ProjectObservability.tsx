import { useEffect, useState } from 'react'
import { Activity, ChevronDown, ChevronRight, GitCommit, ExternalLink }
  from 'lucide-react'
import { getProjectChanges, getProjectObservability } from '../../api/devmateView'
import type { ProjectChange, ProjectObservabilityView } from '../../api/devmateView'

/**
 * What this project has actually been doing — traces, spend, and the changes taken.
 *
 * DevMate is where per-project belongs. The estate pages (AI Traces, AI Ops) are
 * operator views over everything and keep that job; what they gain is a filter, not a
 * second identity. Here the project IS the subject, so this is the one place that
 * stitches the three stores together.
 *
 * THE CHANGE LEDGER IS THE POINT. Every decision on a proposed change has been
 * recorded since apply/discard started writing — path, ±lines, who, when, from which
 * conversation — and exactly one reader existed, which turned all of it into a single
 * "Advice applied %" tile. Nothing ever rendered a row. This does.
 *
 * Absent data is reported as absent, never as zero: `degraded` names the sections that
 * could not be read, following the rule `build_devmate_view` already keeps.
 */
export default function ProjectObservability({ projectId }: { projectId: string }) {
  const [view, setView] = useState<ProjectObservabilityView | null>(null)
  const [changes, setChanges] = useState<ProjectChange[] | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    getProjectObservability(projectId)
      .then(v => { if (!cancelled) setView(v) })
      .catch(() => { if (!cancelled) setView(null) })
    return () => { cancelled = true }
  }, [projectId])

  useEffect(() => {
    if (!open || changes !== null) return
    getProjectChanges(projectId)
      .then(r => setChanges(r.changes))
      .catch(() => setChanges([]))
  }, [open, projectId, changes])

  useEffect(() => { setChanges(null); setOpen(false) }, [projectId])

  if (!view) return null

  const degraded = view.degraded || []
  const traces = view.traces || { count: null }

  return (
    <div style={box}>
      <button type="button" onClick={() => setOpen(o => !o)} style={header}>
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <Activity size={11} />
        <span style={{ fontWeight: 600 }}>Observability</span>
        <span style={{ flex: 1 }} />
        <Stat label="traces" value={traces.count}
              note={traces.exact === false ? 'recent' : ''}
              missing={degraded.includes('traces')} />
        <Stat label="errors" value={traces.errorRate} unit="%"
              missing={degraded.includes('traces')} />
        {!view.spend?.restricted && (
          <Stat label="spend" value={view.spend?.costUsd} prefix="$"
                missing={degraded.includes('spend')} />
        )}
        <a href={`/ai-observability?tab=traces&projectId=${encodeURIComponent(projectId)}`}
           onClick={e => e.stopPropagation()}
           style={link}>traces <ExternalLink size={9} /></a>
      </button>

      {open && (
        <div style={{ padding: '4px 10px 10px' }}>
          {degraded.length > 0 && (
            <div style={{ ...hint, color: '#f59e0b', marginBottom: 6 }}>
              Could not read: {degraded.join(', ')}. Those figures are missing, not zero.
            </div>
          )}

          <div style={{ ...hint, marginBottom: 4 }}>Changes DevMate proposed</div>
          {changes === null && <div style={hint}>Loading…</div>}
          {changes !== null && changes.length === 0 && (
            <div style={hint}>
              No change has been applied or discarded for this project yet.
            </div>
          )}
          {(changes || []).map(change => (
            <div key={change.proposalId} style={row}>
              <span style={{
                ...pill,
                color: change.decision === 'applied' ? '#10b981' : '#94a3b8',
              }}>{change.decision}</span>
              <code style={{ fontSize: 'var(--text-caption)' }}>{change.path}</code>
              <span style={hint}>
                +{change.additions} −{change.deletions}
              </span>
              <span style={{ flex: 1 }} />
              {change.commitSha
                ? <span style={{ ...hint, display: 'flex', alignItems: 'center', gap: 3 }}
                        title={change.commitSha}>
                    <GitCommit size={9} />{change.commitSha.slice(0, 7)}
                  </span>
                // Honest: the row predates commit recording, or it was never committed.
                : <span style={hint}>not linked to a commit</span>}
              {change.prUrl && (
                <a href={change.prUrl} target="_blank" rel="noreferrer" style={link}>
                  PR <ExternalLink size={9} />
                </a>
              )}
              {change.href && <a href={change.href} style={link}>conversation</a>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, unit = '', prefix = '', note = '', missing = false }: {
  label: string; value: number | null | undefined
  unit?: string; prefix?: string; note?: string; missing?: boolean
}) {
  // `unavailable` and `0` mean opposite things and must not render the same.
  const text = missing ? 'unavailable'
    : value === null || value === undefined ? '—'
      : `${prefix}${value}${unit}`
  return (
    <span style={{ ...hint, marginRight: 8 }}>
      {label} <strong style={{ opacity: missing ? 0.5 : 1 }}>{text}</strong>
      {note && <span style={{ opacity: 0.5 }}> ({note})</span>}
    </span>
  )
}

const box: React.CSSProperties = {
  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-caption)',
}
const header: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, width: '100%',
  padding: '6px 10px', background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--color-text)', fontSize: 'var(--text-caption)', textAlign: 'left',
}
const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0',
  borderTop: '1px solid var(--color-border)',
}
const pill: React.CSSProperties = { fontSize: 'var(--text-label)', textTransform: 'uppercase',
                                    letterSpacing: 0.4, minWidth: 54 }
const hint: React.CSSProperties = { fontSize: 'var(--text-label)', opacity: 0.7 }
const link: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 3,
                                    color: '#6366f1', textDecoration: 'none',
                                    fontSize: 'var(--text-label)' }
