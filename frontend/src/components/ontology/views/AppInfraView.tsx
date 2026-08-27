/**
 * App ↔ Infra View — tier-based layout using force-graph with d3 forceY by tier.
 * Renders SVG icons per node type. Shows full infra stack in side panel on click.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useGraphTheme } from '../../../hooks/useGraphTheme'
import type { OntologyNode, OntologyLink } from '../../../api/ontologyUniverse'
import { NODE_TIER } from './nodeTierConfig'

interface Props {
  nodes: OntologyNode[]
  links: OntologyLink[]
  selectedNode: OntologyNode | null
  onNodeClick: (node: OntologyNode) => void
}

// Icon paths keyed by label category
const TYPE_ICONS: Record<string, string> = {
  BusinessApplication: '🏢',
  BusinessDomain:      '🏛️',
  Application:         '📦',
  Service:             '⚙️',
  API:                 '🔌',
  Container:           '🐳',
  VM:                  '💻',
  CloudResource:       '☁️',
  KubernetesCluster:   '⛵',
  DeploymentEnvironment: '🌐',
  Network:             '🕸️',
  Database:            '🗄️',
  DataFlow:            '↔️',
  SecurityFinding:     '🛡️',
  Vulnerability:       '⚠️',
  IAMRole:             '🔑',
  IAMPolicy:           '📋',
}

function getIcon(nodeType: string) {
  return TYPE_ICONS[nodeType] ?? '◈'
}

const TIER_LABELS = [
  'Business',
  'Application / Service',
  'API / Module',
  'Container / VM / Env',
  'Cloud / Network / IAM',
  'Database / Data / Security',
]

export default function AppInfraView({ nodes, links, selectedNode, onNodeClick }: Props) {
  const t = useGraphTheme()
  const [filter, setFilter] = useState({ env: '', severity: '' })
  const [hovered, setHovered] = useState<string | null>(null)

  // Group nodes by tier
  const byTier: OntologyNode[][] = Array.from({ length: 6 }, () => [])
  for (const n of nodes) {
    const tier = NODE_TIER[n.node_type] ?? 5
    byTier[Math.min(tier, 5)].push(n)
  }

  const linkMap = new Map<string, string[]>()
  for (const l of links) {
    const src = typeof l.source === 'string' ? l.source : l.source.id
    const tgt = typeof l.target === 'string' ? l.target : l.target.id
    if (!linkMap.has(src)) linkMap.set(src, [])
    linkMap.get(src)!.push(tgt)
  }

  const nodeStyle = (n: OntologyNode): React.CSSProperties => {
    const sel = selectedNode?.id === n.id
    const hov = hovered === n.id
    return {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      padding: '10px 12px', borderRadius: 10, cursor: 'pointer', minWidth: 80,
      background: sel ? t.accentBg : hov ? t.rowHover : t.panelCard,
      border: `1px solid ${sel ? t.accentBorder : t.panelCardBorder}`,
      transition: 'all 0.18s',
      boxShadow: sel ? `0 0 12px ${t.accent}44` : 'none',
      animation: 'fadeInScale 0.2s ease',
    }
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: t.graphBg, overflowY: 'auto', padding: 24 }}>
      <style>{`
        @keyframes fadeInScale { from { opacity:0; transform:scale(0.9) } to { opacity:1; transform:scale(1) } }
      `}</style>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Environment', value: filter.env, key: 'env', opts: ['', 'production', 'staging', 'dev'] },
          { label: 'Severity',    value: filter.severity, key: 'severity', opts: ['', 'critical', 'high', 'medium', 'low'] },
        ].map(({ label, value, key, opts }) => (
          <select key={key} value={value}
            onChange={e => setFilter(f => ({ ...f, [key]: e.target.value }))}
            style={{ padding: '6px 12px', borderRadius: 8, background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.inputText, fontSize: 12 }}>
            <option value="">{label}: All</option>
            {opts.slice(1).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        <span style={{ marginLeft: 'auto', color: t.panelSubtext, fontSize: 12, alignSelf: 'center' }}>
          {nodes.length} nodes
        </span>
      </div>

      {/* Tier swimlanes */}
      {byTier.map((tierNodes, i) => {
        const visNodes = tierNodes.filter(n => {
          if (filter.env && n.environment !== filter.env) return false
          if (filter.severity && n.severity !== filter.severity) return false
          return true
        })
        if (!visNodes.length) return null
        return (
          <div key={i} style={{
            marginBottom: 16, background: t.flowLaneBg,
            border: `1px solid ${t.flowLaneBorder}`, borderRadius: 12, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.sectionLabel, marginBottom: 10 }}>
              {TIER_LABELS[i]}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {visNodes.map(n => (
                <div key={n.id} style={nodeStyle(n)}
                  onClick={() => onNodeClick(n)}
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered(null)}>
                  <span style={{ fontSize: 20 }}>{getIcon(n.node_type)}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: t.panelText, textAlign: 'center', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.label || n.node_type}
                  </span>
                  <span style={{ fontSize: 9, color: t.panelSubtext }}>{n.node_type}</span>
                  {n.status && n.status !== 'active' && (
                    <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 700 }}>● {n.status}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {nodes.length === 0 && (
        <div style={{ textAlign: 'center', color: t.panelSubtext, marginTop: 80, fontSize: 14 }}>
          No App/Infra nodes found. Run an ingestion to populate the graph.
        </div>
      )}
    </div>
  )
}
