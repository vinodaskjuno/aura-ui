import client from './client'

export interface ChatSession {
  sessionId: string
  userId: string
  projectName: string
  projectId: string
  sessionName: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface ChatSessionDetail extends ChatSession {
  messages: ChatMessage[]
}

export interface ChatStats {
  totalSessions: number
  todaySessions: number
  totalMessages: number
}

export const getChatSessions = async (): Promise<ChatSession[]> => {
  try {
    const res = await client.get('/api/chat/sessions')
    return res.data ?? []
  } catch {
    return []
  }
}

export const getChatSession = async (sessionId: string): Promise<ChatSessionDetail | null> => {
  try {
    const res = await client.get(`/api/chat/sessions/${sessionId}`)
    return res.data
  } catch {
    return null
  }
}

export const createChatSession = async (params: {
  sessionId: string
  projectName: string
  projectId?: string
  sessionName: string
}): Promise<ChatSession | null> => {
  try {
    const res = await client.post('/api/chat/sessions', params)
    return res.data
  } catch {
    return null
  }
}

export const appendChatMessage = async (sessionId: string, role: string, content: string): Promise<void> => {
  try {
    await client.post(`/api/chat/sessions/${sessionId}/messages`, { role, content })
  } catch {
    // non-fatal — chat still works without persistence
  }
}

export const deleteChatSession = async (sessionId: string): Promise<void> => {
  await client.delete(`/api/chat/sessions/${sessionId}`)
}

export const getChatStats = async (): Promise<ChatStats> => {
  try {
    const res = await client.get('/api/chat/stats')
    return res.data
  } catch {
    return { totalSessions: 0, todaySessions: 0, totalMessages: 0 }
  }
}
