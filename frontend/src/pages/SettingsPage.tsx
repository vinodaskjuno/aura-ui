import { motion } from 'framer-motion'
import { Moon, Sun, Monitor, User, LogOut, Users, ShieldCheck, ChevronRight, DollarSign, RotateCcw, Save, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useThemeStore } from '../store/themeStore'
import { useAuthStore } from '../store/authStore'
import { getBudgetConfig, updateBudgetConfig, getAllUserBudgets, resetUserBudget, type BudgetConfig, type AllUserBudget } from '../api/budget'
import GraphBackendPanel from '../components/settings/GraphBackendPanel'

type ThemeId = 'dark1' | 'dark2' | 'light'

const THEMES: { id: ThemeId; label: string; desc: string; icon: any; bg: string; surface: string; primary: string; text: string }[] = [
  {
    id: 'dark1', label: 'Aura Navy', desc: 'Deep navy dark theme',
    icon: Moon, bg: '#060c1a', surface: '#0d1424', primary: '#4f8ef7', text: '#e2e8f0',
  },
  {
    id: 'dark2', label: 'Senzing Dark', desc: 'Charcoal + orange-red',
    icon: Monitor, bg: '#0d0d0d', surface: '#181818', primary: '#e84c0e', text: '#ffffff',
  },
  {
    id: 'light', label: 'Light', desc: 'Clean white professional',
    icon: Sun, bg: '#f4f6f9', surface: '#ffffff', primary: '#2563eb', text: '#0f172a',
  },
]

function ThemePreview({ theme, selected, onSelect }: { theme: typeof THEMES[0]; selected: boolean; onSelect: () => void }) {
  return (
    <motion.div
      onClick={onSelect}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      style={{
        cursor: 'pointer', borderRadius: 12, overflow: 'hidden',
        border: `2px solid ${selected ? theme.primary : 'var(--color-border)'}`,
        boxShadow: selected ? `0 0 16px ${theme.primary}44` : 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Mini preview */}
      <div style={{ background: theme.bg, padding: 12, height: 90, position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <div style={{ width: 40, height: 6, borderRadius: 3, background: theme.surface }} />
          <div style={{ width: 24, height: 6, borderRadius: 3, background: theme.primary, opacity: 0.9 }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ flex: 1, height: 40, borderRadius: 6, background: theme.surface, border: `1px solid ${theme.text}10` }}>
              <div style={{ height: 3, width: '60%', background: theme.primary, borderRadius: 2, margin: 8 }} />
              <div style={{ height: 3, width: '40%', background: theme.text, opacity: 0.3, borderRadius: 2, margin: '4px 8px' }} />
            </div>
          ))}
        </div>
      </div>
      {/* Label */}
      <div style={{ background: 'var(--color-card)', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{theme.label}</div>
          <div style={{ fontSize: 11, color: 'var(--color-subtext)', marginTop: 2 }}>{theme.desc}</div>
        </div>
        {selected && (
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            style={{ width: 16, height: 16, borderRadius: '50%', background: theme.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

export function SettingsPage() {
  const { theme, setTheme } = useThemeStore()
  const { username, role, roleLabel, logout, hasPermission } = useAuthStore()
  const navigate = useNavigate()

  const isAdmin = role === 'admin' || role === 'super_admin'

  // Budget & Tier state (admin only)
  const [budgetConfig, setBudgetConfig] = useState<BudgetConfig | null>(null)
  const [budgetDraft, setBudgetDraft] = useState<{ tier1: string; tier2: string; tier3: string; threshold: string }>({ tier1: '500', tier2: '200', tier3: '9999', threshold: '80' })
  const [userBudgets, setUserBudgets] = useState<AllUserBudget[]>([])
  const [savingBudget, setSavingBudget] = useState(false)
  const [resettingUser, setResettingUser] = useState<string | null>(null)
  const [budgetMsg, setBudgetMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin) return
    getBudgetConfig().then(c => {
      setBudgetConfig(c)
      setBudgetDraft({
        tier1: c.tier1LimitUSD,
        tier2: c.tier2LimitUSD,
        tier3: c.tier3LimitUSD,
        threshold: String(Math.round(parseFloat(c.alertThreshold) * 100)),
      })
    }).catch(() => {})
    getAllUserBudgets().then(setUserBudgets).catch(() => {})
  }, [isAdmin])

  const handleSaveBudget = async () => {
    setSavingBudget(true)
    setBudgetMsg(null)
    try {
      const updated = await updateBudgetConfig({
        tier1LimitUSD: parseFloat(budgetDraft.tier1) || 500,
        tier2LimitUSD: parseFloat(budgetDraft.tier2) || 200,
        tier3LimitUSD: parseFloat(budgetDraft.tier3) || 9999,
        alertThreshold: (parseFloat(budgetDraft.threshold) || 80) / 100,
      })
      setBudgetConfig(updated)
      setBudgetMsg('Saved successfully.')
    } catch {
      setBudgetMsg('Failed to save. Please try again.')
    } finally {
      setSavingBudget(false)
    }
  }

  const handleResetUser = async (userId: string) => {
    setResettingUser(userId)
    try {
      await resetUserBudget(userId)
      setUserBudgets(prev => prev.map(u => u.userId === userId
        ? { ...u, spend: { tier1: 0, tier2: 0, tier3: 0 }, currentTier: 1 }
        : u
      ))
    } catch { /* best effort */ }
    finally { setResettingUser(null) }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <div className="section-label" style={{ marginBottom: 4 }}>Configuration</div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 800 }}>Settings</h2>
      </div>

      {/* Theme section */}
      <motion.div className="ov-card" style={{ padding: 24, marginBottom: 16 }}
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="section-label" style={{ marginBottom: 4 }}>Appearance</div>
        <p style={{ color: 'var(--color-subtext)', fontSize: 12, marginBottom: 20 }}>
          Select a visual theme. Your preference is saved across sessions.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {THEMES.map(t => (
            <ThemePreview key={t.id} theme={t} selected={theme === t.id} onSelect={() => setTheme(t.id)} />
          ))}
        </div>
      </motion.div>

      {/* Account section */}
      <motion.div className="ov-card" style={{ padding: 24, marginBottom: 16 }}
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
        <div className="section-label" style={{ marginBottom: 16 }}>Account</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15 }}>{username}</div>
              <div className="ov-badge badge-primary" style={{ marginTop: 4 }}>{roleLabel ?? role}</div>
            </div>
          </div>
          <motion.button
            className="ov-btn ov-btn-ghost"
            onClick={() => { logout(); navigate('/login') }}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          >
            <LogOut size={14} /> Sign Out
          </motion.button>
        </div>
      </motion.div>

      {/* Admin shortcuts — only shown to admin+ */}
      {(hasPermission('user_management') || hasPermission('role_management')) && (
        <motion.div className="ov-card" style={{ padding: 24, marginBottom: 16 }}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
          <div className="section-label" style={{ marginBottom: 16 }}>Administration</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {hasPermission('user_management') && (
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/settings/users')}
                style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Users size={16} color="var(--color-primary)" />
                  <div>
                    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13, color: 'var(--color-text)' }}>User Management</div>
                    <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>Create, edit and deactivate users</div>
                  </div>
                </div>
                <ChevronRight size={14} color="var(--color-muted)" />
              </motion.button>
            )}
            {hasPermission('role_management') && (
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/settings/roles')}
                style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ShieldCheck size={16} color="var(--color-primary)" />
                  <div>
                    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13, color: 'var(--color-text)' }}>Role Management</div>
                    <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>Configure permissions per role</div>
                  </div>
                </div>
                <ChevronRight size={14} color="var(--color-muted)" />
              </motion.button>
            )}
          </div>
        </motion.div>
      )}

      {/* Budget & Tiers — admin only */}
      {/* Graph backend — which engine serves reads, which receive writes */}
      <motion.div className="ov-card" style={{ padding: 24, marginBottom: 16 }}
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
        <div className="section-label" style={{ marginBottom: 16 }}>Graph Backend</div>
        <GraphBackendPanel />
      </motion.div>

      {isAdmin && (
        <motion.div className="ov-card" style={{ padding: 24, marginBottom: 16 }}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <DollarSign size={14} color="var(--color-primary)" />
            <div className="section-label">Budget &amp; Tiers</div>
          </div>
          <p style={{ color: 'var(--color-subtext)', fontSize: 12, marginBottom: 20 }}>
            Set monthly spending limits per tier. Users are warned at the alert threshold and automatically switched when the limit is reached.
          </p>

          {/* Tier limit inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            {([
              { label: 'Tier 1 — Premium', key: 'tier1' as const, color: '#ef4444' },
              { label: 'Tier 2 — Balanced', key: 'tier2' as const, color: '#f59e0b' },
              { label: 'Tier 3 — Economy', key: 'tier3' as const, color: '#10b981' },
            ]).map(({ label, key, color }) => (
              <div key={key}>
                <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>$</span>
                  <input
                    type="number"
                    min={0}
                    value={budgetDraft[key]}
                    onChange={e => setBudgetDraft(prev => ({ ...prev, [key]: e.target.value }))}
                    style={{
                      flex: 1, background: 'var(--color-card)', border: '1px solid var(--color-border)',
                      borderRadius: 7, padding: '7px 10px', fontSize: 13, color: 'var(--color-text)',
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>/mo</span>
                </div>
              </div>
            ))}
          </div>

          {/* Alert threshold */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text)', fontWeight: 600, whiteSpace: 'nowrap' }}>Alert at</div>
            <input
              type="number"
              min={50}
              max={99}
              value={budgetDraft.threshold}
              onChange={e => setBudgetDraft(prev => ({ ...prev, threshold: e.target.value }))}
              style={{
                width: 70, background: 'var(--color-card)', border: '1px solid var(--color-border)',
                borderRadius: 7, padding: '7px 10px', fontSize: 13, color: 'var(--color-text)', outline: 'none',
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>% of limit</span>
            <div style={{ flex: 1 }} />
            {budgetMsg && (
              <span style={{ fontSize: 12, color: budgetMsg.includes('Fail') ? '#ef4444' : '#10b981' }}>{budgetMsg}</span>
            )}
            <motion.button
              className="ov-btn ov-btn-primary"
              onClick={handleSaveBudget}
              disabled={savingBudget}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
            >
              {savingBudget ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
              Save Limits
            </motion.button>
          </div>

          {/* Per-user spend table */}
          {userBudgets.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)', marginBottom: 10, borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>User Spend — Current Period</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      {['User', 'Tier', 'T1 Spend', 'T2 Spend', 'T3 Spend', 'Period', ''].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--color-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {userBudgets.map(u => (
                      <tr key={u.userId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '8px 10px', color: 'var(--color-text)', fontWeight: 600 }}>{u.userId}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: u.currentTier === 1 ? 'rgba(239,68,68,0.12)' : u.currentTier === 2 ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)', color: u.currentTier === 1 ? '#ef4444' : u.currentTier === 2 ? '#f59e0b' : '#10b981' }}>T{u.currentTier}</span>
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--color-muted)' }}>${u.spend.tier1.toFixed(3)}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--color-muted)' }}>${u.spend.tier2.toFixed(3)}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--color-muted)' }}>${u.spend.tier3.toFixed(3)}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--color-muted)' }}>{u.periodStart}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <button
                            onClick={() => handleResetUser(u.userId)}
                            disabled={resettingUser === u.userId}
                            title="Reset period spend"
                            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, color: 'var(--color-muted)' }}
                          >
                            {resettingUser === u.userId
                              ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                              : <RotateCcw size={11} />}
                            Reset
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* About section */}
      <motion.div className="ov-card" style={{ padding: 24 }}
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}>
        <div className="section-label" style={{ marginBottom: 16 }}>About</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            ['Application', 'Aura v5.0.0'],
            ['Frontend', 'React 18 + Vite + Framer Motion'],
            ['Backend', 'FastAPI + Oxigraph (pyoxigraph)'],
            ['Ontology', 'OWL 2 — 3 Domains, 481 triples'],
            ['Graph Viz', 'Cytoscape.js (fcose + dagre)'],
            ['AI Advisor', 'AWS Bedrock Claude Sonnet + ReAct'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ fontSize: 11, color: 'var(--color-subtext)', fontFamily: 'var(--font-heading)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{k}</div>
              <div style={{ fontSize: 13, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>{v}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

export default SettingsPage
