/**
 * Lens type contracts.
 *
 * A lens is a named projection of the ontology: a subset of node labels, a set
 * of typed edges, and the chrome that presents them. Interfaces only — this
 * module has no runtime imports beyond types, so the topbar, legend, KPI bar and
 * detail panel can all read it without pulling a renderer's bundle in with them.
 *
 * Backend counterpart: aura-api/src/ontology/lenses.py (GET /api/ontology/lenses).
 */
import type { LucideIcon } from 'lucide-react'
import type { OntologyNode, OntologyLink } from '../../../api/ontologyUniverse'

/**
 * Exact PascalCase Neo4j label, per aura-api/src/ontology/schema.py.
 * neo4j_client sets node_type = labels[0], so registry keys MUST match that
 * casing — the codebase has three competing conventions and this is the one
 * the wire actually uses.
 */
export type NodeLabel = string
export type RelType = string

export type LensId = 'ontology' | 'git' | 'infra' | (string & {})

export type LayoutId =
  | 'force' | 'hierarchy'                                        // canvas (OntologyGraph)
  | 'dag' | 'lanes' | 'grouped-lanes'                            // generic, config-driven
  | 'smartscape' | 'workspace' | 'domain-layer' | 'structural'   // existing specialist views

/**
 * The subset of layouts implemented by the pre-lens specialist views.
 * Derived from LayoutId so it cannot drift from the registry.
 */
export type SpecialistView = Extract<
  LayoutId, 'smartscape' | 'domain-layer' | 'structural' | 'workspace'
>

/** Which topbar button group a layout appears in. */
export type LayoutSlot =
  | 'layout'   // group 1 — how the current lens is drawn (Graph | Hierarchy | DAG …)
  | 'view'     // group 2 — alongside the lens buttons (Smartscape | Workspace)

// ── value formatting ─────────────────────────────────────────────────────────

export type FieldFormat =
  | 'text' | 'number' | 'compact'   // 48210 → "48.2k"
  | 'percent' | 'ratio'             // 0.78 → "78%" ; 96.4 → "96.4%"
  | 'duration'                      // 412 → "6m 52s"
  | 'bytes' | 'mb' | 'gb'
  | 'currency'                      // 340 → "$340/mo"
  | 'date' | 'relative'             // ISO → "5d ago"
  | 'bool' | 'mono' | 'pathTail'

/** Declarative thresholds so cards stay presentational. */
export interface FieldThresholds {
  good?: number
  warn?: number
  bad?: number
  direction?: 'higher-is-better' | 'lower-is-better'
}

export interface CardField {
  key: string
  label: string
  format?: FieldFormat
  emphasis?: 'primary' | 'secondary' | 'badge' | 'bar' | 'pip'
  thresholds?: FieldThresholds
  suffix?: string
  /** Per-value colours, e.g. language → brand colour. Lower precedence than
   *  a threshold result, which signals risk and must win. */
  colorMap?: Record<string, string>
}

// ── node & edge presentation ─────────────────────────────────────────────────

export interface LensNodeType {
  label: string            // plural display name, e.g. 'Repositories'
  color: string
  glow?: string
  Icon?: LucideIcon
  size?: number            // force-graph radius; ignored by dag/lane renderers
  lane?: string
  cardFields?: CardField[]
  cardSize?: { w: number; h: number }
  /** Rendered as a chip on a related card rather than as its own node. */
  contextOnly?: boolean
}

export interface LensEdgeType {
  label?: string
  semantic?: string        // 'Code → Repository'
  color: string
  dashed?: boolean
  animated?: boolean
  /** Stored direction is the inverse of the direction the view draws. */
  reverse?: boolean
  /** Drop from layout, keep for the detail panel's relationship list. */
  excludeFromLayout?: boolean
  weight?: number
  /** Restrict to endpoint labels — disambiguates overloaded relationship types. */
  between?: { from?: NodeLabel[]; to?: NodeLabel[] }[]
  /**
   * Not in schema.RELATIONSHIP_TYPES — tolerated so ownership filters work
   * against data written by the mock MCP ingester, which emits MANAGED_BY and
   * HOSTED_IN where the schema says OWNED_BY and IMPLEMENTS. Excluded from the
   * frontend/backend drift check; fixing the ingester is the real remedy.
   */
  nonCanonical?: boolean
}

// ── lanes, grouping, filters, KPIs ───────────────────────────────────────────

export interface LensLane {
  id: string
  label: string
  order: number
  sublabel?: string
  color?: string
}

export interface LensGrouping {
  id: string               // 'environment' | 'region' | 'provider' | 'cluster'
  label: string
  keyOf: (n: OntologyNode, ctx: LensDataContext) => string | null
  labelOf?: (key: string, ctx: LensDataContext) => string
}

export interface LensFilterOption {
  id: string
  label: string
  color?: string
  predicate?: (n: OntologyNode, ctx: LensDataContext) => boolean
}

export interface LensFilterGroup {
  id: string               // 'nodeType' | 'language' | 'environment' | …
  label: string
  kind: 'nodeType' | 'source' | 'prop' | 'derived' | 'threshold'
  propKey?: string
  /** Omit for kind 'prop' — options are derived from distinct values in the data. */
  options?: LensFilterOption[]
  /** Derive options from the data, for dimensions that must be traversed rather
   *  than read (infra environment is resolved through containment). */
  optionsOf?: (ctx: LensDataContext) => LensFilterOption[]
  defaultCollapsed?: boolean
  range?: { min: number; max: number; step: number; initial: number; compare: 'gte' | 'lte' }
}

export interface LensKpi {
  id: string
  label: string
  format?: FieldFormat
  hint?: string
  accent?: string
  thresholds?: FieldThresholds
  secondary?: boolean
  compute: (ctx: LensDataContext) => number | string | null
}

// ── layout chrome ────────────────────────────────────────────────────────────

/**
 * Replaces the scattered `!specialistView &&` guards in OntologyVisualizerPage
 * with one declarative object per layout.
 */
export interface LayoutChrome {
  filterRail: boolean
  legend: boolean
  zoomControls: boolean
  breadcrumb: boolean
  kpiBar: boolean
  tourGuide: boolean
  /** The view renders its own back affordance (domain-layer, structural). */
  ownsBackButton?: boolean
}

export interface LensLayoutOption {
  id: LayoutId
  label: string
  Icon: LucideIcon
  slot: LayoutSlot
  chrome: LayoutChrome
  hint?: string
  params?: Record<string, unknown>
  /** Above this node count, fall back to `fallbackLayout`. */
  nodeCap?: number
  fallbackLayout?: LayoutId
  /** Reachable only from the detail panel, not from the topbar. */
  detailOnly?: boolean
  /** Interaction hints for the legend footer — dragging pins a node on the
   *  canvas but means nothing in a dagre layout, so these belong to the layout. */
  legendHints?: string[]
}

// ── detail-panel extensions ──────────────────────────────────────────────────

export interface LensDetailSection {
  id: string
  label: string
  /** Restrict to these labels; omit for every label in the lens. */
  forTypes?: NodeLabel[]
  kind:
    /** Flat property rows. */
    | { type: 'fields'; fields: CardField[] }
    /** Walk a fixed relationship sequence, rendered as a stepper —
     *  "how does this code reach production". A broken step is the finding. */
    | { type: 'chain'; steps: { rel: RelType; dir: 'out' | 'in'; toType?: NodeLabel }[] }
    /** Transitive reachable set — blast radius. `seedRels` apply to the first
     *  hop only (containment is dependency for a parent, but not transitively). */
    | { type: 'reachable'; rels?: RelType[]; seedRels?: RelType[]; dir: 'out' | 'in' | 'both'; targetTypes?: NodeLabel[]; maxHops?: number }
    /** Direct neighbours of given types, rendered as chips. */
    | { type: 'related'; rels?: RelType[]; dir: 'out' | 'in' | 'both'; types?: NodeLabel[] }
    /** Pass/fail rows. `pass` returns null for "unknown" — absent evidence must
     *  never render as a pass. */
    | { type: 'compliance'; checks: { label: string; pass: (n: OntologyNode, ctx: LensDataContext) => boolean | null; hint?: string }[] }
  /** Offer the section's nodes to the page's highlight mechanism. */
  focusable?: boolean
}

// ── the lens ─────────────────────────────────────────────────────────────────

export interface LensDefinition {
  id: LensId
  label: string
  sublabel: string
  Icon: LucideIcon
  accent: string
  order: number
  /**
   * Lenses MUST NOT introduce new permission keys — they are persisted per-role
   * in DynamoDB and embedded in issued JWTs. Defaults to 'ontology'.
   */
  permission?: string

  nodeTypes: Record<NodeLabel, LensNodeType>
  edgeTypes: Record<RelType, LensEdgeType>
  /** Ontology lens = true (show every label, fallback-coloured). Git/Infra = false. */
  includeUnmappedNodeTypes?: boolean

  layouts: LensLayoutOption[]     // [0] is the default
  lanes?: LensLane[]
  laneOf?: (n: OntologyNode, ctx: LensDataContext) => string | undefined
  groupings?: LensGrouping[]

  filters?: LensFilterGroup[]
  kpis?: LensKpi[]
  legend?: { nodeTypes?: boolean; edgeTypes?: boolean; presentOnly?: boolean; hints?: string[] }

  detail?: { sections: LensDetailSection[] }

  emptyState?: { title: string; body: string; cta?: { label: string; to: string } }
}

// ── data context, computed once per (graph, lens) ────────────────────────────

export interface LensDataContext {
  lens: LensDefinition
  /** Lens-scoped nodes (all nodes when includeUnmappedNodeTypes). */
  nodes: OntologyNode[]
  links: OntologyLink[]
  /** The full graph — for cross-lens counts and traversal beyond the lens. */
  allNodes: OntologyNode[]
  allLinks: OntologyLink[]
  byId: Map<string, OntologyNode>
  byType: Map<NodeLabel, OntologyNode[]>
  out: Map<string, OntologyLink[]>
  in: Map<string, OntologyLink[]>
  /** The single place label casing is reconciled. */
  typeOf: (n: OntologyNode) => NodeLabel
}

// ── the uniform renderer contract ────────────────────────────────────────────

/** Canvas-only state, passed through to OntologyGraph. Absent for other layouts. */
export interface LensCanvasState {
  hierarchyLevel: number
  hierarchyPath: string[]
  expandedNodes: Set<string>
  onHierarchyChange: (level: number, path: string[]) => void
  onExpandToggle: (nodeId: string) => void
}

export interface LensViewProps {
  lens: LensDefinition
  layout: LensLayoutOption
  grouping: LensGrouping | null
  ctx: LensDataContext
  nodes: OntologyNode[]
  links: OntologyLink[]
  activeFilters: Set<string>
  searchTerm: string
  selectedNode: OntologyNode | null
  selectedLink: OntologyLink | null
  hoveredNode: OntologyNode | null
  highlightedNodeIds: Set<string>
  isPresentationMode: boolean
  canvasState?: LensCanvasState
  onNodeClick: (n: OntologyNode | null) => void
  onNodeHover: (n: OntologyNode | null) => void
  onLinkClick: (l: OntologyLink) => void
  onLinkHover: (l: OntologyLink | null) => void
  onBack?: () => void
}

/**
 * Superset-compatible with the existing OntologyGraphRef, so
 * OntologyZoomControls keeps working for every lens without modification.
 */
export interface LensViewRef {
  zoomIn: () => void
  zoomOut: () => void
  zoomToFit: (ms?: number, pad?: number) => void
}
