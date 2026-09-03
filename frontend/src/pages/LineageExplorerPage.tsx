import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, RefreshCw } from 'lucide-react'
import { useGraphTheme } from '../hooks/useGraphTheme'
import RunInspector from '../components/provenance/RunInspector'
import {
  absTime, fmtDuration, freshnessColor, pipelineColor, pipelineMeta, relTime,
  triggerMeta,
} from '../components/provenance/pipelineMeta'
import { getProvenanceSummary, getRuns } from '../api/provenance'
import type { ProvenanceSummary, RunRecord } from '../api/provenance'

/**
 * Lineage — everything in the graph, and where it came from.
 *
 * The detail panel answers "where did THIS come from". This page answers the
 * question that only makes sense across the whole estate: which sources are
 * feeding us, are any of them stale, and how much of the graph can we actually
 * account for.
 *
 * The coverage meter is the scoreboard for the whole provenance effort. It is
 * deliberately a number that starts low and goes up, with a button that takes you
 * to the part that is still missing — an unattributed slice you cannot see is a
 * slice nobody ever fixes.
 */

// 'seed' and 'unattributed' are omitted: neither is a source anyone would filter a
// run feed by, and offering a filter that always returns nothing reads as a bug.
const FILTERABLE_PIPELINES = [
  'git', 'mcp', 'api', 'file-upload', 'dev-mate',
  'qa-mind', 'self-learning', 'manual', 'correlation',
]

const STATUS_COLOR: Record<string, string> = {
  success: '#34d399',
  failed: '#f87171',
  in_progress: '#fbbf24',
}

export default function LineageExplorerPage() {
  const gt = useGraphTheme()
  const navigate = useNavigate()

  const [summary, setSummary] = useState<ProvenanceSummary | null>(null)
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openRunId, setOpenRunId] = useState<string | null>(null)
  const [filters, setFilters] = useState<{ pipeline?: string; trigger?: string; status?: string }>({})

  const load = () => {
    setLoading(true)
    setError(null)
    Promise.all([
      getProvenanceSummary().catch(() => null),
      getRuns({ limit: 100, ...filters }).catch(() => [] as RunRecord[]),
    ])
      .then(([s, r]) => { setSummary(s); setRuns(r) })
      .catch(() => setError('Could not load lineage.'))
      .finally(() => setLoading(false))
  }

  // `filters` is the whole dependency — listing its fields individually is what
  // the lint rule objects to, and destructuring here keeps them in one place.
  const { pipeline: fPipeline, trigger: fTrigger, status: fStatus } = filters
  useEffect(load, [fPipeline, fTrigger, fStatus])  // eslint-disable-line react-hooks/exhaustive-deps

  const coverage = summary?.coverage
  const pct = coverage?.tracedPct ?? 0

  const pipelines = useMemo(
    () => (summary?.pipelines ?? []).filter(p => p.pipeline !== 'unattributed').slice(0, 8),
    [summary],
  )

  const card: React.CSSProperties = {
    background: gt.panelCard, border: `1px solid ${gt.panelCardBorder}`,
    borderRadius: 12,
  }

  return (
    <div style={{
      position: 'relative', height: '100%', overflowY: 'auto',
      background: gt.graphBg, padding: '28px 32px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 26 }}>
        <div>
          <h1 style={{
            fontSize: 24, fontWeight: 800, color: gt.panelText, margin: 0,
            fontFamily: 'Montserrat, system-ui, sans-serif',
          }}>
            Lineage
          </h1>
          <p style={{ fontSize: 12, color: gt.panelSubtext, margin: '4px 0 0' }}>
            Everything in the graph, and where it came from.
          </p>
        </div>
        <span style={{ flex: 1 }} />
        <button
          onClick={load}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            border: `1px solid ${gt.panelBorder}`, background: gt.panelCard,
            color: gt.panelSubtext, borderRadius: 8, padding: '6px 12px',
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <RefreshCw size={12} style={{
            animation: loading ? 'spin 0.9s linear infinite' : undefined,
          }} />
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ ...card, padding: 16, color: gt.panelSubtext, fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* ── Source health ─────────────────────────────────────────────────── */}
      <SectionLabel>Sources</SectionLabel>
      <div style={{
        display: 'grid', gap: 10, marginBottom: 26,
        gridTemplateColumns: 'repeat(auto-fill, minmax(158px, 1fr))',
      }}>
        {loading && !pipelines.length
          ? [0, 1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton"
                   style={{ ...card, height: 106, opacity: .5 }} />
            ))
          : pipelines.map(p => {
              const meta = pipelineMeta(p.pipeline)
              const hue = pipelineColor(p.pipeline, gt.isDark)
              const Icon = meta.icon
              const dot = freshnessColor(p.lastSeen, gt.isDark)
              return (
                <div key={p.pipeline} style={{
                  ...card, padding: '12px 13px',
                  borderTop: `2px solid ${hue}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Icon size={13} style={{ color: hue }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: hue }}>
                      {meta.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 21, fontWeight: 800, color: gt.panelText, lineHeight: 1.1 }}>
                    {p.nodes >= 1000 ? `${(p.nodes / 1000).toFixed(1)}k` : p.nodes}
                  </div>
                  <div style={{ fontSize: 9.5, color: gt.mutedText, marginTop: 1 }}>
                    nodes · {p.edges} edges
                  </div>
                  <div
                    title={absTime(p.lastSeen)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5, marginTop: 8,
                      fontSize: 10, color: gt.panelSubtext,
                    }}
                  >
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', background: dot,
                      boxShadow: `0 0 6px ${dot}88`,
                    }} />
                    {relTime(p.lastSeen)}
                  </div>
                </div>
              )
            })}
      </div>

      {/* ── Attribution coverage ──────────────────────────────────────────── */}
      {coverage && coverage.total > 0 && (
        <>
          <SectionLabel>Attribution coverage</SectionLabel>
          <div style={{ ...card, padding: '16px 18px', marginBottom: 26 }}>
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10,
            }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: gt.panelText }}>
                {pct}%
              </span>
              <span style={{ fontSize: 12, color: gt.panelSubtext }}>fully traced</span>
              <span style={{ flex: 1 }} />
              <button
                onClick={() => navigate('/ontology?colour=source')}
                style={{
                  border: `1px solid ${gt.accentBorder}`, background: gt.accentBg,
                  color: gt.accent, borderRadius: 8, padding: '5px 12px',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Show on the graph →
              </button>
            </div>

            {/* Three real slices, not a single bar: "74% traced" hides whether the
                rest is old data or a broken writer, and those need different fixes. */}
            <div style={{
              display: 'flex', height: 9, borderRadius: 5, overflow: 'hidden',
              background: gt.panelBorder,
            }}>
              <Slice n={coverage.traced} total={coverage.total} color="#34d399" title="Fully traced" />
              <Slice n={coverage.partial} total={coverage.total} color="#fbbf24" title="Written before tracing" />
              <Slice n={coverage.unattributed} total={coverage.total} color={gt.mutedText} title="No origin recorded" />
            </div>

            <div style={{
              display: 'flex', gap: 16, marginTop: 10, fontSize: 10.5,
              color: gt.panelSubtext, flexWrap: 'wrap',
            }}>
              <Key color="#34d399" label={`${coverage.traced.toLocaleString()} traced`} />
              <Key color="#fbbf24" label={`${coverage.partial.toLocaleString()} pre-trace`} />
              <Key color={gt.mutedText} label={`${coverage.unattributed.toLocaleString()} unattributed`} />
            </div>
          </div>
        </>
      )}

      {/* ── Run feed ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <SectionLabel inline>Runs</SectionLabel>
        <span style={{ flex: 1 }} />
        <Filter
          value={filters.pipeline} placeholder="All sources"
          options={FILTERABLE_PIPELINES}
          onChange={v => setFilters(f => ({ ...f, pipeline: v }))}
          labelFor={v => pipelineMeta(v).label}
        />
        <Filter
          value={filters.trigger} placeholder="Any trigger"
          options={['manual', 'scheduled', 'automatic', 'system']}
          onChange={v => setFilters(f => ({ ...f, trigger: v }))}
          labelFor={v => triggerMeta(v).label}
        />
        <Filter
          value={filters.status} placeholder="Any status"
          options={['success', 'failed', 'in_progress']}
          onChange={v => setFilters(f => ({ ...f, status: v }))}
          labelFor={v => v.replace('_', ' ')}
        />
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        {loading && !runs.length ? (
          <div style={{ padding: 20, color: gt.panelSubtext, fontSize: 12 }}>Loading runs…</div>
        ) : !runs.length ? (
          <div style={{ padding: 24, color: gt.panelSubtext, fontSize: 12, textAlign: 'center' }}>
            No runs match these filters.
            <div style={{ fontSize: 10.5, color: gt.mutedText, marginTop: 4 }}>
              Runs are recorded from the moment provenance tracking was deployed;
              anything ingested before that has no run.
            </div>
          </div>
        ) : runs.map((run, i) => {
          const meta = pipelineMeta(run.pipeline || run.loadMethod)
          const hue = pipelineColor(run.pipeline || run.loadMethod, gt.isDark)
          const Icon = meta.icon
          const trigger = triggerMeta(run.trigger)
          const status = STATUS_COLOR[run.status || ''] ?? gt.mutedText
          const isOpen = openRunId === run.versionId
          return (
            <div key={run.versionId} style={{
              borderTop: i === 0 ? 'none' : `1px solid ${gt.panelBorder}`,
            }}>
              <button
                onClick={() => setOpenRunId(isOpen ? null : run.versionId)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  padding: '11px 16px', textAlign: 'left',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = gt.rowHover)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', background: status, flexShrink: 0,
                }} title={run.status} />
                <span style={{
                  fontSize: 11, fontWeight: 700, color: gt.panelText,
                  width: 62, flexShrink: 0,
                }}>
                  {run.versionNumber || '—'}
                </span>
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  width: 118, flexShrink: 0,
                }}>
                  <Icon size={11} style={{ color: hue }} />
                  <span style={{ fontSize: 10.5, color: hue, fontWeight: 600 }}>
                    {meta.label}
                  </span>
                </span>
                <span style={{
                  fontSize: 10, color: gt.panelSubtext, width: 92, flexShrink: 0,
                }} title={trigger.hint}>
                  {trigger.glyph} {trigger.label}
                </span>
                <span style={{
                  fontSize: 10.5, color: gt.panelSubtext, flex: 1, minWidth: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }} title={run.actor}>
                  {run.actor}
                </span>
                <span
                  title={absTime(run.startedAt)}
                  style={{ fontSize: 10, color: gt.mutedText, width: 62, flexShrink: 0 }}
                >
                  {relTime(run.startedAt)}
                </span>
                <span style={{
                  fontSize: 10, color: gt.mutedText, width: 54,
                  flexShrink: 0, textAlign: 'right',
                }}>
                  {fmtDuration(run.durationMs)}
                </span>
                <span style={{
                  fontSize: 10.5, fontWeight: 700, color: '#34d399',
                  width: 46, flexShrink: 0, textAlign: 'right',
                }}>
                  +{run.stats?.nodesAdded ?? 0}
                </span>
                <ChevronRight
                  size={13}
                  style={{
                    color: gt.mutedText, flexShrink: 0,
                    transform: isOpen ? 'rotate(90deg)' : 'none',
                    transition: 'transform .15s',
                  }}
                />
              </button>

              {isOpen && (
                <div style={{ padding: '0 16px 16px 34px' }}>
                  {/* Same component the detail panel opens — one implementation,
                      two hosts, so they cannot drift. */}
                  <RunInspector
                    runId={run.versionId}
                    embedded
                    onBack={() => setOpenRunId(null)}
                    onClose={() => setOpenRunId(null)}
                    onSelectEntity={(id) =>
                      navigate(`/ontology?node=${encodeURIComponent(id)}`)}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SectionLabel({ children, inline }: { children: React.ReactNode; inline?: boolean }) {
  const gt = useGraphTheme()
  return (
    <div style={{
      fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '1.4px', color: gt.sectionLabel,
      marginBottom: inline ? 0 : 10,
    }}>
      {children}
    </div>
  )
}

function Slice({ n, total, color, title }: {
  n: number; total: number; color: string; title: string
}) {
  if (!n) return null
  return <div title={`${title}: ${n.toLocaleString()}`}
              style={{ width: `${(n / total) * 100}%`, background: color }} />
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 7, height: 7, borderRadius: 2, background: color }} />
      {label}
    </span>
  )
}

function Filter({ value, placeholder, options, onChange, labelFor }: {
  value?: string
  placeholder: string
  options: string[]
  onChange: (v: string | undefined) => void
  labelFor: (v: string) => string
}) {
  const gt = useGraphTheme()
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value || undefined)}
      style={{
        height: 28, borderRadius: 7, padding: '0 8px',
        background: gt.inputBg, border: `1px solid ${gt.inputBorder}`,
        color: value ? gt.panelText : gt.mutedText,
        fontSize: 10.5, cursor: 'pointer', outline: 'none',
      }}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{labelFor(o)}</option>)}
    </select>
  )
}
