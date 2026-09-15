import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check, Copy, Loader2, RefreshCw } from 'lucide-react'
import { FOLLOW_MS, useContainerLogs } from '../qa/useContainerLogs'

/**
 * Floci's own output, on the machine it is running on, inline in DevMate.
 *
 * The same round trip `ContainerLogsDrawer` uses — shared through `useContainerLogs`, so
 * the two cannot drift — but embedded rather than in a drawer, because here it belongs
 * beside the Start button that produced it rather than over the top of the conversation.
 *
 * FOLLOWS BY DEFAULT, which the drawer does not. The reason to open this is that
 * something was just started and its first seconds are the interesting ones; making the
 * reader press Follow to see a boot they are already watching for would be a strange
 * thing to ask. It still is not a stream — the header keeps counting the age of what is
 * on screen, so nobody mistakes a 15-second cycle for a live tail.
 *
 * Dark in BOTH themes, like FlociTerminal, and for the same reason: a light-mode
 * terminal reads as a code block, and the point of the panel is that it does not look
 * like more UI.
 */
const GROUND = '#0d1117'
const CHROME = '#161b22'
const TEXT   = '#e6edf3'
const DIM    = '#7d8590'

/** Floci says little once it is up, so its own lines carry most of the meaning. Tinting
 *  the few that matter beats colouring every line and saying nothing. */
function lineColour(line: string): string {
  const l = line.toLowerCase()
  if (/\b(error|exception|fatal|failed|refused)\b/.test(l)) return '#f85149'
  if (/\b(warn|warning|deprecated)\b/.test(l)) return '#d29922'
  if (/\b(started|ready|listening|installed|profile)\b/.test(l)) return '#3fb950'
  return TEXT
}

export default function FlociLogPanel({ runner, container, label }: {
  runner: string
  /** The container name. Changing it re-asks for that container's output. */
  container: string
  /** Already put through `runnerLabel`, so it never leaks a real hostname. */
  label: string
}) {
  const [follow, setFollow] = useState(true)
  const [copied, setCopied] = useState(false)
  // Re-render every second so "as of 12s ago" counts up between fetches, rather than
  // sitting at whatever it read when the last answer landed.
  const [, tick] = useState(0)
  const { logs, error, waiting, refetch } = useContainerLogs(runner, container, follow)
  const box = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)

  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Stick to the bottom, but only while the reader already is. Yanking them back down
  // mid-scroll every 15 seconds would make the panel unreadable exactly when they are
  // trying to read something in it.
  useLayoutEffect(() => {
    const el = box.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [logs])

  const lines = logs?.lines || []
  const text = lines.join('\n')
  const age = logs?.fetchedAt
    ? Math.max(0, Math.round((Date.now() - new Date(logs.fetchedAt).getTime()) / 1000))
    : null

  const copy = async () => {
    try { await navigator.clipboard?.writeText(text); setCopied(true) } catch { /* ignore */ }
  }
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(t)
  }, [copied])

  return (
    <div style={{ border: '1px solid #30363d', borderRadius: 7, overflow: 'hidden',
                  background: GROUND }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px',
                    background: CHROME, borderBottom: '1px solid #30363d' }}>
        <span aria-hidden style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {['#ff5f57', '#febc2e', '#28c840'].map(c => (
            <span key={c} style={{ width: 8, height: 8, borderRadius: '50%',
                                   background: c, opacity: 0.9 }} />
          ))}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: TEXT,
                       overflow: 'hidden', textOverflow: 'ellipsis',
                       whiteSpace: 'nowrap' }}>
          {container}
        </span>
        {/* The age is not decoration. It is the one thing that stops a 15-second cycle
            being read as a live tail. */}
        <span style={{ fontSize: 10.5, color: DIM, marginLeft: 'auto', flexShrink: 0 }}>
          {waiting ? 'asking the runner…'
            : age !== null ? `${label} · as of ${age}s ago` : label}
        </span>
        <button onClick={() => setFollow(f => !f)}
                title={follow ? `Stop re-fetching (every ${FOLLOW_MS / 1000}s)`
                              : `Re-fetch every ${FOLLOW_MS / 1000}s`}
                style={{ ...chromeBtn, color: follow ? '#3fb950' : DIM }}>
          {follow ? 'following' : 'paused'}
        </button>
        <button onClick={refetch} disabled={waiting} title="Fetch now"
                style={{ ...chromeBtn, cursor: waiting ? 'default' : 'pointer' }}>
          {waiting ? <Loader2 size={11} className="animate-spin" />
                   : <RefreshCw size={11} />}
        </button>
        <button onClick={copy} title="Copy" disabled={!text} style={chromeBtn}>
          {copied ? <Check size={11} color="#3fb950" /> : <Copy size={11} />}
        </button>
      </div>

      <div ref={box}
           onScroll={e => {
             const el = e.currentTarget
             pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
           }}
           style={{ maxHeight: 240, overflowY: 'auto', padding: '8px 10px',
                    fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.65 }}>
        {error ? (
          <span style={{ color: '#f85149' }}>{error}</span>
        ) : !lines.length ? (
          <span style={{ color: DIM }}>
            {waiting
              ? 'Waiting for the runner to answer — it collects requests on its next poll.'
              : 'This container has produced no output yet.'}
          </span>
        ) : lines.map((l, i) => (
          <div key={i} style={{ color: lineColour(l), whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word' }}>
            {l || ' '}
          </div>
        ))}
      </div>

      {logs?.truncated && (
        <div style={{ padding: '4px 10px', fontSize: 10, color: DIM,
                      borderTop: '1px solid #30363d' }}>
          Showing the most recent output only — earlier lines were trimmed.
        </div>
      )}
    </div>
  )
}

const chromeBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10,
  padding: '2px 6px', borderRadius: 4, cursor: 'pointer', flexShrink: 0,
  border: '1px solid #30363d', background: 'transparent', color: DIM,
}
