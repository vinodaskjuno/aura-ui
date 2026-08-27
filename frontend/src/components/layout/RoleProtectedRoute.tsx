import { Navigate } from 'react-router-dom'
import { ShieldOff } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

interface Props {
  children: React.ReactNode
  permission?: string
}

export default function RoleProtectedRoute({ children, permission }: Props) {
  const { token, hasPermission } = useAuthStore()

  if (!token) return <Navigate to="/login" replace />

  if (permission && !hasPermission(permission)) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', gap: 14, color: 'var(--color-subtext)',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: 18, background: '#ef444418',
          border: '1.5px solid #ef444444', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ShieldOff size={32} color="#ef4444" />
        </div>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18, color: 'var(--color-text)' }}>Access Denied</div>
        <div style={{ fontSize: 13 }}>You don't have permission to view this page.</div>
      </div>
    )
  }

  return <>{children}</>
}
