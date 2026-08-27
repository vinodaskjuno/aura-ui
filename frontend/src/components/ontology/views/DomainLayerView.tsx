import React, { useState, useMemo } from 'react'
import { Cloud, Server, Globe, Database, Layers } from 'lucide-react'
import type { OntologyNode, OntologyLink } from '../../../api/ontologyUniverse'
import { useGraphTheme } from '../../../hooks/useGraphTheme'
import { useOntologyStore } from '../../../store/ontologyStore'
import { getNodeIcon } from '../nodeTypeIcons'
import RelationshipFocusOverlay from './RelationshipFocusOverlay'
import { AnimatedZoneConnector } from '../EdgeConnectors'

// ── Zone configuration ────────────────────────────────────────────────────────
const DOMAIN_ZONES = [
  { id: 'cloud',    label: 'Cloud & AWS',        Icon: Cloud,    color: '#f59e0b',
    types: ['cloudresource','kubernetescluster','deploymentenvironment','buildpipeline','network'] },
  { id: 'services', label: 'Business Services',  Icon: Server,   color: '#10b981',
    types: ['service'] },
  { id: 'apis',     label: 'API Endpoints',       Icon: Globe,    color: '#f59e0b',
    types: ['api'] },
  { id: 'data',     label: 'Data & Integration',  Icon: Database, color: '#9c27b0',
    types: ['database','dataflow','table'] },
  { id: 'logic',    label: 'Modules & Logic',     Icon: Layers,   color: '#a78bfa',
    types: ['module','businessrule','featureflag','feature'] },
] as const

interface Props {
  nodes: OntologyNode[]
  links: OntologyLink[]
  selectedNode: OntologyNode | null
  onNodeClick: (node: OntologyNode) => void
  onBack: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function bfsReachable(startId: string, links: OntologyLink[]): Set<string> {
  const visited = new Set<string>([startId])
  const queue = [startId]
  while (queue.length) {
    const cur = queue.shift()!
    for (const l of links) {
      const src = typeof l.source === 'string' ? l.source : (l.source as OntologyNode).id
      const tgt = typeof l.target === 'string' ? l.target : (l.target as OntologyNode).id
      if (src === cur && !visited.has(tgt)) { visited.add(tgt); queue.push(tgt) }
      if (tgt === cur && !visited.has(src)) { visited.add(src); queue.push(src) }
    }
  }
  return visited
}

function getOutgoingLinks(nodeId: string, links: OntologyLink[]): OntologyLink[] {
  return links.filter(l => {
    const src = typeof l.source === 'string' ? l.source : (l.source as OntologyNode).id
    return src === nodeId
  })
}

function findParentService(nodeId: string, serviceNodes: OntologyNode[], links: OntologyLink[]): OntologyNode | null {
  for (const svc of serviceNodes) {
    const childIds = getOutgoingLinks(svc.id, links).map(l =>
      typeof l.target === 'string' ? l.target : (l.target as OntologyNode).id
    )
    if (childIds.includes(nodeId)) return svc
  }
  return null
}

// ── Node card ─────────────────────────────────────────────────────────────────
interface NodeCardProps {
  node: OntologyNode
  zoneColor: string
  isSelected: boolean
  gt: any
  allNodes: OntologyNode[]
  allLinks: OntologyLink[]
  onSelect: (n: OntologyNode) => void
  onRelTagClick: (sourceNode: OntologyNode, targetNode: OntologyNode, link: OntologyLink) => void
}

function NodeCard({ node, zoneColor, isSelected, gt, allNodes, allLinks, onSelect, onRelTagClick }: NodeCardProps) {
  const nt = (node.node_type || '').toLowerCase()
  const { Icon } = getNodeIcon(nt)
  const cardColor = (node as any).color || zoneColor
  const techStack: string[] = (node as any).techStack || (node as any).tech_stack || []
  const outLinks = useMemo(() => getOutgoingLinks(node.id, allLinks), [node.id, allLinks])
  const totalConns = outLinks.length + allLinks.filter(l => {
    const tgt = typeof l.target === 'string' ? l.target : (l.target as OntologyNode).id
    return tgt === node.id
  }).length

  // Collect up to 2 unique outgoing relationship types
  const relTypes = useMemo(() => {
    const seen = new Set<string>()
    const result: { type: string; link: OntologyLink; targetNode: OntologyNode | null }[] = []
    for (const l of outLinks) {
      if (seen.has(l.type) || result.length >= 2) continue
      seen.add(l.type)
      const tgtId = typeof l.target === 'string' ? l.target : (l.target as OntologyNode).id
      const targetNode = allNodes.find(n => n.id === tgtId) ?? null
      if (targetNode) result.push({ type: l.type, link: l, targetNode })
    }
    return result
  }, [outLinks, allNodes])

  return (
    <div
      onClick={() => onSelect(node)}
      title={node.label}
      style={{
        width: 148, flexShrink: 0,
        background: isSelected ? `${zoneColor}20` : gt.panelCard,
        border: `1px solid ${isSelected ? zoneColor : gt.panelCardBorder}`,
        borderTop: `3px solid ${cardColor}`,
        borderRadius: 8, cursor: 'pointer',
        transition: 'all 0.15s', padding: '10px',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}
      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = gt.rowHover }}
      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = gt.panelCard }}
    >
      {/* Type badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
        <span style={{
          fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px',
          color: zoneColor, background: `${zoneColor}18`, borderRadius: 4,
          padding: '1px 5px', flexShrink: 0,
        }}>
          • {nt}
        </span>
        {totalConns > 0 && (
          <span style={{
            fontSize: 9, fontWeight: 700, color: gt.panelSubtext,
            background: `${gt.panelBorder}`, borderRadius: 10, padding: '0 5px',
          }}>{totalConns}</span>
        )}
      </div>

      {/* Icon + Name */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: `${cardColor}18`, border: `1px solid ${cardColor}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={16} color={cardColor} strokeWidth={1.8} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: gt.panelText,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {node.label}
          </div>
          {techStack.length > 0 && (
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 2 }}>
              {techStack.slice(0, 2).map(t => (
                <span key={t} style={{
                  fontSize: 8, color: gt.panelSubtext,
                  background: `rgba(255,255,255,0.05)`, borderRadius: 3, padding: '1px 4px',
                }}>{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Relationship tags */}
      {relTypes.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
          {relTypes.map(({ type, link, targetNode }) => (
            <span
              key={type}
              onClick={() => targetNode && onRelTagClick(node, targetNode, link)}
              title={`${type} → ${targetNode?.label ?? '?'}`}
              style={{
                fontSize: 8, padding: '2px 6px', borderRadius: 999,
                background: `${zoneColor}18`, color: zoneColor,
                border: `1px solid ${zoneColor}44`,
                cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = `${zoneColor}35`)}
              onMouseLeave={e => (e.currentTarget.style.background = `${zoneColor}18`)}
            >
              {type}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Service sub-box inside a zone ─────────────────────────────────────────────
interface SubBoxProps {
  label: string
  nodeCount: number
  zoneColor: string
  gt: any
  children: React.ReactNode
}

function ServiceSubBox({ label, nodeCount, zoneColor, gt, children }: SubBoxProps) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div style={{
      border: `1px solid rgba(255,255,255,0.08)`,
      borderRadius: 8, overflow: 'hidden',
      background: 'rgba(255,255,255,0.02)',
      minWidth: 200,
    }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px', cursor: 'pointer', userSelect: 'none',
          borderBottom: collapsed ? 'none' : `1px solid rgba(255,255,255,0.06)`,
        }}
        onClick={() => setCollapsed(v => !v)}
        onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = gt.rowHover)}
        onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = 'transparent')}
      >
        <span style={{ fontSize: 10, fontWeight: 700, color: gt.panelSubtext, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        <span style={{
          fontSize: 9, padding: '1px 7px', borderRadius: 8,
          background: `${zoneColor}22`, color: zoneColor,
          fontWeight: 700, flexShrink: 0,
        }}>{nodeCount}</span>
        <span style={{ fontSize: 9, color: gt.panelSubtext }}>{collapsed ? '▶' : '▼'}</span>
      </div>
      {!collapsed && (
        <div style={{ padding: 10 }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────
export default function DomainLayerView({ nodes, links, selectedNode, onNodeClick, onBack }: Props) {
  const gt = useGraphTheme()
  const focusedProjectNode = useOntologyStore(s => s.focusedProjectNode)
  const [collapsedZones, setCollapsedZones] = useState<Set<string>>(new Set())
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set())
  const [focusedRel, setFocusedRel] = useState<{
    sourceNode: OntologyNode; targetNode: OntologyNode; link: OntologyLink
  } | null>(null)

  const projectNode = (focusedProjectNode as unknown as OntologyNode | null)
    ?? nodes.find(n => (n.node_type || '').toLowerCase() === 'project')
    ?? null

  const reachableIds = useMemo(() => {
    if (!projectNode) return new Set<string>()
    return bfsReachable(projectNode.id, links)
  }, [projectNode, links])

  const reachableNodes = useMemo(() =>
    nodes.filter(n => reachableIds.has(n.id) && n.id !== projectNode?.id),
    [nodes, reachableIds, projectNode]
  )

  const serviceNodes = useMemo(() =>
    reachableNodes.filter(n => (n.node_type || '').toLowerCase() === 'service'),
    [reachableNodes]
  )

  // For each zone: bucket nodes, then sub-group by parent service
  const zoneData = useMemo(() => {
    return DOMAIN_ZONES.map(zone => {
      const zoneNodes = reachableNodes.filter(n =>
        zone.types.includes((n.node_type || '').toLowerCase() as any)
      )
      if (zone.id === 'services') {
        return { zone, groups: [{ label: null, nodes: zoneNodes }] }
      }
      // Group by parent service
      const byService = new Map<string, { svc: OntologyNode | null; items: OntologyNode[] }>()
      const noParent: OntologyNode[] = []
      for (const n of zoneNodes) {
        const svc = findParentService(n.id, serviceNodes, links)
        if (svc) {
          if (!byService.has(svc.id)) byService.set(svc.id, { svc, items: [] })
          byService.get(svc.id)!.items.push(n)
        } else {
          noParent.push(n)
        }
      }
      const groups: { label: string | null; nodes: OntologyNode[] }[] = []
      byService.forEach(({ svc, items }) => groups.push({ label: svc.label, nodes: items }))
      if (noParent.length) groups.push({ label: 'Other', nodes: noParent })
      return { zone, groups }
    })
  }, [reachableNodes, serviceNodes, links])

  const CARD_LIMIT = 6

  const toggleZone = (id: string) =>
    setCollapsedZones(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const toggleExpand = (id: string) =>
    setExpandedZones(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  // If relationship focus overlay is active, render it
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

  const activeZones = zoneData.filter(z => z.groups.some(g => g.nodes.length > 0))

  return (
    <div style={{
      position: 'absolute', inset: 0, top: '52px',
      background: gt.graphBg, overflowY: 'auto',
      padding: '24px',
      paddingRight: selectedNode ? '404px' : '24px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
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
            Infrastructure Universe
          </div>
          <div style={{ fontSize: 12, color: gt.panelSubtext }}>
            {projectNode?.label} · {reachableNodes.length} nodes · {activeZones.length} zones
          </div>
        </div>
      </div>

      {/* Zone cards with live edge connectors between them */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {activeZones.map(({ zone, groups }, zoneIdx) => {
          const totalCount = groups.reduce((s, g) => s + g.nodes.length, 0)
          const isCollapsed = collapsedZones.has(zone.id)
          const isExpanded = expandedZones.has(zone.id)
          const nextZone = activeZones[zoneIdx + 1]?.zone

          return (
            <React.Fragment key={zone.id}>
            <div style={{
              background: gt.panelCard,
              border: `1px solid ${zone.color}44`,
              borderLeft: `4px solid ${zone.color}`,
              borderRadius: 12, overflow: 'hidden',
            }}>
              {/* Zone header */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '14px 18px', cursor: 'pointer', userSelect: 'none',
                  borderBottom: isCollapsed ? 'none' : `1px solid rgba(255,255,255,0.06)`,
                  transition: 'background 0.15s',
                }}
                onClick={() => toggleZone(zone.id)}
                onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = gt.rowHover)}
                onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = 'transparent')}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: `${zone.color}18`, border: `1px solid ${zone.color}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <zone.Icon size={16} color={zone.color} strokeWidth={1.8} />
                </div>
                <span style={{
                  flex: 1, fontWeight: 700, fontSize: 12, color: gt.panelText,
                  textTransform: 'uppercase', letterSpacing: '0.9px',
                }}>
                  {zone.label}
                </span>
                <span style={{
                  padding: '3px 12px', borderRadius: 12,
                  background: `${zone.color}22`, color: zone.color,
                  fontWeight: 700, fontSize: 11, border: `1px solid ${zone.color}44`, flexShrink: 0,
                }}>
                  {totalCount} nodes
                </span>
                <span style={{ color: gt.panelSubtext, fontSize: 12, marginLeft: 8 }}>
                  {isCollapsed ? '▶' : '▼'}
                </span>
              </div>

              {/* Zone body */}
              {!isCollapsed && (
                <div style={{ padding: 16 }}>
                  {zone.id === 'services' ? (
                    /* Services: flat card grid */
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {(isExpanded ? groups[0].nodes : groups[0].nodes.slice(0, CARD_LIMIT)).map(n => (
                        <NodeCard
                          key={n.id} node={n}
                          zoneColor={zone.color}
                          isSelected={selectedNode?.id === n.id}
                          gt={gt}
                          allNodes={nodes} allLinks={links}
                          onSelect={onNodeClick}
                          onRelTagClick={(src, tgt, lnk) => setFocusedRel({ sourceNode: src, targetNode: tgt, link: lnk })}
                        />
                      ))}
                      {!isExpanded && groups[0].nodes.length > CARD_LIMIT && (
                        <button
                          onClick={() => toggleExpand(zone.id)}
                          style={{
                            alignSelf: 'center', padding: '8px 14px',
                            background: 'none', border: `1px solid ${gt.panelBorder}`,
                            borderRadius: 8, color: gt.panelSubtext, fontSize: 11,
                            cursor: 'pointer', fontWeight: 600, transition: 'color 0.15s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.color = gt.panelText)}
                          onMouseLeave={e => (e.currentTarget.style.color = gt.panelSubtext)}
                        >
                          ▼ +{groups[0].nodes.length - CARD_LIMIT} more
                        </button>
                      )}
                      {isExpanded && groups[0].nodes.length > CARD_LIMIT && (
                        <button
                          onClick={() => toggleExpand(zone.id)}
                          style={{
                            alignSelf: 'center', padding: '8px 14px',
                            background: 'none', border: `1px solid ${gt.panelBorder}`,
                            borderRadius: 8, color: gt.panelSubtext, fontSize: 11,
                            cursor: 'pointer', fontWeight: 600,
                          }}
                        >▲ Less</button>
                      )}
                    </div>
                  ) : (
                    /* Other zones: grouped by parent service */
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      {groups.filter(g => g.nodes.length > 0).map((g, gi) => (
                        <ServiceSubBox
                          key={g.label ?? gi}
                          label={g.label ?? 'Other'}
                          nodeCount={g.nodes.length}
                          zoneColor={zone.color}
                          gt={gt}
                        >
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {g.nodes.map(n => (
                              <NodeCard
                                key={n.id} node={n}
                                zoneColor={zone.color}
                                isSelected={selectedNode?.id === n.id}
                                gt={gt}
                                allNodes={nodes} allLinks={links}
                                onSelect={onNodeClick}
                                onRelTagClick={(src, tgt, lnk) => setFocusedRel({ sourceNode: src, targetNode: tgt, link: lnk })}
                              />
                            ))}
                          </div>
                        </ServiceSubBox>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Live edge connector flowing into next zone */}
            {nextZone && !isCollapsed && (
              <AnimatedZoneConnector
                fromColor={zone.color}
                toColor={nextZone.color}
                height={32}
              />
            )}
            {nextZone && isCollapsed && (
              <div style={{ height: 12 }} />
            )}
            </React.Fragment>
          )
        })}
      </div>

      {activeZones.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: gt.panelSubtext }}>
          <div style={{ fontSize: 40, opacity: 0.3, marginBottom: 12 }}>◉</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: gt.panelText, marginBottom: 8 }}>No nodes found</div>
          <div style={{ fontSize: 13 }}>Ingest a repository to populate the infrastructure graph.</div>
        </div>
      )}
    </div>
  )
}
