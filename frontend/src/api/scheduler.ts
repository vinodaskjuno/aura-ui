import client from './client'

export interface SchedulerJob {
  id: string
  name: string
  description: string
  schedule: string
  schedule_human: string
  status: 'idle' | 'running' | 'error'
  last_run: string | null
  next_run: string | null
}

export interface JobRunRecord {
  timestamp: string
  duration_s: number
  status: 'success' | 'error'
  result: Record<string, unknown>
}

export const getJobs = async (): Promise<SchedulerJob[]> => {
  const res = await client.get('/api/scheduler/jobs')
  return res.data
}

export const triggerJob = async (jobId: string): Promise<{ ok: boolean; status: string }> => {
  const res = await client.post(`/api/scheduler/jobs/${jobId}/run`)
  return res.data
}

export const getJobHistory = async (jobId: string): Promise<JobRunRecord[]> => {
  const res = await client.get(`/api/scheduler/jobs/${jobId}/history`)
  return res.data
}
