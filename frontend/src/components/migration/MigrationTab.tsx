import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, ArrowRight, CheckCircle2, Download, FlaskConical, Info, Loader2,
  Lock, Play, Wand2,
} from 'lucide-react'
import {
  finalize, getDownload, getInferred, getProfiles, getSession, handoffToQa,
  listSessions, putMapping, runStrategy, startConversion, startSession, submitAnswers,
  type MappingRow, type MigrationProfile, type MigrationSession, type Verdict,
} from '../../api/migration'
import MigrationChat from './MigrationChat'
import MigrationThinking, { type ThinkingKind } from './MigrationThinking'

/**
 * Migration — convert this application onto a different platform.
 *
 * Four stages here (target → architecture → questions → strategy). Conversion and
 * download follow once the strategy is finalized.
 *
 * The design principle throughout: show the working. Every inferred component
 * standard carries the evidence it came from, every verdict says why, and a strategy
 * that looks suspiciously agreeable is flagged rather than presented as good news. A
 * migration report is only worth anything if the reader can tell where it is guessing.
 */

const VERDICT_META: Record<Verdict, { label: string; color: string; hint: string }> = {
  migrate: { label: 'Migrate', color: '#34d399', hint: 'Mechanical translation, behaviour preserved' },
  rewrite: { label: 'Rewrite', color: '#60a5fa', hint: 'Same intent, different design on the target' },
  manual:  { label: 'Manual',  color: '#fbbf24', hint: 'A human must decide or hand-build this' },
  drop:    { label: 'Drop',    color: '#f87171', hint: 'Should not be carried across' },
}

const CONFIDENCE_META: Record<string, { color: string; hint: string }> = {
  strong:  { color: '#34d399', hint: 'Used across most of the estate' },
  mixed:   { color: '#fbbf24', hint: 'Used by some services, not all' },
  weak:    { color: '#f87171', hint: 'Only a couple of services — probably not a standard' },
  unknown: { color: 'var(--color-muted)', hint: 'No evidence found' },
}

const ORIGIN_LABEL: Record<string, string> = {
  inferred: 'from your estate', chat: 'set in chat', user: 'set by you', unset: 'not set',
}

const input: React.CSSProperties = {
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  borderRadius: 6, padding: '6px 9px', color: 'var(--color-text)', fontSize: 12.5,
}
const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
  borderRadius: 7, fontSize: 12.5, fontWeight: 600, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff',
}
const ghost: React.CSSProperties = {
  ...btn, background: 'var(--color-surface)', color: 'var(--color-text)',
  border: '1px solid var(--color-border)',
}
const label: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '.11em',
  textTransform: 'uppercase', color: 'var(--color-subtext)',
}

export default function MigrationTab({ projectId }: { projectId: string }) {
  const [profiles, setProfiles] = useState<MigrationProfile[]>([])
  const [targets, setTargets] = useState<string[]>([])
  const [session, setSession] = useState<MigrationSession | null>(null)
  const [mapping, setMapping] = useState<MappingRow[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [comment, setComment] = useState('')

  const [source, setSource] = useState('workfusion')
  const [target, setTarget] = useState('airflow')
  const [busy, setBusy] = useState('')
  // Which long step is running, or null. Separate from `busy` because the
  // short ones (save, download) want a disabled button, not a takeover panel.
  const [thinking, setThinking] = useState<ThinkingKind | null>(null)
  const [err, setErr] = useState('')
  const [handoff, setHandoff] = useState<{ projectId: string } | null>(null)

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    getProfiles()
      .then(p => { setProfiles(p.pairs); setTargets(p.targets) })
      .catch(() => setErr('Could not load migration profiles.'))
    listSessions(projectId)
      .then(list => { if (list.length) void resume(list[0]) })
      .catch(() => { /* no sessions yet is the normal first case */ })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const loadInferred = useCallback(async (s: MigrationSession) => {
    setBusy('Reading your estate for component standards…')
    try {
      const r = await getInferred(s.sessionId, s.projectId)
      setMapping(r.mapping)
    } catch { setErr('Could not read component standards from the graph.') }
    finally { setBusy('') }
  }, [])

  const resume = useCallback(async (s: MigrationSession) => {
    setSession(s)
    setSource(s.source); setTarget(s.target)
    setAnswers(Object.fromEntries((s.answers || []).map(a => [a.questionId, a.answer])))
    if (s.mapping?.length) setMapping(s.mapping)
    else await loadInferred(s)
  }, [loadInferred])

  // ── Actions ───────────────────────────────────────────────────────────────
  const begin = async () => {
    setBusy('Opening…'); setThinking('starting'); setErr('')
    try {
      const s = await startSession({ projectId, source, target })
      setSession(s)
      await loadInferred(s)
    } catch (e: any) { setErr(e?.response?.data?.detail ?? 'Could not start.') }
    finally { setBusy(''); setThinking(null) }
  }

  const saveMapping = async () => {
    if (!session) return
    setBusy('Saving…'); setErr('')
    try { setSession(await putMapping(session.sessionId, projectId, mapping)) }
    catch (e: any) { setErr(e?.response?.data?.detail ?? 'Could not save.') }
    finally { setBusy('') }
  }

  const propose = async () => {
    if (!session) return
    setBusy('analysing'); setThinking('analysing'); setErr('')
    try { setSession(await runStrategy(session.sessionId, projectId)) }
    catch (e: any) { setErr(e?.response?.data?.detail ?? 'Could not produce a strategy.') }
    finally { setBusy(''); setThinking(null) }
  }

  const sendAnswers = async () => {
    if (!session) return
    setBusy('revising'); setThinking('revising'); setErr('')
    try {
      const payload = (session.questions || []).map(q => ({
        questionId: q.id, question: q.text, answer: answers[q.id] || '',
      })).filter(a => a.answer.trim())
      const updated = await submitAnswers(
        session.sessionId, projectId, payload,
        comment.trim() ? [comment.trim()] : [])
      setSession(updated); setComment('')
    } catch (e: any) { setErr(e?.response?.data?.detail ?? 'Could not revise.') }
    finally { setBusy(''); setThinking(null) }
  }

  const lock = async () => {
    if (!session) return
    setBusy('Finalizing…'); setErr('')
    try { setSession(await finalize(session.sessionId, projectId)) }
    catch (e: any) { setErr(e?.response?.data?.detail ?? 'Could not finalize.') }
    finally { setBusy('') }
  }

  // Poll only while converting, and stop the moment it is not. A permanent timer
  // against a finished session is a request every two seconds for nothing.
  useEffect(() => {
    if (session?.stage !== 'converting') return
    const timer = setInterval(async () => {
      try { setSession(await getSession(session.sessionId, projectId)) }
      catch { /* a dropped poll is not worth surfacing; the next one will land */ }
    }, 2500)
    return () => clearInterval(timer)
  }, [session?.stage, session?.sessionId, projectId])

  const convert = async () => {
    if (!session) return
    setBusy('Starting conversion…'); setErr('')
    try {
      await startConversion(session.sessionId, projectId)
      setSession(await getSession(session.sessionId, projectId))
    } catch (e: any) { setErr(e?.response?.data?.detail ?? 'Could not start conversion.') }
    finally { setBusy('') }
  }

  const download = async () => {
    if (!session) return
    setErr('')
    try {
      const { url } = await getDownload(session.sessionId, projectId)
      window.open(url, '_blank', 'noopener')
    } catch (e: any) { setErr(e?.response?.data?.detail ?? 'Could not get a link.') }
  }

  const sendToQa = async () => {
    if (!session) return
    setBusy('Registering for QualityMind…'); setErr('')
    try { setHandoff(await handoffToQa(session.sessionId, projectId)) }
    catch (e: any) { setErr(e?.response?.data?.detail ?? 'Could not hand off.') }
    finally { setBusy('') }
  }

  const pairIsCurated = useMemo(
    () => profiles.some(p => p.source === source && p.target === target),
    [profiles, source, target])

  const strategy = session?.strategy
  const locked = ['finalized', 'converting', 'converted'].includes(session?.stage ?? '')

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {err && <Note tone="bad">{err}</Note>}
      {thinking && (
        <MigrationThinking kind={thinking} onHide={() => setThinking(null)} />
      )}
      {busy && !thinking && (
        <Note tone="info"><Loader2 size={12} className="animate-spin" /> {busy}</Note>
      )}

      {/* ── 1. Target ──────────────────────────────────────────────────── */}
      <Card step={1} title="Target platform"
            note="What are we converting this application onto?">
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Field labelText="From">
            <input value={source} onChange={e => setSource(e.target.value)}
                   disabled={!!session} style={{ ...input, width: 160 }} />
          </Field>
          <ArrowRight size={15} style={{ color: 'var(--color-muted)', marginBottom: 7 }} />
          <Field labelText="To">
            <select value={target} onChange={e => setTarget(e.target.value)}
                    disabled={!!session} style={{ ...input, width: 190 }}>
              {targets.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          {!session && (
            <button style={btn} onClick={begin} disabled={!!busy}>
              <Wand2 size={13} /> Analyse migration
            </button>
          )}
        </div>

        {/* Which of the two paths is running. A customer should not have to guess. */}
        <div style={{ marginTop: 12 }}>
          {pairIsCurated ? (
            <Note tone="good">
              <CheckCircle2 size={12} />
              Curated pair — Aura has a known component mapping and risk list for
              {' '}{source} → {target}.
            </Note>
          ) : (
            <Note tone="info">
              <Info size={12} />
              No curated profile for {source} → {target}. Aura will work from the
              knowledge graph and your source files alone — this still works, with
              less prior knowledge behind it.
            </Note>
          )}
        </div>
      </Card>

      {/* ── 2. Architecture ────────────────────────────────────────────── */}
      {session && (
        <Card step={2} title="Component mapping"
              note="Aura read your estate and proposed these. Change anything that is wrong — generated code targets exactly what is here.">
          {mapping.length === 0 ? (
            <Empty>Nothing inferred yet.</Empty>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {mapping.map((row, i) => {
                const conf = CONFIDENCE_META[row.confidence] ?? CONFIDENCE_META.unknown
                return (
                  <div key={row.capability} style={{
                    display: 'grid', gridTemplateColumns: '150px 1fr 180px',
                    gap: 10, alignItems: 'center', padding: '7px 10px',
                    background: 'var(--color-card)',
                    border: '1px solid var(--color-border)', borderRadius: 8,
                  }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                      {row.capabilityLabel}
                    </span>
                    <input
                      value={row.technology}
                      placeholder="not set — type the technology you use"
                      disabled={locked}
                      onChange={e => setMapping(m => m.map((r, idx) =>
                        idx === i ? { ...r, technology: e.target.value, origin: 'user' } : r))}
                      style={{ ...input, width: '100%' }}
                    />
                    {/* The evidence. "Splunk in 12 of 14" earns trust; "1 of 14"
                        should not, and the difference is invisible without this. */}
                    <span style={{ fontSize: 10.5, color: 'var(--color-muted)', textAlign: 'right' }}>
                      {row.totalServices > 0 && row.services > 0 ? (
                        <span title={`${conf.hint}. ${row.evidence.join('; ')}`}>
                          <span style={{ color: conf.color, fontWeight: 700 }}>
                            {row.services} of {row.totalServices}
                          </span>
                          {' services · '}{ORIGIN_LABEL[row.origin] ?? row.origin}
                        </span>
                      ) : (
                        <span>{ORIGIN_LABEL[row.origin] ?? row.origin}</span>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {!locked && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button style={ghost} onClick={saveMapping} disabled={!!busy}>
                Save mapping
              </button>
              <button style={btn} onClick={propose} disabled={!!busy}>
                <Wand2 size={13} />
                {strategy?.components?.length ? 'Re-analyse' : 'Propose a strategy'}
              </button>
            </div>
          )}
        </Card>
      )}

      {/* Chat is available from the mapping stage on. Before a session exists it has
          nothing to change; after finalize the mapping is locked, but a target switch
          is still a legitimate thing to ask for. */}
      {session && (
        <MigrationChat session={session} onSession={(s) => {
          setSession(s)
          if (s.mapping?.length) setMapping(s.mapping)
        }} />
      )}

      {/* ── 3. Questions ───────────────────────────────────────────────── */}
      {session && (session.questions?.length ?? 0) > 0 && !locked && (
        <Card step={3} title="Aura needs to know"
              note="These change the strategy. Answer what you can — anything left blank stays an assumption.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {session.questions.map(q => (
              <div key={q.id}>
                <div style={{ fontSize: 12.5, color: 'var(--color-text)', marginBottom: 3 }}>
                  {q.text}
                </div>
                {q.why && (
                  <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 5 }}>
                    Why it matters: {q.why}
                  </div>
                )}
                <input
                  value={answers[q.id] || ''}
                  onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                  style={{ ...input, width: '100%' }}
                />
              </div>
            ))}
          </div>
          <button style={{ ...btn, marginTop: 12 }} onClick={sendAnswers} disabled={!!busy}>
            Submit answers and revise
          </button>
        </Card>
      )}

      {/* ── 4. Strategy ────────────────────────────────────────────────── */}
      {strategy?.components?.length ? (
        <Card step={4} title="Migration strategy"
              note={locked ? 'Finalized.' : 'Review, comment to amend, then finalize.'}>

          {strategy.warning && (
            <Note tone="warn">
              <AlertTriangle size={12} /> {strategy.warning}
            </Note>
          )}

          {strategy.summary && (
            <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-text)',
                        margin: '10px 0 14px', maxWidth: '72ch' }}>
              {strategy.summary}
            </p>
          )}

          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <Stat n={strategy.effort?.components ?? 0} label="components" />
            <Stat n={strategy.effort?.automatable ?? 0} label="automatable" color="#34d399" />
            <Stat n={strategy.effort?.manual ?? 0} label="need a human" color="#fbbf24" />
            <Stat n={strategy.risks?.length ?? 0} label="risks" color="#f87171" />
          </div>

          <div style={{ ...label, marginBottom: 7 }}>Components</div>
          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 620 }}>
              <thead>
                <tr>
                  {['Component', 'From', 'To', 'Verdict', 'Why'].map(h => (
                    <th key={h} style={{
                      ...label, textAlign: 'left', padding: '0 12px 7px 0',
                      borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {strategy.components.map((c, i) => {
                  const v = VERDICT_META[c.verdict] ?? VERDICT_META.manual
                  return (
                    <tr key={`${c.name}-${i}`}>
                      <td style={td}>{c.name}</td>
                      <td style={{ ...td, color: 'var(--color-muted)' }}>{c.sourceType}</td>
                      <td style={{ ...td, color: 'var(--color-muted)' }}>{c.targetType}</td>
                      <td style={td}>
                        <span title={v.hint} style={{
                          fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase',
                          letterSpacing: '.06em', padding: '2px 7px', borderRadius: 4,
                          background: `${v.color}22`, color: v.color, whiteSpace: 'nowrap',
                        }}>{v.label}</span>
                      </td>
                      <td style={{ ...td, color: 'var(--color-subtext)' }}>{c.note}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {(strategy.risks?.length ?? 0) > 0 && (
            <>
              <div style={{ ...label, marginBottom: 7 }}>Risks</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 16 }}>
                {strategy.risks.map((r, i) => {
                  const color = r.severity === 'high' ? '#f87171'
                    : r.severity === 'medium' ? '#fbbf24' : 'var(--color-muted)'
                  return (
                    <div key={i} style={{
                      display: 'flex', gap: 9, fontSize: 12.5, padding: '7px 10px',
                      background: 'var(--color-card)', borderRadius: 7,
                      borderLeft: `3px solid ${color}`,
                    }}>
                      <span style={{ ...label, color, width: 52, flexShrink: 0 }}>
                        {r.severity}
                      </span>
                      <span style={{ color: 'var(--color-text)', lineHeight: 1.5 }}>{r.text}</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {(strategy.unknowns?.length ?? 0) > 0 && (
            <>
              <div style={{ ...label, marginBottom: 7 }}>Unknowns</div>
              <ul style={{ margin: '0 0 16px', paddingLeft: 18, fontSize: 12.5,
                           color: 'var(--color-subtext)', lineHeight: 1.7 }}>
                {strategy.unknowns.map((u, i) => <li key={i}>{u}</li>)}
              </ul>
            </>
          )}

          {!locked ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <input
                value={comment}
                placeholder="Comment to amend the strategy…"
                onChange={e => setComment(e.target.value)}
                style={{ ...input, flex: 1, minWidth: 240 }}
              />
              <button style={ghost} onClick={sendAnswers} disabled={!!busy || !comment.trim()}>
                Amend
              </button>
              <button style={btn} onClick={lock} disabled={!!busy}>
                <Lock size={13} /> Finalize
              </button>
            </div>
          ) : (
            <Note tone="good">
              <Lock size={12} /> Strategy finalized.
            </Note>
          )}
        </Card>
      ) : null}

      {/* ── 5. Convert ─────────────────────────────────────────────────── */}
      {locked && (
        <Card step={5} title="Generate the code"
              note="One component at a time, using the standards above. Progress is saved as it goes, so an interrupted run resumes rather than restarting.">
          {session?.stage === 'finalized' && (
            <button style={btn} onClick={convert} disabled={!!busy}>
              <Play size={13} /> Convert {strategy?.components?.length ?? 0} components
            </button>
          )}

          {session?.stage === 'converting' && (
            <Progress progress={session.conversionProgress} />
          )}

          {session?.stage === 'failed' && (
            <>
              <Note tone="bad">
                <AlertTriangle size={12} />
                Conversion stopped: {(session.errors || []).join('; ') || 'unknown error'}
              </Note>
              <button style={{ ...ghost, marginTop: 10 }} onClick={convert} disabled={!!busy}>
                Resume — components already converted are skipped
              </button>
            </>
          )}

          {session?.stage === 'converted' && (
            <>
              <Progress progress={session.conversionProgress} />
              <Outcome results={session.conversionResults || []} />
            </>
          )}
        </Card>
      )}

      {/* ── 6. Download and hand off ───────────────────────────────────── */}
      {session?.stage === 'converted' && (
        <Card step={6} title="Take it away"
              note="Reviewable output. MIGRATION.md lists what was skipped, what failed, and every decision left to a person.">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={btn} onClick={download}>
              <Download size={13} />
              Download .zip{session.conversionFileCount
                ? ` (${session.conversionFileCount} files)` : ''}
            </button>
            {handoff || session.convertedProjectId ? (
              <Note tone="good">
                <CheckCircle2 size={12} />
                Available in QualityMind as a project — open QualityMind to test it.
              </Note>
            ) : (
              <button style={ghost} onClick={sendToQa} disabled={!!busy}>
                <FlaskConical size={13} /> Open in QA Mind
              </button>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}

function Progress({ progress }: {
  progress?: { done: number; total: number; current: string }
}) {
  const done = progress?.done ?? 0
  const total = progress?.total ?? 0
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 7 }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 800 }}>
          {done} of {total}
        </span>
        <span style={{ fontSize: 12, color: 'var(--color-subtext)' }}>
          {progress?.current ? `converting ${progress.current}…` : 'components'}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--color-border)' }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 3,
          background: 'var(--color-primary)', transition: 'width .4s',
        }} />
      </div>
    </div>
  )
}

/**
 * What the run actually produced.
 *
 * `skipped` and `failed` are shown as prominently as `converted`. A screen that
 * reports only successes leaves the reader to notice an absence, which is the one
 * thing a migration report must not ask of them.
 */
function Outcome({ results }: { results: { component: string; status: string; notes: string[]; todos: string[] }[] }) {
  const by = (s: string) => results.filter(r => r.status === s)
  const converted = by('converted')
  const skipped = by('skipped')
  const attention = [...by('failed'), ...by('empty')]
  const todos = results.flatMap(r => r.todos.map(t => ({ component: r.component, todo: t })))

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <Stat n={converted.length} label="converted" color="#34d399" />
        <Stat n={skipped.length} label="skipped" color="var(--color-muted)" />
        <Stat n={attention.length} label="need attention" color="#f87171" />
        <Stat n={todos.length} label="open decisions" color="#fbbf24" />
      </div>

      {attention.length > 0 && (
        <Note tone="bad">
          <AlertTriangle size={12} />
          <span>
            Produced nothing usable — treat as unconverted:{' '}
            {attention.map(r => r.component).join(', ')}
          </span>
        </Note>
      )}

      {todos.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ ...label, marginBottom: 6 }}>Decisions left to you</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5,
                       color: 'var(--color-subtext)', lineHeight: 1.7 }}>
            {todos.slice(0, 12).map((t, i) => (
              <li key={i}><strong style={{ color: 'var(--color-text)' }}>{t.component}</strong> — {t.todo}</li>
            ))}
          </ul>
          {todos.length > 12 && (
            <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 6 }}>
              +{todos.length - 12} more in MIGRATION.md
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Pieces ──────────────────────────────────────────────────────────────────

const td: React.CSSProperties = {
  padding: '8px 12px 8px 0', borderBottom: '1px solid var(--color-border)',
  verticalAlign: 'top', color: 'var(--color-text)',
}

function Card({ step, title, note, children }: {
  step: number; title: string; note: string; children: React.ReactNode
}) {
  return (
    <div className="ov-card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
          color: 'var(--color-primary)',
        }}>{String(step).padStart(2, '0')}</span>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 14.5,
                     fontWeight: 800, margin: 0 }}>{title}</h3>
      </div>
      <p style={{ fontSize: 12, color: 'var(--color-subtext)',
                  margin: '0 0 14px 26px', maxWidth: '70ch' }}>{note}</p>
      <div style={{ marginLeft: 26 }}>{children}</div>
    </div>
  )
}

function Field({ labelText, children }: { labelText: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={label}>{labelText}</span>
      {children}
    </div>
  )
}

function Note({ tone, children }: {
  tone: 'good' | 'bad' | 'warn' | 'info'; children: React.ReactNode
}) {
  const color = tone === 'good' ? 'var(--color-success)'
    : tone === 'bad' ? 'var(--color-danger)'
    : tone === 'warn' ? 'var(--color-warning)' : 'var(--color-primary)'
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 12px',
      borderRadius: 8, fontSize: 12.5, color, lineHeight: 1.5,
      background: 'var(--color-card)', border: '1px solid var(--color-border)',
      borderLeft: `3px solid ${color}`,
    }}>
      {children}
    </div>
  )
}

function Stat({ n, label: text, color }: { n: number; label: string; color?: string }) {
  return (
    <div style={{
      padding: '8px 14px', background: 'var(--color-card)',
      border: '1px solid var(--color-border)', borderRadius: 8, minWidth: 92,
    }}>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 19, fontWeight: 800,
                    color: color ?? 'var(--color-text)', lineHeight: 1.1 }}>{n}</div>
      <div style={{ fontSize: 10, color: 'var(--color-muted)', textTransform: 'uppercase',
                    letterSpacing: '.06em', marginTop: 2 }}>{text}</div>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12.5, color: 'var(--color-muted)', padding: '8px 0' }}>
    {children}
  </div>
}
