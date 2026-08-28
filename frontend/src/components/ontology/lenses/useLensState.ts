/**
 * Lens state lives in the URL, mirrored read-only into ontologyStore.
 *
 * Why the URL and not the store: ontologyStore has no persist middleware, so a
 * store-only field resets on every reload — unacceptable for a page an
 * architect leaves open. Deep-linking a lens into a ticket is the primary use
 * case, and the page already reads `?project=`, so this is the existing pattern.
 *
 * This hook is the ONLY writer of the store mirror. Everything else reads.
 */
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useOntologyStore } from '../../../store/ontologyStore'
import { DEFAULT_LENS_ID, getLayout, getLens, lensForLayout } from './lensRegistry'
import type { LayoutId, LensDefinition, LensGrouping, LensId, LensLayoutOption } from './lensTypes'

export interface LensState {
  lens: LensDefinition
  layout: LensLayoutOption
  grouping: LensGrouping | null
  setLens: (id: LensId) => void
  setLayout: (id: LayoutId) => void
  setGrouping: (id: string) => void
  /** Open a layout, switching lens if a different lens owns it. */
  openLayout: (id: LayoutId) => void
}

export function useLensState(): LensState {
  const [searchParams, setSearchParams] = useSearchParams()

  const lens = getLens(searchParams.get('lens'))
  const layout = getLayout(lens, searchParams.get('layout'))
  const grouping =
    lens.groupings?.find(g => g.id === searchParams.get('group')) ?? lens.groupings?.[0] ?? null

  // Derived mirror for consumers rendered deep in the tree (the detail panel),
  // so the active lens need not be prop-drilled. Single writer, by contract.
  useEffect(() => {
    useOntologyStore.setState({
      lens: lens.id,
      layout: layout.id,
      grouping: grouping?.id ?? null,
    })
  }, [lens.id, layout.id, grouping?.id])

  // Always mutate a copy of the existing params: `?project=` is orthogonal
  // (it scopes the data, lens scopes the view) and must survive every write.
  const patch = (
    mutate: (p: URLSearchParams) => void,
    opts?: { replace?: boolean },
  ) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      mutate(next)
      return next
    }, opts)
  }

  return {
    lens,
    layout,
    grouping,
    // push — Back returns to the previous lens
    setLens: (id) => patch(p => {
      if (id === 'ontology') p.delete('lens')
      else p.set('lens', id)
      p.delete('layout')       // axis-2 selections are lens-specific
      p.delete('group')
    }),
    // replace — Back must not step through zoom levels
    setLayout: (id) => patch(p => {
      const isDefault = lens.layouts[0]?.id === id
      if (isDefault) p.delete('layout')
      else p.set('layout', id)
    }, { replace: true }),
    setGrouping: (id) => patch(p => p.set('group', id), { replace: true }),

    /**
     * Open a layout that may belong to another lens — the Domain and Structural
     * views are owned by the ontology lens but are launched from a Project's
     * detail panel, which is reachable from any lens.
     *
     * Must be a single URL write: setLens deliberately clears `layout` (axis-2
     * selections are lens-specific), so calling setLens then setLayout would
     * have the first call erase the second. Silently falling back to the current
     * lens's default layout is what made those buttons appear dead from the Git
     * and Infra lenses.
     */
    openLayout: (id) => {
      const owner = lensForLayout(id) ?? lens
      patch(p => {
        if (owner.id === DEFAULT_LENS_ID) p.delete('lens')
        else p.set('lens', owner.id)
        if (owner.layouts[0]?.id === id) p.delete('layout')
        else p.set('layout', id)
        p.delete('group')
      })
    },
  }
}
