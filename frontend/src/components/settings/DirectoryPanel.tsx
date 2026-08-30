import { useCallback, useEffect, useState } from 'react'
import {
  Loader2, Plus, Trash2, CheckCircle2, XCircle, Search, ShieldCheck, AlertTriangle,
} from 'lucide-react'
import {
  getLdapConfig, previewLdapUser, saveLdapConfig, testLdap,
  type LdapConfig, type LdapMapping, type LdapPreview,
} from '../../api/directory'

const input: React.CSSProperties = {
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  borderRadius: 6, padding: '6px 9px', color: 'var(--color-text)', fontSize: 12.5,
}
const btn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 7,
  fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff',
}
const ghost: React.CSSProperties = {
  ...btn, background: 'var(--color-surface)', color: 'var(--color-text)',
  border: '1px solid var(--color-border)',
}

/**
 * Directory sign-in: which AD group grants which permissions.
 *
 * Menus follow permissions, so a mapping here is what decides what a person sees —
 * no code change and no redeploy.
 */
export default function DirectoryPanel() {
  const [config, setConfig] = useState<LdapConfig | null>(null)
  const [mappings, setMappings] = useState<LdapMapping[]>([])
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null)
  const [previewName, setPreviewName] = useState('')
  const [preview, setPreview] = useState<LdapPreview | null>(null)

  const load = useCallback(async () => {
    try {
      const c = await getLdapConfig()
      setConfig(c); setMappings(c.mappings); setEnabled(c.enabled)
    } catch { setErr('Could not read the directory configuration.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const update = (i: number, patch: Partial<LdapMapping>) =>
    setMappings(list => list.map((m, idx) => (idx === i ? { ...m, ...patch } : m)))

  const save = async () => {
    setBusy(true); setErr(''); setMsg(''); setTest(null)
    try {
      const saved = await saveLdapConfig({ enabled, mappings })
      setConfig(c => (c ? { ...c, ...saved } : c))
      setMsg(enabled
        ? 'Saved. Directory sign-in is active — access now follows AD groups.'
        : 'Saved. Directory sign-in is off; local accounts are in use.')
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setErr(detail || 'Could not save.')
    } finally { setBusy(false) }
  }

  if (loading) {
    return <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5,
      color: 'var(--color-subtext)' }}><Loader2 size={14} className="animate-spin" /> Loading…</div>
  }
  if (!config) return <div style={{ fontSize: 12.5, color: '#ef4444' }}>{err}</div>

  const c = config.connection
  // An empty URI means nobody has pointed this environment at a directory yet —
  // distinct from a directory configured over plaintext, which is a fault.
  const configured = !!c.uri.trim()
  const secure = c.uri.startsWith('ldaps://')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 12.5, color: 'var(--color-subtext)', lineHeight: 1.6 }}>
        Grant access by adding people to Active Directory groups. Menus follow the
        permissions a group maps to, so nothing here needs a deploy.
      </div>

      {/* Connection is read-only: it carries a service-account password that lives in
          Secrets Manager, shown for confirmation rather than editing. */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 8, padding: '11px 13px', display: 'grid',
        gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11.5 }}>
        {[['Server', c.uri || '(not configured)'], ['Base DN', c.baseDn || '(not set)'],
          ['Bind DN', c.bindDn || '(anonymous)'], ['User filter', c.userFilter],
          ['Service password', c.bindPasswordSet ? 'set' : 'not stored yet'],
          ['Transport', !configured ? '—'
            : secure ? 'TLS'
            : c.allowInsecure ? 'plaintext (allowed)' : 'plaintext (blocked)']]
          .map(([k, v]) => (
          <div key={k}>
            <div style={{ color: 'var(--color-muted)', fontSize: 10, textTransform: 'uppercase',
              letterSpacing: '.6px' }}>{k}</div>
            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}>{v}</div>
          </div>
        ))}
      </div>

      {!configured && (
        <div style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--color-subtext)' }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            This environment has no directory yet. A platform engineer sets{' '}
            <code>ldap_uri</code>, <code>ldap_base_dn</code> and <code>ldap_bind_dn</code>{' '}
            in the deployment and stores the service-account password in Secrets
            Manager. You can prepare the group mappings below in the meantime.
          </span>
        </div>
      )}

      {configured && !secure && !c.allowInsecure && (
        <div style={{ display: 'flex', gap: 8, fontSize: 12, color: '#fbbf24' }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          Sign-in will be refused: a plaintext bind sends the password in clear text.
          Use <code>ldaps://</code>, or allow it explicitly for a lab server.
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" style={{ ...ghost, opacity: configured ? 1 : 0.5,
          cursor: configured ? 'pointer' : 'not-allowed' }} disabled={busy || !configured}
          onClick={async () => { setBusy(true); try { setTest(await testLdap()) } finally { setBusy(false) } }}>
          <ShieldCheck size={12} /> Test connection
        </button>
        {test && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
            color: test.ok ? '#10b981' : '#ef4444' }}>
            {test.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />} {test.message}
          </span>
        )}
      </div>

      {/* Mappings */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--color-muted)', textTransform: 'uppercase',
          letterSpacing: '.6px', marginBottom: 7 }}>
          Group → access. Several groups give the union; the highest priority names the role.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {mappings.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
              <input value={m.group} placeholder="AURA-Dev" style={{ ...input, flex: 1 }}
                onChange={e => update(i, { group: e.target.value })} />
              <select value={m.roleId} style={{ ...input, width: 170 }}
                onChange={e => update(i, { roleId: e.target.value })}>
                <option value="">— permissions only —</option>
                {config.availableRoles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <input value={m.permissions.join(', ')} placeholder="extra permissions (optional)"
                style={{ ...input, flex: 1 }}
                onChange={e => update(i, {
                  permissions: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                })} />
              <input type="number" value={m.priority} title="Priority — highest wins the role"
                style={{ ...input, width: 74 }}
                onChange={e => update(i, { priority: Number(e.target.value) || 0 })} />
              <button type="button" title="Remove"
                onClick={() => setMappings(l => l.filter((_, idx) => idx !== i))}
                style={{ background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-muted)', display: 'flex', padding: 4 }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <button type="button" style={{ ...ghost, marginTop: 8 }}
          onClick={() => setMappings(l => [...l, { group: '', roleId: 'user_dev', permissions: [], priority: 50 }])}>
          <Plus size={12} /> Add group
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5,
          color: 'var(--color-text)', cursor: 'pointer' }}>
          <input type="checkbox" checked={enabled} disabled={!configured}
            onChange={e => setEnabled(e.target.checked)} />
          Use Active Directory for sign-in
        </label>
        <button type="button" style={btn} disabled={busy} onClick={save}>
          {busy ? <Loader2 size={12} className="animate-spin" /> : null} Save
        </button>
        {msg && <span style={{ fontSize: 12, color: '#10b981' }}>{msg}</span>}
        {err && <span style={{ fontSize: 12, color: '#ef4444' }}>{err}</span>}
      </div>

      {enabled && (
        <div style={{ fontSize: 11.5, color: 'var(--color-muted)', lineHeight: 1.55 }}>
          Local accounts marked <strong>break-glass</strong> can still sign in if the
          directory is unreachable — without one, a wrong bind DN would lock everyone
          out of this page.
        </div>
      )}

      {/* Preview — answers "why can't Priya see QualityMind" without her password. */}
      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 13 }}>
        <div style={{ fontSize: 10, color: 'var(--color-muted)', textTransform: 'uppercase',
          letterSpacing: '.6px', marginBottom: 7 }}>Preview a person's access</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={previewName} onChange={e => setPreviewName(e.target.value)}
            placeholder="username" style={{ ...input, width: 220 }} />
          <button type="button" style={ghost} disabled={busy || !previewName.trim()}
            onClick={async () => {
              setBusy(true)
              try { setPreview(await previewLdapUser(previewName.trim())) }
              finally { setBusy(false) }
            }}>
            <Search size={12} /> Check
          </button>
        </div>

        {preview && (
          <div style={{ marginTop: 10, fontSize: 12, background: 'var(--color-surface)',
            border: '1px solid var(--color-border)', borderRadius: 8, padding: '11px 13px' }}>
            {!preview.ok ? (
              <span style={{ color: '#ef4444' }}>{preview.message}</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ color: preview.wouldSignIn ? '#10b981' : '#f59e0b', fontWeight: 700 }}>
                  {preview.wouldSignIn
                    ? `Would sign in as ${preview.roleId}`
                    : 'Would be REFUSED — in no mapped group'}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11,
                  color: 'var(--color-subtext)' }}>{preview.dn}</div>
                <div>
                  <span style={{ color: 'var(--color-muted)' }}>matched: </span>
                  {preview.matchedGroups.length ? preview.matchedGroups.join(', ') : '—'}
                </div>
                {!!preview.unmatchedGroups?.length && (
                  <div style={{ color: 'var(--color-muted)' }}>
                    other groups: {preview.unmatchedGroups.join(', ')}
                  </div>
                )}
                <div>
                  <span style={{ color: 'var(--color-muted)' }}>permissions: </span>
                  {preview.permissions.length ? preview.permissions.join(', ') : '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                  groups found via {preview.groupSource}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
