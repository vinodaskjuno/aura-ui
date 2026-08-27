import client from '../../api/client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Plus, Edit2, UserX, UserCheck, Search, X, Eye, EyeOff } from 'lucide-react'

const ROLE_OPTIONS = [
  { value: 'user_dev',    label: 'User + Dev' },
  { value: 'user_qa',     label: 'User + QA' },
  { value: 'user_ops',    label: 'User + Ops' },
  { value: 'admin',       label: 'Admin' },
  { value: 'super_admin', label: 'Super Admin' },
]

const ROLE_COLORS: Record<string, string> = {
  user_dev:    '#4f8ef7',
  user_qa:     '#10b981',
  user_ops:    '#f59e0b',
  admin:       '#8b5cf6',
  super_admin: '#ef4444',
}

interface User {
  userId: string
  username: string
  email: string
  roleId: string
  status: string
  createdAt: string
  lastLogin?: string
}

interface CreateForm {
  username: string
  email: string
  roleId: string
  password: string
}

// Reuse the shared client: relative baseURL (same-origin) + auth interceptor.
// A private axios instance here previously defaulted to http://localhost:8000,
// which made this page call the viewer's own machine in any deployment.
const api = () => client

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [form, setForm] = useState<CreateForm>({ username: '', email: '', roleId: 'user_dev', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchUsers = async () => {
    try {
      const res = await api().get('/auth/users')
      setUsers(res.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchUsers() }, [])

  const filtered = users.filter(u => {
    const matchSearch = u.username.toLowerCase().includes(search.toLowerCase()) ||
                        u.email.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' || u.roleId === roleFilter
    return matchSearch && matchRole
  })

  const handleCreate = async () => {
    setError('')
    setSaving(true)
    try {
      await api().post('/auth/users', form)
      setShowCreate(false)
      setForm({ username: '', email: '', roleId: 'user_dev', password: '' })
      fetchUsers()
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'Failed to create user')
    } finally { setSaving(false) }
  }

  const handleEdit = async () => {
    if (!editUser) return
    setSaving(true)
    try {
      await api().put(`/auth/users/${editUser.userId}`, {
        email: editUser.email,
        roleId: editUser.roleId,
        status: editUser.status,
      })
      setEditUser(null)
      fetchUsers()
    } finally { setSaving(false) }
  }

  const handleToggleStatus = async (user: User) => {
    await api().put(`/auth/users/${user.userId}`, {
      status: user.status === 'active' ? 'inactive' : 'active',
    })
    fetchUsers()
  }

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="section-label" style={{ marginBottom: 4 }}>Admin</div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={22} color="var(--color-primary)" /> User Management
          </h2>
        </div>
        <motion.button
          className="ov-btn ov-btn-primary"
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={() => { setShowCreate(true); setError('') }}
        >
          <Plus size={14} /> Create User
        </motion.button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
          <input
            className="ov-input"
            style={{ paddingLeft: 30, fontSize: 12 }}
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="ov-input"
          style={{ width: 160, fontSize: 12 }}
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
        >
          <option value="all">All Roles</option>
          {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <motion.div className="ov-card" style={{ overflow: 'hidden' }}
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>Loading users...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['Name', 'Email', 'Role', 'Status', 'Last Login', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <motion.tr key={u.userId}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  style={{ borderBottom: '1px solid var(--color-border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-card)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: ROLE_COLORS[u.roleId] ?? 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {u.username.slice(0, 1).toUpperCase()}
                      </div>
                      {u.username}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-subtext)' }}>{u.email}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 5, padding: '3px 8px', background: `${ROLE_COLORS[u.roleId] ?? '#888'}22`, color: ROLE_COLORS[u.roleId] ?? 'var(--color-text)' }}>
                      {ROLE_OPTIONS.find(r => r.value === u.roleId)?.label ?? u.roleId}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 5, padding: '3px 8px', background: u.status === 'active' ? '#10b98122' : '#ef444422', color: u.status === 'active' ? '#10b981' : '#ef4444' }}>
                      {u.status === 'active' ? '● Active' : '○ Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-muted)', fontSize: 12 }}>
                    {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => setEditUser({ ...u })}
                        style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                      >
                        <Edit2 size={11} /> Edit
                      </button>
                      <button
                        onClick={() => handleToggleStatus(u)}
                        style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: u.status === 'active' ? '#ef4444' : '#10b981', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                      >
                        {u.status === 'active' ? <><UserX size={11} /> Deactivate</> : <><UserCheck size={11} /> Activate</>}
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>No users found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </motion.div>

      {/* Create User Modal */}
      <AnimatePresence>
        {showCreate && (
          <Modal title="Create User" onClose={() => setShowCreate(false)}>
            <FormField label="Full Name / Username">
              <input className="ov-input" placeholder="vinoth.k" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
            </FormField>
            <FormField label="Email">
              <input className="ov-input" placeholder="vinoth@aura.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </FormField>
            <FormField label="Role">
              <select className="ov-input" value={form.roleId} onChange={e => setForm(f => ({ ...f, roleId: e.target.value }))}>
                {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </FormField>
            <FormField label="Temporary Password">
              <div style={{ position: 'relative' }}>
                <input className="ov-input" type={showPass ? 'text' : 'password'} style={{ paddingRight: 36 }} placeholder="Min 8 characters" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                <button onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}>
                  {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </FormField>
            {error && <div style={{ background: '#ef444422', border: '1px solid #ef4444', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#ef4444' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="ov-btn ov-btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="ov-btn ov-btn-primary" onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Create User'}</button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editUser && (
          <Modal title={`Edit — ${editUser.username}`} onClose={() => setEditUser(null)}>
            <FormField label="Email">
              <input className="ov-input" value={editUser.email} onChange={e => setEditUser(u => u ? ({ ...u, email: e.target.value }) : u)} />
            </FormField>
            <FormField label="Role">
              <select className="ov-input" value={editUser.roleId} onChange={e => setEditUser(u => u ? ({ ...u, roleId: e.target.value }) : u)}>
                {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </FormField>
            <FormField label="Status">
              <select className="ov-input" value={editUser.status} onChange={e => setEditUser(u => u ? ({ ...u, status: e.target.value }) : u)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </FormField>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="ov-btn ov-btn-ghost" onClick={() => setEditUser(null)}>Cancel</button>
              <button className="ov-btn ov-btn-primary" onClick={handleEdit} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 16 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16, color: 'var(--color-text)' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', display: 'flex', borderRadius: 6, padding: 4 }}><X size={15} /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-subtext)', fontFamily: 'var(--font-heading)' }}>{label}</label>
      {children}
    </div>
  )
}
