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
}

export interface OntologyLink {
  source: string | OntologyNode
  target: string | OntologyNode
  type: string
  color: string
  count?: number
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
