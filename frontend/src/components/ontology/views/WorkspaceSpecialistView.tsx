import React, { useState, useRef, useCallback } from 'react'
import { Search, ChevronLeft, Loader2, LayoutDashboard } from 'lucide-react'
import type { OntologyNode, OntologyLink, SearchResult } from '../../../api/ontologyUniverse'
import { searchNodes } from '../../../api/ontologyUniverse'
import { useOntologyStore } from '../../../store/ontologyStore'
import { useWorkspaceStore, PERSONA_LAYOUTS, type PersonaMode } from '../../../store/workspaceStore'
import { useGraphTheme } from '../../../hooks/useGraphTheme'
import WorkspaceGraphPanel from '../../workspace/WorkspaceGraphPanel'
import { WorkspaceChatPanel, type WorkspaceChatHandle } from '../../workspace/WorkspaceChatPanel'
import WorkspaceLearnPanel from '../../workspace/WorkspaceLearnPanel'
import WorkspaceCodeViewer from '../../workspace/WorkspaceCodeViewer'

interface Props {
  nodes: OntologyNode[]
  links: OntologyLink[]
  selectedNode: OntologyNode | null
  onNodeClick: (node: OntologyNode) => void
}

const PERSONA_OPTIONS: { id: PersonaMode; label: string }[] = [
  { id: 'non-technical',   label: 'Overview'   },
  { id: 'junior-dev',      label: 'Junior Dev' },
  { id: 'experienced-dev', label: 'Expert'     },
]

const PANEL_GRID: Record<PersonaMode, { areas: string; cols: string; rows: string }> = {
  'non-technical':   { areas: '"graph learn"',              cols: '2fr 1fr',       rows: '1fr'      },
  'junior-dev':      { areas: '"graph code" "chat learn"',  cols: '1fr 1fr',       rows: '1.2fr 0.8fr' },
  'experienced-dev': { areas: '"graph code" "chat learn"',  cols: '0.85fr 1.15fr', rows: '1fr 1fr'  },
}

export default function WorkspaceSpecialistView({ nodes, links }: Props) {
  const gt = useGraphTheme()

  const { isLoading, projectFocus, loadProjectSubgraph } = useOntologyStore()
  const { persona, setPersona, selectedNode: wsNode, setSelectedNode, searchHighlightIds } = useWorkspaceStore()

  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState<SearchResult[]>([])
  const [searching, setSearching]   = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chatRef     = useRef<WorkspaceChatHandle>(null)

  const handleQueryChange = useCallback((val: string) => {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!val.trim()) { setResults([]); setShowDropdown(false); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await searchNodes(val, undefined, 8)
        setResults(res)
        setShowDropdown(true)
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [])

  const handleSelectProject = useCallback((result: SearchResult) => {
    setShowDropdown(false)
    setQuery(result.name)
    loadProjectSubgraph(result.name)
  }, [loadProjectSubgraph])

  const handleChangeProject = useCallback(() => {
    setQuery('')
    setResults([])
    setShowDropdown(false)
    useOntologyStore.setState({ projectFocus: null, nodes: [], links: [], isLoading: false })
    useWorkspaceStore.getState().reset()
  }, [])

  const handleNodeClick = useCallback((node: OntologyNode) => {
    setSelectedNode(node)
  }, [setSelectedNode])

  const grid   = PANEL_GRID[persona]
  const layout = PERSONA_LAYOUTS[persona]

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{
        position: 'absolute', inset: 0, top: 52,
        background: gt.graphBg,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 14,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          border: `3px solid ${gt.panelBorder}`,
          borderTopColor: 'rgb(99,102,241)',
          animation: 'wsp-spin 0.8s linear infinite',
        }} />
        <div style={{ fontSize: 13, color: gt.panelSubtext }}>Loading {projectFocus ?? 'project'}…</div>
        <style>{`@keyframes wsp-spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!projectFocus) {
    return (
      <div style={{
        position: 'absolute', inset: 0, top: 52,
        background: gt.graphBg,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 20,
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'rgba(99,102,241,0.12)',
          border: '1px solid rgba(99,102,241,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <LayoutDashboard size={32} color="rgb(99,102,241)" />
        </div>

        <div style={{ textAlign: 'center', lineHeight: 1.5 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: gt.panelText, marginBottom: 4 }}>Workspace View</div>
          <div style={{ fontSize: 13, color: gt.panelSubtext }}>Search for a project to begin your analysis</div>
        </div>

        <div style={{ width: 420, position: 'relative' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: gt.panelBg,
            border: `1px solid ${showDropdown ? 'rgba(99,102,241,0.6)' : gt.panelBorder}`,
            borderRadius: showDropdown && results.length > 0 ? '10px 10px 0 0' : 10,
            padding: '10px 14px',
            transition: 'border-color 0.15s, border-radius 0.1s',
          }}>
            {searching
              ? <Loader2 size={16} color={gt.panelSubtext} style={{ flexShrink: 0, animation: 'wsp-spin 0.8s linear infinite' }} />
              : <Search size={16} color={gt.panelSubtext} style={{ flexShrink: 0 }} />
            }
            <input
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              placeholder="Search project name..."
              autoFocus
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: gt.panelText, fontSize: 14,
              }}
            />
          </div>

          {showDropdown && results.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 60,
              background: gt.panelBg,
              border: '1px solid rgba(99,102,241,0.6)', borderTop: 'none',
              borderRadius: '0 0 10px 10px',
              overflow: 'hidden',
              boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            }}>
              {results.map(r => (
                <div
                  key={r.id}
                  onClick={() => handleSelectProject(r)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 14px', cursor: 'pointer',
                    borderBottom: `1px solid ${gt.panelBorder}`,
                    transition: 'background 0.1s',
                  }}
                >
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 6px',
                    borderRadius: 4, background: 'rgba(99,102,241,0.2)',
                    color: 'rgb(129,140,248)', textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>{r.type}</span>
                  <span style={{ fontSize: 13, color: gt.panelText }}>{r.name}</span>
                  {r.source && (
                    <span style={{ fontSize: 11, color: gt.panelSubtext, marginLeft: 'auto' }}>{r.source}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <style>{`@keyframes wsp-spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── Loaded state ─────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'absolute', inset: 0, top: 52,
      background: gt.graphBg,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Control strip */}
      <div style={{
        height: 44, flexShrink: 0,
        background: 'rgba(6,10,22,0.95)',
        borderBottom: `1px solid ${gt.panelBorder}`,
        display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px',
      }}>
        <button
          onClick={handleChangeProject}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = gt.panelText }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = gt.panelSubtext }}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(255,255,255,0.05)',
            border: `1px solid ${gt.panelBorder}`,
            borderRadius: 6, padding: '4px 10px',
            color: gt.panelSubtext, cursor: 'pointer', fontSize: 12,
            transition: 'all 0.15s',
          }}
        >
          <ChevronLeft size={13} />
          Change Project
        </button>

        <div style={{
          fontSize: 13, fontWeight: 600, color: gt.panelText,
          padding: '3px 10px',
          background: 'rgba(99,102,241,0.12)',
          border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: 6,
        }}>
          {projectFocus}
        </div>

        <div style={{ width: 1, height: 20, background: gt.panelBorder, margin: '0 2px' }} />

        {PERSONA_OPTIONS.map(opt => (
          <button
            key={opt.id}
            onClick={() => setPersona(opt.id)}
            style={{
              padding: '4px 10px', borderRadius: 6, border: 'none',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: persona === opt.id ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)',
              color: persona === opt.id ? 'rgb(129,140,248)' : gt.panelSubtext,
              transition: 'all 0.15s',
            }}
          >
            {opt.label}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: 11, color: gt.panelSubtext }}>
          {nodes.length} nodes · {links.length} edges
        </span>
      </div>

      {/* Panels grid */}
      <div style={{
        flex: 1, overflow: 'hidden',
        display: 'grid',
        gridTemplateAreas: grid.areas,
        gridTemplateColumns: grid.cols,
        gridTemplateRows: grid.rows,
      }}>
        <div style={{ gridArea: 'graph', overflow: 'hidden' }}>
          <WorkspaceGraphPanel
            nodes={nodes}
            links={links}
            selectedNodeId={wsNode?.id ?? null}
            highlightIds={searchHighlightIds}
            onNodeClick={handleNodeClick}
            isLoading={false}
          />
        </div>

        {layout.showLearn && (
          <div style={{ gridArea: 'learn', overflow: 'hidden', borderLeft: `1px solid ${gt.panelBorder}` }}>
            <WorkspaceLearnPanel
              selectedNode={wsNode}
              allNodes={nodes}
              onNodeSelect={setSelectedNode}
              onAskAI={msg => chatRef.current?.injectMessage(msg)}
            />
          </div>
        )}

        {layout.showCode && (
          <div style={{ gridArea: 'code', overflow: 'hidden', borderLeft: `1px solid ${gt.panelBorder}` }}>
            <WorkspaceCodeViewer selectedNode={wsNode} />
          </div>
        )}

        {layout.showChat && (
          <div style={{ gridArea: 'chat', overflow: 'hidden', borderTop: `1px solid ${gt.panelBorder}` }}>
            <WorkspaceChatPanel
              ref={chatRef}
              selectedNode={wsNode}
              contextNodes={nodes}
              contextLinks={links}
            />
          </div>
        )}
      </div>
    </div>
  )
}
