import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { BACKDROP, BACKDROP_BLUR, LAYERS } from './layers'

/**
 * `Modal` and `Drawer` — the two ways this app takes over the screen.
 *
 * There are **24 `position: fixed` overlays** across `src` today, at nine different
 * z-index tiers from 40 to 9990, with five different backdrop recipes. The same action
 * therefore dims the page by a different amount depending on which component ran it,
 * and whether a dialog lands above or below a drawer depends on which two components
 * happen to meet.
 *
 * `components/qa/ContainerLogsDrawer.tsx` is the only real slide-over in the codebase
 * and is the model here — `min(560px, 92vw)`, spring transition, `AnimatePresence`.
 * What it lacks, and what every one of the 24 lacks, is added once:
 *
 *   - **Escape closes.** Not one of them handles it.
 *   - **Scroll lock.** The page behind currently scrolls under every dialog.
 *   - **Focus moves in and comes back.** Nothing did this, so a keyboard user opening
 *     a dialog stayed on the trigger behind it.
 *   - **One backdrop, one stacking order** (see `layers.ts`).
 *
 * Deliberately NOT a focus TRAP. A trap needs to enumerate focusable descendants and
 * gets it wrong for portalled content, custom widgets and disabled controls; done badly
 * it is worse than none, because it can strand a keyboard user. Moving focus in on open
 * and restoring it on close is most of the value and cannot misfire.
 */

function useOverlayBehaviour(open: boolean, onClose?: () => void) {
  const panel = useRef<HTMLDivElement>(null)
  const restoreTo = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    restoreTo.current = document.activeElement as HTMLElement | null
    // Defer, so the element exists and the entrance animation has begun.
    const focusTimer = window.setTimeout(() => panel.current?.focus(), 0)

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onClose) {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)

    // Width is compensated so the page does not shift as the scrollbar disappears.
    const { overflow, paddingRight } = document.body.style
    const gap = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (gap > 0) document.body.style.paddingRight = `${gap}px`

    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      document.body.style.paddingRight = paddingRight
      restoreTo.current?.focus?.()
    }
  }, [open, onClose])

  return panel
}

function Backdrop({ onClick, zIndex }: { onClick?: () => void; zIndex: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      style={{
        position: 'fixed', inset: 0, zIndex,
        background: BACKDROP, backdropFilter: BACKDROP_BLUR,
      }}
    />
  )
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button" onClick={onClose} aria-label="Close"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 26, height: 26, borderRadius: 'var(--radius-sm)',
        background: 'none', border: '1px solid var(--color-border)',
        color: 'var(--color-muted)', cursor: 'pointer', flexShrink: 0,
      }}
    >
      <X size={13} />
    </button>
  )
}

function Header({ title, subtitle, actions, onClose }: {
  title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; onClose: () => void
}) {
  if (!title && !actions) return null
  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
      padding: 'var(--space-3)', borderBottom: '1px solid var(--color-border)',
      flexShrink: 0,
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        {title && (
          <div style={{ fontSize: 'var(--text-title)', fontWeight: 600,
                        color: 'var(--color-text)' }}>{title}</div>
        )}
        {subtitle && (
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-muted)',
                        marginTop: 1 }}>{subtitle}</div>
        )}
      </div>
      {actions}
      <CloseButton onClose={onClose} />
    </header>
  )
}

export interface OverlayProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  /** Clicking the backdrop closes. Off for anything with unsaved input. */
  dismissOnBackdrop?: boolean
  style?: React.CSSProperties
}

export function Drawer({
  open, onClose, title, subtitle, actions, children,
  dismissOnBackdrop = true, width = 'min(560px, 92vw)', style,
}: OverlayProps & { width?: number | string }) {
  const panel = useOverlayBehaviour(open, onClose)
  return (
    <AnimatePresence>
      {open && (
        <>
          <Backdrop zIndex={LAYERS.DRAWER - 1}
                    onClick={dismissOnBackdrop ? onClose : undefined} />
          <motion.aside
            ref={panel} tabIndex={-1} role="dialog" aria-modal="true"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 240 }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, width,
              zIndex: LAYERS.DRAWER, outline: 'none',
              background: 'var(--color-surface)',
              borderLeft: '1px solid var(--color-border)',
              display: 'flex', flexDirection: 'column',
              ...style,
            }}
          >
            <Header title={title} subtitle={subtitle} actions={actions} onClose={onClose} />
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

export function Modal({
  open, onClose, title, subtitle, actions, children,
  dismissOnBackdrop = true, width = 'min(680px, 94vw)', style,
}: OverlayProps & { width?: number | string }) {
  const panel = useOverlayBehaviour(open, onClose)
  return (
    <AnimatePresence>
      {open && (
        <>
          <Backdrop zIndex={LAYERS.MODAL - 1}
                    onClick={dismissOnBackdrop ? onClose : undefined} />
          <div style={{
            position: 'fixed', inset: 0, zIndex: LAYERS.MODAL,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 'var(--space-4)', pointerEvents: 'none',
          }}>
            <motion.div
              ref={panel} tabIndex={-1} role="dialog" aria-modal="true"
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              style={{
                width, maxHeight: '88vh', pointerEvents: 'auto', outline: 'none',
                background: 'var(--color-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                display: 'flex', flexDirection: 'column',
                ...style,
              }}
            >
              <Header title={title} subtitle={subtitle} actions={actions} onClose={onClose} />
              <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
