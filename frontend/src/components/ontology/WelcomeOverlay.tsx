interface Props {
  onStart: () => void
}

const shortcuts = [
  { key: 'Click', desc: 'Select node & view details' },
  { key: 'Space', desc: 'Fit graph to screen' },
  { key: 'Toggle', desc: 'Switch Full/Hierarchy view' },
  { key: 'Esc', desc: 'Clear selection / Go back' },
  { key: 'Drag', desc: 'Move nodes / pan view' },
  { key: 'Scroll', desc: 'Zoom in / out' },
  { key: 'P', desc: 'Presentation mode' },
  { key: 'Ctrl+F', desc: 'Search nodes' }
]

export default function WelcomeOverlay({ onStart }: Props) {
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: 'rgba(0, 0, 0, 0.9)',
        backdropFilter: 'blur(10px)',
        animation: 'fadeIn 0.5s'
      }}
    >
      <div style={{
        background: 'linear-gradient(135deg, rgba(6, 13, 46, 0.98), rgba(20, 30, 80, 0.98))',
        border: '1px solid rgba(74, 158, 255, 0.3)',
        borderRadius: '16px',
        padding: '40px',
        maxWidth: '600px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{
          fontSize: '28px',
          fontWeight: 700,
          color: '#f0f0ff',
          marginBottom: '8px',
          textAlign: 'center'
        }}>
          Infrastructure Universe
        </div>
        <div style={{
          fontSize: '14px',
          color: '#6a7aaa',
          textAlign: 'center',
          marginBottom: '32px'
        }}>
          Executive Visualization Platform
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px 24px',
          marginBottom: '32px'
        }}>
          {shortcuts.map((shortcut, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '32px',
                height: '32px',
                padding: '0 8px',
                background: 'rgba(74, 158, 255, 0.15)',
                border: '1px solid rgba(74, 158, 255, 0.3)',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#4a9eff',
                fontFamily: '"Courier New", monospace'
              }}>
                {shortcut.key}
              </div>
              <div style={{ fontSize: '12px', color: '#b0c0ee' }}>
                {shortcut.desc}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onStart}
          style={{
            width: '100%',
            padding: '14px',
            background: 'linear-gradient(135deg, #4a9eff, #2a6aef)',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #5aaeff, #3a7aff)'
            e.currentTarget.style.transform = 'translateY(-1px)'
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(74, 158, 255, 0.4)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #4a9eff, #2a6aef)'
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          Start Exploring
        </button>
      </div>
    </div>
  )
}
