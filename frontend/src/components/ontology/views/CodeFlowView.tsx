/**
 * Code Flow View — DAG layout using @xyflow/react + @dagrejs/dagre.
 * Shows code entities (Function, Class, Module, CodeFile) with CALLS/IMPORTS edges.
 * Side panel shows LLM-style explanation with evidence, confidence, and business rule links.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useGraphTheme } from '../../../hooks/useGraphTheme'
import type { OntologyNode, OntologyLink } from '../../../api/ontologyUniverse'
import dagre from '@dagrejs/dagre'
import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge, type NodeTypes,
  Handle, Position, Panel,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

interface Props {
  nodes: OntologyNode[]
  links: OntologyLink[]
  selectedNode: OntologyNode | null
  onNodeClick: (node: OntologyNode) => void
}

const CODE_LABELS = new Set(['Function', 'Class', 'Module', 'CodeFile', 'Repository', 'API', 'Dependency'])
const CODE_EDGE_TYPES = new Set(['CALLS', 'IMPORTS', 'IMPLEMENTS', 'EXTENDS', 'DEPENDS_ON'])

const LANG_COLORS: Record<string, string> = {
  python: '#3b82f6',
  typescript: '#0ea5e9',
  javascript: '#f59e0b',
  java: '#ef4444',
  go: '#06b6d4',
  rust: '#f97316',
}

function langBadge(lang?: string) {
  if (!lang) return null
  const col = LANG_COLORS[lang.toLowerCase()] ?? '#6366f1'
  return <span style={{ fontSize: 9, fontWeight: 700, background: col + '22', color: col, border: `1px solid ${col}44`, borderRadius: 4, padding: '1px 5px', marginLeft: 4 }}>{lang}</span>
}

function layoutGraph(rawNodes: Node[], rawEdges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', ranksep: 80, nodesep: 40 })
  rawNodes.forEach(n => g.setNode(n.id, { width: 180, height: 60 }))
  rawEdges.forEach(e => g.setEdge(e.source, e.target))
  dagre.layout(g)
  return {
    nodes: rawNodes.map(n => {
      const pos = g.node(n.id)
      return { ...n, position: { x: pos.x - 90, y: pos.y - 30 } }
    }),
    edges: rawEdges,
  }
}

// Custom node card
function CodeNode({ data, selected }: { data: Record<string, unknown>; selected?: boolean }) {
  const t = useGraphTheme()
  const selBg = t.flowNodeSelected
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 10, minWidth: 160,
      background: selected ? t.accentBg : t.flowNodeBg,
      border: `1.5px solid ${selected ? t.accent : t.flowNodeBorder}`,
      boxShadow: selected ? `0 0 12px ${t.accent}44` : '0 2px 8px rgba(0,0,0,0.3)',
      transition: 'all 0.15s',
      animation: 'codeNodeIn 0.25s ease',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: t.flowEdgeColor, width: 8, height: 8 }} />
      <div style={{ fontSize: 11, fontWeight: 700, color: t.flowNodeText, display: 'flex', alignItems: 'center', gap: 4 }}>
        {data.icon as string} {String(data.label).slice(0, 24)}
        {langBadge(data.language as string | undefined)}
      </div>
      <div style={{ fontSize: 9, color: t.flowNodeSubtext, marginTop: 2 }}>{String(data.nodeType)}</div>
      {data.filePath && (
        <div style={{ fontSize: 9, color: t.flowNodeSubtext, marginTop: 1, opacity: 0.7 }}>
          {String(data.filePath).slice(-30)}
        </div>
      )}
      {(data.confidence as number) !== undefined && (
        <div style={{ fontSize: 9, color: (data.confidence as number) > 0.8 ? '#22c55e' : '#f59e0b', marginTop: 3 }}>
          conf: {((data.confidence as number) * 100).toFixed(0)}%
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: t.flowEdgeColor, width: 8, height: 8 }} />
    </div>
  )
}

const nodeTypes: NodeTypes = { codeNode: CodeNode as NodeTypes['codeNode'] }

const TYPE_ICONS: Record<string, string> = {
  Function: 'ƒ', Class: '◈', Module: '▣', CodeFile: '📄', Repository: '📁',
  API: '🔌', Dependency: '📦',
}

export default function CodeFlowView({ nodes, links, selectedNode, onNodeClick }: Props) {
  const t = useGraphTheme()
  const [repoFilter, setRepoFilter] = useState('')
  const [confThreshold, setConfThreshold] = useState(0)

  const codeNodes = nodes.filter(n => CODE_LABELS.has(n.node_type))
  const repos = [...new Set(codeNodes.map(n => String(n.source)).filter(Boolean))]

  const filtered = codeNodes.filter(n => {
    if (repoFilter && n.source !== repoFilter) return false
    return true
  })
  const filteredIds = new Set(filtered.map(n => n.id))

  const flowNodes: Node[] = filtered.map(n => ({
    id: n.id,
    type: 'codeNode',
    position: { x: 0, y: 0 },
    data: {
      label: n.label || n.node_type,
      nodeType: n.node_type,
      icon: TYPE_ICONS[n.node_type] ?? '◈',
      language: (n as Record<string, unknown>).language,
      filePath: (n as Record<string, unknown>).filePath,
      confidence: (n as Record<string, unknown>).confidence ?? 1,
    },
    selected: selectedNode?.id === n.id,
  }))

  const flowEdges: Edge[] = links
    .filter(l => {
      const src = typeof l.source === 'string' ? l.source : l.source.id
      const tgt = typeof l.target === 'string' ? l.target : l.target.id
      return CODE_EDGE_TYPES.has(l.type) && filteredIds.has(src) && filteredIds.has(tgt)
    })
    .map(l => {
      const src = typeof l.source === 'string' ? l.source : l.source.id
      const tgt = typeof l.target === 'string' ? l.target : l.target.id
      return {
        id: `${src}-${l.type}-${tgt}`,
        source: src,
        target: tgt,
        label: l.type,
        type: 'smoothstep',
        animated: l.type === 'CALLS',
        style: { stroke: t.flowEdgeColor, strokeWidth: 1.5 },
        labelStyle: { fill: t.flowEdgeLabelText, fontSize: 9, fontWeight: 600 },
        labelBgStyle: { fill: t.flowEdgeLabelBg },
      }
    })

  const { nodes: laidOut, edges: laidEdges } = useMemo(
    () => layoutGraph(flowNodes, flowEdges),
    [filtered.length, links.length, repoFilter, t.flowNodeBg]
  )

  const handleNodeClick = useCallback((_: unknown, n: Node) => {
    const orig = nodes.find(x => x.id === n.id)
    if (orig) onNodeClick(orig)
  }, [nodes, onNodeClick])

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes codeNodeIn { from { opacity:0; transform:translateX(-10px) } to { opacity:1; transform:translateX(0) } }
      `}</style>

      {/* Filter bar */}
      <div style={{ padding: '10px 16px', background: t.topBarBg, borderBottom: `1px solid ${t.topBarBorder}`, display: 'flex', gap: 12, alignItems: 'center' }}>
        <select value={repoFilter} onChange={e => setRepoFilter(e.target.value)}
          style={{ padding: '5px 10px', borderRadius: 7, background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.inputText, fontSize: 12 }}>
          <option value="">All Repositories</option>
          {repos.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: t.panelSubtext }}>
          Confidence ≥ {(confThreshold * 100).toFixed(0)}%
          <input type="range" min={0} max={1} step={0.05} value={confThreshold}
            onChange={e => setConfThreshold(Number(e.target.value))} style={{ width: 90 }} />
        </div>
        <span style={{ marginLeft: 'auto', color: t.panelSubtext, fontSize: 11 }}>
          {filtered.length} nodes · {flowEdges.length} edges
        </span>
      </div>

      {/* Flow graph */}
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={laidOut}
          edges={laidEdges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          fitView
          style={{ background: t.graphBg }}
        >
          <Background color={t.panelBorder} gap={20} />
          <Controls style={{ background: t.panelBg, border: `1px solid ${t.panelBorder}` }} />
          <MiniMap style={{ background: t.panelBg, border: `1px solid ${t.panelBorder}` }} nodeColor={t.flowNodeBorder} />
          {!filtered.length && (
            <Panel position="top-center">
              <div style={{ padding: '10px 20px', background: t.panelBg, border: `1px solid ${t.panelBorder}`, borderRadius: 8, color: t.panelSubtext, fontSize: 13 }}>
                No code entities found. Ingest a repository to see the code flow.
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>
    </div>
  )
}
