import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useGraphTheme } from '../../hooks/useGraphTheme'

interface Props {
  isPresentationMode: boolean
}

const NODE_TYPES = [
  { label: 'Organizations',     color: '#60a5fa', glow: '#60a5fa' },
  { label: 'Projects',          color: '#f59e0b', glow: '#fbbf24' },
  { label: 'Services',          color: '#10b981', glow: '#34d399' },
  { label: 'Repositories',      color: '#a78bfa', glow: '#c4b5fd' },
  { label: 'Infrastructure',    color: '#06b6d4', glow: '#22d3ee' },
  { label: 'Databases',         color: '#9c27b0', glow: '#ba68c8' },
  { label: 'Teams',             color: '#ec4899', glow: '#f472b6' },
  { label: 'Security Findings', color: '#ef4444', glow: '#f87171' },
  { label: 'Incidents',         color: '#f97316', glow: '#fb923c' },
  { label: 'Cloud Providers',   color: '#4285f4', glow: '#6ea6ff' },
  { label: 'Containers',        color: '#10b981', glow: '#34d399' },
  { label: 'AI Services',       color: '#ff6b9d', glow: '#ff8fb5' },
  { label: 'API Services',      color: '#ffc107', glow: '#ffd54f' },
  { label: 'Applications',      color: '#00bcd4', glow: '#4dd0e1' },
  { label: 'Network Services',  color: '#009688', glow: '#4db6ac' },
  { label: 'Batch Processes',   color: '#607d8b', glow: '#90a4ae' },
  { label: 'Domains',           color: '#3f51b5', glow: '#7986cb' },
]

const REL_TYPES = [
  { label: 'BELONGS_TO',      color: '#60a5fa' },
  { label: 'RUNS_ON',         color: '#34d399' },
  { label: 'DEPENDS_ON',      color: '#f59e0b' },
  { label: 'HAS_FINDING',     color: '#ef4444' },
  { label: 'HAS_INCIDENT',    color: '#f97316' },
  { label: 'MANAGED_BY',      color: '#ec4899' },
  { label: 'HOSTED_IN',       color: '#a78bfa' },
  { label: 'IS_SAME_AS',      color: '#22d3ee' },
  { label: 'CORRELATES_WITH', color: '#818cf8' },
]

export default function OntologyLegend({ isPresentationMode }: Props) {
  const gt = useGraphTheme()
  const [collapsed, setCollapsed] = useState(false)

  if (collapsed) {
    return (
      <div
        className={`absolute z-10 transition-opacity ${isPresentationMode ? 'opacity-20 hover:opacity-80' : 'opacity-100'}`}
        style={{ top: '80px', right: '24px' }}
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
        top: '80px', right: '24px',
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
        {NODE_TYPES.map((t, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <span style={{
              width: '9px', height: '9px', borderRadius: '50%', flexShrink: 0,
              background: `radial-gradient(circle at 35% 35%, #fff, ${t.color})`,
              boxShadow: gt.isDark ? `0 0 8px ${t.glow}, 0 0 2px ${t.glow}` : `0 0 4px ${t.glow}60`,
            }} />
            <span style={{ fontSize: '10px', color: gt.panelText, lineHeight: 1.2, opacity: 0.85 }}>
              {t.label}
            </span>
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
        {REL_TYPES.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
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

      <div style={{
        marginTop: '14px', padding: '8px', borderRadius: '8px',
        background: gt.accentBg,
        border: `1px solid ${gt.accentBorder}`,
        fontSize: '9px', color: gt.accent, lineHeight: 1.6,
      }}>
        ✦ Click node to inspect<br />
        ✦ Space → fit to screen<br />
        ✦ Drag node to pin
      </div>
    </div>
  )
}
