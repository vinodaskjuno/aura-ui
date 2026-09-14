import { useEffect, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, Loader2, ShieldAlert, XCircle } from 'lucide-react'
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
export default function PolicyPanel({ projectId }: { projectId: string }) {
  const [policy, setPolicy] = useState<QaPolicy | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)

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
  const allGood = failing.length === 0

  return (
    <Shell>
      <button onClick={() => setOpen(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%',
                       background: 'transparent', border: 'none', padding: 0,
                       cursor: 'pointer', color: 'var(--color-text)', fontSize: 11.5 }}>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span style={{ fontWeight: 600,
                       color: allGood ? '#10b981' : '#f59e0b' }}>
          {policy.passed} of {policy.total} passing
        </span>
        {!allGood && (
          <span style={{ color: 'var(--color-text-secondary)' }}>
            · {failing.length} finding{failing.length === 1 ? '' : 's'}
          </span>
        )}
      </button>

      {open && (
        <div style={{ display: 'grid', gap: 5, marginTop: 4 }}>
          {policy.controls.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 7, alignItems: 'flex-start',
                                     fontSize: 11, lineHeight: 1.55 }}>
              <span style={{ flexShrink: 0, marginTop: 1,
                             color: c.passed ? '#10b981' : '#ef4444' }}>
                {c.passed ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 600 }}>{c.name.split(' — ')[0]}</span>
                <span style={{ display: 'block', color: 'var(--color-text-secondary)' }}>
                  {c.detail}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 8,
                  padding: '10px 12px', display: 'grid', gap: 6 }}>
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
