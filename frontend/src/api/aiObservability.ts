import client from './client'

const BASE = '/api/ai-observability'

export interface StoreCapabilities {
  store: string
  indexedFilters: string[]
  pageFilters: string[]
  fullTextSearch: boolean
  tagFilter: boolean
  aggregations: boolean
  /** Native, queryable feedback scores. False on DynamoDB, where they are a JSON blob. */
  feedbackScores?: boolean
  /** The store is configured but unreachable — render an outage, not an empty project. */
  degraded?: boolean
  /** Whether the Opik stack is deployed at all. False → hide the embed tab. */
  opikEnabled?: boolean
  /**
   * Where a BROWSER should load the Opik UI from, resolved server-side.
   *
   * Its own origin (same host, Opik's own port) rather than a /opik/ sub-path:
   * Comet's published image is built with Vite base=/, so its assets are absolute
   * and under a sub-path the browser fetches them from Aura's origin and gets
   * Aura's own SPA back. Comes from the API rather than import.meta.env, which is
   * inlined at build time and would pin one image to one environment.
   */
  opikUiUrl?: string
  /**
   * Whether the demo agents are deployed here. Same reasoning as opikUiUrl: only the
   * infrastructure knows, so the UI is told rather than guessing — false hides the
   * trigger instead of offering a button that would 503.
   */
  demoAgentsEnabled?: boolean
  note: string
}

export interface TraceRow {
  traceId: string; projectId: string; threadId?: string; name: string
  status: string; startTime: string; latencyMs: number; spanCount: number
  totalTokens: number; costUsd: number
  inputPreview?: string; outputPreview?: string
  onlineScores?: { name: string; value: number; passed: boolean; reason?: string }[]
  /** Opik-only extras. Absent on the DynamoDB store, so all optional. */
  otelTraceId?: string
  providers?: string[]
  llmSpanCount?: number
  onlineScoredAt?: string
}

export interface Summary {
  projectId: string
  /** `exact: false` means these numbers cover the most recent `limit` traces only. */
  window: { traces: number; limit: number; exact: boolean }
  kpis: {
    traces: number; errors: number; errorRate: number
    costUsd: number; totalTokens: number
    p50LatencyMs: number; p95LatencyMs: number; avgCostUsd: number
  }
  daily: { day: string; traces: number; errors: number; costUsd: number; totalTokens: number }[]
  scores: { name: string; mean: number; count: number }[]
  providers: { provider: string; traces: number }[]
  store: string
  degraded: boolean
}

export interface OnboardingSnippet {
  label: string
  language: string
  code: string
}

export interface Onboarding {
  style: string
  projectName: string
  /** Plaintext, returned ONCE on creation. Empty when an existing key was reused. */
  apiKey: string
  apiKeyHint: string
  isNewKey: boolean
  toolLabel: string
  snippets: OnboardingSnippet[]
  notes: string[]
}

export interface SpanRow {
  spanId: string; parentSpanId: string; name: string; kind: string
  status: string; error?: string; startTime: string; latencyMs: number
  model?: string; totalTokens: number; costUsd: number
  inputPreview?: string; outputPreview?: string
  inputRef?: string; outputRef?: string
  tags?: Record<string, unknown>
}

export interface ThreadRow {
  threadId: string; traceCount: number; totalTokens: number; costUsd: number
  firstSeen: string; lastSeen: string; lastInput: string
}

export interface ProjectRow {
  projectId: string; traceCount: number; costUsd: number; lastSeen: string
}

export interface DatasetMeta {
  datasetId: string; name: string; projectId: string; description: string
  itemCount: number; createdAt: string; createdBy: string
}

export interface DatasetItem {
  itemId: string; input: string; expected: string; metadata?: Record<string, unknown>
}

export interface ScoreRow {
  name: string; value: number; passed: boolean; reason: string; costUsd: number
}

export interface ExperimentMeta {
  experimentId: string; name: string; datasetId: string; status: string
  createdAt: string; createdBy: string
  config?: Record<string, unknown>
  summary?: {
    overallPassRate?: number; totalScores?: number; totalCostUsd?: number
    itemCount?: number; failedItems?: number
    metrics?: Record<string, { mean: number; passRate: number; count: number }>
  }
}

export interface ExperimentResult {
  itemKey: string; input: string; expected: string; output: string
  passed: boolean; latencyMs: number; costUsd: number; error?: string
  scores: ScoreRow[]
}

export interface PromptVersion {
  promptId: string; version: string; template: string; hash: string
  description: string; createdAt: string; createdBy: string
}

export interface PlaygroundResult {
  output: string; rendered: string; model?: string
  inputTokens?: number; outputTokens?: number
  costUsd?: number; latencyMs?: number; error?: string | null
}

export interface OnlineEvalConfig {
  enabled: boolean; sampleRate: number; judges: string[]
  projectId: string; updatedAt?: string; updatedBy?: string
}

const get = async <T,>(path: string): Promise<T> => (await client.get(`${BASE}${path}`)).data

export const getCapabilities = () => get<StoreCapabilities>('/capabilities')
export const listProjects = () => get<{ projects: ProjectRow[] }>('/projects')

export const listTraces = (
  projectId: string,
  opts: { status?: string; threadId?: string; search?: string; limit?: number } = {},
) => {
  const p = new URLSearchParams({ projectId, limit: String(opts.limit ?? 100) })
  if (opts.status) p.set('status', opts.status)
  if (opts.threadId) p.set('threadId', opts.threadId)
  // Only sent when the caller knows the store supports it: the API returns 400
  // rather than quietly handing back an unfiltered list.
  if (opts.search) p.set('search', opts.search)
  return get<{ traces: TraceRow[] }>(`/traces?${p}`)
}

/** KPIs + daily series for the Overview tab. */
export const getSummary = (projectId: string, limit = 500) =>
  get<Summary>(`/summary?projectId=${encodeURIComponent(projectId)}&limit=${limit}`)

/** Human feedback on a trace. Lands wherever the active store keeps scores. */
export const setFeedback = async (
  traceId: string, projectId: string,
  body: { name: string; value: number; reason?: string },
) => (await client.put(
  `${BASE}/traces/${encodeURIComponent(traceId)}/feedback?projectId=${encodeURIComponent(projectId)}`,
  body)).data as { stored: boolean }

export const getTrace = (traceId: string, projectId: string) =>
  get<{ trace: TraceRow; spans: SpanRow[] }>(
    `/traces/${encodeURIComponent(traceId)}?projectId=${encodeURIComponent(projectId)}`)

/** Full payload for one span — fetched on demand because large ones live in S3. */
export const getSpanPayload = (traceId: string, spanId: string, which: 'input' | 'output') =>
  get<{ content: string; truncated: boolean }>(
    `/traces/${encodeURIComponent(traceId)}/spans/${encodeURIComponent(spanId)}/payload?which=${which}`)

export const listThreads = (projectId: string) =>
  get<{ threads: ThreadRow[] }>(`/threads?projectId=${encodeURIComponent(projectId)}`)

export const listDatasets = (projectId = '') =>
  get<{ datasets: DatasetMeta[] }>(`/datasets?projectId=${encodeURIComponent(projectId)}`)
export const getDataset = (id: string) =>
  get<{ dataset: DatasetMeta; items: DatasetItem[] }>(`/datasets/${encodeURIComponent(id)}`)
export const createDataset = async (body: { name: string; projectId: string; description?: string }) =>
  (await client.post(`${BASE}/datasets`, body)).data as DatasetMeta
export const addDatasetItem = async (id: string, body: { input: string; expected?: string }) =>
  (await client.post(`${BASE}/datasets/${encodeURIComponent(id)}/items`, body)).data
export const seedDataset = async (id: string, projectId: string, traceIds: string[]) =>
  (await client.post(`${BASE}/datasets/${encodeURIComponent(id)}/seed`,
    { projectId, traceIds })).data as { added: number }

export const listMetrics = () =>
  get<{ heuristics: string[]; judges: { name: string; label: string }[] }>('/metrics')
export const listExperiments = (projectId = '') =>
  get<{ experiments: ExperimentMeta[] }>(`/experiments?projectId=${encodeURIComponent(projectId)}`)
export const getExperiment = (id: string) =>
  get<{ experiment: ExperimentMeta; results: ExperimentResult[] }>(
    `/experiments/${encodeURIComponent(id)}`)
export const createExperiment = async (body: {
  name: string; datasetId: string; projectId: string; config: Record<string, unknown>
}) => (await client.post(`${BASE}/experiments`, body)).data as ExperimentMeta
export const runExperiment = async (id: string, body: {
  promptTemplate?: string; system?: string; limit?: number
}) => (await client.post(`${BASE}/experiments/${encodeURIComponent(id)}/run`, body)).data

/** Side-by-side experiment comparison. The endpoint has existed since the feature
 *  shipped and had neither a wrapper nor a UI. */
export const compareExperiments = (ids: string[]) =>
  get<Record<string, unknown>>(`/experiments/compare?ids=${encodeURIComponent(ids.join(','))}`)

export const listPrompts = (projectId = '') =>
  get<{ prompts: PromptVersion[] }>(`/prompts?projectId=${encodeURIComponent(projectId)}`)
export const getPrompt = (id: string) =>
  get<{ versions: PromptVersion[]; latest: PromptVersion }>(`/prompts/${encodeURIComponent(id)}`)
export const savePrompt = async (body: {
  promptId: string; template: string; projectId?: string; description?: string
}) => (await client.post(`${BASE}/prompts`, body)).data as PromptVersion
export const runPlayground = async (body: {
  template: string; variables?: Record<string, string>; system?: string
}) => (await client.post(`${BASE}/playground`, body)).data as PlaygroundResult

export const getOnlineEval = () => get<OnlineEvalConfig>('/online-eval')
export const setOnlineEval = async (body: OnlineEvalConfig) =>
  (await client.put(`${BASE}/online-eval`, body)).data as OnlineEvalConfig
export const runOnlineSweep = async () =>
  (await client.post(`${BASE}/online-eval/run`)).data

// ── Agent onboarding ─────────────────────────────────────────────────────────

export const listOnboardingStyles = () =>
  get<{ styles: string[]; default: string }>('/onboarding/styles')

/** Provisions (or reuses) a gateway key and returns copy-paste instrumentation. */
export const onboard = async (body: { style: string; projectName: string }) =>
  (await client.post(`${BASE}/onboarding`, body)).data as Onboarding

// ── Demo agents ──────────────────────────────────────────────────────────────
// Four standalone agents producing continuous traffic so these screens are never
// empty. The trigger makes them produce traces NOW, which is the difference between
// telling an audience that traffic arrives every few minutes and showing them rows
// appearing on a refresh.

export interface DemoRunResult {
  triggered: string[]
  count: number
  elapsedMs: number
  projects: string[]
}

export const DEMO_AGENTS = [
  { id: 'all', label: 'All four' },
  { id: 'rag', label: 'Support RAG' },
  { id: 'tools', label: 'Ops copilot (tools)' },
  { id: 'chat', label: 'Chat concierge (threads)' },
  { id: 'flaky', label: 'Flaky summariser (errors)' },
] as const

/**
 * Resolves only once the traces are queryable.
 *
 * The backend waits for the agents' SDK flush before answering, so the caller can
 * refresh immediately and actually see the rows — a button that returns before its
 * effect is visible is worse than no button. That also makes it slow: a burst of
 * several runs is several real model calls.
 */
export const runDemoAgents = async (agent = 'all', count = 1) =>
  (await client.post(`${BASE}/demo/run`, null, { params: { agent, count } }))
    .data as DemoRunResult

// ── Embedded Opik ────────────────────────────────────────────────────────────
// Opening the embedded UI is a browser NAVIGATION, which cannot carry an
// Authorization header — so the backend exchanges the session JWT for a short-lived
// HttpOnly cookie scoped to /opik, and nginx gates that path with an auth_request.
// Call this before rendering the iframe, and again if it 401s.

export const openOpikSession = async () => {
  await client.post(`${BASE}/opik-session`)
}

export const closeOpikSession = async () => {
  await client.delete(`${BASE}/opik-session`)
}
