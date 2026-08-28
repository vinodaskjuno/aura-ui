/**
 * The lens registry.
 *
 * Adding a lens is one import plus one array entry — that is the acceptance
 * test for "lenses are configuration, not components".
 */
import { gitLens } from './definitions/gitLens'
import { infraLens } from './definitions/infraLens'
import { ontologyLens } from './definitions/ontologyLens'
import type { LayoutId, LensDefinition, LensId, LensLayoutOption } from './lensTypes'

export const LENSES: LensDefinition[] = [ontologyLens, gitLens, infraLens].sort((a, b) => a.order - b.order)

export const DEFAULT_LENS_ID: LensId = ontologyLens.id

const BY_ID = new Map(LENSES.map(l => [l.id, l]))

export function isLensId(id: string | null | undefined): id is LensId {
  return !!id && BY_ID.has(id)
}

/** Never throws — an unknown id silently falls back to the default lens. */
export function getLens(id: string | null | undefined): LensDefinition {
  return (id && BY_ID.get(id)) || BY_ID.get(DEFAULT_LENS_ID)!
}

export function getLayout(lens: LensDefinition, id: string | null | undefined): LensLayoutOption {
  return lens.layouts.find(l => l.id === id) ?? lens.layouts[0]
}

/** Which lens owns a given layout id — lets a deep link name a layout alone. */
export function lensForLayout(id: LayoutId): LensDefinition | undefined {
  return LENSES.find(l => l.layouts.some(o => o.id === id))
}

/** The lens whose permission gates it; lenses never introduce new keys. */
export function lensPermission(lens: LensDefinition): string {
  return lens.permission ?? 'ontology'
}
