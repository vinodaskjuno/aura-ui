import client from './client'

export type ConnectorType = 'git' | 'project_mgmt' | 'itsm' | 'security' | 'storage' | 'sql' | 'mcp' | 'api'
export type GitProvider = 'github' | 'gitlab' | 'bitbucket' | 'azure_devops'
export type ProjectMgmtProvider = 'jira' | 'rally' | 'azure_boards'
export type ITSMProvider = 'servicenow'
export type SecurityProvider = 'wiz' | 'snyk'
export type StorageProvider = 's3' | 'azure_blob' | 'gcs'
export type SQLProvider = 'postgresql' | 'mysql' | 'mssql'

export interface Connector {
  connectorId: string
  userId: string
  name: string
  type: ConnectorType
  provider: string
  config: Record<string, unknown>
  projectId?: string
  serviceId?: string
  repoType?: string
  repoUrl?: string
  createdAt: string
  updatedAt: string
  testStatus: 'untested' | 'connected' | 'failed'
  lastTested: string | null
}

export interface ConnectorCreatePayload {
  name: string
  type: ConnectorType
  provider: string
  config: Record<string, unknown>
  projectId?: string
  serviceId?: string
  repoType?: string
  repoUrl?: string
}

export interface ConnectorUpdatePayload {
  name?: string
  type?: ConnectorType
  provider?: string
  config?: Record<string, unknown>
  projectId?: string
  serviceId?: string
  repoType?: string
  repoUrl?: string
}

export interface TestResult {
  success: boolean
  message: string
  latencyMs: number
}

export const getConnectors = () =>
  client.get<Connector[]>('/connectors')

export const getConnector = (id: string) =>
  client.get<Connector>(`/connectors/${id}`)

export const createConnector = (data: ConnectorCreatePayload) =>
  client.post<Connector>('/connectors', data)

export const updateConnector = (id: string, data: ConnectorUpdatePayload) =>
  client.put<Connector>(`/connectors/${id}`, data)

export const deleteConnector = (id: string) =>
  client.delete(`/connectors/${id}`)

export const testConnector = (id: string) =>
  client.post<TestResult>(`/connectors/${id}/test`)

export const getProviders = () =>
  client.get<{ types: string[]; providers: Record<string, string[]> }>('/connectors/providers/list')
