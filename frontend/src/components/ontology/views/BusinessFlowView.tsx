/**
 * Business Flow View — top-to-bottom sequential BPMN-style flow.
 * Nodes = BusinessProcess steps with status indicator (nominal/risk/incident).
 * Edges = sequential steps with condition labels.
 */
import React, { useMemo, useState } from 'react'
import { useGraphTheme } from '../../../hooks/useGraphTheme'
import type { OntologyNode, OntologyLink } from '../../../api/ontologyUniverse'
import dagre from '@dagrejs/dagre'
import { ReactFlow, Background, Controls, Handle, Position, type Node, type Edge, type NodeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

interface Props {
  nodes: OntologyNode[]
  links: OntologyLink[]
  selectedNode: OntologyNode | null
  onNodeClick: (node: OntologyNode) => void
}

const BIZ_LABELS = new Set(['BusinessProcess', 'BusinessRule', 'BusinessApplication', 'Requirement'])

function statusColor(status?: string) {
  if (status === 'incident') return '#ef4444'
  if (status === 'risk') return '#f59e0b'
  return '#22c55e'
}

function BizStepNode({ data, selected }: { data: Record<string, unknown>; selected?: boolean }) {
  const t = useGraphTheme()
  const sc = statusColor(data.status as string)
  return (
    <div style={{
      padding: '12px 16px', borderRadius: 12, minWidth: 170,
      background: t.flowNodeBg, border: `2px solid ${selected ? t.accent : t.flowNodeBorder}`,
      boxShadow: selected ? `0 0 14px ${t.accent}44` : '0 2px 8px rgba(0,0,0,0.3)',
      animation: 'fadeInDown 0.25s ease',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: t.flowEdgeColor }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.flowNodeText }}>{String(data.label).slice(0, 22)}</div>
          <div style={{ fontSize: 9, color: t.flowNodeSubtext }}>{String(data.nodeType)}</div>
        </div>
        <span style={{ fontSize: 18 }}>
          {data.nodeType === 'BusinessProcess' ? '⚙️' :
           data.nodeType === 'BusinessRule' ? '📏' :
           data.nodeType === 'BusinessApplication' ? '📦' : '📋'}
        </span>
      </div>
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4, fontSize: 9 }}>
        <span style={{ color: sc }}>●</span>
        <span style={{ color: t.flowNodeSubtext }}>{String(data.status ?? 'nominal')}</span>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: t.flowEdgeColor }} />
    </div>
  )
}

const nodeTypes: NodeTypes = { bizStep: BizStepNode as NodeTypes['bizStep'] }

function buildLayout(nodes: OntologyNode[], links: OntologyLink[]): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 50 })
  nodes.forEach(n => g.setNode(n.id, { width: 180, height: 70 }))
  links.forEach(l => {
    const src = typeof l.source === 'string' ? l.source : l.source.id
    const tgt = typeof l.target === 'string' ? l.target : l.target.id
    if (g.hasNode(src) && g.hasNode(tgt)) g.setEdge(src, tgt)
  })
  dagre.layout(g)
  return {
    nodes: nodes.map(n => {
      const pos = g.node(n.id)
      return {
        id: n.id, type: 'bizStep',
        position: { x: (pos?.x ?? 0) - 90, y: (pos?.y ?? 0) - 35 },
        data: {
          label: n.label || n.node_type,
          nodeType: n.node_type,
          status: (n as Record<string, unknown>).status ?? 'nominal',
        },
      }
    }),
    edges: links.map(l => {
      const src = typeof l.source === 'string' ? l.source : l.source.id
      const tgt = typeof l.target === 'string' ? l.target : l.target.id
      return {
        id: `${src}-${l.type}-${tgt}`, source: src, target: tgt,
        label: l.type, type: 'step',
        style: { stroke: '#8b5cf6', strokeWidth: 2 },
        labelStyle: { fontSize: 9, fill: '#c4b5fd' },
        markerEnd: { type: 'arrowclosed' as const },
      }
    }),
  }
}

export default function BusinessFlowView({ nodes, links, selectedNode, onNodeClick }: Props) {
  const t = useGraphTheme()
  const bizNodes = nodes.filter(n => BIZ_LABELS.has(n.node_type))
  const filteredIds = new Set(bizNodes.map(n => n.id))
  const bizLinks = links.filter(l => {
    const src = typeof l.source === 'string' ? l.source : l.source.id
    const tgt = typeof l.target === 'string' ? l.target : l.target.id
    return filteredIds.has(src) && filteredIds.has(tgt)
  })

  const { nodes: laidOut, edges } = useMemo(() => buildLayout(bizNodes, bizLinks), [bizNodes.length, bizLinks.length, t.flowNodeBg])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <style>{`@keyframes fadeInDown { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:translateY(0) } }`}</style>
      <ReactFlow
        nodes={laidOut} edges={edges} nodeTypes={nodeTypes}
        onNodeClick={(_, n) => { const o = nodes.find(x => x.id === n.id); if (o) onNodeClick(o) }}
        fitView style={{ background: t.graphBg }}
      >
        <Background color={t.panelBorder} gap={20} />
        <Controls style={{ background: t.panelBg, border: `1px solid ${t.panelBorder}` }} />
        {!bizNodes.length && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.panelSubtext, fontSize: 14 }}>
            No business process nodes found. Ingest business documents to populate this view.
          </div>
        )}
      </ReactFlow>
    </div>
  )
}
