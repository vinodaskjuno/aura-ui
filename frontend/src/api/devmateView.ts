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
  /** This project's app is up on someone's machine right now. Both of these come
   *  from sources read ONCE for the whole estate, so a card costs nothing extra —
   *  the hero's six-project cap exists for the expensive per-project calls. */
  running?: boolean
  /** Loopback on the RUNNER's machine. Never rendered as a link from a card: it
   *  resolves somewhere else, or nowhere, on the viewer's own computer. */
  runningUrl?: string
  runningOwnerId?: string
  /** connected | no-spans-yet | key-refused | disabled — the distinction the
   *  always-200 ingest contract erases everywhere else. */
  telemetry?: string
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

// ── Per project ──────────────────────────────────────────────────────────────

/** One decision on one proposed change.
 *
 *  `record_decision` has written all of this since it was added, and until now the
 *  only reader in the product reduced the lot to a single percentage. */
export interface ProjectChange {
  proposalId: string
  path: string
  additions: number
  deletions: number
  decision: 'applied' | 'discarded' | string
  decidedAt: string
  decidedBy: string
  proposedAt: string
  sessionId: string
  userId: string
  /** Empty on every row written before commits were recorded. The UI says so rather
   *  than implying the change was never committed. */
  commitSha: string
  prUrl: string
  href: string
}

export interface ProjectObservabilityView {
  projectId: string
  traces: { count: number | null; errorRate?: number | null; costUsd?: number
            tokens?: number
            /** False when the window was filled — recent activity, not a total. */
            exact?: boolean }
  spend: { costUsd?: number | null; requests?: number; restricted?: boolean }
  run: { apps: any[]; running: boolean }
  telemetry: { state: string; detail?: string; quiet?: boolean }
  /** Policy, summarised. `applicable: false` means the project ships no IaC — which
   *  is not the same as passing, and must never render as though it were. `null`
   *  means the section could not be read at all. */
  checks: {
    applicable: boolean | null
    reason?: string
    passed?: number
    total?: number
    resources?: number
    findings?: number
    /** Resources no control reads. Never folded into "passing". */
    notChecked?: number
  }
  /** Sections that could not be read. Absent data is never a confident zero. */
  degraded: string[]
}

export const getProjectChanges = (projectId: string, limit = 100) =>
  client.get<{ projectId: string; changes: ProjectChange[] }>(
    `/api/devmate/projects/${projectId}/changes`, { params: { limit } })
    .then(r => r.data)

export const getProjectObservability = (projectId: string) =>
  client.get<ProjectObservabilityView>(
    `/api/devmate/projects/${projectId}/observability`).then(r => r.data)
