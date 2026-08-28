/**
 * Topbar group 1 — how the active lens is drawn.
 *
 * Contents are lens-driven: Ontology gives Graph | Hierarchy (exactly today's
 * VIEW_TABS); Git will give DAG | Lanes | Force; Infra Grouped | Blast | Force.
 */
import { LensButton, LensButtonGroup } from './LensButton'
import type { LayoutId, LensDefinition, LensLayoutOption } from './lensTypes'

interface Props {
  lens: LensDefinition
  layout: LensLayoutOption
  onChange: (id: LayoutId) => void
}

export default function LensLayoutTabs({ lens, layout, onChange }: Props) {
  const tabs = lens.layouts.filter(l => l.slot === 'layout' && !l.detailOnly)
  if (!tabs.length) return null

  return (
    <LensButtonGroup>
      {tabs.map(opt => (
        <LensButton
          key={opt.id}
          label={opt.label}
          Icon={opt.Icon}
          active={layout.id === opt.id}
          accent="#60a5fa"
          title={opt.hint}
          onClick={() => onChange(opt.id)}
        />
      ))}
    </LensButtonGroup>
  )
}
