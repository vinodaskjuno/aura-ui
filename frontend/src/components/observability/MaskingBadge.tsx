import { useState } from 'react'
import { Shield, ShieldOff, ShieldAlert } from 'lucide-react'
import type { MaskingState } from '../../api/observability'

/**
 * Ambient state, not a destination — hence a header pill rather than a tab.
 *
 * The badge says "Reversible" or "Irreversible" IN WORDS. Users will not infer
 * reversibility, and it is a stated capability: if it is not on screen it does not
 * exist. Counts only ever — the server never returns masked values.
 */
export default function MaskingBadge({ masking }: { masking: MaskingState | null }) {
  const [open, setOpen] = useState(false)

  if (!masking) {
    // Never fake this. A green "Masked · 14 identifiers" badge over unmasked real
    // data is a compliance lie, so absence renders as absence.
    return (
      <span style={pill('#6b7280')} title="No masking data for this run">
        <ShieldAlert size={12} /> Masking unavailable
      </span>
    )
  }

  if (!masking.enabled) {
    return (
      <span style={pill('#ef4444')} title="Identifiers are sent to the LLM unmasked">
        <ShieldOff size={12} /> Masking OFF
      </span>
    )
  }

  const color = masking.budgetExceeded ? '#f59e0b' : '#10b981'
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen((v) => !v)}
        style={{ ...pill(color), cursor: 'pointer', border: `1px solid ${color}55` }}>
        <Shield size={12} />
        Masked · {masking.totalTokens} · {masking.reversible ? 'Reversible' : 'Irreversible'}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 60,
          minWidth: 232, padding: '11px 13px', borderRadius: 8,
          background: 'var(--color-card)', border: '1px solid var(--color-border)',
          boxShadow: '0 8px 26px rgba(0,0,0,0.28)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
            textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 8 }}>
            Masked identifiers
          </div>
          {Object.entries(masking.byType).length === 0 && (
            <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>
              Nothing matched a masking rule in this run.
            </div>
          )}
          {Object.entries(masking.byType).map(([type, count]) => (
            <div key={type} style={{ display: 'flex', justifyContent: 'space-between',
              fontSize: 12, padding: '2px 0' }}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}>
                {type}
              </span>
              <span style={{ color: 'var(--color-muted)' }}>{count}</span>
            </div>
          ))}
          <div style={{ marginTop: 9, paddingTop: 8, borderTop: '1px solid var(--color-border)',
            fontSize: 10.5, lineHeight: 1.6, color: 'var(--color-muted)' }}>
            Counts only — values are never returned to the browser. Service names are
            deliberately not masked: they are what the analysis is about.
          </div>
          {masking.budgetExceeded && (
            <div style={{ marginTop: 8, fontSize: 10.5, color: '#f59e0b' }}>
              Token budget reached — some records were dropped rather than sent raw.
            </div>
          )}
        </div>
      )}
    </span>
  )
}

const pill = (color: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5,
  fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 20,
  background: `${color}1e`, color, border: `1px solid ${color}44`,
})
