import { Sparkles, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import observabilityApi, { type PastCase } from '../../api/observability'
import { fmtConfidence, relTime } from './observabilityFormat'

/**
 * The cases behind a finding.
 *
 * A case is a PRIOR, not evidence — it is a fact about a PAST incident. The backend
 * rejects any case id that appears in evidence_ids, and this panel is visually
 * separated from the citation chips for the same reason.
 */
interface Props {
  cases: PastCase[]
  negative: PastCase[]
  priors: Record<string, number>
  corpusSize: number
  belowFloor: boolean
  onClose: () => void
  onForget: () => void
}

export default function LearnedFromPanel({
  cases, negative, priors, corpusSize, belowFloor, onClose, onForget,
}: Props) {
  const [busy, setBusy] = useState('')

  const forget = async (id: string) => {
    setBusy(id)
    try { await observabilityApi.forgetLearned(id); onForget() } finally { setBusy('') }
  }

  return (
    <div style={{ padding: 14, borderRadius: 9, marginBottom: 10,
      background: 'var(--color-surface)', border: '1px dashed #8b5cf655' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
        <Sparkles size={13} color="#8b5cf6" />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#8b5cf6' }}>
          Prior knowledge — past incidents
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={{ background: 'none', border: 'none',
          cursor: 'pointer', color: 'var(--color-muted)', display: 'flex' }}>
          <X size={14} />
        </button>
      </div>

      <div style={{ fontSize: 11, color: 'var(--color-muted)', lineHeight: 1.6,
        marginBottom: 11 }}>
        These are base rates from earlier incidents, not evidence about this one — which
        is why they can never appear as citations. Corpus: {corpusSize} case
        {corpusSize === 1 ? '' : 's'}.
        {belowFloor && ' Below the retrieval floor, so no priors were injected.'}
      </div>

      {Object.keys(priors).length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 11 }}>
          {Object.entries(priors).map(([cat, p]) => (
            <span key={cat} style={{ fontSize: 10.5, fontWeight: 600, padding: '3px 9px',
              borderRadius: 20, background: '#8b5cf618', color: '#8b5cf6' }}>
              {cat} {fmtConfidence(p)}
            </span>
          ))}
        </div>
      )}

      {cases.map((c) => (
        <CaseRow key={c.case_id} c={c} busy={busy === c.case_id} onForget={forget} />
      ))}

      {negative.length > 0 && (
        <>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em',
            textTransform: 'uppercase', color: '#ef4444', margin: '11px 0 6px' }}>
            Previously wrong conclusions
          </div>
          {negative.map((c) => (
            <CaseRow key={c.case_id} c={c} busy={busy === c.case_id} onForget={forget} negative />
          ))}
        </>
      )}

      {cases.length === 0 && negative.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
          No comparable past incidents.
        </div>
      )}
    </div>
  )
}

function CaseRow({ c, busy, onForget, negative }: {
  c: PastCase; busy: boolean; onForget: (id: string) => void; negative?: boolean
}) {
  return (
    <div style={{ padding: '8px 10px', marginBottom: 5, borderRadius: 6,
      background: 'var(--color-card)', border: '1px solid var(--color-border)',
      borderLeft: `2px solid ${negative ? '#ef4444' : '#8b5cf6'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--color-muted)' }}>{c.incident_id}</span>
        <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>
          {relTime(c.occurred_at)}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, fontWeight: 700,
          color: negative ? '#ef4444' : '#8b5cf6' }}>
          {fmtConfidence(c.similarity)} similar
        </span>
        <button onClick={() => onForget(c.case_id)} disabled={busy}
          title="Bad lesson — forget this"
          style={{ background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-muted)', display: 'flex', padding: 2 }}>
          <Trash2 size={11} />
        </button>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--color-text)', lineHeight: 1.55 }}>
        {negative && c.wrong_category && (
          <span style={{ color: '#ef4444' }}>wrongly concluded “{c.wrong_category}” — </span>
        )}
        {c.root_cause_statement}
      </div>
      {c.resolution && (
        <div style={{ fontSize: 10.5, color: 'var(--color-muted)', marginTop: 3 }}>
          Resolved by: {c.resolution}
        </div>
      )}
    </div>
  )
}
