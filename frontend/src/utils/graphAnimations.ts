/**
 * Shared animation utilities for AURA specialist graph views.
 * All timings in milliseconds.
 */

export const ANIMATION = {
  nodeEnterDuration: 150,
  nodeEnterStagger: 30,
  edgeDrawDuration: 300,
  viewSwitchOut: 200,
  viewSwitchIn: 300,
  selectionPulse: 600,
  flowDotSpeed: 2000,
}

/**
 * Returns a CSS `animation` shorthand string for node fade-in + scale-up
 * with an index-based delay for stagger effect.
 */
export function nodeEnterAnimation(index: number): string {
  const delay = Math.min(index * ANIMATION.nodeEnterStagger, 600)
  return `graphNodeEnter ${ANIMATION.nodeEnterDuration}ms ease ${delay}ms both`
}

/**
 * Returns a CSS `animation` shorthand for edge draw-in (stroke-dashoffset).
 * The component must also set `strokeDasharray` + `strokeDashoffset` on the path.
 */
export function edgeDrawAnimation(index: number): string {
  const delay = Math.min(index * 20, 400)
  return `graphEdgeDraw ${ANIMATION.edgeDrawDuration}ms ease ${delay}ms both`
}

/**
 * Returns inline style for a selected node's amber pulse ring.
 */
export function selectionPulseStyle(): React.CSSProperties {
  return {
    animation: `graphSelectionPulse ${ANIMATION.selectionPulse}ms ease-in-out infinite`,
  }
}

/**
 * Animate a value from start → end over `duration` ms using rAF lerp.
 * Returns a cleanup function to cancel the animation.
 */
export function animateLerp(
  start: number,
  end: number,
  duration: number,
  onUpdate: (value: number) => void,
  onComplete?: () => void,
): () => void {
  let startTime: number | null = null
  let rafId: number

  const step = (timestamp: number) => {
    if (startTime === null) startTime = timestamp
    const elapsed = timestamp - startTime
    const t = Math.min(elapsed / duration, 1)
    const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t // ease-in-out
    onUpdate(start + (end - start) * eased)
    if (t < 1) {
      rafId = requestAnimationFrame(step)
    } else {
      onComplete?.()
    }
  }

  rafId = requestAnimationFrame(step)
  return () => cancelAnimationFrame(rafId)
}

/**
 * Trigger a brief highlight flash on a DOM element (amber glow).
 */
export function flashHighlight(el: HTMLElement | null, color = '#f59e0b'): void {
  if (!el) return
  const prev = el.style.boxShadow
  el.style.boxShadow = `0 0 20px ${color}88`
  el.style.transition = 'box-shadow 0.1s'
  setTimeout(() => {
    el.style.boxShadow = prev
    el.style.transition = 'box-shadow 0.6s'
  }, 300)
}

// Re-export the React CSSProperties type alias used by callers
// (avoids needing to import React just for the type)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type React = any
