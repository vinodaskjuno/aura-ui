/**
 * Adapter: LensViewProps → the existing OntologyGraph canvas.
 *
 * OntologyGraph is 1120 lines of per-frame canvas callbacks and d3 force
 * configuration; F1 deliberately does not touch it. This maps the lens contract
 * onto its prop shape and nothing more.
 *
 * Node arrays are passed through BY REFERENCE, never copied: force-graph stamps
 * x/y/vx/vy onto the node objects and relies on that identity to persist the
 * simulation across re-renders. Copying here would reset the layout every render.
 */
import { forwardRef } from 'react'
import OntologyGraph, { type OntologyGraphRef } from '../../OntologyGraph'
import type { LensViewProps, LensViewRef } from '../lensTypes'
import type { OntologyNode, OntologyLink, ViewMode } from '../../../../types/ontology'

const ForceLensView = forwardRef<LensViewRef, LensViewProps>(function ForceLensView(props, ref) {
  const {
    layout, nodes, links, activeFilters, searchTerm,
    selectedNode, hoveredNode, selectedLink, highlightedNodeIds,
    canvasState, onNodeClick, onNodeHover, onLinkClick, onLinkHover,
  } = props

  // 'force' is a layout name; OntologyGraph's own vocabulary is 'full'.
  const currentView: ViewMode = layout.id === 'hierarchy' ? 'hierarchy' : 'full'

  return (
    <OntologyGraph
      ref={ref as unknown as React.Ref<OntologyGraphRef>}
      // The page bridges the api/ and types/ OntologyNode shapes with a cast, as
      // it did before lenses; unifying those two types is a separate refactor.
      allNodes={nodes as unknown as OntologyNode[]}
      allLinks={links as unknown as OntologyLink[]}
      currentView={currentView}
      hierarchyLevel={canvasState?.hierarchyLevel ?? 0}
      hierarchyPath={canvasState?.hierarchyPath ?? []}
      activeFilters={activeFilters}
      searchTerm={searchTerm}
      selectedNode={selectedNode as unknown as OntologyNode | null}
      hoveredNode={hoveredNode as unknown as OntologyNode | null}
      expandedNodes={canvasState?.expandedNodes ?? new Set()}
      selectedLink={selectedLink as unknown as OntologyLink | null}
      onNodeClick={onNodeClick as unknown as (n: OntologyNode | null) => void}
      onNodeHover={onNodeHover as unknown as (n: OntologyNode | null) => void}
      onExpandToggle={canvasState?.onExpandToggle ?? (() => {})}
      onHierarchyChange={canvasState?.onHierarchyChange ?? (() => {})}
      onLinkClick={onLinkClick as unknown as (l: OntologyLink) => void}
      onLinkHover={onLinkHover as unknown as (l: OntologyLink | null) => void}
      highlightedNodeIds={highlightedNodeIds}
    />
  )
})

export default ForceLensView
