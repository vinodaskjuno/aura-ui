import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { OntologyNode, OntologyLink, ViewMode } from '../types/ontology'
import { useOntologyStore, type SpecialistView } from '../store/ontologyStore'
import { useAuthStore } from '../store/authStore'
import OntologyGraph, { type OntologyGraphRef } from '../components/ontology/OntologyGraph'
import OntologyGraphContainer from '../components/ontology/OntologyGraphContainer'
import OntologyTopBar from '../components/ontology/OntologyTopBar'
import OntologyFilters from '../components/ontology/OntologyFilters'
import OntologyZoomControls from '../components/ontology/OntologyZoomControls'
import OntologyBreadcrumb from '../components/ontology/OntologyBreadcrumb'
import OntologyDetailPanel from '../components/ontology/OntologyDetailPanel'
import RelationshipDetailPanel from '../components/ontology/RelationshipDetailPanel'
import { useGraphTheme } from '../hooks/useGraphTheme'
import OntologyLegend from '../components/ontology/OntologyLegend'
import StarsBackground from '../components/ontology/StarsBackground'
import WelcomeOverlay from '../components/ontology/WelcomeOverlay'
import NodeTooltip from '../components/ontology/NodeTooltip'
import OntologyMaintainerChat from '../components/ontology/OntologyMaintainerChat'
import TourGuide from '../components/ontology/TourGuide'

export default function OntologyVisualizerPage() {
  const gt = useGraphTheme()
  const graphRef = useRef<OntologyGraphRef>(null)
  const [searchParams] = useSearchParams()
  const projectParam = searchParams.get('project')

  const { nodes: storeNodes, links: storeLinks, isLoading, error, projectFocus,
    loadOrgGraph, loadProjectSubgraph, specialistView, setSpecialistView,
    focusedProjectNode } = useOntologyStore()
  const { hasPermission } = useAuthStore()
  const canMaintain = hasPermission('ontology_maintain')

  // Cast store data to local types (compatible shapes)
  const allNodes = storeNodes as unknown as OntologyNode[]
  const allLinks = storeLinks as unknown as OntologyLink[]

  // View state
  const [currentView, setCurrentView] = useState<ViewMode>('full')
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

  // Filter state
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')

  // Highlight state — set from OntologyMaintainerChat when user clicks "Highlight in graph"
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set())

  // UI state
  const [showWelcome, setShowWelcome] = useState(false)
  const [mouseX, setMouseX] = useState(0)
  const [mouseY, setMouseY] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Load on mount — respect ?project= query param
  useEffect(() => {
    if (projectParam) {
      loadProjectSubgraph(projectParam)
    } else {
      loadOrgGraph()
    }
  }, [projectParam])

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
        else if (currentView === 'hierarchy' && hierarchyLevel > 0) {
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
  }, [selectedNode, selectedLink, currentView, hierarchyLevel, hierarchyPath, isPresentationMode])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => { setMouseX(e.clientX); setMouseY(e.clientY) }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const handleViewChange = (view: ViewMode) => {
    setCurrentView(view)
    setSearchTerm('')
    setActiveFilters(new Set())
    setSelectedNode(null)
    setSelectedLink(null)
    setExpandedNodes(new Set())
    if (view === 'hierarchy') { setHierarchyLevel(0); setHierarchyPath([]) }
  }

  const handleNodeClick = (node: OntologyNode | null) => {
    setSelectedNode(node)
    if (node) setSelectedLink(null)
  }

  const handleLinkClick = (link: OntologyLink) => {
    setSelectedLink(link)
    setSelectedNode(null)
  }

  const handleFilterToggle = (filter: string) => {
    const newFilters = new Set(activeFilters)
    if (newFilters.has(filter)) newFilters.delete(filter)
    else newFilters.add(filter)
    setActiveFilters(newFilters)
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
            {projectFocus ? `Loading ontology for "${projectFocus}"...` : 'Loading Enterprise Ontology Universe...'}
          </p>
        </div>
      </div>
    )
  }

  if (error && allNodes.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 48px)' }}>
        <div className="text-center max-w-md">
          <p className="text-red-500 text-lg mb-2">Ontology Unavailable</p>
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
        currentView={currentView}
        onViewChange={handleViewChange}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        isPresentationMode={isPresentationMode}
        searchInputRef={searchInputRef as any}
        totalNodes={allNodes.length}
        totalLinks={allLinks.length}
        projectFocus={projectFocus}
        canMaintain={canMaintain}
        onMaintainerChatToggle={() => setShowMaintainerChat(v => !v)}
        maintainerChatOpen={showMaintainerChat}
        onRefreshOrgGraph={() => { loadOrgGraph(); setSelectedNode(null) }}
        onClearProjectFocus={() => { useOntologyStore.getState().clearProjectFocus(); setSelectedNode(null) }}
        specialistView={specialistView}
        onSpecialistViewChange={(v: SpecialistView | null) => { setSpecialistView(v); if (v) setSelectedNode(null) }}
        onTourGuideToggle={() => setShowTourGuide(v => !v)}
        tourGuideActive={showTourGuide}
      />

      {currentView === 'hierarchy' && hierarchyLevel > 0 && (
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

      {!specialistView && (
        <OntologyFilters
          activeFilters={activeFilters}
          onFilterToggle={handleFilterToggle}
          isPresentationMode={isPresentationMode}
          allNodes={allNodes}
        />
      )}

      {/* Specialist views overlay — shown instead of OntologyGraph when active */}
      {specialistView ? (
        <OntologyGraphContainer
          view={specialistView}
          nodes={allNodes}
          links={allLinks}
          selectedNode={selectedNode}
          onNodeClick={handleNodeClick}
          onBack={() => setSpecialistView(null)}
        />
      ) : (
        <OntologyGraph
          ref={graphRef as any}
          allNodes={allNodes}
          allLinks={allLinks}
          currentView={currentView}
          hierarchyLevel={hierarchyLevel}
          hierarchyPath={hierarchyPath}
          activeFilters={activeFilters}
          searchTerm={searchTerm}
          selectedNode={selectedNode}
          hoveredNode={hoveredNode}
          expandedNodes={expandedNodes}
          selectedLink={selectedLink}
          onNodeClick={handleNodeClick}
          onNodeHover={setHoveredNode}
          onExpandToggle={(nodeId) => {
            const newExpanded = new Set(expandedNodes)
            if (newExpanded.has(nodeId)) newExpanded.delete(nodeId)
            else newExpanded.add(nodeId)
            setExpandedNodes(newExpanded)
          }}
          onHierarchyChange={(level, path) => { setHierarchyLevel(level); setHierarchyPath(path) }}
          onLinkClick={handleLinkClick}
          onLinkHover={() => {}}
          highlightedNodeIds={highlightedNodeIds}
        />
      )}

      {!specialistView && (
        <OntologyZoomControls
          graphRef={graphRef}
          isPresentationMode={isPresentationMode}
          onPresentationToggle={() => setIsPresentationMode(!isPresentationMode)}
        />
      )}
      {!specialistView && (
        <OntologyLegend isPresentationMode={isPresentationMode} />
      )}

      <OntologyDetailPanel
        node={selectedNode}
        allNodes={allNodes}
        allLinks={allLinks}
        onClose={() => setSelectedNode(null)}
        onTraverseProject={handleTraverseFromProject}
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
          top: '66px',
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
