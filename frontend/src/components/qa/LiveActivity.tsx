import { useEffect, useRef } from 'react'
import { Cloud, FileCheck, Loader2, Package, PlayCircle, Rocket, Terminal } from 'lucide-react'
import type { RunActivity } from '../../api/qa'

/**
 * What the run is doing, line by line, as it happens.
 *
 * A phase word alone — "emulator" — does not tell you that a Floci container is being
 * pulled, that it answered on :4566, or which case is executing right now. Those
 * events already existed; for a remote run they were logged on the developer's machine
 * and thrown away. This is the same stream, kept.
 *
 * Oldest first and auto-scrolled, like a console, because the interesting line is
 * always the newest one.
 */
const PHASE_LOOK: Record<string, { icon: React.ReactNode; colour: string }> = {
  provision: { icon: <Package size={11} />,     colour: '#8b5cf6' },
  plan:      { icon: <Rocket size={11} />,      colour: '#4f8ef7' },
  planned:   { icon: <Rocket size={11} />,      colour: '#4f8ef7' },
  emulator:  { icon: <Cloud size={11} />,       colour: '#f59e0b' },
  app:       { icon: <PlayCircle size={11} />,  colour: '#10b981' },
  running:   { icon: <Loader2 size={11} />,     colour: '#10b981' },
  step:      { icon: <Terminal size={11} />,    colour: 'var(--color-text-secondary)' },
  evidence:  { icon: <FileCheck size={11} />,   colour: '#8b5cf6' },
  graph:     { icon: <FileCheck size={11} />,   colour: '#8b5cf6' },
}

export default function LiveActivity({ activity, live = true, maxHeight = 220 }: {
  activity: RunActivity[]
  live?: boolean
  maxHeight?: number
}) {
  const box = useRef<HTMLDivElement>(null)

  // Follow the tail while the run is in flight. Once it has finished the reader is
  // scrolling back through it, and yanking them to the bottom would fight them.
  useEffect(() => {
    if (live && box.current) box.current.scrollTop = box.current.scrollHeight
  }, [activity.length, live])

  if (!activity.length) {
    return (
      <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: 0 }}>
        {live ? 'Waiting for the runner to report…' : 'This run recorded no activity.'}
      </p>
    )
  }

  return (
    <div ref={box}
         style={{ maxHeight, overflowY: 'auto', border: '1px solid var(--color-border)',
                  borderRadius: 6, padding: '8px 10px',
                  background: 'var(--color-surface-2, transparent)' }}>
      <div style={{ display: 'grid', gap: 3 }}>
        {activity.map((line, i) => {
          const look = PHASE_LOOK[line.phase] ?? {
            icon: <Terminal size={11} />, colour: 'var(--color-text-secondary)' }
          const last = i === activity.length - 1
          return (
            <div key={`${line.at}-${i}`}
                 style={{ display: 'flex', gap: 8, alignItems: 'flex-start',
                          fontSize: 11, lineHeight: 1.55,
                          fontFamily: 'var(--font-mono, monospace)',
                          opacity: last && live ? 1 : 0.82 }}>
              <span style={{ color: look.colour, flexShrink: 0, marginTop: 2,
                             display: 'flex' }}>
                {look.icon}
              </span>
              <span style={{ color: 'var(--color-text-secondary)', flexShrink: 0,
                             fontVariantNumeric: 'tabular-nums' }}>
                {clock(line.at)}
              </span>
              <span style={{ color: 'var(--color-text)', wordBreak: 'break-word' }}>
                {line.text}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function clock(iso: string): string {
  const t = new Date(iso)
  return Number.isNaN(t.getTime()) ? '' : t.toLocaleTimeString(undefined, {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
