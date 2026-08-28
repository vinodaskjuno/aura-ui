/**
 * Infra lens — cloud, compute, network and identity topology.
 *
 * Mirrors aura-api/src/ontology/lenses.py (INFRA_LENS).
 *
 * Default layout is a grouped matrix, not a DAG: infra data is *containment*
 * (environment ⊃ network ⊃ cluster ⊃ host ⊃ workload). Dagre renders containment
 * as long thin chains of one or two nodes per rank, and force-graph cannot
 * express region grouping at all. A matrix reads as an inventory and a topology
 * at once, which is the architect's mental model.
 */
import {
  Archive, Boxes, Cloud, Container, Database, FileKey, Globe, KeyRound, Layers,
  Network as NetworkIcon, Radar, Rocket, Rows3, Server, ShieldAlert, Ship,
  Waypoints, Workflow, Building2, Users, Briefcase,
} from 'lucide-react'
import { daysSince } from '../lensFormat'
import { lacksEdge, ownerFilterGroup, reachable } from '../lensSelectors'
import type {
  LayoutChrome, LensDataContext, LensDefinition, LensDetailSection, LensEdgeType,
  LensGrouping, LensKpi, LensLane, LensNodeType,
} from '../lensTypes'
import type { OntologyNode } from '../../../../api/ontologyUniverse'

const CHROME: LayoutChrome = {
  filterRail: true, legend: true, zoomControls: true,
  breadcrumb: false, kpiBar: true, tourGuide: false,
}

const LANES: LensLane[] = [
  { id: 'env',      label: 'Environment & Network', order: 0 },
  { id: 'cluster',  label: 'Clusters & Hosts',      order: 1 },
  { id: 'workload', label: 'Compute',               order: 2 },
  { id: 'managed',  label: 'Managed Services',      order: 3 },
  { id: 'identity', label: 'Identity & Risk',       order: 4 },
]

const PROVIDER_COLORS: Record<string, string> = {
  aws: '#ff9900', eks: '#ff9900', azure: '#0078d4', aks: '#0078d4',
  gcp: '#4285f4', gke: '#4285f4', 'on-premise': '#94a3b8',
}

// ── grouping: containment must be traversed, not read ────────────────────────
// Verified against the data: `environment` is a property only of Configuration,
// and `severity` only of SecurityFinding. The old AppInfraView's env/severity selects
// were therefore dead for every infra node. Resolve by walking containment
// instead: Container → KubernetesCluster → DeploymentEnvironment, or
// CloudResource → Network → DeploymentEnvironment.
const PLACEMENT_RELS = ['BELONGS_TO', 'DEPLOYED_TO', 'PART_OF', 'RUNS_ON', 'CONTAINS']

/**
 * Dependency edges for blast radius — deliberately WITHOUT PART_OF/CONTAINS.
 *
 * Those are containment, not dependency: walking them upward reaches siblings
 * through a shared parent, so a database would claim to impact every unrelated
 * workload that merely happens to share its cluster.
 */
/**
 * Dependency edges, all oriented consumer → provider, so traversing them inbound
 * yields dependents. HOSTS and CONTAINS are excluded despite being infra edges:
 * they point provider → consumer, so inbound they would return a node's own
 * host or cluster and every workload would claim to take down its platform.
 * A parent's own dependents come from the seed hop instead.
 */
const BLAST_RELS = ['RUNS_ON', 'CONNECTS_TO', 'ROUTES_TO', 'EXPOSED_VIA', 'IMPLEMENTS']

/**
 * Seed hop only: a cluster's containers, a network's members, a host's guests.
 *
 * Both point child→parent, so traversed inbound they yield children. CONTAINS is
 * deliberately excluded even though the data carries it as a redundant inverse:
 * it points parent→child, so inbound it would return a node's own *parent* and a
 * container would claim to take down its cluster.
 */
const BLAST_SEED_RELS = ['PART_OF', 'BELONGS_TO']

function envOf(n: OntologyNode, ctx: LensDataContext): string | null {
  if (ctx.typeOf(n) === 'DeploymentEnvironment') return String(n.label ?? n.id)

  // Traversal first: a containment edge to a real DeploymentEnvironment node is
  // stronger evidence than a free-text property.
  const envs = reachable(ctx, n, {
    rels: PLACEMENT_RELS, dir: 'out',
    targetTypes: ['DeploymentEnvironment'], maxHops: 4,
  })
  if (envs.length) return String(envs[0].label ?? envs[0].id)

  // Fall back to a self-declared value, normalised against the environments the
  // graph actually contains — otherwise "production" renders as a column beside
  // "prod" and the estate looks like it has one more environment than it does.
  const direct = (n as Record<string, unknown>).environment
  if (typeof direct !== 'string' || !direct) return null
  const want = direct.toLowerCase()
  for (const e of ctx.byType.get('DeploymentEnvironment') ?? []) {
    const name = String(e.label ?? e.id).toLowerCase()
    if (name === want || want.startsWith(name) || name.startsWith(want)) {
      return String(e.label ?? e.id)
    }
  }
  return direct
}

function inherited(n: OntologyNode, ctx: LensDataContext, key: string): string | null {
  const own = (n as Record<string, unknown>)[key]
  if (typeof own === 'string' && own) return own
  // Fall back to whatever contains it — a container has no region of its own,
  // its cluster does.
  for (const up of reachable(ctx, n, { rels: PLACEMENT_RELS, dir: 'out', maxHops: 3 })) {
    const v = (up as Record<string, unknown>)[key]
    if (typeof v === 'string' && v) return v
  }
  return null
}

const groupings: LensGrouping[] = [
  { id: 'environment', label: 'Environment', keyOf: envOf },
  { id: 'region', label: 'Region', keyOf: (n, ctx) => inherited(n, ctx, 'region') },
  {
    id: 'provider', label: 'Provider',
    // Surfaces the hybrid estate: cloud accounts beside the on-prem remainder.
    keyOf: (n, ctx) => {
      const loc = (n as Record<string, unknown>).location
      if (loc === 'on-premise') return 'On-Premise'
      return inherited(n, ctx, 'provider')
    },
  },
  {
    id: 'cluster', label: 'Cluster',
    keyOf: (n, ctx) => {
      if (ctx.typeOf(n) === 'KubernetesCluster') return String(n.label ?? n.id)
      const c = reachable(ctx, n, {
        rels: ['PART_OF', 'RUNS_ON', 'CONTAINS'], dir: 'out',
        targetTypes: ['KubernetesCluster'], maxHops: 3,
      })
      return c.length ? String(c[0].label ?? c[0].id) : null
    },
  },
]

const nodeTypes: Record<string, LensNodeType> = {
  DeploymentEnvironment: {
    label: 'Environments', color: '#f97316', glow: '#fb923c', Icon: Globe, lane: 'env',
    cardFields: [
      { key: 'region', label: 'Region' },
      { key: 'isProduction', label: 'Prod', format: 'bool' },
      { key: 'changeFreeze', label: 'Freeze', format: 'bool' },
      { key: 'vpcId', label: 'VPC', format: 'mono' },
    ],
  },
  Network: {
    label: 'Networks', color: '#38bdf8', Icon: NetworkIcon, lane: 'env',
    cardFields: [
      { key: 'cidr', label: 'CIDR', format: 'mono' },
      { key: 'type', label: 'Kind', emphasis: 'badge' },
      // A VPC without flow logs is a standing audit finding.
      { key: 'flowLogsEnabled', label: 'Flow logs', format: 'bool' },
      { key: 'openToWorld', label: 'Open 0.0.0.0/0', format: 'bool' },
    ],
  },
  Infrastructure: {
    label: 'Infrastructure', color: '#06b6d4', Icon: Building2, lane: 'cluster',
    cardFields: [
      { key: 'type', label: 'Kind', emphasis: 'badge' },
      { key: 'hostname', label: 'Host', format: 'mono' },
      { key: 'region', label: 'Region' },
    ],
  },
  KubernetesCluster: {
    label: 'Clusters', color: '#3b82f6', glow: '#60a5fa', Icon: Ship, lane: 'cluster',
    cardSize: { w: 205, h: 106 },
    cardFields: [
      { key: 'provider', label: 'Provider', emphasis: 'badge', colorMap: PROVIDER_COLORS },
      { key: 'version', label: 'Version', format: 'mono' },
      { key: 'region', label: 'Region' },
      { key: 'nodeCount', label: 'Nodes' },
      { key: 'podCapacity', label: 'Pod cap', format: 'compact' },
    ],
  },
  Server: {
    label: 'Servers', color: '#a16207', Icon: Server, lane: 'cluster',
    cardSize: { w: 200, h: 104 },
    cardFields: [
      { key: 'location', label: 'Site', emphasis: 'badge', colorMap: PROVIDER_COLORS },
      { key: 'os', label: 'OS' },
      { key: 'ipAddress', label: 'IP', format: 'mono' },
      // The legacy-estate risk: vendor support running out.
      { key: 'endOfSupport', label: 'EOL', format: 'relative' },
      { key: 'managed', label: 'Managed', format: 'bool' },
    ],
  },
  VM: {
    label: 'VMs', color: '#8b5cf6', Icon: Boxes, lane: 'workload',
    cardFields: [
      { key: 'instanceType', label: 'Type', format: 'mono' },
      { key: 'os', label: 'OS' },
      { key: 'privateIp', label: 'IP', format: 'mono' },
      { key: 'patchLevel', label: 'Patch', emphasis: 'badge' },
    ],
  },
  Container: {
    label: 'Containers', color: '#10b981', glow: '#34d399', Icon: Container, lane: 'workload',
    cardSize: { w: 200, h: 100 },
    cardFields: [
      { key: 'image', label: 'Image', format: 'pathTail' },
      { key: 'replicas', label: 'Replicas' },
      { key: 'cpuRequest', label: 'CPU', format: 'mono' },
      { key: 'memoryRequest', label: 'Mem', format: 'mono' },
      { key: 'restartCount', label: 'Restarts', emphasis: 'pip', thresholds: { good: 0, warn: 1, bad: 5 } },
    ],
  },
  CloudResource: {
    label: 'Cloud Resources', color: '#0ea5e9', Icon: Cloud, lane: 'managed',
    cardSize: { w: 200, h: 100 },
    cardFields: [
      { key: 'resourceType', label: 'Type', emphasis: 'badge' },
      { key: 'provider', label: 'Cloud', colorMap: PROVIDER_COLORS },
      { key: 'region', label: 'Region' },
      { key: 'encrypted', label: 'Encrypted', format: 'bool' },
      { key: 'monthlyCostUsd', label: 'Cost', format: 'currency', suffix: '/mo' },
    ],
  },
  Database: {
    label: 'Databases', color: '#9333ea', Icon: Database, lane: 'managed',
    cardSize: { w: 200, h: 100 },
    cardFields: [
      { key: 'engine', label: 'Engine', emphasis: 'badge' },
      { key: 'version', label: 'Version', format: 'mono' },
      { key: 'sizeGb', label: 'Size', format: 'gb' },
      { key: 'encryptedAtRest', label: 'Encrypted', format: 'bool' },
      { key: 'multiAz', label: 'Multi-AZ', format: 'bool' },
    ],
  },
  Service: {
    label: 'Services', color: '#22c55e', Icon: Layers, lane: 'workload', contextOnly: true,
    cardFields: [{ key: 'criticality', label: 'Tier', emphasis: 'badge' }],
  },
  Team: {
    label: 'Teams', color: '#ec4899', Icon: Users, lane: 'identity', contextOnly: true,
    cardFields: [{ key: 'memberCount', label: 'Members' }],
  },
  Project: {
    label: 'Projects', color: '#f59e0b', Icon: Briefcase, lane: 'identity', contextOnly: true,
    cardFields: [{ key: 'status', label: 'Status', emphasis: 'badge' }],
  },
  Deployment: {
    label: 'Deployments', color: '#4ade80', Icon: Rocket, lane: 'workload',
    cardFields: [
      { key: 'status', label: 'Status', emphasis: 'badge' },
      { key: 'strategy', label: 'Strategy' },
      { key: 'deployedAt', label: 'When', format: 'relative' },
    ],
  },
  BuildArtifact: {
    label: 'Artifacts', color: '#c084fc', Icon: Archive, lane: 'workload',
    cardFields: [
      { key: 'type', label: 'Type', emphasis: 'badge' },
      { key: 'signed', label: 'Signed', format: 'bool' },
    ],
  },
  IAMRole: {
    label: 'IAM Roles', color: '#eab308', Icon: KeyRound, lane: 'identity',
    cardFields: [
      { key: 'trustedPrincipal', label: 'Trusts', format: 'mono' },
      { key: 'managedPolicyCount', label: 'Policies' },
    ],
  },
  IAMPolicy: {
    label: 'IAM Policies', color: '#ca8a04', Icon: FileKey, lane: 'identity',
    cardFields: [
      { key: 'statementCount', label: 'Statements' },
      { key: 'hasWildcardAction', label: 'Action *', format: 'bool' },
      { key: 'hasWildcardResource', label: 'Resource *', format: 'bool' },
    ],
  },
  ServiceAccount: {
    label: 'Service Accounts', color: '#facc15', Icon: KeyRound, lane: 'identity',
    cardFields: [{ key: 'namespace', label: 'Namespace', format: 'mono' }],
  },
  SecurityFinding: {
    label: 'Security Findings', color: '#ef4444', glow: '#f87171', Icon: ShieldAlert, lane: 'identity',
    cardFields: [
      { key: 'severity', label: 'Severity', emphasis: 'badge' },
      { key: 'cvssScore', label: 'CVSS', emphasis: 'pip', thresholds: { good: 4, warn: 7, bad: 9 } },
      { key: 'status', label: 'Status' },
    ],
  },
  AttackPath: {
    label: 'Attack Paths', color: '#dc2626', Icon: Radar, lane: 'identity',
    cardFields: [
      { key: 'likelihood', label: 'Likelihood', emphasis: 'badge' },
      { key: 'impact', label: 'Impact', emphasis: 'badge' },
      { key: 'hopCount', label: 'Hops' },
    ],
  },
}

const edgeTypes: Record<string, LensEdgeType> = {
  BELONGS_TO:  { color: '#38bdf8', semantic: 'Placed in', weight: 3 },
  DEPLOYED_TO: { color: '#f97316', semantic: 'Deployed to environment', weight: 3 },
  PART_OF:     { color: '#818cf8', semantic: 'Contained by', weight: 2 },
  CONTAINS:    { color: '#6366f1', semantic: 'Contains', weight: 2 },
  RUNS_ON:     { color: '#10b981', semantic: 'Runs on host', weight: 3 },
  HOSTS:       { color: '#22c55e', semantic: 'Hosts service' },
  IMPLEMENTS:  { color: '#4ade80', semantic: 'Implements service' },
  CONNECTS_TO: { color: '#9333ea', semantic: 'Connects to datastore' },
  EXPOSED_VIA: { color: '#0ea5e9', semantic: 'Exposed via network' },
  ROUTES_TO:   { color: '#06b6d4', semantic: 'Routes traffic to' },
  ACCESSES_AS: { color: '#eab308', semantic: 'Assumes identity' },
  GOVERNED_BY: { color: '#ca8a04', semantic: 'Governed by policy' },
  HAS_FINDING: { color: '#ef4444', semantic: 'Has security finding' },
  REFERENCED_BY: { color: '#dc2626', semantic: 'Referenced by', dashed: true },
  OWNED_BY: { color: '#ec4899', semantic: 'Owned by', excludeFromLayout: true },
  // Alias emitted by the mock MCP ingester in place of OWNED_BY.
  MANAGED_BY: { color: '#ec4899', semantic: 'Managed by (legacy alias for OWNED_BY)',
    excludeFromLayout: true, nonCanonical: true },
}

/** Outbound: a workload declares the service it implements and the host it runs on. */
const SCOPE_OUT = ['IMPLEMENTS', 'RUNS_ON', 'PART_OF', 'BELONGS_TO', 'OWNED_BY', 'MANAGED_BY']
/** Inbound: a cluster contains its workloads and a host hosts its services. */
const SCOPE_IN = ['CONTAINS', 'HOSTS', 'RUNS_ON', 'ROUTES_TO', 'CONNECTS_TO']

const num = (n: OntologyNode, k: string): number => Number((n as Record<string, unknown>)[k]) || 0
const isFalse = (n: OntologyNode, k: string): boolean =>
  (n as Record<string, unknown>)[k] === false
const boolOrNull = (n: OntologyNode, keys: string[]): boolean | null => {
  for (const k of keys) {
    const v = (n as Record<string, unknown>)[k]
    if (typeof v === 'boolean') return v
  }
  return null
}

const EOL_WARN_DAYS = 365

const kpis: LensKpi[] = [
  { id: 'environments', label: 'Environments', accent: '#f97316',
    compute: ctx => ctx.byType.get('DeploymentEnvironment')?.length ?? 0 },
  { id: 'clusters', label: 'Clusters', accent: '#3b82f6',
    compute: ctx => ctx.byType.get('KubernetesCluster')?.length ?? 0 },
  { id: 'computeNodes', label: 'Compute Nodes', accent: '#8b5cf6', hint: 'VMs plus physical servers',
    compute: ctx => (ctx.byType.get('VM')?.length ?? 0) + (ctx.byType.get('Server')?.length ?? 0) },
  { id: 'instances', label: 'Container Instances', accent: '#10b981', hint: 'Sum of replicas',
    compute: ctx => (ctx.byType.get('Container') ?? []).reduce((s, c) => s + num(c, 'replicas'), 0) },
  { id: 'cost', label: 'Monthly Cost', format: 'currency', accent: '#22d3ee',
    hint: 'Sum of CloudResource.monthlyCostUsd',
    compute: ctx => (ctx.byType.get('CloudResource') ?? []).reduce((s, r) => s + num(r, 'monthlyCostUsd'), 0) },
  { id: 'unencrypted', label: 'Unencrypted', accent: '#ef4444',
    hint: 'Resources with encryption explicitly off',
    thresholds: { good: 0, warn: 1, bad: 2 },
    compute: ctx => [...(ctx.byType.get('CloudResource') ?? []), ...(ctx.byType.get('Database') ?? [])]
      .filter(n => isFalse(n, 'encrypted') || isFalse(n, 'encryptedAtRest') || isFalse(n, 'storageEncrypted'))
      .length },
  { id: 'eolServers', label: 'EOL Servers', accent: '#f43f5e',
    hint: 'Vendor support ends within 12 months',
    thresholds: { good: 0, warn: 1, bad: 2 },
    compute: ctx => (ctx.byType.get('Server') ?? []).filter(s => {
      const d = daysSince((s as Record<string, unknown>).endOfSupport)
      return d !== null && d > -EOL_WARN_DAYS
    }).length },
  { id: 'criticalFindings', label: 'Critical Findings', accent: '#dc2626',
    thresholds: { good: 0, warn: 1, bad: 3 },
    compute: ctx => (ctx.byType.get('SecurityFinding') ?? [])
      .filter(f => String((f as Record<string, unknown>).severity).toLowerCase() === 'critical').length },
  { id: 'noFlowLogs', label: 'No Flow Logs', secondary: true, accent: '#fb923c',
    compute: ctx => (ctx.byType.get('Network') ?? []).filter(n => isFalse(n, 'flowLogsEnabled')).length },
  { id: 'worldOpen', label: 'Open to Internet', secondary: true, accent: '#ef4444',
    compute: ctx => (ctx.byType.get('Network') ?? [])
      .filter(n => (n as Record<string, unknown>).openToWorld === true).length },
  { id: 'unpatched', label: 'Stale Patch Level', secondary: true, accent: '#f59e0b',
    compute: ctx => (ctx.byType.get('VM') ?? [])
      .filter(v => String((v as Record<string, unknown>).patchLevel ?? 'unknown') !== 'current').length },
  { id: 'ungovernedRoles', label: 'Ungoverned Roles', secondary: true, accent: '#eab308',
    hint: 'IAM roles with no GOVERNED_BY policy',
    compute: ctx => (ctx.byType.get('IAMRole') ?? []).filter(r => lacksEdge(ctx, r, 'GOVERNED_BY')).length },
  { id: 'restarts', label: 'Container Restarts', secondary: true, accent: '#f97316',
    compute: ctx => (ctx.byType.get('Container') ?? []).reduce((s, c) => s + num(c, 'restartCount'), 0) },
  { id: 'unplaced', label: 'Unplaced Infra', secondary: true, accent: '#fbbf24',
    hint: 'Environment cannot be resolved by traversal — a data-quality signal',
    compute: ctx => ['CloudResource', 'VM', 'Container', 'Database']
      .flatMap(t => ctx.byType.get(t) ?? [])
      .filter(n => envOf(n, ctx) === null).length },
]

const detailSections: LensDetailSection[] = [
  {
    id: 'placement', label: 'Placement',
    focusable: true,
    kind: { type: 'chain', steps: [
      { rel: 'PART_OF', dir: 'out' },
      { rel: 'BELONGS_TO', dir: 'out' },
      { rel: 'DEPLOYED_TO', dir: 'out' },
    ] },
  },
  {
    id: 'capacity', label: 'Capacity & Cost',
    forTypes: ['VM', 'Container', 'CloudResource', 'KubernetesCluster', 'Database', 'Server'],
    kind: { type: 'fields', fields: [
      { key: 'instanceType', label: 'Instance type', format: 'mono' },
      { key: 'cpuCores', label: 'vCPU' }, { key: 'memoryGb', label: 'Memory', format: 'gb' },
      { key: 'replicas', label: 'Replicas' },
      { key: 'cpuRequest', label: 'CPU request', format: 'mono' },
      { key: 'memoryRequest', label: 'Mem request', format: 'mono' },
      { key: 'nodeCount', label: 'Nodes' }, { key: 'podCapacity', label: 'Pod capacity' },
      { key: 'sizeGb', label: 'Storage', format: 'gb' },
      { key: 'monthlyCostUsd', label: 'Monthly cost', format: 'currency' },
    ] },
  },
  {
    // `pass` returns null for unknown, which renders grey — an unencrypted-by-
    // omission resource must never read as compliant.
    id: 'compliance', label: 'Compliance',
    forTypes: ['CloudResource', 'Database', 'Network', 'VM', 'Server', 'IAMRole'],
    kind: { type: 'compliance', checks: [
      { label: 'Encrypted at rest', hint: 'encrypted / encryptedAtRest / storageEncrypted',
        pass: n => boolOrNull(n, ['encrypted', 'encryptedAtRest', 'storageEncrypted']) },
      { label: 'Flow logs enabled', pass: n => boolOrNull(n, ['flowLogsEnabled']) },
      { label: 'Not open to 0.0.0.0/0',
        pass: n => { const v = boolOrNull(n, ['openToWorld']); return v === null ? null : !v } },
      { label: 'Patch level current',
        pass: n => { const p = (n as Record<string, unknown>).patchLevel
                     return p === undefined ? null : p === 'current' } },
      { label: 'Vendor support current',
        pass: n => { const d = daysSince((n as Record<string, unknown>).endOfSupport)
                     return d === null ? null : d < -EOL_WARN_DAYS } },
      { label: 'Multi-AZ', pass: n => boolOrNull(n, ['multiAz']) },
      { label: 'Governed by a policy',
        pass: (n, ctx) => ctx.typeOf(n) === 'IAMRole' ? !lacksEdge(ctx, n, 'GOVERNED_BY') : null },
    ] },
  },
  {
    // The question no inventory tool can answer, and the reason the graph exists.
    id: 'blast', label: 'Blast Radius',
    focusable: true,
    kind: { type: 'reachable',
      seedRels: BLAST_SEED_RELS, rels: BLAST_RELS,
      dir: 'in', maxHops: 5 },
  },
  {
    id: 'risk', label: 'Security Findings',
    kind: { type: 'related', rels: ['HAS_FINDING', 'REFERENCED_BY'], dir: 'both',
            types: ['SecurityFinding', 'AttackPath'] },
  },
  {
    id: 'identity', label: 'Identity',
    forTypes: ['Container', 'Service', 'IAMRole'],
    kind: { type: 'related', rels: ['ACCESSES_AS', 'GOVERNED_BY'], dir: 'out',
            types: ['IAMRole', 'IAMPolicy', 'ServiceAccount'] },
  },
]

export const infraLens: LensDefinition = {
  id: 'infra',
  label: 'Infra',
  sublabel: 'Environment → Cluster → Workload',
  Icon: Cloud,
  accent: '#38bdf8',
  order: 2,
  nodeTypes,
  edgeTypes,
  lanes: LANES,
  groupings,
  layouts: [
    { id: 'grouped-lanes', label: 'Estate', Icon: Rows3, slot: 'layout', chrome: CHROME,
      hint: 'Environment × infrastructure tier — inventory and topology at once' },
    // Upward reachability from the selected node: what breaks if this dies.
    { id: 'dag', label: 'Blast Radius', Icon: Waypoints, slot: 'layout', chrome: CHROME,
      nodeCap: 300, fallbackLayout: 'grouped-lanes',
      params: {
        rankdir: 'BT', ranksep: 110, nodesep: 30,
        focus: {
          seedRels: BLAST_SEED_RELS, rels: BLAST_RELS,
          dir: 'in', maxHops: 5,
        },
      },
      hint: 'Select a resource to see everything that depends on it' },
    { id: 'force', label: 'Graph', Icon: Workflow, slot: 'layout', chrome: CHROME,
      legendHints: ['✦ Click node to inspect', '✦ Space → fit to screen', '✦ Drag node to pin'],
      hint: 'Free-form exploration' },
  ],
  filters: [
    { id: 'type', label: 'Node Type', kind: 'nodeType',
      options: Object.entries(nodeTypes).map(([id, c]) => ({ id, label: c.label, color: c.color })) },
    {
      id: 'environment', label: 'Environment', kind: 'derived',
      // Derived, not read: environment is resolved by walking containment, so
      // the option list cannot come from a property scan.
      optionsOf: ctx => {
        const keys = new Set<string>()
        let unplaced = 0
        for (const n of ctx.nodes) {
          const e = envOf(n, ctx)
          if (e) keys.add(e)
          else unplaced++
        }
        const opts = [...keys].sort().map(k => ({
          id: k, label: k,
          predicate: (n: OntologyNode, c: LensDataContext) => envOf(n, c) === k,
        }))
        if (unplaced) {
          opts.push({ id: '__unplaced__', label: 'Unassigned',
            predicate: (n: OntologyNode, c: LensDataContext) => envOf(n, c) === null })
        }
        return opts
      },
    },
    ownerFilterGroup('service', 'Service',
      { outRels: SCOPE_OUT, inRels: SCOPE_IN, types: ['Service'], maxHops: 4 },
      { unassignedLabel: 'No service' }),
    ownerFilterGroup('team', 'Owning Team',
      { outRels: SCOPE_OUT, inRels: SCOPE_IN, types: ['Team'], maxHops: 6 },
      { unassignedLabel: 'Unowned' }),
    ownerFilterGroup('project', 'Project',
      { outRels: SCOPE_OUT, inRels: SCOPE_IN, types: ['Project'], maxHops: 6 }),
    { id: 'region', label: 'Region', kind: 'prop', propKey: 'region', defaultCollapsed: true },
    { id: 'provider', label: 'Provider', kind: 'prop', propKey: 'provider', defaultCollapsed: true },
    { id: 'resourceType', label: 'Resource Type', kind: 'prop', propKey: 'resourceType', defaultCollapsed: true },
    { id: 'posture', label: 'Posture', kind: 'derived', defaultCollapsed: true, options: [
      { id: 'unencrypted', label: 'Unencrypted',
        predicate: n => isFalse(n, 'encrypted') || isFalse(n, 'encryptedAtRest') || isFalse(n, 'storageEncrypted') },
      { id: 'noFlowLogs', label: 'No flow logs', predicate: n => isFalse(n, 'flowLogsEnabled') },
      { id: 'worldOpen', label: 'Open to internet',
        predicate: n => (n as Record<string, unknown>).openToWorld === true },
      { id: 'unpatched', label: 'Stale patch level',
        predicate: (n, ctx) => ctx.typeOf(n) === 'VM'
          && String((n as Record<string, unknown>).patchLevel ?? 'unknown') !== 'current' },
      { id: 'eol', label: 'Vendor support ending',
        predicate: n => { const d = daysSince((n as Record<string, unknown>).endOfSupport)
                          return d !== null && d > -EOL_WARN_DAYS } },
      { id: 'ungoverned', label: 'IAM role with no policy',
        predicate: (n, ctx) => ctx.typeOf(n) === 'IAMRole' && lacksEdge(ctx, n, 'GOVERNED_BY') },
      { id: 'unplaced', label: 'No environment',
        predicate: (n, ctx) => envOf(n, ctx) === null },
    ] },
    { id: 'source', label: 'Data Sources', kind: 'source', defaultCollapsed: true },
  ],
  kpis,
  detail: { sections: detailSections },
  legend: { nodeTypes: true, edgeTypes: true, presentOnly: true },
  emptyState: {
    title: 'No infrastructure in the graph yet',
    body: 'The Infra lens is built from CloudResource, KubernetesCluster, VM, Container '
        + 'and Network nodes. Connect AWS, Azure, GCP or Kubernetes to populate it.',
    cta: { label: 'Open Connectors', to: '/connectors' },
  },
}
