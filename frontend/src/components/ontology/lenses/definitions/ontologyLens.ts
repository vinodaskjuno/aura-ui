/**
 * Ontology lens — the default, everything-connected view.
 *
 * Unlike Git and Infra this lens is deliberately unscoped: it shows every label
 * in the graph (`includeUnmappedNodeTypes`), which is what preserves today's
 * behaviour exactly. Its node palette is *derived* from OntologyGraph's own
 * NODE_TYPE_CONFIG rather than re-authored, so the two cannot drift and F1 is
 * guaranteed pixel-identical.
 *
 * Smartscape / Workspace / Domain / Structural are modelled as *layouts* here,
 * not as separate lenses: each renders the whole ontology, so they vary the
 * drawing, not the slice.
 */
import { Network, GitBranch, Cpu, LayoutDashboard, Layers, Boxes, Orbit, Rows3, Workflow } from 'lucide-react'
import { NODE_TYPE_CONFIG, NODE_SIZES } from '../nodePalette'
import type { LayoutChrome, LensDefinition, LensFilterGroup, LensKpi, LensLane, LensNodeType } from '../lensTypes'

/** Full chrome — the canvas layouts (Graph, Hierarchy). */
const CANVAS_CHROME: LayoutChrome = {
  filterRail: true, legend: true, zoomControls: true,
  breadcrumb: true, kpiBar: true, tourGuide: false,
}

const CANVAS_HINTS = [
  '✦ Click node to inspect',
  '✦ Space → fit to screen',
  '✦ Drag node to pin',
]

/** Specialist views own their entire surface; the page chrome stays hidden. */
const SPECIALIST_CHROME: LayoutChrome = {
  filterRail: false, legend: false, zoomControls: false,
  breadcrumb: false, kpiBar: false, tourGuide: false,
}

/** Domain / Structural additionally render their own back button and a tour. */
const DETAIL_CHROME: LayoutChrome = {
  ...SPECIALIST_CHROME, tourGuide: true, ownsBackButton: true,
}

// Derived from the canvas palette so colours cannot drift between the two.
// Keys stay lowercase as authored there; makeTypeResolver matches case-insensitively.
const nodeTypes: Record<string, LensNodeType> = Object.fromEntries(
  Object.entries(NODE_TYPE_CONFIG).map(([key, cfg]) => [
    key,
    { label: cfg.label, color: cfg.color, glow: cfg.glow, size: NODE_SIZES[key], lane: cfg.group },
  ]),
)

/**
 * Filter groups derived from NODE_TYPE_CONFIG's own `group` field, rather than
 * hand-maintained. The previous hardcoded list had drifted badly: nine ids used
 * a legacy lowercase vocabulary (`container`, `application`, `api_service`,
 * `database_host`, `domain`…) that the backend no longer emits, so those rows
 * read 0 permanently, while 23 labels that ARE emitted had no entry at all.
 * Deriving both sides from one source removes the drift by construction.
 */
const typeFilterGroups: LensFilterGroup[] = (() => {
  const byGroup = new Map<string, { id: string; label: string; color: string }[]>()
  for (const [key, cfg] of Object.entries(NODE_TYPE_CONFIG)) {
    if (cfg.group === 'perspective') continue   // synthetic hierarchy nodes
    const bucket = byGroup.get(cfg.group) ?? []
    bucket.push({ id: key, label: cfg.label, color: cfg.color })
    byGroup.set(cfg.group, bucket)
  }
  return [...byGroup.entries()].map(([group, options]) => ({
    id: `type:${group}`,
    label: group,
    kind: 'nodeType' as const,
    options,
    defaultCollapsed: true,
  }))
})()

/** Options are derived from the data — whatever sources are actually present. */
const sourceFilterGroup: LensFilterGroup = {
  id: 'source',
  label: 'Data Sources',
  kind: 'source',
  defaultCollapsed: true,
}

const kpis: LensKpi[] = [
  { id: 'nodes', label: 'Nodes', format: 'number', accent: '#60a5fa',
    compute: ctx => ctx.nodes.length },
  { id: 'links', label: 'Links', format: 'number', accent: '#34d399',
    compute: ctx => ctx.links.length },
]

const OTHER_LANE = 'Other'

/** Lanes are the palette's own groups; anything unmapped lands in Other so a
 *  newly-ingested label is never silently invisible. */
const lanes: LensLane[] = (() => {
  const seen = new Map<string, number>()
  for (const cfg of Object.values(NODE_TYPE_CONFIG)) {
    if (cfg.group === 'perspective') continue
    seen.set(cfg.group, (seen.get(cfg.group) ?? 0) + 1)
  }
  const ordered = [...seen.keys()]
  ordered.push(OTHER_LANE)
  return ordered.map((label, order) => ({ id: label, label, order }))
})()

/** Generic layouts registered here so both renderers are exercised by the
 *  default lens before Git and Infra depend on them. */
const GENERIC_CHROME: LayoutChrome = {
  filterRail: true, legend: true, zoomControls: true,
  breadcrumb: false, kpiBar: true, tourGuide: false,
}

export const ontologyLens: LensDefinition = {
  id: 'ontology',
  label: 'Ontology',
  sublabel: 'Everything, connected',
  Icon: Orbit,
  accent: '#a78bfa',
  order: 0,
  includeUnmappedNodeTypes: true,
  nodeTypes,
  // The canvas colours edges from the source node's type, so there is no
  // per-relationship palette to declare here. Git and Infra define their own.
  edgeTypes: {},
  layouts: [
    { id: 'force',      label: 'Graph',      Icon: Network,   slot: 'layout', chrome: CANVAS_CHROME, legendHints: CANVAS_HINTS },
    { id: 'hierarchy',  label: 'Hierarchy',  Icon: GitBranch, slot: 'layout', chrome: CANVAS_CHROME, legendHints: CANVAS_HINTS },
    { id: 'lanes', label: 'Lanes', Icon: Rows3, slot: 'layout', chrome: GENERIC_CHROME,
      hint: 'Group every label into its palette family' },
    { id: 'dag', label: 'Flow', Icon: Workflow, slot: 'layout', chrome: GENERIC_CHROME,
      nodeCap: 250, fallbackLayout: 'lanes', params: { rankdir: 'LR', ranksep: 110, nodesep: 30 },
      hint: 'Rank-assigned flow — best on a filtered subset' },
    { id: 'smartscape', label: 'Smartscape', Icon: Cpu,             slot: 'view',   chrome: SPECIALIST_CHROME,
      hint: 'Smartscape — AI-powered topology map' },
    { id: 'workspace',  label: 'Workspace',  Icon: LayoutDashboard, slot: 'view',   chrome: SPECIALIST_CHROME,
      hint: 'Workspace — multi-panel specialist view' },
    // Reachable only from a Project node's detail panel.
    { id: 'domain-layer', label: 'Domain View',     Icon: Layers, slot: 'view', chrome: DETAIL_CHROME, detailOnly: true },
    { id: 'structural',   label: 'Structural View', Icon: Boxes,  slot: 'view', chrome: DETAIL_CHROME, detailOnly: true },
  ],
  lanes,
  laneOf: (n, ctx) => {
    const cfg = ontologyLens.nodeTypes[ctx.typeOf(n)]
    return cfg?.lane ?? OTHER_LANE
  },
  filters: [sourceFilterGroup, ...typeFilterGroups],
  kpis,
  legend: { nodeTypes: true, edgeTypes: true, presentOnly: true },
}
