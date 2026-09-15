import { useEffect, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, Loader2, Maximize2, MinusCircle,
         ShieldAlert, XCircle } from 'lucide-react'
import SecurityModal from '../qa/SecurityModal'
import { qaApi } from '../../api/qa'
import type { QaPolicy } from '../../api/qa'

/**
 * NIST controls over this project's infrastructure-as-code.
 *
 * Answered by the API from the working copy, so unlike everything else on this screen it
 * needs no runner, no podman and no round trip — it resolves as fast as any other read.
 * That is a consequence of checking STATIC IaC rather than a live emulator, and it is
 * what makes posture something you can glance at rather than request.
 *
 * These describe what the project DECLARES. A resource created by hand, or drifted since,
 * is invisible here — each control's detail says so on a pass, because a control that
 * overstates its evidence turns "we did not look" into "this is fine".
 */
export default function PolicyPanel({ projectId, projectName = '' }:
  { projectId: string; projectName?: string }) {
  const [policy, setPolicy] = useState<QaPolicy | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [full, setFull] = useState(false)

  useEffect(() => {
    let stop = false
    setPolicy(null)
    setError('')
    qaApi.projectPolicy(projectId)
      .then(({ data }) => { if (!stop) setPolicy(data) })
      .catch((e: any) => {
        if (stop) return
        // 409 means there is no working copy to read — the same condition the run
        // launcher reports, and worth saying rather than showing an empty panel.
        setError(e?.response?.status === 409
          ? 'No working copy for this project, so there is nothing to check.'
          : 'Could not evaluate policy for this project.')
      })
    return () => { stop = true }
  }, [projectId])

  if (error) {
    return <Shell><span style={muted}>{error}</span></Shell>
  }
  if (!policy) {
    return (
      <Shell>
        <span style={{ ...muted, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Loader2 size={11} className="animate-spin" /> checking…
        </span>
      </Shell>
    )
  }
  if (!policy.applicable) {
    // NOT "0 of 0 passing". A project nobody assessed and a clean one are different
    // facts, and only one of them is reassuring.
    return <Shell><span style={muted}>{policy.reason}</span></Shell>
  }

  const failing = policy.controls.filter(c => !c.passed)
  // Present only on a server that reports the pivot. Falling back to the control count
  // keeps the panel working against an older API rather than rendering an empty summary.
  const resources = policy.resources || []
  const byResource = resources.length > 0
  const notChecked = policy.resourcesNotChecked ?? 0
  const withFindings = policy.resourcesWithFindings ?? failing.length

  return (
    <Shell>
      <button onClick={() => setOpen(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%',
                       background: 'transparent', border: 'none', padding: 0,
                       cursor: 'pointer', color: 'var(--color-text)', fontSize: 11.5 }}>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span style={{ fontWeight: 600,
                       color: withFindings ? '#f59e0b' : '#10b981' }}>
          {byResource
            ? `${resources.length} resource${resources.length === 1 ? '' : 's'}`
            : `${policy.passed} of ${policy.total} passing`}
        </span>
        {!!withFindings && (
          <span style={{ color: 'var(--color-text-secondary)' }}>
            · {withFindings} with finding{withFindings === 1 ? '' : 's'}
          </span>
        )}
        {/* Counted separately, never folded into a pass: a resource no control reads was
            not assessed, and only one of those two facts is reassuring. */}
        {!!notChecked && (
          <span style={{ color: 'var(--color-text-secondary)' }}>
            · {notChecked} not checked
          </span>
        )}
      </button>

      {byResource && (
        <button onClick={() => setFull(true)}
                title="Every control, every resource, with how to fix each finding"
                style={{ position: 'absolute', top: 9, right: 10,
                         display: 'inline-flex', alignItems: 'center', gap: 4,
                         fontSize: 10, padding: '2px 7px', borderRadius: 5,
                         cursor: 'pointer', border: '1px solid var(--color-border)',
                         background: 'transparent',
                         color: 'var(--color-text-secondary)' }}>
          <Maximize2 size={9} /> Details
        </button>
      )}

      {open && (
        <div style={{ display: 'grid', gap: 7, marginTop: 4 }}>
          {byResource ? resources.map(r => {
            const unchecked = r.applicable === 0
            const clean = !unchecked && r.passed === r.applicable
            return (
              <div key={`${r.file}:${r.name}`}
                   style={{ display: 'grid', gap: 3, fontSize: 11, lineHeight: 1.55,
                            opacity: unchecked ? 0.72 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Mark ok={unchecked ? null : clean} />
                  <span style={{ fontWeight: 600 }}>{r.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--color-text-secondary)',
                                 fontFamily: 'var(--font-mono)' }}>
                    {r.type.split('::').slice(1).join('::')}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 600,
                                 whiteSpace: 'nowrap',
                                 color: unchecked ? 'var(--color-text-secondary)'
                                        : clean ? '#10b981' : '#ef4444' }}>
                    {unchecked ? 'not checked' : `${r.passed} of ${r.applicable}`}
                  </span>
                </div>
                {unchecked ? (
                  <span style={{ paddingLeft: 18,
                                 color: 'var(--color-text-secondary)' }}>
                    no control applies to this resource type
                  </span>
                ) : (
                  /* Failing first, but passing controls stay VISIBLE — a resource
                     compliant on two of three deserves to show all three. */
                  [...r.controls].sort((a, b) => Number(a.ok) - Number(b.ok)).map(c => (
                    <div key={c.id} style={{ display: 'flex', gap: 6, paddingLeft: 18,
                                             alignItems: 'flex-start' }}>
                      <Mark ok={c.ok} />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ fontWeight: 600 }}>
                          {c.title.split(' · ')[0]}
                        </span>
                        <span style={{ display: 'block',
                                       color: 'var(--color-text-secondary)' }}>
                          {c.detail}
                        </span>
                      </span>
                    </div>
                  ))
                )}
              </div>
            )
          }) : policy.controls.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 7, alignItems: 'flex-start',
                                     fontSize: 11, lineHeight: 1.55 }}>
              <Mark ok={c.passed} />
              <span style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 600 }}>{c.name.split(' — ')[0]}</span>
                {/* The file, which this panel used to throw away — two templates
                    otherwise render as identical rows. */}
                <span style={{ color: 'var(--color-text-secondary)', fontSize: 10,
                               fontFamily: 'var(--font-mono)' }}>{'  '}{c.file}</span>
                <span style={{ display: 'block', color: 'var(--color-text-secondary)' }}>
                  {c.detail}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {full && (
        <SecurityModal policy={policy} project={projectName || 'this project'}
                       onClose={() => setFull(false)} />
      )}
    </Shell>
  )
}

/** Three states, not two. `null` is "not assessed", which must never look like a pass. */
function Mark({ ok }: { ok: boolean | null }) {
  const style = { flexShrink: 0, marginTop: 1 } as const
  if (ok === null) {
    return <MinusCircle size={11} style={{ ...style, color: 'var(--color-text-secondary)' }} />
  }
  return ok
    ? <CheckCircle2 size={11} style={{ ...style, color: '#10b981' }} />
    : <XCircle size={11} style={{ ...style, color: '#ef4444' }} />
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 8,
                  padding: '10px 12px', display: 'grid', gap: 6,
                  position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ShieldAlert size={13} style={{ color: 'var(--color-text-secondary)' }} />
        <span style={{ fontSize: 12, fontWeight: 650 }}>Policy</span>
        <span style={{ fontSize: 10.5, color: 'var(--color-text-secondary)' }}>
          NIST 800-53 · reads your IaC
        </span>
      </div>
      {children}
    </div>
  )
}

const muted: React.CSSProperties = {
  fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.6,
}
