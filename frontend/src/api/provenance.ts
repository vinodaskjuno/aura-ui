import client from './client'

/**
 * Provenance API — where every node and edge came from.
 *
 * Goes through the shared axios client rather than raw `fetch`. The two calls the
 * detail panel made before this existed built their own `Authorization` header by
 * hand, which meant they silently missed every interceptor the rest of the app
 * relies on.
 */

/** The pipeline vocabulary the backend writes. Mirrors graph/provenance.py. */
export type Pipeline =
  | 'git' | 'mcp' | 'api' | 'file-upload' | 'dev-mate' | 'qa-mind'
  | 'self-learning' | 'manual' | 'correlation' | 'seed' | 'unattributed'

export type Trigger = 'manual' | 'scheduled' | 'automatic' | 'system' | 'unknown'

export type Attribution = 'traced' | 'pre-trace' | 'none'

/** Provenance properties carried on the node/edge itself. */
export interface EntityTrace {
  source?: string
  sourceDetail?: string
  sourceRecordId?: string
  pipeline?: Pipeline
  trigger?: Trigger
  actor?: string
  actorId?: string
  writtenBy?: string
  attribution?: Attribution
  firstSeenAt?: string
  firstSeenRunId?: string
  createdBy?: string
  createdVia?: string
  lastSeenAt?: string
  lastSeenRunId?: string
  versionId?: string
  createdAt?: string
  updatedAt?: string
  /** Edge-only, and only when the writer supplied them. */
  confidence?: number
  discoveredBy?: string
  factType?: 'known' | 'inferred' | 'hypothesis'
  evidence?: string[]
}

export interface RunBrief {
  runId: string
  versionNumber?: string
  pipeline?: Pipeline
  trigger?: Trigger
  actor?: string
  status?: string
  startedAt?: string
  finishedAt?: string
  durationMs?: number
  sourceDetail?: string
  sources?: string[]
  notes?: string
}

export interface TraceEvent {
  changeId: string
  timestamp: string
  changeType: string
  actor: string
  source?: string
  pipeline?: Pipeline
  trigger?: Trigger
  sourceDetail?: string
  writtenBy?: string
  runId?: string
  notes?: string
  entityKind?: string
  before?: string | null
  after?: string | null
  /** Set when the viewer may not read record contents; the event itself still shows. */
  valuesRedacted?: boolean
}

export interface ContributingSource {
  pipeline: Pipeline
  count: number
}

export interface EntityTraceResponse {
  entityKind: 'node' | 'edge'
  id: string
  externalId?: string
  label?: string
  name?: string
  type?: string
  source?: { id: string; externalId?: string; name?: string; label?: string }
  target?: { id: string; externalId?: string; name?: string; label?: string }
  trace: EntityTrace
  origin: RunBrief | null
  latest: RunBrief | null
  contributingSources: ContributingSource[]
  timeline: TraceEvent[]
  canSeeValues: boolean
}

export interface RunRecord extends RunBrief {
  versionId: string
  loadMethod?: string
  projectId?: string
  writtenBy?: string
  parentRunId?: string
  errors?: string[]
  connectorIds?: string[]
  fileInfo?: { name?: string; size?: number; type?: string }
  stats?: {
    nodesAdded?: number
    nodesUpdated?: number
    nodesUnchanged?: number
    nodesRetired?: number
    relsAdded?: number
    relsUpdated?: number
    relsArchived?: number
    totalNodes?: number
  }
}

export interface RunEntity {
  id: string
  label: string
  name: string
  externalId?: string
  change: 'new' | 'updated'
}

export interface RunDetail extends RunRecord {
  entities: RunEntity[]
  entitiesTruncated: boolean
  changes: TraceEvent[]
}

export interface PipelineHealth {
  pipeline: Pipeline
  nodes: number
  edges: number
  lastSeen: string
  lastRun?: RunBrief | null
}

export interface ProvenanceSummary {
  pipelines: PipelineHealth[]
  coverage: {
    traced: number
    partial: number
    unattributed: number
    total: number
    tracedPct: number
  }
  available: boolean
}

export const getNodeTrace = async (nodeId: string, limit = 30): Promise<EntityTraceResponse> => {
  const res = await client.get(`/api/provenance/nodes/${encodeURIComponent(nodeId)}`, {
    params: { limit },
  })
  return res.data
}

export const getEdgeTrace = async (edgeId: string, limit = 30): Promise<EntityTraceResponse> => {
  const res = await client.get(`/api/provenance/edges/${encodeURIComponent(edgeId)}`, {
    params: { limit },
  })
  return res.data
}

export const getRuns = async (params?: {
  limit?: number
  offset?: number
  pipeline?: string
  trigger?: string
  actor?: string
  status?: string
}): Promise<RunRecord[]> => {
  const res = await client.get('/api/provenance/runs', { params })
  return res.data
}

export const getRunDetail = async (runId: string, entityLimit = 200): Promise<RunDetail> => {
  const res = await client.get(`/api/provenance/runs/${encodeURIComponent(runId)}`, {
    params: { entity_limit: entityLimit },
  })
  return res.data
}

export const getProvenanceSummary = async (): Promise<ProvenanceSummary> => {
  const res = await client.get('/api/provenance/summary')
  return res.data
}
