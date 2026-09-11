/**
 * The DevMate landing payload.
 *
 * Reuses the dashboard envelope wholesale — same `Block` union, same metric
 * state vocabulary — and adds `hero`, which the dashboard has no equivalent of.
 *
 * `hero` sits BESIDE `blocks` rather than inside them because the project grid
 * is not a metric: it is the page's primary control, and the reason someone
 * opened this screen. The blocks below it are context for that choice.
 *
 * Mirrors `build_devmate_view` in aura-api/src/services/role_metrics.py.
 */
import client from './client'
import type { Block, MetricState } from './dashboardView'

export type { Block, MetricState }

export interface HeroCard {
  projectId: string
  name: string
  /** "3 changes awaiting you", "analysed", "no repo linked". */
  status: string
  state: MetricState
  /** Supporting line — the staged paths, or the node count. */
  detail: string
  when: string
  /** How many changes are staged. Drives the attention treatment. */
  pending: number
}

export interface DevmateView {
  role: string
  roleLabel: string
  generatedAt: string
  headline: {
    text: string
    detail?: string
    state: MetricState
  }
  hero: {
    cards: HeroCard[]
    /** Every project the user has — NOT `cards.length`. The UI must show the
     *  true count rather than implying the hero is the whole estate. */
    total: number
    shown: number
  }
  attention: {
    severity: 'critical' | 'attention' | 'info'
    title: string
    detail?: string
    when?: string
    href?: string
  }[]
  blocks: Block[]
  degraded?: string[]
}

export const getDevmateView = () =>
  client.get<DevmateView>('/api/devmate/view').then(r => r.data)
