import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { OntologyNode, OntologyLink } from '../types/ontology'
import { useOntologyStore } from '../store/ontologyStore'
import { useAuthStore } from '../store/authStore'
import LensViewHost from '../components/ontology/lenses/LensViewHost'
import { useLensState } from '../components/ontology/lenses/useLensState'
import {
  applyLensFilters, buildLensContext, nodeTypeFilterSet, resolveFilterGroups,
  type ActiveFilters,
} from '../components/ontology/lenses/lensSelectors'
import LensLegend from '../components/ontology/lenses/LensLegend'
import LensKpiBar, { KPI_BAR_HEIGHT } from '../components/ontology/lenses/LensKpiBar'
import LensDetailSections from '../components/ontology/lenses/LensDetailSections'
import { checkLensDrift } from '../components/ontology/lenses/lensDriftCheck'
import type { LensViewRef } from '../components/ontology/lenses/lensTypes'
import OntologyTopBar from '../components/ontology/OntologyTopBar'
import OntologyFilters from '../components/ontology/OntologyFilters'
import OntologyZoomControls from '../components/ontology/OntologyZoomControls'
import OntologyBreadcrumb from '../components/ontology/OntologyBreadcrumb'
import OntologyDetailPanel from '../components/ontology/OntologyDetailPanel'
import RelationshipDetailPanel from '../components/ontology/RelationshipDetailPanel'
import { useGraphTheme } from '../hooks/useGraphTheme'
import StarsBackground from '../components/ontology/StarsBackground'
import WelcomeOverlay from '../components/ontology/WelcomeOverlay'
import NodeTooltip from '../components/ontology/NodeTooltip'
import OntologyMaintainerChat from '../components/ontology/OntologyMaintainerChat'
import TourGuide from '../components/ontology/TourGuide'

export default function OntologyVisualizerPage() {
  const gt = useGraphTheme()
  const graphRef = useRef<LensViewRef>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const projectParam = searchParams.get('project')
  const nodeParam = searchParams.get('node')

  // Axis 1 = lens (which slice), axis 2 = layout (how it is drawn). Both live
  // in the URL so a view survives reload and can be pasted into a ticket.
  const { lens, layout, grouping, setLens, setLayout, setGrouping, openLayout } = useLensState()

  const { nodes: storeNodes, links: storeLinks, isLoading, error, projectFocus,
    loadOrgGraph, loadProjectSubgraph, focusedProjectNode } = useOntologyStore()
  const { hasPermission } = useAuthStore()
  const canMaintain = hasPermission('ontology_maintain')

  // Cast store data to local types (compatible shapes)
  const allNodes = storeNodes as unknown as OntologyNode[]
  const allLinks = storeLinks as unknown as OntologyLink[]

  // Indexed once per (graph, lens); consumed by KPIs, cards and traversal.
  const ctx = useMemo(
    () => buildLensContext(lens, storeNodes, storeLinks),
    [lens, storeNodes, storeLinks],
  )

  const filterGroups = useMemo(() => resolveFilterGroups(lens, ctx), [lens, ctx])

  // Chrome sits below the topbar, and below the KPI strip when that is shown.
  const chromeTop = 80 + (layout.chrome.kpiBar ? KPI_BAR_HEIGHT : 0)


  // View state
  const [isPresentationMode, setIsPresentationMode] = useState(false)
  const [showMaintainerChat, setShowMaintainerChat] = useState(false)
  const [showTourGuide, setShowTourGuide] = useState(false)

  // Hierarchy state
  const [hierarchyLevel, setHierarchyLevel] = useState(0)
  const [hierarchyPath, setHierarchyPath] = useState<string[]>([])

  // Selection state
  const [selectedNode, setSelectedNode] = useState<OntologyNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<OntologyNode | null>(null)
  const [selectedLink, setSelectedLink] = useState<OntologyLink | null>(null)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  // Filter state — keyed by filter-group id, so a lens can filter on several
  // dimensions at once (type × language × owner, or env × region × provider).
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({})

  // Non-type filters are applied here; type filters pass through to the canvas,
  // which matches them itself and keys its group-hub synthesis on "none active".
  // .filter() preserves node object identity, which force-graph's simulation
  // depends on.
  const visibleNodes = useMemo(
    () => applyLensFilters(ctx, activeFilters, filterGroups),
    [ctx, activeFilters, filterGroups],
  )
  const typeFilters = useMemo(
    () => nodeTypeFilterSet(activeFilters, filterGroups),
    [activeFilters, filterGroups],
  )

  const [searchTerm, setSearchTerm] = useState('')

  // Highlight state — set from OntologyMaintainerChat when user clicks "Highlight in graph"
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set())

  // UI state
  const [showWelcome, setShowWelcome] = useState(false)
  const [mouseX, setMouseX] = useState(0)
  const [mouseY, setMouseY] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Dev-only: warn if the frontend registry has drifted from the server's
  // lens definitions. No-op in production.
  useEffect(() => { void checkLensDrift() }, [])

  // Load on mount — respect ?project= query param
  useEffect(() => {
    if (projectParam) {
      loadProjectSubgraph(projectParam)
    } else {
      loadOrgGraph()
    }
  }, [projectParam])

  // Deep link: ?node= selects a node once the graph is present. Matched against
  // elementId, externalId and label because callers paste whichever they have.
  const restoredNode = useRef<string | null>(null)
  useEffect(() => {
    if (!nodeParam || !allNodes.length || restoredNode.current === nodeParam) return
    const match = allNodes.find(n =>
      n.id === nodeParam
      || (n as unknown as Record<string, unknown>).externalId === nodeParam
      || n.label === nodeParam)
    if (match) {
      restoredNode.current = nodeParam
      setSelectedNode(match)
      graphRef.current?.zoomToFit(600, 80)
    }
  }, [nodeParam, allNodes])

  // Mirror the selection back into the URL, replacing so selections do not
  // accumulate in history.
  useEffect(() => {
    const current = searchParams.get('node')
    const want = selectedNode
      ? String((selectedNode as unknown as Record<string, unknown>).externalId ?? selectedNode.id)
      : null
    if (current === want) return
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (want) next.set('node', want)
      else next.delete('node')
      return next
    }, { replace: true })
    restoredNode.current = want
    // searchParams is a dependency: the effect writes it, then re-runs and
    // early-returns on the `current === want` guard, so it settles immediately.
  }, [selectedNode, searchParams, setSearchParams])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? '').toLowerCase()
      const isTyping = tag === 'input' || tag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable
      if (e.code === 'Space' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (isTyping) return
        e.preventDefault()
        graphRef.current?.zoomToFit()
      } else if (e.code === 'Escape') {
        if (selectedLink) { setSelectedLink(null); return }
        if (selectedNode) setSelectedNode(null)
        else if (layout.id === 'hierarchy' && hierarchyLevel > 0) {
          setHierarchyLevel(hierarchyLevel - 1)
          setHierarchyPath(hierarchyPath.slice(0, -1))
        }
      } else if (e.code === 'KeyP' && !e.ctrlKey && !e.metaKey && !isTyping) {
        e.preventDefault()
        setIsPresentationMode(!isPresentationMode)
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyF') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedNode, selectedLink, layout.id, hierarchyLevel, hierarchyPath, isPresentationMode])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => { setMouseX(e.clientX); setMouseY(e.clientY) }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const handleLayoutChange = (id: typeof layout.id) => {
    const target = lens.layouts.find(l => l.id === id)
    setLayout(id)
    if (target?.slot === 'view') {
      // Entering a specialist view only drops the selection, preserving search
      // and filters — matching the previous onSpecialistViewChange behaviour.
      setSelectedNode(null)
      return
    }
    // Returning to a canvas layout is the old handleViewChange: a full reset.
    setSearchTerm('')
    setActiveFilters({})
    setSelectedNode(null)
    setSelectedLink(null)
    setExpandedNodes(new Set())
    setHierarchyLevel(0)
    setHierarchyPath([])
  }

  // Filters and selections from one lens are meaningless in another, so a lens
  // switch clears them along with any highlight.
  const handleLensChange = (id: typeof lens.id) => {
    setLens(id)
    setSearchTerm('')
    setActiveFilters({})
    setSelectedNode(null)
    setSelectedLink(null)
    setExpandedNodes(new Set())
    setHierarchyLevel(0)
    setHierarchyPath([])
    setHighlightedNodeIds(new Set())
  }

  const handleNodeClick = (node: OntologyNode | null) => {
    setSelectedNode(node)
    if (node) setSelectedLink(null)
  }

  const handleLinkClick = (link: OntologyLink) => {
    setSelectedLink(link)
    setSelectedNode(null)
  }

  const handleFilterToggle = (groupId: string, optionId: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev[groupId] ?? [])
      if (next.has(optionId)) next.delete(optionId)
      else next.add(optionId)
      return { ...prev, [groupId]: next }
    })
  }

  const handleTraverseFromProject = (node: OntologyNode) => {
    loadProjectSubgraph(node.label)
    setSelectedNode(null)
  }

  const handleTourFocusNode = (node: OntologyNode, highlightIds: string[]) => {
    setSelectedNode(node)
    setHighlightedNodeIds(new Set([node.id, ...highlightIds]))
    graphRef.current?.zoomToFit(600, 80)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 48px)' }}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[var(--color-primary)] border-t-transparent" />
          <p className="mt-4 text-[var(--color-subtext)]">
            {projectFocus ? `Loading ontology for "${projectFocus}"...` : 'Loading Onto Verse…'}
          </p>
        </div>
      </div>
    )
  }

  if (error && allNodes.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 48px)' }}>
        <div className="text-center max-w-md">
          <p className="text-red-500 text-lg mb-2">Onto Verse Unavailable</p>
          <p className="text-[var(--color-subtext)] text-sm">{error}</p>
          <p className="text-[var(--color-muted)] text-xs mt-3">
            Start Neo4j and set <code>NEO4J_ENABLED=true</code> in your .env, then load data via the Connectors page.
          </p>
          <button
            onClick={() => loadOrgGraph()}
            className="mt-4 px-4 py-2 rounded text-sm font-semibold"
            style={{ background: 'var(--color-primary)', color: '#fff' }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="overflow-hidden relative"
      style={{
        height: 'calc(100vh - 48px)',
        marginTop: '-24px', marginRight: '-24px',
        marginBottom: '-24px', marginLeft: '-24px',
        width: 'calc(100vw - 244px)',
        background: gt.isDark ? '#000000' : gt.gradColors.end,
        transition: 'background 0.4s ease',
      }}
    >
      <StarsBackground />

      <OntologyTopBar
        lens={lens}
        layout={layout}
        onLensChange={handleLensChange}
        onLayoutChange={handleLayoutChange}
        onToggleOff={() => setLayout(lens.layouts[0].id)}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        isPresentationMode={isPresentationMode}
        searchInputRef={searchInputRef as any}
        projectFocus={projectFocus}
        canMaintain={canMaintain}
        onMaintainerChatToggle={() => setShowMaintainerChat(v => !v)}
        maintainerChatOpen={showMaintainerChat}
        onRefreshOrgGraph={() => { loadOrgGraph(); setSelectedNode(null) }}
        onClearProjectFocus={() => { useOntologyStore.getState().clearProjectFocus(); setSelectedNode(null) }}
        onTourGuideToggle={() => setShowTourGuide(v => !v)}
        tourGuideActive={showTourGuide}
      />

      {layout.chrome.kpiBar && (
        <LensKpiBar
          lens={lens}
          ctx={ctx}
          isPresentationMode={isPresentationMode}
          grouping={grouping}
          onGroupingChange={setGrouping}
          showGrouping={layout.id === 'grouped-lanes'}
        />
      )}

      {layout.chrome.breadcrumb && layout.id === 'hierarchy' && hierarchyLevel > 0 && (
        <OntologyBreadcrumb
          path={hierarchyPath}
          level={hierarchyLevel}
          rootLabel="Perspectives"
          onNavigate={(index) => {
            if (index === -1) { setHierarchyLevel(0); setHierarchyPath([]) }
            else { setHierarchyLevel(index + 1); setHierarchyPath(hierarchyPath.slice(0, index + 1)) }
          }}
        />
      )}

      {layout.chrome.filterRail && (
        <OntologyFilters
          groups={filterGroups}
          activeFilters={activeFilters}
          onFilterToggle={handleFilterToggle}
          onClearAll={() => setActiveFilters({})}
          isPresentationMode={isPresentationMode}
          accent={lens.accent}
          topOffset={chromeTop}
        />
      )}

      <LensViewHost
        ref={graphRef}
        lens={lens}
        layout={layout}
        grouping={grouping}
        ctx={ctx}
        nodes={visibleNodes}
        links={storeLinks}
        activeFilters={typeFilters}
        searchTerm={searchTerm}
        selectedNode={selectedNode as never}
        selectedLink={selectedLink as never}
        hoveredNode={hoveredNode as never}
        highlightedNodeIds={highlightedNodeIds}
        isPresentationMode={isPresentationMode}
        canvasState={{
          hierarchyLevel,
          hierarchyPath,
          expandedNodes,
          onHierarchyChange: (level, path) => { setHierarchyLevel(level); setHierarchyPath(path) },
          onExpandToggle: (nodeId) => {
            const next = new Set(expandedNodes)
            if (next.has(nodeId)) next.delete(nodeId)
            else next.add(nodeId)
            setExpandedNodes(next)
          },
        }}
        onNodeClick={handleNodeClick as never}
        onNodeHover={setHoveredNode as never}
        onLinkClick={handleLinkClick as never}
        onLinkHover={() => {}}
        onBack={() => setLayout(lens.layouts[0].id)}
      />

      {layout.chrome.zoomControls && (
        <OntologyZoomControls
          graphRef={graphRef as never}
          isPresentationMode={isPresentationMode}
          onPresentationToggle={() => setIsPresentationMode(!isPresentationMode)}
        />
      )}
      {layout.chrome.legend && (
        <LensLegend
          lens={lens}
          layout={layout}
          ctx={ctx}
          isPresentationMode={isPresentationMode}
          topOffset={chromeTop}
        />
      )}

      <OntologyDetailPanel
        node={selectedNode}
        allNodes={allNodes}
        allLinks={allLinks}
        onClose={() => setSelectedNode(null)}
        onTraverseProject={handleTraverseFromProject}
        onOpenLayout={(id) => {
          // May switch lens, so drop filters scoped to the previous one.
          openLayout(id)
          setActiveFilters({})
          setSelectedNode(null)
        }}
        lensSections={selectedNode && (
          <LensDetailSections
            node={selectedNode as never}
            lens={lens}
            ctx={ctx}
            onFocusNodes={(ids) => setHighlightedNodeIds(new Set(ids))}
            onSelectNode={(n) => setSelectedNode(n as never)}
          />
        )}
      />

      <RelationshipDetailPanel
        link={selectedLink}
        allNodes={allNodes}
        onClose={() => setSelectedLink(null)}
        onGoToSource={(node) => { setSelectedNode(node); setSelectedLink(null) }}
        onGoToTarget={(node) => { setSelectedNode(node); setSelectedLink(null) }}
      />

      {showWelcome && <WelcomeOverlay onStart={() => setShowWelcome(false)} />}

      {hoveredNode && !selectedNode && (
        <NodeTooltip
          node={hoveredNode}
          mouseX={mouseX}
          mouseY={mouseY}
          connectionCount={
            allLinks.filter(l => {
              const sourceId = typeof l.source === 'string' ? l.source : (l.source as OntologyNode).id
              const targetId = typeof l.target === 'string' ? l.target : (l.target as OntologyNode).id
              return sourceId === hoveredNode.id || targetId === hoveredNode.id
            }).length
          }
        />
      )}

      {/* Clear-highlight banner — floats above graph when a node is highlighted */}
      {highlightedNodeIds.size > 0 && (
        <div style={{
          position: 'absolute',
          top: `${chromeTop - 14}px`,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '7px 16px',
          background: 'rgba(245,158,11,0.18)',
          border: '1px solid rgba(245,158,11,0.55)',
          borderRadius: '999px',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          fontSize: '12px',
          fontWeight: 600,
          color: '#fbbf24',
          pointerEvents: 'auto',
          userSelect: 'none',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', boxShadow: '0 0 6px #f59e0b' }} />
          {highlightedNodeIds.size === 1 ? '1 node highlighted' : `${highlightedNodeIds.size} nodes highlighted`}
          <button
            onClick={() => {
              setHighlightedNodeIds(new Set())
              graphRef.current?.zoomToFit(600, 60)
            }}
            style={{
              marginLeft: 6,
              padding: '3px 12px',
              borderRadius: '999px',
              border: '1px solid rgba(245,158,11,0.5)',
              background: 'rgba(245,158,11,0.15)',
              color: '#fbbf24',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.35)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.15)')}
          >
            ← Back to Org View
          </button>
        </div>
      )}

      {/* Ontology Maintainer Chat Drawer */}
      {canMaintain && showMaintainerChat && (
        <OntologyMaintainerChat
          onClose={() => setShowMaintainerChat(false)}
          onHighlightNodes={(ids) => setHighlightedNodeIds(new Set(ids))}
          onGraphRefresh={() => { loadOrgGraph(); setSelectedNode(null) }}
        />
      )}

      {/* Tour Guide bar */}
      {showTourGuide && (
        <TourGuide
          nodes={allNodes}
          links={allLinks}
          projectNode={(focusedProjectNode as unknown as OntologyNode | null)
            ?? allNodes.find(n => (n.node_type || '').toLowerCase() === 'project') ?? null}
          onFocusNode={handleTourFocusNode}
          onStop={() => {
            setShowTourGuide(false)
            setHighlightedNodeIds(new Set())
          }}
        />
      )}
    </div>
  )
}
