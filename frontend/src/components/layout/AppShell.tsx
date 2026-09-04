import { Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { useSidebarStore, SIDEBAR_RAIL, SIDEBAR_WIDTH } from '../../store/sidebarStore'
import { SDLCProvider } from '../../context/SDLCContext'
import RouteErrorBoundary from './RouteErrorBoundary'

// No `out` variant, and no AnimatePresence: the page swaps immediately and fades
// in. AnimatePresence with mode="wait" kept the OUTGOING page mounted until its
// exit animation finished and only then mounted the incoming one — so if an exit
// never completed, the new page never mounted at all. That is a blank content area
// with the shell still rendered, cured by a reload (which has no outgoing page),
// which is exactly the DevMate symptom that was reported repeatedly and never
// reproduced in Chromium or WebKit.
//
// The entering animation is kept because it is purely cosmetic and cannot block a
// mount. Nothing now sits between a route change and the new page rendering.
const pageVariants = {
  initial: { opacity: 0, y: 10 },
  in:      { opacity: 1, y: 0 },
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pageTransition: any = { type: 'tween', ease: 'anticipate', duration: 0.25 }

export function AppShell() {
  const location = useLocation()
  // The PINNED width only. A hover-expanded rail floats over the page instead of
  // widening this, so brushing the sidebar never reflows what you were reaching for.
  const collapsed = useSidebarStore(s => s.collapsed)
  const glide = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? 'none' : 'margin-left .18s ease' 
  return (
    <SDLCProvider>
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg)' }}>
        <Sidebar />
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          marginLeft: collapsed ? SIDEBAR_RAIL : SIDEBAR_WIDTH,
          transition: glide,
          height: '100vh', overflow: 'hidden' }}>
          <main style={{ flex: 1, padding: '24px', overflowY: 'auto', overflowX: 'hidden',
            height: '100%', display: 'flex', flexDirection: 'column' }}>
            <motion.div
              key={location.pathname}
              initial="initial"
              animate="in"
              variants={pageVariants}
              transition={pageTransition}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
            >
              <RouteErrorBoundary routeKey={location.pathname}>
                <Outlet />
              </RouteErrorBoundary>
            </motion.div>
          </main>
        </div>
      </div>
    </SDLCProvider>
  )
}

export default AppShell
