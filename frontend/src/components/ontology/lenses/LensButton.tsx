/**
 * Shared button + group chrome for the topbar's two segmented controls.
 * Extracted verbatim from OntologyTopBar's local `btn()` so the visual
 * treatment is unchanged.
 */
import type { CSSProperties, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

function buttonStyle(active: boolean, accent = '#a78bfa'): CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '5px 10px', height: 30,
    background: active ? `${accent}18` : 'transparent',
    border: active ? `1px solid ${accent}44` : '1px solid transparent',
    borderRadius: 7,
    color: active ? accent : 'rgba(148,163,184,0.7)',
    fontSize: 11, fontWeight: active ? 700 : 500,
    cursor: 'pointer', transition: 'all 0.18s',
    whiteSpace: 'nowrap', flexShrink: 0,
  }
}

export function LensButtonGroup({ children }: { children: ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 2,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 8, padding: '3px',
    }}>
      {children}
    </div>
  )
}

interface LensButtonProps {
  label: string
  Icon: LucideIcon
  active: boolean
  accent?: string
  /** Hover tint; defaults to a neutral wash for layout tabs. */
  hoverTint?: string
  hoverColor?: string
  title?: string
  onClick: () => void
}

export function LensButton({
  label, Icon, active, accent = '#a78bfa',
  hoverTint = 'rgba(255,255,255,0.06)', hoverColor = '#e2e8f0',
  title, onClick,
}: LensButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={buttonStyle(active, accent)}
      onMouseEnter={e => {
        if (active) return
        e.currentTarget.style.background = hoverTint
        e.currentTarget.style.color = hoverColor
      }}
      onMouseLeave={e => {
        if (active) return
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'rgba(148,163,184,0.7)'
      }}
    >
      <Icon size={12} strokeWidth={2} />
      {label}
    </button>
  )
}
