/**
 * Lens KPI strip.
 *
 * Hosts the Nodes/Links counters that previously lived in the topbar, so lenses
 * that care about domain metrics (Git: stale repos, pipeline health; Infra:
 * monthly cost, unencrypted resources) can surface them in the same place
 * without the topbar growing per lens.
 */
import { useMemo } from 'react'
import { formatField, thresholdColor } from './lensFormat'
import type { LensDataContext, LensDefinition, LensGrouping } from './lensTypes'

/** Fixed height so the page can offset the rest of the chrome deterministically. */
export const KPI_BAR_HEIGHT = 44

interface Props {
  lens: LensDefinition
  ctx: LensDataContext
  isPresentationMode: boolean
  /** Axis 2b — the outer partition for lane layouts. Hidden when a lens has none. */
  grouping?: LensGrouping | null
  onGroupingChange?: (id: string) => void
  showGrouping?: boolean
}

export default function LensKpiBar({
  lens, ctx, isPresentationMode, grouping, onGroupingChange, showGrouping,
}: Props) {
  const tiles = useMemo(
    () => (lens.kpis ?? [])
      .filter(k => !k.secondary)
      .map(k => ({ kpi: k, value: k.compute(ctx) })),
    [lens, ctx],
  )

  const groupings = showGrouping ? (lens.groupings ?? []) : []
  if (!tiles.length && !groupings.length) return null

  return (
    <div style={{
      position: 'absolute', top: 52, left: 0, right: 0, zIndex: 19,
      height: KPI_BAR_HEIGHT, boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '0 16px',
      background: 'rgba(6,10,22,0.72)',
      backdropFilter: 'blur(18px)',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      overflowX: 'auto', pointerEvents: 'auto',
      opacity: isPresentationMode ? 0.35 : 1,
      transition: 'opacity 0.2s',
    }}>
      {tiles.map(({ kpi, value }) => {
        const accent = thresholdColor(value, kpi.thresholds) ?? kpi.accent ?? lens.accent
        return (
          <div
            key={kpi.id}
            title={kpi.hint}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '2px 12px', borderRadius: 8, flexShrink: 0,
              background: `${accent}12`,
              border: `1px solid ${accent}33`,
            }}
          >
            <span style={{
              fontSize: 15, fontWeight: 800, lineHeight: 1.2, color: accent,
            }}>
              {value === null || value === undefined ? '—' : formatField(value, kpi.format)}
            </span>
            <span style={{
              fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '1.1px', color: 'rgba(148,163,184,0.75)', whiteSpace: 'nowrap',
            }}>{kpi.label}</span>
          </div>
        )
      })}

      {groupings.length > 1 && (
        <div style={{
          marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4,
          paddingLeft: 12, flexShrink: 0,
        }}>
          <span style={{
            fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '1px', color: 'rgba(148,163,184,0.6)',
          }}>Group by</span>
          {groupings.map(g => {
            const active = grouping?.id === g.id
            return (
              <button
                key={g.id}
                onClick={() => onGroupingChange?.(g.id)}
                style={{
                  padding: '3px 9px', borderRadius: 6,
                  background: active ? `${lens.accent}20` : 'transparent',
                  border: `1px solid ${active ? `${lens.accent}55` : 'transparent'}`,
                  color: active ? lens.accent : 'rgba(148,163,184,0.7)',
                  fontSize: 10, fontWeight: active ? 700 : 500,
                  cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
                }}
              >{g.label}</button>
            )
          })}
        </div>
      )}
    </div>
  )
}
