/**
 * The card body shared by both generic renderers.
 *
 * Generalised from the superseded CodeFlowView's CodeNode: title, type badge and metric
 * rows all come from the lens's LensNodeType config rather than being written
 * per view.
 */
import { useGraphTheme } from '../../../../../hooks/useGraphTheme'
import { overlayColorFor, shouldRenderHollow } from '../../../../provenance/overlayPalette'
import { hashColor } from '../../lensFormat'
import CardField from './CardField'
import type { LensNodeType, NodeLabel } from '../../lensTypes'
import type { OntologyNode } from '../../../../../api/ontologyUniverse'

export interface LensNodeCardProps {
  node: OntologyNode
  type: NodeLabel
  cfg?: LensNodeType
  selected: boolean
  hovered?: boolean
  highlighted?: boolean
  /** Severity tint applied to the top border — risk overlays use this. */
  alertColor?: string | null
  width?: number
}

export default function LensNodeCard({
  node, type, cfg, selected, hovered, highlighted, alertColor, width,
}: LensNodeCardProps) {
  const t = useGraphTheme()
  // Shared by the DAG, Lane and Specialist renderers, so hooking the overlay
  // here covers three views at once.
  const props = node as unknown as Record<string, unknown>
  const overlay = overlayColorFor(props)
  const hollow = shouldRenderHollow(props)
  const color = overlay ?? cfg?.color ?? hashColor(type.toLowerCase())
  const Icon = cfg?.Icon
  const fields = cfg?.cardFields ?? []

  const border = selected ? t.accent : highlighted ? '#f59e0b' : t.flowNodeBorder

  return (
    <div style={{
      width, boxSizing: 'border-box',
      padding: '8px 10px', borderRadius: 10,
      background: selected ? t.accentBg : hovered ? t.rowHover : t.flowNodeBg,
      border: `1.5px ${hollow ? 'dashed' : 'solid'} ${border}`,
      borderTop: alertColor ? `3px solid ${alertColor}` : `1.5px ${hollow ? 'dashed' : 'solid'} ${border}`,
      boxShadow: selected ? `0 0 12px ${t.accent}44` : '0 2px 8px rgba(0,0,0,0.25)',
      transition: 'border-color 0.15s, background 0.15s',
      display: 'flex', flexDirection: 'column', gap: 3,
      textAlign: 'left',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: color,
          boxShadow: t.isDark ? `0 0 6px ${color}` : 'none',
        }} />
        {Icon && <Icon size={11} strokeWidth={2} color={color} style={{ flexShrink: 0 }} />}
        <span style={{
          fontSize: 11, fontWeight: 700, color: t.flowNodeText,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {node.label || type}
        </span>
      </div>

      <div style={{ fontSize: 8, color: t.flowNodeSubtext, letterSpacing: '0.4px' }}>
        {type}
      </div>

      {fields.map(f => (
        <CardField key={f.key} field={f} value={props[f.key]} />
      ))}
    </div>
  )
}
