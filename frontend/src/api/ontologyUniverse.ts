import client from './client'

export interface OntologyNode {
  id: string
  label: string
  node_type: string
  source: string
  status?: string
  externalId?: string
  hostname?: string
  ip?: string
  region?: string
  environment?: string
  severity?: string
  [key: string]: unknown
}

export interface OntologyLink {
  id?: string
  source: string | OntologyNode
  target: string | OntologyNode
  type: string
  confidence?: number
  active?: boolean
}

export interface OrgGraph {
  nodes: OntologyNode[]
  links: OntologyLink[]
  warning?: string
}

export interface SearchResult {
  id: string
  type: string
  name: string
  externalId: string
  source: string
  status: string
}

export interface AuditLogEntry {
  auditId: string
  actor: string
  action: string
  targetId: string
  before: string
  after: string
  timestamp: string
}

export interface LoadResult {
  started_at: string
  finished_at: string
  git?: Record<string, unknown>
  servicenow?: Record<string, unknown>
  wiz?: Record<string, unknown>
  correlation?: Record<string, unknown>
  error?: string
}

export interface OntologyStats {
  totalNodes: number
  totalRelationships: number
  byType: Record<string, number>
  isAvailable: boolean
}

export const getOntologyStats = async (): Promise<OntologyStats> => {
  const res = await client.get('/api/ontology/stats')
  return res.data
}

export const getOrgGraph = async (params?: {
  types?: string
  sources?: string
  limit?: number
}): Promise<OrgGraph> => {
  const res = await client.get('/api/ontology/org-graph', { params })
  return res.data
}

export const getProjectSubgraph = async (name: string, hops = 2): Promise<OrgGraph> => {
  const res = await client.get(`/api/ontology/project/${encodeURIComponent(name)}`, { params: { hops } })
  return res.data
}

export const getNodeSubgraph = async (nodeId: string, hops = 2): Promise<OrgGraph> => {
  const res = await client.get(`/api/ontology/nodes/${encodeURIComponent(nodeId)}/subgraph`, { params: { hops } })
  return res.data
}

export const searchNodes = async (q: string, type?: string, limit = 20): Promise<SearchResult[]> => {
  const res = await client.get('/api/ontology/search', { params: { q, type, limit } })
  return res.data
}

export const loadOntology = async (deltaSince?: string): Promise<LoadResult> => {
  const res = await client.post('/api/ontology/load', { delta_since: deltaSince ?? null })
  return res.data
}

export const updateNodeProperty = async (
  nodeId: string,
  prop: string,
  value: unknown
): Promise<{ ok: boolean }> => {
  const res = await client.put(`/api/ontology/nodes/${nodeId}`, { prop, value })
  return res.data
}

export const addRelationship = async (
  nodeId: string,
  toLabel: string,
  toExternalId: string,
  relType: string,
  props?: Record<string, unknown>
): Promise<{ ok: boolean }> => {
  const res = await client.post(`/api/ontology/nodes/${nodeId}/relationships`, {
    to_label: toLabel,
    to_external_id: toExternalId,
    rel_type: relType,
    props,
  })
  return res.data
}

export const archiveRelationship = async (relId: string): Promise<{ ok: boolean }> => {
  const res = await client.post(`/api/ontology/relationships/${relId}/archive`)
  return res.data
}

export const getAuditLog = async (page = 0, pageSize = 50): Promise<AuditLogEntry[]> => {
  const res = await client.get('/api/ontology/audit-log', { params: { page, page_size: pageSize } })
  return res.data
}

// ── Data Loader API ───────────────────────────────────────────────────────────

export interface OntologyVersion {
  versionId: string
  versionNumber: string
  loadMethod: 'mcp' | 'api' | 'file' | 'chat' | 'scheduler' | 'seed' | string
  sources: string[]
  actor: string
  startedAt: string
  finishedAt: string | null
  status: 'success' | 'partial' | 'failed' | 'in_progress' | string
  stats: { nodesAdded: number; nodesUpdated: number; relsAdded: number; totalNodes: number }
  diffSummary: Record<string, number>
  notes: string
  fileInfo?: { name: string; size: number; type: string }
}

export interface SchedulerJob {
  id: string
  name: string
  description: string
  schedule: string
  schedule_human: string
  status: 'idle' | 'running' | string
  last_run: string | null
  next_run: string | null
  history: Array<{ timestamp: string; status: string; duration_s: number }>
}

export const loadViaMcp = async (sources: string[], deltaSince?: string, notes?: string) => {
  const res = await client.post('/api/ontology/load/mcp', { sources, delta_since: deltaSince ?? null, notes: notes ?? '' })
  return res.data
}

export const loadViaApi = async (params: {
  url: string
  auth_type?: string
  token?: string
  username?: string
  password?: string
  api_key_header?: string
  api_key_value?: string
  notes?: string
}) => {
  const res = await client.post('/api/ontology/load/api', params)
  return res.data
}

export const loadViaFile = async (file: File, notes?: string) => {
  const form = new FormData()
  form.append('file', file)
  form.append('notes', notes ?? '')
  const res = await client.post('/api/ontology/load/file', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export const getVersions = async (limit = 50, offset = 0): Promise<OntologyVersion[]> => {
  const res = await client.get('/api/ontology/versions', { params: { limit, offset } })
  return res.data
}

export const getVersionDetail = async (versionId: string): Promise<OntologyVersion> => {
  const res = await client.get(`/api/ontology/versions/${versionId}`)
  return res.data
}

export const getNodeVersion = async (nodeId: string) => {
  const res = await client.get(`/api/ontology/nodes/${nodeId}/version`)
  return res.data
}

export const getSchedulerStatus = async (): Promise<{ jobs: SchedulerJob[] }> => {
  const res = await client.get('/api/ontology/schedule/status')
  return res.data
}

export const updateSchedule = async (jobId: string, cron: string, enabled: boolean) => {
  const res = await client.post('/api/ontology/schedule', { job_id: jobId, cron, enabled })
  return res.data
}

export const triggerSchedulerNow = async (jobId: string) => {
  const res = await client.post(`/api/ontology/schedule/run-now?job_id=${encodeURIComponent(jobId)}`)
  return res.data
}
