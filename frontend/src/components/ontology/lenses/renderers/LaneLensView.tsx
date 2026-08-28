/**
 * Generic swimlane renderer — optional outer grouping × inner lanes.
 *
 * Replaces the superseded AppInfraView, which hardcoded six tier labels, an
 * emoji icon map and two filter selects that matched nothing (`environment` is
 * only ever a property of Configuration, and `severity` only of SecurityFinding,
 * so those selects could never filter an infra node).
 *
 * Right for containment-shaped data — environment ⊃ network ⊃ cluster ⊃ host ⊃
 * workload — which dagre would draw as long thin chains and force-graph cannot
 * group at all. Adding the outer grouping is what turns it into a matrix that
 * reads as an inventory and a topology at once.
 */
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useGraphTheme } from '../../../../hooks/useGraphTheme'
import LensNodeCard from './cards/LensNodeCard'
import { matchesSearch, normalizeForLayout } from '../lensSelectors'
import type { LensViewProps, LensViewRef } from '../lensTypes'
import type { OntologyNode } from '../../../../api/ontologyUniverse'

const UNASSIGNED = '__unassigned__'

const LaneLensView = forwardRef<LensViewRef, LensViewProps>(function LaneLensView(props, ref) {
  const {
    lens, grouping, ctx, nodes, links, searchTerm,
    selectedNode, highlightedNodeIds, onNodeClick, onNodeHover,
  } = props
  const t = useGraphTheme()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [hovered, setHovered] = useState<string | null>(null)

  // No pan/zoom transform of its own — the surface scrolls — so the shared zoom
  // controls drive a CSS scale and "fit" resets it.
  useImperativeHandle(ref, () => ({
    zoomIn: () => setZoom(z => Math.min(1.6, z + 0.1)),
    zoomOut: () => setZoom(z => Math.max(0.5, z - 0.1)),
    zoomToFit: () => { setZoom(1); scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }) },
  }), [])

  const clean = useMemo(() => normalizeForLayout(nodes, links), [nodes, links])

  const visible = useMemo(
    () => (searchTerm ? clean.nodes.filter(n => matchesSearch(n, searchTerm, ctx.typeOf)) : clean.nodes),
    [clean.nodes, searchTerm, ctx],
  )

  const lanes = useMemo(
    () => [...(lens.lanes ?? [])].sort((a, b) => a.order - b.order),
    [lens.lanes],
  )

  /** group key → lane id → nodes */
  const matrix = useMemo(() => {
    const m = new Map<string, Map<string, OntologyNode[]>>()
    const laneIds = new Set(lanes.map(l => l.id))
    for (const n of visible) {
      const gk = grouping ? (grouping.keyOf(n, ctx) ?? UNASSIGNED) : UNASSIGNED
      const type = ctx.typeOf(n)
      const laneId = lens.laneOf?.(n, ctx) ?? lens.nodeTypes[type]?.lane
      if (!laneId || !laneIds.has(laneId)) continue
      let byLane = m.get(gk)
      if (!byLane) { byLane = new Map(); m.set(gk, byLane) }
      const bucket = byLane.get(laneId)
      if (bucket) bucket.push(n)
      else byLane.set(laneId, [n])
    }
    return m
  }, [visible, grouping, ctx, lens, lanes])

  const groupKeys = useMemo(() => {
    const keys = [...matrix.keys()]
    // Unassigned always sorts last — it is a data-quality signal, not a peer.
    return keys.sort((a, b) =>
      a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : a.localeCompare(b))
  }, [matrix])

  const total = visible.length

  if (!total) {
    return (
      <div style={{
        position: 'absolute', inset: 0, background: t.graphBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40,
      }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ color: t.panelText, fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
            {lens.emptyState?.title ?? 'Nothing to show'}
          </div>
          <div style={{ color: t.panelSubtext, fontSize: 13, lineHeight: 1.6 }}>
            {lens.emptyState?.body ?? 'No nodes match this lens and its filters.'}
          </div>
        </div>
      </div>
    )
  }

  const renderCard = (n: OntologyNode) => {
    const type = ctx.typeOf(n)
    return (
      <div
        key={n.id}
        onClick={() => onNodeClick(n)}
        onMouseEnter={() => { setHovered(n.id); onNodeHover(n) }}
        onMouseLeave={() => { setHovered(null); onNodeHover(null) }}
        style={{ cursor: 'pointer' }}
      >
        <LensNodeCard
          node={n}
          type={type}
          cfg={lens.nodeTypes[type]}
          selected={selectedNode?.id === n.id}
          hovered={hovered === n.id}
          highlighted={highlightedNodeIds.has(n.id)}
          width={lens.nodeTypes[type]?.cardSize?.w ?? 178}
        />
      </div>
    )
  }

  const columns = grouping ? groupKeys : [UNASSIGNED]

  return (
    <div
      ref={scrollRef}
      style={{ position: 'absolute', inset: 0, background: t.graphBg, overflow: 'auto', padding: 20 }}
    >
      <div style={{
        display: 'flex', gap: 14, alignItems: 'flex-start',
        transform: `scale(${zoom})`, transformOrigin: 'top left',
        transition: 'transform 0.15s',
      }}>
        {columns.map(gk => {
          const byLane = matrix.get(gk) ?? new Map<string, OntologyNode[]>()
          const count = [...byLane.values()].reduce((s, a) => s + a.length, 0)
          if (!count) return null
          const isUnassigned = gk === UNASSIGNED
          const title = !grouping
            ? null
            : isUnassigned ? 'Unassigned' : (grouping.labelOf?.(gk, ctx) ?? gk)

          return (
            <div key={gk} style={{
              flex: grouping ? '0 0 auto' : 1, minWidth: grouping ? 260 : undefined,
              background: t.flowLaneBg,
              border: `1px solid ${isUnassigned ? 'rgba(245,158,11,0.4)' : t.flowLaneBorder}`,
              borderRadius: 12, padding: 12,
            }}>
              {title && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 800, color: isUnassigned ? '#fbbf24' : t.panelText,
                    letterSpacing: '0.04em',
                  }}>{title}</div>
                  <div style={{ fontSize: 9, color: t.panelSubtext, marginTop: 1 }}>
                    {count} {count === 1 ? 'resource' : 'resources'}
                    {isUnassigned && ' · could not be placed'}
                  </div>
                </div>
              )}

              {lanes.map(lane => {
                const laneNodes = byLane.get(lane.id)
                if (!laneNodes?.length) return null
                return (
                  <div key={lane.id} style={{ marginBottom: 12 }}>
                    <div style={{
                      fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.1em', color: lane.color ?? t.sectionLabel,
                      marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      {lane.label}
                      <span style={{ color: t.mutedText, fontWeight: 600 }}>{laneNodes.length}</span>
                      <div style={{ flex: 1, height: 1, background: t.divider }} />
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {laneNodes.map(renderCard)}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
})

export default LaneLensView
