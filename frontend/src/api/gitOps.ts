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

export interface CloneResult {
  success: boolean
  clonedPath: string
  message: string
}

export interface PendingChange {
  path: string
  diff: string
  additions: number
  deletions: number
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

/**
 * Clone (or fast-forward) a project's repo into the server workspace.
 *
 * This is the precondition for DevMate's file tools: react_orchestrator only
 * attaches list_files/read_file/write_file/get_diff when a clone exists. Nothing
 * used to call this endpoint, which is why the agent always ran tool-less.
 *
 * `repoUrl` may be a local path — pass `file:///abs/path` for a local fixture.
 */
export async function cloneRepo(payload: {
  projectId: string
  repoUrl: string
  branch?: string
  token?: string
}): Promise<CloneResult> {
  const res = await client.post('/api/git/clone', {
    projectId: payload.projectId,
    repoUrl: payload.repoUrl,
    branch: payload.branch || 'main',
    token: payload.token || '',
  })
  return res.data
}

/** Changes the agent has proposed but not yet written to disk. */
export async function listPendingChanges(projectId: string): Promise<PendingChange[]> {
  const res = await client.get(`/api/git/pending/${encodeURIComponent(projectId)}`)
  return res.data.changes ?? []
}

/** Write a staged change to disk. */
export async function applyChange(projectId: string, path: string): Promise<{ success: boolean }> {
  const res = await client.post('/api/git/pending/apply', { projectId, path })
  return res.data
}

/** Drop a staged change without writing it. */
export async function discardChange(projectId: string, path: string): Promise<{ success: boolean }> {
  const res = await client.post('/api/git/pending/discard', { projectId, path })
  return res.data
}
