/**
 * The state vocabulary every metric in the product speaks.
 *
 * The rule this file exists to enforce: COLOUR IS A SIGNAL, NEVER DECORATION.
 * A healthy number is plain text. Before this, every KPI tile in the app was
 * tinted with a per-metric hex — which meant no tile signalled anything,
 * because they were all equally loud.
 *
 * `unmeasured` and `unavailable` are deliberately distinct, and both are
 * distinct from zero. "No test run has completed" and "the coverage query
 * failed" both rendered `0%` before, and `0%` says *nothing works* — a
 * different and untrue statement. components/qa/CoverageSummary.tsx already
 * argued this in a comment; here it becomes product-wide.
 */

export type MetricState =
  | 'ok'            // healthy, or simply a fact — no colour
  | 'attention'     // degraded, worth a look today
  | 'critical'      // broken now
  | 'unmeasured'    // nothing to measure yet
  | 'unavailable'   // we tried to measure and could not

/** The em-dash every absent value renders as. Never `0`, never `N/A`. */
export const NO_VALUE = '—'

/**
 * Colour for a state. Returns null where the answer is "no colour at all" —
 * callers must fall back to --color-text rather than inventing a neutral.
 *
 * Success is absent on purpose. Green on every healthy number would put colour
 * across 80% of a screen and destroy the signal the other states depend on.
 */
export function stateColor(state: MetricState): string | null {
  switch (state) {
    case 'critical':    return 'var(--color-danger)'
    case 'attention':   return 'var(--color-warning)'
    case 'unmeasured':
    case 'unavailable': return 'var(--color-muted)'
    case 'ok':          return null
  }
}

/** True when the state means "there is no number here", whatever `value` holds. */
export function isAbsent(state: MetricState): boolean {
  return state === 'unmeasured' || state === 'unavailable'
}

/**
 * Render a value for display. Numbers get thousands separators; `null` and the
 * absent states get the em-dash regardless of what `value` happens to contain,
 * so a stale 0 left in a payload cannot leak onto the screen as a real number.
 */
export function formatValue(
  value: number | string | null | undefined,
  state: MetricState,
  unit?: string,
): string {
  if (isAbsent(state) || value === null || value === undefined) return NO_VALUE
  const body = typeof value === 'number' ? value.toLocaleString() : value
  return unit ? `${body}${unit}` : body
}

/** Severity ordering for the attention rail — worst first. */
export const SEVERITY_RANK: Record<'critical' | 'attention' | 'info', number> = {
  critical: 0, attention: 1, info: 2,
}

/**
 * The product's ONE definition of whether a percentage is healthy.
 *
 * There were three sets of thresholds across the app — 90/70 in the QA stats
 * bar, 80/50 in `progress.pctColor`, and a third on the project card — so the
 * same run could be green on one screen and amber on the next. 80/50 wins
 * because it is the pair the shared helper already used.
 */
export function pctState(pct: number | null | undefined): MetricState {
  if (pct === null || pct === undefined) return 'unmeasured'
  if (pct >= 80) return 'ok'
  return pct >= 50 ? 'attention' : 'critical'
}

/**
 * The inverse: a percentage where HIGH is bad (untestable, failure rate).
 */
export function inversePctState(pct: number | null | undefined): MetricState {
  if (pct === null || pct === undefined) return 'unmeasured'
  if (pct >= 50) return 'critical'
  return pct >= 20 ? 'attention' : 'ok'
}
