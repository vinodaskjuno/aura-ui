import { create } from 'zustand'
import type { OverlayMode } from '../components/provenance/overlayPalette'

/**
 * Which provenance overlay the canvas is showing.
 *
 * Kept out of `ontologyStore` because that store mirrors graph DATA; this is a
 * view setting, and mixing the two is how a store ends up reloading the graph when
 * somebody changes a colour.
 */
interface ProvenanceOverlayState {
  mode: OverlayMode
  setMode: (mode: OverlayMode) => void
}

export const useProvenanceOverlayStore = create<ProvenanceOverlayState>((set) => ({
  mode: 'type',
  setMode: (mode) => set({ mode }),
}))
