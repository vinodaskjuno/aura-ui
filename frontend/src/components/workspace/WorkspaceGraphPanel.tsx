import { useCallback, useMemo } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap, Panel,
  type Node, type NodeTypes,
  Handle, Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useGraphTheme } from '../../hooks/useGraphTheme'
import type { OntologyNode, OntologyLink } from '../../api/ontologyUniverse'
import {
  ontologyNodesToFlowNodes,
  ontologyLinksToFlowEdges,
  layoutWorkspaceGraph,
  WORKSPACE_GRAPH_NODE_CAP,
  type WorkspaceFlowData,
} from './ontologyToFlow'

interface WorkspaceGraphPanelProps {
  nodes: OntologyNode[]
  links: OntologyLink[]
  selectedNodeId: string | null
  highlightIds: Set<string>
  onNodeClick: (node: OntologyNode) => void
  isLoading: boolean
}

function WorkspaceFlowNode({ data, selected }: { data: WorkspaceFlowData; selected?: boolean }) {
  const t = useGraphTheme()
  const highlight = data.isHighlighted || selected
  return (
    <div style={{
      padding: '8px 12px', borderRadius: 10, minWidth: 140,
      background: highlight ? t.accentBg : t.flowNodeBg,
      border: `1.5px solid ${highlight ? t.accent : t.flowNodeBorder}`,
      boxShadow: highlight ? `0 0 14px ${t.accent}55` : '0 2px 8px rgba(0,0,0,0.3)',
      transition: 'all 0.15s',
      cursor: 'pointer',
    }}>
      <Handle type="target" position={Position.Top}
        style={{ background: t.flowEdgeColor, width: 7, height: 7, border: 'none' }} />
      <div style={{
        fontSize: 11, fontWeight: 700, color: t.flowNodeText,
        display: 'flex', alignItems: 'center', gap: 5,
        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        maxWidth: 148,
      }}>
        <span style={{ fontSize: 13, flexShrink: 0 }}>{data.icon}</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.label.slice(0, 22)}</span>
      </div>
      <div style={{ fontSize: 9, color: t.flowNodeSubtext, marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
        <span>{data.nodeType}</span>
        {data.status && (
          <span>{data.status === 'active' ? '🟢' : data.status === 'retired' ? '⚫' : '🟡'}</span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom}
        style={{ background: t.flowEdgeColor, width: 7, height: 7, border: 'none' }} />
    </div>
  )
}

const NODE_TYPES: NodeTypes = { workspaceNode: WorkspaceFlowNode as NodeTypes['workspaceNode'] }

export default function WorkspaceGraphPanel({
  nodes, links, selectedNodeId, highlightIds, onNodeClick, isLoading,
}: WorkspaceGraphPanelProps) {
  const t = useGraphTheme()
  const truncated = nodes.length > WORKSPACE_GRAPH_NODE_CAP

  const flowNodes = useMemo(
    () => ontologyNodesToFlowNodes(nodes, highlightIds, selectedNodeId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes.length, highlightIds.size, selectedNodeId, t.flowNodeBg],
  )

  const nodeIdSet = useMemo(() => new Set(flowNodes.map(n => n.id)), [flowNodes.length])

  const flowEdges = useMemo(
    () => ontologyLinksToFlowEdges(links, nodeIdSet, t),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [links.length, nodeIdSet.size, t.flowEdgeColor],
  )

  const { nodes: laid, edges: laidEdges } = useMemo(
    () => layoutWorkspaceGraph(flowNodes, flowEdges),
    [flowNodes.length, flowEdges.length],
  )

  const handleNodeClick = useCallback((_: unknown, n: Node) => {
    const orig = nodes.find(x => x.id === n.id)
    if (orig) onNodeClick(orig)
  }, [nodes, onNodeClick])

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      borderRight: `1px solid var(--color-border)`,
    }}>
      {/* Panel label */}
      <div style={{
        position: 'absolute', top: 8, left: 12, zIndex: 10,
        fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: t.sectionLabel,
        pointerEvents: 'none',
      }}>
        Graph · {Math.min(nodes.length, WORKSPACE_GRAPH_NODE_CAP)} nodes
      </div>

      <ReactFlow
        nodes={laid}
        edges={laidEdges}
        nodeTypes={NODE_TYPES}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        style={{ background: t.graphBg }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color={t.panelBorder} gap={18} size={1} />
        <Controls style={{ background: t.panelBg, border: `1px solid ${t.panelBorder}` }} />
        <MiniMap
          style={{ background: t.panelBg, border: `1px solid ${t.panelBorder}` }}
          nodeColor={t.flowNodeBorder}
        />

        {isLoading && (
          <Panel position="top-center">
            <div style={{
              padding: '8px 16px', background: t.panelBg,
              border: `1px solid ${t.panelBorder}`, borderRadius: 8,
              color: t.panelSubtext, fontSize: 12,
            }}>
              Loading graph…
            </div>
          </Panel>
        )}

        {truncated && !isLoading && (
          <Panel position="bottom-center">
            <div style={{
              padding: '5px 12px', background: t.panelBg,
              border: `1px solid ${t.accent}44`, borderRadius: 8,
              color: t.mutedText, fontSize: 11,
            }}>
              Showing first {WORKSPACE_GRAPH_NODE_CAP} of {nodes.length} nodes — use search to filter
            </div>
          </Panel>
        )}

        {!isLoading && nodes.length === 0 && (
          <Panel position="top-center">
            <div style={{
              padding: '10px 20px', background: t.panelBg,
              border: `1px solid ${t.panelBorder}`, borderRadius: 8,
              color: t.panelSubtext, fontSize: 13,
            }}>
              No ontology data loaded. Click Reload or go to Onto Verse first.
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  )
}
