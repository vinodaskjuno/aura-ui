import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Play, Download, CheckCircle2, Clock, SkipForward,
  ChevronDown, ChevronUp, Shield, Loader, AlertTriangle, Sparkles,
} from 'lucide-react'
import {
  sopApi, STAGE_META,
  type SOPDocument, type SOPStage, type StepStatus, type SOPStep,
} from '../../api/sop'
import { useAuthStore } from '../../store/authStore'

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<StepStatus, { icon: React.ReactNode; color: string; label: string }> = {
  pending:     { icon: <Clock size={13} />,          color: '#6b7280', label: 'Pending'     },
  in_progress: { icon: <Loader size={13} />,         color: '#3b82f6', label: 'In Progress' },
  completed:   { icon: <CheckCircle2 size={13} />,   color: '#10b981', label: 'Completed'   },
  skipped:     { icon: <SkipForward size={13} />,    color: '#f59e0b', label: 'Skipped'     },
}

const STATUS_ORDER: StepStatus[] = ['pending', 'in_progress', 'completed', 'skipped']

function nextStatus(current: StepStatus): StepStatus {
  const idx = STATUS_ORDER.indexOf(current)
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length]
}

// ── Step card ─────────────────────────────────────────────────────────────────
function StepCard({ step, stageColor, onToggleStatus, onToggleCheck, onNoteChange, saving }: {
  step: SOPStep; stageColor: string
  onToggleStatus: (stepId: string) => void
  onToggleCheck: (stepId: string, itemId: string) => void
  onNoteChange: (stepId: string, notes: string) => void
  saving: boolean
}) {
  const [expanded, setExpanded]   = useState(step.status === 'in_progress' || step.order <= 2)
  const [notes, setNotes]         = useState(step.notes)
  const cfg = STATUS_CONFIG[step.status]
  const completedCount = step.checklist.filter(i => i.completed).length
  const totalCount     = step.checklist.length

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: 'var(--color-card)', border: `1px solid var(--color-border)`,
        borderLeft: `3px solid ${cfg.color}`, borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
        onClick={() => setExpanded(v => !v)}>
        {/* Step number */}
        <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
          background: `${cfg.color}22`, border: `1.5px solid ${cfg.color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 800, color: cfg.color }}>
          {step.order}
        </div>

        {/* Title + description */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14,
            color: 'var(--color-text)', marginBottom: 2 }}>{step.title}</div>
          <div style={{ fontSize: 12, color: 'var(--color-muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {step.description}
          </div>
        </div>

        {/* Progress */}
        {totalCount > 0 && (
          <div style={{ fontSize: 11, color: 'var(--color-muted)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
            {completedCount}/{totalCount}
          </div>
        )}

        {/* Status badge — clickable to cycle */}
        <button onClick={e => { e.stopPropagation(); if (!saving) onToggleStatus(step.id) }}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20,
            background: `${cfg.color}18`, border: `1px solid ${cfg.color}44`, cursor: 'pointer',
            color: cfg.color, fontSize: 11, fontWeight: 700, flexShrink: 0,
            transition: 'all 0.15s' }}>
          {cfg.icon} {cfg.label}
        </button>

        {step.autoDetected && (
          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
            background: 'rgba(79,142,247,0.15)', color: 'var(--color-primary)', flexShrink: 0 }}>
            AUTO
          </span>
        )}

        {expanded ? <ChevronUp size={14} color="var(--color-muted)" />
                  : <ChevronDown size={14} color="var(--color-muted)" />}
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--color-border)' }}>

              {/* Checklist */}
              {step.checklist.length > 0 && (
                <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {step.checklist.map(item => (
                    <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                      cursor: 'pointer', fontSize: 13, color: item.completed ? 'var(--color-muted)' : 'var(--color-text)' }}>
                      <div
                        onClick={() => onToggleCheck(step.id, item.id)}
                        style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, cursor: 'pointer',
                          background: item.completed ? stageColor : 'transparent',
                          border: `2px solid ${item.completed ? stageColor : 'var(--color-border)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s' }}>
                        {item.completed && <div style={{ width: 6, height: 6, borderRadius: 1, background: '#fff' }} />}
                      </div>
                      <span style={{ textDecoration: item.completed ? 'line-through' : 'none' }}>
                        {item.text}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {/* Notes */}
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-muted)',
                  marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Notes</div>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  onBlur={() => { if (notes !== step.notes) onNoteChange(step.id, notes) }}
                  placeholder="Add notes for this step..."
                  style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    borderRadius: 7, padding: '8px 10px', fontSize: 12, color: 'var(--color-text)',
                    resize: 'vertical', minHeight: 60, outline: 'none', fontFamily: 'var(--font-body)' }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Main SOPTab ───────────────────────────────────────────────────────────────
interface Props {
  projectId: string
  stage: SOPStage
  projectName: string
}

export default function SOPTab({ projectId, stage, projectName }: Props) {
  const { role } = useAuthStore()
  const [sop, setSop]         = useState<SOPDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [approving, setApproving]   = useState(false)
  const [saving, setSaving]         = useState(false)
  const [exporting, setExporting]   = useState(false)
  const [error, setError]     = useState('')

  const meta     = STAGE_META[stage]
  const canApprove = meta.approveRoles.includes(role ?? '')

  const load = useCallback(async () => {
    try {
      const r = await sopApi.get(projectId, stage)
      setSop(r.data)
    } catch { setSop(null) }
    finally { setLoading(false) }
  }, [projectId, stage])

  useEffect(() => { load() }, [load])

  const handleGenerate = async () => {
    setGenerating(true); setError('')
    try {
      const r = await sopApi.generate(projectId, stage)
      setSop(r.data)
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'Generation failed')
    } finally { setGenerating(false) }
  }

  const handleToggleStatus = async (stepId: string) => {
    if (!sop) return
    const step = sop.steps.find(s => s.id === stepId)
    if (!step) return
    const newStatus = nextStatus(step.status)
    setSaving(true)
    try {
      const r = await sopApi.updateSteps(projectId, stage, [{ stepId, status: newStatus }])
      setSop(r.data)
    } finally { setSaving(false) }
  }

  const handleToggleCheck = async (stepId: string, itemId: string) => {
    if (!sop) return
    try {
      const r = await sopApi.toggleCheck(projectId, stage, stepId, itemId)
      setSop(r.data)
    } catch { /**/ }
  }

  const handleNoteChange = async (stepId: string, notes: string) => {
    if (!sop) return
    try {
      const r = await sopApi.updateSteps(projectId, stage, [{ stepId, notes }])
      setSop(r.data)
    } catch { /**/ }
  }

  const handleApprove = async () => {
    setApproving(true); setError('')
    try {
      const r = await sopApi.approve(projectId, stage)
      setSop(r.data)
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'Approval failed')
    } finally { setApproving(false) }
  }

  const handleExportMarkdown = async () => {
    setExporting(true)
    try {
      const r = await sopApi.export(projectId, stage)
      const blob = new Blob([r.data.markdown], { type: 'text/markdown' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = r.data.filename; a.click()
      URL.revokeObjectURL(url)
    } finally { setExporting(false) }
  }

  const handleExportPDF = () => {
    window.print()
  }

  // Progress summary
  const completedSteps  = sop?.steps.filter(s => s.status === 'completed').length ?? 0
  const totalSteps      = sop?.steps.length ?? 0
  const progressPct     = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', color: 'var(--color-muted)', fontSize: 13, gap: 8 }}>
      <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading SOP...
    </div>
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <FileText size={18} color={meta.color} />
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16,
                color: 'var(--color-text)' }}>
                Standard Operating Procedure
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                background: `${meta.color}18`, color: meta.color }}>
                {meta.label}
              </span>
            </div>
            {sop && (
              <div style={{ fontSize: 12, color: 'var(--color-muted)', display: 'flex', gap: 12 }}>
                <span>Generated: {sop.generatedAt.slice(0, 19).replace('T', ' ')}</span>
                {sop.approvedBy && <span style={{ color: '#10b981' }}>✓ Approved by {sop.approvedBy}</span>}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {sop && (
              <>
                <button className="ov-btn ov-btn-ghost" onClick={handleExportMarkdown}
                  disabled={exporting} style={{ gap: 5, fontSize: 12 }}>
                  <Download size={12} /> Markdown
                </button>
                <button className="ov-btn ov-btn-ghost" onClick={handleExportPDF}
                  style={{ gap: 5, fontSize: 12 }}>
                  <Download size={12} /> PDF
                </button>
                {canApprove && sop.status !== 'approved' && (
                  <motion.button className="ov-btn"
                    onClick={handleApprove} disabled={approving}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    style={{ gap: 5, fontSize: 12, background: '#10b98122',
                      border: '1px solid #10b98166', color: '#10b981', cursor: 'pointer',
                      padding: '6px 14px', borderRadius: 8, display: 'flex', alignItems: 'center' }}>
                    <Shield size={12} />{approving ? 'Approving...' : 'Approve SOP'}
                  </motion.button>
                )}
                {sop.status === 'approved' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12,
                    color: '#10b981', fontWeight: 700 }}>
                    <CheckCircle2 size={14} /> Approved
                  </span>
                )}
              </>
            )}
            <motion.button className="ov-btn ov-btn-primary" onClick={handleGenerate}
              disabled={generating} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              style={{ gap: 5, fontSize: 12 }}>
              {generating
                ? <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</>
                : <><Sparkles size={12} /> {sop ? 'Regenerate SOP' : 'Generate SOP'}</>
              }
            </motion.button>
          </div>
        </div>

        {/* Progress bar (only when SOP exists) */}
        {sop && totalSteps > 0 && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 6, background: 'var(--color-card)',
              borderRadius: 3, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.5 }}
                style={{ height: '100%', background: meta.color, borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: meta.color, minWidth: 48 }}>
              {progressPct}%
            </span>
            <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
              {completedSteps}/{totalSteps} steps
            </span>
          </div>
        )}

        {/* Summary */}
        {sop?.summary && (
          <div style={{ marginTop: 10, padding: '8px 14px', borderRadius: 8,
            background: `${meta.color}0e`, border: `1px solid ${meta.color}22`,
            fontSize: 12, color: 'var(--color-subtext)', fontStyle: 'italic' }}>
            {sop.summary}
          </div>
        )}

        {error && (
          <div style={{ marginTop: 8, padding: '8px 12px', background: '#ef444418',
            border: '1px solid #ef4444', borderRadius: 8, fontSize: 12, color: '#ef4444',
            display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}
      </div>

      {/* ── Steps or empty state ─────────────────────────────────────── */}
      {!sop ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 14 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: `${meta.color}14`,
            border: `1.5px solid ${meta.color}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={28} color={meta.color} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16,
              color: 'var(--color-text)', marginBottom: 6 }}>No SOP yet</div>
            <div style={{ fontSize: 13, color: 'var(--color-muted)', maxWidth: 380 }}>
              Click <strong>Generate SOP</strong> to create an AI-powered Standard Operating Procedure
              for the {meta.label} stage. AURA reads your project knowledge graph and produces
              specific, actionable steps.
            </div>
          </div>
          <motion.button className="ov-btn ov-btn-primary" onClick={handleGenerate}
            disabled={generating} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            style={{ gap: 6 }}>
            <Sparkles size={14} />{generating ? 'Generating...' : 'Generate SOP'}
          </motion.button>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 24 }}>
          {sop.steps.map(step => (
            <StepCard
              key={step.id}
              step={step}
              stageColor={meta.color}
              onToggleStatus={handleToggleStatus}
              onToggleCheck={handleToggleCheck}
              onNoteChange={handleNoteChange}
              saving={saving}
            />
          ))}
        </div>
      )}
    </div>
  )
}
