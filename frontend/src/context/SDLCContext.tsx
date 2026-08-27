import React, { createContext, useContext, useEffect, useState } from 'react'

export interface Project {
  project_id: string
  name: string
  description: string
  current_phase: string
  repository_count: number
  created_at: string
}

interface SDLCContextValue {
  projects: Project[]
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  fetchProjects: () => Promise<void>
  showNewModal: boolean
  setShowNewModal: (v: boolean) => void
  addProject: (p: Project) => void
}

const SDLCContext = createContext<SDLCContextValue | null>(null)

const getToken = () => localStorage.getItem('ov_token') ?? ''

async function apiGet(path: string) {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${getToken()}` } })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export function SDLCProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)

  async function fetchProjects() {
    try {
      const data = await apiGet('/api/sdlc/projects')
      console.log('📋 Projects fetched:', data.map((p: Project) => ({ id: p.project_id.slice(0, 8), phase: p.current_phase })))
      setProjects(data)
      if (data.length > 0 && !selectedId) setSelectedId(data[0].project_id)
    } catch (e) {
      console.error('fetchProjects failed:', e)
    }
  }

  function addProject(p: Project) {
    setProjects(prev => [p, ...prev])
    setSelectedId(p.project_id)
  }

  useEffect(() => { fetchProjects() }, [])

  return (
    <SDLCContext.Provider value={{ projects, selectedId, setSelectedId, fetchProjects, showNewModal, setShowNewModal, addProject }}>
      {children}
    </SDLCContext.Provider>
  )
}

export function useSDLC() {
  const ctx = useContext(SDLCContext)
  if (!ctx) throw new Error('useSDLC must be used within SDLCProvider')
  return ctx
}
