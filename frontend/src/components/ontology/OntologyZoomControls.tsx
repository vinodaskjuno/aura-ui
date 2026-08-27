import type { RefObject } from 'react'
import { ZoomIn, ZoomOut, Maximize2, Presentation } from 'lucide-react'
import type { OntologyGraphRef } from './OntologyGraph'

interface Props {
  graphRef: RefObject<OntologyGraphRef>
  isPresentationMode: boolean
  onPresentationToggle: () => void
}

const btnBase: React.CSSProperties = {
  width: 44, height: 44,
  background: 'rgba(6,13,46,0.95)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 10,
  color: '#4a9eff',
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all 0.2s',
}

function ZoomBtn({ icon, title, onClick, active = false }: {
  icon: React.ReactNode; title: string; onClick: () => void; active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        ...btnBase,
        background: active ? 'rgba(20,40,130,0.95)' : btnBase.background,
        border: `1px solid ${active ? '#4a9eff' : 'rgba(255,255,255,0.2)'}`,
        color: active ? '#fff' : '#4a9eff',
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.background = 'rgba(20,40,130,0.95)'
          e.currentTarget.style.borderColor = '#4a9eff'
          e.currentTarget.style.color = '#fff'
          e.currentTarget.style.transform = 'scale(1.05)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.background = 'rgba(6,13,46,0.95)'
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
          e.currentTarget.style.color = '#4a9eff'
          e.currentTarget.style.transform = 'scale(1)'
        }
      }}
    >
      {icon}
    </button>
  )
}

export default function OntologyZoomControls({ graphRef, isPresentationMode, onPresentationToggle }: Props) {
  return (
    <div className="absolute z-10 flex flex-col gap-2 transition-opacity" style={{ bottom: 24, right: 24, opacity: isPresentationMode ? 0.3 : 1 }}>
      <ZoomBtn icon={<ZoomIn size={18} />}    title="Zoom In"          onClick={() => graphRef.current?.zoomIn()} />
      <ZoomBtn icon={<ZoomOut size={18} />}   title="Zoom Out"         onClick={() => graphRef.current?.zoomOut()} />
      <ZoomBtn icon={<Maximize2 size={18} />} title="Fit to Screen"    onClick={() => graphRef.current?.zoomToFit()} />
      <ZoomBtn icon={<Presentation size={18} />} title="Presentation Mode"
        onClick={onPresentationToggle} active={isPresentationMode} />
    </div>
  )
}
