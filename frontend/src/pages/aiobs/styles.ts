/**
 * Shared styling for the AI Observability tabs.
 *
 * Hoisted out of AIObservabilityPage.tsx, which had re-declared `card`, `input`,
 * `btn` and `ghost` locally — so every new tab either duplicated them again or
 * drifted. The house convention here is inline style objects referencing the CSS
 * custom properties in src/index.css, not Tailwind classes: only 38 of 174 source
 * files use className at all, and the three themes are driven entirely by those
 * variables.
 */

export const card: React.CSSProperties = {
  background: 'var(--color-card)',
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  padding: 14,
}

export const input: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  padding: '7px 10px',
  color: 'var(--color-text)',
  fontSize: 12.5,
  width: '100%',
}

export const btn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 13px',
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 600,
  border: 'none',
  cursor: 'pointer',
  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
  color: '#fff',
}

export const ghost: React.CSSProperties = {
  ...btn,
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  border: '1px solid var(--color-border)',
}

export const mono: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  // Numeric columns line up only with tabular figures; without this a cost column
  // visibly jitters as digits change.
  fontVariantNumeric: 'tabular-nums',
}

/** Six-decimal USD. Per-call LLM costs are frequently below a cent. */
export const money = (n?: number) => `$${(n ?? 0).toFixed(6)}`

export const tokens = (n?: number) => {
  const v = n ?? 0
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`
  return String(v)
}

/** Matches DashboardPage's CHART_COLORS so charts read as one system. */
export const CHART_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#06b6d4', '#ef4444', '#a78bfa',
]

export const KIND_COLOR: Record<string, string> = {
  llm: '#8b5cf6',
  tool: '#06b6d4',
  retriever: '#10b981',
  chain: '#f59e0b',
  unknown: '#64748b',
}
