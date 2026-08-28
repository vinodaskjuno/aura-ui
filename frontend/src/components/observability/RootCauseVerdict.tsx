import { useState } from 'react'
import { Check, X, CircleDashed, Loader2 } from 'lucide-react'
import observabilityApi, { type Outcome, type Verdict } from '../../api/observability'

/**
 * The strongest learning signal (weight 1.0).
 *
 * An un-actioned root cause is recorded as an explicit `unknown`, never an implicit
 * confirm — otherwise the corpus skews toward "the agent was right" and accuracy
 * appears to climb while actually falling.
 */
interface Props {
  investigationId: string
  outcome: Outcome | null
  disabled?: boolean
  onRecorded: (o: Outcome) => void
}

const OPTIONS: { verdict: Verdict; label: string; color: string; Icon: typeof Check }[] = [
  { verdict: 'confirmed', label: 'Confirmed', color: '#10b981', Icon: Check },
  { verdict: 'wrong',     label: 'Wrong',     color: '#ef4444', Icon: X },
  { verdict: 'partial',   label: 'Partial',   color: '#f59e0b', Icon: CircleDashed },
]

export default function RootCauseVerdict({
  investigationId, outcome, disabled, onRecorded,
}: Props) {
  const [busy, setBusy] = useState<Verdict | null>(null)
  const [actual, setActual] = useState('')
  const [err, setErr] = useState('')

  const record = async (verdict: Verdict) => {
    setBusy(verdict); setErr('')
    try {
      const r = await observabilityApi.recordOutcome(investigationId, verdict,
        verdict === 'confirmed' ? {} : { actual_cause: actual })
      onRecorded(r.data)
    } catch {
      setErr('Could not record the verdict.')
    } finally {
      setBusy(null)
    }
  }

  if (outcome && outcome.verdict !== 'unknown') {
    const meta = OPTIONS.find((o) => o.verdict === outcome.verdict)
    return (
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', gap: 9, fontSize: 12 }}>
        <span style={{ fontWeight: 700, color: meta?.color ?? 'var(--color-text)' }}>
          {meta?.label ?? outcome.verdict}
        </span>
        <span style={{ color: 'var(--color-muted)' }}>
          {outcome.confirmed_by ? `by ${outcome.confirmed_by}` : ''}
          {' · confidence '}{Math.round((outcome.confidence ?? 0) * 100)}%
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: outcome.teaches ? '#10b981' : 'var(--color-muted)' }}>
          {outcome.teaches ? 'used for learning' : 'below the learning threshold'}
        </span>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
      <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginBottom: 7 }}>
        Was this right? Your answer is the strongest signal the agents learn from.
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {OPTIONS.map(({ verdict, label, color, Icon }) => (
          <button
            key={verdict}
            disabled={disabled || busy !== null}
            onClick={() => record(verdict)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5,
              fontWeight: 600, padding: '5px 11px', borderRadius: 6,
              cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
              background: `${color}18`, color, border: `1px solid ${color}55`,
            }}
          >
            {busy === verdict
              ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
              : <Icon size={12} />}
            {label}
          </button>
        ))}
      </div>
      <input
        value={actual}
        onChange={(e) => setActual(e.target.value)}
        placeholder="If it was wrong or partial — what was the actual cause?"
        style={{ width: '100%', marginTop: 8, fontSize: 11.5, padding: '6px 9px',
          borderRadius: 6, background: 'var(--color-surface)', color: 'var(--color-text)',
          border: '1px solid var(--color-border)' }}
      />
      {err && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 5 }}>{err}</div>}
    </div>
  )
}
