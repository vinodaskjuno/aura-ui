import { create } from 'zustand'

export type RoleType = 'user_dev' | 'user_qa' | 'user_ops' | 'admin' | 'super_admin' | 'ontology_maintainer'

export const ROLE_LABELS: Record<RoleType, string> = {
  user_dev: 'User + Dev',
  user_qa: 'User + QA',
  user_ops: 'User + Ops',
  admin: 'Admin',
  super_admin: 'Super Admin',
  ontology_maintainer: 'Ontology Maintainer',
}

interface AuthState {
  token: string | null
  username: string | null
  userId: string | null
  role: RoleType | null
  roleLabel: string | null
  permissions: string[]
  login: (token: string, username: string, userId: string, role: RoleType, roleLabel: string, permissions: string[]) => void
  logout: () => void
  init: () => void
  hasPermission: (permission: string) => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  username: null,
  userId: null,
  role: null,
  roleLabel: null,
  permissions: [],

  login: (token, username, userId, role, roleLabel, permissions) => {
    localStorage.setItem('ov_token', token)
    localStorage.setItem('ov_username', username)
    localStorage.setItem('ov_userId', userId)
    localStorage.setItem('ov_role', role)
    localStorage.setItem('ov_roleLabel', roleLabel)
    localStorage.setItem('ov_permissions', JSON.stringify(permissions))
    set({ token, username, userId, role, roleLabel, permissions })
  },

  logout: () => {
    // Drop the embedded-Opik cookie too. It is HttpOnly and path-scoped to /opik, so
    // JS cannot clear it — only the server can, and it outlives the JWT otherwise.
    // Open-source Opik has no login of its own, so a stale cookie on a shared machine
    // leaves every prompt in the deployment readable by whoever sits down next.
    //
    // Fire-and-forget: logout must never block or fail on this.
    void import('../api/aiObservability')
      .then(m => m.closeOpikSession())
      .catch(() => {})

    localStorage.removeItem('ov_token')
    localStorage.removeItem('ov_username')
    localStorage.removeItem('ov_userId')
    localStorage.removeItem('ov_role')
    localStorage.removeItem('ov_roleLabel')
    localStorage.removeItem('ov_permissions')
    set({ token: null, username: null, userId: null, role: null, roleLabel: null, permissions: [] })
  },

  init: () => {
    const token = localStorage.getItem('ov_token')
    const username = localStorage.getItem('ov_username')
    const userId = localStorage.getItem('ov_userId')
    const role = localStorage.getItem('ov_role') as RoleType | null
    const roleLabel = localStorage.getItem('ov_roleLabel')
    const permRaw = localStorage.getItem('ov_permissions')
    const permissions = permRaw ? JSON.parse(permRaw) : []
    if (token) {
      set({ token, username, userId, role, roleLabel, permissions })
    }
  },

  hasPermission: (permission: string) => {
    return get().permissions.includes(permission)
  },
}))
