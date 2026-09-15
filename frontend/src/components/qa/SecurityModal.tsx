import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, MinusCircle, Shield, X, XCircle } from 'lucide-react'
import type { QaPolicy, QaPolicyResource } from '../../api/qa'

/**
 * Every control, every resource, in one place.
 *
 * The inline Policy panel is a summary — four controls and a count. It answers "how is
 * this project doing against AC-6(1)". It cannot answer "is AuditFunction safe to ship",
 * because that means reading four control results and pivoting them in your head. This
 * is that pivot, given the width to be read properly.
 *
 * Shaped like `EmulatorInspectModal` on purpose: same shell, same backdrop, same close
 * behaviour. Two modals opened the same way from the same screen that then behave
 * differently is worse than one slightly generic one.
 *
 * NOTHING DEPLOYED IS INSPECTED, and the subtitle says so before any number. These
 * controls read a template. A resource created by hand, or drifted since, is invisible
 * to them — and a security modal is exactly where a result gets over-read, so the scope
 * goes first rather than buried in a detail line.
 */
const OK   = '#10b981'
const BAD  = '#ef4444'
const NONE = 'var(--color-text-secondary)'

export default function SecurityModal({ policy, project, onClose }: {
  policy: QaPolicy
  /** The project's name, so the header names the thing being assessed. */
  project: string
  onClose: () => void
}) {
  const [view, setView] = useState<'resource' | 'control'>('resource')

  // Escape closes, like every other modal here. A security view that traps the reader is
  // worse than no security view.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Memoised on `policy.resources` itself. `policy.resources || []` builds a new array
  // every render, which made the stats memo below recompute every time and never
  // memoise anything.
  const resources = useMemo(() => policy.resources || [], [policy.resources])
  const stats = useMemo(() => {
    const applied = resources.reduce((n, r) => n + r.applicable, 0)
    const passed = resources.reduce((n, r) => n + r.passed, 0)
    return {
      total: resources.length,
      applied,
      passed,
      // Resources, not controls: "2 findings" means two resources need attention.
      findings: resources.filter(r => r.applicable && r.passed < r.applicable).length,
      notChecked: resources.filter(r => !r.applicable).length,
      pct: applied ? Math.round((passed / applied) * 100) : 0,
    }
  }, [resources])

  const files = [...new Set(resources.map(r => r.file))]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 800, display: 'flex',
                 alignItems: 'center', justifyContent: 'center', padding: 24,
                 background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}>
        <motion.div
          initial={{ scale: 0.96, y: 12, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.97, y: 8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          onClick={e => e.stopPropagation()}
          role="dialog" aria-modal="true" aria-label="Security posture"
          style={{ width: 'min(1020px, 96vw)', maxHeight: '88vh',
                   display: 'flex', flexDirection: 'column',
                   background: 'var(--color-card)', borderRadius: 14,
                   border: '1px solid var(--color-border)',
                   boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>

          <header style={{ padding: '13px 16px', flexShrink: 0,
                           borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <Shield size={15} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
              <span style={{ fontSize: 13.5, fontWeight: 650 }}>
                Security posture — {project}
              </span>
              <button onClick={onClose} aria-label="Close"
                      style={{ marginLeft: 'auto', background: 'transparent',
                               border: 'none', cursor: 'pointer', padding: 4,
                               color: 'var(--color-text-secondary)' }}>
                <X size={15} />
              </button>
            </div>
            {/* The limit, before any number. */}
            <p style={{ margin: '5px 0 0 24px', fontSize: 11,
                        color: 'var(--color-text-secondary)' }}>
              NIST 800-53 · read from {files.join(', ') || 'your IaC'} · nothing deployed
              was inspected
            </p>
          </header>

          <div style={{ padding: '14px 16px', overflowY: 'auto', display: 'grid',
                        gap: 14 }}>

            <div style={{ display: 'grid', gap: 1,
                          gridTemplateColumns: 'repeat(auto-fit, minmax(104px, 1fr))',
                          border: '1px solid var(--color-border)', borderRadius: 8,
                          overflow: 'hidden', background: 'var(--color-border)' }}>
              <Stat label="RESOURCES" value={String(stats.total)}
                    sub={`in ${files.length} file${files.length === 1 ? '' : 's'}`} />
              <Stat label="CONTROLS" value={String(stats.applied)} sub="applied" />
              <Stat label="PASSING" value={`${stats.pct}%`}
                    colour={stats.passed === stats.applied ? OK : undefined}
                    sub={`${stats.passed} of ${stats.applied}`} />
              <Stat label="FINDINGS" value={String(stats.findings)}
                    colour={stats.findings ? BAD : OK}
                    sub={`${stats.findings === 1 ? 'resource' : 'resources'}`} />
              {/* Its own column, never folded into PASSING: not assessed is not passed. */}
              <Stat label="NOT CHECKED" value={String(stats.notChecked)}
                    sub="no control applies" />
            </div>

            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              {(['resource', 'control'] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                        style={{ fontSize: 10.5, padding: '4px 10px', borderRadius: 6,
                                 cursor: 'pointer',
                                 border: '1px solid var(--color-border)',
                                 background: view === v ? 'var(--color-surface)'
                                                        : 'transparent',
                                 fontWeight: view === v ? 650 : 400,
                                 color: 'var(--color-text)' }}>
                  by {v}
                </button>
              ))}
            </div>

            {view === 'resource'
              ? <ByResource resources={resources} />
              : <ByControl policy={policy} />}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function ByResource({ resources }: { resources: QaPolicyResource[] }) {
  if (!resources.length) {
    return (
      <p style={{ fontSize: 12, color: NONE, margin: 0 }}>
        No resources are declared in this project’s infrastructure files.
      </p>
    )
  }
  // Server order already puts findings first, then clean, then unchecked — the reader is
  // here to act, so space follows what needs attention.
  const attention = resources.filter(r => r.applicable && r.passed < r.applicable)
  const rest = resources.filter(r => !(r.applicable && r.passed < r.applicable))

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {attention.map(r => <ResourceCard key={`${r.file}:${r.name}`} r={r} wide />)}
      {!!rest.length && (
        <div style={{ display: 'grid', gap: 8,
                      gridTemplateColumns: 'repeat(auto-fill, minmax(232px, 1fr))' }}>
          {rest.map(r => <ResourceCard key={`${r.file}:${r.name}`} r={r} />)}
        </div>
      )}
    </div>
  )
}

function ResourceCard({ r, wide = false }: { r: QaPolicyResource; wide?: boolean }) {
  const unchecked = r.applicable === 0
  const clean = !unchecked && r.passed === r.applicable
  const accent = unchecked ? NONE : clean ? OK : BAD

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 9,
                  padding: '11px 13px', display: 'grid', gap: 8,
                  opacity: unchecked ? 0.72 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Mark ok={unchecked ? null : clean} />
        <span style={{ fontWeight: 650, fontSize: 12.5 }}>{r.name}</span>
        <span style={{ fontSize: 10.5, color: NONE, fontFamily: 'var(--font-mono)' }}>
          {r.type}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600,
                       color: accent, whiteSpace: 'nowrap' }}>
          {unchecked ? 'not checked' : `${r.passed} of ${r.applicable}`}
        </span>
      </div>

      {unchecked ? (
        <p style={{ margin: 0, fontSize: 11.5, color: NONE, lineHeight: 1.6 }}>
          No control applies to this resource type — it was not assessed. That is not the
          same as passing.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 7,
                      borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
          {/* Failing controls first, but passing ones stay VISIBLE: a resource that is
              compliant on three controls and not on one deserves to show all four. */}
          {[...r.controls].sort((a, b) => Number(a.ok) - Number(b.ok)).map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <Mark ok={c.ok} />
              <div style={{ minWidth: 0, fontSize: 11.5, lineHeight: 1.6 }}>
                <span style={{ fontWeight: 600 }}>{c.title.split(' · ')[0]}</span>
                {wide && (
                  <span style={{ color: NONE }}>
                    {' '}{c.title.split(' · ').slice(1).join(' · ')}
                  </span>
                )}
                <span style={{ display: 'block', color: 'var(--color-text-secondary)' }}>
                  {c.detail}
                </span>
                {!c.ok && !!c.remedy && (
                  <span style={{ display: 'block', color: 'var(--color-text)',
                                 marginTop: 2 }}>
                    → {c.remedy}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ByControl({ policy }: { policy: QaPolicy }) {
  return (
    <div style={{ display: 'grid', gap: 9 }}>
      {policy.controls.map(c => (
        <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start',
                                 border: '1px solid var(--color-border)',
                                 borderRadius: 8, padding: '10px 12px' }}>
          <Mark ok={c.passed} />
          <div style={{ minWidth: 0, fontSize: 11.5, lineHeight: 1.6 }}>
            <span style={{ fontWeight: 600 }}>{c.name.split(' — ')[0]}</span>
            {/* The file, which the inline panel throws away — two templates would
                otherwise render as identical rows. */}
            <span style={{ color: NONE, fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>
              {'  '}{c.file}
            </span>
            <span style={{ display: 'block', color: 'var(--color-text-secondary)' }}>
              {c.detail}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Three states, not two. `null` is "not assessed", which must never look like a pass. */
function Mark({ ok }: { ok: boolean | null }) {
  if (ok === null) return <MinusCircle size={12} style={{ color: NONE, flexShrink: 0, marginTop: 2 }} />
  return ok
    ? <CheckCircle2 size={12} style={{ color: OK, flexShrink: 0, marginTop: 2 }} />
    : <XCircle size={12} style={{ color: BAD, flexShrink: 0, marginTop: 2 }} />
}

function Stat({ label, value, sub, colour }: {
  label: string; value: string; sub?: string; colour?: string
}) {
  return (
    <div style={{ background: 'var(--color-surface)', padding: '9px 11px',
                  display: 'grid', gap: 2 }}>
      <div style={{ fontSize: 9, letterSpacing: '.08em', fontWeight: 700,
                    color: 'var(--color-text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700,
                    color: colour ?? 'var(--color-text)' }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 9.5, color: 'var(--color-text-secondary)',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap' }} title={sub}>{sub}</div>
      )}
    </div>
  )
}
