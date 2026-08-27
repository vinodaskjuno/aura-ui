import client from './client'

export interface TokenMetrics {
  period: string
  totalInputTokens: number
  totalOutputTokens: number
  totalCost: number
  totalSessions: number
  totalCalls: number
  byModel: Array<{
    model: string
    inputTokens: number
    outputTokens: number
    cost: number
    calls: number
  }>
}

export interface ProjectMetric {
  projectId: string
  projectName: string
  inputTokens: number
  outputTokens: number
  cost: number
  sessions: number
}

export interface UserMetric {
  userId: string
  username: string
  inputTokens: number
  outputTokens: number
  cost: number
  sessions: number
}

export type MetricPeriod = 'today' | 'week' | 'month' | 'all'

export async function getTokenMetrics(period: MetricPeriod = 'today'): Promise<TokenMetrics> {
  const res = await client.get(`/api/metrics/tokens?period=${period}`)
  return res.data
}

export async function getProjectMetrics(period: MetricPeriod = 'today'): Promise<ProjectMetric[]> {
  const res = await client.get(`/api/metrics/tokens/projects?period=${period}`)
  return res.data
}

export async function getUserMetrics(period: MetricPeriod = 'today'): Promise<UserMetric[]> {
  const res = await client.get(`/api/metrics/tokens/users?period=${period}`)
  return res.data
}
