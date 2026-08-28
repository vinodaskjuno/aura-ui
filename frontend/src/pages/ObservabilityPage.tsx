import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Coins, FlaskConical, ListTree, Microscope, Plug2, Radar, Siren, X,
} from 'lucide-react'
import observabilityApi, {
  type CaseRetrieval, type Incident, type Investigation, type ObservabilityKpis,
  type Outcome, type RunbookMatch,
} from '../api/observability'
import {
  SAMPLE_CASES, SAMPLE_INCIDENTS, SAMPLE_INVESTIGATION, SAMPLE_INVESTIGATION_HISTORY,
  SAMPLE_NEGATIVE_CASES, SAMPLE_RUNBOOK, replaySampleRun,
} from '../data/observability-sample'
import IncidentListPanel from '../components/observability/IncidentListPanel'
import IntegrationHealthPanel from '../components/observability/IntegrationHealthPanel'
import InvestigationWorkspace from '../components/observability/InvestigationWorkspace'
import MaskingBadge from '../components/observability/MaskingBadge'
import RunbookPanel from '../components/observability/RunbookPanel'
import SessionCostPanel from '../components/observability/SessionCostPanel'
import { fmtConfidence, fmtDuration } from '../components/observability/observabilityFormat'
import useObservabilityStream, {
  emptyRunState, reduceDagEvent, type RunState,
} from '../hooks/useObservabilityStream'

type Tab = 'incidents' | 'investigate' | 'runbooks' | 'integrations' | 'sessions'

const TAB_ITEMS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'incidents',    label: 'Incidents',    icon: <Siren size={13} /> },
  { id: 'investigate',  label: 'Investigate',  icon: <Microscope size={13} /> },
  { id: 'runbooks',     label: 'Runbooks',     icon: <ListTree size={13} /> },
  { id: 'integrations', label: 'Integrations', icon: <Plug2 size={13} /> },
  { id: 'sessions',     label: 'Sessions',     icon: <Coins size={13} /> },
]

export default function ObservabilityPage() {
  // Search params rather than a splat route: the sidebar NavLink uses `end`, so any
  // sub-path would stop highlighting the nav item (a bug /qa already has).
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'incidents'
  const activeId = params.get('investigation') || ''

  const [demo, setDemo] = useState(false)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [history, setHistory] = useState<Investigation[]>([])
  const [kpis, setKpis] = useState<ObservabilityKpis | null>(null)
  const [investigation, setInvestigation] = useState<Investigation | null>(null)
  const [runbook, setRunbook] = useState<RunbookMatch | null>(null)
  const [cases, setCases] = useState<CaseRetrieval | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [demoState, setDemoState] = useState<RunState>(emptyRunState)
  const cancelReplay = useRef<null | (() => void)>(null)

  const live = useObservabilityStream(demo ? null : (activeId || null))
  const run = demo ? demoState : live.state

  const setTab = (id: Tab) => {
    const next = new URLSearchParams(params)
    next.set('tab', id)
    setParams(next, { replace: true })
  }
  const setActive = (id: string, goToTab = true) => {
    const next = new URLSearchParams(params)
    next.set('investigation', id)
    if (goToTab) next.set('tab', 'investigate')
    setParams(next)
  }

  // ── Data loading ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (demo) {
      setIncidents(SAMPLE_INCIDENTS)
      setHistory(SAMPLE_INVESTIGATION_HISTORY)
      setInvestigation(SAMPLE_INVESTIGATION)
      setRunbook(SAMPLE_RUNBOOK)
      setCases({ cases: SAMPLE_CASES, negative_cases: SAMPLE_NEGATIVE_CASES,
        category_priors: { deploy: 0.5, capacity: 0.5 }, corpus_size: 12,
        below_floor: false })
      return
    }
    observabilityApi.listIncidents().then((r) => setIncidents(r.data.incidents ?? []))
      .catch(() => setIncidents([]))
    observabilityApi.listInvestigations().then((r) => setHistory(r.data.investigations ?? []))
      .catch(() => setHistory([]))
    observabilityApi.getKpis().then((r) => setKpis(r.data)).catch(() => setKpis(null))
  }, [demo])

  const loadInvestigation = useCallback((id: string) => {
    if (!id || demo) return
    observabilityApi.getInvestigation(id).then((r) => setInvestigation(r.data))
      .catch(() => setInvestigation(null))
    observabilityApi.getCases(id).then((r) => setCases(r.data)).catch(() => setCases(null))
  }, [demo])

  useEffect(() => { loadInvestigation(activeId) }, [activeId, loadInvestigation])

  // Reload once a run finishes so persisted findings replace the streamed ones.
  useEffect(() => {
    if (!demo && run.status === 'complete' && activeId) loadInvestigation(activeId)
  }, [run.status, activeId, demo, loadInvestigation])

  // ── Demo replay — same reducer the socket feeds ───────────────────────────
  const startDemo = () => {
    cancelReplay.current?.()
    setDemoState(emptyRunState())
    cancelReplay.current = replaySampleRun(
      (ev) => setDemoState((prev) => reduceDagEvent(prev, ev)), 3)
  }
  useEffect(() => {
    if (demo) { setTab('investigate'); startDemo() }
    else { cancelReplay.current?.(); setDemoState(emptyRunState()) }
    return () => cancelReplay.current?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo])

  // ── Actions ───────────────────────────────────────────────────────────────
  const investigate = async (inc: Incident) => {
    setStarting(true); setError('')
    try {
      const r = await observabilityApi.startInvestigation({
        services: [inc.service], symptom: inc.title, incident_id: inc.incidentId,
        severity: inc.severity, window_minutes: 60, background: true,
      })
      live.reset()
      setActive(r.data.investigationId)
    } catch {
      setError('Could not start the investigation. Check that a provider is configured.')
    } finally {
      setStarting(false)
    }
  }

  const startBlank = async () => {
    const service = window.prompt('Service to investigate:')
    if (!service) return
    setStarting(true); setError('')
    try {
      const r = await observabilityApi.startInvestigation({
        services: [service], symptom: 'Manual investigation', window_minutes: 60,
        severity: 'high', background: true,
      })
      live.reset()
      setActive(r.data.investigationId)
    } catch {
      setError('Could not start the investigation.')
    } finally {
      setStarting(false)
    }
  }

  const onOutcome = (o: Outcome) => {
    setInvestigation((prev) => (prev ? { ...prev, outcome: o } : prev))
    observabilityApi.getKpis().then((r) => setKpis(r.data)).catch(() => {})
  }

  const masking = (run.masking as never) ?? (investigation?.masking ?? null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <Radar size={20} color="var(--color-primary)" />
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 800,
            margin: 0, letterSpacing: '-0.02em', color: 'var(--color-text)' }}>
            Observability
          </h1>
          <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>
            SRE agents · evidence-backed root cause analysis
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <MaskingBadge masking={masking} />
        <button onClick={startBlank} disabled={starting || demo}
          style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 7,
            cursor: starting || demo ? 'not-allowed' : 'pointer', border: 'none',
            background: 'var(--color-primary)', color: '#fff',
            opacity: starting || demo ? 0.5 : 1 }}>
          New investigation
        </button>
        <button onClick={() => setDemo((v) => !v)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5,
            fontWeight: 600, padding: '6px 12px', borderRadius: 7, cursor: 'pointer',
            background: demo ? '#f59e0b22' : 'transparent',
            color: demo ? '#f59e0b' : 'var(--color-muted)',
            border: `1px solid ${demo ? '#f59e0b55' : 'var(--color-border)'}` }}>
          <FlaskConical size={12} /> {demo ? 'Exit demo' : 'Demo mode'}
        </button>
      </div>

      {demo && (
        <div style={{ padding: '8px 13px', marginBottom: 12, borderRadius: 7,
          background: '#f59e0b18', border: '1px solid #f59e0b44',
          fontSize: 11.5, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FlaskConical size={13} />
          Demo mode — replaying a recorded investigation through the real event
          reducer. Masking status, integration health and cost are never simulated.
          <div style={{ flex: 1 }} />
          <button onClick={startDemo} style={{ background: 'none', border: 'none',
            color: '#f59e0b', cursor: 'pointer', fontSize: 11.5, fontWeight: 600 }}>
            Replay
          </button>
        </div>
      )}

      {error && (
        <div style={{ padding: '8px 13px', marginBottom: 12, borderRadius: 7,
          background: '#ef444418', border: '1px solid #ef444455', fontSize: 12,
          color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
          {error}
          <div style={{ flex: 1 }} />
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none',
            color: '#ef4444', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>
        </div>
      )}

      {/* KPI strip */}
      {kpis && !demo && (
        <div style={{ display: 'grid', gap: 10, marginBottom: 14,
          gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))' }}>
          <Kpi label="Investigations" value={String(kpis.investigations)} />
          <Kpi label="Running" value={String(kpis.running)} accent={kpis.running > 0} />
          <Kpi label="Mean time to RCA"
            value={fmtDuration(kpis.meanTimeToRcaSeconds * 1000)} />
          <Kpi label="Citation coverage" value={fmtConfidence(kpis.meanCitationCoverage)} />
          <Kpi label="Confirmed rate" value={fmtConfidence(kpis.confirmedRate)} />
          <Kpi label="Learned cases" value={String(kpis.corpusSize)} />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 3, borderBottom: '1px solid var(--color-border)',
        marginBottom: 14 }}>
        {TAB_ITEMS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5,
              fontWeight: 600, padding: '9px 14px', cursor: 'pointer',
              background: 'transparent', border: 'none',
              borderBottom: `2px solid ${tab === t.id ? 'var(--color-primary)' : 'transparent'}`,
              color: tab === t.id ? 'var(--color-primary)' : 'var(--color-muted)',
              marginBottom: -1,
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {tab === 'incidents' && (
          <div style={{ overflowY: 'auto' }}>
            <IncidentListPanel incidents={incidents} busy={starting}
              onInvestigate={investigate} />
          </div>
        )}

        {tab === 'investigate' && (
          <InvestigationWorkspace
            run={run}
            investigation={investigation}
            runbook={runbook}
            cases={cases}
            demo={demo}
            onRecordOutcome={onOutcome}
            onRefreshCases={() => loadInvestigation(activeId)}
          />
        )}

        {tab === 'runbooks' && (
          <div style={{ overflowY: 'auto' }}>
            <RunbookPanel matched={runbook} />
          </div>
        )}

        {tab === 'integrations' && (
          <div style={{ overflowY: 'auto' }}>
            <IntegrationHealthPanel />
          </div>
        )}

        {tab === 'sessions' && (
          <div style={{ overflowY: 'auto' }}>
            <SessionCostPanel
              cost={run.cost ?? investigation?.cost ?? null}
              run={run}
              history={history}
              onOpen={(id) => setActive(id)}
            />
          </div>
        )}
      </motion.div>
    </div>
  )
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--color-card)',
      border: '1px solid var(--color-border)' }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 17, fontWeight: 700,
        color: accent ? 'var(--color-primary)' : 'var(--color-text)' }}>{value}</div>
    </div>
  )
}
