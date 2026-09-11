/**
 * Counts a number up to its value once, on mount.
 *
 * The point is not decoration: a dashboard that animates its numbers reads as
 * live, and the eye follows a value that moves. Eased out so it settles rather
 * than stopping dead, and skipped entirely under `prefers-reduced-motion` —
 * where the final value appears immediately, never a partial one.
 *
 * Only whole, finite numbers animate. A currency string, an em-dash or a label
 * is returned untouched, so a caller cannot accidentally animate "—" to "0".
 */
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

const DURATION_MS = 750

export function useCountUp(target: number | null, enabled = true): number | null {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState<number | null>(target)
  const frame = useRef<number>(0)

  useEffect(() => {
    if (target === null || !enabled || reduced || !Number.isFinite(target)) {
      setShown(target)
      return
    }
    // Below this a count-up is a flicker, not an animation.
    if (Math.abs(target) < 3) { setShown(target); return }

    const from = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS)
      const eased = 1 - Math.pow(1 - t, 3)          // easeOutCubic
      setShown(Math.round(from + (target - from) * eased))
      if (t < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [target, enabled, reduced])

  return shown
}
