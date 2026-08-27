import { ChevronRight } from 'lucide-react'

interface Props {
  path: string[]
  level?: number
  rootLabel?: string
  onNavigate: (index: number) => void
}

// Path items may be "nodeId::Display Label" — extract only the display part
function displayLabel(item: string): string {
  return item.includes('::') ? item.split('::').slice(1).join('::') : item
}

export default function OntologyBreadcrumb({ path, rootLabel = 'Groups', onNavigate }: Props) {
  return (
    <div style={{
      position: 'fixed',
      top: '70px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 950,
      background: 'rgba(6, 13, 46, 0.95)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      borderRadius: '8px',
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '11px',
      maxWidth: 'calc(100vw - 600px)',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => onNavigate(-1)}
        style={{
          color: '#8a9adb', cursor: 'pointer', transition: 'color 0.2s',
          background: 'none', border: 'none', fontSize: '11px', whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = '#4a9eff'}
        onMouseLeave={(e) => e.currentTarget.style.color = '#8a9adb'}
      >
        {rootLabel}
      </button>
      {path.map((item, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <ChevronRight size={11} color="#6a7aaa" style={{ flexShrink: 0 }} />
          <button
            onClick={() => onNavigate(i)}
            style={{
              color: i === path.length - 1 ? '#f0f0ff' : '#8a9adb',
              cursor: i === path.length - 1 ? 'default' : 'pointer',
              transition: 'color 0.2s',
              background: 'none', border: 'none', fontSize: '11px',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              maxWidth: '160px',
            }}
            onMouseEnter={(e) => {
              if (i !== path.length - 1) e.currentTarget.style.color = '#4a9eff'
            }}
            onMouseLeave={(e) => {
              if (i !== path.length - 1) e.currentTarget.style.color = '#8a9adb'
            }}
          >
            {displayLabel(item)}
          </button>
        </span>
      ))}
    </div>
  )
}
