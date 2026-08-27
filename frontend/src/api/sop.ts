import client from './client'

export type SOPStage = 'dev' | 'qa' | 'aiops' | 'reverse_engineering'
export type SOPStatus = 'draft' | 'in_review' | 'approved'
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped'

export interface SOPChecklistItem {
  id: string
  text: string
  completed: boolean
}

export interface SOPStep {
  id: string
  order: number
  title: string
  description: string
  checklist: SOPChecklistItem[]
  status: StepStatus
  notes: string
  autoDetected: boolean
}

export interface SOPDocument {
  sopId: string
  projectId: string
  stage: SOPStage
  title: string
  summary: string
  steps: SOPStep[]
  status: SOPStatus
  approvedBy: string
  approvedAt: string
  generatedAt: string
  exportedAt: string
}

export const STAGE_META: Record<SOPStage, { label: string; color: string; approveRoles: string[] }> = {
  dev:                  { label: 'Dev Workspace',       color: '#4f8ef7', approveRoles: ['admin', 'super_admin'] },
  qa:                   { label: 'QA / Testing',         color: '#10b981', approveRoles: ['user_qa', 'admin', 'super_admin'] },
  aiops:                { label: 'AI Ops',               color: '#f59e0b', approveRoles: ['user_ops', 'admin', 'super_admin'] },
  reverse_engineering:  { label: 'Reverse Engineering',  color: '#8b5cf6', approveRoles: ['admin', 'super_admin'] },
}

export const sopApi = {
  generate:   (projectId: string, stage: SOPStage) =>
    client.post<SOPDocument>(`/api/sop/${projectId}/${stage}`),

  get:        (projectId: string, stage: SOPStage) =>
    client.get<SOPDocument | null>(`/api/sop/${projectId}/${stage}`),

  updateSteps:(projectId: string, stage: SOPStage,
               steps: { stepId: string; status?: StepStatus; notes?: string }[]) =>
    client.put<SOPDocument>(`/api/sop/${projectId}/${stage}/steps`, { steps }),

  toggleCheck:(projectId: string, stage: SOPStage, stepId: string, itemId: string) =>
    client.post<SOPDocument>(`/api/sop/${projectId}/${stage}/step/${stepId}/check/${itemId}`),

  approve:    (projectId: string, stage: SOPStage) =>
    client.post<SOPDocument>(`/api/sop/${projectId}/${stage}/approve`),

  export:     (projectId: string, stage: SOPStage) =>
    client.get<{ markdown: string; filename: string }>(`/api/sop/${projectId}/${stage}/export`),
}
