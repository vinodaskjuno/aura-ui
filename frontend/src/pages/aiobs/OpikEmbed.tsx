import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import * as api from '../../api/aiObservability'
import { btn, card, ghost } from './styles'

/**
 * The full Opik UI, embedded.
 *
 * Aura's own tabs cover traces, threads, datasets, experiments, prompts and the
 * overview. Opik ships roughly thirty more pages — annotation queues, the agent
 * optimiser, custom dashboards, the prompt playground with model comparison. Those
 * are linked to rather than reimplemented; reimplementing them would be a year of
 * work and would drift from upstream immediately.
 *
 * SESSION HANDLING is the interesting part. Opening this is a browser NAVIGATION, and
 * a navigation cannot carry an Authorization header — so the SPA cannot authenticate
 * an iframe the way it authenticates XHR. Instead:
 *
 *   1. POST /opik-session exchanges the session JWT for a short-lived, HttpOnly,
 *      path-scoped cookie.
 *   2. nginx gates /opik/ with auth_request against /api/ai-observability/opik-authz,
 *      which validates that cookie.
 *
 * The cookie must therefore be minted BEFORE the iframe loads, and re-minted when it
 * expires — which is what the effect below does. Open-source Opik has no
 * authentication of its own, so this is the only thing keeping it private.
 */

export default function OpikEmbed({ project, opikUiUrl, opikEnabled }: {
  project: string
  /** Resolved by the backend from /capabilities, never from import.meta.env. */
  opikUiUrl?: string
  opikEnabled?: boolean
}) {
  const [ready, setReady] = useState(false)
  const [err, setErr] = useState('')
  const [nonce, setNonce] = useState(0)
  const frame = useRef<HTMLIFrameElement>(null)

  const openSession = useCallback(async () => {
    setErr('')
    try {
      await api.openOpikSession()
      setReady(true)
    } catch {
      setReady(false)
      setErr('Could not open an Opik session. You need the dev_workspace permission.')
    }
  }, [])

  useEffect(() => { openSession() }, [openSession])

  // Re-mint before the 60-minute cookie lapses, so a long session does not bounce the
  // user out mid-investigation.
  useEffect(() => {
    const t = setInterval(openSession, 45 * 60 * 1000)
    return () => clearInterval(t)
  }, [openSession])

  // Opik's OWN ORIGIN, not a sub-path of Aura.
  //
  // An earlier version used `/opik/` and it rendered AURA'S OWN DASHBOARD inside
  // the iframe. Comet's published frontend is built with Vite base=/, so its
  // index.html references `/assets/index-*.js` absolutely; under a sub-path the
  // browser asks Aura's origin for that, hits the SPA fallback, and gets Aura's
  // index.html back, which boots Aura again inside the frame. It looks like the
  // feature works, which is what makes it a nasty bug.
  //
  // Fixing it at the sub-path would mean baking base=/opik/ in at BUILD time, so
  // building Opik's frontend from source on every release: an 8 GB-heap Vite build
  // that OOMs on an 8 GiB podman machine. A separate port keeps the published image
  // untouched, and the auth cookie still applies because cookies are scoped by host
  // and ignore the port.
  const base = (opikUiUrl || '').replace(/\/$/, '')
  const query = project ? `?project=${encodeURIComponent(project)}` : ''
  const src = base ? `${base}/${query}` : ''
  // Gates the header actions. Without this an empty src made "Open in a tab"
  // navigate to the current page, i.e. open Aura again.
  const canOpen = src !== ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 12.5, color: 'var(--color-subtext)', lineHeight: 1.6 }}>
          Annotation queues, the agent optimiser, custom dashboards and the model-comparison
          playground live here. Powered by{' '}
          <a href="https://github.com/comet-ml/opik" target="_blank" rel="noreferrer"
            style={{ color: '#818cf8' }}>Opik</a>{' '}(Apache&nbsp;2.0).
        </div>
        {/* Both actions are rendered ONLY when there is a real URL.
            An <a href=""> resolves to the CURRENT PAGE, so with no Opik address this
            button silently opened Aura in a new tab and looked like the integration
            was broken rather than unconfigured. Reload is hidden for the same reason:
            there is nothing to reload. */}
        {canOpen && (
          <>
            <button type="button" onClick={() => setNonce(n => n + 1)}
              style={{ ...ghost, marginLeft: 'auto' }}>
              <RefreshCw size={12} /> Reload
            </button>
            <a href={src} target="_blank" rel="noreferrer"
              style={{ ...ghost, textDecoration: 'none' }}>
              <ExternalLink size={12} /> Open in a tab
            </a>
          </>
        )}
      </div>

      {opikEnabled === false ? (
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 9 }}>
          <AlertTriangle size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, color: 'var(--color-subtext)' }}>
            The Opik stack is not deployed in this environment. Aura's own tabs still
            work against the configured trace store; set <code>opik_enabled = true</code>
            in the environment's tfvars to stand it up.
          </span>
        </div>
      ) : !base ? (
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 9 }}>
          <AlertTriangle size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, color: 'var(--color-subtext)' }}>
            <strong style={{ color: 'var(--color-text)' }}>No Opik UI address is
            configured.</strong> Opik itself may well be running — this only means
            nothing told the UI where to load it from.
            {' '}Set <code>OPIK_UI_URL</code> on the backend:{' '}
            <code>http://localhost:5173</code> locally, or the ALB address and Opik
            port in a deployed environment. It is set by Terraform, and is deliberately
            empty when no listener exists — otherwise this panel would point at a dead
            address and render blank.
          </span>
        </div>
      ) : err ? (
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 9,
          borderColor: 'rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.06)' }}>
          <AlertTriangle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--color-subtext)' }}>{err}</span>
          <button type="button" onClick={openSession} style={{ ...btn, marginLeft: 'auto' }}>
            Retry
          </button>
        </div>
      ) : !ready ? (
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5,
          color: 'var(--color-subtext)' }}>
          <Loader2 size={14} className="animate-spin" /> Opening a session…
        </div>
      ) : (
        <div style={{ ...card, padding: 0, overflow: 'hidden', height: '72vh' }}>
          <iframe
            key={nonce}
            ref={frame}
            src={src}
            title="Opik"
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            // Opik needs scripts, same-origin storage and downloads (CSV export). It
            // is served from Aura's own origin behind the auth gate, so same-origin is
            // not a privilege escalation here.
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
          />
        </div>
      )}
    </div>
  )
}
