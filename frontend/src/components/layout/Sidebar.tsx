import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useSidebarStore, SIDEBAR_RAIL, SIDEBAR_WIDTH } from '../../store/sidebarStore'
import { LogoMark } from '../ui/Logo'
import { ALL_NAV_GROUPS } from './navGroups'

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } } }
const itemAnim = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } },
}

export function Sidebar() {
  const { username, role, roleLabel, permissions, logout } = useAuthStore()
  const navigate = useNavigate()
  const initials = (username ?? 'A').slice(0, 1).toUpperCase()

  const { collapsed, toggle } = useSidebarStore()
  const [hovering, setHovering] = useState(false)

  // Nothing in index.css disables motion globally, so the width animation this adds
  // is guarded where it is set. A sidebar that slides is a sidebar that moves under
  // the cursor of someone who asked for that not to happen.
  const glide = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? 'none' : 'width .18s ease' 

  // What the sidebar SHOWS. Hovering a collapsed rail reveals the labels without
  // un-pinning it, so you can read a name without losing the layout you chose.
  const open = !collapsed || hovering


  const visibleGroups = ALL_NAV_GROUPS
    .map(group => ({
      ...group,
      items: group.items.filter(item => permissions.includes(item.permission)),
    }))
    .filter(group => group.items.length > 0)

  return (
    <aside
      onMouseEnter={() => collapsed && setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        position: 'fixed', left: 0, top: 0, bottom: 0,
        width: open ? SIDEBAR_WIDTH : SIDEBAR_RAIL,
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex', flexDirection: 'column', zIndex: 50, overflow: 'hidden',
        transition: glide,
        // A hover-expanded rail floats OVER the page rather than pushing it, which is
        // what lets the layout keep reserving only the pinned width.
        boxShadow: collapsed && hovering ? '4px 0 24px rgba(0,0,0,.45)' : 'none',
      }}
    >
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          padding: open ? '18px 16px 14px' : '16px 6px 12px',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        {/* The full lockup in BOTH states — mark, name, tagline. Expanded lays it
            out horizontally as before; the rail stacks it and centres it, because
            "AI DEV AGENT PLATFORM" is ~88px on one line and the rail is 76.

            The tagline wraps to three lines rather than shrinking to fit one: at the
            size a single line would need it stops being readable and becomes a grey
            smear, which is worse than an honest three-line block. */}
        <div style={{
          display: 'flex', gap: open ? 9 : 5,
          flexDirection: open ? 'row' : 'column',
          alignItems: 'center',
          justifyContent: open ? 'flex-start' : 'center',
        }}>
          <LogoMark size={30} color="var(--color-primary)" />
          <div style={{
            textAlign: open ? 'left' : 'center',
            minWidth: 0,
          }}>
            <div style={{
              fontFamily: 'var(--font-heading)', fontWeight: 900,
              fontSize: open ? 14 : 13, letterSpacing: '-0.03em', lineHeight: 1,
              whiteSpace: 'nowrap',
            }}>
              <span style={{ color: 'var(--color-primary)' }}>A</span>
              <span style={{ color: 'var(--color-text)' }}>ura</span>
            </div>
            <div style={{
              fontFamily: 'var(--font-heading)', fontWeight: 700,
              color: 'var(--color-primary)', textTransform: 'uppercase',
              marginTop: 2,
              fontSize: open ? 8 : 6.5,
              // Tracking is what makes this line wide. Expanded can afford it;
              // the rail trades most of it back for legibility at 6.5px.
              letterSpacing: open ? '0.16em' : '0.04em',
              lineHeight: open ? 1.2 : 1.35,
              whiteSpace: open ? 'nowrap' : 'normal',
            }}>AI Dev Agent Platform</div>
          </div>
        </div>
      </motion.div>

      {/* Platform status */}
      <div style={{
        padding: open ? '8px 16px' : '8px 0',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          justifyContent: open ? 'flex-start' : 'center',
        }} title={open ? undefined : 'Platform Operational'}>
          <div className="pulse-dot" style={{ width: 6, height: 6, flexShrink: 0 }} />
          {open && (
            <span style={{
              fontSize: 11, color: 'var(--color-success)', fontWeight: 600,
              fontFamily: 'var(--font-heading)', whiteSpace: 'nowrap',
            }}>Platform Operational</span>
          )}
        </div>
      </div>

      {/* Nav groups — role-filtered */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
        <motion.div variants={stagger} initial="hidden" animate="show">
          {visibleGroups.map(group => (
            <div key={group.label} style={{ marginBottom: 4 }}>
              {/* A group heading truncated into a 68px rail reads as a broken word,
                  so the collapsed state keeps the SEPARATION and drops the text. */}
              {open ? (
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
                  color: 'var(--color-muted)', fontFamily: 'var(--font-heading)',
                  padding: '10px 8px 4px', whiteSpace: 'nowrap',
                }}>
                  {group.label}
                </div>
              ) : (
                <div aria-hidden style={{
                  height: 1, background: 'var(--color-border)', margin: '10px 14px 6px',
                }} />
              )}
              {group.items.map(({ to, label, icon: Icon, badge }) => (
                <motion.div key={to + label} variants={itemAnim}>
                  <NavLink
                    to={to}
                    end
                    // A native tooltip as well as the hover-expand: it answers the
                    // question without waiting for the panel, and it is what a
                    // keyboard or screen-reader user gets.
                    title={open ? undefined : label}
                    className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                    style={{
                      fontSize: 13, borderRadius: 7, display: 'flex', alignItems: 'center',
                      gap: 8, position: 'relative',
                      padding: open ? '7px 10px' : '9px 0',
                      justifyContent: open ? 'flex-start' : 'center',
                    }}
                  >
                    {/* Icons grow in the rail: at 14px they are lost in the space a
                        68px column gives them, and the icon is the only label left. */}
                    <Icon size={open ? 14 : 20} style={{ flexShrink: 0 }} />
                    {open && <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{label}</span>}
                    {badge && (open ? (
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
                        background: 'var(--color-primary)', color: '#fff',
                        borderRadius: 4, padding: '1px 5px',
                      }}>{badge}</span>
                    ) : (
                      // The badge text cannot fit, but losing the signal entirely
                      // would hide that this item is flagged at all.
                      <span aria-label={badge} style={{
                        position: 'absolute', top: 6, right: 12,
                        width: 5, height: 5, borderRadius: '50%',
                        background: 'var(--color-primary)',
                      }} />
                    ))}
                  </NavLink>
                </motion.div>
              ))}
            </div>
          ))}
        </motion.div>
      </div>

      {/* Collapse toggle. Above the footer rather than beside the logo: at 68px
          there is no room next to the mark, and a control that moves between states
          is a control people stop finding. */}
      <button
        onClick={toggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          justifyContent: open ? 'flex-start' : 'center',
          padding: open ? '9px 14px' : '9px 0',
          margin: 0, width: '100%',
          background: 'none', border: 'none',
          borderTop: '1px solid var(--color-border)',
          color: 'var(--color-muted)', cursor: 'pointer',
          fontFamily: 'var(--font-heading)', fontSize: 11.5, fontWeight: 600,
          transition: 'color .15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-muted)')}
      >
        {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={15} />}
        {open && <span style={{ whiteSpace: 'nowrap' }}>Collapse</span>}
      </button>

      {/* User footer */}
      <div style={{
        padding: open ? '12px 14px' : '12px 0',
        borderTop: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', gap: 9,
        justifyContent: open ? 'flex-start' : 'center',
      }}>
        <div title={open ? undefined : `${username} — ${roleLabel ?? role}`} style={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          background: 'var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13, color: '#fff',
        }}>{initials}</div>
        {open && (
          <>
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
          </>
        )}
      </div>
    </aside>
  )
}

export default Sidebar
