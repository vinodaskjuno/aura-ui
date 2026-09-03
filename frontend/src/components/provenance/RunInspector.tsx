import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { useGraphTheme } from '../../hooks/useGraphTheme'
import { getRunDetail } from '../../api/provenance'
import type { RunDetail } from '../../api/provenance'
import {
  absTime, fmtDuration, pipelineColor, pipelineMeta, relTime, triggerMeta,
} from './pipelineMeta'

/**
 * One ingestion run: what triggered it, what it read, what it wrote, what broke.
 *
 * Opens over the detail panel with a back chevron rather than a close X, so the
 * node you were looking at stays selected underneath — following a run pill is a
 * detour, not a change of subject.
 */

interface Props {
  runId: string | null
  onBack: () => void
  onClose: () => void
  onSelectEntity?: (entityId: string) => void
  /** Rendered inline (Lineage page) rather than as a floating drawer. */
  embedded?: boolean
}

export default function RunInspector({
  runId, onBack, onClose, onSelectEntity, embedded,
}: Props) {
  const gt = useGraphTheme()
  const [data, setData] = useState<RunDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    if (!runId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getRunDetail(runId)
      .then(d => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setError('Could not load this run.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [runId])

  const entities = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    if (!q) return data.entities
    return data.entities.filter(e =>
      e.name.toLowerCase().includes(q) || (e.label || '').toLowerCase().includes(q))
  }, [data, query])

  if (!runId) return null

  const meta = pipelineMeta(data?.pipeline || data?.loadMethod)
  const hue = pipelineColor(data?.pipeline || data?.loadMethod, gt.isDark)
  const Icon = meta.icon
  const trigger = triggerMeta(data?.trigger)
  const stats = data?.stats || {}
  const errors = data?.errors || []

  const shell: React.CSSProperties = embedded
    ? { padding: '4px 0' }
    : {
        position: 'absolute', top: 52, bottom: 0, right: 0, width: 420, zIndex: 40,
        background: gt.panelBg, backdropFilter: 'blur(20px)',
        borderLeft: `1px solid ${gt.panelBorder}`, padding: 22,
        overflowY: 'auto',
      }

  const card: React.CSSProperties = {
    padding: '10px 12px', background: gt.panelCard,
    border: `1px solid ${gt.panelCardBorder}`, borderRadius: 8,
  }

  return (
    <div className={embedded ? '' : 'animate-slide-in-right'} style={shell}>
      {!embedded && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <button
            onClick={onBack}
            title="Back to the entity"
            style={{
              border: 'none', background: 'none', color: gt.panelSubtext,
              cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0,
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 15, fontWeight: 700, color: gt.panelText,
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <Icon size={14} style={{ color: hue }} />
              Run {data?.versionNumber || ''}
            </div>
            <div style={{ fontSize: 10, color: gt.panelSubtext, marginTop: 1 }}>
              {meta.label} ingestion
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none', background: 'none', color: gt.panelSubtext,
              fontSize: 18, cursor: 'pointer', lineHeight: 1,
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[52, 78, 62].map((h, i) => (
            <div key={i} className="skeleton"
                 style={{ height: h, borderRadius: 8, background: gt.panelCard, opacity: .5 }} />
          ))}
        </div>
      )}

      {error && (
        <div style={{ color: gt.panelSubtext, fontSize: 12, padding: '20px 0' }}>{error}</div>
      )}

      {data && !loading && (
        <>
          {/* Trigger + timing */}
          <div style={{ ...card, borderLeft: `3px solid ${hue}`, marginBottom: 14 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6, flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: gt.panelText }}>
                {trigger.glyph} {trigger.label}
              </span>
              <span style={{
                fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase',
                padding: '1px 6px', borderRadius: 4,
                background: data.status === 'success' ? '#34d39922'
                  : data.status === 'failed' ? '#f8717122' : '#fbbf2422',
                color: data.status === 'success' ? '#34d399'
                  : data.status === 'failed' ? '#f87171' : '#fbbf24',
              }}>
                {data.status}
              </span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 10, color: gt.panelSubtext }}>
                {fmtDuration(data.durationMs)}
              </span>
            </div>
            <Row label="Actor" value={data.actor || '—'} />
            <Row label="Started" value={absTime(data.startedAt)} hint={relTime(data.startedAt)} />
            {data.notes && <Row label="Notes" value={data.notes} />}
          </div>

          {/* Source */}
          {(data.sourceDetail || (data.sources?.length ?? 0) > 0 || data.fileInfo?.name) && (
            <div style={{ marginBottom: 14 }}>
              <Label>Source</Label>
              <div style={card}>
                {data.sourceDetail && <Row label="From" value={data.sourceDetail} mono />}
                {data.fileInfo?.name && (
                  <Row
                    label="File"
                    value={`${data.fileInfo.name}${data.fileInfo.size
                      ? ` · ${(data.fileInfo.size / 1024).toFixed(0)} KB` : ''}`}
                    mono
                  />
                )}
                {(data.sources?.length ?? 0) > 0 && (
                  <Row label="Connectors" value={data.sources!.join(', ')} />
                )}
                {data.projectId && <Row label="Project" value={data.projectId} mono />}
              </div>
            </div>
          )}

          {/* Stat tiles */}
          <div style={{ marginBottom: 14 }}>
            <Label>Wrote</Label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              <Tile n={stats.nodesAdded ?? 0} label="new" color="#34d399" />
              <Tile n={stats.nodesUpdated ?? 0} label="updated" color={hue} />
              <Tile n={stats.nodesUnchanged ?? 0} label="same" color={gt.mutedText} />
              <Tile n={stats.nodesRetired ?? 0} label="retired" color="#f87171" />
            </div>
            <div style={{ fontSize: 10, color: gt.panelSubtext, marginTop: 7 }}>
              edges +{stats.relsAdded ?? 0}
              {(stats.relsArchived ?? 0) > 0 && ` · archived ${stats.relsArchived}`}
            </div>
          </div>

          {/* Errors — the current Data Loader UI throws these away, so a run that
              skipped half its input looks identical to a clean one. */}
          {errors.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <button
                onClick={() => setShowErrors(v => !v)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 7,
                  border: '1px solid #f8717144', background: '#f8717112',
                  color: '#f87171', borderRadius: 8, padding: '7px 10px',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}
              >
                <AlertTriangle size={12} />
                {errors.length} error{errors.length === 1 ? '' : 's'}
                <span style={{ flex: 1 }} />
                <ChevronRight
                  size={13}
                  style={{
                    transform: showErrors ? 'rotate(90deg)' : 'none',
                    transition: 'transform .15s',
                  }}
                />
              </button>
              {showErrors && (
                <div style={{ ...card, marginTop: 6 }}>
                  {errors.map((e, i) => (
                    <div key={i} style={{
                      fontSize: 9.5, color: gt.panelSubtext, marginBottom: 3,
                      fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.5,
                      wordBreak: 'break-word',
                    }}>
                      {e}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Entities written */}
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
            }}>
              <Label inline>Entities written</Label>
              <span style={{ flex: 1 }} />
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: gt.inputBg, border: `1px solid ${gt.inputBorder}`,
                borderRadius: 6, padding: '3px 7px',
              }}>
                <Search size={11} style={{ color: gt.mutedText }} />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="search…"
                  style={{
                    border: 'none', background: 'transparent', outline: 'none',
                    color: gt.inputText, fontSize: 10, width: 88,
                  }}
                />
              </div>
            </div>

            {entities.length === 0 ? (
              <div style={{ fontSize: 11, color: gt.mutedText, padding: '10px 0' }}>
                {query ? 'Nothing matches that.' : 'No entities recorded for this run.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {entities.map(e => (
                  <button
                    key={e.id}
                    onClick={() => onSelectEntity?.(e.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      border: 'none', background: 'transparent', cursor: onSelectEntity ? 'pointer' : 'default',
                      padding: '5px 7px', borderRadius: 6, textAlign: 'left',
                    }}
                    onMouseEnter={ev => (ev.currentTarget.style.background = gt.rowHover)}
                    onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{
                      fontSize: 10.5, color: gt.panelText, flex: 1, minWidth: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }} title={e.name}>
                      {e.name}
                    </span>
                    <span style={{ fontSize: 9, color: gt.mutedText, flexShrink: 0 }}>
                      {e.label}
                    </span>
                    <span style={{
                      fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase',
                      padding: '1px 5px', borderRadius: 4, flexShrink: 0,
                      background: e.change === 'new' ? '#34d39922' : `${hue}1e`,
                      color: e.change === 'new' ? '#34d399' : hue,
                    }}>
                      {e.change}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* A capped list that says nothing about being capped reads as complete. */}
            {data.entitiesTruncated && (
              <div style={{
                fontSize: 9.5, color: gt.mutedText, marginTop: 8, fontStyle: 'italic',
              }}>
                Showing the first {data.entities.length} — this run touched more.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Label({ children, inline }: { children: React.ReactNode; inline?: boolean }) {
  const gt = useGraphTheme()
  return (
    <div style={{
      fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '1.2px', color: gt.sectionLabel,
      marginBottom: inline ? 0 : 8,
    }}>
      {children}
    </div>
  )
}

function Tile({ n, label, color }: { n: number; label: string; color: string }) {
  const gt = useGraphTheme()
  return (
    <div style={{
      background: gt.panelCard, border: `1px solid ${gt.panelCardBorder}`,
      borderRadius: 8, padding: '8px 4px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 16, fontWeight: 800, color, lineHeight: 1.1 }}>
        {n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n}
      </div>
      <div style={{
        fontSize: 8.5, color: gt.mutedText, textTransform: 'uppercase',
        letterSpacing: '.5px', marginTop: 2,
      }}>
        {label}
      </div>
    </div>
  )
}

function Row({ label, value, hint, mono }: {
  label: string; value: string; hint?: string; mono?: boolean
}) {
  const gt = useGraphTheme()
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 3, alignItems: 'baseline' }}>
      <span style={{ fontSize: 10.5, color: gt.panelSubtext, width: 68, flexShrink: 0 }}>
        {label}
      </span>
      <span
        title={value}
        style={{
          fontSize: 10.5, color: gt.panelText, minWidth: 0,
          fontFamily: mono ? 'JetBrains Mono, monospace' : undefined,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {value}
        {hint && <span style={{ color: gt.mutedText, marginLeft: 6 }}>· {hint}</span>}
      </span>
    </div>
  )
}
