import client from './client'

export interface Alert {
  alertId: string
  source: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'ok'
  service: string
  message: string
  timestamp: string
  state: string
  namespace?: string
  metricName?: string
  rootCause?: string
}

export interface AIOpsKPIs {
  activeAlarms: number
  totalAlerts: number
  agentRuns: number
  liveConnected: boolean
  tick?: number
}

export interface Pipeline {
  runId: string
  intent: string
  agents: string[]
  status: string
  completedAt: string
}

export const aiopsApi = {
  getAlerts: () => client.get<Alert[]>('/api/aiops/alerts'),
  getKpis: () => client.get<AIOpsKPIs>('/api/aiops/kpis'),
  getPipelines: () => client.get<Pipeline[]>('/api/aiops/pipelines'),
  getRcaReports: (projectId: string) => client.get(`/api/aiops/rca/${projectId}`),
  triggerRca: () => client.post('/api/aiops/rca/trigger'),
  acknowledgeAlert: (alertId: string, note = '') =>
    client.post('/api/aiops/alerts/acknowledge', { alertId, note }),
}

export const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#f59e0b',
  low:      '#3b82f6',
  ok:       '#10b981',
}
