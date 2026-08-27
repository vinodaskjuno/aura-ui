import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  FolderOpen, Download, FolderGit2, ScanSearch, ScanLine, Code2,
  GitPullRequest, FlaskConical, CheckCircle2, AlertCircle,
  CirclePlay, BarChart3, Search, Filter, GitFork,
  type LucideIcon,
} from 'lucide-react'

// ── Pulse keyframes injection ─────────────────────────────────────────────────
const PULSE_STYLE_ID = 'qa-status-pulse'
if (typeof document !== 'undefined' && !document.getElementById(PULSE_STYLE_ID)) {
  const el = document.createElement('style')
  el.id = PULSE_STYLE_ID
  el.textContent = `@keyframes statusPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`
  document.head.appendChild(el)
}

// ── Status taxonomy ───────────────────────────────────────────────────────────
interface StatusCfg {
  label: string
  color: string
  pulse: boolean
  icon: LucideIcon
  highlight?: boolean
}

const QA_STATUS_CONFIG: Record<string, StatusCfg> = {
  CREATED:                  { label: 'Created',            color: '#6b7280', pulse: false, icon: FolderOpen },
  CLONING:                  { label: 'Cloning Repo',       color: '#3b82f6', pulse: true,  icon: Download },
  CLONED:                   { label: 'Repo Cloned',        color: '#06b6d4', pulse: false, icon: FolderGit2 },
  ANALYSING:                { label: 'Analysing Code',     color: '#f59e0b', pulse: true,  icon: ScanSearch },
  ANALYSED:                 { label: 'Analysis Complete',  color: '#10b981', pulse: false, icon: ScanLine },
  CODE_CHANGES_IN_PROGRESS: { label: 'Development Active', color: '#8b5cf6', pulse: true,  icon: Code2 },
  CODE_CHANGES_DONE:        { label: 'Ready for QA',       color: '#10b981', pulse: false, icon: GitPullRequest, highlight: true },
  TESTING_IN_PROGRESS:      { label: 'Testing Running',    color: '#3b82f6', pulse: true,  icon: FlaskConical },
  TESTING_COMPLETE:         { label: 'Tests Complete',     color: '#14b8a6', pulse: false, icon: CheckCircle2 },
  FAILED:                   { label: 'Failed',             color: '#ef4444', pulse: false, icon: AlertCircle },
  // Legacy status mappings
  pending:                  { label: 'Created',            color: '#6b7280', pulse: false, icon: FolderOpen },
  analyzing:                { label: 'Analysing Code',     color: '#f59e0b', pulse: true,  icon: ScanSearch },
  analyzed:                 { label: 'Analysis Complete',  color: '#10b981', pulse: false, icon: ScanLine },
}

const FALLBACK_STATUS: StatusCfg = { label: 'Unknown', color: '#6b7280', pulse: false, icon: FolderOpen }

const ENV_COLORS: Record<string, string> = {
  production:  '#ef4444',
  prod:        '#ef4444',
  staging:     '#f59e0b',
  stage:       '#f59e0b',
  development: '#10b981',
  dev:         '#10b981',
}

// ── Component ─────────────────────────────────────────────────────────────────
export interface ProjectStatusBoardProps {
  projects: any[]
  selectedProjectId: string | null
  onSelect: (project: any) => void
  onExecuteTests: (project: any) => void
}

export default function ProjectStatusBoard({
  projects, selectedProjectId, onSelect, onExecuteTests,
}: ProjectStatusBoardProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Collect unique statuses present in projects
  const statuses = useMemo(() => {
    const seen = new Set<string>()
    projects.forEach(p => { if (p.status) seen.add(p.status as string) })
    return Array.from(seen)
  }, [projects])

  const filtered = useMemo(() => {
    return projects.filter(p => {
      const matchSearch = !search ||
        (p.name as string | undefined)?.toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'all' || p.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [projects, search, statusFilter])

  const readyCount = projects.filter(p => p.status === 'CODE_CHANGES_DONE').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Filter bar ── */}
      <div style={{ padding: '12px 12px 10px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <Search size={13} style={{
            position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--color-muted)', pointerEvents: 'none',
          }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects..."
            style={{
              width: '100%', boxSizing: 'border-box',
              paddingLeft: 30, paddingRight: 10, height: 32, borderRadius: 8,
              background: 'var(--color-card)', border: '1px solid var(--color-border)',
              color: 'var(--color-text)', fontSize: 12, outline: 'none',
            }}
          />
        </div>

        {/* Status filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={12} style={{ color: 'var(--color-muted)', flexShrink: 0 }} />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              flex: 1, height: 28, borderRadius: 6,
              background: 'var(--color-card)', border: '1px solid var(--color-border)',
              color: 'var(--color-text)', fontSize: 11, paddingLeft: 8, outline: 'none', cursor: 'pointer',
            }}>
            <option value="all">All Statuses</option>
            {statuses.map(s => (
              <option key={s} value={s}>{QA_STATUS_CONFIG[s]?.label ?? s}</option>
            ))}
          </select>
        </div>

        {/* Counts */}
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-muted)', lineHeight: 1.4 }}>
          <span style={{ fontWeight: 600, color: 'var(--color-subtext)' }}>{filtered.length}</span>
          {' '}project{filtered.length !== 1 ? 's' : ''}
          {readyCount > 0 && (
            <> · <span style={{ fontWeight: 700, color: '#10b981' }}>{readyCount} ready for QA</span></>
          )}
        </div>
      </div>

      {/* ── Card list ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px 16px' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 12 }}>
            {search ? 'No projects match your search.' : 'No projects found.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((project, i) => (
              <ProjectCard
                key={project.projectId as string}
                project={project}
                isSelected={project.projectId === selectedProjectId}
                onSelect={onSelect}
                onExecuteTests={onExecuteTests}
                animDelay={i * 0.035}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Project Card ──────────────────────────────────────────────────────────────
interface ProjectCardProps {
  project: any
  isSelected: boolean
  onSelect: (p: any) => void
  onExecuteTests: (p: any) => void
  animDelay: number
}

function ProjectCard({ project, isSelected, onSelect, onExecuteTests, animDelay }: ProjectCardProps) {
  const status = (project.status as string | undefined) ?? 'CREATED'
  const cfg = QA_STATUS_CONFIG[status] ?? FALLBACK_STATUS
  const StatusIcon = cfg.icon

  const env = ((project.environment as string | undefined) ?? 'development').toLowerCase()
  const envColor = ENV_COLORS[env] ?? '#6b7280'

  // Pass rate from last test run metadata if available
  const lastRun = project.lastTestRun as Record<string, number> | undefined
  const passed  = lastRun?.totalPassed  ?? 0
  const failed  = lastRun?.totalFailed  ?? 0
  const total   = passed + failed
  const passRate = total > 0 ? Math.round((passed / total) * 100) : null
  const passColor = passRate !== null
    ? (passRate >= 90 ? '#10b981' : passRate >= 70 ? '#f59e0b' : '#ef4444')
    : '#6b7280'

  const repoCount = project.repoCount as number | undefined

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animDelay }}
      onClick={() => onSelect(project)}
      style={{
        background: isSelected ? 'var(--color-card-hover)' : 'var(--color-card)',
        border: `1px solid ${isSelected ? cfg.color + '55' : 'var(--color-border)'}`,
        borderRadius: 12, cursor: 'pointer', position: 'relative',
        overflow: 'hidden', transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: isSelected ? `0 0 0 2px ${cfg.color}25` : 'none',
      }}>

      {/* Top status color bar */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}55)` }} />

      <div style={{ padding: '11px 13px' }}>
        {/* Status badge + env chip */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px',
            borderRadius: 20, background: `${cfg.color}16`, border: `1px solid ${cfg.color}28`,
            flexShrink: 1, minWidth: 0, overflow: 'hidden' }}>
            {cfg.pulse && (
              <span style={{
                width: 6, height: 6, borderRadius: '50%', background: cfg.color,
                display: 'inline-block', flexShrink: 0,
                animation: 'statusPulse 1.4s ease-in-out infinite',
              }} />
            )}
            <StatusIcon size={11} color={cfg.color} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {cfg.label}
            </span>
          </div>
          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, flexShrink: 0,
            background: `${envColor}16`, color: envColor, border: `1px solid ${envColor}28`,
            textTransform: 'capitalize', marginLeft: 6 }}>
            {env}
          </span>
        </div>

        {/* Project name */}
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13,
          color: 'var(--color-text)', marginBottom: 5, lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {project.name as string}
        </div>

        {/* PR URL */}
        {project.prUrl && (
          <a href={project.prUrl as string} target="_blank" rel="noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11,
              color: 'var(--color-primary)', textDecoration: 'none', marginBottom: 6 }}>
            <GitPullRequest size={10} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}>
              {(project.prUrl as string).replace(/^https?:\/\//, '')}
            </span>
          </a>
        )}

        {/* Repo count */}
        {repoCount !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
            <GitFork size={11} color="var(--color-muted)" />
            <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
              {repoCount} repo{repoCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Pass rate bar */}
        {passRate !== null && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>Last run pass rate</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: passColor }}>{passRate}%</span>
            </div>
            <div style={{ height: 4, background: 'var(--color-bg)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${passRate}%`, background: passColor,
                borderRadius: 2, transition: 'width 0.5s' }} />
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button
              onClick={e => { e.stopPropagation(); onExecuteTests(project) }}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)',
                color: '#10b981', transition: 'all 0.15s',
              }}>
              <CirclePlay size={12} /> Execute Tests
            </button>
            {status === 'TESTING_COMPLETE' && (
              <button
                onClick={e => { e.stopPropagation(); onSelect(project) }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.35)',
                  color: '#14b8a6', transition: 'all 0.15s',
                }}>
                <BarChart3 size={12} /> View Results
              </button>
            )}
          </div>
      </div>
    </motion.div>
  )
}
