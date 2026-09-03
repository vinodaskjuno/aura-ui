/**
 * Derives legend entries from the active lens and the data, then hands them to
 * the presentational OntologyLegend.
 *
 * With `legend.presentOnly` the lists reflect what is actually on screen. The
 * previous hardcoded arrays had drifted: 17 node rows that no longer matched the
 * emitted labels, and relationship rows for MANAGED_BY / HOSTED_IN /
 * IS_SAME_AS / CORRELATES_WITH — three of which are not in the canonical schema
 * at all.
 */
import { useMemo } from 'react'
import OntologyLegend, { type LegendEdgeEntry, type LegendNodeEntry } from '../OntologyLegend'
import { countByType } from './lensSelectors'
import { hashColor } from './lensFormat'
import { overlayLegend } from '../../provenance/overlayPalette'
import { useProvenanceOverlayStore } from '../../../store/provenanceOverlayStore'
import { useGraphTheme } from '../../../hooks/useGraphTheme'
import type { LensDataContext, LensDefinition, LensLayoutOption } from './lensTypes'

interface Props {
  lens: LensDefinition
  layout: LensLayoutOption
  ctx: LensDataContext
  isPresentationMode: boolean
  topOffset?: number
}

const MAX_NODE_ROWS = 24
const MAX_EDGE_ROWS = 14

export default function LensLegend({ lens, layout, ctx, isPresentationMode, topOffset }: Props) {
  const overlayMode = useProvenanceOverlayStore(s => s.mode)
  const gt = useGraphTheme()

  const nodeEntries = useMemo<LegendNodeEntry[]>(() => {
    // With an overlay on, the type palette is not what is on screen. A legend that
    // keeps describing types while the graph is coloured by source is worse than
    // no legend — it actively teaches the wrong mapping.
    if (overlayMode !== 'type') {
      const counts = countByType(ctx.nodes, ctx.typeOf)
      const total = [...counts.values()].reduce((a, b) => a + b, 0)
      return overlayLegend(overlayMode, gt.isDark).map(entry => ({
        label: entry.label,
        color: entry.color,
        count: entry.key === 'unattributed'
          ? ctx.nodes.filter(n => {
              const a = (n as unknown as Record<string, unknown>).attribution
              return !a || a === 'none' || a === 'pre-trace'
            }).length
          : undefined,
      })).filter(() => total > 0)
    }
    const counts = countByType(ctx.nodes, ctx.typeOf)
    const rows: LegendNodeEntry[] = []
    for (const [label, count] of counts) {
      const cfg = lens.nodeTypes[label] ?? lens.nodeTypes[label.toLowerCase()]
      if (!cfg && !lens.includeUnmappedNodeTypes) continue
      rows.push({
        label: cfg?.label ?? label,
        color: cfg?.color ?? hashColor(label.toLowerCase()),
        glow: cfg?.glow,
        count,
      })
    }
    return rows.sort((a, b) => (b.count ?? 0) - (a.count ?? 0)).slice(0, MAX_NODE_ROWS)
  }, [ctx, lens, overlayMode, gt.isDark])

  const edgeEntries = useMemo<LegendEdgeEntry[]>(() => {
    const counts = new Map<string, number>()
    for (const l of ctx.links) counts.set(l.type, (counts.get(l.type) ?? 0) + 1)
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_EDGE_ROWS)
      .map(([type]) => ({
        label: type,
        // The canvas tints an edge with its SOURCE node's colour, so there is no
        // true per-relationship colour to show for the ontology lens; a stable
        // hash keeps rows distinguishable. Git/Infra declare real edge palettes.
        color: lens.edgeTypes[type]?.color ?? hashColor(type),
      }))
  }, [ctx, lens])

  return (
    <OntologyLegend
      isPresentationMode={isPresentationMode}
      nodeEntries={nodeEntries}
      edgeEntries={edgeEntries}
      hints={layout.legendHints}
      topOffset={topOffset}
    />
  )
}
