/**
 * Formatting + colour helpers shared by the usage views.
 *
 * Kept out of the component file so React Fast Refresh still works there (a
 * module that exports both a component and constants disables it).
 */

export function fmtUsd(v: number): string {
  if (!v) { return '$0.00' }
  if (v < 0.01) { return '$' + v.toFixed(4) }
  return '$' + v.toFixed(2)
}

export function fmtTokens(v: number): string {
  if (v >= 1_000_000) { return (v / 1_000_000).toFixed(1) + 'M' }
  if (v >= 1_000) { return (v / 1_000).toFixed(1) + 'K' }
  return String(v ?? 0)
}

/** Stable colour per model family, so a model keeps its colour across charts. */
export function modelColor(model: string): string {
  const m = (model || '').toLowerCase()
  if (m.includes('fable') || m.includes('mythos')) { return '#d55181' }
  if (m.includes('opus')) { return '#3987e5' }
  if (m.includes('sonnet')) { return '#199e70' }
  if (m.includes('haiku')) { return '#c98500' }
  if (m.includes('gpt')) { return '#d95926' }
  if (m.includes('gemini')) { return '#9085e9' }
  return '#9ca3af'
}
