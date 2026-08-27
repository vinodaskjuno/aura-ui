import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import ForceGraph from 'force-graph'
import * as d3 from 'd3'
import type { OntologyNode, OntologyLink, ViewMode } from '../../types/ontology'
import { useThemeStore } from '../../store/themeStore'

interface Props {
  allNodes: OntologyNode[]
  allLinks: OntologyLink[]
  currentView: ViewMode
  hierarchyLevel: number
  hierarchyPath: string[]
  activeFilters: Set<string>
  searchTerm: string
  selectedNode: OntologyNode | null
  hoveredNode: OntologyNode | null
  expandedNodes: Set<string>
  selectedLink: OntologyLink | null
  onNodeClick: (node: OntologyNode | null) => void
  onNodeHover: (node: OntologyNode | null) => void
  onExpandToggle: (nodeId: string) => void
  onHierarchyChange: (level: number, path: string[]) => void
  onLinkClick: (link: OntologyLink) => void
  onLinkHover: (link: OntologyLink | null) => void
  highlightedNodeIds?: Set<string>
}

export interface OntologyGraphRef {
  zoomIn: () => void
  zoomOut: () => void
  zoomToFit: () => void
}

// ── Galaxy color palette ──────────────────────────────────────────────────────
const NODE_TYPE_CONFIG: Record<string, { color: string; label: string; group: string; glow: string }> = {
  'organization':          { color: '#60a5fa', label: 'Organizations',       group: 'Enterprise Entities', glow: '#60a5fa' },
  'project':               { color: '#f59e0b', label: 'Projects',            group: 'Enterprise Entities', glow: '#fbbf24' },
  'service':               { color: '#10b981', label: 'Services',            group: 'Enterprise Entities', glow: '#34d399' },
  'repository':            { color: '#a78bfa', label: 'Repositories',        group: 'Enterprise Entities', glow: '#c4b5fd' },
  'infrastructure':        { color: '#06b6d4', label: 'Infrastructure',      group: 'Enterprise Entities', glow: '#22d3ee' },
  'database':              { color: '#9c27b0', label: 'Databases',           group: 'Data & Storage',      glow: '#ba68c8' },
  'team':                  { color: '#ec4899', label: 'Teams',               group: 'Enterprise Entities', glow: '#f472b6' },
  'securityfinding':       { color: '#ef4444', label: 'Security Findings',   group: 'Risk & Operations',   glow: '#f87171' },
  'incident':              { color: '#f97316', label: 'Incidents',           group: 'Risk & Operations',   glow: '#fb923c' },
  'auditlog':              { color: '#6b7280', label: 'Audit Logs',          group: 'Risk & Operations',   glow: '#9ca3af' },
  'cloud_provider':        { color: '#4285f4', label: 'Cloud Providers',     group: 'Cloud & Compute',     glow: '#6ea6ff' },
  'container':             { color: '#10b981', label: 'Containers',          group: 'Cloud & Compute',     glow: '#34d399' },
  'location':              { color: '#8bc34a', label: 'Locations',           group: 'Cloud & Compute',     glow: '#aee060' },
  'ai_service':            { color: '#ff6b9d', label: 'AI Services',         group: 'AI & Intelligence',   glow: '#ff8fb5' },
  'api_service':           { color: '#ffc107', label: 'API Services',        group: 'Applications',        glow: '#ffd54f' },
  'application':           { color: '#00bcd4', label: 'Applications',        group: 'Applications',        glow: '#4dd0e1' },
  'network_service':       { color: '#009688', label: 'Network Services',    group: 'Applications',        glow: '#4db6ac' },
  'database_host':         { color: '#9c27b0', label: 'Database Hosts',      group: 'Data & Storage',      glow: '#ba68c8' },
  'database_object':       { color: '#673ab7', label: 'Database Objects',    group: 'Data & Storage',      glow: '#9575cd' },
  'security':              { color: '#f44336', label: 'Security',            group: 'Security',            glow: '#ef9a9a' },
  'legacy_process':        { color: '#795548', label: 'Legacy Processes',    group: 'Legacy & Batch',      glow: '#a1887f' },
  'batch_process':         { color: '#607d8b', label: 'Batch Processes',     group: 'Legacy & Batch',      glow: '#90a4ae' },
  'domain':                { color: '#3f51b5', label: 'Domains',             group: 'Infrastructure',      glow: '#7986cb' },
  'category':              { color: '#5a7aaa', label: 'Categories',          group: 'Infrastructure',      glow: '#7a9abf' },
  'component':             { color: '#6a8fca', label: 'Components',          group: 'Infrastructure',      glow: '#8aafea' },
  // ── Git Repo Loader node types (Neo4j labels) ─────────────────────────────
  'api':                   { color: '#f59e0b', label: 'API Endpoints',       group: 'Applications',        glow: '#fbbf24' },
  'module':                { color: '#a78bfa', label: 'Modules',             group: 'Applications',        glow: '#c4b5fd' },
  'dataflow':              { color: '#f97316', label: 'Data Flows',          group: 'Data & Storage',      glow: '#fb923c' },
  'businessrule':          { color: '#ef4444', label: 'Business Rules',      group: 'Risk & Operations',   glow: '#f87171' },
  'cloudresource':         { color: '#06b6d4', label: 'Cloud Resources',     group: 'Cloud & Compute',     glow: '#22d3ee' },
  'kubernetescluster':     { color: '#4285f4', label: 'K8s Clusters',        group: 'Cloud & Compute',     glow: '#6ea6ff' },
  'network':               { color: '#009688', label: 'Networks',            group: 'Cloud & Compute',     glow: '#4db6ac' },
  'deploymentenvironment': { color: '#8bc34a', label: 'Environments',        group: 'Cloud & Compute',     glow: '#aee060' },
  'buildpipeline':         { color: '#ec4899', label: 'Build Pipelines',     group: 'Legacy & Batch',      glow: '#f472b6' },
  'table':                 { color: '#673ab7', label: 'Tables',              group: 'Data & Storage',      glow: '#9575cd' },
  'featureflag':           { color: '#f97316', label: 'Feature Flags',       group: 'Applications',        glow: '#fb923c' },
  'feature':               { color: '#00bcd4', label: 'Features',            group: 'Applications',        glow: '#4dd0e1' },
  // ── Group hub nodes (virtual, per-service grouping) ───────────────────────
  'group_hub':             { color: '#1e293b', label: 'Group',               group: 'Infrastructure',      glow: '#334155' },
}

// ── Per-service child grouping config ─────────────────────────────────────────
// Each service's children are bucketed into these categories, creating:
//   Project → Service → [Group Hub] → leaf nodes
interface ServiceGroupConfig {
  id: string; label: string; color: string; glow: string; types: string[]
}
const SERVICE_CHILD_GROUPS: ServiceGroupConfig[] = [
  { id: 'apis',     label: 'API Endpoints',  color: '#f59e0b', glow: '#fbbf24', types: ['api'] },
  { id: 'modules',  label: 'Modules',        color: '#a78bfa', glow: '#c4b5fd', types: ['module'] },
  { id: 'data',     label: 'Data & Storage', color: '#9c27b0', glow: '#ba68c8', types: ['database', 'table'] },
  { id: 'flows',    label: 'Data Flows',     color: '#f97316', glow: '#fb923c', types: ['dataflow'] },
  { id: 'infra',    label: 'Cloud & Infra',  color: '#06b6d4', glow: '#22d3ee', types: ['cloudresource', 'kubernetescluster', 'network', 'deploymentenvironment', 'buildpipeline'] },
  { id: 'rules',    label: 'Business Rules', color: '#ef4444', glow: '#f87171', types: ['businessrule', 'featureflag'] },
  { id: 'features', label: 'Features',       color: '#00bcd4', glow: '#4dd0e1', types: ['feature'] },
]

const FALLBACK_COLORS = [
  '#60a5fa','#f59e0b','#10b981','#a78bfa','#ec4899',
  '#06b6d4','#f97316','#ef4444','#34d399','#fbbf24',
]

// ── Step 2: Node size hierarchy ───────────────────────────────────────────────
const NODE_SIZES: Record<string, number> = {
  organization: 20, project: 14, team: 9,
  service: 8, repository: 8, infrastructure: 7, database: 7,
  securityfinding: 6, incident: 6,
  // legacy types
  cloud_provider: 12, domain: 10, ai_service: 7, api_service: 7,
  application: 7, container: 6, location: 6, network_service: 6,
  database_host: 6, database_object: 5, security: 6,
  legacy_process: 5, batch_process: 5, category: 9, component: 6,
  // Git Repo Loader types
  api: 5, module: 5, dataflow: 5, businessrule: 5,
  cloudresource: 6, kubernetescluster: 7, network: 5,
  deploymentenvironment: 6, buildpipeline: 6, table: 5,
  featureflag: 4, feature: 4,
  // Group hub nodes (per-service virtual grouping)
  group_hub: 11,
}

function nodeBaseSize(node: any): number {
  const key = (node.node_type || node.type || '').toLowerCase()
  return NODE_SIZES[key] ?? node.size ?? 5
}

function nodeColor(node: any): string {
  const key = (node.node_type || node.type || '').toLowerCase()
  return NODE_TYPE_CONFIG[key]?.color ?? node.color ?? FALLBACK_COLORS[Math.abs(hashStr(key)) % FALLBACK_COLORS.length]
}

function nodeGlow(node: any): string {
  const key = (node.node_type || node.type || '').toLowerCase()
  return NODE_TYPE_CONFIG[key]?.glow ?? nodeColor(node)
}

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}

function resolveId(endpoint: string | OntologyNode): string {
  return typeof endpoint === 'string' ? endpoint : endpoint?.id ?? ''
}

const GROUPS = Array.from(new Set(Object.values(NODE_TYPE_CONFIG).map(c => c.group)))

// ── Multi-perspective hierarchy config ────────────────────────────────────────
interface Perspective {
  id: string
  label: string
  color: string
  description: string
  rootType: string
  excludeTypes: string[]
}

const PERSPECTIVES: Perspective[] = [
  {
    id: 'application', label: 'Application', color: '#f59e0b',
    description: 'Project → Services → Infra → DB → Security',
    rootType: 'project', excludeTypes: ['organization'],
  },
  {
    id: 'database', label: 'Database', color: '#9c27b0',
    description: 'Database → Connected Apps → Security',
    rootType: 'database', excludeTypes: ['organization'],
  },
  {
    id: 'team', label: 'Team', color: '#ec4899',
    description: 'Team → Projects → Services → Repos',
    rootType: 'team', excludeTypes: ['organization'],
  },
  {
    id: 'security', label: 'Security', color: '#ef4444',
    description: 'SecurityFinding → Resources → Services',
    rootType: 'securityfinding', excludeTypes: ['organization'],
  },
  {
    id: 'infrastructure', label: 'Infrastructure', color: '#06b6d4',
    description: 'Infrastructure → Services → Projects → Incidents',
    rootType: 'infrastructure', excludeTypes: ['organization'],
  },
  {
    id: 'incident', label: 'Incident', color: '#f97316',
    description: 'Incident → Affected Services → Projects',
    rootType: 'incident', excludeTypes: ['organization'],
  },
]

// ── Star field helpers ────────────────────────────────────────────────────────
interface Star { x: number; y: number; r: number; opacity: number }

function generateStars(w: number, h: number, count = 300): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * w, y: Math.random() * h,
    r: Math.random() * 1.2 + 0.2, opacity: Math.random() * 0.7 + 0.1,
  }))
}

function drawStarField(ctx: CanvasRenderingContext2D, stars: Star[]) {
  stars.forEach(s => {
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255,255,255,${s.opacity})`
    ctx.fill()
  })
}

const OntologyGraph = forwardRef<OntologyGraphRef, Props>(({
  allNodes, allLinks, currentView, hierarchyLevel, hierarchyPath,
  activeFilters, searchTerm, selectedNode, hoveredNode, expandedNodes,
  selectedLink,
  onNodeClick, onNodeHover, onExpandToggle, onHierarchyChange,
  onLinkClick, onLinkHover,
  highlightedNodeIds,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const starCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const starsRef = useRef<Star[]>([])
  const graphRef = useRef<any>(null)

  // ── Step 1: Cluster mapping refs ──────────────────────────────────────────
  const nodeToProjectRef  = useRef<Map<string, string>>(new Map())
  const clusterCentersRef = useRef<Record<string, { x: number; y: number }>>({})
  const currentViewRef    = useRef<ViewMode>(currentView)

  // ── Step 5: Link state refs (stable, no stale closure) ───────────────────
  const hoveredLinkRef  = useRef<any>(null)
  const selectedLinkRef = useRef<OntologyLink | null>(null)

  // ── Theme ref — canvas callbacks read this every frame ───────────────────
  const { theme } = useThemeStore()
  const themeRef = useRef(theme)

  // Sync prop refs
  useEffect(() => { currentViewRef.current = currentView }, [currentView])
  useEffect(() => { selectedLinkRef.current = selectedLink }, [selectedLink])
  useEffect(() => { themeRef.current = theme }, [theme])

  useImperativeHandle(ref, () => ({
    zoomIn:    () => graphRef.current?.zoom(graphRef.current.zoom() * 1.3, 400),
    zoomOut:   () => graphRef.current?.zoom(graphRef.current.zoom() / 1.3, 400),
    zoomToFit: () => graphRef.current?.zoomToFit(400, 60),
  }))

  const paintStars = (w: number, h: number, t = themeRef.current) => {
    const canvas = starCanvasRef.current
    if (!canvas) return
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')!

    const gradDef =
      t === 'dark2' ? ['#0d0d0d', '#080808', '#030303'] :
      t === 'light' ? ['#cddff5', '#deeaf8', '#edf3fb'] :
                      ['#0d0f2b', '#060818', '#020408']

    const grad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w,h)*0.7)
    grad.addColorStop(0,   gradDef[0])
    grad.addColorStop(0.5, gradDef[1])
    grad.addColorStop(1,   gradDef[2])
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)

    if (t === 'light') {
      // Very faint cloud-like particles instead of stars
      starsRef.current.forEach(s => {
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r * 0.5, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(100,140,200,${s.opacity * 0.12})`
        ctx.fill()
      })
    } else {
      const opMul = t === 'dark2' ? 0.5 : 1.0
      starsRef.current.forEach(s => {
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${s.opacity * opMul})`
        ctx.fill()
      })
    }
  }

  // ── Initialize force-graph once ───────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || allNodes.length === 0) return
    const container = containerRef.current
    const W = container.clientWidth
    const H = container.clientHeight

    // Star field canvas behind graph
    const starCanvas = document.createElement('canvas')
    starCanvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:0'
    container.appendChild(starCanvas)
    starCanvasRef.current = starCanvas
    starsRef.current = generateStars(W, H, 400)
    paintStars(W, H)

    const Graph = ForceGraph()(container)
      .width(W).height(H)
      .backgroundColor('rgba(2,4,8,0.92)')
      .graphData({ nodes: [], links: [] })
      .nodeRelSize(6)
      .nodeVal((n: any) => {
        const s = nodeBaseSize(n)
        return s * s / 36  // scale so nodeRelSize(6) gives correct px radius
      })

      // ── Step 5: Link visuals (refs prevent stale closure) ─────────────────
      .linkColor((link: any) => {
        const src = typeof link.source === 'object' ? link.source : null
        const col = src ? nodeColor(src) : '#ffffff'
        const opacity = themeRef.current === 'light' ? 'bb' : '88'
        return col + opacity
      })
      .linkWidth((link: any) => {
        if (hoveredLinkRef.current === link || selectedLinkRef.current === link) return 3
        return 1.5
      })
      .linkDirectionalArrowLength(5)
      .linkDirectionalArrowColor((link: any) => {
        const src = typeof link.source === 'object' ? link.source : null
        return src ? nodeColor(src) + 'cc' : '#ffffff99'
      })
      .linkDirectionalArrowRelPos(1)
      .linkDirectionalParticles((link: any) =>
        (hoveredLinkRef.current === link || selectedLinkRef.current === link) ? 4 : 2
      )
      .linkDirectionalParticleWidth(2.5)
      .linkDirectionalParticleColor((link: any) => {
        const src = typeof link.source === 'object' ? link.source : null
        return src ? nodeColor(src) : '#ffffff'
      })

      // ── Step 5: Link hover pill label ─────────────────────────────────────
      .linkCanvasObjectMode(() => 'after')
      .linkCanvasObject((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const isHov = hoveredLinkRef.current === link
        const isSel = selectedLinkRef.current !== null &&
          resolveId(link.source) === resolveId(selectedLinkRef.current.source) &&
          resolveId(link.target) === resolveId(selectedLinkRef.current.target)
        if (!isHov && !isSel) return

        const src = link.source, tgt = link.target
        if (typeof src !== 'object' || typeof tgt !== 'object') return
        if (!isFinite(src.x) || !isFinite(tgt.x)) return

        const mx = (src.x + tgt.x) / 2
        const my = (src.y + tgt.y) / 2
        const label = link.type || 'REL'
        const fs = Math.max(7, 9 / globalScale)
        ctx.font = `bold ${fs}px "Inter", monospace`
        const tw  = ctx.measureText(label).width
        const pad = 4 / globalScale
        const bw  = tw + pad * 2, bh = fs + pad * 2

        ctx.save()
        ctx.fillStyle   = 'rgba(4,9,38,0.95)'
        ctx.strokeStyle = isSel ? 'rgba(74,158,255,0.95)' : 'rgba(255,255,255,0.35)'
        ctx.lineWidth   = 0.8 / globalScale
        ctx.beginPath()
        if ((ctx as any).roundRect) {
          ;(ctx as any).roundRect(mx - bw/2, my - bh/2, bw, bh, bh/2)
        } else {
          ctx.rect(mx - bw/2, my - bh/2, bw, bh)
        }
        ctx.fill(); ctx.stroke()
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(label, mx, my)
        ctx.restore()
      })

      // ── Step 4: Cluster background glows ─────────────────────────────────
      .onRenderFramePre((ctx: CanvasRenderingContext2D, _globalScale: number) => {
        if (currentViewRef.current !== 'full') return
        const data = graphRef.current?.graphData()
        if (!data?.nodes) return

        const projectNodes = data.nodes.filter((n: any) =>
          (n.node_type || '').toLowerCase() === 'project' &&
          typeof n.x === 'number' && isFinite(n.x)
        )

        projectNodes.forEach((p: any) => {
          const members = data.nodes.filter((n: any) =>
            nodeToProjectRef.current.get(n.id) === p.id &&
            typeof n.x === 'number' && isFinite(n.x)
          )
          if (members.length < 2) return

          const xs = members.map((n: any) => n.x)
          const ys = members.map((n: any) => n.y)
          const cx = (Math.min(...xs) + Math.max(...xs)) / 2
          const cy = (Math.min(...ys) + Math.max(...ys)) / 2
          const rx = (Math.max(...xs) - Math.min(...xs)) / 2 + 52
          const ry = (Math.max(...ys) - Math.min(...ys)) / 2 + 52
          const col = nodeColor(p)

          const t = themeRef.current
          const a1 = t === 'light' ? '14' : t === 'dark2' ? '16' : '1e'
          const a2 = t === 'light' ? '09' : t === 'dark2' ? '0a' : '0c'
          const ab = t === 'light' ? '1a' : t === 'dark2' ? '20' : '25'

          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry))
          g.addColorStop(0,    col + a1)
          g.addColorStop(0.55, col + a2)
          g.addColorStop(1,    col + '00')

          ctx.save()
          ctx.beginPath()
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
          ctx.fillStyle   = g
          ctx.strokeStyle = col + ab
          ctx.lineWidth   = 1
          ctx.fill(); ctx.stroke()
          ctx.restore()
        })
      })

      // ── Events ────────────────────────────────────────────────────────────
      .onLinkHover((link: any) => {
        hoveredLinkRef.current = link
        if (containerRef.current) {
          containerRef.current.style.cursor = link ? 'pointer' : 'default'
        }
        onLinkHover(link as OntologyLink | null)
      })
      .onLinkClick((link: any) => {
        onLinkClick(link as OntologyLink)
      })
      // ── Drag support ──────────────────────────────────────────────────────
      // Define hit areas to match each node's visual shape so drag detection
      // works correctly even for custom-drawn nodes (pill hubs, hexagons, etc.)
      .nodePointerAreaPaint((node: any, color: string, ctx: CanvasRenderingContext2D) => {
        const isHub = (node.node_type || node.type || '') === 'group_hub'
        ctx.fillStyle = color
        if (isHub) {
          const size = nodeBaseSize(node)
          const pw = Math.max(size * 2.6, 60)
          const ph = size * 1.5
          ctx.beginPath()
          if ((ctx as any).roundRect) {
            ;(ctx as any).roundRect(node.x - pw / 2, node.y - ph / 2, pw, ph, ph / 2)
          } else {
            ctx.rect(node.x - pw / 2, node.y - ph / 2, pw, ph)
          }
          ctx.fill()
        } else {
          ctx.beginPath()
          ctx.arc(node.x, node.y, nodeBaseSize(node) + 4, 0, Math.PI * 2)
          ctx.fill()
        }
      })
      .cooldownTicks(200)
      .onNodeDrag(() => {
        // Force a repaint every drag frame so the node follows the cursor
        // (needed when autoPauseRedraw is active between simulation ticks)
        graphRef.current?.autoPauseRedraw(false)
      })
      .onNodeDragEnd((node: any) => {
        // Pin the node at its dropped position so forces don't pull it back
        node.fx = node.x
        node.fy = node.y
        graphRef.current?.autoPauseRedraw(true)
      })
      .onBackgroundClick(() => onNodeClick(null))

    graphRef.current = Graph

    const handleResize = () => {
      if (!graphRef.current || !containerRef.current) return
      const nw = containerRef.current.clientWidth
      const nh = containerRef.current.clientHeight
      graphRef.current.width(nw).height(nh)
      starsRef.current = generateStars(nw, nh, 400)
      paintStars(nw, nh)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (starCanvas.parentNode) starCanvas.parentNode.removeChild(starCanvas)
      graphRef.current?._destructor()
    }
  }, [])

  // ── Theme-change effect: update canvas background + repaint stars ─────────
  useEffect(() => {
    if (!graphRef.current) return
    const bg =
      theme === 'dark2' ? 'rgba(10,10,10,0.97)' :
      theme === 'light' ? 'rgba(237,244,252,1.0)' :
                          'rgba(6,12,26,0.97)'
    graphRef.current.backgroundColor(bg)
    if (containerRef.current) {
      const W = containerRef.current.clientWidth
      const H = containerRef.current.clientHeight
      paintStars(W, H, theme)
    }
  }, [theme])

  // ── Node renderer + event handlers ────────────────────────────────────────
  useEffect(() => {
    if (!graphRef.current) return

    graphRef.current.nodeCanvasObject((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      if (!node || !isFinite(node.x) || !isFinite(node.y) || !(globalScale > 0)) return

      const isSelected     = selectedNode?.id === node.id
      const isHovered      = hoveredNode?.id  === node.id
      // Match by elementId, externalId, or label to handle different targetId formats
      const isHighlighted  = !!(highlightedNodeIds?.size && (
        highlightedNodeIds.has(node.id) ||
        highlightedNodeIds.has(node.externalId) ||
        highlightedNodeIds.has(node.label)
      ))
      const isGroup    = node.type === 'group'
      const isTypeNode = node.type === 'type_node'
      const isPerspective = node.type === 'perspective'
      const isGroupHub = (node.node_type || node.type || '') === 'group_hub'
      const inHierarchy = currentView === 'hierarchy'

      // ── Group hub: pill/diamond shape — Service → [Group Hub] → leaf nodes ─
      if (isGroupHub) {
        const hubColor = node.color || '#334155'
        const hubGlow  = node.glow  || hubColor
        const hubSize  = nodeBaseSize(node)
        const isLight  = themeRef.current === 'light'

        // Outer glow halo
        const haloR = isSelected ? hubSize * 3.2 : isHovered ? hubSize * 2.6 : hubSize * 2.0
        const hg = ctx.createRadialGradient(node.x, node.y, hubSize * 0.4, node.x, node.y, haloR)
        hg.addColorStop(0, hubGlow + (isSelected ? '99' : isHovered ? '66' : '44'))
        hg.addColorStop(1, hubGlow + '00')
        ctx.beginPath(); ctx.arc(node.x, node.y, haloR, 0, Math.PI * 2)
        ctx.fillStyle = hg; ctx.fill()

        // Pill body (rounded rect)
        const label  = node.label || ''
        const fs     = Math.max(8, 9 / globalScale)
        ctx.font     = `bold ${fs}px "Inter", sans-serif`
        const tw     = ctx.measureText(label).width
        const pw     = Math.max(hubSize * 2.2, tw + 14 / globalScale)
        const ph     = hubSize * 1.3
        const px     = node.x - pw / 2
        const py     = node.y - ph / 2
        const radius = ph / 2

        ctx.save()
        ctx.shadowColor = hubGlow
        ctx.shadowBlur  = isSelected ? 24 : isHovered ? 16 : 10
        ctx.beginPath()
        if ((ctx as any).roundRect) {
          ;(ctx as any).roundRect(px, py, pw, ph, radius)
        } else {
          ctx.arc(node.x - pw / 2 + radius, node.y, radius, Math.PI / 2, -Math.PI / 2, true)
          ctx.arc(node.x + pw / 2 - radius, node.y, radius, -Math.PI / 2, Math.PI / 2, true)
          ctx.closePath()
        }
        // Gradient fill
        if (!isFinite(px) || !isFinite(py) || !isFinite(ph)) return
        const bg = ctx.createLinearGradient(px, py, px, py + ph)
        bg.addColorStop(0, hubColor + 'cc')
        bg.addColorStop(1, hubColor + 'ee')
        ctx.fillStyle   = bg
        ctx.strokeStyle = isSelected ? '#fff' : hubColor
        ctx.lineWidth   = isSelected ? 2 : 1.2
        ctx.fill()
        ctx.stroke()
        ctx.restore()

        // Count badge
        if ((node as any).count > 0) {
          const bx = node.x + pw / 2 - 1 / globalScale
          const by = node.y - ph / 2 + 1 / globalScale
          const br = Math.max(5, ph * 0.35)
          ctx.save()
          ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2)
          ctx.fillStyle = '#fff'
          ctx.shadowColor = hubGlow; ctx.shadowBlur = 6
          ctx.fill()
          const cfs = Math.max(5.5, br * 1.1)
          ctx.font = `bold ${cfs}px "Inter", sans-serif`
          ctx.fillStyle = hubColor; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText(String((node as any).count), bx, by)
          ctx.restore()
        }

        // Label inside pill
        ctx.font = `bold ${fs}px "Inter", sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillStyle = isLight ? '#fff' : '#ffffff'
        ctx.fillText(label, node.x, node.y)
        return
      }

      // ── Step 2: type-aware sizing ─────────────────────────────────────────
      const size  = nodeBaseSize(node)
      const color = nodeColor(node)
      const glow  = nodeGlow(node)

      const nodeType = (node.node_type || node.type || '').toLowerCase()
      const isOrg   = nodeType === 'organization'
      const isProj  = nodeType === 'project'

      // ── Maintainer highlight ring (amber pulse) ──────────────────────────
      if (isHighlighted) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(node.x, node.y, size + 7, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)'
        ctx.lineWidth = 3
        ctx.shadowColor = '#f59e0b'
        ctx.shadowBlur = 16
        ctx.stroke()
        ctx.restore()
      }

      // ── Outer nebula halo ─────────────────────────────────────────────────
      const haloRadius = isSelected ? size * 4.5 : isHovered ? size * 3.8 : size * 2.8
      const grad = ctx.createRadialGradient(node.x, node.y, size * 0.4, node.x, node.y, haloRadius)
      grad.addColorStop(0,   glow + (isSelected ? 'bb' : isHovered ? '99' : '55'))
      grad.addColorStop(0.5, glow + (isSelected ? '55' : '22'))
      grad.addColorStop(1,   glow + '00')
      ctx.beginPath()
      ctx.arc(node.x, node.y, haloRadius, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()

      // ── Node body with shadow glow ────────────────────────────────────────
      ctx.save()
      ctx.shadowColor = glow
      ctx.shadowBlur  = isSelected ? 32 : isHovered ? 24 : isOrg ? 26 : isProj ? 20 : isGroup ? 18 : 12
      ctx.beginPath()
      ctx.arc(node.x, node.y, size, 0, Math.PI * 2)
      const bodyGrad = ctx.createRadialGradient(
        node.x - size * 0.3, node.y - size * 0.3, 0,
        node.x, node.y, size
      )
      bodyGrad.addColorStop(0,   '#ffffff')
      bodyGrad.addColorStop(0.3, color + 'ff')
      bodyGrad.addColorStop(1,   glow  + 'cc')
      ctx.fillStyle = bodyGrad
      ctx.fill()
      ctx.restore()

      // ── Expansion ring ────────────────────────────────────────────────────
      const hasChildren = allNodes.some(n => n.par === node.id)
      if (hasChildren && currentView === 'full') {
        const expanded = expandedNodes.has(node.id)
        ctx.beginPath()
        ctx.arc(node.x, node.y, size * 1.35, 0, Math.PI * 2)
        ctx.strokeStyle = expanded ? color : color + '77'
        ctx.lineWidth   = expanded ? 2 : 1.2
        ctx.setLineDash(expanded ? [] : [3, 3])
        ctx.stroke()
        ctx.setLineDash([])
      }

      // ── Selection / hover ring ────────────────────────────────────────────
      if (isSelected) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, size * 1.7, 0, Math.PI * 2)
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth   = 2 / globalScale
        ctx.stroke()
      } else if (isHovered) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, size * 1.5, 0, Math.PI * 2)
        ctx.strokeStyle = color + 'cc'
        ctx.lineWidth   = 1.5 / globalScale
        ctx.stroke()
      }

      // ── Step 3: Labels — always for Org/Project, gated for others ─────────
      const showInside = inHierarchy && hierarchyLevel <= 2 && (isGroup || isTypeNode || isPerspective || hierarchyLevel === 2)
      const alwaysShow = isOrg || isProj || isGroupHub
      const showLabel  = alwaysShow || showInside || globalScale > 0.6 || isSelected || isHovered
      if (!showLabel) return

      const baseFontSize = isOrg ? 13 : isProj ? 11 : isGroup ? 13 : isTypeNode ? 11 : isPerspective ? 12 : Math.max(8, size * 0.6)
      const fontBold = isOrg || isProj || isGroup || isTypeNode || isPerspective ? 'bold ' : ''
      const isLight  = themeRef.current === 'light'

      ctx.font = `${fontBold}${baseFontSize}px "Inter", "Segoe UI", sans-serif`
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'

      if (showInside) {
        const label  = node.label || ''
        const words  = wrapText(label, size, baseFontSize)
        const lineH  = baseFontSize * 1.25
        // For perspective nodes: shift label up slightly to make room for subtitle
        const subtitleOffset = isPerspective ? lineH * 0.7 : 0
        const startY = node.y - ((words.length - 1) * lineH) / 2 - subtitleOffset
        words.forEach((w, i) => {
          const ly = startY + i * lineH
          ctx.strokeStyle = isLight ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)'
          ctx.lineWidth   = baseFontSize * 0.35
          ctx.strokeText(w, node.x, ly)
          ctx.fillStyle = isLight ? '#0f172a' : '#ffffff'
          ctx.fillText(w, node.x, ly)
        })
        // For perspective nodes: show count subtitle below label
        if (isPerspective && (node as any).count !== undefined) {
          const subY = startY + words.length * lineH + subtitleOffset * 0.4
          ctx.font = `9px "Inter", sans-serif`
          ctx.fillStyle = color + 'bb'
          ctx.strokeStyle = 'rgba(0,0,0,0.7)'
          ctx.lineWidth = 2.5
          const subtitle = `${(node as any).count} items`
          ctx.strokeText(subtitle, node.x, subY)
          ctx.fillText(subtitle, node.x, subY)
        }
      } else {
        const label  = node.label || ''
        const labelY = node.y + size + baseFontSize + 3
        ctx.strokeStyle = isLight ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.95)'
        ctx.lineWidth   = baseFontSize * 0.3
        ctx.strokeText(label, node.x, labelY)
        const baseColor = isLight ? '#0f172a' : '#ffffff'
        ctx.fillStyle = (alwaysShow || isSelected || isHovered)
          ? baseColor
          : isLight ? color + '99' : color + 'dd'
        ctx.fillText(label, node.x, labelY)
      }
    })

    graphRef.current
      .onNodeClick((node: any) => {
        if (currentView === 'hierarchy') {
          handleHierarchyClick(node)
        } else {
          if (allNodes.some(n => n.par === node.id)) onExpandToggle(node.id)
          onNodeClick(node as OntologyNode)
        }
      })
      .onNodeHover((node: any) => {
        onNodeHover(node as OntologyNode | null)
        if (containerRef.current) {
          const hoverable = node && (allNodes.some(n => n.par === node.id) || currentView === 'hierarchy')
          containerRef.current.style.cursor = hoverable ? 'pointer' : 'default'
        }
      })

    // Trigger one repaint frame (simulation may have cooled and stopped auto-rendering)
    graphRef.current.autoPauseRedraw(false)
    setTimeout(() => graphRef.current?.autoPauseRedraw(true), 50)
  }, [currentView, hierarchyLevel, allNodes, expandedNodes, selectedNode, hoveredNode, theme, highlightedNodeIds])

  // ── Highlight: refresh canvas + zoom to highlighted nodes ─────────────────
  useEffect(() => {
    if (!graphRef.current) return
    if (!highlightedNodeIds?.size) return
    // Give force-graph time to settle node positions before zooming
    const t = setTimeout(() => {
      if (!graphRef.current) return
      const gd = graphRef.current.graphData()
      // Match by elementId, externalId, or label so any targetId format works
      const highlighted = (gd.nodes as any[]).filter(n =>
        highlightedNodeIds.has(n.id) ||
        highlightedNodeIds.has(n.externalId) ||
        highlightedNodeIds.has(n.label)
      )
      if (highlighted.length === 0) return
      const cx = highlighted.reduce((s: number, n: any) => s + (n.x || 0), 0) / highlighted.length
      const cy = highlighted.reduce((s: number, n: any) => s + (n.y || 0), 0) / highlighted.length
      graphRef.current.centerAt(cx, cy, 600)
      graphRef.current.zoom(Math.min(4, Math.max(2, 8 / highlighted.length)), 600)
    }, 600)
    return () => clearTimeout(t)
  }, [highlightedNodeIds])

  // ── Graph data + forces ───────────────────────────────────────────────────
  useEffect(() => {
    if (allNodes.length === 0 || !graphRef.current) return

    let data: { nodes: OntologyNode[]; links: OntologyLink[] }
    if (currentView === 'hierarchy') {
      if      (hierarchyLevel === 0) data = showGroupLevel()
      else if (hierarchyLevel === 1) data = showTypeLevel()
      else if (hierarchyLevel === 2) data = showNodeLevel()
      else                            data = showChildNodes()
    } else {
      data = showFullView()
    }

    graphRef.current.graphData(data)

    if (currentView === 'hierarchy') {
      // Remove cluster forces when switching to hierarchy
      graphRef.current.d3Force('clusterX', null)
      graphRef.current.d3Force('clusterY', null)
      graphRef.current.d3Force('center', d3.forceCenter())
      if (hierarchyLevel <= 1) {
        // Level 0 (perspectives) and Level 1 (root nodes): arrange in a ring
        const r = hierarchyLevel === 0 ? 280 : 240
        graphRef.current.d3Force('link').distance(80)
        graphRef.current.d3Force('charge').strength(-300)
        graphRef.current.d3Force('radial', d3.forceRadial(r, 0, 0).strength(0.72))
      } else {
        // Level 2+: parent is pinned at center, children radiate outward
        const childCount = data.nodes.length - 1
        const r = Math.max(160, Math.min(260, childCount * 28))
        graphRef.current.d3Force('link').distance(r * 0.7)
        graphRef.current.d3Force('charge').strength(-240)
        graphRef.current.d3Force('radial', d3.forceRadial(r, 0, 0).strength(0.6))
      }
      graphRef.current.d3Force('collision', d3.forceCollide().radius((d: any) => nodeBaseSize(d) * 3.2).strength(1).iterations(3))
    } else {
      // ── Step 1: Full view — cluster-aware forces, no orbit ring ───────────
      const visibleNodes = data.nodes
      const visibleLinks = data.links

      // Build node → project mapping (2-pass BFS)
      const projectIds = new Set(
        visibleNodes.filter(n => (n.node_type || '').toLowerCase() === 'project').map(n => n.id)
      )
      const nodeToProject = new Map<string, string>()
      projectIds.forEach(id => nodeToProject.set(id, id))

      const passLinks = (links: OntologyLink[]) => {
        links.forEach(l => {
          const s = resolveId(l.source), t = resolveId(l.target)
          if (projectIds.has(s) && !nodeToProject.has(t)) nodeToProject.set(t, s)
          if (projectIds.has(t) && !nodeToProject.has(s)) nodeToProject.set(s, t)
        })
      }
      passLinks(visibleLinks)
      passLinks(visibleLinks)
      nodeToProjectRef.current = nodeToProject

      // Assign cluster centers in graph-space
      const CLUSTER_R = 380
      const projectNodesList = visibleNodes.filter(n => projectIds.has(n.id))
      const clusterCenters: Record<string, { x: number; y: number }> = {}
      projectNodesList.forEach((p, i) => {
        const angle = (2 * Math.PI * i) / Math.max(projectNodesList.length, 1) - Math.PI / 2
        clusterCenters[p.id] = {
          x: Math.cos(angle) * CLUSTER_R,
          y: Math.sin(angle) * CLUSTER_R,
        }
      })
      clusterCentersRef.current = clusterCenters

      // Apply forces
      graphRef.current.d3Force('radial', null)   // ← removes blue orbit ring
      graphRef.current.d3Force('link').distance(70)
      graphRef.current.d3Force('charge').strength(-600)
      const cf = graphRef.current.d3Force('center') as any
      if (cf?.strength) cf.strength(0.03)

      graphRef.current.d3Force('clusterX', d3.forceX((n: any) => {
        const c = clusterCenters[nodeToProject.get(n.id) ?? '']
        return c?.x ?? 0
      }).strength((n: any) => {
        const t = (n.node_type || '').toLowerCase()
        return t === 'organization' ? 0.03 : t === 'project' ? 0.40 : 0.48
      }))

      graphRef.current.d3Force('clusterY', d3.forceY((n: any) => {
        const c = clusterCenters[nodeToProject.get(n.id) ?? '']
        return c?.y ?? 0
      }).strength((n: any) => {
        const t = (n.node_type || '').toLowerCase()
        return t === 'organization' ? 0.03 : t === 'project' ? 0.40 : 0.48
      }))

      graphRef.current.d3Force(
        'collision',
        d3.forceCollide().radius((d: any) => nodeBaseSize(d) * 2.8).strength(1).iterations(3)
      )
    }

    graphRef.current.d3ReheatSimulation()
    setTimeout(() => graphRef.current?.zoomToFit(400, currentView === 'hierarchy' ? 120 : 60), 900)
  }, [allNodes, allLinks, currentView, hierarchyLevel, hierarchyPath, activeFilters, searchTerm, expandedNodes])

  // ── Text helpers ──────────────────────────────────────────────────────────
  const wrapText = (text: string, nodeSize: number, fontSize: number): string[] => {
    const maxChars = Math.floor((nodeSize * 1.8) / (fontSize * 0.58))
    const words = text.split(' ')
    const lines: string[] = []
    let line = ''
    words.forEach(w => {
      if ((line + w).length <= maxChars) { line += (line ? ' ' : '') + w }
      else { if (line) lines.push(line); line = w }
    })
    if (line) lines.push(line)
    return lines
  }

  // ── Hierarchy helpers ─────────────────────────────────────────────────────
  const handleHierarchyClick = (node: any) => {
    if (hierarchyLevel === 0 && node.type === 'perspective') {
      // Clicked a perspective card: encode "perspId::perspLabel" so breadcrumb can display label
      const persp = PERSPECTIVES.find(p => p.id === node.perspectiveId)
      const entry = persp ? `${persp.id}::${persp.label}` : node.perspectiveId
      onHierarchyChange(1, [entry])
    } else if (hierarchyLevel === 1) {
      // Clicked a root-type node (e.g. a Project): encode "nodeId::nodeLabel"
      const nodeRef = `${node.id}::${node.label}`
      onHierarchyChange(2, [...hierarchyPath, nodeRef])
    } else if (hierarchyLevel >= 2) {
      // Avoid re-drilling into the current parent
      const currentParentId = hierarchyPath[hierarchyPath.length - 1]?.split('::')[0]
      if (node.id === currentParentId) {
        onNodeClick(node as OntologyNode)
        return
      }
      const nodeRef = `${node.id}::${node.label}`
      onHierarchyChange(hierarchyLevel + 1, [...hierarchyPath, nodeRef])
    }
  }

  // Returns all directly connected nodes for the given node, filtered by the perspective
  const drillIntoNode = (nodeRef: string, perspEntry: string): { nodes: OntologyNode[]; links: OntologyLink[] } => {
    const nodeId = nodeRef?.includes('::') ? nodeRef.split('::')[0] : nodeRef
    const parent = allNodes.find(n => n.id === nodeId)
    if (!parent) return { nodes: [], links: [] }

    const perspId = perspEntry?.includes('::') ? perspEntry.split('::')[0] : perspEntry
    const persp = PERSPECTIVES.find(p => p.id === perspId)
    const excludeTypes = persp?.excludeTypes ?? []

    const connectedIds = new Set<string>()
    const relevantLinks: OntologyLink[] = []

    allLinks.forEach(l => {
      const s = resolveId(l.source), t = resolveId(l.target)
      if (s === nodeId) { connectedIds.add(t); relevantLinks.push(l) }
      else if (t === nodeId) { connectedIds.add(s); relevantLinks.push(l) }
    })

    const children = allNodes.filter(n =>
      connectedIds.has(n.id) &&
      !excludeTypes.includes((n.node_type || '').toLowerCase())
    )

    // Pin the parent at center so children radiate outward
    const parentPinned = { ...parent, fx: 0, fy: 0 } as OntologyNode
    const allVisible = [parentPinned, ...children]
    const nodeIds = new Set(allVisible.map(n => n.id))
    const links = relevantLinks.filter(l => {
      const s = resolveId(l.source), t = resolveId(l.target)
      return nodeIds.has(s) && nodeIds.has(t)
    })
    return { nodes: allVisible, links }
  }

  // Level 0: Perspective selector cards
  const showGroupLevel = (): { nodes: OntologyNode[]; links: OntologyLink[] } => {
    const nodes = PERSPECTIVES.map(p => {
      const count = allNodes.filter(n => (n.node_type || '').toLowerCase() === p.rootType).length
      return {
        id: `perspective_${p.id}`,
        label: p.label,
        group: 'perspective',
        tier: 0,
        color: p.color,
        size: 46,
        description: p.description,
        count,
        par: null,
        node_type: 'perspective',
        type: 'perspective',
        perspectiveId: p.id,
      } as any
    })
    // No links — radial force arranges them in a circle
    return { nodes, links: [] }
  }

  // Level 1: All root-type nodes for the selected perspective
  const showTypeLevel = (): { nodes: OntologyNode[]; links: OntologyLink[] } => {
    const perspEntry = hierarchyPath[0]  // 'perspId::perspLabel'
    const perspId = perspEntry?.split('::')[0]
    const persp = PERSPECTIVES.find(p => p.id === perspId)
    if (!persp) return { nodes: [], links: [] }
    const nodes = allNodes.filter(n => (n.node_type || '').toLowerCase() === persp.rootType)
    // No links at root level — nodes are independent instances
    return { nodes, links: [] }
  }

  // Level 2: Drill into the selected root node
  const showNodeLevel = (): { nodes: OntologyNode[]; links: OntologyLink[] } => {
    return drillIntoNode(hierarchyPath[1], hierarchyPath[0])
  }

  // Level 3+: Drill into the selected child node
  const showChildNodes = (): { nodes: OntologyNode[]; links: OntologyLink[] } => {
    return drillIntoNode(hierarchyPath[hierarchyPath.length - 1], hierarchyPath[0])
  }

  const showFullView = (): { nodes: OntologyNode[]; links: OntologyLink[] } => {
    let nodes = [...allNodes]

    if (activeFilters.size > 0) {
      nodes = nodes.filter(n => {
        const key = (n.node_type || '').toLowerCase()
        return activeFilters.has(key) || activeFilters.has(n.node_type)
      })
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      nodes = nodes.filter(n =>
        (n.label || '').toLowerCase().includes(term) ||
        (n.description || '').toLowerCase().includes(term)
      )
    }

    const expandedChildren: OntologyNode[] = []
    const seen = new Set<string>()
    expandedNodes.forEach(parentId => {
      const parent = nodes.find(n => n.id === parentId)
      if (!parent) return
      const children = allNodes.filter(n => n.par === parentId)
      const baseRadius = Math.max(80, nodeBaseSize(parent) * 8)
      const step = (2 * Math.PI) / Math.max(children.length, 1)
      children.forEach((child, i) => {
        if (seen.has(child.id)) return
        const angle = -Math.PI / 2 + i * step
        const r = baseRadius + Math.floor(i / 8) * 20
        expandedChildren.push({
          ...child,
          x: (parent.x || 0) + Math.cos(angle) * r,
          y: (parent.y || 0) + Math.sin(angle) * r,
          fx: (parent.x || 0) + Math.cos(angle) * r,
          fy: (parent.y || 0) + Math.sin(angle) * r,
          size: nodeBaseSize(child) * 0.85,
        })
        seen.add(child.id)
      })
    })

    const allVisible = [...nodes, ...expandedChildren]
    const nodeIds = new Set(allVisible.map(n => n.id))

    // Base links from the real graph (only between visible nodes)
    const baseLinks = allLinks.filter(l => {
      const s = resolveId(l.source), t = resolveId(l.target)
      return nodeIds.has(s) && nodeIds.has(t)
    })

    // ── Inject per-service group hub nodes ────────────────────────────────────
    // Structure: Project -CONTAINS-> Service -GROUPS-> [API Endpoints] -INCLUDES-> API node
    // Only when no active type filter (filter mode shows raw nodes directly)
    const links = [...baseLinks]

    if (activeFilters.size === 0) {
      const serviceNodes = allVisible.filter(n => (n.node_type || '').toLowerCase() === 'service')

      serviceNodes.forEach(svc => {
        // Find all direct children of this service via existing links
        const childIds = new Set<string>()
        baseLinks.forEach(l => {
          const s = resolveId(l.source), t = resolveId(l.target)
          if (s === svc.id && t !== svc.id) childIds.add(t)
          if (t === svc.id && s !== svc.id) childIds.add(s)
        })

        const children = allVisible.filter(n => childIds.has(n.id))

        SERVICE_CHILD_GROUPS.forEach(cat => {
          const members = children.filter(n =>
            cat.types.includes((n.node_type || '').toLowerCase())
          )
          if (members.length === 0) return

          const hubId = `grp:${svc.id}:${cat.id}`
          const hubNode: any = {
            id: hubId,
            label: cat.label,
            node_type: 'group_hub',
            type: 'group_hub',
            color: cat.color,
            glow: cat.glow,
            count: members.length,
            serviceId: svc.id,
            categoryId: cat.id,
            par: null,
          }
          allVisible.push(hubNode)
          nodeIds.add(hubId)

          // Service → hub
          links.push({ source: svc.id, target: hubId, type: 'GROUPS' } as any)

          // Hub → each member (replace direct service links to these members)
          members.forEach(m => {
            links.push({ source: hubId, target: m.id, type: 'INCLUDES' } as any)
          })

          // Remove the original direct links between service and these members
          for (let i = links.length - 1; i >= 0; i--) {
            const l = links[i] as any
            const s = resolveId(l.source), t = resolveId(l.target)
            if ((s === svc.id && members.some(m => m.id === t)) ||
                (t === svc.id && members.some(m => m.id === s))) {
              // keep only if it's not a GROUPS link we just added
              if (l.type !== 'GROUPS') links.splice(i, 1)
            }
          }
        })
      })
    }

    return { nodes: allVisible, links }
  }

  return (
    <div
      ref={containerRef}
      className="absolute z-0"
      style={{ top: '52px', left: 0, right: 0, bottom: 0, width: '100%', height: 'auto', overflow: 'hidden' }}
    />
  )
})

OntologyGraph.displayName = 'OntologyGraph'
export default OntologyGraph
