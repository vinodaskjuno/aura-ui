import {
  FRESHNESS_COLOR, freshnessOf, isUnattributed, pipelineColor, pipelineMeta,
  triggerMeta,
} from './pipelineMeta'

/**
 * Recolour the graph by where its data came from, how fresh it is, or how much we
 * trust it — across every Onto Verse view.
 *
 * `Type` stays the default. The overlay is a lens on the same graph, never a mode
 * you can get stuck in, and the type palette is what people have learned.
 *
 * ── Why an ambient setting rather than a prop ───────────────────────────────
 * Colour is resolved inside canvas paint callbacks — `nodeColor` in
 * OntologyGraph.tsx and its equivalents in four other renderers — which are
 * module-level pure functions called per frame. Threading a mode parameter through
 * them would mean changing every signature and every call site in five files, and
 * missing one would produce a graph where half the nodes honour the overlay and
 * half do not. The store below is the single source of truth; this module mirrors
 * it into a module-level value that the paint path can read without a hook.
 *
 * Same shape as the backend's provenance ContextVar, for the same reason: the
 * value is ambient to a deep call tree that has no other reason to know about it.
 */

export type OverlayMode = 'type' | 'source' | 'freshness' | 'trigger' | 'trust'

export const OVERLAY_MODES: { id: OverlayMode; label: string; hint: string }[] = [
  { id: 'type',      label: 'Type',      hint: 'Colour by what the entity is' },
  { id: 'source',    label: 'Source',    hint: 'Colour by the pipeline that wrote it' },
  { id: 'freshness', label: 'Freshness', hint: 'Colour by how recently it was seen' },
  { id: 'trigger',   label: 'Trigger',   hint: 'Manual, scheduled or automatic' },
  { id: 'trust',     label: 'Trust',     hint: 'Colour by confidence; inferred edges dashed' },
]

interface OverlayContext {
  mode: OverlayMode
  isDark: boolean
}

let context: OverlayContext = { mode: 'type', isDark: true }

export function setOverlayContext(next: Partial<OverlayContext>): void {
  context = { ...context, ...next }
}

export function getOverlayMode(): OverlayMode {
  return context.mode
}

const TRIGGER_HUE: Record<string, { dark: string; light: string }> = {
  manual:    { dark: '#60a5fa', light: '#1d4ed8' },
  scheduled: { dark: '#a78bfa', light: '#6d28d9' },
  automatic: { dark: '#2dd4bf', light: '#0f766e' },
  system:    { dark: '#94a3b8', light: '#475569' },
  unknown:   { dark: '#64748b', light: '#94a3b8' },
}

function trustColor(confidence: number | undefined, isDark: boolean): string | null {
  if (confidence === undefined || confidence === null) return null
  if (confidence > 0.8) return isDark ? '#34d399' : '#047857'
  if (confidence > 0.5) return isDark ? '#fbbf24' : '#b45309'
  return isDark ? '#f87171' : '#b91c1c'
}

/** Anything with no recorded origin, in every mode. */
export const UNATTRIBUTED_COLOR = { dark: '#475569', light: '#cbd5e1' }

/**
 * The overlay colour for a node or edge, or null to fall back to the type palette.
 *
 * An entity whose origin was never recorded returns the muted colour in EVERY
 * mode, and `isUnattributedEntity` lets renderers draw it hollow and dashed. That
 * is deliberate: the gap the backfill leaves behind should be something you can
 * see shrinking, not something that quietly blends in.
 */
export function overlayColorFor(entity: Record<string, unknown> | null | undefined): string | null {
  if (!entity) return null
  const { mode, isDark } = context
  if (mode === 'type') return null

  if (isUnattributedEntity(entity)) {
    return isDark ? UNATTRIBUTED_COLOR.dark : UNATTRIBUTED_COLOR.light
  }

  switch (mode) {
    case 'source':
      return pipelineColor(
        (entity.pipeline as string) || (entity.provSource as string)
          || (entity.prov_source as string) || (entity.source as string),
        isDark,
      )
    case 'freshness': {
      const f = FRESHNESS_COLOR[freshnessOf(
        (entity.lastSeenAt as string) || (entity.updatedAt as string))]
      return isDark ? f.dark : f.light
    }
    case 'trigger': {
      const hue = TRIGGER_HUE[(entity.trigger as string) || 'unknown'] ?? TRIGGER_HUE.unknown
      return isDark ? hue.dark : hue.light
    }
    case 'trust':
      return trustColor(entity.confidence as number | undefined, isDark)
        ?? (isDark ? '#64748b' : '#94a3b8')
    default:
      return null
  }
}

export function isUnattributedEntity(entity: Record<string, unknown> | null | undefined): boolean {
  if (!entity) return false
  return isUnattributed(entity.attribution as string | undefined)
}

/** True when the overlay should render this entity hollow / dashed. */
export function shouldRenderHollow(entity: Record<string, unknown> | null | undefined): boolean {
  if (context.mode === 'type') return false
  if (isUnattributedEntity(entity)) return true
  // A hypothesis is a guess the system has not confirmed; it should not look like
  // an observed fact just because it happens to be drawn the same way.
  return context.mode === 'trust' && entity?.factType === 'hypothesis'
}

// ── Legend ──────────────────────────────────────────────────────────────────

export interface LegendEntry {
  key: string
  label: string
  color: string
  dashed?: boolean
}

/** What the legend should show for the active mode. */
export function overlayLegend(mode: OverlayMode, isDark: boolean): LegendEntry[] {
  const unattributed: LegendEntry = {
    key: 'unattributed',
    label: 'Origin not recorded',
    color: isDark ? UNATTRIBUTED_COLOR.dark : UNATTRIBUTED_COLOR.light,
    dashed: true,
  }

  switch (mode) {
    case 'source':
      return [
        ...(['git', 'mcp', 'api', 'file-upload', 'dev-mate', 'qa-mind',
             'self-learning', 'manual', 'correlation'] as const).map(id => ({
          key: id,
          label: pipelineMeta(id).label,
          color: pipelineColor(id, isDark),
        })),
        unattributed,
      ]
    case 'freshness':
      return [
        { key: 'fresh',  label: 'Last day',   color: isDark ? FRESHNESS_COLOR.fresh.dark : FRESHNESS_COLOR.fresh.light },
        { key: 'recent', label: 'Last week',  color: isDark ? FRESHNESS_COLOR.recent.dark : FRESHNESS_COLOR.recent.light },
        { key: 'stale',  label: 'Older',      color: isDark ? FRESHNESS_COLOR.stale.dark : FRESHNESS_COLOR.stale.light },
        unattributed,
      ]
    case 'trigger':
      return [
        ...(['manual', 'scheduled', 'automatic', 'system'] as const).map(id => ({
          key: id,
          label: `${triggerMeta(id).glyph}  ${triggerMeta(id).label}`,
          color: isDark ? TRIGGER_HUE[id].dark : TRIGGER_HUE[id].light,
        })),
        unattributed,
      ]
    case 'trust':
      return [
        { key: 'high', label: 'Confident (>80%)', color: isDark ? '#34d399' : '#047857' },
        { key: 'mid',  label: 'Uncertain (50-80%)', color: isDark ? '#fbbf24' : '#b45309' },
        { key: 'low',  label: 'Weak (<50%)', color: isDark ? '#f87171' : '#b91c1c' },
        { key: 'hypothesis', label: 'Hypothesis', color: isDark ? '#a78bfa' : '#6d28d9', dashed: true },
        unattributed,
      ]
    default:
      return []
  }
}
