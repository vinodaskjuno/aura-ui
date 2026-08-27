import React, { useMemo } from 'react'
import type { OntologyNode, OntologyLink } from '../../../api/ontologyUniverse'
import { useGraphTheme } from '../../../hooks/useGraphTheme'
import { getNodeIcon } from '../nodeTypeIcons'

interface Props {
  sourceNode: OntologyNode
  targetNode: OntologyNode
  link: OntologyLink
  allNodes: OntologyNode[]
  allLinks: OntologyLink[]
  onBack: () => void
  onNodeClick: (node: OntologyNode) => void
}

function getConnCount(nodeId: string, links: OntologyLink[]): { out: number; inc: number } {
  let out = 0, inc = 0
  for (const l of links) {
    const src = typeof l.source === 'string' ? l.source : (l.source as OntologyNode).id
    const tgt = typeof l.target === 'string' ? l.target : (l.target as OntologyNode).id
    if (src === nodeId) out++
    if (tgt === nodeId) inc++
  }
  return { out, inc }
}

function SideNodeCard({ node, role, gt, onNodeClick }: {
  node: OntologyNode; role: 'SOURCE' | 'TARGET'; gt: any; onNodeClick: (n: OntologyNode) => void
}) {
  const nt = (node.node_type || '').toLowerCase()
  const { Icon } = getNodeIcon(nt)
  const cardColor = (node as any).color || '#60a5fa'
  const techStack: string[] = (node as any).techStack || (node as any).tech_stack || []
  const { out, inc } = getConnCount(node.id, [])

  const roleColor = role === 'SOURCE' ? '#10b981' : '#f59e0b'

  return (
    <div
      onClick={() => onNodeClick(node)}
      style={{
        flex: 1, maxWidth: 320, minWidth: 220,
        background: gt.panelCard, border: `1px solid ${gt.panelBorder}`,
        borderTop: `3px solid ${cardColor}`,
        borderRadius: 12, padding: '20px',
        cursor: 'pointer', transition: 'all 0.15s',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}
      onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = gt.rowHover)}
      onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = gt.panelCard)}
    >
      {/* Role badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px',
          color: roleColor, background: `${roleColor}18`,
          padding: '2px 8px', borderRadius: 4, border: `1px solid ${roleColor}44`,
        }}>{role}</span>
        <span style={{
          fontSize: 9, color: gt.panelSubtext, textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>{nt}</span>
      </div>

      {/* Icon + Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, flexShrink: 0,
          background: `${cardColor}18`, border: `1px solid ${cardColor}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={24} color={cardColor} strokeWidth={1.5} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: gt.panelText, marginBottom: 2 }}>
            {node.label}
          </div>
          {techStack.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {techStack.slice(0, 3).map(t => (
                <span key={t} style={{
                  fontSize: 9, color: gt.panelSubtext,
                  background: `rgba(255,255,255,0.06)`, borderRadius: 4, padding: '1px 5px',
                }}>{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Properties */}
      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 9, color: gt.panelSubtext, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Type</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: gt.panelText }}>{node.node_type}</span>
        </div>
        {(node as any).status && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 9, color: gt.panelSubtext, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Status</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: gt.panelText }}>{(node as any).status}</span>
          </div>
        )}
      </div>

      {node.description && (
        <div style={{ fontSize: 11, color: gt.panelSubtext, lineHeight: 1.5, borderTop: `1px solid ${gt.panelBorder}`, paddingTop: 8 }}>
          {node.description}
        </div>
      )}
    </div>
  )
}

export default function RelationshipFocusOverlay({ sourceNode, targetNode, link, allNodes, allLinks, onBack, onNodeClick }: Props) {
  const gt = useGraphTheme()
  const linkType = link.type || 'LINKED'

  // Other nodes connected via the same relationship from source
  const siblingTargets = useMemo(() => {
    return allLinks
      .filter(l => {
        const src = typeof l.source === 'string' ? l.source : (l.source as OntologyNode).id
        return src === sourceNode.id && l.type === linkType
      })
      .map(l => {
        const tgtId = typeof l.target === 'string' ? l.target : (l.target as OntologyNode).id
        return allNodes.find(n => n.id === tgtId)
      })
      .filter((n): n is OntologyNode => !!n && n.id !== targetNode.id)
      .slice(0, 10)
  }, [allLinks, allNodes, sourceNode.id, targetNode.id, linkType])

  // Interesting link properties (exclude internal/object values)
  const linkProps = useMemo(() => {
    const entries: [string, string][] = []
    for (const [k, v] of Object.entries(link as any)) {
      if (['source', 'target', 'type', 'id', 'index', '__controlPoints'].includes(k)) continue
      if (typeof v === 'object') continue
      entries.push([k, String(v)])
    }
    return entries
  }, [link])

  return (
    <div style={{
      position: 'absolute', inset: 0, top: '52px',
      background: gt.graphBg, overflowY: 'auto',
      padding: '24px',
      zIndex: 10,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
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
          ← Back
        </button>
        <span style={{ fontSize: 13, color: gt.panelSubtext, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sourceNode.label}
        </span>
        <span style={{
          padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
          background: 'rgba(167,139,250,0.15)', color: '#a78bfa',
          border: '1px solid rgba(167,139,250,0.35)', flexShrink: 0,
        }}>
          [{linkType}]
        </span>
        <span style={{ fontSize: 13, color: gt.panelSubtext }}>→</span>
        <span style={{ fontSize: 13, color: gt.panelText, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {targetNode.label}
        </span>
      </div>

      {/* Two-node card layout */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap' }}>
        <SideNodeCard node={sourceNode} role="SOURCE" gt={gt} onNodeClick={onNodeClick} />

        {/* Relationship arrow */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 8px', flexShrink: 0 }}>
          <div style={{ height: 2, width: 48, background: 'rgba(167,139,250,0.4)' }} />
          <div style={{
            margin: '8px 0',
            padding: '5px 12px', borderRadius: 999,
            background: 'rgba(167,139,250,0.12)', color: '#a78bfa',
            border: '1px solid rgba(167,139,250,0.35)',
            fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
          }}>
            {linkType}
          </div>
          <div style={{ height: 2, width: 48, background: 'rgba(167,139,250,0.4)' }} />
          <div style={{ fontSize: 14, color: '#a78bfa', marginTop: 4 }}>▶</div>
        </div>

        <SideNodeCard node={targetNode} role="TARGET" gt={gt} onNodeClick={onNodeClick} />
      </div>

      {/* Relationship properties */}
      {linkProps.length > 0 && (
        <div style={{
          background: gt.panelCard, border: `1px solid ${gt.panelBorder}`,
          borderRadius: 12, padding: '16px 20px', marginBottom: 20,
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: gt.panelSubtext, marginBottom: 12 }}>
            Relationship Properties
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {linkProps.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 9, color: gt.panelSubtext, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{k}</span>
                <span style={{ fontSize: 12, color: gt.panelText, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sibling targets */}
      {siblingTargets.length > 0 && (
        <div style={{
          background: gt.panelCard, border: `1px solid ${gt.panelBorder}`,
          borderRadius: 12, padding: '16px 20px',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: gt.panelSubtext, marginBottom: 12 }}>
            Other {linkType} Connections from {sourceNode.label} ({siblingTargets.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {siblingTargets.map(n => {
              const nt = (n.node_type || '').toLowerCase()
              const { Icon } = getNodeIcon(nt)
              const c = (n as any).color || '#60a5fa'
              return (
                <div
                  key={n.id}
                  onClick={() => onNodeClick(n)}
                  title={n.label}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                    background: `${c}12`, border: `1px solid ${c}33`,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = `${c}25`)}
                  onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = `${c}12`)}
                >
                  <Icon size={13} color={c} strokeWidth={1.8} />
                  <span style={{ fontSize: 11, color: gt.panelText, fontWeight: 600 }}>{n.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
