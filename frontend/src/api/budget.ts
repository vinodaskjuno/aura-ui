import client from './client'

export interface BudgetConfig {
  orgId: string
  tier1LimitUSD: string
  tier2LimitUSD: string
  tier3LimitUSD: string
  alertThreshold: string
  tier1Models: string[]
  tier2Models: string[]
  tier3Models: string[]
}

export interface UserBudgetStatus {
  userId: string
  currentTier: number
  periodStart: string
  spend: { tier1: number; tier2: number; tier3: number }
  limits: { tier1: number; tier2: number; tier3: number }
  alertThreshold: number
}

export interface AllUserBudget {
  userId: string
  currentTier: number
  periodStart: string
  spend: { tier1: number; tier2: number; tier3: number }
  limits: { tier1: number; tier2: number; tier3: number }
}

export async function getBudgetConfig(): Promise<BudgetConfig> {
  const res = await client.get('/api/budget/config')
  return res.data
}

export async function updateBudgetConfig(updates: Partial<Omit<BudgetConfig, 'orgId'>>): Promise<BudgetConfig> {
  const res = await client.put('/api/budget/config', updates)
  return res.data
}

export async function getMyBudget(): Promise<UserBudgetStatus> {
  const res = await client.get('/api/budget/me')
  return res.data
}

export async function getAllUserBudgets(): Promise<AllUserBudget[]> {
  const res = await client.get('/api/budget/users')
  return res.data
}

export async function resetUserBudget(userId: string): Promise<void> {
  await client.post(`/api/budget/users/${encodeURIComponent(userId)}/reset`)
}
