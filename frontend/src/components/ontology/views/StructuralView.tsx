import React, { useState, useMemo } from 'react'
import type { OntologyNode, OntologyLink } from '../../../api/ontologyUniverse'
import { useGraphTheme } from '../../../hooks/useGraphTheme'
import { useOntologyStore } from '../../../store/ontologyStore'
import { getNodeIcon } from '../nodeTypeIcons'
import RelationshipFocusOverlay from './RelationshipFocusOverlay'
import { AnimatedVConnector, AnimatedHBus } from '../EdgeConnectors'

const SERVICE_CHILD_GROUPS = [
  { id: 'apis',     label: 'API Endpoints',  color: '#f59e0b', types: ['api'] },
  { id: 'modules',  label: 'Modules',        color: '#a78bfa', types: ['module'] },
  { id: 'data',     label: 'Data & Storage', color: '#9c27b0', types: ['database', 'table'] },
  { id: 'flows',    label: 'Data Flows',     color: '#f97316', types: ['dataflow'] },
  { id: 'infra',    label: 'Cloud & Infra',  color: '#06b6d4', types: ['cloudresource', 'kubernetescluster', 'network', 'deploymentenvironment', 'buildpipeline'] },
  { id: 'rules',    label: 'Business Rules', color: '#ef4444', types: ['businessrule', 'featureflag'] },
  { id: 'features', label: 'Features',       color: '#00bcd4', types: ['feature'] },
]

const LEGEND_ITEMS = [
  { color: '#f59e0b', label: 'Project' },
  { color: '#10b981', label: 'Service' },
  { color: '#f59e0b', label: 'APIs' },
  { color: '#a78bfa', label: 'Modules' },
  { color: '#06b6d4', label: 'Infra' },
  { color: '#9c27b0', label: 'Data' },
]

interface Props {
  nodes: OntologyNode[]
  links: OntologyLink[]
  selectedNode: OntologyNode | null
  onNodeClick: (node: OntologyNode) => void
  onBack: () => void
}

/** Org-wide containers — reached but never traversed through. */
const HUB_TYPES = new Set(['organization', 'enterprise', 'businessunit'])

/** Neighbours in either direction. */
function getAdjacentIds(nodeId: string, links: OntologyLink[]): string[] {
  const result: string[] = []
  for (const l of links) {
    const src = typeof l.source === 'string' ? l.source : (l.source as OntologyNode).id
    const tgt = typeof l.target === 'string' ? l.target : (l.target as OntologyNode).id
    if (src === nodeId) result.push(tgt)
    else if (tgt === nodeId) result.push(src)
  }
  return result
}

function getOutgoingIds(nodeId: string, links: OntologyLink[]): string[] {
  const result: string[] = []
  for (const l of links) {
    const src = typeof l.source === 'string' ? l.source : (l.source as OntologyNode).id
    const tgt = typeof l.target === 'string' ? l.target : (l.target as OntologyNode).id
    if (src === nodeId) result.push(tgt)
  }
  return result
}

interface NodeCardProps {
  node: OntologyNode
  accentColor: string
  isSelected: boolean
  onClick: (n: OntologyNode) => void
  gt: any
}

function NodeCard({ node, accentColor, isSelected, onClick, gt }: NodeCardProps) {
  const nt = (node.node_type || '').toLowerCase()
  const topColor = (node as any).color || accentColor
  const { Icon } = getNodeIcon(nt)
  return (
    <div
      onClick={() => onClick(node)}
      title={node.label}
      style={{
        display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
        padding: '12px 14px', minWidth: 130, maxWidth: 200,
        background: isSelected ? `${accentColor}22` : gt.panelCard,
        border: `1px solid ${isSelected ? accentColor : gt.panelCardBorder}`,
        borderTop: `3px solid ${topColor}`,
        borderRadius: 10, cursor: 'pointer',
        transition: 'all 0.15s', textAlign: 'center', flexShrink: 0, gap: 6,
      }}
      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = gt.rowHover }}
      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = gt.panelCard }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 8,
        background: `${topColor}18`, border: `1px solid ${topColor}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={18} color={topColor} strokeWidth={1.7} />
      </div>
      <div style={{
        fontSize: 12, fontWeight: 700, color: gt.panelText,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        width: '100%',
      }}>
        {node.label}
      </div>
      <div style={{ fontSize: 9, color: gt.panelSubtext, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {nt}
      </div>
    </div>
  )
}

interface GroupCardProps {
  label: string
  color: string
  count: number
  isExpanded: boolean
  onClick: () => void
  gt: any
}

function GroupCard({ label, color, count, isExpanded, onClick, gt, nodeType }: GroupCardProps & { nodeType?: string }) {
  const { Icon } = getNodeIcon(nodeType || label.split(' ')[0].toLowerCase())
  return (
    <div
      onClick={onClick}
      style={{
        display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
        padding: '12px 16px', minWidth: 120,
        background: `${color}18`, border: `1px solid ${color}55`,
        borderTop: `3px solid ${color}`,
        borderRadius: 10, cursor: 'pointer',
        transition: 'all 0.15s', textAlign: 'center', gap: 4,
      }}
      onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = `${color}28`)}
      onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = `${color}18`)}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 7,
        background: `${color}25`, border: `1px solid ${color}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 2,
      }}>
        <Icon size={15} color={color} strokeWidth={1.7} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color, lineHeight: 1.3 }}>{label}</div>
      <div style={{ fontSize: 11, color: `${color}cc` }}>×{count}</div>
      <div style={{ fontSize: 10, color: `${color}88` }}>{isExpanded ? '▲' : '▼'}</div>
    </div>
  )
}


const LEAF_PREVIEW = 5

interface FocusedRel { sourceNode: OntologyNode; targetNode: OntologyNode; link: OntologyLink }

export default function StructuralView({ nodes, links, selectedNode, onNodeClick, onBack }: Props) {
  const gt = useGraphTheme()
  const focusedProjectNode = useOntologyStore(s => s.focusedProjectNode)
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set())
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [expandedLeaves, setExpandedLeaves] = useState<Set<string>>(new Set())
  const [focusedRel, setFocusedRel] = useState<FocusedRel | null>(null)

  const projectNode = (focusedProjectNode as unknown as OntologyNode | null)
    ?? nodes.find(n => (n.node_type || '').toLowerCase() === 'project')
    ?? null

  /**
   * Services belonging to the project.
   *
   * Outbound-only resolution returned nothing on real data: the graph stores
   * `Repository -BELONGS_TO-> Project` and `Service -HOSTED_IN-> Repository`, so
   * a project's services sit two hops *upstream*, not downstream. Walk both
   * directions for two hops instead, stopping at org-wide hubs so the search
   * cannot escape into the rest of the estate.
   */
  const serviceNodes = useMemo(() => {
    if (!projectNode) return []
    const hubIds = new Set(
      nodes.filter(n => HUB_TYPES.has((n.node_type || '').toLowerCase())).map(n => n.id),
    )
    const byId = new Map(nodes.map(n => [n.id, n]))
    const seen = new Set<string>([projectNode.id])
    let frontier = [projectNode.id]
    const found: OntologyNode[] = []

    for (let hop = 0; hop < 2 && frontier.length; hop++) {
      const next: string[] = []
      for (const cur of frontier) {
        for (const id of getAdjacentIds(cur, links)) {
          if (seen.has(id) || hubIds.has(id)) continue
          seen.add(id)
          const n = byId.get(id)
          if (!n) continue
          if ((n.node_type || '').toLowerCase() === 'service') found.push(n)
          else next.push(id)
        }
      }
      frontier = next
    }
    return found
  }, [projectNode, links, nodes])

  const serviceGroups = useMemo(() => {
    const result: Record<string, { group: typeof SERVICE_CHILD_GROUPS[0]; leaves: OntologyNode[] }[]> = {}
    for (const svc of serviceNodes) {
      const childIds = getOutgoingIds(svc.id, links)
      const children = childIds.map(id => nodes.find(n => n.id === id)).filter(Boolean) as OntologyNode[]
      const groups: { group: typeof SERVICE_CHILD_GROUPS[0]; leaves: OntologyNode[] }[] = []
      for (const grp of SERVICE_CHILD_GROUPS) {
        const leaves = children.filter(c => grp.types.includes((c.node_type || '').toLowerCase()))
        if (leaves.length > 0) groups.push({ group: grp, leaves })
      }
      result[svc.id] = groups
    }
    return result
  }, [serviceNodes, links, nodes])

  const toggle = (set: Set<string>, id: string, setter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    setter(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (focusedRel) {
    return (
      <RelationshipFocusOverlay
        sourceNode={focusedRel.sourceNode}
        targetNode={focusedRel.targetNode}
        link={focusedRel.link}
        allNodes={nodes}
        allLinks={links}
        onBack={() => setFocusedRel(null)}
        onNodeClick={onNodeClick}
      />
    )
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, top: '52px',
      background: gt.graphBg,
      overflowY: 'auto', overflowX: 'auto',
      padding: '24px',
      paddingRight: selectedNode ? '404px' : '24px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: gt.panelCard, border: `1px solid ${gt.panelBorder}`,
            borderRadius: 8, padding: '8px 14px',
            color: gt.panelText, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = gt.rowHover)}
          onMouseLeave={e => (e.currentTarget.style.background = gt.panelCard)}
        >
          ← Full View
        </button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: gt.panelText }}>
            ⬡ Structural View
          </div>
          <div style={{ fontSize: 12, color: gt.panelSubtext }}>
            {projectNode?.label} — {serviceNodes.length} service{serviceNodes.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Tree */}
      <div style={{ minWidth: 'max-content', paddingBottom: 40 }}>

        {/* Level 0: Project root */}
        {projectNode && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <NodeCard node={projectNode} accentColor="#f59e0b" isSelected={selectedNode?.id === projectNode.id} onClick={onNodeClick} gt={gt} />
          </div>
        )}

        {serviceNodes.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: gt.panelSubtext, fontSize: 13, marginTop: 20 }}>
            No services found linked to this project. Ingest a repository first.
          </div>
        )}

        {serviceNodes.length > 0 && (
          <>
            <AnimatedVConnector color="#10b981" height={36} />
            {/* Horizontal bus spanning service row */}
            <AnimatedHBus color="#10b981" sweepCount={3} />
            <div style={{ height: 4 }} />

            {/* Level 1: Services */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
              {serviceNodes.map(svc => {
                const isExpanded = expandedServices.has(svc.id)
                const groups = serviceGroups[svc.id] ?? []

                return (
                  <div key={svc.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {/* Service node */}
                    <div style={{ position: 'relative' }}>
                      <NodeCard
                        node={svc}
                        accentColor="#10b981"
                        isSelected={selectedNode?.id === svc.id}
                        onClick={onNodeClick}
                        gt={gt}
                      />
                      {groups.length > 0 && (
                        <button
                          onClick={e => { e.stopPropagation(); toggle(expandedServices, svc.id, setExpandedServices) }}
                          title={isExpanded ? 'Collapse' : 'Expand children'}
                          style={{
                            position: 'absolute', bottom: -14, left: '50%',
                            transform: 'translateX(-50%)',
                            width: 22, height: 22, borderRadius: '50%',
                            background: gt.panelCard,
                            border: `1px solid ${gt.panelBorder}`,
                            color: gt.panelSubtext, fontSize: 9,
                            cursor: 'pointer', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            zIndex: 1, padding: 0, lineHeight: 1,
                          }}
                        >
                          {isExpanded ? '▲' : '▼'}
                        </button>
                      )}
                    </div>

                    {/* Level 2: Group hubs */}
                    {isExpanded && groups.length > 0 && (
                      <>
                        <AnimatedVConnector color="#a78bfa" height={28} dotCount={2} />
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 560 }}>
                          {groups.map(({ group, leaves }) => {
                            const grpKey = `${svc.id}:${group.id}`
                            const isGrpExpanded = expandedGroups.has(grpKey)
                            const isLeavesExpanded = expandedLeaves.has(grpKey)
                            const visibleLeaves = isLeavesExpanded ? leaves : leaves.slice(0, LEAF_PREVIEW)
                            const hasMoreLeaves = leaves.length > LEAF_PREVIEW

                            return (
                              <div key={grpKey} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <GroupCard
                                  label={group.label}
                                  color={group.color}
                                  count={leaves.length}
                                  isExpanded={isGrpExpanded}
                                  onClick={() => toggle(expandedGroups, grpKey, setExpandedGroups)}
                                  gt={gt}
                                  nodeType={group.types[0]}
                                />

                                {/* Level 3: Leaf nodes */}
                                {isGrpExpanded && (
                                  <>
                                    <AnimatedVConnector color={group.color} height={18} dotCount={2} duration={0.7} />
                                    <div style={{
                                      display: 'flex', gap: 6, flexWrap: 'wrap',
                                      justifyContent: 'center', maxWidth: 380,
                                    }}>
                                      {visibleLeaves.map(leaf => {
                                        const isLeafSelected = selectedNode?.id === leaf.id
                                        // Outgoing links from this leaf for relationship tags
                                        const outLinks = links.filter(l => {
                                          const src = typeof l.source === 'string' ? l.source : (l.source as OntologyNode).id
                                          return src === leaf.id
                                        }).slice(0, 2)
                                        return (
                                          <div
                                            key={leaf.id}
                                            style={{
                                              display: 'flex', flexDirection: 'column', gap: 4,
                                              padding: '6px 10px',
                                              background: isLeafSelected ? `${group.color}22` : gt.panelCard,
                                              border: `1px solid ${isLeafSelected ? group.color : gt.panelCardBorder}`,
                                              borderRadius: 6,
                                              maxWidth: 160, minWidth: 100,
                                              transition: 'all 0.15s',
                                            }}
                                            onMouseEnter={e => { if (!isLeafSelected) (e.currentTarget as HTMLDivElement).style.background = gt.rowHover }}
                                            onMouseLeave={e => { if (!isLeafSelected) (e.currentTarget as HTMLDivElement).style.background = gt.panelCard }}
                                          >
                                            <div
                                              onClick={() => onNodeClick(leaf)}
                                              title={leaf.label}
                                              style={{
                                                fontSize: 10, color: gt.panelText, cursor: 'pointer',
                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                fontWeight: 600,
                                              }}
                                            >
                                              {leaf.label}
                                            </div>
                                            {outLinks.length > 0 && (
                                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                {outLinks.map(l => {
                                                  const tgtId = typeof l.target === 'string' ? l.target : (l.target as OntologyNode).id
                                                  const tgtNode = nodes.find(n => n.id === tgtId)
                                                  return (
                                                    <span
                                                      key={`${l.type}-${tgtId}`}
                                                      title={`${l.type} → ${tgtNode?.label ?? tgtId}`}
                                                      onClick={e => {
                                                        e.stopPropagation()
                                                        if (tgtNode) setFocusedRel({ sourceNode: leaf, targetNode: tgtNode, link: l })
                                                      }}
                                                      style={{
                                                        fontSize: 8, padding: '1px 5px',
                                                        borderRadius: 999, cursor: 'pointer',
                                                        background: `${group.color}20`,
                                                        border: `1px solid ${group.color}50`,
                                                        color: group.color,
                                                        fontWeight: 700, textTransform: 'uppercase',
                                                        letterSpacing: '0.3px',
                                                        whiteSpace: 'nowrap', maxWidth: 80,
                                                        overflow: 'hidden', textOverflow: 'ellipsis',
                                                      }}
                                                    >
                                                      {l.type || 'LINK'}
                                                    </span>
                                                  )
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })}
                                      {hasMoreLeaves && (
                                        <button
                                          onClick={() => toggle(expandedLeaves, grpKey, setExpandedLeaves)}
                                          style={{
                                            padding: '5px 10px',
                                            background: 'none',
                                            border: `1px solid ${gt.panelBorder}`,
                                            borderRadius: 6, fontSize: 10,
                                            color: gt.panelSubtext, cursor: 'pointer',
                                            fontWeight: 600,
                                          }}
                                        >
                                          {isLeavesExpanded
                                            ? '▲ Less'
                                            : `▼ +${leaves.length - LEAF_PREVIEW} more`
                                          }
                                        </button>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Legend */}
        <div style={{
          marginTop: 40, padding: '14px 20px',
          background: gt.panelCard, border: `1px solid ${gt.panelBorder}`,
          borderRadius: 10, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: gt.panelSubtext, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Legend</span>
          {LEGEND_ITEMS.map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: gt.panelSubtext }}>{label}</span>
            </div>
          ))}
          <span style={{ fontSize: 11, color: gt.panelSubtext, marginLeft: 'auto' }}>
            Click service nodes to expand · Click group cards to show leaf nodes
          </span>
        </div>
      </div>
    </div>
  )
}
