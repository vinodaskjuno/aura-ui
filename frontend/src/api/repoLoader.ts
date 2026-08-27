import client from './client'

export interface ServiceRecord {
  serviceId: string
  projectId: string
  name: string
  description: string
  techStack: string[]
  repoCount: number
  repos: RepoAttachment[]
  status: 'pending' | 'ingesting' | 'ingested' | 'failed'
  lastIngested: string | null
  ontologyStats: OntologyStats
  createdAt: string
  updatedAt: string
}

export interface RepoAttachment {
  repoId: string
  repoUrl: string
  repoType: RepoType
  branch: string
  name: string
  localPath: string
  hasToken: boolean
  tokenMasked: string
  addedAt: string
}

export interface OntologyStats {
  nodes_added?: number
  rels_added?: number
  apis_count?: number
  databases_count?: number
  dependencies_count?: number
  tech_stack?: string[]
}

export interface IngestJob {
  status: 'running' | 'done' | 'failed'
  log: string[]
  result: IngestResult | null
  startedAt: string
  finishedAt?: string
}

export interface IngestResult {
  nodes_added: number
  rels_added: number
  apis_count: number
  databases_count: number
  dependencies_count: number
  tech_stack: string[]
  description: string
  log: string[]
}

export type RepoType =
  | 'auto' | 'mule' | 'spring' | 'python'
  | 'ui-react' | 'ui-angular' | 'terraform'
  | 'cicd' | 'config' | 'library' | 'unknown'

export const REPO_TYPE_LABELS: Record<RepoType, string> = {
  auto:        'Auto-Detect',
  mule:        'Mule 4',
  spring:      'Spring Boot (Java)',
  python:      'Python (FastAPI/Django)',
  'ui-react':  'React / Next.js',
  'ui-angular':'Angular',
  terraform:   'Terraform / CloudFormation',
  cicd:        'Jenkins / GitHub Actions / K8s',
  config:      'Config / RAML / OpenAPI',
  library:     'Library / Shared Module',
  unknown:     'Unknown',
}

export const REPO_TYPE_ICONS: Record<RepoType, string> = {
  auto:        '🔍',
  mule:        '🔷',
  spring:      '☕',
  python:      '🐍',
  'ui-react':  '⚛️',
  'ui-angular':'🅰️',
  terraform:   '🏗️',
  cicd:        '⚙️',
  config:      '📄',
  library:     '📦',
  unknown:     '❓',
}

// ── Services CRUD ─────────────────────────────────────────────────────────────

export async function listServices(projectId: string): Promise<ServiceRecord[]> {
  const res = await client.get(`/api/projects/${projectId}/services`)
  return res.data
}

export async function getService(projectId: string, serviceId: string): Promise<ServiceRecord> {
  const res = await client.get(`/api/projects/${projectId}/services/${serviceId}`)
  return res.data
}

export async function createService(
  projectId: string,
  data: { name: string; description?: string }
): Promise<ServiceRecord> {
  const res = await client.post(`/api/projects/${projectId}/services`, data)
  return res.data
}

export async function updateService(
  projectId: string,
  serviceId: string,
  data: { name?: string; description?: string }
): Promise<ServiceRecord> {
  const res = await client.put(`/api/projects/${projectId}/services/${serviceId}`, data)
  return res.data
}

export async function deleteService(projectId: string, serviceId: string): Promise<void> {
  await client.delete(`/api/projects/${projectId}/services/${serviceId}`)
}

// ── Repo management ───────────────────────────────────────────────────────────

export async function addRepo(
  projectId: string,
  serviceId: string,
  data: {
    repoUrl: string
    repoType: RepoType
    token?: string
    branch?: string
    localPath?: string
    name?: string
  }
): Promise<RepoAttachment> {
  const res = await client.post(
    `/api/projects/${projectId}/services/${serviceId}/repos`,
    data
  )
  return res.data
}

export async function removeRepo(
  projectId: string,
  serviceId: string,
  repoId: string
): Promise<void> {
  await client.delete(`/api/projects/${projectId}/services/${serviceId}/repos/${repoId}`)
}

// ── Ingestion ─────────────────────────────────────────────────────────────────

export async function ingestService(
  projectId: string,
  serviceId: string
): Promise<{ jobId: string; status: string }> {
  const res = await client.post(`/api/projects/${projectId}/services/${serviceId}/ingest`)
  return res.data
}

export async function pollIngestStatus(
  projectId: string,
  serviceId: string,
  jobId: string
): Promise<IngestJob> {
  const res = await client.get(
    `/api/projects/${projectId}/services/${serviceId}/ingest/status?job_id=${jobId}`
  )
  return res.data
}

export async function ingestAll(
  projectId: string
): Promise<{ jobId: string; status: string; serviceCount: number }> {
  const res = await client.post(`/api/projects/${projectId}/services/ingest-all`)
  return res.data
}
