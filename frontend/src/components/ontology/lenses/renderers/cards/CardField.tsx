/**
 * One metric row on a lens card, driven entirely by a CardField descriptor.
 *
 * Keeping this declarative is what lets a new lens surface domain metrics —
 * pipeline success, pod utilisation, monthly cost — without writing a component.
 */
import { useGraphTheme } from '../../../../../hooks/useGraphTheme'
import { formatField, thresholdColor } from '../../lensFormat'
import type { CardField as CardFieldDef } from '../../lensTypes'

interface Props {
  field: CardFieldDef
  value: unknown
}

export default function CardField({ field, value }: Props) {
  const t = useGraphTheme()
  if (value === null || value === undefined || value === '') return null

  const text = formatField(value, field.format) + (field.suffix ?? '')
  // Thresholds outrank colorMap: a risk signal must not be masked by branding.
  const mapped = field.colorMap?.[String(value).toLowerCase()]
  const danger = thresholdColor(value, field.thresholds) ?? mapped ?? null

  switch (field.emphasis) {
    case 'badge':
      return (
        <span style={{
          fontSize: 9, fontWeight: 700, borderRadius: 4, padding: '1px 5px',
          background: `${danger ?? t.accent}22`,
          color: danger ?? t.accent,
          border: `1px solid ${danger ?? t.accent}44`,
          whiteSpace: 'nowrap',
        }}>{text}</span>
      )

    case 'pip':
      return (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: t.flowNodeSubtext }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: danger ?? t.accent,
            boxShadow: t.isDark ? `0 0 5px ${danger ?? t.accent}` : 'none',
          }} />
          {field.label}: <span style={{ color: danger ?? t.flowNodeText, fontWeight: 600 }}>{text}</span>
        </span>
      )

    case 'bar': {
      // 0–1 ratios and 0–100 percentages both appear in the data.
      const raw = Number(value)
      const pct = Number.isNaN(raw) ? 0 : Math.max(0, Math.min(100, raw <= 1 ? raw * 100 : raw))
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9 }}>
          <span style={{ color: t.flowNodeSubtext, minWidth: 30 }}>{field.label}</span>
          <div style={{
            flex: 1, height: 4, borderRadius: 2, minWidth: 28,
            background: t.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
            overflow: 'hidden',
          }}>
            <div style={{ width: `${pct}%`, height: '100%', background: danger ?? '#22c55e' }} />
          </div>
          <span style={{ color: danger ?? t.flowNodeText, fontWeight: 600 }}>{text}</span>
        </div>
      )
    }

    case 'primary':
      return (
        <div style={{ fontSize: 11, fontWeight: 700, color: danger ?? t.flowNodeText }}>{text}</div>
      )

    default:
      return (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5, fontSize: 9,
          color: t.flowNodeSubtext,
        }}>
          <span>{field.label}</span>
          <span style={{
            marginLeft: 'auto', fontWeight: 600,
            color: danger ?? t.flowNodeText,
            fontFamily: field.format === 'mono' || field.format === 'pathTail'
              ? '"Courier New", monospace' : undefined,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{text}</span>
        </div>
      )
  }
}
