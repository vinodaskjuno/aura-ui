import client from './client'

export interface GraphBackendStatus {
  name: string
  dialect: string
  available: boolean
  uri: string
  supportsFulltext: boolean
}

export interface GraphConfig {
  readSource: string
  writeTargets: string[]
  updatedAt: string
  updatedBy: string
  backends: GraphBackendStatus[]
  pending: Record<string, number>
}

export async function getGraphConfig(): Promise<GraphConfig> {
  const res = await client.get('/api/graph-config')
  return res.data
}

/**
 * Change which engine is read from. Takes effect without restarting the backend —
 * the setting lives in DynamoDB, not in the process-cached Settings object.
 *
 * Rejected with 409 when the target still has queued writes: reading from a store
 * known to be behind is the thing the outbox exists to prevent.
 */
export async function setGraphConfig(payload: {
  readSource: string
  writeTargets: string[]
}): Promise<GraphConfig> {
  const res = await client.put('/api/graph-config', payload)
  return res.data
}

export async function drainOutbox(backend: string): Promise<{
  backend: string; replayed: number; remaining: number; error?: string
}> {
  const res = await client.post(`/api/graph-config/drain/${encodeURIComponent(backend)}`)
  return res.data
}

export interface WipeStatus {
  enabled: boolean
  reason: string
  targets: string[]
  scopes: string[]
  demoSources: string[]
  confirmWord: string
}

export interface WipeResult {
  scope: string
  actor: string
  ok: boolean
  totalDeleted: number
  results: {
    backend: string; ok?: boolean; before?: number; after?: number
    deleted?: number; error?: string
  }[]
}

/** Whether this server was deliberately armed for wipes. Off by default. */
export async function getWipeStatus(): Promise<WipeStatus> {
  const res = await client.get('/api/graph-config/wipe-status')
  return res.data
}

/**
 * Delete graph data from every configured write target.
 *
 * `scope: 'all'` requires `confirm` to be the exact word the status endpoint
 * reports, and is irreversible — the server refuses without it.
 */
export async function wipeGraph(scope: 'demo' | 'all', confirm = ''): Promise<WipeResult> {
  const res = await client.post('/api/graph-config/wipe', { scope, confirm })
  return res.data
}
