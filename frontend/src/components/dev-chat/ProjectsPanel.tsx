import { useState, useEffect, useCallback } from 'react'
import {
  FolderOpen, Plus, Search, Clock, GitBranch, RefreshCw,
  X, ChevronRight, Loader2,
} from 'lucide-react'
import { projectsApi, type Project } from '../../api/projects'
import CreateProjectWizard, { type WizardResult } from './CreateProjectWizard'

export type { WizardResult }

interface ProjectsPanelProps {
  onSelect: (project: Project) => void
  selectedId?: string
  onCreateNew?: (result: WizardResult) => void
}

const STATUS_CONFIG: Record<string, { color: string; label: string; pulse?: boolean }> = {
  pending:           { color: 'var(--color-warning)',  label: 'Pending' },
  analyzing:         { color: '#3b82f6',               label: 'Analyzing', pulse: true },
  analyzed:          { color: 'var(--color-success)',  label: 'Analyzed' },
  CODE_CHANGES_DONE: { color: 'var(--color-accent)',   label: 'Done' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { color: 'var(--color-muted)', label: status }
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
      background: `${cfg.color}22`, color: cfg.color, border: `1px solid ${cfg.color}44`,
      textTransform: 'uppercase', letterSpacing: '0.5px',
      animation: cfg.pulse ? 'panel-pulse 1.8s ease-in-out infinite' : 'none',
    }}>
      {cfg.label}
    </span>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })
}

// ── Main ProjectsPanel ────────────────────────────────────────────────────────
export default function ProjectsPanel({ onSelect, selectedId, onCreateNew }: ProjectsPanelProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)

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

      <div style={{
        display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0,
        background: 'var(--color-surface)',
      }}>
        {/* Panel header */}
        <div style={{ padding: '14px 14px 10px', flexShrink: 0, borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <FolderOpen size={15} style={{ color: 'var(--color-primary)' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>Projects</span>
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
                  padding: '4px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600,
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
            padding: '6px 10px', borderRadius: 8,
            background: 'var(--color-card)', border: '1px solid var(--color-border)',
          }}>
            <Search size={12} style={{ color: 'var(--color-muted)', flexShrink: 0 }} />
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter projects..."
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontSize: 12, color: 'var(--color-text)',
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24, color: 'var(--color-muted)', fontSize: 12 }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--color-muted)', fontSize: 12 }}>
              <FolderOpen size={22} style={{ margin: '0 auto 8px', opacity: 0.35, display: 'block' }} />
              {filter ? 'No matching projects' : 'No projects yet'}
            </div>
          ) : (
            filtered.map(p => (
              <button
                key={p.projectId}
                type="button"
                onClick={() => onSelect(p)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '9px 10px', borderRadius: 8, marginBottom: 3,
                  background: p.projectId === selectedId ? 'var(--color-primary)15' : 'none',
                  border: `1px solid ${p.projectId === selectedId ? 'var(--color-primary)' : 'transparent'}`,
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  if (p.projectId !== selectedId) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-card)'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)'
                  }
                }}
                onMouseLeave={e => {
                  if (p.projectId !== selectedId) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'none'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'
                  }
                }}
              >
                {/* Icon */}
                <div style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  background: p.projectId === selectedId ? 'var(--color-primary)' : 'var(--color-card)',
                  border: `1px solid ${p.projectId === selectedId ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, color: p.projectId === selectedId ? '#fff' : 'var(--color-subtext)',
                }}>
                  {p.name.charAt(0).toUpperCase()}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: 'var(--color-text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    marginBottom: 3,
                  }}>
                    {p.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    <StatusBadge status={p.status} />
                    {p.environment && (
                      <span style={{ fontSize: 9, color: 'var(--color-muted)', fontWeight: 500 }}>
                        {p.environment}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                    <Clock size={9} style={{ color: 'var(--color-muted)' }} />
                    <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>{formatDate(p.createdAt)}</span>
                    {p.repoCount > 0 && (
                      <>
                        <span style={{ color: 'var(--color-border)', fontSize: 9 }}>·</span>
                        <GitBranch size={9} style={{ color: 'var(--color-muted)' }} />
                        <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>{p.repoCount}</span>
                      </>
                    )}
                  </div>
                </div>

                <ChevronRight size={12} style={{ color: 'var(--color-muted)', flexShrink: 0, marginTop: 7 }} />
              </button>
            ))
          )}
        </div>
      </div>

      <style>{`
        @keyframes panel-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </>
  )
}
