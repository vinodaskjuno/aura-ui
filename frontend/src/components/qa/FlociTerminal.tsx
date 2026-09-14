import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowDown, Check, Copy } from 'lucide-react'
import type { RunActivity } from '../../api/qa'

/**
 * Floci, working on someone's actual machine.
 *
 * The same event stream `LiveActivity` renders, shown as what it is. The runner logs
 * every step of a run — the container being started, the port answering, the app coming
 * up, each case — and ships the whole buffer on its heartbeat, forced immediately on a
 * step or an emulator event. So this is live to within a couple of seconds without any
 * streaming transport, and a reader watching it is watching a laptop work.
 *
 * Dark in BOTH themes, deliberately. This is the one surface in the app that should not
 * follow the theme: a light-mode terminal reads as a code block, and the whole point of
 * the panel is that it does not look like more UI.
 */

/** Fixed, not themed. See above. */
const GROUND = '#0d1117'
const CHROME = '#161b22'
const TEXT   = '#e6edf3'
const DIM    = '#7d8590'

/** Same vocabulary as the rest of QualityMind, minus the icons — a terminal has none. */
const PHASE_COLOUR: Record<string, string> = {
  provision: '#a371f7',
  plan:      '#58a6ff',
  planned:   '#58a6ff',
  emulator:  '#d29922',
  app:       '#3fb950',
  running:   '#3fb950',
  step:      '#8b949e',
  evidence:  '#a371f7',
  graph:     '#a371f7',
  error:     '#f85149',
}

export type TerminalState = 'live' | 'ended' | 'stalled'

export default function FlociTerminal({
  activity, machine, state = 'live', maxHeight = 260,
}: {
  activity: RunActivity[]
  /** The machine these lines came from, already labelled by `runnerLabel`. */
  machine: string
  state?: TerminalState
  maxHeight?: number
}) {
  const box = useRef<HTMLDivElement>(null)
  // Whether the tail is being followed. Starts true and is surrendered the moment the
  // reader scrolls up — never taken back automatically.
  const following = useRef(true)
  const [pinned, setPinned] = useState(true)
  const [behind, setBehind] = useState(0)
  const seen = useRef(0)
  const [copied, setCopied] = useState(false)

  const live = state === 'live'

  const toBottom = useCallback(() => {
    const el = box.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    following.current = true
    setPinned(true)
    seen.current = activity.length
    setBehind(0)
  }, [activity.length])

  // useLayoutEffect, not useEffect: scrolling after paint shows one frame of the old
  // position on every new line, which reads as a flicker on a fast-moving run.
  useLayoutEffect(() => {
    if (following.current && box.current) {
      box.current.scrollTop = box.current.scrollHeight
      seen.current = activity.length
    } else {
      setBehind(Math.max(0, activity.length - seen.current))
    }
  }, [activity.length])

  const onScroll = () => {
    const el = box.current
    if (!el) return
    // A few pixels of slack: browsers round fractional scroll heights, so an exact
    // comparison unpins a reader who never scrolled at all.
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24
    if (atBottom === following.current) return
    following.current = atBottom
    setPinned(atBottom)
    if (atBottom) { seen.current = activity.length; setBehind(0) }
  }

  const copy = async () => {
    const text = activity.map(l => `${clock(l.at)}  ${l.phase}  ${l.text}`).join('\n')
    try {
      await navigator.clipboard?.writeText(text)
      setCopied(true)
    } catch { /* a clipboard the browser refuses is not worth an error message */ }
  }
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(t)
  }, [copied])

  const status = state === 'live' ? { text: 'live', colour: '#3fb950' }
               : state === 'stalled' ? { text: 'stalled', colour: '#d29922' }
               : { text: 'ended', colour: DIM }

  return (
    <div style={{ border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden',
                  background: GROUND, position: 'relative' }}>

      {/* Title bar. Names the machine, because that is the claim being made. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                    background: CHROME, borderBottom: '1px solid #30363d' }}>
        <span aria-hidden style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          {['#ff5f57', '#febc2e', '#28c840'].map(c => (
            <span key={c} style={{ width: 9, height: 9, borderRadius: '50%',
                                   background: c, opacity: 0.9 }} />
          ))}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: TEXT,
                       marginLeft: 4, overflow: 'hidden', whiteSpace: 'nowrap',
                       textOverflow: 'ellipsis' }}>
          {machine || 'local machine'} — floci
        </span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center',
                       gap: 5, fontSize: 10.5, color: status.colour, flexShrink: 0 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%',
                         background: status.colour }} />
          {status.text}
        </span>
        <button onClick={copy} disabled={!activity.length}
                title={copied ? 'Copied' : 'Copy all output'}
                style={{ display: 'inline-flex', alignItems: 'center', border: 'none',
                         background: 'transparent', padding: 3, flexShrink: 0,
                         cursor: activity.length ? 'pointer' : 'default',
                         color: copied ? '#3fb950' : DIM }}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>

      <div ref={box} onScroll={onScroll} role="log" aria-live="polite"
           aria-label={`Floci output from ${machine || 'the local machine'}`}
           style={{ maxHeight, overflowY: 'auto', padding: '9px 11px',
                    fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.65,
                    userSelect: 'text', WebkitUserSelect: 'text' }}>

        {!activity.length ? (
          <div style={{ color: DIM }}>
            waiting for {machine || 'the runner'} to report…
            {live && <span className="floci-cursor" aria-hidden />}
          </div>
        ) : (
          // A grid rather than flex, so the message text lands in a straight gutter
          // instead of stepping in and out with the length of the phase word.
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 74px 1fr',
                        columnGap: 12, rowGap: 1 }}>
            {activity.map((line, i) => {
              const last = i === activity.length - 1
              return (
                <div key={`${line.at}-${i}`} style={{ display: 'contents' }}>
                  <span style={{ color: DIM, fontVariantNumeric: 'tabular-nums' }}>
                    {clock(line.at)}
                  </span>
                  <span style={{ color: PHASE_COLOUR[line.phase] ?? DIM,
                                 overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {line.phase}
                  </span>
                  <span style={{ color: TEXT, whiteSpace: 'pre-wrap',
                                 overflowWrap: 'anywhere' }}>
                    {line.text}
                    {last && live && <span className="floci-cursor" aria-hidden />}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Offered, never forced. Yanking someone back to the bottom while they are
          reading a failure is the worst thing a live console can do. */}
      {!pinned && behind > 0 && (
        <button onClick={toBottom}
                style={{ position: 'absolute', right: 12, bottom: 10,
                         display: 'inline-flex', alignItems: 'center', gap: 5,
                         fontSize: 10.5, fontFamily: 'var(--font-mono)',
                         padding: '4px 9px', borderRadius: 999, cursor: 'pointer',
                         background: '#1f6feb', color: '#fff', border: 'none',
                         boxShadow: '0 2px 8px rgba(0,0,0,0.45)' }}>
          <ArrowDown size={11} /> {behind} new line{behind === 1 ? '' : 's'}
        </button>
      )}
    </div>
  )
}

function clock(iso: string): string {
  const t = new Date(iso)
  return Number.isNaN(t.getTime()) ? '--:--:--' : t.toLocaleTimeString(undefined, {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
