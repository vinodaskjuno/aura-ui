/**
 * The role-aware dashboard payload.
 *
 * The server decides WHICH blocks a role sees and which is the hero; this file
 * describes that envelope. Layout is deliberately absent from the wire — no
 * sizes, no colours, no column widths. The server says what is true, the UI
 * decides how it looks. That split is what lets a new role ship as a Python
 * dict plus an auth-config row, with no UI deploy.
 *
 * Mirrors src/services/role_metrics.py in aura-api.
 */
import client from './client'
import type { MetricState } from '../components/ui/metricState'

export type { MetricState }

export interface WireMetric {
  label: string
  value: number | string | null
  unit?: string
  state: MetricState
  /** What the number is *of*. Renders under the value. */
  basis?: string
  /** Why it could not be measured. Tooltip on `unavailable`. */
  reason?: string
  href?: string
  /** Real daily history, oldest first. Absent when there is none to show —
   *  the UI must never synthesise one to fill the space. */
  spark?: number[]
}

export type Severity = 'critical' | 'attention' | 'info'

export interface AttentionItem {
  severity: Severity
  title: string
  detail?: string
  when?: string
  href?: string
}

/**
 * `none` and `unknown` are different claims. `none` means no run has happened;
 * `unknown` means runs happened that name no project, so this one's progress
 * cannot be determined. Rendering the second as the first tells the reader
 * nothing was done when the truth is that we cannot tell.
 */
export type PipelineMark = 'done' | 'partial' | 'failed' | 'none' | 'unknown'

export interface ListCell {
  text: string
  /** Colours this one cell. Used for 'never', 'failed', an absent count. */
  state?: MetricState
  mono?: boolean
}

export interface ListRow {
  href?: string
  cells: ListCell[]
}

export interface MetricsBlock {
  kind: 'metrics'
  title: string
  items: WireMetric[]
}

export interface ListBlock {
  kind: 'list'
  title: string
  columns: { key: string; label: string; align?: 'left' | 'right' }[]
  rows: ListRow[]
  /** Shown instead of the table when `rows` is empty. Never a blank panel. */
  empty?: string
}

export interface PipelineBlock {
  kind: 'pipeline'
  title: string
  stages: string[]
  rows: { label: string; href?: string; marks: PipelineMark[] }[]
  legend?: string
}

export interface NoteBlock {
  kind: 'note'
  title: string
  text: string
}

export type Block = MetricsBlock | ListBlock | PipelineBlock | NoteBlock

export interface DashboardView {
  role: string
  roleLabel: string
  generatedAt: string
  headline: {
    text: string
    detail?: string
    state: MetricState
    /** A percentage the text already states, drawn as an arc beside it. */
    gauge?: number | null
    /** The hero metric's own history. Absent when there is none — a total with
     *  a fabricated trend beneath it is worse than a total alone. */
    trend?: {
      label: string
      series: number[]
      unit?: string
      money?: boolean
    } | null
    action?: { label: string; href: string }
  }
  attention: AttentionItem[]
  blocks: Block[]
  /** Builders that raised. The page still renders; these are reported, not hidden. */
  degraded?: string[]
}

export const getDashboardView = () =>
  client.get<DashboardView>('/api/dashboard/view').then(r => r.data)
