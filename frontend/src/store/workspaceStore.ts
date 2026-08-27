import { create } from 'zustand'
import type { OntologyNode } from '../api/ontologyUniverse'

export type PersonaMode = 'non-technical' | 'junior-dev' | 'experienced-dev'
export type LearnMode = 'tour' | 'contextual'

export interface PersonaLayout {
  gridTemplateAreas: string
  gridCols: string
  gridRows: string
  showCode: boolean
  showChat: boolean
  showLearn: boolean
}

export const PERSONA_LAYOUTS: Record<PersonaMode, PersonaLayout> = {
  'non-technical': {
    gridTemplateAreas: '"search search" "graph learn"',
    gridCols: '2fr 1fr',
    gridRows: '52px 1fr',
    showCode: false,
    showChat: false,
    showLearn: true,
  },
  'junior-dev': {
    gridTemplateAreas: '"search search" "graph code" "chat learn"',
    gridCols: '1fr 1fr',
    gridRows: '52px 1.2fr 0.8fr',
    showCode: true,
    showChat: true,
    showLearn: true,
  },
  'experienced-dev': {
    gridTemplateAreas: '"search search" "graph code" "chat learn"',
    gridCols: '0.85fr 1.15fr',
    gridRows: '52px 1fr 1fr',
    showCode: true,
    showChat: true,
    showLearn: true,
  },
}

interface WorkspaceState {
  persona: PersonaMode
  selectedNode: OntologyNode | null
  searchQuery: string
  searchHighlightIds: Set<string>
  learnMode: LearnMode
  learnContent: string
  learnLoading: boolean
  learnTourIndex: number

  setPersona: (p: PersonaMode) => void
  setSelectedNode: (n: OntologyNode | null) => void
  setSearchQuery: (q: string) => void
  setSearchHighlightIds: (ids: Set<string>) => void
  setLearnMode: (m: LearnMode) => void
  setLearnContent: (content: string) => void
  setLearnLoading: (v: boolean) => void
  advanceTour: () => void
  retreatTour: () => void
  reset: () => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  persona: 'junior-dev',
  selectedNode: null,
  searchQuery: '',
  searchHighlightIds: new Set(),
  learnMode: 'contextual',
  learnContent: '',
  learnLoading: false,
  learnTourIndex: 0,

  setPersona: (p) => set({ persona: p }),
  setSelectedNode: (n) => set({ selectedNode: n }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSearchHighlightIds: (ids) => set({ searchHighlightIds: ids }),
  setLearnMode: (m) => set({ learnMode: m }),
  setLearnContent: (content) => set({ learnContent: content }),
  setLearnLoading: (v) => set({ learnLoading: v }),
  advanceTour: () => set((s) => ({ learnTourIndex: s.learnTourIndex + 1 })),
  retreatTour: () => set((s) => ({ learnTourIndex: Math.max(0, s.learnTourIndex - 1) })),
  reset: () => set({
    selectedNode: null,
    searchQuery: '',
    searchHighlightIds: new Set(),
    learnContent: '',
    learnLoading: false,
    learnTourIndex: 0,
  }),
}))
