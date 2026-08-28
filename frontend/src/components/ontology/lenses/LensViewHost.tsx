/**
 * Resolves the active layout to its renderer and forwards the imperative ref.
 *
 * LensViewRef is superset-compatible with OntologyGraphRef, so
 * OntologyZoomControls keeps working across every lens unchanged.
 */
import { forwardRef, lazy, Suspense } from 'react'
import { useGraphTheme } from '../../../hooks/useGraphTheme'
import ForceLensView from './renderers/ForceLensView'
import SpecialistLensView from './renderers/SpecialistLensView'

// React Flow + dagre are a heavy chunk; keep them out of the canvas path.
const DagLensView = lazy(() => import('./renderers/DagLensView'))
const LaneLensView = lazy(() => import('./renderers/LaneLensView'))
import type { LensViewProps, LensViewRef } from './lensTypes'

function ViewLoading() {
  const t = useGraphTheme()
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: t.graphBg, gap: 12,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        border: `3px solid ${t.panelBorder}`, borderTopColor: t.accent,
        animation: 'spin 0.8s linear infinite',
      }} />
      <div style={{ color: t.panelSubtext, fontSize: 13 }}>Loading view…</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

const CANVAS_LAYOUTS = new Set(['force', 'hierarchy'])
const LANE_LAYOUTS = new Set(['lanes', 'grouped-lanes'])

const LensViewHost = forwardRef<LensViewRef, LensViewProps>(function LensViewHost(props, ref) {
  const { layout } = props

  if (CANVAS_LAYOUTS.has(layout.id)) {
    return <ForceLensView ref={ref} {...props} />
  }

  return (
    <Suspense fallback={<ViewLoading />}>
      {layout.id === 'dag'
        ? <DagLensView ref={ref} {...props} />
        : LANE_LAYOUTS.has(layout.id)
          ? <LaneLensView ref={ref} {...props} />
          : <SpecialistLensView {...props} />}
    </Suspense>
  )
})

export default LensViewHost
