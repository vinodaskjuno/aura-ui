import client from './client'

const BASE = '/api/ai-observability'

export interface StoreCapabilities {
  store: string
  indexedFilters: string[]
  pageFilters: string[]
  fullTextSearch: boolean
  tagFilter: boolean
  aggregations: boolean
  note: string
}

export interface TraceRow {
  traceId: string; projectId: string; threadId?: string; name: string
  status: string; startTime: string; latencyMs: number; spanCount: number
  totalTokens: number; costUsd: number
  inputPreview?: string; outputPreview?: string
  onlineScores?: { name: string; value: number; passed: boolean }[]
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

export const listTraces = (projectId: string, opts: { status?: string; threadId?: string } = {}) => {
  const p = new URLSearchParams({ projectId, limit: '100' })
  if (opts.status) p.set('status', opts.status)
  if (opts.threadId) p.set('threadId', opts.threadId)
  return get<{ traces: TraceRow[] }>(`/traces?${p}`)
}

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
