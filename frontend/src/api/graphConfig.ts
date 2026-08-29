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
