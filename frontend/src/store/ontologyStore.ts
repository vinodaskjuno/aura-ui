import { create } from 'zustand'
import type { OntologyNode, OntologyLink, OrgGraph, SearchResult } from '../api/ontologyUniverse'
import { getOrgGraph, getProjectSubgraph, searchNodes as apiSearch } from '../api/ontologyUniverse'

interface OntologyFilters {
  types: string[]
  sources: string[]
}

export type SpecialistView = 'smartscape' | 'domain-layer' | 'structural' | 'workspace'

interface OntologyState {
  nodes: OntologyNode[]
  links: OntologyLink[]
  isLoading: boolean
  lastLoaded: string | null
  error: string | null
  filters: OntologyFilters
  projectFocus: string | null
  specialistView: SpecialistView | null
  focusedProjectNode: OntologyNode | null

  loadOrgGraph: (filters?: OntologyFilters) => Promise<void>
  loadProjectSubgraph: (projectName: string) => Promise<void>
  setFilters: (filters: OntologyFilters) => void
  clearProjectFocus: () => void
  searchNodes: (q: string, type?: string) => Promise<SearchResult[]>
  setSpecialistView: (view: SpecialistView | null) => void
  setFocusedProjectNode: (node: OntologyNode | null) => void
  reset: () => void
}

export const useOntologyStore = create<OntologyState>((set, get) => ({
  nodes: [],
  links: [],
  isLoading: false,
  lastLoaded: null,
  error: null,
  filters: { types: [], sources: [] },
  projectFocus: null,
  specialistView: null,
  focusedProjectNode: null,

  loadOrgGraph: async (filters) => {
    const activeFilters = filters ?? get().filters
    set({ isLoading: true, error: null, projectFocus: null })
    try {
      const params: Record<string, string | number> = {}
      if (activeFilters.types.length) params.types = activeFilters.types.join(',')
      if (activeFilters.sources.length) params.sources = activeFilters.sources.join(',')
      const data: OrgGraph = await getOrgGraph(params as any)
      set({
        nodes: data.nodes,
        links: data.links,
        isLoading: false,
        lastLoaded: new Date().toISOString(),
        error: data.warning ?? null,
      })
    } catch (err: any) {
      set({ isLoading: false, error: err.message ?? 'Failed to load org graph' })
    }
  },

  loadProjectSubgraph: async (projectName: string) => {
    set({ isLoading: true, error: null, projectFocus: projectName })
    try {
      const data: OrgGraph = await getProjectSubgraph(projectName)
      set({
        nodes: data.nodes,
        links: data.links,
        isLoading: false,
        lastLoaded: new Date().toISOString(),
      })
    } catch (err: any) {
      set({ isLoading: false, error: err.message ?? 'Failed to load project subgraph' })
    }
  },

  setFilters: (filters) => {
    set({ filters })
    get().loadOrgGraph(filters)
  },

  clearProjectFocus: () => {
    set({ projectFocus: null })
    get().loadOrgGraph()
  },

  searchNodes: async (q: string, type?: string) => {
    return apiSearch(q, type)
  },

  setSpecialistView: (view) => {
    set({ specialistView: view })
  },

  setFocusedProjectNode: (node) => {
    set({ focusedProjectNode: node })
  },

  reset: () => {
    set({ nodes: [], links: [], isLoading: false, lastLoaded: null, error: null, projectFocus: null, specialistView: null, focusedProjectNode: null })
  },
}))
