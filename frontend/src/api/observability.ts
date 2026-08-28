import client from './client'

// One line, single source of truth, zero aiops edits — severity colouring must not
// drift between the two surfaces while they still coexist.
export { SEVERITY_COLORS } from './aiops'

export type EvidenceKind = 'log' | 'metric' | 'trace' | 'deploy' | 'config' | 'alert' | 'runbook'
export type Signal = 'logs' | 'metrics' | 'traces' | 'events'
export type FindingStatus = 'root_cause' | 'supported' | 'refuted' | 'unsupported'
export type InvestigationStatus = 'queued' | 'running' | 'complete' | 'failed'
export type Verdict = 'confirmed' | 'wrong' | 'partial' | 'unknown'
export type ProviderStatus = 'connected' | 'degraded' | 'failed' | 'not_configured'
export type RunbookOrigin = 'human' | 'confluence' | 'git' | 'synthesized' | 'template'

export interface Evidence {
  evidenceId: string
  investigationId?: string
  signal: Signal
  kind: EvidenceKind
  provider: string
  service: string
  timestamp: string
  title: string
  summary: string
  sourceUrl: string
  hasMasked: boolean
  weight?: number
}

/** Full payload — fetched lazily when the drawer opens, never streamed. */
export interface EvidenceDetail extends Evidence {
  payload: Record<string, unknown>
  labels: Record<string, string>
  masked_fields?: string[]
}

export interface Finding {
  findingId: string
  rank: number
  claim: string
  confidence: number
  status: FindingStatus
  evidenceIds: string[]
  agent: string
  category?: string
  runbookStepId?: string
  /** Priors that informed this finding. Deliberately NOT citations. */
  caseIds?: string[]
  createdAt: string
}

export interface SessionCost {
  inputTokens: number
  outputTokens: number
  totalCost: number
  calls: number
  model: string
}

export interface MaskingState {
  enabled: boolean
  reversible: boolean
  policy?: string
  totalTokens: number
  /** Counts only — the server never returns masked values. */
  byType: Record<string, number>
  budgetExceeded?: boolean
}

export interface Anomaly {
  metric: string
  service: string
  change_point_t: string
  before: number
  after: number
  delta_pct: number
  direction: 'up' | 'down'
  unit?: string
  source_url?: string
  evidence_ids: string[]
}

export interface SuspectChange {
  event_id: string
  kind: string
  service: string
  version: string
  actor: string
  t: string
  title: string
  lead_time_s: number | null
  score: number
  source_url?: string
  evidence_ids: string[]
}

export interface RunbookStep {
  id: string
  order: number
  title: string
  description: string
  status: 'satisfied' | 'pending' | 'blocked'
  evidence_ids: string[]
  checklist?: unknown[]
}

export interface RunbookMatch {
  runbook_id: string
  runbookId?: string
  title: string
  origin: RunbookOrigin
  status?: string
  match_score: number
  matched_on: string[]
  steps: RunbookStep[]
  steps_satisfied: number
  source_url?: string
  alternatives?: { runbook_id: string; title: string; score: number }[]
  confirmedCount?: number
}

export interface PastCase {
  case_id: string
  incident_id: string
  similarity: number
  matched_on: string[]
  occurred_at: string
  root_cause_statement: string
  root_cause_category: string
  outcome_verdict: Verdict
  outcome_confidence: number
  resolution: string
  service: string
  source_url: string
  wrong_category?: string
}

export interface CaseRetrieval {
  cases: PastCase[]
  negative_cases: PastCase[]
  category_priors: Record<string, number>
  corpus_size: number
  below_floor: boolean
}

export interface IntegrationHealth {
  providerId: string
  providerType: string
  label: string
  displayName: string
  capabilities: Signal[]
  status: ProviderStatus
  message: string
  latencyMs: number
  lastCheckedAt: string | null
}

export interface Incident {
  incidentId: string
  title: string
  service: string
  timestamp: string
  severity: string
  state: string
  source: string
  sourceUrl: string
  description?: string
  investigationId?: string
  rootCause?: string
}

export interface Outcome {
  verdict: Verdict
  confidence: number
  sources: { source: string; verdict: string; weight: number; detail: string; observed_at: string }[]
  actual_cause?: string
  confirmed_by?: string
  teaches?: boolean
}

export interface Investigation {
  investigationId: string
  createdAt: string
  title: string
  status: InvestigationStatus
  severity: string
  serviceName: string
  services: string[]
  incidentId?: string
  runId?: string
  window: { start: string; end: string }
  findings: Finding[]
  evidence?: Evidence[]
  rootCause: Finding | Record<string, unknown> | null
  evidenceCount: number
  citationCoverage: number | string
  cost: SessionCost
  masking: MaskingState
  outcome?: Outcome | null
  runbookId?: string
  llmError?: string
  caseCount?: number
  startedAt?: string
  completedAt?: string
}

export interface LearnedArtifact {
  artifactId: string
  kind: 'runbook' | 'case'
  title: string
  status: string
  confidence?: number
  confirmedCount?: number
  service?: string
  learnedFrom: string[]
  createdAt: string
  lastConfirmedAt?: string
}

export interface ObservabilityKpis {
  investigations: number
  running: number
  meanTimeToRcaSeconds: number
  meanCitationCoverage: number
  confirmedRate: number
  outcomeCoverage: number
  corpusSize: number
}

export interface StartInvestigationPayload {
  title?: string
  services: string[]
  symptom?: string
  start?: string
  end?: string
  window_minutes?: number
  incident_id?: string
  severity?: string
  provider_ids?: string[]
  runbook_id?: string
  project_id?: string
  filter?: string
  masking_enabled?: boolean
  background?: boolean
}

const BASE = '/api/observability'

export const observabilityApi = {
  getKpis: () => client.get<ObservabilityKpis>(`${BASE}/kpis`),

  listIncidents: (minutes = 1440) =>
    client.get<{ incidents: Incident[] }>(`${BASE}/incidents`, { params: { minutes } }),

  listInvestigations: (limit = 50) =>
    client.get<{ investigations: Investigation[] }>(`${BASE}/investigations`, { params: { limit } }),

  getInvestigation: (id: string) =>
    client.get<Investigation>(`${BASE}/investigations/${id}`),

  startInvestigation: (payload: StartInvestigationPayload) =>
    client.post<{ investigationId: string; status: string }>(`${BASE}/investigations`, payload),

  getEvidenceDetail: (investigationId: string, evidenceId: string) =>
    client.get<EvidenceDetail>(`${BASE}/investigations/${investigationId}/evidence/${evidenceId}`),

  getCases: (investigationId: string) =>
    client.get<CaseRetrieval>(`${BASE}/investigations/${investigationId}/cases`),

  recordOutcome: (investigationId: string, verdict: Verdict,
                  extras: { actual_cause?: string; actual_category?: string; note?: string } = {}) =>
    client.post<Outcome>(`${BASE}/investigations/${investigationId}/outcome`,
      { verdict, ...extras }),

  searchRunbooks: (params: { service?: string; q?: string; origin?: string; status?: string }) =>
    client.get<{ runbooks: RunbookMatch[] }>(`${BASE}/runbooks`, { params }),

  listLearned: () =>
    client.get<{ artifacts: LearnedArtifact[]; corpusSize: number }>(`${BASE}/learned`),

  forgetLearned: (artifactId: string) =>
    client.delete(`${BASE}/learned/${encodeURIComponent(artifactId)}`),

  testNotification: (channel = 'slack') =>
    client.post(`${BASE}/notifications/test`, { channel, message: 'Aura test notification' }),

  /**
   * Swallows failures and returns []. A dead Datadog token must never blank the
   * page — the panel exists precisely to show that something is misconfigured.
   */
  getIntegrationHealth: async (): Promise<IntegrationHealth[]> => {
    try {
      const r = await client.get<{ providers: IntegrationHealth[] }>(`${BASE}/providers`)
      return r.data.providers ?? []
    } catch {
      return []
    }
  },

  testProvider: (providerId: string) =>
    client.post(`${BASE}/providers/${encodeURIComponent(providerId)}/test`),
}

export default observabilityApi
