import { useState, useEffect } from 'react'
import { Play, ChevronDown, ChevronRight, RefreshCw, Clock, CheckCircle, XCircle, Loader } from 'lucide-react'
import { getJobs, triggerJob, getJobHistory, type SchedulerJob, type JobRunRecord } from '../api/scheduler'

const STATUS_CONFIG = {
  idle:    { color: '#6a7aaa', bg: 'rgba(106, 122, 170, 0.12)', label: 'Idle',    Icon: Clock },
  running: { color: '#ffc107', bg: 'rgba(255, 193,   7, 0.12)', label: 'Running', Icon: Loader },
  error:   { color: '#f44336', bg: 'rgba(244,  67,  54, 0.12)', label: 'Error',   Icon: XCircle },
}

const RUN_STATUS_CONFIG = {
  success: { color: '#10b981', Icon: CheckCircle },
  error:   { color: '#f44336', Icon: XCircle },
}

function StatusBadge({ status }: { status: SchedulerJob['status'] }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.idle
  const { color, bg, label, Icon } = cfg
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '3px 9px', borderRadius: '20px',
      background: bg, color, fontSize: '11px', fontWeight: 700,
    }}>
      <Icon size={10} style={status === 'running' ? { animation: 'spin 1s linear infinite' } : undefined} />
      {label}
    </span>
  )
}

function JobHistoryRow({ jobId }: { jobId: string }) {
  const [history, setHistory] = useState<JobRunRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getJobHistory(jobId).then(h => { setHistory(h); setLoading(false) }).catch(() => setLoading(false))
  }, [jobId])

  if (loading) return <div style={{ padding: '12px 20px', color: '#6a7aaa', fontSize: '12px' }}>Loading history...</div>
  if (!history.length) return <div style={{ padding: '12px 20px', color: '#6a7aaa', fontSize: '12px' }}>No runs recorded yet.</div>

  return (
    <div style={{ padding: '12px 20px', background: 'rgba(0,0,0,0.3)' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', color: '#6a7aaa', textTransform: 'uppercase', marginBottom: '8px' }}>
        Last {history.length} Runs
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {history.map((run, i) => {
          const cfg = RUN_STATUS_CONFIG[run.status]
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '6px',
              fontSize: '12px',
            }}>
              <cfg.Icon size={12} style={{ color: cfg.color, flexShrink: 0 }} />
              <span style={{ color: '#b0c0ee', minWidth: '160px' }}>{new Date(run.timestamp).toLocaleString()}</span>
              <span style={{ color: '#6a7aaa' }}>{run.duration_s.toFixed(1)}s</span>
              <span style={{ flex: 1, color: '#8a9adb', fontSize: '11px' }}>
                {Object.entries(run.result || {}).map(([k, v]) => `${k}: ${v}`).join(' · ')}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function SchedulerPage() {
  const [jobs, setJobs] = useState<SchedulerJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set())
  const [triggering, setTriggering] = useState<Set<string>>(new Set())
  const [triggerMsg, setTriggerMsg] = useState<Record<string, string>>({})

  const loadJobs = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getJobs()
      setJobs(data)
    } catch (e: any) {
      setError(e.message ?? 'Failed to load jobs')
    }
    setLoading(false)
  }

  useEffect(() => { loadJobs() }, [])

  const handleTrigger = async (jobId: string) => {
    setTriggering(prev => new Set(prev).add(jobId))
    try {
      const res = await triggerJob(jobId)
      setTriggerMsg(prev => ({ ...prev, [jobId]: res.status ?? 'Triggered' }))
      setTimeout(() => {
        setTriggerMsg(prev => { const n = { ...prev }; delete n[jobId]; return n })
        loadJobs()
      }, 3000)
    } catch (e: any) {
      setTriggerMsg(prev => ({ ...prev, [jobId]: e.message ?? 'Error' }))
    }
    setTriggering(prev => { const n = new Set(prev); n.delete(jobId); return n })
  }

  const toggleExpand = (jobId: string) => {
    setExpandedJobs(prev => {
      const n = new Set(prev)
      if (n.has(jobId)) n.delete(jobId); else n.add(jobId)
      return n
    })
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>Ontology Scheduler</h1>
            <p style={{ fontSize: '13px', color: 'var(--color-subtext)', margin: '4px 0 0' }}>
              Manage daily delta ingestion and correlation refresh jobs for Onto Verse.
            </p>
          </div>
          <button
            onClick={loadJobs}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              color: 'var(--color-subtext)',
              fontSize: '12px', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '12px 16px', marginBottom: '16px',
          background: 'rgba(244, 67, 54, 0.08)',
          border: '1px solid rgba(244, 67, 54, 0.3)',
          borderRadius: '8px',
          color: '#f44336', fontSize: '13px',
        }}>
          {error}
          <span style={{ marginLeft: '8px', color: '#6a7aaa', fontSize: '11px' }}>
            (Start backend with APScheduler enabled)
          </span>
        </div>
      )}

      {/* Jobs table */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 140px 180px 160px 120px 100px',
          gap: '0',
          padding: '12px 20px',
          borderBottom: '1px solid var(--color-border)',
          background: 'rgba(0,0,0,0.2)',
        }}>
          {['Job', 'Status', 'Last Run', 'Next Run', 'Schedule', 'Actions'].map(h => (
            <div key={h} style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', color: 'var(--color-muted)', textTransform: 'uppercase' }}>
              {h}
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-subtext)', fontSize: '14px' }}>
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[var(--color-primary)] border-t-transparent" style={{ marginBottom: '12px' }} />
            <div>Loading jobs...</div>
          </div>
        ) : jobs.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-subtext)', fontSize: '14px' }}>
            No scheduler jobs configured.
            <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: '6px' }}>
              Ensure APScheduler is running in the backend.
            </div>
          </div>
        ) : (
          jobs.map(job => (
            <div key={job.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 140px 180px 160px 120px 100px',
                  gap: '0',
                  padding: '14px 20px',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                {/* Name + description */}
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: '2px', cursor: 'pointer' }}
                  onClick={() => toggleExpand(job.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {expandedJobs.has(job.id) ? <ChevronDown size={12} color="var(--color-muted)" /> : <ChevronRight size={12} color="var(--color-muted)" />}
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{job.name}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--color-subtext)', paddingLeft: '18px' }}>{job.description}</span>
                </div>

                {/* Status */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <StatusBadge status={job.status} />
                </div>

                {/* Last run */}
                <div style={{ display: 'flex', alignItems: 'center', fontSize: '12px', color: 'var(--color-subtext)' }}>
                  {job.last_run ? new Date(job.last_run).toLocaleString() : '—'}
                </div>

                {/* Next run */}
                <div style={{ display: 'flex', alignItems: 'center', fontSize: '12px', color: 'var(--color-subtext)' }}>
                  {job.next_run ? new Date(job.next_run).toLocaleString() : '—'}
                </div>

                {/* Schedule */}
                <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: 'var(--color-muted)', fontFamily: 'monospace' }}>
                  {job.schedule_human ?? job.schedule}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {triggerMsg[job.id] ? (
                    <span style={{ fontSize: '11px', color: '#10b981' }}>{triggerMsg[job.id]}</span>
                  ) : (
                    <button
                      disabled={triggering.has(job.id) || job.status === 'running'}
                      onClick={() => handleTrigger(job.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '6px 12px',
                        background: 'rgba(74, 158, 255, 0.12)',
                        border: '1px solid rgba(74, 158, 255, 0.3)',
                        borderRadius: '6px',
                        color: '#4a9eff', fontSize: '11px', fontWeight: 600,
                        cursor: triggering.has(job.id) || job.status === 'running' ? 'not-allowed' : 'pointer',
                        opacity: triggering.has(job.id) || job.status === 'running' ? 0.5 : 1,
                        transition: 'all 0.2s',
                      }}
                    >
                      <Play size={10} />
                      Run Now
                    </button>
                  )}
                </div>
              </div>

              {/* Expandable history */}
              {expandedJobs.has(job.id) && <JobHistoryRow jobId={job.id} />}
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: '16px', fontSize: '11px', color: 'var(--color-muted)' }}>
        Jobs are code-defined. Delta ingestion runs daily at 02:00 UTC. Correlation refresh runs at 03:00 UTC.
        The scheduler only runs when the backend is active.
      </div>
    </div>
  )
}
