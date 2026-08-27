import client from './client'

export interface GatewayOverview {
  period: string
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadTokens: number
  totalCacheCreationTokens: number
  totalTokens: number
  totalCostUsd: number
  totalCalls: number
  uniqueUsers: number
  uniqueModels: number
  cacheHitRate: number
  avgLatencyMs: number
  errorRate: number
  claudeCodeCalls: number
  claudeCodeCostUsd: number
  /** @deprecated retained for backwards compatibility — same as totalCalls */
  gatewayCalls: number
  /** @deprecated retained for backwards compatibility — same as totalCostUsd */
  gatewayCostUsd: number
}

/**
 * Fields shared by every usage breakdown row.
 *
 * Cache tokens are not a detail: on a Claude Code session cache reads are
 * typically the majority of token volume, billed at ~0.1x the input rate.
 * Folding them into `inputTokens` overstates cost significantly.
 */
export interface UsageMetrics {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  totalTokens: number
  costUsd: number
  calls: number
  errors: number
  /** cacheReadTokens as a percentage of totalTokens */
  cacheHitRate: number
  avgLatencyMs: number
  errorRate: number
}

export interface ByModelRow extends UsageMetrics {
  model: string
}

export interface ByToolRow extends UsageMetrics {
  tool: string
}

export interface ByUserRow extends UsageMetrics {
  userId: string
}

export interface TimeseriesRow extends UsageMetrics {
  date: string
}

/** One (tool, model) pair — the model-wise matrix. */
export interface ByToolModelRow extends UsageMetrics {
  tool: string
  model: string
}

/**
 * Claude Code usage, from Claude Code's own OpenTelemetry export (received at
 * /otlp/v1/logs). Cost is what Claude Code itself reported, so it reconciles
 * with the /usage command inside a Claude Code session.
 */
export interface ClaudeCodeUsage {
  period: string
  totals: UsageMetrics
  byModel: ByModelRow[]
  /** CLI vs VS Code extension vs SDK */
  bySurface: ByToolRow[]
  byModelSurface: ByToolModelRow[]
  timeseries: TimeseriesRow[]
}

export interface Provider {
  providerId: string
  name: string
  protocol: string
  baseUrl: string
  apiKey?: string
  enabled: boolean
  description?: string
}

export interface ProviderHealth {
  providerId: string
  healthy: boolean
  statusCode: number
  error?: string
  checkedAt: string
}

export interface Budget {
  pk: string
  entityType: string
  entityId: string
  limitUsd: string
  period: string
  action: string
  enabled: boolean
}

export interface BudgetStatus {
  tier: string
  spentUsd: number
  limitUsd: number
  pct: number
}

export interface GatewayKey {
  keyId: string
  userId: string
  label?: string
  toolLabel?: string
  active: boolean
  createdAt: string
  keyHint?: string
}

export interface AuditLog {
  userId: string
  sortKey: string
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
  cost: string
  /** Cost the provider itself reported, when available. */
  reportedCost?: string
  /** Our own estimate — compare against reportedCost to spot stale rate cards. */
  computedCost?: string
  tool?: string
  source?: string
  sessionId?: string
  querySource?: string
  timestamp: string
  latencyMs?: number
  statusCode?: number
}

const BASE = '/api/aiops/gateway'

export const aiopsGatewayApi = {
  // Usage
  getOverview:   (period = 'today') => client.get<GatewayOverview>(`${BASE}/usage/overview?period=${period}`),
  getByModel:    (period = '7d')    => client.get<{ byModel: ByModelRow[] }>(`${BASE}/usage/by-model?period=${period}`),
  getByTool:     (period = '7d')    => client.get<{ byTool: ByToolRow[] }>(`${BASE}/usage/by-tool?period=${period}`),
  getByUser:     (period = '7d')    => client.get<{ byUser: ByUserRow[] }>(`${BASE}/usage/by-user?period=${period}`),
  getTimeseries: (period = '14d')   => client.get<{ timeseries: TimeseriesRow[] }>(`${BASE}/usage/timeseries?period=${period}`),
  getByToolModel: (period = '7d')    => client.get<{ byToolModel: ByToolModelRow[] }>(`${BASE}/usage/by-tool-model?period=${period}`),
  getClaudeCode:  (period = '7d')    => client.get<ClaudeCodeUsage>(`${BASE}/usage/claude-code?period=${period}`),

  // Providers
  getProviders:   ()                         => client.get<Provider[]>(`${BASE}/providers`),
  addProvider:    (data: Partial<Provider>)   => client.post<Provider>(`${BASE}/providers`, data),
  deleteProvider: (id: string)               => client.delete(`${BASE}/providers/${id}`),

  // Budgets
  getBudgets:     ()                         => client.get<Budget[]>(`${BASE}/budgets`),
  getBudgetStatus: ()                        => client.get<BudgetStatus>(`${BASE}/budgets/status`),
  upsertBudget:   (data: Partial<Budget>)    => client.post<Budget>(`${BASE}/budgets`, data),
  deleteBudget:   (type: string, id: string) => client.delete(`${BASE}/budgets/${type}/${id}`),

  // Keys
  getKeys:   ()            => client.get<GatewayKey[]>(`${BASE}/keys`),
  revokeKey: (id: string)  => client.delete(`${BASE}/keys/${id}`),

  // Health
  getHealth:         ()  => client.get<{ providers: ProviderHealth[] }>(`${BASE}/health`),
  triggerHealthProbe: () => client.post(`${BASE}/health/probe`, {}),

  // Audit logs
  getAuditLogs: (params: {
    filter_user?: string
    filter_model?: string
    filter_tool?: string
    from_ts?: string
    to_ts?: string
    limit?: number
  }) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, String(v)) })
    return client.get<{ total: number; logs: AuditLog[] }>(`${BASE}/audit-logs?${qs}`)
  },
}
