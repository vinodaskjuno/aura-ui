import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Activity, MessagesSquare, Database, FlaskConical, FileCode2, Play,
  Loader2, RefreshCw, Info, CheckCircle2, XCircle, LayoutDashboard, Rocket,
  Search, ThumbsDown, ThumbsUp, Waypoints, X,
} from 'lucide-react'
import * as api from '../api/aiObservability'
import TraceWaterfall from '../components/aiobs/TraceWaterfall'
import SpanDetail from '../components/aiobs/SpanDetail'
import OverviewTab from './aiobs/OverviewTab'
import OnboardingTab from './aiobs/OnboardingTab'
import EvaluationsTab from './aiobs/EvaluationsTab'
import OpikEmbed from './aiobs/OpikEmbed'
// Hoisted out of this file: every new tab needs them, and duplicating the objects per
// file is how they drift apart.
import { btn, card, ghost, input, money } from './aiobs/styles'

type Tab = 'overview' | 'traces' | 'threads' | 'datasets' | 'experiments'
  | 'evaluations' | 'prompts' | 'playground' | 'onboard' | 'opik'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={13} /> },
  { id: 'traces', label: 'Traces', icon: <Activity size={13} /> },
  { id: 'threads', label: 'Threads', icon: <MessagesSquare size={13} /> },
  { id: 'datasets', label: 'Datasets', icon: <Database size={13} /> },
  { id: 'experiments', label: 'Experiments', icon: <FlaskConical size={13} /> },
  { id: 'evaluations', label: 'Evaluations', icon: <Waypoints size={13} /> },
  { id: 'prompts', label: 'Prompts', icon: <FileCode2 size={13} /> },
  { id: 'playground', label: 'Playground', icon: <Play size={13} /> },
  { id: 'onboard', label: 'Onboard agent', icon: <Rocket size={13} /> },
  { id: 'opik', label: 'More in Opik', icon: <Waypoints size={13} /> },
]

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12.5, color: 'var(--color-subtext)', padding: 16 }}>{children}</div>
}

export default function AIObservabilityPage() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'overview'
  const setTab = (id: Tab) => {
    const next = new URLSearchParams(params); next.set('tab', id); setParams(next)
  }

  const [projects, setProjects] = useState<api.ProjectRow[]>([])
  const [project, setProject] = useState(params.get('project') || '')
  const [caps, setCaps] = useState<api.StoreCapabilities | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.listProjects().then(r => {
      setProjects(r.projects)
      setProject(p => p || r.projects[0]?.projectId || '')
    }).catch(() => setErr('Could not load projects.'))
    api.getCapabilities().then(setCaps).catch(() => {})
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div className="section-label" style={{ marginBottom: 4 }}>AI Observability</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-subtext)', maxWidth: 620, lineHeight: 1.6 }}>
            Tracing and evaluation for LLM applications. Instrument an agent from the{' '}
            <strong>Onboard agent</strong> tab, or send traces from any OpenTelemetry SDK
            to <code>/otlp/v1/traces</code> with a gateway key.
          </div>
          {caps?.degraded && (
            <div style={{ marginTop: 7, fontSize: 11.5, color: '#f59e0b' }}>
              The {caps.store} trace store is unreachable — lists may appear empty.
            </div>
          )}
        </div>
        {projects.length > 0 && (
          <select
            value={project}
            onChange={e => setProject(e.target.value)}
            style={{ ...input, width: 220 }}
          >
            {projects.map(p => (
              <option key={p.projectId} value={p.projectId}>
                {p.projectId} ({p.traceCount})
              </option>
            ))}
          </select>
        )}
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5,
              borderBottom: `2px solid ${tab === t.id ? '#4f46e5' : 'transparent'}`,
              color: tab === t.id ? '#a5b4fc' : 'var(--color-muted)',
              fontWeight: tab === t.id ? 700 : 500,
            }}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {err && <div style={{ fontSize: 12, color: '#ef4444' }}>{err}</div>}

      <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}>
        {tab === 'overview' && <OverviewTab project={project} />}
        {tab === 'traces' && <TracesTab project={project} caps={caps} />}
        {tab === 'threads' && <ThreadsTab project={project} />}
        {tab === 'datasets' && <DatasetsTab project={project} />}
        {tab === 'experiments' && <ExperimentsTab project={project} />}
        {tab === 'evaluations' && <EvaluationsTab project={project} />}
        {tab === 'prompts' && <PromptsTab project={project} />}
        {tab === 'playground' && <PlaygroundTab />}
        {tab === 'onboard' && <OnboardingTab project={project} caps={caps} />}
        {tab === 'opik' && <OpikEmbed project={project}
          opikUiUrl={caps?.opikUiUrl} opikEnabled={caps?.opikEnabled} />}
      </motion.div>
    </div>
  )
}

// ── Traces ───────────────────────────────────────────────────────────────────

function TracesTab({ project, caps }: { project: string; caps: api.StoreCapabilities | null }) {
  const [traces, setTraces] = useState<api.TraceRow[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [openId, setOpenId] = useState('')
  const [spans, setSpans] = useState<api.SpanRow[]>([])
  const [span, setSpan] = useState<api.SpanRow | null>(null)
  // `search` is the term typed; `applied` is what was actually sent. Kept apart so
  // typing does not fire a ClickHouse full-text query per keystroke.
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState('')
  const [rating, setRating] = useState('')

  const canSearch = !!caps?.fullTextSearch

  const load = useCallback(() => {
    if (!project) return
    setLoading(true)
    // Only forwarded when the store can serve it — the API returns 400 rather than
    // handing back an unfiltered list that looks filtered.
    api.listTraces(project, { status, search: canSearch ? applied : '' })
      .then(r => setTraces(r.traces))
      .catch(() => setTraces([]))
      .finally(() => setLoading(false))
  }, [project, status, applied, canSearch])

  useEffect(() => { load() }, [load])

  /** Human feedback, stored wherever the active store keeps scores. */
  const rate = async (t: api.TraceRow, value: number) => {
    setRating(t.traceId)
    try {
      await api.setFeedback(t.traceId, project, { name: 'user_feedback', value })
      // Reflect it immediately rather than refetching the whole list: under Opik the
      // score is only readable after its own write settles.
      setTraces(rows => rows.map(r => r.traceId === t.traceId
        ? { ...r, onlineScores: [...(r.onlineScores ?? []).filter(s => s.name !== 'user_feedback'),
            { name: 'user_feedback', value, passed: value >= 0.5 }] }
        : r))
    } catch { /* the row simply keeps its previous score */ }
    finally { setRating('') }
  }

  const open = async (t: api.TraceRow) => {
    setOpenId(t.traceId); setSpan(null)
    try {
      const r = await api.getTrace(t.traceId, project)
      setSpans(r.spans)
      setSpan(r.spans[0] ?? null)
    } catch { setSpans([]) }
  }

  if (!project) return <Empty>No project has sent traces yet.</Empty>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...input, width: 150 }}>
          <option value="">All statuses</option>
          <option value="ok">OK</option>
          <option value="error">Error</option>
        </select>

        {/* Rendered only when the store reports fullTextSearch. On DynamoDB there is
            no index for it, so offering the box at all would be a lie. */}
        {canSearch && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, width: 260 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={12} style={{ position: 'absolute', left: 9, top: 9,
                color: 'var(--color-muted)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') setApplied(search) }}
                placeholder="Search prompts and completions…"
                style={{ ...input, paddingLeft: 26 }}
              />
            </div>
            {applied && (
              <button type="button" title="Clear search"
                onClick={() => { setSearch(''); setApplied('') }}
                style={{ ...ghost, padding: '6px 8px' }}>
                <X size={12} />
              </button>
            )}
          </div>
        )}

        <button type="button" onClick={load} style={ghost}>
          <RefreshCw size={12} /> Refresh
        </button>
        {loading && <Loader2 size={14} className="animate-spin" style={{ color: '#818cf8' }} />}
        {/* The store is honest about what it can filter, so the UI does not offer
            a control that would silently turn into a table scan. */}
        {caps && !caps.fullTextSearch && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
            color: 'var(--color-muted)', marginLeft: 'auto' }} title={caps.note}>
            <Info size={11} /> {caps.store}: no free-text search
          </span>
        )}
      </div>

      {traces.length === 0 ? (
        <Empty>No traces yet for <strong>{project}</strong>.</Empty>
      ) : (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          {traces.map(t => (
            <div key={t.traceId}>
              <div
                onClick={() => (openId === t.traceId ? setOpenId('') : open(t))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  cursor: 'pointer', borderBottom: '1px solid var(--color-border)',
                  background: openId === t.traceId ? 'rgba(79,70,229,0.06)' : 'transparent',
                }}
              >
                {t.status === 'error'
                  ? <XCircle size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
                  : <CheckCircle2 size={13} style={{ color: '#10b981', flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)' }}>
                    {t.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-muted)', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.inputPreview || t.traceId}
                  </div>
                </div>
                {(t.onlineScores ?? []).map(s => (
                  <span key={s.name} title={`${s.name}: ${s.value}`}
                    style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4,
                      color: s.passed ? '#10b981' : '#f59e0b',
                      background: s.passed ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)' }}>
                    {s.name} {s.value.toFixed(2)}
                  </span>
                ))}
                <span style={{ fontSize: 11, color: 'var(--color-subtext)', fontFamily: 'var(--font-mono)' }}>
                  {t.spanCount} spans
                </span>
                <span style={{ fontSize: 11, color: 'var(--color-subtext)', fontFamily: 'var(--font-mono)', width: 62, textAlign: 'right' }}>
                  {t.latencyMs}ms
                </span>
                <span style={{ fontSize: 11, color: '#10b981', fontFamily: 'var(--font-mono)', width: 76, textAlign: 'right' }}>
                  {money(t.costUsd)}
                </span>
              </div>

              {openId === t.traceId && (
                <div style={{ display: 'flex', gap: 12, padding: 12,
                  borderBottom: '1px solid var(--color-border)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Human feedback sits next to the waterfall because this is where
                        someone has just finished reading the trace and formed an
                        opinion. It is stored as the same kind of object as a judge
                        score, which is what makes the two comparable. */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7,
                      marginBottom: 9 }}>
                      <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                        Was this a good response?
                      </span>
                      <button type="button" onClick={() => rate(t, 1)}
                        disabled={rating === t.traceId}
                        style={{ ...ghost, padding: '3px 9px', fontSize: 11 }}>
                        <ThumbsUp size={11} /> Good
                      </button>
                      <button type="button" onClick={() => rate(t, 0)}
                        disabled={rating === t.traceId}
                        style={{ ...ghost, padding: '3px 9px', fontSize: 11 }}>
                        <ThumbsDown size={11} /> Bad
                      </button>
                      {rating === t.traceId &&
                        <Loader2 size={12} className="animate-spin" style={{ color: '#818cf8' }} />}
                      {caps && caps.feedbackScores === false && (
                        <span style={{ fontSize: 10.5, color: 'var(--color-muted)' }}
                          title="On DynamoDB scores are a JSON blob on the row, not a queryable field.">
                          not filterable on {caps.store}
                        </span>
                      )}
                      {t.otelTraceId && (
                        <span style={{ fontSize: 10.5, color: 'var(--color-muted)',
                          marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}
                          title="The trace id your OpenTelemetry SDK generated. Opik mints its own, so this is kept in metadata for correlation.">
                          otel: {t.otelTraceId.slice(0, 12)}…
                        </span>
                      )}
                    </div>
                    <TraceWaterfall spans={spans} selectedId={span?.spanId ?? ''} onSelect={setSpan} />
                  </div>
                  <div style={{ width: 380, flexShrink: 0, borderLeft: '1px solid var(--color-border)' }}>
                    <SpanDetail traceId={t.traceId} span={span} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Threads ──────────────────────────────────────────────────────────────────

function ThreadsTab({ project }: { project: string }) {
  const [threads, setThreads] = useState<api.ThreadRow[]>([])
  useEffect(() => {
    if (project) api.listThreads(project).then(r => setThreads(r.threads)).catch(() => setThreads([]))
  }, [project])

  if (threads.length === 0) {
    return (
      <Empty>
        No threads yet. A trace joins a thread when the client sets{' '}
        <code>session.id</code> (or <code>gen_ai.conversation.id</code>) on its spans.
      </Empty>
    )
  }
  return (
    <div style={{ ...card, padding: 0 }}>
      {threads.map(t => (
        <div key={t.threadId} style={{ display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>
          <MessagesSquare size={13} style={{ color: '#818cf8', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)' }}>
              {t.threadId}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t.lastInput}
            </div>
          </div>
          <span style={{ fontSize: 11, color: 'var(--color-subtext)' }}>{t.traceCount} turns</span>
          <span style={{ fontSize: 11, color: 'var(--color-subtext)', fontFamily: 'var(--font-mono)' }}>
            {t.totalTokens} tok
          </span>
          <span style={{ fontSize: 11, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
            {money(t.costUsd)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Datasets ─────────────────────────────────────────────────────────────────

function DatasetsTab({ project }: { project: string }) {
  const [list, setList] = useState<api.DatasetMeta[]>([])
  const [openId, setOpenId] = useState('')
  const [items, setItems] = useState<api.DatasetItem[]>([])
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.listDatasets(project).then(r => setList(r.datasets)).catch(() => setList([]))
  }, [project])
  useEffect(() => { load() }, [load])

  const open = async (id: string) => {
    setOpenId(id === openId ? '' : id)
    if (id !== openId) {
      try { setItems((await api.getDataset(id)).items) } catch { setItems([]) }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="New dataset name" style={{ ...input, maxWidth: 280 }} />
        <button type="button" disabled={!name.trim() || busy} style={btn}
          onClick={async () => {
            setBusy(true)
            try { await api.createDataset({ name: name.trim(), projectId: project }); setName(''); load() }
            finally { setBusy(false) }
          }}>
          Create
        </button>
      </div>

      {list.length === 0 ? (
        <Empty>No datasets yet. Create one, then seed it from captured traces.</Empty>
      ) : (
        <div style={{ ...card, padding: 0 }}>
          {list.map(d => (
            <div key={d.datasetId}>
              <div onClick={() => open(d.datasetId)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}>
                <Database size={13} style={{ color: '#06b6d4' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{d.datasetId}</div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--color-subtext)' }}>{d.itemCount} items</span>
              </div>
              {openId === d.datasetId && (
                <div style={{ padding: 12, borderBottom: '1px solid var(--color-border)' }}>
                  {items.length === 0 ? <Empty>No items.</Empty> : items.slice(0, 40).map(it => (
                    <div key={it.itemId} style={{ display: 'flex', gap: 10, padding: '6px 0',
                      fontSize: 11.5, borderBottom: '1px solid var(--color-border)' }}>
                      <span style={{ flex: 1, color: 'var(--color-text)' }}>{it.input.slice(0, 110)}</span>
                      <span style={{ flex: 1, color: 'var(--color-subtext)' }}>{it.expected.slice(0, 110)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Experiments ──────────────────────────────────────────────────────────────

function ExperimentsTab({ project }: { project: string }) {
  const [list, setList] = useState<api.ExperimentMeta[]>([])
  const [datasets, setDatasets] = useState<api.DatasetMeta[]>([])
  const [metrics, setMetrics] = useState<{ heuristics: string[]; judges: { name: string; label: string }[] }>(
    { heuristics: [], judges: [] })
  const [name, setName] = useState('')
  const [datasetId, setDatasetId] = useState('')
  const [chosen, setChosen] = useState<Set<string>>(new Set(['exact_match']))
  const [chosenJudges, setChosenJudges] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [openId, setOpenId] = useState('')
  const [results, setResults] = useState<api.ExperimentResult[]>([])

  const load = useCallback(() => {
    api.listExperiments(project).then(r => setList(r.experiments)).catch(() => setList([]))
    api.listDatasets(project).then(r => {
      setDatasets(r.datasets); setDatasetId(id => id || r.datasets[0]?.datasetId || '')
    }).catch(() => {})
  }, [project])
  useEffect(() => { load(); api.listMetrics().then(setMetrics).catch(() => {}) }, [load])

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, v: string) => {
    const next = new Set(set); next.has(v) ? next.delete(v) : next.add(v); setter(next)
  }

  const chip = (active: boolean): React.CSSProperties => ({
    fontSize: 11, padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
    background: active ? 'rgba(79,70,229,0.18)' : 'var(--color-surface)',
    color: active ? '#a5b4fc' : 'var(--color-subtext)',
    border: `1px solid ${active ? 'transparent' : 'var(--color-border)'}`,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Experiment name" style={{ ...input, maxWidth: 240 }} />
          <select value={datasetId} onChange={e => setDatasetId(e.target.value)}
            style={{ ...input, maxWidth: 240 }}>
            {datasets.map(d => <option key={d.datasetId} value={d.datasetId}>{d.name}</option>)}
          </select>
          <button type="button" disabled={!name.trim() || !datasetId || busy} style={btn}
            onClick={async () => {
              setBusy(true)
              try {
                await api.createExperiment({
                  name: name.trim(), datasetId, projectId: project,
                  config: { metrics: [...chosen], judges: [...chosenJudges] },
                })
                setName(''); load()
              } finally { setBusy(false) }
            }}>
            Create
          </button>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--color-muted)', textTransform: 'uppercase',
            letterSpacing: '0.6px', marginBottom: 5 }}>
            Heuristics — deterministic and free
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {metrics.heuristics.map(m => (
              <span key={m} onClick={() => toggle(chosen, setChosen, m)} style={chip(chosen.has(m))}>{m}</span>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--color-muted)', textTransform: 'uppercase',
            letterSpacing: '0.6px', marginBottom: 5 }}>
            LLM judges — billable and non-deterministic
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {metrics.judges.map(j => (
              <span key={j.name} onClick={() => toggle(chosenJudges, setChosenJudges, j.name)}
                style={chip(chosenJudges.has(j.name))}>{j.label}</span>
            ))}
          </div>
        </div>
      </div>

      {list.length === 0 ? <Empty>No experiments yet.</Empty> : (
        <div style={{ ...card, padding: 0 }}>
          {list.map(e => (
            <div key={e.experimentId}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                borderBottom: '1px solid var(--color-border)' }}>
                <FlaskConical size={13} style={{ color: '#8b5cf6' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{e.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                    {e.status}
                    {e.summary?.itemCount != null && ` · ${e.summary.itemCount} items`}
                    {e.summary?.totalCostUsd ? ` · ${money(e.summary.totalCostUsd)}` : ''}
                  </div>
                </div>
                {e.summary?.overallPassRate != null && (
                  <span style={{ fontSize: 12, fontWeight: 700,
                    color: e.summary.overallPassRate >= 0.8 ? '#10b981'
                      : e.summary.overallPassRate >= 0.5 ? '#f59e0b' : '#ef4444' }}>
                    {(e.summary.overallPassRate * 100).toFixed(0)}%
                  </span>
                )}
                <button type="button" style={ghost} disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    try { await api.runExperiment(e.experimentId, {}); load() }
                    finally { setBusy(false) }
                  }}>
                  <Play size={11} /> Run
                </button>
                <button type="button" style={ghost}
                  onClick={async () => {
                    const next = openId === e.experimentId ? '' : e.experimentId
                    setOpenId(next)
                    if (next) {
                      try { setResults((await api.getExperiment(next)).results) } catch { setResults([]) }
                    }
                  }}>
                  Results
                </button>
              </div>
              {openId === e.experimentId && (
                <div style={{ padding: 12, borderBottom: '1px solid var(--color-border)' }}>
                  {results.length === 0 ? <Empty>No results — run it first.</Empty> : results.map(r => (
                    <div key={r.itemKey} style={{ padding: '7px 0', fontSize: 11.5,
                      borderBottom: '1px solid var(--color-border)' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {r.passed ? <CheckCircle2 size={12} style={{ color: '#10b981' }} />
                          : <XCircle size={12} style={{ color: '#ef4444' }} />}
                        <span style={{ flex: 1, color: 'var(--color-text)' }}>{r.input.slice(0, 90)}</span>
                        <span style={{ color: 'var(--color-subtext)' }}>{r.output.slice(0, 60)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 3, paddingLeft: 20, flexWrap: 'wrap' }}>
                        {r.scores.map(s => (
                          <span key={s.name} title={s.reason}
                            style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4,
                              color: s.passed ? '#10b981' : '#ef4444',
                              background: s.passed ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}>
                            {s.name} {s.value.toFixed(2)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Prompts ──────────────────────────────────────────────────────────────────

function PromptsTab({ project }: { project: string }) {
  const [list, setList] = useState<api.PromptVersion[]>([])
  const [promptId, setPromptId] = useState('')
  const [template, setTemplate] = useState('')
  const [versions, setVersions] = useState<api.PromptVersion[]>([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.listPrompts(project).then(r => setList(r.prompts)).catch(() => setList([]))
  }, [project])
  useEffect(() => { load() }, [load])

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ ...card, flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input value={promptId} onChange={e => setPromptId(e.target.value)}
          placeholder="prompt id, e.g. classify_query" style={input} />
        <textarea value={template} onChange={e => setTemplate(e.target.value)}
          placeholder="Prompt template — use {placeholders}"
          style={{ ...input, minHeight: 200, fontFamily: 'var(--font-mono)', resize: 'vertical' }} />
        <button type="button" disabled={!promptId.trim() || !template.trim() || busy} style={btn}
          onClick={async () => {
            setBusy(true)
            try {
              await api.savePrompt({ promptId: promptId.trim(), template, projectId: project })
              setVersions((await api.getPrompt(promptId.trim())).versions)
              load()
            } finally { setBusy(false) }
          }}>
          Save version
        </button>
        <div style={{ fontSize: 11, color: 'var(--color-muted)', lineHeight: 1.5 }}>
          Versions are immutable — saving appends. An experiment that points at a
          version whose text later changed would be worse than no result at all.
        </div>
      </div>

      <div style={{ ...card, width: 340, flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--color-muted)', textTransform: 'uppercase',
          letterSpacing: '0.6px', marginBottom: 8 }}>Prompts</div>
        {list.length === 0 ? <Empty>None saved.</Empty> : list.map(p => (
          <div key={p.promptId} style={{ padding: '6px 0', borderBottom: '1px solid var(--color-border)',
            cursor: 'pointer' }}
            onClick={async () => {
              setPromptId(p.promptId); setTemplate(p.template)
              try { setVersions((await api.getPrompt(p.promptId)).versions) } catch { /* ignore */ }
            }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{p.promptId}</div>
            <div style={{ fontSize: 10.5, color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
              {p.version} · {p.hash}
            </div>
          </div>
        ))}
        {versions.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--color-muted)', textTransform: 'uppercase',
              letterSpacing: '0.6px', marginBottom: 5 }}>History</div>
            {versions.slice().reverse().map(v => (
              <div key={v.version} onClick={() => setTemplate(v.template)}
                style={{ fontSize: 11, padding: '3px 0', cursor: 'pointer',
                  color: 'var(--color-subtext)', fontFamily: 'var(--font-mono)' }}>
                {v.version} · {new Date(v.createdAt).toLocaleDateString()} · {v.createdBy}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Playground ───────────────────────────────────────────────────────────────

function PlaygroundTab() {
  const [system, setSystem] = useState('')
  const [template, setTemplate] = useState('')
  const [vars, setVars] = useState('{"input": "hello"}')
  const [result, setResult] = useState<api.PlaygroundResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const parsed = useMemo(() => {
    try { return JSON.parse(vars || '{}') } catch { return null }
  }, [vars])

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ ...card, flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input value={system} onChange={e => setSystem(e.target.value)}
          placeholder="System prompt (optional)" style={input} />
        <textarea value={template} onChange={e => setTemplate(e.target.value)}
          placeholder="Prompt with {placeholders}"
          style={{ ...input, minHeight: 160, fontFamily: 'var(--font-mono)', resize: 'vertical' }} />
        <textarea value={vars} onChange={e => setVars(e.target.value)}
          placeholder='{"input": "..."}'
          style={{ ...input, minHeight: 64, fontFamily: 'var(--font-mono)', resize: 'vertical',
            borderColor: parsed ? 'var(--color-border)' : '#ef4444' }} />
        {!parsed && <div style={{ fontSize: 11, color: '#ef4444' }}>Variables must be valid JSON.</div>}
        <button type="button" disabled={!template.trim() || !parsed || busy} style={btn}
          onClick={async () => {
            setBusy(true); setErr('')
            try { setResult(await api.runPlayground({ template, variables: parsed, system })) }
            catch { setErr('Run failed.') }
            finally { setBusy(false) }
          }}>
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Run
        </button>
        {err && <div style={{ fontSize: 12, color: '#ef4444' }}>{err}</div>}
      </div>

      <div style={{ ...card, flex: 1 }}>
        {!result ? <Empty>Run a prompt to see its output, tokens and cost.</Empty> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {result.error && (
              <div style={{ fontSize: 12, color: '#ef4444' }}>{result.error}</div>
            )}
            <pre style={{ margin: 0, fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap',
              wordBreak: 'break-word', maxHeight: 340, overflowY: 'auto', color: 'var(--color-text)' }}>
              {result.output || '(no output)'}
            </pre>
            <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--color-subtext)',
              fontFamily: 'var(--font-mono)', flexWrap: 'wrap' }}>
              {result.model && <span>{result.model}</span>}
              <span>{result.inputTokens ?? 0} in / {result.outputTokens ?? 0} out</span>
              <span>{result.latencyMs ?? 0}ms</span>
              <span style={{ color: '#10b981' }}>{money(result.costUsd)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
