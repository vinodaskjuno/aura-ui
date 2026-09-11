/**
 * Progress and coverage arithmetic, kept pure and in one place.
 *
 * Three surfaces used to do this maths inline and each got it slightly wrong: a bar
 * that showed 0% for a run whose plan size was not yet known, and one that could pass
 * 100% when a heartbeat raced the final report.
 */

import { pctState, stateColor } from '../ui/metricState'
import type { QaActiveRun, QaCoverage, RunCase, RunReport, RunStep } from '../../api/qa'

export type Progress =
  /** The plan size is not known yet — a queued run has not been claimed, so nothing
   *  has counted its cases. This is NOT zero percent, which would say something false
   *  about a run that has not started. */
  | { known: false; done: number; label: string }
  | { known: true; done: number; total: number; pct: number; label: string }

interface Counts {
  totalPassed?: number
  totalFailed?: number
  totalSkipped?: number
  totalUnemulated?: number
  totalCases?: number
}

export function runProgress(c: Counts): Progress {
  // `unemulated` counts as dispatched: the case was reached, the harness simply could
  // not answer it. Leaving it out strands the bar short of 100% on any project with a
  // cloud dependency.
  const done = (c.totalPassed ?? 0) + (c.totalFailed ?? 0)
             + (c.totalSkipped ?? 0) + (c.totalUnemulated ?? 0)
  const total = c.totalCases ?? 0
  if (total <= 0) {
    return { known: false, done, label: done ? `${done} done · counting…` : 'starting…' }
  }
  // Clamped: a heartbeat can arrive after the final report and report more done than
  // planned. 113% destroys trust in every other number on the panel.
  const capped = Math.min(done, total)
  return {
    known: true,
    done: capped,
    total,
    pct: Math.max(0, Math.min(100, Math.round((capped / total) * 100))),
    label: `${capped} of ${total}`,
  }
}

/** Progress folded from the local run's WebSocket event stream. */
export function progressFromEvents(events: { type: string; [k: string]: any }[]): Progress {
  let total = 0
  let done = 0
  let finished = false
  for (const ev of events) {
    if (ev.type === 'planned') total = Number(ev.cases) || 0
    if (ev.type === 'step') {
      done += 1
      if (ev.total) total = Number(ev.total) || total
    }
    if (ev.type === 'done') finished = true
  }
  // The run said it is over, so it is over — whatever the step count says. Keeps the
  // bar honest against an older backend that does not report every skipped case.
  if (finished && total) return { known: true, done: total, total, pct: 100, label: `${total} of ${total}` }
  return runProgress({ totalPassed: done, totalCases: total })
}

/** True while a run is producing failures, so the bar can show it. */
export function isFailing(c: Counts): boolean {
  return (c.totalFailed ?? 0) > 0
}

export function activeProgress(run: QaActiveRun): Progress {
  return runProgress(run)
}

// ── Per-case outcome, derived from the steps ─────────────────────────────────

export type CaseOutcome = 'passed' | 'failed' | 'skipped' | 'unemulated' | 'not-run'

const RANK: Record<string, number> = {
  passed: 0, unemulated: 1, skipped: 2, failed: 3,
}

/** Steps grouped by the case that produced them. */
export function stepsByCase(steps: RunStep[]): Record<string, RunStep[]> {
  const out: Record<string, RunStep[]> = {}
  for (const step of steps) {
    const id = step.caseId || ''
    if (!id) continue
    ;(out[id] ||= []).push(step)
  }
  return out
}

/**
 * What happened to one case. Worst status wins — a case whose steps both passed and
 * failed is a failure — and a case with no steps at all is `not-run`, never a pass.
 */
export function caseOutcome(steps: RunStep[]): CaseOutcome {
  if (!steps.length) return 'not-run'
  let worst = steps[0].status as CaseOutcome
  for (const step of steps) {
    if ((RANK[step.status] ?? 3) > (RANK[worst] ?? 0)) worst = step.status as CaseOutcome
  }
  return worst
}

/** Why a case produced nothing — the plan's own reason, or the user's filter. */
export function notRunReason(testCase: RunCase, report: RunReport): string {
  if (testCase.skip_reason) return testCase.skip_reason
  const kinds = report.selectedKinds ?? []
  if (kinds.length && !kinds.includes(testCase.kind)) return 'not selected for this run'
  return 'did not run'
}

/**
 * Execution rate straight from a stored run, with no backend involvement.
 *
 * Every step carries a caseId and the report carries every planned case, so this has
 * always been derivable client-side — which is what lets the number appear before the
 * coverage endpoint exists.
 */
export function executionRate(report: RunReport, steps: RunStep[]):
    { planned: number; executed: number; pct: number | null } {
  const planned = report.cases?.length ?? 0
  const executed = new Set(steps.map(s => s.caseId).filter(Boolean)).size
  return { planned, executed, pct: planned ? Math.round((executed / planned) * 100) : null }
}

/**
 * Colour for a percentage. Delegates to `pctState` so this and the dashboard
 * cannot disagree about what counts as healthy — they used to, at 80/50 here
 * and 90/70 in the QA stats bar.
 */
export function pctColor(pct: number | null): string {
  return stateColor(pctState(pct)) ?? 'var(--color-text)'
}

export function hasCoverage(c: QaCoverage | null | undefined): c is QaCoverage {
  return !!c && (c.nodeTotal > 0 || c.planned > 0)
}
