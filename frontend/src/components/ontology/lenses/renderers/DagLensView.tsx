/**
 * Generic DAG renderer — @xyflow/react + dagre, driven by lens config.
 *
 * Replaces the superseded CodeFlowView: the dagre call, the node card, the
 * icon and colour maps and the filter bar were all hardcoded there; here they
 * come from the LensDefinition, so Git and Infra share one implementation.
 *
 * Right for flow-shaped data (Repository → Pipeline → Artifact → Environment),
 * where rank assignment encodes causality that a force simulation destroys.
 */
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react'
import {
  Background, Controls, MiniMap, Panel, ReactFlow, ReactFlowProvider,
  Handle, Position, useReactFlow,
  type Edge, type Node, type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useGraphTheme } from '../../../../hooks/useGraphTheme'
import {
  capByDegree, endpointId, layoutDag, layoutSignature, matchesSearch,
  normalizeForLayout, reachable, reachableLayered,
  type DagLayoutParams,
} from '../lensSelectors'
import { hashColor } from '../lensFormat'
import LensNodeCard from './cards/LensNodeCard'
import type { LensViewProps, LensViewRef } from '../lensTypes'
import type { OntologyNode } from '../../../../api/ontologyUniverse'

const DEFAULT_CARD = { w: 190, h: 78 }

/** Blast-radius configuration, carried on the layout's `params.focus`. */
interface FocusParams {
  rels?: string[]
  /** Applied on the first hop only — see reachableLayered. */
  seedRels?: string[]
  dir: 'out' | 'in' | 'both'
  maxHops?: number
}

/** React Flow node payload. Kept flat so the card stays presentational. */
type CardData = Record<string, unknown>

function FlowCard({ data }: { data: CardData }) {
  const t = useGraphTheme()
  const handle = { background: t.flowEdgeColor, width: 7, height: 7, border: 'none' }
  return (
    <>
      <Handle type="target" position={data.targetPos as Position} style={handle} />
      <LensNodeCard
        node={data.node as OntologyNode}
        type={data.type as string}
        cfg={data.cfg as never}
        selected={!!data.selected}
        highlighted={!!data.highlighted}
        alertColor={data.alertColor as string | null}
        width={(data.width as number) ?? DEFAULT_CARD.w}
      />
      <Handle type="source" position={data.sourcePos as Position} style={handle} />
    </>
  )
}

const nodeTypes: NodeTypes = { lensCard: FlowCard as NodeTypes['lensCard'] }

function DagInner(props: LensViewProps, ref: React.Ref<LensViewRef>) {
  const {
    lens, layout, nodes, links, ctx, searchTerm,
    selectedNode, highlightedNodeIds, onNodeClick,
  } = props
  const t = useGraphTheme()
  const flow = useReactFlow()

  useImperativeHandle(ref, () => ({
    zoomIn: () => flow.zoomIn({ duration: 200 }),
    zoomOut: () => flow.zoomOut({ duration: 200 }),
    zoomToFit: (ms = 400, pad = 60) =>
      flow.fitView({ duration: ms, padding: pad / 400 }),
  }), [flow])

  // Stabilised: `layout.params ?? {}` allocates a fresh object each render when
  // a layout omits params, which would rebuild the O(n) layout signature every
  // time. `layout` itself is a frozen registry constant.
  const params = useMemo(() => (layout.params ?? {}) as DagLayoutParams, [layout])
  const cap = layout.nodeCap ?? 400

  // Detach from force-graph's in-place mutations before dagre sees anything:
  // it rewrites link.source/target to node objects and stamps x/y onto nodes.
  const clean = useMemo(() => normalizeForLayout(nodes, links), [nodes, links])

  // Focus mode (blast radius): restrict to what is transitively reachable from
  // the selected node. Reachability must be transitive — Service → Container →
  // VM is a chain in the real data, so a one-hop query under-reports impact.
  const focus = (params as { focus?: FocusParams }).focus
  const focusRoot = focus && selectedNode ? selectedNode : null

  const visible = useMemo(() => {
    let ns = clean.nodes
    if (focusRoot && focus) {
      const hit = focus.seedRels
        ? reachableLayered(ctx, focusRoot, {
            seedRels: focus.seedRels, rels: focus.rels ?? [],
            dir: focus.dir, maxHops: focus.maxHops ?? 5 })
        : reachable(ctx, focusRoot, {
            rels: focus.rels, dir: focus.dir, maxHops: focus.maxHops ?? 5 })
      const keep = new Set([focusRoot.id, ...hit.map(n => n.id)])
      ns = ns.filter(n => keep.has(n.id))
    }
    if (searchTerm) ns = ns.filter(n => matchesSearch(n, searchTerm, ctx.typeOf))
    return capByDegree(ns, clean.links, cap)
  }, [clean, searchTerm, cap, focusRoot, focus, ctx])

  const truncated = visible.length < clean.nodes.length && !focusRoot

  const edges = useMemo(() => {
    const ids = new Set(visible.map(n => n.id))
    return clean.links.filter(l =>
      // Present in the context (KPIs, cards) but deliberately not drawn — e.g.
      // OWNED_BY would fan every repository into the same few teams and bury
      // the pipeline it is meant to show.
      !lens.edgeTypes[l.type]?.excludeFromLayout
      && ids.has(endpointId(l.source)) && ids.has(endpointId(l.target)))
  }, [clean.links, visible, lens])

  // Signature, not length: a filter change that preserves the count must still
  // relayout, and a theme toggle must NOT.
  const sig = useMemo(
    () => layoutSignature(visible, edges, params),
    [visible, edges, params],
  )

  const positioned = useMemo(() => {
    const sized = visible.map(n => {
      const cfg = lens.nodeTypes[ctx.typeOf(n)]
      return {
        id: n.id,
        width: cfg?.cardSize?.w ?? DEFAULT_CARD.w,
        height: cfg?.cardSize?.h ?? DEFAULT_CARD.h,
      }
    })
    return layoutDag(
      sized,
      edges.map(l => ({
        source: endpointId(l.source),
        target: endpointId(l.target),
        weight: lens.edgeTypes[l.type]?.weight ?? 1,
      })),
      params,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])

  const horizontal = (params.rankdir ?? 'LR') === 'LR' || params.rankdir === 'RL'

  const flowNodes: Node[] = useMemo(() => visible.map(n => {
    const type = ctx.typeOf(n)
    const cfg = lens.nodeTypes[type]
    return {
      id: n.id,
      type: 'lensCard',
      position: positioned.get(n.id) ?? { x: 0, y: 0 },
      data: {
        node: n, type, cfg,
        selected: selectedNode?.id === n.id,
        highlighted: highlightedNodeIds.has(n.id),
        alertColor: null,
        width: cfg?.cardSize?.w ?? DEFAULT_CARD.w,
        sourcePos: horizontal ? Position.Right : Position.Bottom,
        targetPos: horizontal ? Position.Left : Position.Top,
      } satisfies CardData,
    }
  }), [visible, positioned, ctx, lens, selectedNode, highlightedNodeIds, horizontal])

  const flowEdges: Edge[] = useMemo(() => edges.map(l => {
    const cfg = lens.edgeTypes[l.type]
    const color = cfg?.color ?? hashColor(l.type)
    const a = endpointId(l.source), b = endpointId(l.target)
    // `reverse` records that the stored direction is the inverse of the story
    // the layout tells (PART_OF points child→parent; the view reads parent→child).
    const [source, target] = cfg?.reverse ? [b, a] : [a, b]
    return {
      id: l.id ?? `${a}-${l.type}-${b}`,
      source, target,
      label: cfg?.label ?? l.type,
      type: 'smoothstep',
      animated: !!cfg?.animated,
      style: { stroke: color, strokeWidth: 1.4, strokeDasharray: cfg?.dashed ? '4 3' : undefined },
      labelStyle: { fill: t.flowEdgeLabelText, fontSize: 8, fontWeight: 600 },
      labelBgStyle: { fill: t.flowEdgeLabelBg },
      labelBgPadding: [3, 1] as [number, number],
    }
  }), [edges, lens, t])

  const handleClick = useCallback((_: unknown, n: Node) => {
    const orig = nodes.find(x => x.id === n.id)
    if (orig) onNodeClick(orig)
  }, [nodes, onNodeClick])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodeClick={handleClick}
        onPaneClick={() => onNodeClick(null)}
        fitView
        minZoom={0.05}
        proOptions={{ hideAttribution: true }}
        style={{ background: t.graphBg }}
      >
        <Background color={t.panelBorder} gap={22} />
        <Controls style={{ background: t.panelBg, border: `1px solid ${t.panelBorder}` }} showInteractive={false} />
        <MiniMap
          pannable zoomable
          style={{ background: t.panelBg, border: `1px solid ${t.panelBorder}` }}
          nodeColor={(n) => {
            const cfg = lens.nodeTypes[(n.data as CardData).type as string]
            return cfg?.color ?? t.flowNodeBorder
          }}
        />
        {truncated && (
          <Panel position="top-center">
            <div style={{
              padding: '5px 12px', borderRadius: 999,
              background: 'rgba(245,158,11,0.16)',
              border: '1px solid rgba(245,158,11,0.5)',
              color: '#fbbf24', fontSize: 10, fontWeight: 700,
            }}>
              Showing {visible.length} of {clean.nodes.length} — highest-connected first
            </div>
          </Panel>
        )}
        {focus && !focusRoot && (
          <Panel position="top-center">
            <div style={{
              padding: '8px 16px', borderRadius: 8,
              background: t.panelBg, border: `1px solid ${t.panelBorder}`,
              color: t.panelSubtext, fontSize: 12, textAlign: 'center',
            }}>
              Select a resource to trace what depends on it.
            </div>
          </Panel>
        )}
        {focusRoot && (
          <Panel position="top-center">
            <div style={{
              padding: '5px 12px', borderRadius: 999,
              background: `${lens.accent}22`, border: `1px solid ${lens.accent}66`,
              color: lens.accent, fontSize: 10, fontWeight: 700,
            }}>
              Blast radius of {focusRoot.label} — {visible.length - 1} dependent{visible.length === 2 ? '' : 's'}
            </div>
          </Panel>
        )}
        {!visible.length && !focus && (
          <Panel position="top-center">
            <div style={{
              padding: '10px 20px', background: t.panelBg,
              border: `1px solid ${t.panelBorder}`, borderRadius: 8,
              color: t.panelSubtext, fontSize: 13, maxWidth: 380, textAlign: 'center',
            }}>
              <div style={{ fontWeight: 700, color: t.panelText, marginBottom: 4 }}>
                {lens.emptyState?.title ?? 'Nothing to draw'}
              </div>
              {lens.emptyState?.body ?? 'No nodes match this lens and its filters.'}
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  )
}

const Inner = forwardRef<LensViewRef, LensViewProps>(DagInner)

/** ReactFlowProvider is required for useReactFlow() to drive the zoom controls. */
const DagLensView = forwardRef<LensViewRef, LensViewProps>(function DagLensView(props, ref) {
  const holder = useRef<LensViewRef>(null)
  useImperativeHandle(ref, () => ({
    zoomIn: () => holder.current?.zoomIn(),
    zoomOut: () => holder.current?.zoomOut(),
    zoomToFit: (ms, pad) => holder.current?.zoomToFit(ms, pad),
  }), [])
  return (
    <ReactFlowProvider>
      <Inner ref={holder} {...props} />
    </ReactFlowProvider>
  )
})

export default DagLensView
