import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, Boxes, FlaskConical, ScanSearch, ShieldCheck, HeartPulse, Bot } from 'lucide-react'
import { login as apiLogin } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { LogoMark } from '../components/ui/Logo'

// The five capabilities of the Aura platform, in the order the architecture
// diagram numbers them. Each maps to a real agent group in src/agents/.
const FEATURES = [
  { icon: Boxes,        title: 'Development Cycle & Schema Mapping',
    desc: 'IDE plugins and web dashboard over one semantic schema' },
  { icon: FlaskConical, title: 'AI-Driven Test Orchestration',
    desc: 'Generates Playwright UI and API suites, runs them continuously' },
  { icon: ScanSearch,   title: 'Reverse Engineering & Knowledge Extraction',
    desc: 'Maps legacy code into the graph and suggests refactoring' },
  { icon: ShieldCheck,  title: 'Vulnerability Remediation & RCA',
    desc: 'Correlates alerts, logs and dependencies to pinpoint root cause' },
  { icon: HeartPulse,   title: 'Self-Healing Applications',
    desc: 'Restores failing services from log and network signals' },
]

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login } = useAuthStore()

  const isPluginRedirect = searchParams.get('redirectplugin') === 'true'
  // `openExternal()` round-trips the extension's login URL through VS Code's
  // Uri.parse()/toString(), which decode every component and re-encode with a
  // different table — so a callback carrying `?windowId=2` can arrive here,
  // after useSearchParams' own decode, as `...callback%3FwindowId%253D2`.
  // Left as-is the `?` separator below folds windowId and access_token into the
  // *path*, where VS Code's URL router cannot see windowId and hands the token
  // to whichever window was last active instead of the one that signed in.
  const normaliseCallback = (raw: string): string => {
    let out = raw
    for (let i = 0; i < 3 && !out.includes('?'); i++) {
      let next: string
      try { next = decodeURIComponent(out) } catch { break }
      if (next === out) break
      out = next
    }
    return out
  }
  const callbackUri = normaliseCallback(
    searchParams.get('callbackUri') || 'vscode://aura.aura/auth/callback',  // must match publisher.name
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await apiLogin(username, password)
      const d = res.data
      login(d.access_token, d.username, d.userId, d.role, d.roleLabel, d.permissions ?? [])

      if (isPluginRedirect) {
        const params = new URLSearchParams({
          access_token: d.access_token,
          username: d.username,
          userId: String(d.userId),
          role: d.role,
          expires_in: '86400',
        })
        // asExternalUri() already puts a query on the callback (windowId=N on
        // desktop), so a second '?' would swallow our params into windowId's
        // value and the extension would find no access_token.
        const sep = callbackUri.includes('?') ? '&' : '?'
        window.location.href = `${callbackUri}${sep}${params.toString()}`
        return
      }

      navigate('/dashboard')
    } catch {
      setError('Invalid credentials. Try admin / admin')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* LEFT PANEL — Branding */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{
          width: '38%', minWidth: 360,
          background: 'var(--color-surface)',
          borderRight: '1px solid var(--color-border)',
          display: 'flex', flexDirection: 'column',
          padding: '36px 40px', position: 'relative', overflow: 'hidden',
        }}
      >
        {/* Subtle glow in top-right of left panel */}
        <div style={{
          position: 'absolute', top: 0, right: 0, width: 300, height: 300,
          background: 'radial-gradient(circle, rgba(232,76,14,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
          <LogoMark size={42} color="var(--color-primary)" />
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: 18, letterSpacing: '-0.03em', lineHeight: 1 }}>
              <span style={{ color: 'var(--color-primary)' }}>A</span>
              <span style={{ color: 'var(--color-text)' }}>ura</span>
              </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', color: 'var(--color-primary)', textTransform: 'uppercase', marginTop: 3 }}>
              AI Dev Agent Platform
            </div>
          </div>
        </div>

        {/* Hero Text */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 30, fontWeight: 900, color: 'var(--color-text)', lineHeight: 1.15, marginBottom: 6 }}>
            Multi-Agent<br />Orchestration.
          </h1>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 30, fontWeight: 900, color: 'var(--color-primary)', lineHeight: 1.15, marginBottom: 20 }}>
            Grounded in Your Schema.
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-subtext)', lineHeight: 1.7, marginBottom: 36, maxWidth: 300 }}>
            Aura maps multi-agent operations onto an explicit semantic schema, so every
            action is grounded in structured data triples rather than guesswork.
          </p>
        </motion.div>

        {/* Feature list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {FEATURES.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 + i * 0.08, duration: 0.4 }}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={14} color="var(--color-primary)" />
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13, color: 'var(--color-text)', marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: 11.5, color: 'var(--color-subtext)', lineHeight: 1.5 }}>{desc}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom version */}
        <div style={{ marginTop: 'auto', paddingTop: 32, fontSize: 11, color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
          v1.0.0 · Powered by Neo4j &amp; AWS Bedrock
        </div>
      </motion.div>

      {/* RIGHT PANEL — Form */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--color-bg)', position: 'relative',
      }}>
        {/* Subtle grid */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.025,
          backgroundImage: 'linear-gradient(var(--color-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-primary) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ width: '100%', maxWidth: 380, padding: 24, position: 'relative', zIndex: 1 }}
        >
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 800, color: 'var(--color-text)', marginBottom: 6 }}>
              Welcome back
            </h2>
            <p style={{ fontSize: 13, color: 'var(--color-subtext)' }}>
              {isPluginRedirect ? 'Sign in to connect the Aura VS Code extension' : 'Sign in to your workspace'}
            </p>
            {isPluginRedirect && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(232,76,14,0.08)', border: '1px solid rgba(232,76,14,0.25)', borderRadius: 8, padding: '7px 12px', fontSize: 12, color: 'var(--color-primary)' }}>
                <Bot size={13} />
                After signing in you will be redirected back to VS Code
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            {/* Username */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-subtext)', marginBottom: 6, fontFamily: 'var(--font-body)' }}>
                Username
              </label>
              <input
                className="ov-input"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-subtext)', marginBottom: 6, fontFamily: 'var(--font-body)' }}>
                Password
              </label>
              <input
                className="ov-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#ef4444', marginBottom: 16 }}
              >
                {error}
              </motion.div>
            )}

            <motion.button
              type="submit"
              className="ov-btn ov-btn-primary"
              style={{ width: '100%', justifyContent: 'center', fontSize: 14, padding: '11px 20px', borderRadius: 8 }}
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? <Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} /> : null}
              {loading ? 'Signing in...' : 'Sign In'}
            </motion.button>
          </form>
        </motion.div>
      </div>
    </div>
  )
}

export default LoginPage
