import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, MessageSquare, Settings, Plug2,
  LogOut, FolderUp, ScrollText, Activity, Orbit,
  TestTube2, Users, ShieldCheck, CalendarClock, Bot, Database,
  ScanSearch, Radar, Server, GitCompareArrows,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { LogoMark } from '../ui/Logo'

// ── Nav item type ─────────────────────────────────────────────────────────────
interface NavItem {
  to: string
  label: string
  icon: React.ElementType
  permission: string
  badge?: string
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const ALL_NAV_GROUPS: NavGroup[] = [
  {
    // Ordered by how the work actually flows: build the graph (Onto Verse,
    // Lineage), then the surfaces that consume it (DevMate, QualityMind,
    // Reverse Eng.), then the ones that observe it running (AI Traces, AI Ops,
    // Observability).
    label: 'WORKSPACE',
    items: [
      { to: '/dashboard',            label: 'Dashboard',           icon: LayoutDashboard,  permission: 'dashboard' },
      { to: '/ontology',             label: 'Onto Verse',          icon: Orbit,            permission: 'ontology' },
      { to: '/lineage',              label: 'Lineage',             icon: GitCompareArrows, permission: 'ontology' },
      { to: '/dev-chat',             label: 'DevMate',             icon: Bot,              permission: 'dev_workspace' },
      { to: '/qa',                   label: 'QualityMind',         icon: TestTube2,        permission: 'qa_workspace' },
      { to: '/reverse-engineering',  label: 'Reverse Eng.',        icon: ScanSearch,       permission: 'dev_workspace' },
      { to: '/ai-observability',     label: 'AI Traces',           icon: Activity,         permission: 'dev_workspace' },
      { to: '/aiops',                label: 'AI Ops',              icon: Activity,         permission: 'aiops' },
      { to: '/observability',        label: 'Observability',       icon: Radar,            permission: 'observability', badge: 'SRE' },
    ],
  },
  {
    label: 'DATA',
    items: [
      // Data Loader leads: it is what puts data into the graph, and Connectors
      // and MCP Servers are the sources it draws on.
      { to: '/ontology/data-loader', label: 'Data Loader',         icon: Database,        permission: 'ontology_maintain' },
      { to: '/connectors',           label: 'Connectors',          icon: Plug2,           permission: 'connectors' },
      { to: '/mcp',                  label: 'MCP Servers',         icon: Server,          permission: 'connectors' },
      { to: '/scheduler',            label: 'Scheduler',           icon: CalendarClock,   permission: 'scheduler' },
      { to: '/upload',               label: 'Upload',              icon: FolderUp,        permission: 'upload' },
      { to: '/logs',                 label: 'Logs',                icon: ScrollText,      permission: 'logs' },
    ],
  },
  {
    label: 'ADMIN',
    items: [
      { to: '/settings',         label: 'Settings',         icon: Settings,    permission: 'settings' },
      { to: '/settings/users',   label: 'User Management',  icon: Users,       permission: 'user_management' },
      { to: '/settings/roles',   label: 'Role Management',  icon: ShieldCheck, permission: 'role_management' },
    ],
  },
]

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } } }
const itemAnim = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } },
}

export function Sidebar() {
  const { username, role, roleLabel, permissions, logout } = useAuthStore()
  const navigate = useNavigate()
  const initials = (username ?? 'A').slice(0, 1).toUpperCase()

  const visibleGroups = ALL_NAV_GROUPS
    .map(group => ({
      ...group,
      items: group.items.filter(item => permissions.includes(item.permission)),
    }))
    .filter(group => group.items.length > 0)

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0, bottom: 0, width: 224,
      background: 'var(--color-surface)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex', flexDirection: 'column', zIndex: 50, overflow: 'hidden',
    }}>
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--color-border)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <LogoMark size={30} color="var(--color-primary)" />
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: 14, letterSpacing: '-0.03em', lineHeight: 1 }}>
              <span style={{ color: 'var(--color-primary)' }}>A</span>
              <span style={{ color: 'var(--color-text)' }}>ura</span>
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 8, fontWeight: 700, letterSpacing: '0.16em', color: 'var(--color-primary)', textTransform: 'uppercase', marginTop: 2 }}>AI Dev Agent Platform</div>
          </div>
        </div>
      </motion.div>

      {/* Platform status */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="pulse-dot" style={{ width: 6, height: 6 }} />
          <span style={{ fontSize: 11, color: 'var(--color-success)', fontWeight: 600, fontFamily: 'var(--font-heading)' }}>Platform Operational</span>
        </div>
      </div>

      {/* Nav groups — role-filtered */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
        <motion.div variants={stagger} initial="hidden" animate="show">
          {visibleGroups.map(group => (
            <div key={group.label} style={{ marginBottom: 4 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
                color: 'var(--color-muted)', fontFamily: 'var(--font-heading)',
                padding: '10px 8px 4px',
              }}>
                {group.label}
              </div>
              {group.items.map(({ to, label, icon: Icon, badge }) => (
                <motion.div key={to + label} variants={itemAnim}>
                  <NavLink
                    to={to}
                    end
                    className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                    style={{ fontSize: 13, padding: '7px 10px', borderRadius: 7, display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <Icon size={14} />
                    <span style={{ flex: 1 }}>{label}</span>
                    {badge && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
                        background: 'var(--color-primary)', color: '#fff',
                        borderRadius: 4, padding: '1px 5px',
                      }}>{badge}</span>
                    )}
                  </NavLink>
                </motion.div>
              ))}
            </div>
          ))}
        </motion.div>
      </div>

      {/* User footer */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          background: 'var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13, color: '#fff',
        }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 12.5, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{username}</div>
          <div style={{ fontSize: 10, color: 'var(--color-primary)', fontWeight: 600 }}>● {roleLabel ?? role}</div>
        </div>
        <button
          onClick={() => { logout(); navigate('/login') }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: 4, borderRadius: 4, display: 'flex' }}
          title="Sign out"
        >
          <LogOut size={13} />
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
