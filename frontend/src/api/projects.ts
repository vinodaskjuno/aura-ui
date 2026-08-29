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

export const projectsApi = {
  list: () => client.get<Project[]>('/api/projects'),
  create: (data: any) => client.post<Project>('/api/projects', data),
  seedSamples: () => client.post('/api/projects/seed/samples'),
  get: (id: string) => client.get<Project>(`/api/projects/${id}`),
  update: (id: string, data: any) => client.put<Project>(`/api/projects/${id}`, data),
  delete: (id: string) => client.delete(`/api/projects/${id}`),
  getConnectors: (id: string) => client.get(`/api/projects/${id}/connectors`),
  getKnowledgeGraph: (id: string) => client.get<KnowledgeGraph>(`/api/projects/${id}/knowledge-graph`),
  getActivity: (id: string) => client.get<ActivityEntry[]>(`/api/projects/${id}/activity`),
  analyse: (id: string) => client.post(`/api/projects/${id}/analyse`),
  // Adding a connector after creation is the only order that works for uploaded
  // folders: the upload needs a projectId, so the project must exist first.
  addConnector: (id: string, repo: Record<string, unknown>) =>
    client.post(`/api/projects/${id}/connectors`, repo),
}
