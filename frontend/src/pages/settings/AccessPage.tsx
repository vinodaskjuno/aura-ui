import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, KeyRound, Loader2,
  Plus, Search, ShieldCheck, Trash2, XCircle,
} from 'lucide-react'
import {
  getLdapConfig, getLocalAccounts, previewLdapUser, rotatePassword,
  saveLdapConfig, testLdap,
  type LdapConfig, type LdapMapping, type LdapPreview, type LocalAccount,
  type OrgRole,
} from '../../api/directory'
import { ALL_NAV_GROUPS } from '../../components/layout/navGroups'
import { buildMenuPermissions } from '../../components/layout/menuPermissions'

/**
 * Access — who may sign in, and what they see.
 *
 * Replaces User Management and Role Management. Both were writable, and under
 * Active Directory neither did what it said: local accounts no longer granted
 * anyone access, and a role's permission set was written to a table the directory
 * path never read. This page has one editable chain instead:
 *
 *     AD group  →  Organization role  →  menus
 *
 * The sections are ordered the way the question is actually asked. You start from
 * "what should Engineering be able to see", not from a list of group names.
 */

const input: React.CSSProperties = {
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  borderRadius: 6, padding: '6px 9px', color: 'var(--color-text)', fontSize: 12.5,
}
const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px',
  borderRadius: 7, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff',
}
const ghost: React.CSSProperties = {
  ...btn, background: 'var(--color-surface)', color: 'var(--color-text)',
  border: '1px solid var(--color-border)',
}
const label: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '.11em', textTransform: 'uppercase',
  color: 'var(--color-subtext)',
}

function slug(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function AccessPage() {
  const [config, setConfig] = useState<LdapConfig | null>(null)
  const [orgRoles, setOrgRoles] = useState<OrgRole[]>([])
  const [mappings, setMappings] = useState<LdapMapping[]>([])
  const [enabled, setEnabled] = useState(false)
  const [accounts, setAccounts] = useState<LocalAccount[]>([])

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null)
  const [previewName, setPreviewName] = useState('')
  const [preview, setPreview] = useState<LdapPreview | null>(null)
  const [openRole, setOpenRole] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const c = await getLdapConfig()
      setConfig(c); setOrgRoles(c.orgRoles); setMappings(c.mappings); setEnabled(c.enabled)
    } catch { setErr('Could not read the access configuration.') }
    try { setAccounts(await getLocalAccounts()) } catch { /* roster is optional */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const patchRole = (id: string, patch: Partial<OrgRole>) =>
    setOrgRoles(list => list.map(r => (r.id === id ? { ...r, ...patch } : r)))

  const togglePermission = (id: string, key: string) =>
    setOrgRoles(list => list.map(r => {
      if (r.id !== id) return r
      const has = r.permissions.includes(key)
      return { ...r, permissions: has ? r.permissions.filter(p => p !== key)
                                      : [...r.permissions, key] }
    }))

  const addRole = () => {
    const id = `org-${orgRoles.length + 1}`
    setOrgRoles(list => [...list, {
      id, label: '', description: '', basedOn: '', permissions: [], priority: 50,
    }])
    setOpenRole(id)
  }

  const removeRole = (id: string) => {
    setOrgRoles(list => list.filter(r => r.id !== id))
    // Leaving a group pointing at a deleted role would fail validation on save with
    // a message about the group rather than the role — detach here instead.
    setMappings(list => list.map(m => (m.orgRoleId === id ? { ...m, orgRoleId: '' } : m)))
  }

  /** Renaming is what an admin expects to be able to do; the id is machinery. */
  const renameRole = (id: string, labelText: string) => {
    const next = slug(labelText) || id
    patchRole(id, { label: labelText })
    if (next === id || orgRoles.some(r => r.id === next)) return
    setOrgRoles(list => list.map(r => (r.id === id ? { ...r, id: next } : r)))
    setMappings(list => list.map(m => (m.orgRoleId === id ? { ...m, orgRoleId: next } : m)))
    setOpenRole(cur => (cur === id ? next : cur))
  }

  const applyTemplate = (id: string, templateId: string) => {
    const t = config?.roleTemplates.find(x => x.id === templateId)
    patchRole(id, {
      basedOn: templateId,
      ...(t ? { permissions: [...t.permissions] } : {}),
    })
  }

  const save = async () => {
    setBusy(true); setErr(''); setMsg(''); setTest(null)
    try {
      const saved = await saveLdapConfig({ enabled, orgRoles, mappings })
      setConfig(c => (c ? { ...c, ...saved } : c))
      setMsg(enabled
        ? 'Saved. Directory sign-in is on — menus follow these organization roles.'
        : 'Saved. Directory sign-in is off; local accounts still sign in.')
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? 'Could not save.')
    } finally { setBusy(false) }
  }

  const groupsUsing = useMemo(() => {
    const counts = new Map<string, number>()
    for (const m of mappings) counts.set(m.orgRoleId, (counts.get(m.orgRoleId) ?? 0) + 1)
    return counts
  }, [mappings])

  const byGroup = useMemo(() => {
    const menuPermissions = buildMenuPermissions(ALL_NAV_GROUPS)
    const out = new Map<string, typeof menuPermissions>()
    for (const p of menuPermissions) {
      const list = out.get(p.group) ?? []
      list.push(p)
      out.set(p.group, list)
    }
    return [...out.entries()]
  }, [])

  if (loading) {
    return <div style={{ padding: 28, color: 'var(--color-subtext)', fontSize: 13 }}>
      <Loader2 size={14} className="spin" /> Loading access configuration…
    </div>
  }

  return (
    <div style={{ padding: '26px 30px 80px', maxWidth: 1000 }}>
      <header style={{ marginBottom: 26 }}>
        <h1 style={{
          fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 800, margin: 0,
        }}>Access</h1>
        <p style={{
          color: 'var(--color-subtext)', fontSize: 13, margin: '5px 0 0', maxWidth: '64ch',
        }}>
          A directory group attaches to an organization role, and the organization
          role decides which menus its people see.
        </p>
      </header>

      {err && <Banner tone="bad" icon={<XCircle size={13} />}>{err}</Banner>}
      {msg && <Banner tone="good" icon={<CheckCircle2 size={13} />}>{msg}</Banner>}

      {/* ── 1. Organization roles ─────────────────────────────────────────── */}
      <Section
        title="Organization roles"
        note="What a business function may open. Attach groups to these below."
        action={<button style={ghost} onClick={addRole}><Plus size={13} /> Add role</button>}
      >
        {orgRoles.length === 0 && (
          <Empty>No organization roles yet. Add one, pick a template to start from,
            then tick the menus it should open.</Empty>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {orgRoles.map(role => {
            const open = openRole === role.id
            const used = groupsUsing.get(role.id) ?? 0
            return (
              <div key={role.id} style={{
                border: '1px solid var(--color-border)', borderRadius: 9,
                background: 'var(--color-card)',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px',
                }}>
                  <button
                    onClick={() => setOpenRole(open ? null : role.id)}
                    aria-expanded={open}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--color-subtext)', display: 'flex', padding: 0,
                    }}
                  >
                    {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </button>
                  <input
                    value={role.label}
                    placeholder="Engineering"
                    onChange={e => renameRole(role.id, e.target.value)}
                    style={{ ...input, flex: 1, fontWeight: 600 }}
                  />
                  <span style={{ ...label, whiteSpace: 'nowrap' }}>
                    {role.permissions.length} menu{role.permissions.length === 1 ? '' : 's'}
                  </span>
                  <span style={{
                    ...label,
                    color: used ? 'var(--color-subtext)' : 'var(--color-warning)',
                    whiteSpace: 'nowrap',
                  }}>
                    {used} group{used === 1 ? '' : 's'}
                  </span>
                  <button
                    onClick={() => removeRole(role.id)}
                    title="Remove this organization role"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--color-danger)', display: 'flex', padding: 4,
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {open && (
                  <div style={{
                    borderTop: '1px solid var(--color-border)', padding: '13px',
                    display: 'flex', flexDirection: 'column', gap: 14,
                  }}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <Field labelText="Start from">
                        <select
                          value={role.basedOn}
                          onChange={e => applyTemplate(role.id, e.target.value)}
                          style={{ ...input, minWidth: 170 }}
                        >
                          <option value="">Custom</option>
                          {config?.roleTemplates.map(t => (
                            <option key={t.id} value={t.id}>{t.label}</option>
                          ))}
                        </select>
                      </Field>
                      <Field labelText="Priority">
                        <input
                          type="number" value={role.priority}
                          onChange={e => patchRole(role.id, { priority: Number(e.target.value) })}
                          style={{ ...input, width: 80 }}
                        />
                      </Field>
                      <Field labelText="Description" grow>
                        <input
                          value={role.description}
                          placeholder="Builds and ships product code"
                          onChange={e => patchRole(role.id, { description: e.target.value })}
                          style={{ ...input, width: '100%' }}
                        />
                      </Field>
                    </div>

                    <div>
                      <div style={{ ...label, marginBottom: 8 }}>Menus this role opens</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {byGroup.map(([groupName, perms]) => (
                          <div key={groupName}>
                            <div style={{
                              fontSize: 9.5, fontWeight: 700, letterSpacing: '.1em',
                              color: 'var(--color-muted)', marginBottom: 5,
                            }}>{groupName}</div>
                            <div style={{
                              display: 'grid', gap: 4,
                              gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                            }}>
                              {perms.map(p => (
                                <label key={p.key} style={{
                                  display: 'flex', alignItems: 'center', gap: 7,
                                  fontSize: 12, cursor: 'pointer', padding: '3px 0',
                                }}>
                                  <input
                                    type="checkbox"
                                    checked={role.permissions.includes(p.key)}
                                    onChange={() => togglePermission(role.id, p.key)}
                                  />
                                  <span>{p.menus.join(' · ')}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      {/* ── 2. Directory groups ───────────────────────────────────────────── */}
      <Section
        title="Directory groups"
        note="Which AD group makes someone part of which organization role."
        action={
          <button style={ghost}
            onClick={() => setMappings(l => [...l, { group: '', orgRoleId: '' }])}>
            <Plus size={13} /> Add group
          </button>
        }
      >
        <label style={{
          display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14,
          fontSize: 13, cursor: 'pointer',
        }}>
          <input type="checkbox" checked={enabled}
            onChange={e => setEnabled(e.target.checked)} />
          <span>Sign in with Active Directory</span>
          <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>
            — when off, only local accounts can sign in
          </span>
        </label>

        {mappings.length === 0 && <Empty>No groups mapped yet.</Empty>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {mappings.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={m.group}
                placeholder="AURA-Dev"
                onChange={e => setMappings(l =>
                  l.map((x, idx) => (idx === i ? { ...x, group: e.target.value } : x)))}
                style={{ ...input, flex: 1 }}
              />
              <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>→</span>
              <select
                value={m.orgRoleId}
                onChange={e => setMappings(l =>
                  l.map((x, idx) => (idx === i ? { ...x, orgRoleId: e.target.value } : x)))}
                style={{ ...input, flex: 1 }}
              >
                <option value="">Choose an organization role…</option>
                {orgRoles.map(r => (
                  <option key={r.id} value={r.id}>{r.label || r.id}</option>
                ))}
              </select>
              <button
                onClick={() => setMappings(l => l.filter((_, idx) => idx !== i))}
                title="Remove this group"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-danger)', display: 'flex', padding: 4,
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <button style={btn} onClick={save} disabled={busy}>
            {busy ? <Loader2 size={13} className="spin" /> : <ShieldCheck size={13} />}
            Save
          </button>
          <button style={ghost} disabled={busy}
            onClick={async () => { setTest(null); setTest(await testLdap()) }}>
            Test connection
          </button>
        </div>

        {test && (
          <div style={{
            marginTop: 10, fontSize: 12.5,
            color: test.ok ? 'var(--color-success)' : 'var(--color-danger)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {test.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
            {test.message}
          </div>
        )}

        {config && !config.connection.bindPasswordSet && (
          <div style={{
            marginTop: 12, fontSize: 12.5, color: 'var(--color-warning)',
            display: 'flex', alignItems: 'flex-start', gap: 7,
          }}>
            <AlertTriangle size={13} style={{ marginTop: 2, flexShrink: 0 }} />
            The service-account password is not set. Store it in Secrets Manager as
            <code style={{ margin: '0 4px' }}>aura-{'{env}'}/ldap-bind-password</code>
            — sign-in cannot work until it is.
          </div>
        )}
      </Section>

      {/* ── 3. Who would get what ─────────────────────────────────────────── */}
      <Section
        title="Check a person"
        note="What access would they get, and why. Answered without their password."
      >
        <div style={{ display: 'flex', gap: 8, maxWidth: 460 }}>
          <input
            value={previewName}
            placeholder="priya"
            onChange={e => setPreviewName(e.target.value)}
            onKeyDown={async e => {
              if (e.key === 'Enter' && previewName.trim()) {
                setPreview(await previewLdapUser(previewName.trim()))
              }
            }}
            style={{ ...input, flex: 1 }}
          />
          <button style={ghost} disabled={!previewName.trim()}
            onClick={async () => setPreview(await previewLdapUser(previewName.trim()))}>
            <Search size={13} /> Check
          </button>
        </div>

        {preview && (
          <div style={{
            marginTop: 14, padding: '12px 14px', borderRadius: 9,
            background: 'var(--color-card)', border: '1px solid var(--color-border)',
            fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 7,
          }}>
            {!preview.ok ? (
              <span style={{ color: 'var(--color-danger)' }}>{preview.message}</span>
            ) : (
              <>
                <Row k="Signs in">
                  <span style={{
                    color: preview.wouldSignIn
                      ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600,
                  }}>
                    {preview.wouldSignIn ? 'Yes' : 'No — belongs to no mapped group'}
                  </span>
                </Row>
                <Row k="In groups">{preview.groups.join(', ') || '—'}</Row>
                <Row k="Matched">{preview.matchedGroups.join(', ') || '—'}</Row>
                {preview.roleLabel && <Row k="Org role">{preview.roleLabel}</Row>}
                <Row k="Menus">{preview.permissions.join(', ') || '—'}</Row>
              </>
            )}
          </div>
        )}
      </Section>

      {/* ── 4. Break-glass ────────────────────────────────────────────────── */}
      <Section
        title="Break-glass accounts"
        note="Local sign-in for when the directory is unreachable or misconfigured — including when it is this screen that needs fixing."
      >
        {accounts.length === 0 ? (
          <Empty>No local accounts.</Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {accounts.map(a => (
              <BreakGlassRow key={a.userId} account={a} onDone={setMsg} onError={setErr} />
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

// ── Small pieces ────────────────────────────────────────────────────────────

function Section({ title, note, action, children }: {
  title: string; note: string; action?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <section style={{ marginBottom: 30 }}>
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 12,
        paddingBottom: 9, borderBottom: '1px solid var(--color-border)',
      }}>
        <div style={{ flex: 1 }}>
          <h2 style={{
            fontFamily: 'var(--font-heading)', fontSize: 14.5, fontWeight: 800, margin: 0,
          }}>{title}</h2>
          <p style={{
            fontSize: 12, color: 'var(--color-subtext)', margin: '3px 0 0', maxWidth: '68ch',
          }}>{note}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Field({ labelText, children, grow }: {
  labelText: string; children: React.ReactNode; grow?: boolean
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      flex: grow ? 1 : undefined, minWidth: grow ? 190 : undefined,
    }}>
      <span style={label}>{labelText}</span>
      {children}
    </div>
  )
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <span style={{ ...label, width: 78, flexShrink: 0 }}>{k}</span>
      <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{children}</span>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{
    fontSize: 12.5, color: 'var(--color-muted)', padding: '10px 0', maxWidth: '62ch',
  }}>{children}</div>
}

function Banner({ tone, icon, children }: {
  tone: 'good' | 'bad'; icon: React.ReactNode; children: React.ReactNode
}) {
  const color = tone === 'good' ? 'var(--color-success)' : 'var(--color-danger)'
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16,
      padding: '10px 13px', borderRadius: 8, fontSize: 12.5, color,
      background: 'var(--color-card)', border: '1px solid var(--color-border)',
      borderLeft: `3px solid ${color}`,
    }}>
      <span style={{ marginTop: 2 }}>{icon}</span>
      <span>{children}</span>
    </div>
  )
}

function BreakGlassRow({ account, onDone, onError }: {
  account: LocalAccount
  onDone: (m: string) => void
  onError: (m: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)

  const rotate = async () => {
    setBusy(true)
    try {
      await rotatePassword(account.userId, pw)
      onDone(`New password set for ${account.username}.`)
      setPw(''); setOpen(false)
    } catch (e: any) {
      onError(e?.response?.data?.detail ?? 'Could not set the password.')
    } finally { setBusy(false) }
  }

  return (
    <div style={{
      border: '1px solid var(--color-border)', borderRadius: 8,
      background: 'var(--color-card)', padding: '10px 13px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{account.username}</span>
        {account.breakGlass && (
          <span style={{
            ...label, color: 'var(--color-warning)',
            border: '1px solid var(--color-warning)', borderRadius: 4, padding: '1px 6px',
          }}>Break-glass</span>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>
          {account.lastLogin
            ? `last in ${new Date(account.lastLogin).toLocaleDateString()}`
            : 'never signed in'}
        </span>
        <button style={{ ...ghost, padding: '5px 10px' }} onClick={() => setOpen(o => !o)}>
          <KeyRound size={12} /> Set password
        </button>
      </div>

      {open && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
          <input
            type="password" value={pw} autoComplete="new-password"
            placeholder="At least 12 characters"
            onChange={e => setPw(e.target.value)}
            style={{ ...input, flex: 1, maxWidth: 300 }}
          />
          <button style={btn} onClick={rotate} disabled={busy || pw.length < 12}>
            {busy ? <Loader2 size={12} className="spin" /> : null} Save
          </button>
        </div>
      )}
    </div>
  )
}
