import client from './client'

export interface UploadResult {
  upload_id: string
  filename: string
  file_type: string
  uploaded_at: string
  triples_inserted: number
  entities: Record<string, number>
  error?: string
  metadata: Record<string, unknown>
}

export const uploadFile = (file: File): Promise<{ data: UploadResult }> => {
  const form = new FormData()
  form.append('file', file)
  return client.post('/upload/file', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const getUploadHistory = (): Promise<{ data: UploadResult[] }> =>
  client.get('/upload/history')

export const deleteUpload = (id: string): Promise<void> =>
  client.delete(`/upload/${id}`)
