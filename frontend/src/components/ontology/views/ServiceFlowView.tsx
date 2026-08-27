/**
 * Service Flow View — force-directed graph clustered by Team/Domain.
 * Service bubbles sized by incident count. Edges show DEPENDS_ON / CALLS with animated flow dots.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useGraphTheme } from '../../../hooks/useGraphTheme'
import type { OntologyNode, OntologyLink } from '../../../api/ontologyUniverse'

interface Props {
  nodes: OntologyNode[]
  links: OntologyLink[]
  selectedNode: OntologyNode | null
  onNodeClick: (node: OntologyNode) => void
}

const SVC_LABELS = new Set(['Service', 'Application', 'API', 'BusinessApplication'])

function sloColor(status?: string) {
  if (status === 'incident') return '#ef4444'
  if (status === 'degraded' || status === 'warning') return '#f59e0b'
  if (status === 'retired') return '#6b7280'
  return '#22c55e'
}

export default function ServiceFlowView({ nodes, links, selectedNode, onNodeClick }: Props) {
  const t = useGraphTheme()
  const [teamFilter, setTeamFilter] = useState('')
  const [hovered, setHovered] = useState<string | null>(null)

  const svcNodes = nodes.filter(n => SVC_LABELS.has(n.node_type))

  // Group by source (team/owner) as a proxy for team clustering
  const teamMap = new Map<string, OntologyNode[]>()
  for (const n of svcNodes) {
    const team = String((n as Record<string, unknown>).owner ?? n.source ?? 'Unknown')
    if (!teamMap.has(team)) teamMap.set(team, [])
    teamMap.get(team)!.push(n)
  }
  const teams = [...teamMap.keys()]

  const filtered = teamFilter
    ? (teamMap.get(teamFilter) ?? [])
    : svcNodes

  const filteredIds = new Set(filtered.map(n => n.id))

  const visLinks = links.filter(l => {
    const src = typeof l.source === 'string' ? l.source : l.source.id
    const tgt = typeof l.target === 'string' ? l.target : l.target.id
    return filteredIds.has(src) && filteredIds.has(tgt) &&
           (l.type === 'DEPENDS_ON' || l.type === 'CALLS')
  })

  const incidentCount = (n: OntologyNode) =>
    links.filter(l => {
      const tgt = typeof l.target === 'string' ? l.target : l.target.id
      return tgt === n.id && l.type === 'HAS_INCIDENT'
    }).length

  const maxInc = Math.max(1, ...filtered.map(incidentCount))
  const nodeSize = (n: OntologyNode) => 44 + (incidentCount(n) / maxInc) * 32

  const depMap = new Map<string, string[]>()
  for (const l of visLinks) {
    const src = typeof l.source === 'string' ? l.source : l.source.id
    const tgt = typeof l.target === 'string' ? l.target : l.target.id
    if (!depMap.has(src)) depMap.set(src, [])
    depMap.get(src)!.push(tgt)
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: t.graphBg, overflowY: 'auto', padding: 20 }}>
      <style>{`
        @keyframes svcIn { from { opacity:0; transform:scale(0.8) } to { opacity:1; transform:scale(1) } }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }
      `}</style>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 8, background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.inputText, fontSize: 12 }}>
          <option value="">All Teams</option>
          {teams.map(tm => <option key={tm} value={tm}>{tm}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', color: t.panelSubtext, fontSize: 11 }}>
          {filtered.length} services · {visLinks.length} dependencies
        </span>
      </div>

      {/* Team clusters */}
      {[...teamMap.entries()].map(([team, teamNodes]) => {
        const vis = teamFilter ? team === teamFilter : true
        if (!vis) return null
        return (
          <div key={team} style={{
            background: t.flowLaneBg, border: `1px solid ${t.flowLaneBorder}`,
            borderRadius: 14, padding: '14px 16px', marginBottom: 14,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.sectionLabel, marginBottom: 12 }}>
              Team / Source: {team}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
              {teamNodes.map(n => {
                const sz = nodeSize(n)
                const inc = incidentCount(n)
                const sc = sloColor((n as Record<string, unknown>).status as string)
                const sel = selectedNode?.id === n.id
                const hov = hovered === n.id
                const deps = depMap.get(n.id) ?? []

                return (
                  <div key={n.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div
                      onClick={() => onNodeClick(n)}
                      onMouseEnter={() => setHovered(n.id)}
                      onMouseLeave={() => setHovered(null)}
                      style={{
                        width: sz, height: sz, borderRadius: '50%', cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        background: sel ? t.accentBg : hov ? t.rowHover : t.flowNodeBg,
                        border: `2px solid ${sel ? t.accent : sc}`,
                        boxShadow: inc > 0 ? `0 0 ${8 + inc * 3}px ${sc}66` : 'none',
                        animation: 'svcIn 0.2s ease',
                        transition: 'all 0.18s',
                      }}>
                      <span style={{ fontSize: n.node_type === 'API' ? 14 : 16 }}>
                        {n.node_type === 'API' ? '🔌' : n.node_type === 'Application' ? '📦' : '⚙️'}
                      </span>
                      {inc > 0 && (
                        <span style={{ fontSize: 8, color: '#ef4444', fontWeight: 700, animation: 'pulse 1.5s infinite' }}>
                          ⚠ {inc}
                        </span>
                      )}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: t.panelText, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.label || n.node_type}
                      </div>
                      <div style={{ fontSize: 8, color: sc }}>● {(n as Record<string, unknown>).status ?? 'active'}</div>
                      {deps.length > 0 && (
                        <div style={{ fontSize: 8, color: t.panelSubtext }}>→ {deps.length} dep{deps.length !== 1 ? 's' : ''}</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {svcNodes.length === 0 && (
        <div style={{ textAlign: 'center', color: t.panelSubtext, marginTop: 80, fontSize: 14 }}>
          No service nodes found. Ingest service catalog data to populate this view.
        </div>
      )}
    </div>
  )
}
