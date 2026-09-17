import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { LAYERS } from '../ui/layers'

/**
 * A modal wait for a long migration step.
 *
 * Analysing and revising are several model calls deep and can run for a minute or
 * more, and both REPLACE what is on screen when they finish — the strategy appears,
 * the component verdicts change. Leaving the old strategy visible and interactive
 * behind an inline spinner invites someone to act on results that are about to be
 * thrown away. So it takes over the screen and closes itself when the work lands.
 *
 * The rotating phrases describe what the step actually does, in the order the prompt
 * asks for it. Nothing here reports a percentage: the backend gives no progress for
 * these steps, so a filling bar would be a guess dressed as information. Conversion
 * is different — it has real `n of m` from the server and shows that instead.
 */

export type ThinkingKind = 'analysing' | 'revising' | 'starting' | 'saving'

const PHRASES: Record<ThinkingKind, string[]> = {
  analysing: [
    'Reading the knowledge graph…',
    'Working through the source components…',
    'Matching them against the target platform…',
    'Looking for what cannot be migrated…',
    'Weighing risks and unknowns…',
    'Drafting the strategy…',
  ],
  revising: [
    'Taking your answers on board…',
    'Reconsidering the component verdicts…',
    'Re-checking the risks against what you told it…',
    'Rewriting the strategy…',
  ],
  starting: [
    'Opening the migration…',
    'Reading your estate for component standards…',
  ],
  saving: ['Saving your changes…'],
}

const HEADING: Record<ThinkingKind, string> = {
  analysing: 'Analysing the application',
  revising: 'Revising the strategy',
  starting: 'Setting up',
  saving: 'Saving',
}

// Slow enough to read, fast enough to feel alive.
const ROTATE_MS = 3200
// When to admit this is taking a while, and when to offer a way out.
const ELAPSED_AFTER_S = 5
const REASSURE_AFTER_S = 25
const ESCAPE_AFTER_S = 45

export default function MigrationThinking({ kind, onHide }: {
  kind: ThinkingKind
  /** Dismiss the overlay. The work keeps running — see the note by the button. */
  onHide?: () => void
}) {
  const phrases = PHRASES[kind] ?? PHRASES.analysing
  const [index, setIndex] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    setIndex(0)
    setElapsed(0)
    // Stops on the last phrase rather than looping — cycling back to the first
    // would suggest it had started over.
    const rotate = setInterval(
      () => setIndex(i => (i < phrases.length - 1 ? i + 1 : i)), ROTATE_MS)
    const tick = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => { clearInterval(rotate); clearInterval(tick) }
  }, [kind, phrases.length])

  // Escape hides the overlay once the escape hatch is offered. Deliberately not
  // before: dismissing instantly turns a modal that exists to prevent acting on
  // stale results into one that does not.
  useEffect(() => {
    if (!onHide || elapsed < ESCAPE_AFTER_S) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onHide() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onHide, elapsed])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      aria-label={HEADING[kind]}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
        backdropFilter: 'blur(2px)', zIndex: LAYERS.MODAL,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
      // No click-away: the work is not cancellable, and a backdrop that dismisses
      // on a stray click would leave someone staring at a strategy about to change
      // under them with no idea why.
    >
      <motion.div
        initial={{ scale: .97, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        style={{
          background: 'var(--color-bg)', border: '1px solid var(--color-border)',
          borderRadius: 14, width: 'min(460px, 100%)', padding: 26,
          display: 'flex', flexDirection: 'column', gap: 16,
          boxShadow: '0 24px 64px rgba(0,0,0,.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* .typing-dot lives in index.css and is staggered by nth-child. */}
          <span style={{ display: 'inline-flex', gap: 4, flexShrink: 0 }}>
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </span>
          <span style={{
            fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 800,
            color: 'var(--color-text)',
          }}>
            {HEADING[kind]}
          </span>
          <span style={{ flex: 1 }} />
          {elapsed >= ELAPSED_AFTER_S && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 11.5,
              color: 'var(--color-muted)', fontVariantNumeric: 'tabular-nums',
            }}>
              {elapsed}s
            </span>
          )}
        </div>

        {/* `key` remounts the node so the fade replays on each change. */}
        <div
          key={index}
          style={{
            fontSize: 13.5, color: 'var(--color-subtext)', lineHeight: 1.55,
            minHeight: 21, animation: 'fade-in .4s ease',
          }}
        >
          {phrases[index]}
        </div>

        {/* Indeterminate on purpose — see the note at the top of this file. */}
        <div className="skeleton" style={{ height: 4, borderRadius: 2 }} />

        {elapsed >= REASSURE_AFTER_S && (
          <div style={{ fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.55 }}>
            Larger applications take longer — every component is read before anything
            is proposed.
          </div>
        )}

        {/* A way out, but only once waiting has stopped looking normal. Without it a
            hung request traps you in a modal with no cancel; with it, you are told
            plainly that hiding the overlay does not stop the work. */}
        {onHide && elapsed >= ESCAPE_AFTER_S && (
          <button
            onClick={onHide}
            style={{
              alignSelf: 'flex-start', padding: '6px 12px', borderRadius: 7,
              background: 'var(--color-surface)', color: 'var(--color-text)',
              border: '1px solid var(--color-border)', cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
            }}
          >
            Hide — it keeps running
          </button>
        )}
      </motion.div>
    </motion.div>
  )
}
