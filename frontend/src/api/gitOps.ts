import client from './client'

export interface BranchListResult {
  branches: string[]
  defaultBranch: string
}

export interface BranchCreateResult {
  success: boolean
  branch: string
  message: string
}

export interface PRCreateResult {
  success: boolean
  prUrl: string
  prNumber: number
}

export async function listBranches(url: string, token: string): Promise<BranchListResult> {
  const params = new URLSearchParams({ url, token })
  const res = await client.get(`/api/git/branches?${params}`)
  return res.data
}

export async function createBranch(payload: {
  repoUrl: string
  token: string
  baseBranch: string
  newBranchName: string
}): Promise<BranchCreateResult> {
  const res = await client.post('/api/git/branch', payload)
  return res.data
}

export async function createPR(payload: {
  repoUrl: string
  token: string
  baseBranch: string
  headBranch: string
  title: string
  body: string
  changedFiles?: string[]
}): Promise<PRCreateResult> {
  const res = await client.post('/api/git/pr', payload)
  return res.data
}
