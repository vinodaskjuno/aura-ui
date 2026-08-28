import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useGraphTheme } from '../../hooks/useGraphTheme'

export interface LegendNodeEntry { label: string; color: string; glow?: string; count?: number }
export interface LegendEdgeEntry { label: string; color: string }

interface Props {
  isPresentationMode: boolean
  /** Derived from the active lens + the data — see LensLegend. */
  nodeEntries: LegendNodeEntry[]
  edgeEntries: LegendEdgeEntry[]
  hints?: string[]
  /** Distance from the top of the canvas — shifts when the KPI bar is shown. */
  topOffset?: number
}

export default function OntologyLegend({
  isPresentationMode, nodeEntries, edgeEntries, hints = [], topOffset = 80,
}: Props) {
  const gt = useGraphTheme()
  const [collapsed, setCollapsed] = useState(false)

  if (collapsed) {
    return (
      <div
        className={`absolute z-10 transition-opacity ${isPresentationMode ? 'opacity-20 hover:opacity-80' : 'opacity-100'}`}
        style={{ top: `${topOffset}px`, right: '24px' }}
      >
        <button
          onClick={() => setCollapsed(false)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '10px',
            background: gt.legendBg, backdropFilter: 'blur(24px)',
            border: `1px solid ${gt.legendBorder}`,
            cursor: 'pointer',
            boxShadow: gt.isDark
              ? '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)'
              : '0 4px 12px rgba(0,0,0,0.1)',
            transition: 'background 0.3s, border-color 0.3s',
          }}
        >
          <span style={{
            fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px',
            background: 'linear-gradient(90deg, #a78bfa, #60a5fa)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>◈ Legend</span>
          <ChevronDown size={12} color={gt.accent} />
        </button>
      </div>
    )
  }

  return (
    <div
      className={`absolute z-10 transition-opacity ${isPresentationMode ? 'opacity-20 hover:opacity-80' : 'opacity-100'}`}
      style={{
        top: `${topOffset}px`, right: '24px',
        background: gt.legendBg,
        backdropFilter: 'blur(24px)',
        border: `1px solid ${gt.legendBorder}`,
        borderRadius: '14px',
        padding: '14px 14px',
        width: '200px',
        maxHeight: 'calc(100vh - 120px)',
        overflowY: 'auto',
        boxShadow: gt.isDark
          ? '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)'
          : '0 8px 24px rgba(0,0,0,0.10)',
        transition: 'background 0.3s, border-color 0.3s',
      }}
    >
      {/* Header with collapse toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{
          fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px',
          background: 'linear-gradient(90deg, #a78bfa, #60a5fa)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>◈ Legend</div>
        <button
          onClick={() => setCollapsed(true)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: gt.mutedText, padding: '2px',
            display: 'flex', alignItems: 'center',
          }}
          title="Collapse legend"
        >
          <ChevronUp size={12} color={gt.accent} />
        </button>
      </div>

      {/* Node Types section */}
      <div style={{
        fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '1.5px', color: gt.sectionLabel, marginBottom: '8px',
      }}>Node Types</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '16px' }}>
        {nodeEntries.map(t => (
          <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <span style={{
              width: '9px', height: '9px', borderRadius: '50%', flexShrink: 0,
              background: `radial-gradient(circle at 35% 35%, #fff, ${t.color})`,
              boxShadow: gt.isDark
                ? `0 0 8px ${t.glow ?? t.color}, 0 0 2px ${t.glow ?? t.color}`
                : `0 0 4px ${t.glow ?? t.color}60`,
            }} />
            <span style={{ flex: 1, fontSize: '10px', color: gt.panelText, lineHeight: 1.2, opacity: 0.85 }}>
              {t.label}
            </span>
            {t.count !== undefined && (
              <span style={{
                fontSize: '9px', color: gt.panelSubtext, fontWeight: 600,
                fontFamily: '"Courier New", monospace',
              }}>{t.count}</span>
            )}
          </div>
        ))}
      </div>

      <div style={{ height: '1px', background: gt.divider, margin: '4px 0 12px' }} />

      {/* Relationships section */}
      <div style={{
        fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '1.5px', color: gt.sectionLabel, marginBottom: '8px',
      }}>Relationships</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {edgeEntries.map(r => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
              <div style={{ width: '14px', height: '1.5px', background: r.color, opacity: 0.8 }} />
              <div style={{
                width: 0, height: 0,
                borderTop: '3px solid transparent',
                borderBottom: '3px solid transparent',
                borderLeft: `5px solid ${r.color}`,
                opacity: 0.9,
              }} />
            </div>
            <span style={{ fontSize: '9px', color: gt.panelSubtext, fontFamily: 'monospace' }}>
              {r.label}
            </span>
          </div>
        ))}
      </div>

      {hints.length > 0 && (
        <div style={{
          marginTop: '14px', padding: '8px', borderRadius: '8px',
          background: gt.accentBg,
          border: `1px solid ${gt.accentBorder}`,
          fontSize: '9px', color: gt.accent, lineHeight: 1.6,
        }}>
          {hints.map((h, i) => <div key={i}>{h}</div>)}
        </div>
      )}
    </div>
  )
}
