// Node and Link types for the infrastructure ontology graph

export interface OntologyNode {
  id: string
  label: string
  group: string
  tier: number
  color: string
  size: number
  description: string
  count: number | null
  par: string | null
  node_type: string
  type?: string  // For hierarchy nodes (group, type_node)
  status?: string
  risk?: string
  severity?: string
  priority?: string
  val?: number  // For force-graph sizing
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number
  fy?: number
  actualType?: string  // For type nodes
  nodeTypes?: string[]  // For group nodes
  nodeIds?: string[]  // For type nodes

  // ── Provenance, carried on the node itself ───────────────────────────────
  // Present on every graph payload (`_node_row` spreads all properties), so the
  // canvas overlay can colour by source or freshness without a second fetch.
  source?: string
  pipeline?: string
  trigger?: string
  actor?: string
  sourceDetail?: string
  attribution?: string
  lastSeenAt?: string
  lastSeenRunId?: string
  firstSeenAt?: string
  firstSeenRunId?: string
  confidence?: number
}

export interface OntologyLink {
  /** Engine element id. Returned by the API's `_link_row`; the type simply never
   *  declared it, which is why an edge could not be looked up for its trace. */
  id?: string
  source: string | OntologyNode
  target: string | OntologyNode
  type: string
  color: string
  count?: number

  // ── Provenance, carried on the edge itself ───────────────────────────────
  // `prov_source` is the renamed provenance source: force-graph mutates a link's
  // own `source` field into a node object in place, so the backend moves it aside.
  prov_source?: string
  provSource?: string
  pipeline?: string
  trigger?: string
  actor?: string
  sourceDetail?: string
  attribution?: string
  lastSeenAt?: string
  lastSeenRunId?: string
  firstSeenAt?: string
  confidence?: number
  factType?: string
}

export interface GraphData {
  nodes: OntologyNode[]
  links: OntologyLink[]
}

export interface GraphMetadata {
  totalNodes: number
  totalLinks: number
  version: string
  generated: string
}

export interface OntologyDataFile {
  meta: GraphMetadata
  statistics: Record<string, any>
  nodes: OntologyNode[]
  links: OntologyLink[]
}

export type ViewMode = 'full' | 'hierarchy'

export interface NodeTypeConfig {
  color: string
  label: string
  icon: string
  group: string
}

export interface EdgeTypeConfig {
  color: string
  label: string
}
