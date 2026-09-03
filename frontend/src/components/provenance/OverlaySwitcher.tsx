import { useEffect, useState } from 'react'
import { Layers } from 'lucide-react'
import { useProvenanceOverlayStore } from '../../store/provenanceOverlayStore'
import { OVERLAY_MODES, setOverlayContext } from './overlayPalette'
import { useGraphTheme } from '../../hooks/useGraphTheme'

/**
 * "Colour by…" — the control that turns the graph into a provenance map.
 *
 * Collapsed to a single chip until used, because the default (`Type`) is what the
 * top bar has always shown and a five-way segmented control competing with the
 * lens and layout switchers would make the chrome the loudest thing on screen.
 */

interface Props {
  /** Reflected into the URL by the page, so an overlay view is shareable. */
  onModeChange?: (mode: string) => void
}

export default function OverlaySwitcher({ onModeChange }: Props) {
  const gt = useGraphTheme()
  const { mode, setMode } = useProvenanceOverlayStore()
  const [open, setOpen] = useState(false)

  // The paint path reads an ambient value rather than a hook (see overlayPalette),
  // so it has to be kept in step with both the store and the active theme.
  useEffect(() => {
    setOverlayContext({ mode, isDark: gt.isDark })
  }, [mode, gt.isDark])

  const active = mode !== 'type'
  const current = OVERLAY_MODES.find(m => m.id === mode)

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Recolour the graph by where its data came from"
        style={{
          height: 30, padding: '0 10px', borderRadius: 8,
          display: 'flex', alignItems: 'center', gap: 6,
          background: active ? 'rgba(167,139,250,0.16)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${active ? 'rgba(167,139,250,0.45)' : 'rgba(255,255,255,0.08)'}`,
          color: active ? '#c4b5fd' : 'rgba(148,163,184,0.85)',
          fontSize: 11, fontWeight: 600, cursor: 'pointer',
          transition: 'all .15s', whiteSpace: 'nowrap',
        }}
      >
        <Layers size={12} />
        {active ? current?.label : 'Colour by'}
      </button>

      {open && (
        <>
          {/* Click-away. A dropdown that only closes via its own button is a trap
              when the thing you want to click next is the graph. */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          />
          <div style={{
            position: 'absolute', top: 36, right: 0, zIndex: 41,
            minWidth: 220, padding: 6, borderRadius: 10,
            background: gt.panelBg, backdropFilter: 'blur(20px)',
            border: `1px solid ${gt.panelBorder}`,
            boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          }}>
            {OVERLAY_MODES.map(m => (
              <button
                key={m.id}
                onClick={() => { setMode(m.id); onModeChange?.(m.id); setOpen(false) }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '7px 9px', borderRadius: 7, border: 'none',
                  background: m.id === mode ? gt.accentBg : 'transparent',
                  cursor: 'pointer', transition: 'background .12s',
                }}
                onMouseEnter={e => {
                  if (m.id !== mode) e.currentTarget.style.background = gt.rowHover
                }}
                onMouseLeave={e => {
                  if (m.id !== mode) e.currentTarget.style.background = 'transparent'
                }}
              >
                <div style={{
                  fontSize: 11.5, fontWeight: 700,
                  color: m.id === mode ? gt.accent : gt.panelText,
                }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 9.5, color: gt.mutedText, marginTop: 1 }}>
                  {m.hint}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
