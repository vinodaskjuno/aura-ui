import { Bell } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

export function TopBar() {
  const { username } = useAuthStore()
  const initials = (username ?? 'A').slice(0, 1).toUpperCase()

  return (
    <header style={{
      height: 52, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
      padding: '0 20px',
      background: 'var(--color-surface)',
      borderBottom: '1px solid var(--color-border)',
      position: 'sticky', top: 0, zIndex: 40, flexShrink: 0,
    }}>
      {/* Right: bell + avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-subtext)', display: 'flex', padding: 6, borderRadius: 6, transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-subtext)')}
        >
          <Bell size={16} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 12, color: '#fff',
          }}>{initials}</div>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)', fontFamily: 'var(--font-heading)' }}>{username}</span>
        </div>
      </div>
    </header>
  )
}

export default TopBar
