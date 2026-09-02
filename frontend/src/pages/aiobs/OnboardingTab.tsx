import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle, Check, Copy, KeyRound, Loader2, Rocket, ShieldCheck,
} from 'lucide-react'
import * as api from '../../api/aiObservability'
import { btn, card, ghost, input, mono } from './styles'

/**
 * "Instrument your agent" — the missing product surface.
 *
 * The provisioning primitive already existed: gateway_service mints `gw-` keys, the
 * OTLP receiver already accepts them, and GET /gateway/keys/me/{tool} is
 * get-or-create. Nothing ever rendered it, so onboarding was a docstring in
 * routers/otlp.py and nothing else.
 *
 * Deliberately get-or-create rather than always-create: revisiting this tab must not
 * invalidate a key a team already deployed.
 */

const STYLE_LABELS: Record<string, string> = {
  'opik-sdk': 'Opik SDK (Python)',
  'otel-sdk': 'OpenTelemetry SDK',
  typescript: 'Opik SDK (TypeScript)',
  langchain: 'LangChain',
  crewai: 'CrewAI',
  llamaindex: 'LlamaIndex',
  anthropic: 'Anthropic SDK',
  openai: 'OpenAI SDK',
  bedrock: 'AWS Bedrock',
}

function CodeBlock({ snippet }: { snippet: api.OnboardingSnippet }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    // clipboard is unavailable on insecure origins, so failure is silent-but-visible:
    // the tick simply never appears rather than throwing at the user.
    navigator.clipboard?.writeText(snippet.code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    }).catch(() => {})
  }

  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px',
        borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text)' }}>
          {snippet.label}
        </span>
        <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>{snippet.language}</span>
        <button type="button" onClick={copy}
          style={{ ...ghost, marginLeft: 'auto', padding: '3px 8px', fontSize: 11 }}>
          {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {/* Wide code scrolls inside its own container so the page body never scrolls
          horizontally. */}
      <pre style={{ ...mono, margin: 0, padding: '11px 13px', fontSize: 11.5, lineHeight: 1.65,
        overflowX: 'auto', color: 'var(--color-text)', background: 'transparent' }}>
        {snippet.code}
      </pre>
    </div>
  )
}

export default function OnboardingTab({ project }: { project: string }) {
  const [styles, setStyles] = useState<string[]>([])
  const [style, setStyle] = useState('opik-sdk')
  const [projectName, setProjectName] = useState(project || 'my-agent')
  const [data, setData] = useState<api.Onboarding | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.listOnboardingStyles()
      .then(r => { setStyles(r.styles); setStyle(r.default) })
      .catch(() => setStyles(Object.keys(STYLE_LABELS)))
  }, [])

  const generate = useCallback(() => {
    setLoading(true); setErr('')
    api.onboard({ style, projectName: projectName.trim() || 'my-agent' })
      .then(setData)
      .catch(() => setErr('Could not provision a key. Check that you have dev_workspace.'))
      .finally(() => setLoading(false))
  }, [style, projectName])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div className="section-label">Instrument an agent</div>
        <div style={{ fontSize: 12.5, color: 'var(--color-subtext)', lineHeight: 1.65 }}>
          Pick how your agent is built and we will provision a key and generate the exact
          configuration. Traces group into projects by your OpenTelemetry
          {' '}<code>service.name</code>, so give each agent its own project name.
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 210 }}>
            <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>Integration</span>
            <select value={style} onChange={e => setStyle(e.target.value)} style={input}>
              {styles.map(s => (
                <option key={s} value={s}>{STYLE_LABELS[s] ?? s}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 210 }}>
            <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>Project name</span>
            <input value={projectName} onChange={e => setProjectName(e.target.value)}
              placeholder="checkout-agent" style={input} />
          </label>

          <button type="button" onClick={generate} style={btn} disabled={loading}>
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Rocket size={12} />}
            Generate
          </button>
        </div>

        {err && <div style={{ fontSize: 12, color: '#ef4444' }}>{err}</div>}
      </div>

      {data && (
        <>
          {/* Plaintext is returned only on creation, so it is shown once and labelled
              as such. A reused key shows its hint, which is not pasteable — saying so
              avoids a support ticket. */}
          <div style={{ ...card, display: 'flex', alignItems: 'flex-start', gap: 9,
            borderColor: data.isNewKey ? 'rgba(16,185,129,0.35)' : 'rgba(245,158,11,0.35)',
            background: data.isNewKey ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)' }}>
            {data.isNewKey
              ? <KeyRound size={14} style={{ color: '#10b981', marginTop: 2, flexShrink: 0 }} />
              : <AlertTriangle size={14} style={{ color: '#f59e0b', marginTop: 2, flexShrink: 0 }} />}
            <div style={{ fontSize: 12, color: 'var(--color-subtext)', lineHeight: 1.6 }}>
              {data.isNewKey ? (
                <>
                  <strong style={{ color: 'var(--color-text)' }}>New key issued —
                  copy it now.</strong> It is shown once and never stored in plaintext.
                  The snippets below already contain it.
                </>
              ) : (
                <>
                  <strong style={{ color: 'var(--color-text)' }}>Reusing the existing
                  key</strong> ending <code>{data.apiKeyHint}</code>, so anything you have
                  already deployed keeps working. The snippets show a placeholder — paste
                  your saved key, or rotate from Settings to get a fresh one.
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.snippets.map(s => <CodeBlock key={s.label} snippet={s} />)}
          </div>

          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={13} style={{ color: '#10b981' }} />
              <span className="section-label" style={{ margin: 0 }}>Worth knowing</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.75,
              color: 'var(--color-subtext)' }}>
              {data.notes.map(n => <li key={n}>{n}</li>)}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
