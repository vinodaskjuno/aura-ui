import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2, XCircle, AlertCircle, Clock, User, Server, Laptop,
  ChevronDown, ChevronRight, Image, Bot, FileText, Timer,
} from 'lucide-react'
import type { TestRun } from '../../api/qa'

// ── Types ────────────────────────────────────────────────────────────────────

interface ActivityFeedProps {
  projectId?: string
  runs?: TestRun[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  completed: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', accent: '#22c55e' },
  success:   { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', accent: '#22c55e' },
  failed:    { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', accent: '#ef4444' },
  error:     { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', accent: '#ef4444' },
  running:   { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', accent: '#3b82f6' },
  pending:   { bg: '#fafaf9', text: '#57534e', border: '#e7e5e4', accent: '#a8a29e' },
}

function statusStyle(status: string) {
  return STATUS_COLORS[status.toLowerCase()] ?? STATUS_COLORS.pending
}

function StatusIcon({ status, size = 16 }: { status: string; size?: number }) {
  const s = status.toLowerCase()
  if (s === 'completed' || s === 'success')
    return <CheckCircle2 size={size} color="#22c55e" />
  if (s === 'failed' || s === 'error')
    return <XCircle size={size} color="#ef4444" />
  if (s === 'running')
    return <Clock size={size} color="#3b82f6" style={{ animation: 'spin 2s linear infinite' }} />
  return <AlertCircle size={size} color="#a8a29e" />
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function durationStr(run: TestRun): string | null {
  if (!run.completedAt || !run.createdAt) return null
  const ms = new Date(run.completedAt).getTime() - new Date(run.createdAt).getTime()
  if (ms <= 0) return null
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function groupByDate(runs: TestRun[]): Map<string, TestRun[]> {
  const map = new Map<string, TestRun[]>()
  for (const run of runs) {
    const d = new Date(run.createdAt)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    let label: string
    if (d.toDateString() === today.toDateString()) label = 'Today'
    else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday'
    else label = d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
    if (!map.has(label)) map.set(label, [])
    map.get(label)!.push(run)
  }
  return map
}

function envBadge(run: TestRun) {
  const isServer =
    run.containerMode === 'ecs' ||
    run.containerMode === 'lambda' ||
    run.type === 'container_execution'
  const isLocal =
    run.type === 'browser_use' ||
    run.containerMode === 'local' ||
    (!isServer && run.type !== 'generation' && run.type !== 'execution')

  if (isServer) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '1px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700,
        background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
      }}>
        <Server size={9} /> ECS Server
      </span>
    )
  }
  if (isLocal) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '1px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700,
        background: '#faf5ff', color: '#7e22ce', border: '1px solid #e9d5ff',
      }}>
        <Laptop size={9} /> Local
      </span>
    )
  }
  // generation / execution
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '1px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700,
      background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0',
    }}>
      <Bot size={9} /> AI Agent
    </span>
  )
}

// ── Run card ─────────────────────────────────────────────────────────────────

function RunCard({ run, index }: { run: TestRun; index: number }) {
  const [expanded, setExpanded] = useState(false)

  const style = statusStyle(run.status)
  const dur   = durationStr(run)
  const hasResults = (run.results ?? []).length > 0
  const passed  = run.totalPassed  ?? 0
  const failed  = run.totalFailed  ?? 0
  const skipped = run.totalSkipped ?? 0
  const shots   = run.totalScreenshots ?? (run.screenshots ?? []).length

  const shortId = run.testRunId.slice(0, 8)
  const userId  = run.userId || 'system'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      style={{
        background: 'var(--color-card)',
        border: `1px solid var(--color-border)`,
        borderLeft: `3px solid ${style.accent}`,
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px' }}>

        {/* Status icon */}
        <div style={{ marginTop: 2, flexShrink: 0 }}>
          <StatusIcon status={run.status} size={17} />
        </div>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Top line: run ID + badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>
              Run {shortId}
            </span>
            {/* Status badge */}
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
              background: style.bg, color: style.text, border: `1px solid ${style.border}`,
              textTransform: 'uppercase',
            }}>
              {run.status}
            </span>
            {envBadge(run)}
          </div>

          {/* Meta: who + when + duration */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
            fontSize: 11, color: 'var(--color-muted)', marginBottom: 6 }}>
            <User size={10} />
            <span style={{ fontWeight: 600, color: 'var(--color-subtext)' }}>{userId}</span>
            <span>·</span>
            <span title={absoluteTime(run.createdAt)}>{relativeTime(run.createdAt)}</span>
            {dur && (
              <>
                <span>·</span>
                <Timer size={10} />
                <span>{dur}</span>
              </>
            )}
          </div>

          {/* App URL if present */}
          {run.appUrl && (
            <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 6,
              fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {run.appUrl}
            </div>
          )}

          {/* Pass / Fail / Skip / Screenshot pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {passed > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11, fontWeight: 700, color: '#15803d' }}>
                <CheckCircle2 size={11} color="#22c55e" />{passed} passed
              </span>
            )}
            {failed > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11, fontWeight: 700, color: '#b91c1c' }}>
                <XCircle size={11} color="#ef4444" />{failed} failed
              </span>
            )}
            {skipped > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11, color: 'var(--color-muted)' }}>
                <AlertCircle size={11} />{skipped} skipped
              </span>
            )}
            {shots > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11, color: 'var(--color-muted)' }}>
                <Image size={11} />{shots} screenshot{shots !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Expand toggle */}
        {hasResults && (
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 6, border: '1px solid var(--color-border)',
              background: 'transparent', cursor: 'pointer', fontSize: 11, fontWeight: 600,
              color: 'var(--color-subtext)',
            }}
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Details
          </button>
        )}
      </div>

      {/* Expandable timeline */}
      <AnimatePresence>
        {expanded && hasResults && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              borderTop: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
              padding: '10px 14px',
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--color-muted)',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Test results timeline
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {run.results!.map((r, idx) => {
                  const fileFailed = r.status === 'failed' || r.failed > 0
                  return (
                    <div key={idx} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                      padding: '7px 10px', borderRadius: 7,
                      background: fileFailed ? '#fef2f2' : '#f0fdf4',
                      border: `1px solid ${fileFailed ? '#fecaca' : '#bbf7d0'}`,
                    }}>
                      <div style={{ marginTop: 1, flexShrink: 0 }}>
                        {fileFailed
                          ? <XCircle size={12} color="#ef4444" />
                          : <CheckCircle2 size={12} color="#22c55e" />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)',
                            fontFamily: 'var(--font-mono)', overflow: 'hidden',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
                            {r.file}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--color-muted)', flexShrink: 0 }}>
                            {r.passed}/{r.passed + r.failed + r.skipped} passed
                            {r.duration > 0 ? ` · ${(r.duration / 1000).toFixed(1)}s` : ''}
                          </span>
                        </div>
                        {fileFailed && r.failed > 0 && (
                          <div style={{
                            fontSize: 11, color: '#b91c1c', marginTop: 2,
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                            <FileText size={10} />
                            {r.failed} test{r.failed !== 1 ? 's' : ''} failed
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Artifacts count */}
              {(run.artifacts ?? []).length > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-muted)',
                  display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Image size={10} />
                  {(run.artifacts ?? []).length} artifact{(run.artifacts ?? []).length !== 1 ? 's' : ''} stored in S3
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ActivityFeed({ projectId, runs }: ActivityFeedProps) {
  const sorted = useMemo(() => {
    return (runs ?? [])
      .filter(r => !projectId || r.projectId === projectId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [runs, projectId])

  const groups = useMemo(() => groupByDate(sorted), [sorted])

  if (sorted.length === 0) {
    return (
      <div style={{
        padding: '48px 20px', textAlign: 'center',
        color: 'var(--color-muted)', fontSize: 13,
      }}>
        <Clock size={28} style={{ marginBottom: 8, opacity: 0.35, display: 'block', margin: '0 auto 8px' }} />
        <div style={{ fontWeight: 600, marginBottom: 4 }}>No test runs yet</div>
        <div style={{ fontSize: 12 }}>Generate or run tests to see activity here.</div>
      </div>
    )
  }

  let globalIndex = 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {Array.from(groups.entries()).map(([date, dateRuns]) => (
        <div key={date}>
          {/* Date separator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0 10px',
            position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 1,
          }}>
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
            <span style={{
              fontSize: 11, fontWeight: 700, color: 'var(--color-muted)',
              textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap',
            }}>{date}</span>
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dateRuns.map(run => (
              <RunCard key={run.testRunId} run={run} index={globalIndex++} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
