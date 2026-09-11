import client from './client'

export interface RepoConfig {
  repoType: string
  sourceType: 'git' | 'local'
  repoUrl?: string
  localPath?: string
  token?: string
  branch?: string
}

export interface Project {
  projectId: string
  userId: string
  name: string
  description: string
  environment: string
  status: string
  createdAt: string
  updatedAt: string
  repoCount: number
}

export interface KnowledgeGraph {
  project_id: string
  code?: { languages: string[]; services: string[]; tech_stack: string[] }
  infra?: any[]
  db_servers?: any[]
  correlations?: Array<{ from: string; to: string; relationship: string }>
  nodes?: any[]
  edges?: any[]
}

export interface ActivityEntry {
  userId: string
  timestamp: string
  agent: string
  runId: string
  projectId: string
  message: string
}

/** One store, and how many of this project's rows are in it. */
export interface DeletionTable {
  table:  string
  rows:   number
  /** Kept on purpose — the `why` says which reason. */
  kept:   boolean
  why:    string
  method: string
}

/** Something that will NOT be deleted, and why the user should be told. */
export interface DeletionExclusion {
  what:   string
  detail: string
  count:  number | null
}

export interface DeletionPreview {
  projectId:     string
  projectName:   string
  /** What must be typed to confirm — the project's name. */
  confirmPhrase: string
  owner:         { userId?: string; username?: string }
  dynamodb:      { totalRows: number; tables: DeletionTable[] }
  s3:            { objects: number; bytes: number
                   prefixes: { bucket: string; prefix: string
                               objects: number; bytes: number }[] }
  workspace:     { exists: boolean; path: string; files: number; bytes: number }
  graph:         { nodes: number; engines: Record<string, {
                     ok: boolean; error?: string
                     byLabel?: Record<string, number>
                     excluded?: Record<string, number>
                     crossingEdges?: number }> }
  excluded:      DeletionExclusion[]
  /** Reasons it cannot run yet — a pending outbox, an engine down, a live QA run. */
  blockers:      string[]
  canDelete:     boolean
}

export interface DeletionResult {
  ok:         boolean
  dryRun?:    boolean
  retryable?: boolean
  report:     Record<string, unknown>
}

export const projectsApi = {
  list: () => client.get<Project[]>('/api/projects'),
  create: (data: any) => client.post<Project>('/api/projects', data),
  seedSamples: () => client.post('/api/projects/seed/samples'),
  get: (id: string) => client.get<Project>(`/api/projects/${id}`),
  update: (id: string, data: any) => client.put<Project>(`/api/projects/${id}`, data),
  /** What deleting this project would remove, and what it would spare. */
  deletionPreview: (id: string) =>
    client.get<DeletionPreview>(`/api/projects/${id}/deletion-preview`),
  /** `confirm` must equal the project's NAME — the backend refuses anything else.
   *  The realistic accident is deleting the wrong project, and a constant word like
   *  "DELETE" does nothing to prevent that. */
  delete: (id: string, confirm: string, dryRun = false) =>
    client.request<DeletionResult>({
      url: `/api/projects/${id}`, method: 'DELETE', data: { confirm, dryRun },
    }),
  getConnectors: (id: string) => client.get(`/api/projects/${id}/connectors`),
  getKnowledgeGraph: (id: string) => client.get<KnowledgeGraph>(`/api/projects/${id}/knowledge-graph`),
  getActivity: (id: string) => client.get<ActivityEntry[]>(`/api/projects/${id}/activity`),
  analyse: (id: string) => client.post(`/api/projects/${id}/analyse`),
  // Adding a connector after creation is the only order that works for uploaded
  // folders: the upload needs a projectId, so the project must exist first.
  addConnector: (id: string, repo: Record<string, unknown>) =>
    client.post(`/api/projects/${id}/connectors`, repo),
}
