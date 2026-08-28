/**
 * Adapter: LensViewProps → the existing OntologyGraphContainer.
 *
 * Kept as a wrapper rather than inlined because the container already owns the
 * lazy-loading split and a themed loading fallback, and because domain-layer /
 * structural require an `onBack` the lens contract makes optional.
 */
import type { SpecialistView } from '../lensTypes'
import OntologyGraphContainer from '../../OntologyGraphContainer'
import type { LensViewProps } from '../lensTypes'

export default function SpecialistLensView(props: LensViewProps) {
  const { layout, nodes, links, selectedNode, onNodeClick, onBack } = props
  return (
    <OntologyGraphContainer
      view={layout.id as SpecialistView}
      nodes={nodes}
      links={links}
      selectedNode={selectedNode}
      onNodeClick={onNodeClick}
      onBack={onBack}
    />
  )
}
