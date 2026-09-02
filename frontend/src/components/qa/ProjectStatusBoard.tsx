import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  PlayCircle,
  FolderOpen, Download, FolderGit2, ScanSearch, ScanLine, Code2,
  GitPullRequest, FlaskConical, CheckCircle2, AlertCircle,
  BarChart3, Search, Filter, GitFork,
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
  onStartRun: (project: any) => void
}

export default function ProjectStatusBoard({
  projects, selectedProjectId, onSelect, onStartRun,
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

        {/* Filter and count on ONE row. They were two stacked blocks, which cost
            ~40px before the first project — half a card — to say something the list
            itself mostly shows. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 7 }}>
          <Filter size={11} style={{ color: 'var(--color-muted)', flexShrink: 0 }} />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              flex: 1, minWidth: 0, height: 26, borderRadius: 6,
              background: 'var(--color-card)', border: '1px solid var(--color-border)',
              color: 'var(--color-text)', fontSize: 11, paddingLeft: 7, outline: 'none',
              cursor: 'pointer',
            }}>
            <option value="all">All Statuses</option>
            {statuses.map(s => (
              <option key={s} value={s}>{QA_STATUS_CONFIG[s]?.label ?? s}</option>
            ))}
          </select>
          <span style={{ fontSize: 10.5, color: 'var(--color-muted)', flexShrink: 0,
            fontVariantNumeric: 'tabular-nums' }}>
            {filtered.length}
            {readyCount > 0 && (
              <span style={{ fontWeight: 700, color: '#10b981' }}> · {readyCount} ready</span>
            )}
          </span>
        </div>
      </div>

      {/* ── Card list ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '7px 8px 14px' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 12 }}>
            {search ? 'No projects match your search.' : 'No projects found.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map((project, i) => (
              <ProjectCard
                key={project.projectId as string}
                project={project}
                isSelected={project.projectId === selectedProjectId}
                onSelect={onSelect}
                onStartRun={onStartRun}
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
  onStartRun: (p: any) => void
  animDelay: number
}

function ProjectCard({ project, isSelected, onSelect, onStartRun, animDelay }: ProjectCardProps) {
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
        borderRadius: 9, cursor: 'pointer', position: 'relative',
        overflow: 'hidden', transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: isSelected ? `0 0 0 2px ${cfg.color}25` : 'none',
      }}>

      {/* Compact by design — three rows, not seven.
          
          The old card stacked a status pill, an env chip, the name, a PR link, a repo
          count, a "Last run pass rate" label with a 4px bar, and two buttons: about
          170px each, so barely two projects fit and choosing between them meant
          scrolling. A project list is for CHOOSING a project, and the thing you choose
          by is its name and whether its last run was healthy.
          
          So: identity on row one, the numbers inline on row two, actions on row three.
          The pass-rate bar is gone — at 4px it was decoration, and the percentage next
          to it already carried the information. The PR link became an icon, which
          keeps it reachable without spending a whole row on a URL nobody reads. */}
      <div style={{ padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 7,
        borderLeft: `3px solid ${cfg.color}` }}>

        {/* Row 1 — identity. The name is what you are choosing by, so it leads. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          {cfg.pulse ? (
            <span title={cfg.label} style={{
              width: 7, height: 7, borderRadius: '50%', background: cfg.color, flexShrink: 0,
              animation: 'statusPulse 1.4s ease-in-out infinite' }} />
          ) : (
            <StatusIcon size={12} color={cfg.color} style={{ flexShrink: 0 }} />
          )}
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 12.5,
            color: 'var(--color-text)', flex: 1, minWidth: 0, lineHeight: 1.25,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project.name as string}
          </span>
          {project.prUrl && (
            <a href={project.prUrl as string} target="_blank" rel="noreferrer"
              onClick={e => e.stopPropagation()}
              title={project.prUrl as string}
              style={{ display: 'flex', color: 'var(--color-primary)', flexShrink: 0 }}>
              <GitPullRequest size={11} />
            </a>
          )}
          <span title={`${env} environment`} style={{ fontSize: 9.5, fontWeight: 700,
            padding: '1px 5px', borderRadius: 4, flexShrink: 0, textTransform: 'uppercase',
            background: `${envColor}16`, color: envColor, border: `1px solid ${envColor}28` }}>
            {env.slice(0, 4)}
          </span>
        </div>

        {/* Row 2 — the numbers, on one line. Separated by middots rather than stacked,
            which is what makes the card scannable at a glance. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10.5,
          color: 'var(--color-muted)', minWidth: 0 }}>
          <span style={{ color: cfg.color, fontWeight: 700, flexShrink: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cfg.label}
          </span>
          {repoCount !== undefined && (
            <>
              <span aria-hidden style={{ opacity: 0.5 }}>·</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                <GitFork size={10} /> {repoCount}
              </span>
            </>
          )}
          {passRate !== null && (
            <>
              <span aria-hidden style={{ opacity: 0.5 }}>·</span>
              <span title="Last run pass rate" style={{ color: passColor, fontWeight: 700,
                flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                {passRate}% pass
              </span>
            </>
          )}
        </div>

        {/* Row 3 — actions. Start a run is primary and lives on the project, because
            that is where the intent starts; Open is icon-width because navigating is
            already what clicking the card does. */}
        <div style={{ display: 'flex', gap: 5 }}>
          <button
            onClick={e => { e.stopPropagation(); onStartRun(project) }}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '5px 9px', borderRadius: 7, fontSize: 10.5, fontWeight: 700,
              cursor: 'pointer', background: 'rgba(79,70,229,0.14)',
              border: '1px solid rgba(79,70,229,0.38)',
              color: 'var(--color-primary)', transition: 'all 0.15s',
            }}>
            <PlayCircle size={11} /> Start a run
          </button>
          <button
            onClick={e => { e.stopPropagation(); onSelect(project) }}
            title="Open this project's runs, results and artifacts"
            aria-label="Open project"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: '5px 9px', borderRadius: 7, fontSize: 10.5, fontWeight: 700,
              cursor: 'pointer', flexShrink: 0,
              background: isSelected ? 'rgba(20,184,166,0.18)' : 'transparent',
              border: '1px solid rgba(20,184,166,0.30)',
              color: '#14b8a6', transition: 'all 0.15s',
            }}>
            <BarChart3 size={11} /> Open
          </button>
        </div>
      </div>
    </motion.div>
  )
}
