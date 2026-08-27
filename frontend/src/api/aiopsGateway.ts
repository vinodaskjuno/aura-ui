import client from './client'

export interface GatewayOverview {
  period: string
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  totalCostUsd: number
  totalCalls: number
  uniqueUsers: number
  gatewayCalls: number
  gatewayCostUsd: number
}

export interface ByModelRow {
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  calls: number
}

export interface ByToolRow {
  tool: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  calls: number
}

export interface ByUserRow {
  userId: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  calls: number
}

export interface TimeseriesRow {
  date: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  calls: number
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
  cost: string
  tool?: string
  source?: string
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
