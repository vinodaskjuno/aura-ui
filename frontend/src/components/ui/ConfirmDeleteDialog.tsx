import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Database, FolderOpen, HardDrive, Loader2, Share2, Trash2 } from 'lucide-react'
import { projectsApi } from '../../api/projects'
import type { DeletionPreview } from '../../api/projects'
import { LAYERS } from './layers'

/**
 * Deleting a project — the confirmation, and the inventory behind it.
 *
 * The dialog leads with the graph because that is what people are least likely to
 * expect to lose, and it separates what is being KEPT and why. A confirmation that
 * only says "are you sure?" gives the reader nothing to be sure about.
 *
 * The typed phrase is the project's NAME, not a constant like "DELETE". A graph wipe
 * has exactly one possible target, so a constant word is unambiguous; a project delete
 * has as many targets as there are projects, and the realistic accident is deleting
 * the wrong one — which typing "DELETE" does nothing to prevent.
 */
export default function ConfirmDeleteDialog({ projectId, projectName, onCancel, onDeleted }: {
  projectId: string
  projectName: string
  onCancel: () => void
  onDeleted: (projectId: string) => void
}) {
  const [preview, setPreview] = useState<DeletionPreview | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let stop = false
    projectsApi.deletionPreview(projectId)
      .then(({ data }) => { if (!stop) setPreview(data) })
      .catch(() => { if (!stop) setError('Could not work out what this would delete.') })
    return () => { stop = true }
  }, [projectId])

  const phrase = preview?.confirmPhrase ?? projectName
  const armed = typed.trim() === phrase && !!preview?.canDelete && !busy

  const run = async () => {
    setBusy(true)
    setError('')
    try {
      const { data } = await projectsApi.delete(projectId, typed.trim())
      if (data.ok) { onDeleted(projectId); return }
      // A partial failure is reported, not thrown: the project row survives on
      // purpose, so there is something left to retry against.
      setError('Partly deleted, and the project was kept so you can retry. '
               + JSON.stringify((data.report as any)?.errors ?? []).slice(0, 200))
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'The delete failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: LAYERS.MODAL,
                  background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 20 }}
         onClick={onCancel}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)',
                 borderRadius: 14, padding: 24, width: 520, maxHeight: '86vh',
                 overflowY: 'auto', boxShadow: 'var(--shadow-md)' }}>

        <h3 style={{ margin: '0 0 4px', fontSize: 'var(--text-title)', fontWeight: 700,
                     display: 'flex', alignItems: 'center', gap: 8 }}>
          <Trash2 size={16} color="#ef4444" />
          Delete “{projectName}”?
        </h3>

        {!preview && !error && (
          <p style={muted}><Loader2 size={12} className="animate-spin" /> Working out
            what this would remove…</p>
        )}

        {preview && (
          <>
            <div style={{ display: 'grid', gap: 10, margin: '16px 0' }}>
              {/* The graph first: it is what people least expect to lose. */}
              <Row icon={<Share2 size={13} />} label="Knowledge graph"
                   value={preview.graph.nodes
                     ? `${preview.graph.nodes} node${preview.graph.nodes === 1 ? '' : 's'} wiped`
                     : 'nothing in the graph'}
                   detail={labelSummary(preview)} emphasis />
              <Row icon={<Database size={13} />} label="Records"
                   value={`${preview.dynamodb.totalRows} row${preview.dynamodb.totalRows === 1 ? '' : 's'}`}
                   detail={tableSummary(preview)} />
              <Row icon={<HardDrive size={13} />} label="Stored files"
                   value={preview.s3.objects
                     ? `${preview.s3.objects} object${preview.s3.objects === 1 ? '' : 's'} · ${mb(preview.s3.bytes)}`
                     : 'none'}
                   detail="test evidence, analysis and exports" />
              {preview.workspace.exists && (
                <Row icon={<FolderOpen size={13} />} label="Working copy"
                     value={`${preview.workspace.files} files · ${mb(preview.workspace.bytes)}`}
                     detail={preview.workspace.path} />
              )}
            </div>

            {preview.excluded.length > 0 && (
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
                <div style={{ fontSize: 'var(--text-caption)', fontWeight: 700, textTransform: 'uppercase',
                              letterSpacing: '.06em', color: 'var(--color-text-secondary)',
                              marginBottom: 6 }}>
                  Not deleted
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid',
                             gap: 6 }}>
                  {preview.excluded.map((item, i) => (
                    <li key={i} style={{ fontSize: 'var(--text-caption)', lineHeight: 1.55,
                                         color: 'var(--color-text-secondary)' }}>
                      <strong style={{ color: 'var(--color-text)' }}>{item.what}</strong>
                      {item.count ? ` (${item.count})` : ''} — {item.detail}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {preview.blockers.length > 0 && (
              <div style={warn}>
                <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <strong>Not right now.</strong>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                    {preview.blockers.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                </div>
              </div>
            )}

            <div style={{ ...warn, background: 'rgba(239,68,68,.1)',
                          borderColor: 'rgba(239,68,68,.35)', color: '#fca5a5' }}>
              <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                <strong>This cannot be undone.</strong> The file storage has no
                versioning and there is no snapshot to restore from.
              </span>
            </div>

            <label style={{ display: 'grid', gap: 6, marginTop: 14 }}>
              <span style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-secondary)' }}>
                Type <strong style={{ fontFamily: 'var(--font-mono, monospace)',
                                      color: 'var(--color-text)' }}>{phrase}</strong> to
                confirm
              </span>
              <input value={typed} onChange={e => setTyped(e.target.value)}
                     disabled={busy || !preview.canDelete}
                     autoFocus
                     style={{ background: 'var(--color-surface)', fontSize: 'var(--text-body)',
                              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                              padding: '9px 11px', color: 'var(--color-text)',
                              fontFamily: 'var(--font-mono, monospace)' }} />
            </label>
          </>
        )}

        {!!error && (
          <p style={{ fontSize: 'var(--text-body)', color: '#ef4444', marginTop: 12, lineHeight: 1.6 }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end',
                      marginTop: 18 }}>
          <button onClick={onCancel} disabled={busy}
                  style={{ ...btn, background: 'var(--color-surface)',
                           border: '1px solid var(--color-border)',
                           color: 'var(--color-text)' }}>
            Cancel
          </button>
          <button onClick={run} disabled={!armed}
                  style={{ ...btn,
                           border: '1px solid rgba(239,68,68,.5)',
                           background: 'rgba(239,68,68,.14)', color: '#fca5a5',
                           cursor: armed ? 'pointer' : 'not-allowed',
                           opacity: armed ? 1 : 0.5 }}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Delete everything
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function Row({ icon, label, value, detail, emphasis }: {
  icon: React.ReactNode; label: string; value: string
  detail?: string; emphasis?: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ color: emphasis ? '#ef4444' : 'var(--color-text-secondary)',
                     marginTop: 2 }}>{icon}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 'var(--text-body)' }}>
          <strong>{label}</strong>{' '}
          <span style={{ color: emphasis ? '#ef4444' : 'var(--color-text)' }}>{value}</span>
        </div>
        {detail && (
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-secondary)',
                        marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {detail}
          </div>
        )}
      </div>
    </div>
  )
}

function labelSummary(p: DeletionPreview): string {
  const merged: Record<string, number> = {}
  for (const engine of Object.values(p.graph.engines || {})) {
    for (const [label, n] of Object.entries(engine.byLabel || {})) {
      merged[label] = Math.max(merged[label] ?? 0, n)
    }
  }
  const parts = Object.entries(merged).sort((a, b) => b[1] - a[1]).slice(0, 5)
  return parts.length ? parts.map(([l, n]) => `${l} ${n}`).join(' · ') : ''
}

function tableSummary(p: DeletionPreview): string {
  return p.dynamodb.tables
    .filter(t => !t.kept && t.rows > 0)
    .slice(0, 4)
    .map(t => `${t.table} ${t.rows}`)
    .join(' · ')
}

function mb(bytes: number): string {
  if (!bytes) return '0 MB'
  const mbs = bytes / (1024 * 1024)
  return mbs < 0.1 ? `${Math.round(bytes / 1024)} KB` : `${mbs.toFixed(1)} MB`
}

const muted: React.CSSProperties = {
  fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)', display: 'flex',
  alignItems: 'center', gap: 6, margin: '14px 0',
}
const warn: React.CSSProperties = {
  display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12,
  fontSize: 'var(--text-caption)', lineHeight: 1.6, padding: '9px 11px', borderRadius: 'var(--radius-sm)',
  background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)',
  color: '#fcd34d',
}
const btn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
  borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-body)', fontWeight: 600, border: 'none', cursor: 'pointer',
}
