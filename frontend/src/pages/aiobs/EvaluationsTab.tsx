import { useCallback, useEffect, useState } from 'react'
import { Activity, Info, Loader2, Play, Save, Scale } from 'lucide-react'
import * as api from '../../api/aiObservability'
import { btn, card, ghost, input, mono, money } from './styles'

/**
 * Online evaluation and experiment comparison.
 *
 * Both backends already existed and neither had any UI:
 *   GET/PUT /online-eval, POST /online-eval/run  — wrapped in the api module since
 *                                                  the feature shipped, never called
 *   GET /experiments/compare                     — no wrapper and no caller at all
 *
 * The sampling controls are the important part. Every judged trace is a billable LLM
 * call, so this screen makes the cost of a setting visible BEFORE it is saved rather
 * than after the invoice.
 */

type Judge = { name: string; label: string }

export default function EvaluationsTab({ project }: { project: string }) {
  const [cfg, setCfg] = useState<api.OnlineEvalConfig | null>(null)
  const [judges, setJudges] = useState<Judge[]>([])
  const [saving, setSaving] = useState(false)
  const [sweeping, setSweeping] = useState(false)
  const [sweep, setSweep] = useState<Record<string, unknown> | null>(null)
  const [err, setErr] = useState('')

  const [experiments, setExperiments] = useState<api.ExperimentMeta[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [diff, setDiff] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    api.getOnlineEval().then(setCfg).catch(() => setErr('Could not load the eval config.'))
    api.listMetrics().then(r => setJudges(r.judges)).catch(() => {})
  }, [])

  useEffect(() => {
    api.listExperiments(project).then(r => setExperiments(r.experiments)).catch(() => {})
  }, [project])

  const save = useCallback(() => {
    if (!cfg) return
    setSaving(true); setErr('')
    api.setOnlineEval({ ...cfg, projectId: cfg.projectId || project })
      .then(setCfg)
      .catch(() => setErr('Save failed. Unknown judge names are rejected by the API.'))
      .finally(() => setSaving(false))
  }, [cfg, project])

  const runSweep = useCallback(() => {
    setSweeping(true)
    api.runOnlineSweep()
      .then(setSweep)
      .catch(() => setErr('Sweep failed.'))
      .finally(() => setSweeping(false))
  }, [])

  const compare = useCallback(() => {
    if (picked.length < 2) return
    api.compareExperiments(picked).then(setDiff).catch(() => setErr('Compare failed.'))
  }, [picked])

  const toggleJudge = (name: string) => {
    if (!cfg) return
    const has = cfg.judges.includes(name)
    setCfg({
      ...cfg,
      // Capped at 5 to match the backend, which slices judge_names[:5]. Enforcing it
      // here too means the UI never shows a selection the API will silently drop.
      judges: has ? cfg.judges.filter(j => j !== name) : [...cfg.judges, name].slice(0, 5),
    })
  }

  const togglePick = (id: string) => setPicked(p =>
    p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {err && <div style={{ fontSize: 12, color: '#ef4444' }}>{err}</div>}

      {/* ── Online evaluation ── */}
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Activity size={13} style={{ color: '#8b5cf6' }} />
          <span className="section-label" style={{ margin: 0 }}>Online evaluation</span>
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--color-subtext)', lineHeight: 1.65 }}>
          Scores a sample of live traces. Sampling is the whole design: judging every
          trace costs about as much as serving it, so the result is an estimate and is
          reported as one, with its sample size.
        </div>

        {!cfg ? <Loader2 size={14} className="animate-spin" /> : (
          <>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5,
                color: 'var(--color-text)' }}>
                <input type="checkbox" checked={cfg.enabled}
                  onChange={e => setCfg({ ...cfg, enabled: e.target.checked })} />
                Enabled
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 170 }}>
                <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                  Sample rate — {(cfg.sampleRate * 100).toFixed(0)}%
                </span>
                <input type="range" min={0} max={1} step={0.01} value={cfg.sampleRate}
                  onChange={e => setCfg({ ...cfg, sampleRate: Number(e.target.value) })} />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 190 }}>
                <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>Project</span>
                <input value={cfg.projectId} placeholder={project}
                  onChange={e => setCfg({ ...cfg, projectId: e.target.value })} style={input} />
              </label>

              <button type="button" onClick={save} style={btn} disabled={saving}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
              </button>
              <button type="button" onClick={runSweep} style={ghost} disabled={sweeping}>
                {sweeping ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                Run sweep now
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                Judges (max 5) — each one is a billable LLM call per sampled trace
              </span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {judges.map(j => {
                  const on = cfg.judges.includes(j.name)
                  return (
                    <button key={j.name} type="button" onClick={() => toggleJudge(j.name)}
                      style={{ ...ghost, padding: '4px 10px', fontSize: 11.5,
                        borderColor: on ? '#8b5cf6' : 'var(--color-border)',
                        color: on ? '#c4b5fd' : 'var(--color-muted)',
                        background: on ? 'rgba(139,92,246,0.12)' : 'var(--color-surface)' }}>
                      {j.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* The cost of the current setting, before it is saved. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5,
              color: 'var(--color-muted)' }}>
              <Info size={11} />
              At {(cfg.sampleRate * 100).toFixed(0)}% with {cfg.judges.length} judge(s),
              1,000 traces produce about {Math.round(cfg.sampleRate * 1000 * cfg.judges.length)}
              {' '}judge calls. The scheduler sweeps hourly and caps each run at 100.
              {cfg.updatedBy && <> Last changed by {cfg.updatedBy}.</>}
            </div>

            {sweep && (
              <pre style={{ ...mono, margin: 0, padding: 11, fontSize: 11.5, borderRadius: 8,
                background: 'var(--color-surface)', overflowX: 'auto',
                color: 'var(--color-text)' }}>
                {JSON.stringify(sweep, null, 2)}
              </pre>
            )}
          </>
        )}
      </div>

      {/* ── Experiment comparison ── */}
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Scale size={13} style={{ color: '#06b6d4' }} />
          <span className="section-label" style={{ margin: 0 }}>Compare experiments</span>
        </div>

        {experiments.length < 2 ? (
          <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            Two or more experiments are needed. Create them in the Experiments tab.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {experiments.map(e => (
                <label key={e.experimentId} style={{ display: 'flex', alignItems: 'center',
                  gap: 8, fontSize: 12.5, color: 'var(--color-text)' }}>
                  <input type="checkbox" checked={picked.includes(e.experimentId)}
                    onChange={() => togglePick(e.experimentId)} />
                  <span style={{ flex: 1 }}>{e.name}</span>
                  <span style={{ ...mono, fontSize: 11, color: 'var(--color-subtext)' }}>
                    {e.summary?.overallPassRate != null
                      ? `${(e.summary.overallPassRate * 100).toFixed(0)}% pass`
                      : e.status}
                  </span>
                  <span style={{ ...mono, fontSize: 11, color: '#10b981', width: 78,
                    textAlign: 'right' }}>
                    {money(e.summary?.totalCostUsd)}
                  </span>
                </label>
              ))}
            </div>

            <button type="button" onClick={compare} style={btn} disabled={picked.length < 2}>
              <Scale size={12} /> Compare {picked.length || ''}
            </button>

            {diff && (
              <pre style={{ ...mono, margin: 0, padding: 11, fontSize: 11.5, borderRadius: 8,
                background: 'var(--color-surface)', overflowX: 'auto', maxHeight: 320,
                color: 'var(--color-text)' }}>
                {JSON.stringify(diff, null, 2)}
              </pre>
            )}
          </>
        )}
      </div>
    </div>
  )
}
