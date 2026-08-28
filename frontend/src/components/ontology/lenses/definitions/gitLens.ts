/**
 * Git lens — repository, code structure, build and release topology.
 *
 * Mirrors the server-side definition in aura-api/src/ontology/lenses.py
 * (GIT_LENS): same labels, same typed edges. Keeping the two aligned is what
 * lets the view switch to the server-projected /api/ontology/lens/git endpoint
 * without changing anything here.
 *
 * The KPIs that matter to an architect are the absence-of-edge ones — repos with
 * no pipeline, repos with no owner, unsigned artifacts. Those are answerable
 * because this is a graph, not a dashboard.
 */
import {
  Archive, Box, Briefcase, Code2, Cog, FileCode, Flag, FolderGit2, Globe, Layers,
  Network, Package, PackageOpen, Rocket, Rows3, Settings2, ShieldAlert,
  User, Users, Workflow,
} from 'lucide-react'
import { daysSince } from '../lensFormat'
import { lacksEdge, ownerFilterGroup } from '../lensSelectors'
import type {
  LayoutChrome, LensDefinition, LensDetailSection, LensEdgeType, LensKpi,
  LensLane, LensNodeType,
} from '../lensTypes'

const CHROME: LayoutChrome = {
  filterRail: true, legend: true, zoomControls: true,
  breadcrumb: false, kpiBar: true, tourGuide: false,
}

const LANES: LensLane[] = [
  { id: 'owner',    label: 'Ownership',    order: 0 },
  { id: 'repo',     label: 'Repositories', order: 1 },
  { id: 'structure',label: 'Structure',    order: 2 },
  { id: 'symbols',  label: 'Symbols',      order: 3 },
  { id: 'supply',   label: 'Supply Chain', order: 4 },
  { id: 'ci',       label: 'CI',           order: 5 },
  { id: 'delivery', label: 'Delivery',     order: 6 },
]

const LANG_COLORS: Record<string, string> = {
  python: '#3b82f6', typescript: '#0ea5e9', javascript: '#f59e0b',
  java: '#ef4444', go: '#06b6d4', rust: '#f97316', cobol: '#a16207',
}

const nodeTypes: Record<string, LensNodeType> = {
  Team: {
    label: 'Teams', color: '#ec4899', Icon: Users, lane: 'owner', contextOnly: true,
    cardFields: [{ key: 'memberCount', label: 'Members' }],
  },
  User: {
    label: 'Users', color: '#f472b6', Icon: User, lane: 'owner', contextOnly: true,
    cardFields: [{ key: 'role', label: 'Role' }],
  },
  Service: {
    label: 'Services', color: '#10b981', Icon: Layers, lane: 'repo', contextOnly: true,
    cardFields: [{ key: 'criticality', label: 'Tier', emphasis: 'badge' }],
  },
  Project: {
    label: 'Projects', color: '#f59e0b', Icon: Briefcase, lane: 'owner', contextOnly: true,
    cardFields: [{ key: 'status', label: 'Status', emphasis: 'badge' }],
  },
  Repository: {
    label: 'Repositories', color: '#a78bfa', glow: '#c4b5fd', Icon: FolderGit2,
    lane: 'repo', cardSize: { w: 210, h: 118 },
    cardFields: [
      { key: 'language', label: 'Lang', emphasis: 'badge', colorMap: LANG_COLORS },
      { key: 'defaultBranch', label: 'Branch', format: 'mono' },
      { key: 'linesOfCode', label: 'LOC', format: 'compact' },
      // Amber past 10 open PRs — a review queue, not flow.
      { key: 'openPullRequests', label: 'PRs', thresholds: { warn: 10, bad: 25 } },
      // The stale-repo signal: amber at a month, red at a quarter.
      { key: 'lastCommit', label: 'Commit', format: 'relative' },
      { key: 'visibility', label: 'Access', emphasis: 'badge' },
    ],
  },
  Module: {
    label: 'Modules', color: '#818cf8', Icon: Package, lane: 'structure',
    cardFields: [
      { key: 'packagePath', label: 'Path', format: 'pathTail' },
      { key: 'publicSymbols', label: 'Symbols' },
    ],
  },
  CodeFile: {
    label: 'Code Files', color: '#60a5fa', Icon: FileCode, lane: 'structure',
    cardSize: { w: 200, h: 104 },
    cardFields: [
      { key: 'path', label: 'Path', format: 'pathTail' },
      { key: 'language', label: 'Lang', emphasis: 'badge', colorMap: LANG_COLORS },
      { key: 'linesOfCode', label: 'LOC', format: 'compact' },
      { key: 'complexity', label: 'Cx', emphasis: 'pip', thresholds: { good: 10, warn: 15, bad: 20 } },
      { key: 'testCoverage', label: 'Cov', emphasis: 'bar', format: 'percent',
        thresholds: { direction: 'higher-is-better', good: 0.8, warn: 0.65, bad: 0.5 } },
    ],
  },
  Class: {
    label: 'Classes', color: '#22d3ee', Icon: Box, lane: 'symbols',
    cardFields: [
      { key: 'visibility', label: 'Vis', emphasis: 'badge' },
      { key: 'methods', label: 'Methods' },
    ],
  },
  Function: {
    label: 'Functions', color: '#34d399', Icon: Code2, lane: 'symbols',
    cardFields: [
      { key: 'linesOfCode', label: 'LOC' },
      { key: 'cyclomaticComplexity', label: 'Cx', emphasis: 'pip', thresholds: { good: 5, warn: 8, bad: 10 } },
      { key: 'hasTests', label: 'Tested', format: 'bool' },
    ],
  },
  Dependency: {
    label: 'Dependencies', color: '#f59e0b', Icon: PackageOpen, lane: 'supply',
    cardFields: [
      { key: 'version', label: 'Version', format: 'mono' },
      { key: 'registry', label: 'Registry', emphasis: 'badge' },
      { key: 'license', label: 'License' },
      { key: 'directDependents', label: 'Used by' },
    ],
  },
  Vulnerability: {
    label: 'Vulnerabilities', color: '#ef4444', glow: '#f87171', Icon: ShieldAlert, lane: 'supply',
    cardFields: [
      { key: 'severity', label: 'Severity', emphasis: 'badge' },
      { key: 'cvssScore', label: 'CVSS', emphasis: 'pip', thresholds: { good: 4, warn: 7, bad: 9 } },
      { key: 'fixedVersion', label: 'Fixed in', format: 'mono' },
    ],
  },
  Configuration: {
    label: 'Configuration', color: '#94a3b8', Icon: Settings2, lane: 'supply',
    cardFields: [
      { key: 'environment', label: 'Env', emphasis: 'badge' },
      // Secrets referenced from config is a standing audit flag.
      { key: 'secretRefs', label: 'Secrets', thresholds: { warn: 1, bad: 5 } },
    ],
  },
  FeatureFlag: {
    label: 'Feature Flags', color: '#fbbf24', Icon: Flag, lane: 'supply',
    cardFields: [
      { key: 'enabled', label: 'On', format: 'bool' },
      { key: 'rolloutPercent', label: 'Rollout', emphasis: 'bar', format: 'ratio' },
      { key: 'createdAt', label: 'Age', format: 'relative' },
    ],
  },
  BuildPipeline: {
    label: 'Pipelines', color: '#06b6d4', glow: '#22d3ee', Icon: Cog, lane: 'ci',
    cardSize: { w: 205, h: 110 },
    cardFields: [
      { key: 'tool', label: 'Tool', emphasis: 'badge' },
      { key: 'successRatePercent', label: 'Pass', emphasis: 'bar', format: 'ratio',
        thresholds: { direction: 'higher-is-better', good: 97, warn: 92, bad: 90 } },
      { key: 'totalRuns', label: 'Runs', format: 'compact' },
      { key: 'avgDurationSec', label: 'Avg', format: 'duration' },
      { key: 'lastRun', label: 'Last run', format: 'relative' },
    ],
  },
  BuildArtifact: {
    label: 'Artifacts', color: '#c084fc', Icon: Archive, lane: 'ci',
    cardFields: [
      { key: 'type', label: 'Type', emphasis: 'badge' },
      { key: 'sizeMb', label: 'Size', format: 'mb' },
      // Unsigned artifacts reaching an environment is a supply-chain gap.
      { key: 'signed', label: 'Signed', format: 'bool' },
      { key: 'digest', label: 'Digest', format: 'mono' },
    ],
  },
  Deployment: {
    label: 'Deployments', color: '#4ade80', Icon: Rocket, lane: 'delivery',
    cardFields: [
      { key: 'status', label: 'Status', emphasis: 'badge' },
      { key: 'strategy', label: 'Strategy' },
      { key: 'durationSec', label: 'Took', format: 'duration' },
      { key: 'deployedAt', label: 'When', format: 'relative' },
    ],
  },
  DeploymentEnvironment: {
    label: 'Environments', color: '#f97316', Icon: Globe, lane: 'delivery',
    cardFields: [
      { key: 'region', label: 'Region' },
      { key: 'isProduction', label: 'Prod', format: 'bool' },
      { key: 'changeFreeze', label: 'Freeze', format: 'bool' },
    ],
  },
}

/**
 * `reverse` marks edges the data stores child→parent while the view reads
 * parent→child. Without it dagre draws the whole pipeline backwards.
 * `between` disambiguates overloaded types — PART_OF spans a dozen label pairs.
 */
const edgeTypes: Record<string, LensEdgeType> = {
  COMMITTED_TO: { color: '#a78bfa', semantic: 'Code → Repository', reverse: true, weight: 3,
    between: [{ from: ['CodeFile'], to: ['Repository'] }] },
  PART_OF: { color: '#818cf8', semantic: 'Child → Parent', reverse: true, weight: 3 },
  BELONGS_TO: { color: '#64748b', semantic: 'Member of', reverse: true, dashed: true },
  IMPORTS: { color: '#38bdf8', semantic: 'File imports file' },
  CALLS: { color: '#34d399', semantic: 'Function calls function', animated: true },
  EXTENDS: { color: '#22d3ee', semantic: 'Class extends class', dashed: true },
  DEPENDS_ON: { color: '#f59e0b', semantic: 'Repository → Dependency', weight: 2,
    between: [{ from: ['Repository'], to: ['Dependency'] }] },
  HAS_FINDING: { color: '#ef4444', semantic: 'Vulnerability in dependency', reverse: true,
    between: [{ from: ['Vulnerability'], to: ['Dependency'] }] },
  BUILT_BY: { color: '#06b6d4', semantic: 'Repository → Pipeline', weight: 3 },
  PRODUCES: { color: '#c084fc', semantic: 'Pipeline → Artifact', weight: 3 },
  DEPLOYED_TO: { color: '#f97316', semantic: 'Artifact → Environment', weight: 3 },
  IMPLEMENTS: { color: '#10b981', semantic: 'Repository → Service' },
  // Ownership renders as a chip on the card; drawing it would add a hub edge
  // from every repository to the same few teams and obscure the pipeline.
  OWNED_BY: { color: '#ec4899', semantic: 'Owned by', excludeFromLayout: true },
  // Alias emitted by the mock MCP ingester in place of OWNED_BY. Kept so the
  // ownership filters resolve against existing data.
  MANAGED_BY: { color: '#ec4899', semantic: 'Managed by (legacy alias for OWNED_BY)',
    excludeFromLayout: true, nonCanonical: true },
  // Likewise: Service -HOSTED_IN-> Repository stands in for IMPLEMENTS.
  HOSTED_IN: { color: '#10b981', semantic: 'Hosted in (legacy alias for IMPLEMENTS)',
    excludeFromLayout: true, nonCanonical: true },
}

/** Followed outbound: containment and ownership point child → parent. */
const SCOPE_OUT = ['OWNED_BY', 'MANAGED_BY', 'IMPLEMENTS', 'HOSTED_IN', 'BELONGS_TO',
                   'PART_OF', 'COMMITTED_TO']
/** Followed inbound: the CI spine points repository → pipeline → artifact. */
const SCOPE_IN = ['BUILT_BY', 'PRODUCES']

const STALE_DAYS = 90

const kpis: LensKpi[] = [
  { id: 'repos', label: 'Repositories', accent: '#a78bfa',
    compute: ctx => ctx.byType.get('Repository')?.length ?? 0 },
  { id: 'loc', label: 'Lines of Code', format: 'compact', accent: '#60a5fa',
    hint: 'Total across all repositories',
    compute: ctx => sum(ctx.byType.get('Repository'), 'linesOfCode') },
  { id: 'openPrs', label: 'Open PRs', accent: '#38bdf8', hint: 'Work in flight',
    compute: ctx => sum(ctx.byType.get('Repository'), 'openPullRequests') },
  { id: 'staleRepos', label: `Stale >${STALE_DAYS}d`, accent: '#f59e0b',
    hint: 'No commit in 90 days — likely abandoned',
    thresholds: { good: 0, warn: 1, bad: 3 },
    compute: ctx => (ctx.byType.get('Repository') ?? []).filter(r => {
      const d = daysSince((r as Record<string, unknown>).lastCommit)
      return d !== null && d > STALE_DAYS
    }).length },
  { id: 'pipelineSuccess', label: 'Pipeline Health', format: 'ratio', accent: '#06b6d4',
    hint: 'Run-weighted mean success rate',
    thresholds: { direction: 'higher-is-better', good: 97, warn: 92, bad: 90 },
    compute: ctx => {
      const ps = (ctx.byType.get('BuildPipeline') ?? []) as unknown as Record<string, number>[]
      const runs = ps.reduce((s, p) => s + (Number(p.totalRuns) || 0), 0)
      if (!runs) return null
      // Run-weighted: a 3-run pipeline at 100% must not offset a 4,000-run one at 80%.
      return ps.reduce((s, p) => s + (Number(p.totalRuns) || 0) * (Number(p.successRatePercent) || 0), 0) / runs
    } },
  { id: 'coverage', label: 'Test Coverage', format: 'percent', accent: '#34d399',
    thresholds: { direction: 'higher-is-better', good: 0.8, warn: 0.65, bad: 0.5 },
    compute: ctx => {
      const fs = (ctx.byType.get('CodeFile') ?? []) as unknown as Record<string, number>[]
      const withCov = fs.filter(f => typeof f.testCoverage === 'number')
      if (!withCov.length) return null
      return withCov.reduce((s, f) => s + f.testCoverage, 0) / withCov.length
    } },
  { id: 'vulnDeps', label: 'Vuln Deps', accent: '#ef4444',
    hint: 'Dependencies with a known CVE', thresholds: { good: 0, warn: 1, bad: 3 },
    compute: ctx => (ctx.byType.get('Dependency') ?? []).filter(d =>
      (d as Record<string, unknown>).hasKnownVulnerability === true
      || (ctx.in.get(d.id) ?? []).some(l => l.type === 'HAS_FINDING')).length },
  // The payoff of a graph over a dashboard: absence-of-edge questions.
  { id: 'noPipeline', label: 'No Pipeline', accent: '#f43f5e',
    hint: 'Repositories with no BUILT_BY edge — untraceable to production',
    thresholds: { good: 0, warn: 1, bad: 3 },
    compute: ctx => (ctx.byType.get('Repository') ?? [])
      .filter(r => lacksEdge(ctx, r, 'BUILT_BY')).length },
  { id: 'unowned', label: 'Unowned', secondary: true, accent: '#fb923c',
    hint: 'Repositories with no OWNED_BY edge',
    compute: ctx => (ctx.byType.get('Repository') ?? [])
      .filter(r => lacksEdge(ctx, r, 'OWNED_BY')).length },
  { id: 'unsigned', label: 'Unsigned Artifacts', secondary: true, accent: '#f43f5e',
    compute: ctx => (ctx.byType.get('BuildArtifact') ?? [])
      .filter(a => (a as Record<string, unknown>).signed === false).length },
]

function sum(nodes: { [k: string]: unknown }[] | undefined, key: string): number {
  return (nodes ?? []).reduce((s, n) => s + (Number(n[key]) || 0), 0)
}

const detailSections: LensDetailSection[] = [
  {
    id: 'location', label: 'Code Location',
    forTypes: ['Repository', 'CodeFile', 'Module'],
    kind: { type: 'fields', fields: [
      { key: 'url', label: 'URL' },
      { key: 'path', label: 'Path', format: 'mono' },
      { key: 'packagePath', label: 'Package', format: 'mono' },
      { key: 'defaultBranch', label: 'Branch', format: 'mono' },
      { key: 'language', label: 'Language' },
      { key: 'lastCommit', label: 'Last commit', format: 'relative' },
    ] },
  },
  {
    id: 'quality', label: 'Quality',
    forTypes: ['CodeFile', 'Function', 'Class'],
    kind: { type: 'fields', fields: [
      { key: 'linesOfCode', label: 'Lines', format: 'number' },
      { key: 'complexity', label: 'Complexity', thresholds: { good: 10, warn: 15, bad: 20 } },
      { key: 'cyclomaticComplexity', label: 'Cyclomatic', thresholds: { good: 5, warn: 8, bad: 10 } },
      { key: 'testCoverage', label: 'Coverage', format: 'percent',
        thresholds: { direction: 'higher-is-better', good: 0.8, warn: 0.65, bad: 0.5 } },
      { key: 'hasTests', label: 'Has tests', format: 'bool' },
    ] },
  },
  {
    // The question a graph answers and a dashboard cannot: how does this code
    // reach production, and where does the trail break?
    id: 'cicd', label: 'CI/CD Trail',
    forTypes: ['Repository'],
    focusable: true,
    kind: { type: 'chain', steps: [
      { rel: 'BUILT_BY', dir: 'out' },
      { rel: 'PRODUCES', dir: 'out' },
      { rel: 'DEPLOYED_TO', dir: 'out' },
    ] },
  },
  {
    id: 'owners', label: 'Ownership',
    forTypes: ['Repository'],
    kind: { type: 'related', rels: ['OWNED_BY'], dir: 'out', types: ['Team', 'User'] },
  },
  {
    id: 'supply', label: 'Supply Chain',
    forTypes: ['Repository'],
    focusable: true,
    kind: { type: 'related', rels: ['DEPENDS_ON'], dir: 'out', types: ['Dependency'] },
  },
  {
    id: 'cves', label: 'Known Vulnerabilities',
    forTypes: ['Dependency'],
    kind: { type: 'related', rels: ['HAS_FINDING'], dir: 'in', types: ['Vulnerability'] },
  },
  {
    id: 'contents', label: 'Contains',
    forTypes: ['Repository', 'Module', 'CodeFile', 'Class'],
    focusable: true,
    kind: { type: 'related', rels: ['PART_OF', 'COMMITTED_TO'], dir: 'in' },
  },
]

export const gitLens: LensDefinition = {
  id: 'git',
  label: 'Git',
  sublabel: 'Code → Build → Deploy',
  Icon: FolderGit2,
  accent: '#f0564a',
  order: 1,
  nodeTypes,
  edgeTypes,
  lanes: LANES,
  layouts: [
    // Default. The Git story is a directed pipeline; dagre's rank assignment
    // encodes that causality where a force simulation destroys it.
    { id: 'dag', label: 'Flow', Icon: Workflow, slot: 'layout', chrome: CHROME,
      nodeCap: 400, fallbackLayout: 'lanes',
      params: { rankdir: 'LR', ranksep: 120, nodesep: 26 },
      hint: 'Repository → Module → File, and Repository → Pipeline → Artifact → Environment' },
    { id: 'lanes', label: 'Lanes', Icon: Rows3, slot: 'layout', chrome: CHROME,
      hint: 'Scan the portfolio by stage' },
    { id: 'force', label: 'Graph', Icon: Network, slot: 'layout',
      chrome: { ...CHROME, kpiBar: true },
      legendHints: ['✦ Click node to inspect', '✦ Space → fit to screen', '✦ Drag node to pin'],
      hint: 'Free-form exploration' },
  ],
  filters: [
    { id: 'type', label: 'Node Type', kind: 'nodeType',
      options: Object.entries(nodeTypes).map(([id, c]) => ({ id, label: c.label, color: c.color })) },
    // Scope filters: ownership is a position in the graph, not a property, so
    // these resolve by walking up to the nearest owning entity.
    ownerFilterGroup('team', 'Owning Team',
      { outRels: SCOPE_OUT, inRels: SCOPE_IN, types: ['Team', 'User'], maxHops: 6 },
      { unassignedLabel: 'Unowned' }),
    ownerFilterGroup('service', 'Service',
      { outRels: SCOPE_OUT, inRels: SCOPE_IN, types: ['Service'], maxHops: 5 },
      { unassignedLabel: 'No service' }),
    ownerFilterGroup('project', 'Project',
      { outRels: SCOPE_OUT, inRels: SCOPE_IN, types: ['Project'], maxHops: 6 }),
    { id: 'language', label: 'Language', kind: 'prop', propKey: 'language', defaultCollapsed: true },
    { id: 'visibility', label: 'Visibility', kind: 'prop', propKey: 'visibility', defaultCollapsed: true },
    { id: 'tool', label: 'CI Tool', kind: 'prop', propKey: 'tool', defaultCollapsed: true },
    { id: 'gaps', label: 'Gaps', kind: 'derived', defaultCollapsed: true, options: [
      { id: 'noPipeline', label: 'No pipeline',
        predicate: (n, ctx) => ctx.typeOf(n) === 'Repository' && lacksEdge(ctx, n, 'BUILT_BY') },
      { id: 'noOwner', label: 'No owner',
        predicate: (n, ctx) => ctx.typeOf(n) === 'Repository' && lacksEdge(ctx, n, 'OWNED_BY') },
      { id: 'stale', label: `Stale >${STALE_DAYS}d`,
        predicate: (n, ctx) => {
          if (ctx.typeOf(n) !== 'Repository') return false
          const d = daysSince((n as Record<string, unknown>).lastCommit)
          return d !== null && d > STALE_DAYS
        } },
      { id: 'vulnerable', label: 'Vulnerable dependency',
        predicate: (n, ctx) => ctx.typeOf(n) === 'Dependency'
          && ((n as Record<string, unknown>).hasKnownVulnerability === true
            || (ctx.in.get(n.id) ?? []).some(l => l.type === 'HAS_FINDING')) },
    ] },
    { id: 'source', label: 'Data Sources', kind: 'source', defaultCollapsed: true },
  ],
  kpis,
  detail: { sections: detailSections },
  legend: { nodeTypes: true, edgeTypes: true, presentOnly: true },
  emptyState: {
    title: 'No repositories in the graph yet',
    body: 'The Git lens is built from Repository, CodeFile and BuildPipeline nodes. '
        + 'Run the Git connector or load a repository to populate it.',
    cta: { label: 'Open Data Loader', to: '/ontology/data-loader' },
  },
}
