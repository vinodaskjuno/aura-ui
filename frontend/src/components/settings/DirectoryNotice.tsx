import { useEffect, useState } from 'react'
import { Network } from 'lucide-react'
import client from '../../api/client'

/**
 * Shown on User and Role Management once Active Directory is in charge of sign-in.
 *
 * It explains scope rather than locking the pages: both still do real work under
 * LDAP. Local accounts are what break-glass sign-in uses when the directory is
 * unreachable, and a role's permission set is exactly what an AD group grants —
 * making either page read-only would leave no way to rotate a break-glass password
 * or widen a group's access.
 */
export default function DirectoryNotice({ children }: { children: React.ReactNode }) {
  const [managed, setManaged] = useState(false)

  useEffect(() => {
    // /auth/me rather than the LDAP config endpoint: Role Management is gated on
    // role_management, which does not imply the user_management that endpoint needs.
    client.get('/auth/me')
      .then(r => setManaged(!!r.data?.directoryManaged))
      .catch(() => setManaged(false))
  }, [])

  if (!managed) return null

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 18,
      background: 'var(--color-card)', border: '1px solid var(--color-border)',
      borderLeft: '3px solid var(--color-primary)', borderRadius: 8,
      padding: '11px 14px', fontSize: 12.5, color: 'var(--color-subtext)',
      lineHeight: 1.6 }}>
      <Network size={15} color="var(--color-primary)"
        style={{ flexShrink: 0, marginTop: 2 }} />
      <div>{children}</div>
    </div>
  )
}
