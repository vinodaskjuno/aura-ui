/**
 * Domain Flow View — swimlane layout grouped by BusinessDomain.
 * Shows BusinessProcess → BusinessRule → BusinessApplication chains.
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

const DOMAIN_LABELS = new Set(['BusinessDomain', 'BusinessProcess', 'BusinessRule', 'BusinessApplication', 'Policy', 'SOP'])

const TYPE_COLOR: Record<string, string> = {
  BusinessDomain: '#6366f1',
  BusinessProcess: '#8b5cf6',
  BusinessRule: '#a78bfa',
  BusinessApplication: '#22c55e',
  Policy: '#f59e0b',
  SOP: '#06b6d4',
}

function DomainNode({ data, selected }: { data: Record<string, unknown>; selected?: boolean }) {
  const t = useGraphTheme()
  const color = TYPE_COLOR[data.nodeType as string] ?? t.accent
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 10, minWidth: 150,
      background: t.flowNodeBg, border: `2px solid ${selected ? color : t.flowNodeBorder}`,
      boxShadow: selected ? `0 0 14px ${color}44` : '0 2px 8px rgba(0,0,0,0.3)',
      animation: 'fadeIn 0.2s ease',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: color }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14 }}>
          {data.nodeType === 'BusinessDomain' ? '🏛️' : data.nodeType === 'BusinessProcess' ? '⚙️' :
           data.nodeType === 'BusinessRule' ? '📏' : data.nodeType === 'BusinessApplication' ? '📦' :
           data.nodeType === 'Policy' ? '📋' : '📄'}
        </span>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.flowNodeText }}>{String(data.label).slice(0, 22)}</div>
          <div style={{ fontSize: 9, color, fontWeight: 600 }}>{String(data.nodeType)}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: color }} />
    </div>
  )
}

const nodeTypes: NodeTypes = { domainNode: DomainNode as NodeTypes['domainNode'] }

function buildLayout(nodes: OntologyNode[], links: OntologyLink[]): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', ranksep: 70, nodesep: 40 })
  nodes.forEach(n => g.setNode(n.id, { width: 160, height: 60 }))
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
        id: n.id, type: 'domainNode',
        position: { x: (pos?.x ?? 0) - 80, y: (pos?.y ?? 0) - 30 },
        data: { label: n.label || n.node_type, nodeType: n.node_type },
      }
    }),
    edges: links.map(l => {
      const src = typeof l.source === 'string' ? l.source : l.source.id
      const tgt = typeof l.target === 'string' ? l.target : l.target.id
      return {
        id: `${src}-${l.type}-${tgt}`, source: src, target: tgt,
        label: l.type, type: 'smoothstep',
        style: { stroke: '#6366f1', strokeWidth: 1.5 },
        labelStyle: { fontSize: 9, fill: '#a5b4fc' },
      }
    }),
  }
}

export default function DomainFlowView({ nodes, links, selectedNode, onNodeClick }: Props) {
  const t = useGraphTheme()
  const [domainFilter, setDomainFilter] = useState('')

  const domainNodes = nodes.filter(n => DOMAIN_LABELS.has(n.node_type))
  const domains = domainNodes.filter(n => n.node_type === 'BusinessDomain').map(n => n.label || n.id)

  const filtered = domainFilter
    ? domainNodes.filter(n => {
        if (n.node_type === 'BusinessDomain') return n.label === domainFilter || n.id === domainFilter
        const l = links.find(lk => {
          const src = typeof lk.source === 'string' ? lk.source : lk.source.id
          return src === n.id
        })
        return true
      })
    : domainNodes

  const filteredIds = new Set(filtered.map(n => n.id))
  const filteredLinks = links.filter(l => {
    const src = typeof l.source === 'string' ? l.source : l.source.id
    const tgt = typeof l.target === 'string' ? l.target : l.target.id
    return filteredIds.has(src) && filteredIds.has(tgt)
  })

  const { nodes: laidOut, edges } = useMemo(() => buildLayout(filtered, filteredLinks), [filtered.length, filteredLinks.length, t.flowNodeBg])

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <style>{`@keyframes fadeIn { from { opacity:0 } to { opacity:1 } }`}</style>

      <div style={{ padding: '10px 16px', background: t.topBarBg, borderBottom: `1px solid ${t.topBarBorder}`, display: 'flex', gap: 12, alignItems: 'center' }}>
        <select value={domainFilter} onChange={e => setDomainFilter(e.target.value)}
          style={{ padding: '5px 10px', borderRadius: 7, background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.inputText, fontSize: 12 }}>
          <option value="">All Domains</option>
          {domains.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', color: t.panelSubtext, fontSize: 11 }}>{filtered.length} nodes</span>
      </div>

      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={laidOut} edges={edges} nodeTypes={nodeTypes}
          onNodeClick={(_, n) => {
            const orig = nodes.find(x => x.id === n.id)
            if (orig) onNodeClick(orig)
          }}
          fitView
          style={{ background: t.graphBg }}
        >
          <Background color={t.panelBorder} gap={20} />
          <Controls style={{ background: t.panelBg, border: `1px solid ${t.panelBorder}` }} />
        </ReactFlow>
      </div>
    </div>
  )
}
