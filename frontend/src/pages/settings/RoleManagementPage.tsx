import client from '../../api/client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck, Save } from 'lucide-react'

const ALL_PERMISSIONS = [
  { key: 'dashboard',       label: 'Dashboard',          group: 'Workspace' },
  { key: 'dev_workspace',   label: 'Dev Workspace',       group: 'Workspace' },
  { key: 'qa_workspace',    label: 'QA / Testing',        group: 'Workspace' },
  { key: 'aiops',           label: 'AI Ops',              group: 'Workspace' },
  { key: 'observability',   label: 'Observability (SRE)', group: 'Workspace' },
  { key: 'knowledge_graph', label: 'Knowledge Graph',     group: 'Workspace' },
  { key: 'ontology',        label: 'Onto Verse',          group: 'Workspace' },
  { key: 'advisor',         label: 'AI Advisor',          group: 'Workspace' },
  { key: 'connectors',      label: 'Connectors',          group: 'Data' },
  { key: 'scheduler',       label: 'Scheduler',           group: 'Data' },
  { key: 'upload',          label: 'Upload',              group: 'Data' },
  { key: 'logs',            label: 'Logs',                group: 'Data' },
  { key: 'ontology_maintain', label: 'Onto Verse Maintain (Write)', group: 'Ontology' },
  { key: 'settings',        label: 'Settings',            group: 'Admin' },
  { key: 'user_management', label: 'User Management',     group: 'Admin' },
  { key: 'role_management', label: 'Role Management',     group: 'Admin' },
]

const PERMISSION_GROUPS = ['Workspace', 'Ontology', 'Data', 'Admin']

const ROLE_COLORS: Record<string, string> = {
  user_dev:            '#4f8ef7',
  user_qa:             '#10b981',
  user_ops:            '#f59e0b',
  admin:               '#8b5cf6',
  super_admin:         '#ef4444',
  ontology_maintainer: '#4a9eff',
}

interface Role {
  roleId: string
  label: string
  permissions: string[]
}

// Reuse the shared client: relative baseURL (same-origin) + auth interceptor.
// A private axios instance here previously defaulted to http://localhost:8000,
// which made this page call the viewer's own machine in any deployment.
const api = () => client

export default function RoleManagementPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [selected, setSelected] = useState<Role | null>(null)
  const [perms, setPerms] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fetchRoles = async () => {
    const res = await api().get('/auth/roles')
    setRoles(res.data)
    if (res.data.length > 0 && !selected) {
      setSelected(res.data[0])
      setPerms(res.data[0].permissions)
    }
  }

  useEffect(() => { fetchRoles() }, [])

  const selectRole = (role: Role) => {
    setSelected(role)
    setPerms([...role.permissions])
    setSaved(false)
  }

  const togglePerm = (key: string) => {
    setPerms(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key])
    setSaved(false)
  }

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await api().put(`/auth/roles/${selected.roleId}`, { permissions: perms })
      setSaved(true)
      fetchRoles()
    } finally { setSaving(false) }
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <div className="section-label" style={{ marginBottom: 4 }}>Admin</div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldCheck size={22} color="var(--color-primary)" /> Role Management
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16 }}>
        {/* Role list */}
        <motion.div className="ov-card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}
          initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 8px' }}>Roles</div>
          {roles.map(role => (
            <button
              key={role.roleId}
              onClick={() => selectRole(role)}
              style={{
                background: selected?.roleId === role.roleId ? `${ROLE_COLORS[role.roleId] ?? 'var(--color-primary)'}22` : 'transparent',
                border: `1px solid ${selected?.roleId === role.roleId ? ROLE_COLORS[role.roleId] ?? 'var(--color-primary)' : 'transparent'}`,
                borderRadius: 8, padding: '10px 12px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
              }}
            >
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13, color: selected?.roleId === role.roleId ? ROLE_COLORS[role.roleId] : 'var(--color-text)' }}>
                {role.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>
                {role.permissions?.length ?? 0} permissions
              </div>
            </button>
          ))}
        </motion.div>

        {/* Permission editor */}
        {selected && (
          <motion.div className="ov-card" style={{ padding: 20 }}
            initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} key={selected.roleId}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16, color: ROLE_COLORS[selected.roleId] ?? 'var(--color-primary)' }}>{selected.label}</div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{perms.length} of {ALL_PERMISSIONS.length} permissions enabled</div>
              </div>
              <motion.button
                className="ov-btn ov-btn-primary"
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={handleSave}
                disabled={saving}
                style={{ gap: 6 }}
              >
                <Save size={13} />
                {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Role'}
              </motion.button>
            </div>

            {PERMISSION_GROUPS.map(group => (
              <div key={group} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>{group}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                  {ALL_PERMISSIONS.filter(p => p.group === group).map(p => {
                    const enabled = perms.includes(p.key)
                    return (
                      <motion.button
                        key={p.key}
                        onClick={() => togglePerm(p.key)}
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                        style={{
                          background: enabled ? `${ROLE_COLORS[selected.roleId] ?? 'var(--color-primary)'}18` : 'var(--color-card)',
                          border: `1px solid ${enabled ? ROLE_COLORS[selected.roleId] ?? 'var(--color-primary)' : 'var(--color-border)'}`,
                          borderRadius: 8, padding: '10px 14px', cursor: 'pointer', textAlign: 'left',
                          display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.15s',
                        }}
                      >
                        <div style={{
                          width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                          background: enabled ? ROLE_COLORS[selected.roleId] ?? 'var(--color-primary)' : 'transparent',
                          border: `2px solid ${enabled ? ROLE_COLORS[selected.roleId] ?? 'var(--color-primary)' : 'var(--color-border)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {enabled && <div style={{ width: 6, height: 6, borderRadius: 1, background: '#fff' }} />}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: enabled ? 600 : 400, color: enabled ? 'var(--color-text)' : 'var(--color-subtext)' }}>
                          {p.label}
                        </span>
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}
