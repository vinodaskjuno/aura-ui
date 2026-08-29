import { Outlet, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { SDLCProvider } from '../../context/SDLCContext'
import RouteErrorBoundary from './RouteErrorBoundary'

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  in:      { opacity: 1, y: 0 },
  out:     { opacity: 0, y: -6 },
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pageTransition: any = { type: 'tween', ease: 'anticipate', duration: 0.25 }

export function AppShell() {
  const location = useLocation()
  return (
    <SDLCProvider>
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg)' }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginLeft: 224,
          height: '100vh', overflow: 'hidden' }}>
          <main style={{ flex: 1, padding: '24px', overflowY: 'auto', overflowX: 'hidden',
            height: '100%', display: 'flex', flexDirection: 'column' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial="initial"
                animate="in"
                exit="out"
                variants={pageVariants}
                transition={pageTransition}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
              >
                <RouteErrorBoundary routeKey={location.pathname}>
                  <Outlet />
                </RouteErrorBoundary>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </SDLCProvider>
  )
}

export default AppShell
