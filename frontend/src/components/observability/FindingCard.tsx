import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Sparkles } from 'lucide-react'
import type { Evidence, Finding } from '../../api/observability'
import { CitationChip, CitedText } from './evidenceCitations'
import { AGENT_LABELS, FINDING_STATUS_META, fmtConfidence } from './observabilityFormat'

interface Props {
  finding: Finding
  index: number
  evidenceById: Record<string, Evidence>
  hovered: string | null
  onHoverEvidence: (id: string | null) => void
  onPinEvidence: (id: string) => void
  onShowCases?: (finding: Finding) => void
  flash?: boolean
}

export default function FindingCard({
  finding, index, evidenceById, hovered, onHoverEvidence, onPinEvidence,
  onShowCases, flash,
}: Props) {
  const [expanded, setExpanded] = useState(finding.status === 'root_cause')
  const meta = FINDING_STATUS_META[finding.status]
  const unsupported = finding.status === 'unsupported' || finding.evidenceIds.length === 0

  return (
    <motion.div
      id={`finding-${finding.findingId}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0,
        boxShadow: flash ? `0 0 0 2px ${meta.color}` : '0 0 0 0 transparent' }}
      transition={{ duration: 0.25 }}
      style={{
        background: 'var(--color-card)',
        borderRadius: 9,
        marginBottom: 10,
        overflow: 'hidden',
        // The single most important element on the page: an unsupported claim is
        // drawn as provisional, so "no conclusion without data" is a visible
        // property of the UI rather than a promise in a slide deck.
        border: unsupported
          ? `1px dashed ${FINDING_STATUS_META.unsupported.color}99`
          : '1px solid var(--color-border)',
        borderLeft: `3px solid ${meta.color}`,
      }}
    >
      <div style={{ padding: '11px 14px', cursor: 'pointer' }}
           onClick={() => setExpanded((v) => !v)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
            color: 'var(--color-muted)' }}>
            {String(index).padStart(2, '0')}
          </span>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
            textTransform: 'uppercase', padding: '2px 8px', borderRadius: 20,
            background: `${meta.color}22`, color: meta.color }}>
            {meta.label}
          </span>
          {unsupported && (
            <span style={{ fontSize: 10, fontWeight: 700, color: FINDING_STATUS_META.unsupported.color }}>
              no supporting evidence
            </span>
          )}
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
            color: unsupported ? 'var(--color-muted)' : meta.color }}>
            {fmtConfidence(finding.confidence)}
          </span>
          <ChevronRight size={14} color="var(--color-muted)"
            style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }} />
        </div>

        <div style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--color-text)' }}>
          <CitedText text={finding.claim} evidenceById={evidenceById}
            hovered={hovered} onHover={onHoverEvidence} onClick={onPinEvidence} />
        </div>

        {finding.evidenceIds.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10,
            paddingTop: 9, borderTop: '1px solid var(--color-border)' }}>
            {finding.evidenceIds.map((id) => (
              <CitationChip
                key={id}
                evidenceId={id}
                evidence={evidenceById[id]}
                active={hovered === id}
                onHover={onHoverEvidence}
                onClick={onPinEvidence}
              />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden', borderTop: '1px solid var(--color-border)',
              background: 'var(--color-surface)' }}
          >
            <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap',
              gap: 18, fontSize: 11.5, color: 'var(--color-muted)' }}>
              <span>Agent: <b style={{ color: 'var(--color-text)' }}>
                {AGENT_LABELS[finding.agent] ?? finding.agent}</b></span>
              {finding.category && (
                <span>Category: <b style={{ color: 'var(--color-text)' }}>{finding.category}</b></span>
              )}
              {finding.runbookStepId && (
                <span>Runbook step: <b style={{ color: 'var(--color-text)' }}>
                  {finding.runbookStepId}</b></span>
              )}
              <span>Evidence: <b style={{ color: 'var(--color-text)' }}>
                {finding.evidenceIds.length}</b></span>
            </div>

            {finding.caseIds && finding.caseIds.length > 0 && (
              <div style={{ padding: '0 14px 11px' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); onShowCases?.(finding) }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 11.5, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                    background: 'transparent', color: '#8b5cf6',
                    border: '1px dashed #8b5cf655', cursor: 'pointer',
                  }}
                  title="Past incidents that informed this finding. Priors, not evidence."
                >
                  <Sparkles size={12} />
                  informed by {finding.caseIds.length} past incident
                  {finding.caseIds.length === 1 ? '' : 's'}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
