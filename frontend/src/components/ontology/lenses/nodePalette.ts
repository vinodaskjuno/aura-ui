/**
 * Canonical node palette.
 *
 * Previously lived inside OntologyGraph, which made a 1120-line canvas renderer
 * the source of truth for colours that the legend, filter rail and every lens
 * also needed — the root of the nine duplicated type→colour maps this codebase
 * accumulated. The tables are moved here verbatim (not re-typed) so the values
 * are provably unchanged; OntologyGraph now imports them.
 *
 * Keys are lowercase by history. Lens code matches case-insensitively through
 * makeTypeResolver, so callers never depend on the casing.
 */
export interface NodeTypeConfigEntry {
  color: string
  label: string
  group: string
  glow: string
}

export const NODE_TYPE_CONFIG: Record<string, NodeTypeConfigEntry> = {
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

export const FALLBACK_COLORS = [
  '#60a5fa','#f59e0b','#10b981','#a78bfa','#ec4899',
  '#06b6d4','#f97316','#ef4444','#34d399','#fbbf24',
]

export const NODE_SIZES: Record<string, number> = {
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

/** Stable colour for a type with no palette entry — mirrors the canvas fallback. */
export function fallbackColor(key: string): string {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (Math.imul(31, h) + key.charCodeAt(i)) | 0
  return FALLBACK_COLORS[Math.abs(h) % FALLBACK_COLORS.length]
}
