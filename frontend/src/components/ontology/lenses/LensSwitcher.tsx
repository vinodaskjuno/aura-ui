/**
 * Topbar group 2 — the view selector.
 *
 * Deliberately mixes two kinds of button in one control, because that is the
 * affordance users already know from this topbar:
 *
 *   [ Smartscape │ Workspace │ Git │ Infra ]
 *     └── 'view' layouts ──┘   └── lenses ──┘
 *
 * A 'view' layout re-renders the whole ontology; a lens swaps which slice is
 * shown and repopulates group 1 with that lens's layouts. Nothing selected =
 * the Ontology lens on its default layout, which is exactly today's
 * `specialistView === null`.
 */
import { LensButton, LensButtonGroup } from './LensButton'
import { LENSES, DEFAULT_LENS_ID } from './lensRegistry'
import type { LayoutId, LensDefinition, LensId, LensLayoutOption } from './lensTypes'

interface Props {
  lens: LensDefinition
  layout: LensLayoutOption
  onLensChange: (id: LensId) => void
  onLayoutChange: (id: LayoutId) => void
  /** Return to the default layout without the canvas-layout state reset. */
  onToggleOff: () => void
}

export default function LensSwitcher({ lens, layout, onLensChange, onLayoutChange, onToggleOff }: Props) {
  const defaultLens = LENSES.find(l => l.id === DEFAULT_LENS_ID)
  const viewLayouts = (defaultLens?.layouts ?? []).filter(l => l.slot === 'view' && !l.detailOnly)
  const otherLenses = LENSES.filter(l => l.id !== DEFAULT_LENS_ID)

  const onDefaultLens = lens.id === DEFAULT_LENS_ID
  const detailLayout = layout.detailOnly ? layout : null

  if (!viewLayouts.length && !otherLenses.length) return null

  return (
    <LensButtonGroup>
      {viewLayouts.map(opt => {
        const active = onDefaultLens && layout.id === opt.id
        return (
          <LensButton
            key={opt.id}
            label={opt.label}
            Icon={opt.Icon}
            active={active}
            accent="#a78bfa"
            hoverTint="rgba(167,139,250,0.1)"
            hoverColor="#c4b5fd"
            title={opt.hint}
            onClick={() => {
              // Toggling the active view off returns to the lens's default
              // layout, matching `onSpecialistViewChange(active ? null : id)`.
              if (active) return onToggleOff()
              if (!onDefaultLens) onLensChange(DEFAULT_LENS_ID)
              onLayoutChange(opt.id)
            }}
          />
        )
      })}

      {otherLenses.map(l => (
        <LensButton
          key={l.id}
          label={l.label}
          Icon={l.Icon}
          active={lens.id === l.id}
          accent={l.accent}
          hoverTint={`${l.accent}1a`}
          hoverColor={l.accent}
          title={`${l.label} lens — ${l.sublabel}`}
          onClick={() => onLensChange(lens.id === l.id ? DEFAULT_LENS_ID : l.id)}
        />
      ))}

      {/* Detail-only views (Domain, Structural) have no button of their own;
          surface the active one so the user can see where they are. */}
      {detailLayout && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 10px',
          background: 'rgba(99,102,241,0.12)',
          border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: 6,
          fontSize: 10, fontWeight: 700, color: '#818cf8',
          whiteSpace: 'nowrap',
        }}>
          <detailLayout.Icon size={11} strokeWidth={2} />
          {detailLayout.label}
        </div>
      )}
    </LensButtonGroup>
  )
}
