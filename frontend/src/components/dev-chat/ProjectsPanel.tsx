import { useState, useEffect, useCallback } from 'react'
import {
  FolderOpen, Plus, Search, Clock, GitBranch, RefreshCw,
  X, ChevronRight, Loader2, Trash2,
} from 'lucide-react'
import { projectsApi, type Project } from '../../api/projects'
import CreateProjectWizard, { type WizardResult } from './CreateProjectWizard'
import ConfirmDeleteDialog from '../ui/ConfirmDeleteDialog'

export type { WizardResult }

interface ProjectsPanelProps {
  onSelect: (project: Project) => void
  selectedId?: string
  onCreateNew?: (result: WizardResult) => void
  /** A project was deleted. The panel refreshes itself; this exists so the PAGE can
   *  drop whatever it was holding about it — the open chat, the knowledge graph, the
   *  poller keyed on its id. Without it the page keeps rendering a project that is
   *  gone. */
  onDeleted?: (projectId: string) => void
}

/**
 * Status to a shipped badge variant.
 *
 * This used to carry a colour per status and build the badge from
 * `` `${cfg.color}22` ``. Once those colours became design tokens that produced
 * the literal string `var(--color-warning)22`, which is not a colour — so
 * `pending`, `analyzed` and `Done` rendered with no background and no border,
 * and only `analyzing` (which had kept a raw hex) ever looked right.
 *
 * String-concatenated alpha and CSS custom properties cannot coexist. The badge
 * skins in index.css already solve this, per variant, in every theme.
 */
const STATUS_BADGE: Record<string, { variant: string; label: string }> = {
  pending:           { variant: 'warning', label: 'Pending' },
  analyzing:         { variant: 'info',    label: 'Analyzing' },
  analyzed:          { variant: 'success', label: 'Analyzed' },
  CODE_CHANGES_DONE: { variant: 'primary', label: 'Done' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] ?? { variant: 'default', label: status }
  return (
    <span className={`ov-badge badge-${cfg.variant}`}
          style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {cfg.label}
    </span>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })
}

// ── Main ProjectsPanel ────────────────────────────────────────────────────────
export default function ProjectsPanel({ onSelect, selectedId, onCreateNew,
                                       onDeleted }: ProjectsPanelProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [doomed, setDoomed] = useState<Project | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await projectsApi.list()
      setProjects(res.data)
    } catch {
      // silently fail — list will be empty
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = projects.filter(p =>
    !filter || p.name.toLowerCase().includes(filter.toLowerCase()) || p.environment?.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <>
      {showCreate && (
        <CreateProjectWizard
          onClose={() => setShowCreate(false)}
          onComplete={result => {
            setShowCreate(false)
            onCreateNew?.(result)
          }}
        />
      )}

      {doomed && (
        <ConfirmDeleteDialog
          projectId={doomed.projectId}
          projectName={doomed.name}
          onCancel={() => setDoomed(null)}
          onDeleted={id => {
            setDoomed(null)
            // Drop it locally at once rather than waiting for the refetch, so the row
            // cannot be clicked in the gap.
            setProjects(prev => prev.filter(x => x.projectId !== id))
            onDeleted?.(id)
            load()
          }}
        />
      )}

      <div style={{
        display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0,
        background: 'var(--color-surface)',
      }}>
        {/* Panel header */}
        <div style={{ padding: '14px 14px 10px', flexShrink: 0, borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <FolderOpen size={15} style={{ color: 'var(--color-primary)' }} />
              <span style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--color-text)' }}>Projects</span>
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              <button
                type="button"
                onClick={load}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: 3, display: 'flex' }}
                title="Refresh"
              >
                <RefreshCw size={12} />
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 9px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-caption)', fontWeight: 600,
                  background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer',
                }}
              >
                <Plus size={11} /> New
              </button>
            </div>
          </div>

          {/* Search filter */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', borderRadius: 'var(--radius-sm)',
            background: 'var(--color-card)', border: '1px solid var(--color-border)',
          }}>
            <Search size={12} style={{ color: 'var(--color-muted)', flexShrink: 0 }} />
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter projects..."
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontSize: 'var(--text-body)', color: 'var(--color-text)',
              }}
            />
            {filter && (
              <button type="button" onClick={() => setFilter('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: 0, display: 'flex' }}>
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Project list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24, color: 'var(--color-muted)', fontSize: 'var(--text-body)' }}>
              <Loader2 size={14} className="animate-spin" /> Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--color-muted)', fontSize: 'var(--text-body)' }}>
              <FolderOpen size={22} style={{ margin: '0 auto 8px', opacity: 0.35, display: 'block' }} />
              {filter ? 'No matching projects' : 'No projects yet'}
            </div>
          ) : (
            filtered.map(p => (
              // A <div role="button">, not a <button>: nesting the delete control
              // inside a button is invalid HTML and the inner click never fires.
              <div
                key={p.projectId}
                role="button"
                tabIndex={0}
                className="proj-row"
                onClick={() => onSelect(p)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelect(p) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '9px 10px', borderRadius: 'var(--radius-sm)', marginBottom: 3,
                  background: p.projectId === selectedId
                    ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)'
                    : 'none',
                  border: `1px solid ${p.projectId === selectedId ? 'var(--color-primary)' : 'transparent'}`,
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  if (p.projectId !== selectedId) {
                    (e.currentTarget as HTMLDivElement).style.background = 'var(--color-card)'
                    ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border)'
                  }
                }}
                onMouseLeave={e => {
                  if (p.projectId !== selectedId) {
                    (e.currentTarget as HTMLDivElement).style.background = 'none'
                    ;(e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'
                  }
                }}
              >
                {/* Icon */}
                <div style={{
                  width: 28, height: 28, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                  background: p.projectId === selectedId ? 'var(--color-primary)' : 'var(--color-card)',
                  border: `1px solid ${p.projectId === selectedId ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--text-caption)', fontWeight: 800, color: p.projectId === selectedId ? '#fff' : 'var(--color-subtext)',
                }}>
                  {p.name.charAt(0).toUpperCase()}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--color-text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    marginBottom: 3,
                  }}>
                    {p.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    <StatusBadge status={p.status} />
                    {p.environment && (
                      <span style={{ fontSize: 'var(--text-label)', color: 'var(--color-muted)', fontWeight: 500 }}>
                        {p.environment}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                    <Clock size={9} style={{ color: 'var(--color-muted)' }} />
                    <span style={{ fontSize: 'var(--text-label)', color: 'var(--color-muted)' }}>{formatDate(p.createdAt)}</span>
                    {p.repoCount > 0 && (
                      <>
                        <span style={{ color: 'var(--color-border)', fontSize: 'var(--text-label)' }}>·</span>
                        <GitBranch size={9} style={{ color: 'var(--color-muted)' }} />
                        <span style={{ fontSize: 'var(--text-label)', color: 'var(--color-muted)' }}>{p.repoCount}</span>
                      </>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  className="proj-del"
                  title={`Delete ${p.name}`}
                  onClick={e => { e.stopPropagation(); setDoomed(p) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer',
                           padding: 3, color: '#ef4444', flexShrink: 0, marginTop: 5,
                           opacity: 0, transition: 'opacity 0.15s' }}>
                  <Trash2 size={12} />
                </button>

                <ChevronRight size={12} style={{ color: 'var(--color-muted)', flexShrink: 0, marginTop: 7 }} />
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        .proj-row:hover .proj-del { opacity: 1 !important; }
      `}</style>
    </>
  )
}
