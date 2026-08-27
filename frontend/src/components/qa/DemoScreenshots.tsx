import { useState } from 'react'
import { Monitor, Server, ShieldCheck, ShieldX, ChevronDown, ChevronUp } from 'lucide-react'
import { SAMPLE_SCREENSHOTS, type DemoScreenshot } from '../../data/qa-sample'

// ── Mini browser chrome wrapper ───────────────────────────────────────────────
function BrowserChrome({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #334155',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)', background: '#0f172a' }}>
      {/* Title bar */}
      <div style={{ background: '#1e293b', height: 34, display: 'flex', alignItems: 'center',
        padding: '0 12px', gap: 8, borderBottom: '1px solid #334155' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
        <div style={{ flex: 1, background: '#0f172a', borderRadius: 4, height: 20,
          display: 'flex', alignItems: 'center', padding: '0 10px', marginLeft: 8 }}>
          <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>{url}</span>
        </div>
      </div>
      {children}
    </div>
  )
}

// ── Terminal chrome wrapper ────────────────────────────────────────────────────
function TerminalChrome({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #334155',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
      <div style={{ background: '#1e293b', height: 34, display: 'flex', alignItems: 'center',
        padding: '0 14px', gap: 8, borderBottom: '1px solid #334155' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
        <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6, fontFamily: 'monospace' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

// ── Individual screenshot visuals ─────────────────────────────────────────────

function LoginScreenshot() {
  return (
    <BrowserChrome url="https://staging.aura.com/login">
      <div style={{ background: 'linear-gradient(135deg, #0a0a1a 0%, #0d0d2b 100%)',
        padding: '40px 20px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 320, background: 'rgba(30,30,60,0.9)', borderRadius: 14,
          border: '1px solid #3d3d6b', padding: '32px 28px', textAlign: 'center' }}>
          {/* Logo */}
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#5b21b6)',
            margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 900, color: 'white', fontFamily: 'system-ui' }}>A</div>
          <div style={{ fontFamily: 'system-ui', fontWeight: 800, fontSize: 18, color: '#e2e8f0', marginBottom: 4 }}>AURA</div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 24 }}>Agentic Dev Environment</div>
          {/* Fields */}
          {['demo.user@aura.com', '••••••••••••'].map((val, i) => (
            <div key={i} style={{ background: '#0f172a', border: '1px solid #4a4a7a',
              borderRadius: 8, padding: '9px 14px', marginBottom: 10,
              textAlign: 'left', fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{val}</div>
          ))}
          {/* Button */}
          <div style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', borderRadius: 8,
            padding: '10px', fontSize: 13, fontWeight: 700, color: 'white', fontFamily: 'system-ui',
            marginTop: 8, cursor: 'default' }}>Sign In to AURA</div>
          {/* SSO note */}
          <div style={{ fontSize: 10, color: '#475569', marginTop: 16 }}>or continue with Aura SSO</div>
        </div>
      </div>
    </BrowserChrome>
  )
}

function DashboardScreenshot() {
  return (
    <BrowserChrome url="https://staging.aura.com/dashboard">
      <div style={{ background: '#060c1a', display: 'flex', minHeight: 200 }}>
        {/* Sidebar */}
        <div style={{ width: 56, background: '#0d1526', borderRight: '1px solid #1e293b',
          display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0', gap: 16 }}>
          {['A','⬡','⚡','🔬','⚙'].map((ic, i) => (
            <div key={i} style={{ width: 32, height: 32, borderRadius: 8,
              background: i === 0 ? 'rgba(124,58,237,0.3)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: i === 0 ? '#a78bfa' : '#475569', cursor: 'default' }}>{ic}</div>
          ))}
        </div>
        {/* Main */}
        <div style={{ flex: 1, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 12, fontFamily: 'system-ui' }}>
            Aura Dashboard
          </div>
          {/* Credit card */}
          <div style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)',
            borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>AURA CREDITS</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#a78bfa', fontFamily: 'monospace' }}>6,154</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>Used: 3,846 · Tier 1 · Resets Sep 1</div>
          </div>
          {/* Agent list */}
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6, fontFamily: 'system-ui' }}>ACTIVE AGENTS</div>
          {[
            { name: 'Claude CLI · Claude CLI', color: '#10b981' },
            { name: 'Anthropic · claude-sonnet-4-5', color: '#3b82f6' },
          ].map((ag, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
              background: '#0f172a', borderRadius: 8, marginBottom: 6, border: '1px solid #1e293b' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: ag.color }} />
              <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui' }}>{ag.name}</span>
            </div>
          ))}
        </div>
      </div>
    </BrowserChrome>
  )
}

function ApiCreditsScreenshot({ failed }: { failed?: boolean }) {
  const statusColor = failed ? '#ef4444' : '#10b981'
  const statusText  = failed ? '404 Not Found' : '201 Created'
  const bodyJson = failed
    ? `{\n  "detail": "Not Found"\n}`
    : `{\n  "recorded": true,\n  "cost": 0.000045,\n  "creditsConsumed": 1\n}`

  return (
    <TerminalChrome title="API Test — POST /api/credits/record">
      <div style={{ background: '#0a0f1e', padding: 16, fontFamily: 'monospace', fontSize: 11, lineHeight: 1.7 }}>
        {/* Request */}
        <div style={{ color: '#64748b', marginBottom: 6 }}># Playwright API test · credits.api.spec.ts</div>
        <div><span style={{ color: '#7c3aed' }}>POST </span>
          <span style={{ color: '#38bdf8' }}>https://staging.aura.com</span>
          <span style={{ color: '#e2e8f0' }}>/api/credits/record</span></div>
        <div style={{ color: '#64748b', fontSize: 10, marginTop: 4 }}>Authorization: Bearer eyJhbG...</div>
        <div style={{ marginTop: 8, padding: '8px 10px', background: '#0f172a',
          borderRadius: 6, border: '1px solid #1e293b', color: '#94a3b8', fontSize: 10 }}>
          {`{\n  "taskId": "task-abc123",\n  "modelId": "claude-sonnet-4-5",\n  "inputTokens": 512,\n  "outputTokens": 128,\n  "costUsd": 0.000045\n}`.split('\n').map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
        {/* Response */}
        <div style={{ marginTop: 10 }}>
          <span style={{ color: '#64748b' }}>Response: </span>
          <span style={{ color: statusColor, fontWeight: 700 }}>{statusText}</span>
          <span style={{ color: '#64748b' }}> · 48ms</span>
        </div>
        <div style={{ marginTop: 6, padding: '8px 10px', background: '#0f172a',
          borderRadius: 6, border: `1px solid ${statusColor}33`, color: statusColor, fontSize: 10 }}>
          {bodyJson.split('\n').map((line, i) => <div key={i}>{line}</div>)}
        </div>
        {/* Assertion result */}
        <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6,
          background: `${statusColor}12`, border: `1px solid ${statusColor}33`,
          color: statusColor, fontSize: 10 }}>
          {failed
            ? '✗  expect(response.status()).toBe(201) → received 404'
            : '✓  expect(response.status()).toBe(201) → passed\n✓  expect(body.recorded).toBe(true) → passed\n✓  expect(body.creditsConsumed).toBeGreaterThan(0) → passed'}
        </div>
      </div>
    </TerminalChrome>
  )
}

function ApiAuthScreenshot() {
  return (
    <TerminalChrome title="API Test — POST /api/auth/login">
      <div style={{ background: '#0a0f1e', padding: 16, fontFamily: 'monospace', fontSize: 11, lineHeight: 1.7 }}>
        <div style={{ color: '#64748b', marginBottom: 6 }}># Playwright API test · auth.api.spec.ts</div>
        <div><span style={{ color: '#7c3aed' }}>POST </span>
          <span style={{ color: '#38bdf8' }}>https://staging.aura.com</span>
          <span style={{ color: '#e2e8f0' }}>/api/auth/login</span></div>
        <div style={{ marginTop: 8, padding: '8px 10px', background: '#0f172a',
          borderRadius: 6, border: '1px solid #1e293b', color: '#94a3b8', fontSize: 10 }}>
          {`{\n  "username": "demo@aura.com",\n  "password": "••••••••"\n}`.split('\n').map((l, i) => <div key={i}>{l}</div>)}
        </div>
        <div style={{ marginTop: 10 }}>
          <span style={{ color: '#64748b' }}>Response: </span>
          <span style={{ color: '#10b981', fontWeight: 700 }}>200 OK</span>
          <span style={{ color: '#64748b' }}> · 32ms</span>
        </div>
        <div style={{ marginTop: 6, padding: '8px 10px', background: '#0f172a',
          borderRadius: 6, border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', fontSize: 10 }}>
          {`{\n  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI...",\n  "userId": "usr-001",\n  "role": "super_admin"\n}`.split('\n').map((l, i) => <div key={i}>{l}</div>)}
        </div>
        <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6,
          background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)',
          color: '#10b981', fontSize: 10 }}>
          {'✓  expect(response.status()).toBe(200) → passed\n✓  expect(body.token).toBeTruthy() → passed\n✓  expect(body.role).toBe("super_admin") → passed'.split('\n').map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </div>
    </TerminalChrome>
  )
}

// ── Screenshot visual router ──────────────────────────────────────────────────
function ScreenshotVisual({ id }: { id: string }) {
  switch (id) {
    case 'login':        return <LoginScreenshot />
    case 'dashboard':    return <DashboardScreenshot />
    case 'api-credits':  return <ApiCreditsScreenshot />
    case 'credits-fail': return <ApiCreditsScreenshot failed />
    case 'api-auth':     return <ApiAuthScreenshot />
    default:             return <ApiAuthScreenshot />
  }
}

// ── Screenshot card ───────────────────────────────────────────────────────────
function ScreenshotCard({ shot }: { shot: DemoScreenshot }) {
  const [open, setOpen] = useState(false)
  const passed = shot.status === 'passed'
  const color  = passed ? '#10b981' : '#ef4444'

  return (
    <div style={{ background: 'var(--color-card)', border: `1px solid ${color}30`,
      borderRadius: 12, overflow: 'hidden', transition: 'box-shadow 0.15s' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
        cursor: 'pointer', borderBottom: open ? '1px solid var(--color-border)' : 'none' }}
        onClick={() => setOpen(v => !v)}>
        {/* Kind icon */}
        <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: `${color}14`, border: `1px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {shot.kind === 'ui'
            ? <Monitor size={15} color={color} />
            : <Server   size={15} color={color} />}
        </div>
        {/* Labels */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)',
            marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
            {shot.label}
            <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10,
              background: `${color}18`, color, border: `1px solid ${color}30`,
              fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              {passed ? <ShieldCheck size={9} /> : <ShieldX size={9} />}
              {passed ? 'PASSED' : 'FAILED'}
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--color-muted)', fontFamily: 'var(--font-mono)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {shot.sublabel}
          </div>
        </div>
        <span style={{ fontSize: 10, color: 'var(--color-muted)', flexShrink: 0, marginRight: 4 }}>
          {shot.duration}
        </span>
        {open ? <ChevronUp size={14} color="var(--color-muted)" /> : <ChevronDown size={14} color="var(--color-muted)" />}
      </div>

      {/* Expanded: screenshot + failure note */}
      {open && (
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ScreenshotVisual id={shot.id} />
          {shot.note && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: `${color}0c`,
              border: `1px solid ${color}30`, fontSize: 11, color,
              fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
              <span style={{ fontWeight: 700 }}>{passed ? '✓ ' : '✗ '}</span>
              {shot.note}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Public component ──────────────────────────────────────────────────────────
export default function DemoScreenshots({ runId }: { runId?: string | null }) {
  const shots = runId
    ? SAMPLE_SCREENSHOTS.filter(s => s.runId === runId)
    : SAMPLE_SCREENSHOTS

  if (!shots.length) return null

  const passed = shots.filter(s => s.status === 'passed').length
  const failed = shots.filter(s => s.status === 'failed').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Summary row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>
          Screenshots &amp; Evidence
        </span>
        <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>✓ {passed} passed</span>
        {failed > 0 && (
          <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>✗ {failed} failed</span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--color-muted)',
          background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)',
          borderRadius: 4, padding: '2px 8px', fontWeight: 600 }}>
          DEMO DATA
        </span>
      </div>
      {shots.map(s => <ScreenshotCard key={s.id} shot={s} />)}
    </div>
  )
}
