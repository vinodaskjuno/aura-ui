import type { CSSProperties } from 'react'
import type { Evidence } from '../../api/observability'
import { EVIDENCE_KIND_META } from './observabilityFormat'

/**
 * The citation interaction.
 *
 * Three mechanisms, all needed:
 *  1. inline [[ev:id]] footnotes rendered AT the clause they support — far more
 *     convincing than a footer list, because the reader sees which half of the
 *     claim is actually backed;
 *  2. footer chips, which double as a density signal;
 *  3. an explicit UNSUPPORTED state (rendered by FindingCard).
 */

const INLINE_RE = /\[\[ev:([A-Za-z0-9_-]+)\]\]/g

export interface CitationChipProps {
  evidenceId: string
  evidence?: Evidence
  index?: number
  active?: boolean
  onHover?: (id: string | null) => void
  onClick?: (id: string) => void
  compact?: boolean
}

export function CitationChip({
  evidenceId, evidence, index, active, onHover, onClick, compact,
}: CitationChipProps) {
  const color = evidence ? EVIDENCE_KIND_META[evidence.kind]?.color ?? '#6b7280' : '#6b7280'
  const label = compact
    ? (index !== undefined ? String(index) : evidenceId.slice(-4))
    : `${evidence ? EVIDENCE_KIND_META[evidence.kind]?.label ?? '' : ''} ${evidenceId.slice(-6)}`.trim()

  const style: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontFamily: 'var(--font-mono)', fontSize: compact ? 10 : 11, fontWeight: 600,
    padding: compact ? '0 5px' : '2px 7px', borderRadius: 4, cursor: 'pointer',
    background: active ? color : `${color}22`,
    color: active ? '#fff' : color,
    border: `1px solid ${active ? color : `${color}55`}`,
    verticalAlign: 'baseline', lineHeight: 1.5, whiteSpace: 'nowrap',
    transition: 'background 120ms, color 120ms',
  }

  return (
    <span
      role="button"
      tabIndex={0}
      style={style}
      title={evidence ? `${evidence.title} — ${evidence.summary}` : evidenceId}
      onMouseEnter={() => onHover?.(evidenceId)}
      onMouseLeave={() => onHover?.(null)}
      onClick={(e) => { e.stopPropagation(); onClick?.(evidenceId) }}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick?.(evidenceId) }}
    >
      {!compact && <span style={{ width: 5, height: 5, borderRadius: '50%',
        background: active ? '#fff' : color, display: 'inline-block' }} />}
      {label}
    </span>
  )
}

export interface CitedTextProps {
  text: string
  evidenceById: Record<string, Evidence>
  hovered?: string | null
  onHover?: (id: string | null) => void
  onClick?: (id: string) => void
}

/** Split a claim on [[ev:id]] and interleave chips AT the supporting clause. */
export function CitedText({ text, evidenceById, hovered, onHover, onClick }: CitedTextProps) {
  const handlers = { hovered, onHover, onClick }
  const nodes: React.ReactNode[] = []
  let last = 0
  let key = 0
  INLINE_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const id = m[1]
    nodes.push(
      <CitationChip
        key={`c${key++}`}
        evidenceId={id}
        evidence={evidenceById[id]}
        active={handlers.hovered === id}
        onHover={handlers.onHover}
        onClick={handlers.onClick}
        compact
      />,
    )
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return <>{nodes}</>
}

/** Inline masked identifier. Dotted underline signals "this is a stand-in". */
export function MaskedToken({ token }: { token: string }) {
  const type = token.split('_')[1] ?? 'ID'
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--color-muted)',
        borderBottom: '1px dotted var(--color-muted)', cursor: 'help',
      }}
      title={`Masked ${type} · reversible`}
    >
      {token}
    </span>
  )
}

const TOKEN_RE = /\b(AURA_[A-Z]+_\d{1,4})\b/g

/** Render text with AURA_* tokens marked up. */
export function MaskedText({ text }: { text: string }) {
  const nodes: React.ReactNode[] = []
  let last = 0
  let key = 0
  TOKEN_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TOKEN_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    nodes.push(<MaskedToken key={`m${key++}`} token={m[1]} />)
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return <>{nodes}</>
}
