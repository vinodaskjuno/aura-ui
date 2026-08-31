import { useState } from 'react'
import {
  CheckCircle2, XCircle, MinusCircle, CloudOff, ChevronRight, ZoomIn, X,
} from 'lucide-react'
import type { RunStep } from '../../api/qa'

/**
 * Every step a run took, in order, with its own status and screenshot.
 *
 * This is the view that makes a stored run reviewable by someone who was not
 * watching it. The previous results view showed only counts and a wall of
 * screenshots whose pass/fail was guessed from whether the filename contained
 * "FAIL"; here each image sits beside the step that produced it and the error text
 * that explains it.
 */

const LOOK: Record<RunStep['status'], { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  passed:     { color: '#10b981', bg: 'rgba(16,185,129,.10)',  icon: <CheckCircle2 size={14} />, label: 'passed' },
  failed:     { color: '#ef4444', bg: 'rgba(239,68,68,.10)',   icon: <XCircle size={14} />,      label: 'failed' },
  skipped:    { color: '#94a3b8', bg: 'rgba(148,163,184,.10)', icon: <MinusCircle size={14} />,  label: 'skipped' },
  // Deliberately its own status, not a failure: the application may be correct and
  // the harness simply cannot answer.
  unemulated: { color: '#f59e0b', bg: 'rgba(245,158,11,.10)',  icon: <CloudOff size={14} />,     label: 'not emulated' },
}

function Lightbox({ url, caption, onClose }: { url: string; caption: string; onClose: () => void }) {
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 1000,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: 28, cursor: 'zoom-out' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
        color: '#e2e8f0', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
        {caption}
        <button type="button" onClick={onClose} aria-label="Close"
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}>
          <X size={16} />
        </button>
      </div>
      <img src={url} alt={caption} onClick={e => e.stopPropagation()}
        style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain',
          borderRadius: 8, border: '1px solid #334155', cursor: 'default' }} />
    </div>
  )
}

export default function StepTimeline({ steps }: { steps: RunStep[] }) {
  const [open, setOpen] = useState<Set<number>>(new Set())
  const [zoom, setZoom] = useState<RunStep | null>(null)

  if (!steps.length) {
    return (
      <div style={{ fontSize: 12.5, color: 'var(--color-muted)', padding: '14px 0' }}>
        This run stored no steps. A run interrupted before its first action leaves a
        report but no step log.
      </div>
    )
  }

  const toggle = (i: number) =>
    setOpen(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {steps.map(step => {
          const look = LOOK[step.status] ?? LOOK.skipped
          const expandable = !!(step.error || step.screenshotUrl)
          const isOpen = open.has(step.index)

          return (
            <div key={step.index} style={{ background: 'var(--color-card)',
              border: '1px solid var(--color-border)', borderLeft: `3px solid ${look.color}`,
              borderRadius: 8, overflow: 'hidden' }}>
              <button type="button" disabled={!expandable}
                onClick={() => expandable && toggle(step.index)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11,
                  padding: '9px 12px', background: 'none', border: 'none',
                  cursor: expandable ? 'pointer' : 'default', textAlign: 'left' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11,
                  color: 'var(--color-muted)', width: 24, flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums' }}>
                  {String(step.index).padStart(2, '0')}
                </span>
                <span style={{ color: look.color, display: 'flex', flexShrink: 0 }}>{look.icon}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5,
                  color: 'var(--color-text)', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {step.action}
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.04em',
                  textTransform: 'uppercase', color: look.color, background: look.bg,
                  padding: '2px 7px', borderRadius: 4, flexShrink: 0 }}>
                  {look.label}
                </span>
                {/* 0 ms means the step never ran, so showing it would read as a
                    suspiciously fast pass rather than "skipped". */}
                {step.durationMs > 0 && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11,
                    color: 'var(--color-muted)', flexShrink: 0,
                    fontVariantNumeric: 'tabular-nums' }}>
                    {step.durationMs}ms
                  </span>
                )}
                {expandable && (
                  <ChevronRight size={13} style={{ flexShrink: 0, color: 'var(--color-muted)',
                    transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
                )}
              </button>

              {isOpen && (
                <div style={{ padding: '0 12px 12px 47px', display: 'flex',
                  flexDirection: 'column', gap: 9 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11,
                    color: 'var(--color-subtext)', wordBreak: 'break-all' }}>
                    {step.target}
                  </div>
                  {step.error && (
                    <div style={{ fontSize: 12, color: step.status === 'failed' ? '#fca5a5' : 'var(--color-muted)',
                      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                      borderRadius: 6, padding: '8px 10px', lineHeight: 1.5,
                      whiteSpace: 'pre-wrap' }}>
                      {step.error}
                    </div>
                  )}
                  {step.screenshotUrl && (
                    <button type="button" onClick={() => setZoom(step)}
                      style={{ padding: 0, background: 'none', border: 'none',
                        cursor: 'zoom-in', position: 'relative', alignSelf: 'flex-start' }}>
                      <img src={step.screenshotUrl} alt={`step ${step.index}`}
                        style={{ maxWidth: 380, borderRadius: 6,
                          border: '1px solid var(--color-border)', display: 'block' }} />
                      <span style={{ position: 'absolute', top: 6, right: 6,
                        background: 'rgba(0,0,0,.6)', borderRadius: 4, padding: 3,
                        display: 'flex', color: '#fff' }}>
                        <ZoomIn size={12} />
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {zoom?.screenshotUrl && (
        <Lightbox url={zoom.screenshotUrl}
          caption={`step ${zoom.index} — ${zoom.action}`}
          onClose={() => setZoom(null)} />
      )}
    </>
  )
}
