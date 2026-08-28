/**
 * Pure graph→lens transforms. No React, no rendering.
 */
import dagre from '@dagrejs/dagre'
import type { OntologyNode, OntologyLink } from '../../../api/ontologyUniverse'
import type { LensDataContext, LensDefinition, LensFilterGroup, NodeLabel, RelType } from './lensTypes'

/** Resolve a link endpoint to a node id.
 *
 *  force-graph rewrites link.source/target from a string id to the node object
 *  in place, so every consumer must tolerate both shapes. */
export function endpointId(e: string | OntologyNode | undefined): string {
  return typeof e === 'string' ? e : (e as OntologyNode | undefined)?.id ?? ''
}

/**
 * Case-insensitive label resolution.
 *
 * The wire sends PascalCase (neo4j_client sets node_type = labels[0]), but
 * OntologyGraph's own config is lowercase and OntologyFilters is mixed. Every
 * lens comparison funnels through here so the casing question is answered once.
 */
export function makeTypeResolver(known: Iterable<NodeLabel>) {
  const canonical = new Map<string, NodeLabel>()
  for (const label of known) canonical.set(label.toLowerCase(), label)
  return (n: OntologyNode): NodeLabel => {
    const raw = String((n as Record<string, unknown>).node_type ?? '')
    return canonical.get(raw.toLowerCase()) ?? raw
  }
}

/** Nodes whose label the lens includes. */
export function scopeGraphToLens(
  lens: LensDefinition,
  nodes: OntologyNode[],
  links: OntologyLink[],
  typeOf: (n: OntologyNode) => NodeLabel,
): { nodes: OntologyNode[]; links: OntologyLink[] } {
  if (lens.includeUnmappedNodeTypes) return { nodes, links }

  const keep = new Set(Object.keys(lens.nodeTypes))
  const scoped = nodes.filter(n => keep.has(typeOf(n)))
  const ids = new Set(scoped.map(n => n.id))
  const edgeTypes = lens.edgeTypes

  const scopedLinks = links.filter(l => {
    const s = endpointId(l.source), t = endpointId(l.target)
    if (!ids.has(s) || !ids.has(t)) return false      // never emit a dangling link
    const cfg = edgeTypes[l.type]
    // `excludeFromLayout` means "do not draw", not "do not know about": the
    // owner chip on a card and the unowned-repository KPI both need OWNED_BY
    // present in the context. Renderers drop these when building visual edges.
    if (!cfg) return false
    if (!cfg.between?.length) return true
    const byId = new Map(scoped.map(n => [n.id, n]))
    const a = byId.get(s), b = byId.get(t)
    if (!a || !b) return false
    const at = typeOf(a), bt = typeOf(b)
    return cfg.between.some(w =>
      (!w.from || w.from.includes(at)) && (!w.to || w.to.includes(bt)))
  })

  return { nodes: scoped, links: scopedLinks }
}

/** Build the per-(graph, lens) index consumed by KPIs, cards and traversal. */
export function buildLensContext(
  lens: LensDefinition,
  allNodes: OntologyNode[],
  allLinks: OntologyLink[],
): LensDataContext {
  const typeOf = makeTypeResolver(Object.keys(lens.nodeTypes))
  const { nodes, links } = scopeGraphToLens(lens, allNodes, allLinks, typeOf)

  const byId = new Map<string, OntologyNode>()
  const byType = new Map<NodeLabel, OntologyNode[]>()
  for (const n of nodes) {
    byId.set(n.id, n)
    const t = typeOf(n)
    const bucket = byType.get(t)
    if (bucket) bucket.push(n)
    else byType.set(t, [n])
  }

  const out = new Map<string, OntologyLink[]>()
  const inn = new Map<string, OntologyLink[]>()
  for (const l of links) {
    const s = endpointId(l.source), t = endpointId(l.target)
    const o = out.get(s); if (o) o.push(l); else out.set(s, [l])
    const i = inn.get(t); if (i) i.push(l); else inn.set(t, [l])
  }

  return { lens, nodes, links, allNodes, allLinks, byId, byType, out, in: inn, typeOf }
}

/**
 * Detach from force-graph's mutations.
 *
 * force-graph rewrites link.source/target in place and stamps x/y/vx/vy/fx/fy
 * onto nodes. Handing those objects to React Flow or dagre yields object-valued
 * endpoints and stale coordinates fighting the computed layout. Mandatory before
 * entering any non-canvas renderer.
 *
 * NOT used by the force renderer: OntologyGraph relies on shared node identity
 * to persist simulation positions across re-renders, so copying would reset the
 * layout on every render.
 */
export function normalizeForLayout(
  nodes: OntologyNode[],
  links: OntologyLink[],
): { nodes: OntologyNode[]; links: OntologyLink[] } {
  const clean = nodes.map(n => {
    const { x, y, vx, vy, fx, fy, ...rest } = n as Record<string, unknown>
    void x; void y; void vx; void vy; void fx; void fy
    return rest as unknown as OntologyNode
  })
  const ids = new Set(clean.map(n => n.id))
  const cleanLinks = links
    .map(l => ({ ...l, source: endpointId(l.source), target: endpointId(l.target) }))
    .filter(l => ids.has(l.source) && ids.has(l.target))
  return { nodes: clean, links: cleanLinks }
}

/** Count nodes per resolved label — used for filter-rail and legend counts. */
export function countByType(
  nodes: OntologyNode[],
  typeOf: (n: OntologyNode) => NodeLabel,
): Map<NodeLabel, number> {
  const counts = new Map<NodeLabel, number>()
  for (const n of nodes) {
    const t = typeOf(n)
    counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  return counts
}

// ── filters ──────────────────────────────────────────────────────────────────

export interface ResolvedFilterOption {
  id: string
  label: string
  color?: string
  count: number
}

export interface ResolvedFilterGroup {
  id: string
  label: string
  kind: LensFilterGroup['kind']
  options: ResolvedFilterOption[]
  defaultCollapsed?: boolean
}

/** Per-group active selections, keyed by filter-group id. */
export type ActiveFilters = Record<string, Set<string>>

export function hasAnyFilter(active: ActiveFilters): boolean {
  return Object.values(active).some(s => s.size > 0)
}

const sourceOf = (n: OntologyNode): string =>
  String((n as Record<string, unknown>).source ?? 'unknown')

/**
 * Resolve declared filter groups against the data: derive options where the
 * definition leaves them open, attach live counts, and drop options nothing
 * matches.
 *
 * Dropping empty options is the fix for the rail's long tail of dead entries —
 * the hand-maintained list carried nine ids in a legacy lowercase vocabulary
 * (`container`, `application`, `api_service`, …) that the backend stopped
 * emitting, so they rendered as a permanent row of zeroes.
 */
export function resolveFilterGroups(
  lens: LensDefinition,
  ctx: LensDataContext,
): ResolvedFilterGroup[] {
  const groups: ResolvedFilterGroup[] = []
  const typeCounts = countByType(ctx.nodes, ctx.typeOf)
  const claimed = new Set<string>()

  for (const g of lens.filters ?? []) {
    let options: ResolvedFilterOption[] = []

    if (g.kind === 'nodeType') {
      options = (g.options ?? []).map(o => {
        claimed.add(o.id.toLowerCase())
        return {
          id: o.id,
          label: o.label,
          color: o.color,
          count: countMatchingType(typeCounts, o.id),
        }
      })
    } else if (g.kind === 'source') {
      const counts = new Map<string, number>()
      for (const n of ctx.nodes) {
        const s = sourceOf(n)
        counts.set(s, (counts.get(s) ?? 0) + 1)
      }
      options = (g.options
        ? g.options.map(o => ({ id: o.id, label: o.label, color: o.color, count: counts.get(o.id) ?? 0 }))
        : [...counts.entries()].map(([id, count]) => ({ id, label: id, count })))
        .sort((a, b) => b.count - a.count)
    } else if (g.kind === 'prop' && g.propKey) {
      const counts = new Map<string, number>()
      for (const n of ctx.nodes) {
        const v = (n as Record<string, unknown>)[g.propKey]
        if (v === undefined || v === null || v === '') continue
        const k = String(v)
        counts.set(k, (counts.get(k) ?? 0) + 1)
      }
      options = [...counts.entries()]
        .map(([id, count]) => ({ id, label: id, count }))
        .sort((a, b) => b.count - a.count)
    } else if (g.kind === 'derived') {
      options = (g.optionsOf?.(ctx) ?? g.options ?? []).map(o => ({
        id: o.id,
        label: o.label,
        color: o.color,
        count: o.predicate ? ctx.nodes.filter(n => o.predicate!(n, ctx)).length : 0,
      }))
    }

    options = options.filter(o => o.count > 0)
    if (options.length) {
      groups.push({ id: g.id, label: g.label, kind: g.kind, options, defaultCollapsed: g.defaultCollapsed })
    }
  }

  // Anything present but undeclared still needs a way to be filtered, otherwise
  // new labels silently become unfilterable the moment ingestion adds them.
  const orphanTypes = [...typeCounts.entries()]
    .filter(([label]) => !claimed.has(label.toLowerCase()))
    .sort((a, b) => b[1] - a[1])
  if (orphanTypes.length) {
    groups.push({
      id: 'other',
      label: 'Other',
      kind: 'nodeType',
      defaultCollapsed: true,
      options: orphanTypes.map(([label, count]) => ({
        id: label.toLowerCase(),
        label,
        count,
      })),
    })
  }

  return groups
}

/** Type counts are keyed by resolved label; option ids may differ in case. */
function countMatchingType(counts: Map<NodeLabel, number>, optionId: string): number {
  const want = optionId.toLowerCase()
  let total = 0
  for (const [label, n] of counts) if (label.toLowerCase() === want) total += n
  return total
}

/**
 * Apply every filter group EXCEPT `nodeType`, preserving node object identity.
 *
 * Node-type selections are deliberately left to the canvas renderer: it matches
 * them itself and additionally keys its group-hub synthesis on "no type filter
 * active", which is load-bearing behaviour. `.filter()` keeps object identity,
 * so force-graph's simulation state survives.
 */
export function applyLensFilters(
  ctx: LensDataContext,
  active: ActiveFilters,
  groups: ResolvedFilterGroup[],
): OntologyNode[] {
  const byId = new Map(groups.map(g => [g.id, g]))
  const applicable = Object.entries(active).filter(([id, sel]) => {
    if (!sel.size) return false
    const g = byId.get(id)
    return !!g && g.kind !== 'nodeType'
  })
  if (!applicable.length) return ctx.nodes

  return ctx.nodes.filter(n =>
    applicable.every(([id, sel]) => {
      const g = byId.get(id)!
      if (g.kind === 'source') return sel.has(sourceOf(n))
      if (g.kind === 'prop') {
        const key = (ctx.lens.filters ?? []).find(f => f.id === id)?.propKey
        return !!key && sel.has(String((n as Record<string, unknown>)[key]))
      }
      if (g.kind === 'derived') {
        const def = (ctx.lens.filters ?? []).find(f => f.id === id)
        const defs = def?.optionsOf?.(ctx) ?? def?.options ?? []
        return defs.some(o => sel.has(o.id) && o.predicate?.(n, ctx))
      }
      return true
    }),
  )
}

/** Flatten node-type selections into the shape the canvas renderer expects. */
export function nodeTypeFilterSet(
  active: ActiveFilters,
  groups: ResolvedFilterGroup[],
): Set<string> {
  const out = new Set<string>()
  for (const g of groups) {
    if (g.kind !== 'nodeType') continue
    for (const id of active[g.id] ?? []) out.add(id)
  }
  return out
}

// ── layout ───────────────────────────────────────────────────────────────────

export interface DagNodeInput { id: string; width: number; height: number }
export interface DagEdgeInput { source: string; target: string; weight?: number }

export interface DagLayoutParams {
  rankdir?: 'LR' | 'TB' | 'RL' | 'BT'
  ranksep?: number
  nodesep?: number
  edgesep?: number
}

/**
 * Rank-assign a DAG with dagre. Returns top-left positions keyed by node id.
 *
 * Generalised from the old CodeFlowView's fixed 180×60 / rankdir:'LR' call (since
 * removed) so a lens can
 * choose its own direction and spacing (Git reads left-to-right as a pipeline;
 * Infra blast-radius reads bottom-to-top).
 */
export function layoutDag(
  nodes: DagNodeInput[],
  edges: DagEdgeInput[],
  params: DagLayoutParams = {},
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: params.rankdir ?? 'LR',
    ranksep: params.ranksep ?? 90,
    nodesep: params.nodesep ?? 40,
    edgesep: params.edgesep ?? 10,
  })
  for (const n of nodes) g.setNode(n.id, { width: n.width, height: n.height })
  const known = new Set(nodes.map(n => n.id))
  for (const e of edges) {
    // dagre invents a node for an unknown endpoint, which would render as a gap.
    if (known.has(e.source) && known.has(e.target)) {
      g.setEdge(e.source, e.target, { weight: e.weight ?? 1 })
    }
  }
  dagre.layout(g)

  const out = new Map<string, { x: number; y: number }>()
  for (const n of nodes) {
    const pos = g.node(n.id)
    // dagre reports centres; React Flow positions by top-left.
    if (pos) out.set(n.id, { x: pos.x - n.width / 2, y: pos.y - n.height / 2 })
  }
  return out
}

/**
 * Content signature for memoising an expensive layout.
 *
 * Deliberately excludes theme tokens. The superseded CodeFlowView keyed its memo on
 * `t.flowNodeBg`, so toggling dark/light recomputed every position and the nodes
 * jumped. It also used `nodes.length`, which is not identity — a filter change
 * that preserved the count kept a stale layout.
 */
export function layoutSignature(
  nodes: { id: string }[],
  links: OntologyLink[],
  extra: unknown = '',
): string {
  const n = nodes.map(x => x.id).join('|')
  const e = links.map(l => `${endpointId(l.source)}>${l.type}>${endpointId(l.target)}`).join('|')
  return `${n}#${e}#${JSON.stringify(extra)}`
}

/** Keep the highest-degree nodes when a layout caps how many it can draw. */
export function capByDegree(
  nodes: OntologyNode[],
  links: OntologyLink[],
  cap: number,
): OntologyNode[] {
  if (nodes.length <= cap) return nodes
  const degree = new Map<string, number>()
  for (const l of links) {
    const s = endpointId(l.source), t = endpointId(l.target)
    degree.set(s, (degree.get(s) ?? 0) + 1)
    degree.set(t, (degree.get(t) ?? 0) + 1)
  }
  return [...nodes]
    .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
    .slice(0, cap)
}

// ── traversal ────────────────────────────────────────────────────────────────

export interface TraversalStep {
  rel: RelType
  dir: 'out' | 'in'
  toType?: NodeLabel
}

/** Neighbours of `id` across `rels` in one direction. */
function step(
  ctx: LensDataContext,
  id: string,
  rels: RelType[] | undefined,
  dir: 'out' | 'in',
): OntologyNode[] {
  const links = (dir === 'out' ? ctx.out : ctx.in).get(id) ?? []
  const out: OntologyNode[] = []
  for (const l of links) {
    if (rels && !rels.includes(l.type)) continue
    const other = dir === 'out' ? endpointId(l.target) : endpointId(l.source)
    const node = ctx.byId.get(other)
    if (node) out.push(node)
  }
  return out
}

/**
 * Walk a fixed sequence of relationships from a node — "how does this code
 * reach production": BUILT_BY → PRODUCES → DEPLOYED_TO.
 *
 * Returns one entry per step so the UI can render a stepper and show where the
 * chain breaks; a missing link is the finding, not an error.
 */
export function chain(
  ctx: LensDataContext,
  start: OntologyNode,
  steps: TraversalStep[],
): { rel: RelType; nodes: OntologyNode[] }[] {
  let frontier = [start]
  const result: { rel: RelType; nodes: OntologyNode[] }[] = []
  for (const s of steps) {
    const next = new Map<string, OntologyNode>()
    for (const n of frontier) {
      for (const m of step(ctx, n.id, [s.rel], s.dir)) {
        if (s.toType && ctx.typeOf(m) !== s.toType) continue
        next.set(m.id, m)
      }
    }
    frontier = [...next.values()]
    result.push({ rel: s.rel, nodes: frontier })
    if (!frontier.length) break
  }
  return result
}

/**
 * Transitive reachable set, bounded by hop count.
 *
 * Blast radius depends on this being transitive: Service → Container → VM is a
 * chain in the real data, so a single-hop query would under-report impact.
 */
export function reachable(
  ctx: LensDataContext,
  start: OntologyNode,
  opts: { rels?: RelType[]; dir: 'out' | 'in' | 'both'; targetTypes?: NodeLabel[]; maxHops?: number },
): OntologyNode[] {
  const maxHops = opts.maxHops ?? 4
  const seen = new Set<string>([start.id])
  const hits = new Map<string, OntologyNode>()
  let frontier = [start]

  for (let hop = 0; hop < maxHops && frontier.length; hop++) {
    const next: OntologyNode[] = []
    for (const n of frontier) {
      const neighbours = opts.dir === 'both'
        ? [...step(ctx, n.id, opts.rels, 'out'), ...step(ctx, n.id, opts.rels, 'in')]
        : step(ctx, n.id, opts.rels, opts.dir)
      for (const m of neighbours) {
        if (seen.has(m.id)) continue
        seen.add(m.id)
        next.push(m)
        if (!opts.targetTypes || opts.targetTypes.includes(ctx.typeOf(m))) hits.set(m.id, m)
      }
    }
    frontier = next
  }
  return [...hits.values()]
}

/**
 * Two-phase reachability: one relationship set for the first hop, another for
 * the rest.
 *
 * Blast radius needs exactly this. Containment upward *is* dependency for an
 * infrastructure parent — kill a cluster and its containers die — but keep
 * walking containment and you reach siblings through the shared parent, so a
 * database would claim to impact every unrelated workload in its cluster.
 * Taking containment on the seed hop only, then dependency edges afterwards,
 * gives "children, and whatever depends on them" without the sibling leak.
 */
export function reachableLayered(
  ctx: LensDataContext,
  start: OntologyNode,
  opts: {
    seedRels: RelType[]
    rels: RelType[]
    dir: 'out' | 'in' | 'both'
    targetTypes?: NodeLabel[]
    maxHops?: number
  },
): OntologyNode[] {
  const maxHops = opts.maxHops ?? 5
  const seen = new Set<string>([start.id])
  const hits = new Map<string, OntologyNode>()
  let frontier = [start]

  for (let hop = 0; hop < maxHops && frontier.length; hop++) {
    const rels = hop === 0 ? [...opts.seedRels, ...opts.rels] : opts.rels
    const next: OntologyNode[] = []
    for (const n of frontier) {
      const neighbours = opts.dir === 'both'
        ? [...step(ctx, n.id, rels, 'out'), ...step(ctx, n.id, rels, 'in')]
        : step(ctx, n.id, rels, opts.dir)
      for (const m of neighbours) {
        if (seen.has(m.id)) continue
        seen.add(m.id)
        next.push(m)
        if (!opts.targetTypes || opts.targetTypes.includes(ctx.typeOf(m))) hits.set(m.id, m)
      }
    }
    frontier = next
  }
  return [...hits.values()]
}

/** Direct neighbours, optionally filtered by relationship and target label. */
export function neighbours(
  ctx: LensDataContext,
  node: OntologyNode,
  opts: { rels?: RelType[]; dir: 'out' | 'in' | 'both'; types?: NodeLabel[] } = { dir: 'both' },
): OntologyNode[] {
  const raw = opts.dir === 'both'
    ? [...step(ctx, node.id, opts.rels, 'out'), ...step(ctx, node.id, opts.rels, 'in')]
    : step(ctx, node.id, opts.rels, opts.dir)
  const seen = new Set<string>()
  return raw.filter(n => {
    if (seen.has(n.id)) return false
    seen.add(n.id)
    return !opts.types || opts.types.includes(ctx.typeOf(n))
  })
}

/** True when the node has no edge of the given type — absence-of-edge findings. */
export function lacksEdge(
  ctx: LensDataContext,
  node: OntologyNode,
  rel: RelType,
  dir: 'out' | 'in' = 'out',
): boolean {
  const links = (dir === 'out' ? ctx.out : ctx.in).get(node.id) ?? []
  return !links.some(l => l.type === rel)
}

// ── ownership scoping ────────────────────────────────────────────────────────

export interface ScopeSpec {
  /**
   * Followed outbound — containment and ownership, which point child→parent
   * (CodeFile -PART_OF-> Module -PART_OF-> Repository -OWNED_BY-> Team).
   */
  outRels: RelType[]
  /**
   * Followed inbound — production edges, which point parent→child
   * (Repository -BUILT_BY-> Pipeline -PRODUCES-> Artifact). Without these an
   * artifact has no route back to the repository that owns it.
   *
   * Deliberately narrow: DEPLOYED_TO and DEPENDS_ON are excluded because
   * environments and third-party dependencies are shared across owners, and
   * assigning them one owner would be arbitrary. They stay unassigned, which is
   * the truthful answer.
   */
  inRels?: RelType[]
  /** Labels that terminate the walk — the owner we are looking for. */
  types: NodeLabel[]
  maxHops?: number
}

/**
 * Per-(ctx, spec) memo. A scope predicate runs once per node per filter option,
 * so an uncached traversal would be O(nodes x options x degree) on every render.
 */
const scopeCache = new WeakMap<LensDataContext, Map<string, Map<string, string | null>>>()

/**
 * Nearest owning entity of a node — the Team, Service or Project it rolls up to.
 *
 * This is the mirror of the Infra lens's environment resolution: ownership is a
 * position in the graph, not a property, so "everything owned by team X" needs a
 * traversal rather than a field match. reachable() emits hits in BFS order, so
 * the first is the nearest.
 */
export function scopeOwnerOf(
  ctx: LensDataContext,
  node: OntologyNode,
  spec: ScopeSpec,
  cacheKey: string,
): string | null {
  let perCtx = scopeCache.get(ctx)
  if (!perCtx) { perCtx = new Map(); scopeCache.set(ctx, perCtx) }
  let perSpec = perCtx.get(cacheKey)
  if (!perSpec) { perSpec = new Map(); perCtx.set(cacheKey, perSpec) }

  const hit = perSpec.get(node.id)
  if (hit !== undefined) return hit

  // A node that IS the owner scopes to itself.
  const own = spec.types.includes(ctx.typeOf(node))
    ? String(node.label ?? node.id)
    : findOwner(ctx, node, spec)

  perSpec.set(node.id, own)
  return own
}

/** BFS following outRels forwards and inRels backwards, nearest owner wins. */
function findOwner(ctx: LensDataContext, start: OntologyNode, spec: ScopeSpec): string | null {
  const maxHops = spec.maxHops ?? 4
  const seen = new Set<string>([start.id])
  let frontier = [start]

  for (let hop = 0; hop < maxHops && frontier.length; hop++) {
    const next: OntologyNode[] = []
    for (const n of frontier) {
      const candidates = [
        ...step(ctx, n.id, spec.outRels, 'out'),
        ...(spec.inRels?.length ? step(ctx, n.id, spec.inRels, 'in') : []),
      ]
      for (const m of candidates) {
        if (seen.has(m.id)) continue
        seen.add(m.id)
        if (spec.types.includes(ctx.typeOf(m))) return String(m.label ?? m.id)
        next.push(m)
      }
    }
    frontier = next
  }
  return null
}

/**
 * Build a filter group that scopes the lens to an owning entity.
 *
 * Options are derived from the data, so a lens gains "filter by team" without
 * anyone maintaining a list of teams.
 */
export function ownerFilterGroup(
  id: string,
  label: string,
  spec: ScopeSpec,
  opts: { defaultCollapsed?: boolean; unassignedLabel?: string } = {},
): LensFilterGroup {
  return {
    id,
    label,
    kind: 'derived',
    defaultCollapsed: opts.defaultCollapsed ?? true,
    optionsOf: (ctx) => {
      const counts = new Map<string, number>()
      let unassigned = 0
      for (const n of ctx.nodes) {
        const owner = scopeOwnerOf(ctx, n, spec, id)
        if (owner) counts.set(owner, (counts.get(owner) ?? 0) + 1)
        else unassigned++
      }
      const options = [...counts.keys()].sort().map(key => ({
        id: key,
        label: key,
        predicate: (n: OntologyNode, c: LensDataContext) => scopeOwnerOf(c, n, spec, id) === key,
      }))
      if (unassigned && opts.unassignedLabel) {
        options.push({
          id: '__unassigned__',
          label: opts.unassignedLabel,
          predicate: (n: OntologyNode, c: LensDataContext) => scopeOwnerOf(c, n, spec, id) === null,
        })
      }
      return options
    },
  }
}

/**
 * Match a node against the search box.
 *
 * The renderers previously matched `label` alone, so searching an externalId, a
 * type name, or a distinguishing property (a language, an image tag, a region)
 * found nothing even though the value was on screen.
 */
export function matchesSearch(
  node: OntologyNode,
  term: string,
  typeOf?: (n: OntologyNode) => NodeLabel,
): boolean {
  if (!term) return true
  const q = term.toLowerCase()
  const p = node as unknown as Record<string, unknown>
  if (String(node.label ?? '').toLowerCase().includes(q)) return true
  if (String(p.externalId ?? '').toLowerCase().includes(q)) return true
  if (String(typeOf ? typeOf(node) : p.node_type ?? '').toLowerCase().includes(q)) return true
  for (const key of SEARCHABLE_PROPS) {
    const v = p[key]
    if (v !== undefined && v !== null && String(v).toLowerCase().includes(q)) return true
  }
  return false
}

/** Identifying properties worth searching — not every prop, to avoid matching
 *  a stray number in an unrelated metric. */
const SEARCHABLE_PROPS = [
  'name', 'description', 'path', 'packagePath', 'url', 'language', 'visibility',
  'tool', 'image', 'resourceType', 'provider', 'region', 'environment', 'engine',
  'instanceType', 'cidr', 'hostname', 'ipAddress', 'privateIp', 'namespace',
  'severity', 'status', 'defaultBranch', 'registry', 'version',
]
