import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle, Check, Copy, KeyRound, Loader2, PlayCircle, Rocket, ShieldCheck,
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

/**
 * Trigger the demo agents.
 *
 * Four standalone agents run continuously on their own service, so these screens are
 * never empty. This makes them produce traces NOW — which is the difference between
 * telling someone that traffic arrives every few minutes and showing them rows appear.
 *
 * It sits on THIS tab on purpose: the snippet above is literally the code those agents
 * run, so "here is how you instrument an agent" and "here is one doing it" are one
 * screen rather than two.
 *
 * Rendered only when the API says the service exists. An always-visible button that
 * 503s in every environment but one is worse than no button.
 */
function DemoTrigger() {
  const [agent, setAgent] = useState('all')
  const [count, setCount] = useState(1)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<api.DemoRunResult | null>(null)
  const [err, setErr] = useState('')

  const trigger = () => {
    setBusy(true); setErr(''); setResult(null)
    api.runDemoAgents(agent, count)
      .then(setResult)
      .catch(e => setErr(e?.response?.data?.detail
        || 'Could not reach the demo agents. Check the demo-agents service is running.'))
      .finally(() => setBusy(false))
  }

  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 11 }}>
      <div className="section-label">Demo agents</div>
      <div style={{ fontSize: 12.5, color: 'var(--color-subtext)', lineHeight: 1.65 }}>
        Four agents are onboarded here already — retrieval, tool-calling, multi-turn
        chat, and one that fails on purpose. They run continuously; this makes them run
        right now. Traces are queryable by the time this returns, so the Traces tab
        shows them on the next refresh.
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 210 }}>
          <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>Agent</span>
          <select value={agent} onChange={e => setAgent(e.target.value)} style={input}>
            {api.DEMO_AGENTS.map(a => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 100 }}>
          <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>Runs</span>
          {/* Capped at 5 server-side too. A burst is real model calls, and the request
              waits for all of them — five rounds across four agents is already ~100s. */}
          <input type="number" min={1} max={5} value={count} style={input}
            onChange={e => setCount(Math.min(5, Math.max(1, Number(e.target.value) || 1)))} />
        </label>

        <button type="button" onClick={trigger} style={btn} disabled={busy}>
          {busy ? <Loader2 size={12} className="animate-spin" /> : <PlayCircle size={12} />}
          {busy ? 'Running…' : 'Run now'}
        </button>
      </div>

      {busy && (
        <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>
          Waiting for real model calls and the trace flush — usually a few seconds per run.
        </div>
      )}
      {err && <div style={{ fontSize: 12, color: '#ef4444' }}>{err}</div>}
      {result && (
        <div style={{ fontSize: 12, color: 'var(--color-subtext)', lineHeight: 1.6 }}>
          Ran <strong style={{ color: 'var(--color-text)' }}>{result.triggered.join(', ')}</strong>
          {' '}×{result.count} in {(result.elapsedMs / 1000).toFixed(1)}s. New traces are in{' '}
          {result.projects.join(', ')}.
        </div>
      )}
    </div>
  )
}

export default function OnboardingTab(
  { project, caps }: { project: string; caps: api.StoreCapabilities | null },
) {
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
      {caps?.demoAgentsEnabled && <DemoTrigger />}

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
