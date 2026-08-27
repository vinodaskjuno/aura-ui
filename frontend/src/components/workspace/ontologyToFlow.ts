import type { Node, Edge } from '@xyflow/react'
import type { OntologyNode, OntologyLink } from '../../api/ontologyUniverse'
import type { GraphTheme } from '../../hooks/useGraphTheme'
import dagre from '@dagrejs/dagre'

export const WORKSPACE_GRAPH_NODE_CAP = 150

export const NODE_TYPE_ICONS: Record<string, string> = {
  Service: '⚙',
  Application: '📦',
  API: '🔌',
  Database: '🗄',
  Repository: '📁',
  Function: 'ƒ',
  Class: '◈',
  CodeFile: '📄',
  Module: '▣',
  Container: '🐳',
  CloudResource: '☁',
  KubernetesCluster: '⛵',
  Team: '👥',
  User: '👤',
  BusinessDomain: '🏛',
  BusinessApplication: '🏢',
  BusinessUnit: '🏗',
  Organization: '🏦',
  SecurityFinding: '🛡',
  Vulnerability: '⚠',
  IAMRole: '🔑',
  AIModel: '🤖',
  AgentDefinition: '🧠',
  RAGKnowledgeBase: '📚',
  VectorDatabase: '🔢',
  Incident: '🚨',
  Dependency: '📌',
  Server: '🖥',
  Network: '🌐',
}

export interface WorkspaceFlowData {
  label: string
  nodeType: string
  source: string
  status?: string
  isHighlighted: boolean
  icon: string
}

export function ontologyNodesToFlowNodes(
  nodes: OntologyNode[],
  highlightIds: Set<string>,
  selectedId: string | null,
): Node[] {
  return nodes.slice(0, WORKSPACE_GRAPH_NODE_CAP).map((n) => ({
    id: n.id,
    type: 'workspaceNode',
    position: { x: 0, y: 0 },
    data: {
      label: n.label || n.id,
      nodeType: n.node_type,
      source: n.source,
      status: (n as Record<string, unknown>).status as string | undefined,
      isHighlighted: highlightIds.has(n.id),
      icon: NODE_TYPE_ICONS[n.node_type] ?? '◈',
    } satisfies WorkspaceFlowData,
    selected: n.id === selectedId,
  }))
}

export function ontologyLinksToFlowEdges(
  links: OntologyLink[],
  nodeIds: Set<string>,
  t: GraphTheme,
): Edge[] {
  return links
    .filter((l) => {
      const src = typeof l.source === 'string' ? l.source : (l.source as OntologyNode).id
      const tgt = typeof l.target === 'string' ? l.target : (l.target as OntologyNode).id
      return nodeIds.has(src) && nodeIds.has(tgt)
    })
    .map((l) => {
      const src = typeof l.source === 'string' ? l.source : (l.source as OntologyNode).id
      const tgt = typeof l.target === 'string' ? l.target : (l.target as OntologyNode).id
      return {
        id: `${src}-${l.type}-${tgt}`,
        source: src,
        target: tgt,
        label: l.type,
        type: 'smoothstep',
        style: { stroke: t.flowEdgeColor, strokeWidth: 1.2 },
        labelStyle: { fill: t.flowEdgeLabelText, fontSize: 9, fontWeight: 600 },
        labelBgStyle: { fill: t.flowEdgeLabelBg },
      }
    })
}

export function layoutWorkspaceGraph(
  rawNodes: Node[],
  rawEdges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  if (rawNodes.length === 0) return { nodes: [], edges: rawEdges }
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', ranksep: 70, nodesep: 50, marginx: 30, marginy: 30 })
  rawNodes.forEach((n) => g.setNode(n.id, { width: 160, height: 56 }))
  rawEdges.forEach((e) => g.setEdge(e.source, e.target))
  dagre.layout(g)
  return {
    nodes: rawNodes.map((n) => {
      const pos = g.node(n.id)
      return { ...n, position: { x: (pos?.x ?? 0) - 80, y: (pos?.y ?? 0) - 28 } }
    }),
    edges: rawEdges,
  }
}

export function detectNodeLanguage(node: OntologyNode): string {
  const n = node as Record<string, unknown>
  const path = String(n.filePath ?? n.file_path ?? n.path ?? node.externalId ?? '')
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const extMap: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', java: 'java', go: 'go', rs: 'rust', rb: 'ruby',
    json: 'json', yaml: 'yaml', yml: 'yaml', sh: 'shell', bash: 'shell',
    md: 'markdown', sql: 'sql', tf: 'hcl', cs: 'csharp', cpp: 'cpp', c: 'c',
    html: 'html', css: 'css', xml: 'xml',
  }
  if (extMap[ext]) return extMap[ext]
  const typeMap: Record<string, string> = {
    Function: 'typescript', Class: 'typescript', CodeFile: 'typescript', Module: 'typescript',
    Repository: 'json', API: 'yaml', Database: 'sql',
  }
  return typeMap[node.node_type] ?? 'json'
}

export function buildNodeJsonContent(node: OntologyNode): string {
  const display: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(node)) {
    if (!k.startsWith('_') && v !== undefined && v !== null) display[k] = v
  }
  return JSON.stringify(display, null, 2)
}
