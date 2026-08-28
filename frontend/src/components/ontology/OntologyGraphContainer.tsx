/**
 * OntologyGraphContainer — routes to the correct specialist view based on
 * the specialistView state. Falls through to null (caller renders OntologyGraph)
 * when specialistView is null.
 */
import React, { Suspense } from 'react'
import type { SpecialistView } from './lenses/lensTypes'
import type { OntologyNode, OntologyLink } from '../../api/ontologyUniverse'
import { useGraphTheme } from '../../hooks/useGraphTheme'

const SmartscapeView         = React.lazy(() => import('./views/SmartscapeView'))
const DomainLayerView        = React.lazy(() => import('./views/DomainLayerView'))
const StructuralView         = React.lazy(() => import('./views/StructuralView'))
const WorkspaceSpecialistView = React.lazy(() => import('./views/WorkspaceSpecialistView'))

interface Props {
  view: SpecialistView
  nodes: OntologyNode[]
  links: OntologyLink[]
  selectedNode: OntologyNode | null
  onNodeClick: (node: OntologyNode) => void
  onBack?: () => void
}

function ViewLoading() {
  const t = useGraphTheme()
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: t.graphBg, gap: 12,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        border: `3px solid ${t.panelBorder}`,
        borderTopColor: t.accent,
        animation: 'spin 0.8s linear infinite',
      }} />
      <div style={{ color: t.panelSubtext, fontSize: 13 }}>Loading view…</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export default function OntologyGraphContainer({ view, nodes, links, selectedNode, onNodeClick, onBack }: Props) {
  const commonProps = { nodes, links, selectedNode, onNodeClick }
  const withBack = { ...commonProps, onBack: onBack ?? (() => {}) }

  const child = (() => {
    switch (view) {
      case 'smartscape':    return <SmartscapeView         {...commonProps} />
      case 'domain-layer':  return <DomainLayerView        {...withBack} />
      case 'structural':    return <StructuralView          {...withBack} />
      case 'workspace':     return <WorkspaceSpecialistView {...commonProps} />
      default:              return null
    }
  })()

  return (
    <Suspense fallback={<ViewLoading />}>
      {child}
    </Suspense>
  )
}
