import { useEffect, useRef } from 'react'
import ForceGraph from 'force-graph'
import * as d3 from 'd3'
import { X } from 'lucide-react'
import { useGraphTheme } from '../../hooks/useGraphTheme'

// ── Node colors matching the main OntologyGraph ───────────────────────────────
const NODE_COLORS: Record<string, string> = {
  organization: '#60a5fa', project: '#f59e0b', service: '#10b981',
  repository: '#a78bfa', infrastructure: '#06b6d4', database: '#9c27b0',
  team: '#ec4899', securityfinding: '#ef4444', incident: '#f97316',
  cloud_provider: '#4285f4', container: '#10b981', ai_service: '#ff6b9d',
  api_service: '#ffc107', application: '#00bcd4', network_service: '#009688',
  legacy_process: '#795548', batch_process: '#607d8b', domain: '#3f51b5',
}
const NODE_SIZES: Record<string, number> = {
  project: 14, service: 8, repository: 8, infrastructure: 7, database: 7,
  team: 9, securityfinding: 6, incident: 6, cloud_provider: 10,
  api_service: 6, application: 6, network_service: 6,
}

const LEGEND = [
  { label: 'Project',        color: '#f59e0b' },
  { label: 'Service',        color: '#10b981' },
  { label: 'Repository',     color: '#a78bfa' },
  { label: 'Infrastructure', color: '#06b6d4' },
  { label: 'Database',       color: '#9c27b0' },
  { label: 'Team',           color: '#ec4899' },
  { label: 'Security',       color: '#ef4444' },
  { label: 'Incident',       color: '#f97316' },
]

function getColor(node: any): string {
  return NODE_COLORS[(node.node_type || '').toLowerCase()] ?? node.color ?? '#6b7280'
}
function getSize(node: any): number {
  return NODE_SIZES[(node.node_type || '').toLowerCase()] ?? node.size ?? 5
}

interface Props {
  isOpen: boolean
  onClose: () => void
  projectName: string
  nodes: any[]
  links: any[]
}

export default function ProjectGraphModal({ isOpen, onClose, projectName, nodes, links }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<any>(null)
  const gt = useGraphTheme()

  useEffect(() => {
    if (!isOpen || !containerRef.current || nodes.length === 0) return

    const container = containerRef.current
    const W = container.clientWidth
    const H = container.clientHeight

    const Graph = ForceGraph()(container)
      .width(W).height(H)
      .backgroundColor(gt.graphBg)
      .graphData({ nodes: nodes.map(n => ({ ...n })), links: links.map(l => ({ ...l })) })
      .nodeRelSize(6)
      .nodeVal((n: any) => {
        const s = getSize(n)
        return (s * s) / 36
      })
      .nodeColor(getColor)
      .linkColor((l: any) => {
        const src = typeof l.source === 'object' ? l.source : null
        return (src ? getColor(src) : gt.labelColor) + gt.linkOpacity
      })
      .linkDirectionalArrowLength(4)
      .linkDirectionalArrowRelPos(1)
      .linkDirectionalParticles(2)
      .linkDirectionalParticleWidth(2)
      .linkDirectionalParticleColor((l: any) => {
        const src = typeof l.source === 'object' ? l.source : null
        return src ? getColor(src) : gt.labelColor
      })
      .nodeCanvasObject((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        if (!node || typeof node.x !== 'number' || !isFinite(node.x)) return
        const s = getSize(node)
        const color = getColor(node)
        const glow  = color

        // Halo
        const haloR = s * 3
        const grad = ctx.createRadialGradient(node.x, node.y, s * 0.4, node.x, node.y, haloR)
        grad.addColorStop(0, glow + '55')
        grad.addColorStop(1, glow + '00')
        ctx.beginPath(); ctx.arc(node.x, node.y, haloR, 0, Math.PI * 2)
        ctx.fillStyle = grad; ctx.fill()

        // Body with highlight
        ctx.save()
        ctx.shadowColor = glow; ctx.shadowBlur = 16
        ctx.beginPath(); ctx.arc(node.x, node.y, s, 0, Math.PI * 2)
        const bodyG = ctx.createRadialGradient(node.x - s * 0.3, node.y - s * 0.3, 0, node.x, node.y, s)
        bodyG.addColorStop(0, '#ffffff')
        bodyG.addColorStop(0.3, color + 'ff')
        bodyG.addColorStop(1, glow + 'cc')
        ctx.fillStyle = bodyG; ctx.fill()
        ctx.restore()

        // Label
        const isProj = (node.node_type || '').toLowerCase() === 'project'
        if (!isProj && globalScale < 0.5) return
        const fontSize = isProj ? 10 : Math.max(7, s * 0.55)
        ctx.font = `${isProj ? 'bold ' : ''}${fontSize}px "Inter", sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        const labelY = node.y + s + fontSize + 2
        ctx.strokeStyle = gt.labelShadow; ctx.lineWidth = fontSize * 0.3
        ctx.strokeText(node.label || '', node.x, labelY)
        ctx.fillStyle = gt.labelColor
        ctx.fillText(node.label || '', node.x, labelY)
      })
      .onNodeHover((node: any) => {
        if (container) container.style.cursor = node ? 'pointer' : 'default'
      })
      .cooldownTicks(180)
      .onEngineStop(() => graphRef.current?.zoomToFit(400, 40))

    // D3 forces
    Graph.d3Force('charge').strength(-250)
    Graph.d3Force('link').distance(70)
    Graph.d3Force(
      'collision',
      d3.forceCollide().radius((d: any) => getSize(d) * 3).strength(1).iterations(3)
    )

    graphRef.current = Graph

    const handleResize = () => {
      if (!graphRef.current || !containerRef.current) return
      graphRef.current.width(containerRef.current.clientWidth).height(containerRef.current.clientHeight)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      graphRef.current?._destructor()
      graphRef.current = null
    }
  }, [isOpen, nodes, links, gt.theme])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const closeBtnBase  = gt.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'
  const closeBtnHover = gt.isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)'
  const closeIconColor = gt.isDark ? '#9ca3af' : '#64748b'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9990,
        background: gt.isDark ? 'rgba(0,0,0,0.82)' : 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        position: 'relative',
        width: 'min(calc(100vw - 300px), 1400px)',
        height: 'calc(100vh - 80px)',
        background: gt.panelBg,
        borderRadius: '16px',
        border: `1px solid ${gt.panelBorder}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: gt.isDark ? '0 24px 80px rgba(0,0,0,0.7)' : '0 24px 80px rgba(0,0,0,0.18)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px',
          background: gt.topBarBg,
          borderBottom: `1px solid ${gt.topBarBorder}`,
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: gt.panelText }}>
              {projectName} — Knowledge Graph
            </div>
            <div style={{ fontSize: '11px', color: gt.panelSubtext, marginTop: '2px' }}>
              {nodes.length} nodes · {links.length} connections · Scroll to zoom · Drag to pan
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
              background: closeBtnBase, border: `1px solid ${gt.panelBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = closeBtnHover)}
            onMouseLeave={e => (e.currentTarget.style.background = closeBtnBase)}
          >
            <X size={16} color={closeIconColor} />
          </button>
        </div>

        {/* Graph area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {/* Force graph canvas */}
          <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

          {/* Legend */}
          <div style={{
            position: 'absolute', top: '16px', right: '16px',
            background: gt.legendBg,
            backdropFilter: 'blur(12px)',
            border: `1px solid ${gt.legendBorder}`,
            borderRadius: '10px',
            padding: '12px 14px',
            width: '155px',
            pointerEvents: 'none',
          }}>
            <div style={{
              fontSize: '8px', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '1.5px', color: gt.sectionLabel, marginBottom: '8px',
            }}>
              ◈ Node Types
            </div>
            {LEGEND.map(n => (
              <div key={n.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                  background: n.color, boxShadow: `0 0 6px ${n.color}88`,
                }} />
                <span style={{ fontSize: '10px', color: gt.panelSubtext }}>{n.label}</span>
              </div>
            ))}
            <div style={{ height: '1px', background: gt.divider, margin: '8px 0' }} />
            <div style={{ fontSize: '9px', color: gt.mutedText, lineHeight: 1.6 }}>
              ✦ Hover to highlight<br />
              ✦ Drag nodes to pin<br />
              ✦ Scroll to zoom
            </div>
          </div>

          {/* Empty state */}
          {nodes.length === 0 && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              color: gt.panelSubtext,
            }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>⬡</div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>No graph data</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                No knowledge graph data found for &quot;{projectName}&quot;.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
