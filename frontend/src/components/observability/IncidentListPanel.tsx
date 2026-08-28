import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, ExternalLink, Microscope } from 'lucide-react'
import type { Incident } from '../../api/observability'
import { SEVERITY_COLORS } from '../../api/observability'
import { clockTime, relTime } from './observabilityFormat'

interface Props {
  incidents: Incident[]
  busy: boolean
  onInvestigate: (incident: Incident) => void
}

export default function IncidentListPanel({ incidents, busy, onInvestigate }: Props) {
  const [open, setOpen] = useState<string | null>(null)

  if (incidents.length === 0) {
    return (
      <div style={{ padding: 22, borderRadius: 9, background: 'var(--color-card)',
        border: '1px dashed var(--color-border)', fontSize: 12.5,
        color: 'var(--color-muted)', lineHeight: 1.7 }}>
        No open incidents. Connect PagerDuty, CloudWatch or Sentry to see live incidents
        here, or start an investigation manually from the header.
      </div>
    )
  }

  return (
    <div>
      {incidents.map((inc) => {
        const color = SEVERITY_COLORS[inc.severity] ?? '#6b7280'
        const expanded = open === inc.incidentId
        return (
          <motion.div key={inc.incidentId} initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ background: 'var(--color-card)', borderRadius: 8, marginBottom: 7,
              overflow: 'hidden', border: '1px solid var(--color-border)',
              borderLeft: `3px solid ${color}` }}>
            <div style={{ padding: '11px 14px', cursor: 'pointer' }}
              onClick={() => setOpen(expanded ? null : inc.incidentId)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 9px',
                  borderRadius: 20, background: `${color}22`, color }}>
                  {inc.severity}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)',
                  flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap' }}>{inc.title}</span>
                <span style={{ fontSize: 11, color: 'var(--color-muted)', flexShrink: 0 }}>
                  {inc.service}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5,
                  color: 'var(--color-muted)', flexShrink: 0 }}>{relTime(inc.timestamp)}</span>
                <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px',
                  borderRadius: 4, background: 'var(--color-surface)',
                  color: 'var(--color-muted)', flexShrink: 0 }}>{inc.source}</span>
                <ChevronRight size={13} color="var(--color-muted)"
                  style={{ flexShrink: 0, transform: expanded ? 'rotate(90deg)' : 'none' }} />
              </div>
            </div>
            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  style={{ overflow: 'hidden', borderTop: '1px solid var(--color-border)',
                    background: 'var(--color-surface)' }}>
                  <div style={{ padding: '12px 14px' }}>
                    {inc.description && (
                      <div style={{ fontSize: 12, color: 'var(--color-muted)',
                        lineHeight: 1.6, marginBottom: 10 }}>{inc.description}</div>
                    )}
                    {inc.rootCause && (
                      <div style={{ fontSize: 12, color: 'var(--color-text)',
                        lineHeight: 1.6, marginBottom: 10 }}>
                        <b>Previously analysed:</b> {inc.rootCause}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        disabled={busy}
                        onClick={(e) => { e.stopPropagation(); onInvestigate(inc) }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                          fontSize: 12, fontWeight: 600, padding: '6px 13px', borderRadius: 7,
                          cursor: busy ? 'wait' : 'pointer', border: 'none',
                          background: 'var(--color-primary)', color: '#fff',
                          opacity: busy ? 0.6 : 1 }}>
                        <Microscope size={13} /> Investigate
                      </button>
                      {inc.sourceUrl && inc.sourceUrl !== '#' && (
                        <a href={inc.sourceUrl} target="_blank" rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                            fontSize: 11.5, color: 'var(--color-muted)',
                            textDecoration: 'none' }}>
                          <ExternalLink size={12} /> Open in {inc.source}
                        </a>
                      )}
                      <div style={{ flex: 1 }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5,
                        color: 'var(--color-muted)' }}>
                        {inc.incidentId} · {clockTime(inc.timestamp)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}
    </div>
  )
}
