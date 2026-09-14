import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Copy, Loader2, RefreshCw, X } from 'lucide-react'
import { qaApi } from '../../api/qa'
import type { QaContainerLogs } from '../../api/qa'

/**
 * `podman logs` for one Floci container.
 *
 * NOT a live tail, and the header says so. The runner has no inbound port by design —
 * it polls — so a log request is left for it and collected on its next poll. That is a
 * round trip of up to ~15 seconds. A control labelled "Stream" that updates every
 * fifteen seconds is worse than an honest one labelled "Fetch".
 *
 * `Follow` re-issues that same round trip on a cycle. It is opt-in and it is still not
 * a stream: the header keeps counting the age of what is on screen, because the reader
 * has to know they are looking at something up to a poll interval old.
 *
 * Dressed as a terminal to match FlociTerminal — the two show output from the same
 * machine and should look like the same kind of object.
 */
const POLL_MS = 2000
const GIVE_UP_MS = 40000
/** One agent state-report interval plus slack. Asking faster cannot produce newer
 *  output; it only spends requests. */
const FOLLOW_MS = 15000

const GROUND = '#0d1117'
const CHROME = '#161b22'
const TEXT   = '#e6edf3'
const DIM    = '#7d8590'

export default function ContainerLogsDrawer({ runner, container, onClose }: {
  runner: string
  container: string
  onClose: () => void
}) {
  const [logs, setLogs] = useState<QaContainerLogs | null>(null)
  const [error, setError] = useState('')
  const [waiting, setWaiting] = useState(true)
  const [follow, setFollow] = useState(false)
  const [copied, setCopied] = useState(false)
  // Re-render once a second so "as of 12s ago" actually counts up between fetches.
  const [, tick] = useState(0)
  // STATE, not a ref. The polling effect below is gated on having a command id, and a
  // ref assignment triggers no re-render — so the effect ran once on mount while the id
  // was still empty, returned early, and never ran again. The request was sent, the
  // answer was ready, and the drawer waited for it forever.
  const [commandId, setCommandId] = useState('')
  const startedAt = useRef(0)

  const fetchLogs = useCallback(async () => {
    setWaiting(true)
    setError('')
    startedAt.current = Date.now()
    try {
      const { data } = await qaApi.requestLogs(runner, container)
      setCommandId(data.commandId)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Could not ask the runner for logs.')
      setWaiting(false)
    }
  }, [runner, container])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!waiting || !commandId) return
    let stop = false
    const timer = setInterval(async () => {
      if (stop) return
      try {
        const { data } = await qaApi.getLogs(runner, commandId)
        if (stop) return
        if (data.status === 'ready' || data.status === 'failed') {
          // Replaces rather than appends: `podman logs --tail` returns a window, not a
          // delta, so appending would duplicate every line that is still in the tail.
          setLogs(data)
          setWaiting(false)
          if (data.status === 'failed') setError(data.error || 'The runner could not read that container.')
        } else if (Date.now() - startedAt.current > GIVE_UP_MS) {
          setWaiting(false)
          setError(`${runner} did not answer. It may have gone offline.`)
        }
      } catch {
        if (Date.now() - startedAt.current > GIVE_UP_MS) {
          setWaiting(false)
          setError('The runner did not answer.')
        }
      }
    }, POLL_MS)
    return () => { stop = true; clearInterval(timer) }
  }, [waiting, runner, commandId])

  // Only ever one request in flight: a new cycle starts from the end of the last one,
  // so a slow runner cannot accumulate a queue of pending log commands on its row.
  useEffect(() => {
    if (!follow || waiting) return
    const t = setTimeout(fetchLogs, FOLLOW_MS)
    return () => clearTimeout(t)
  }, [follow, waiting, fetchLogs, logs])

  const text = (logs?.lines || []).join('\n')

  const copy = async () => {
    try { await navigator.clipboard?.writeText(text); setCopied(true) } catch { /* ignore */ }
  }
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(t)
  }, [copied])

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ x: 560, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
        exit={{ x: 560, opacity: 0 }} transition={{ type: 'spring', damping: 26 }}
        style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(560px, 92vw)',
                 background: GROUND, borderLeft: '1px solid #30363d',
                 zIndex: 800, display: 'flex', flexDirection: 'column' }}>

        <header style={{ padding: '10px 12px', borderBottom: '1px solid #30363d',
                         background: CHROME }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span aria-hidden style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
              {['#ff5f57', '#febc2e', '#28c840'].map(c => (
                <span key={c} style={{ width: 9, height: 9, borderRadius: '50%',
                                       background: c, opacity: 0.9 }} />
              ))}
            </span>
            <div style={{ minWidth: 0, marginLeft: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: TEXT,
                            fontFamily: 'var(--font-mono)',
                            overflow: 'hidden', textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap' }}>
                {container}
              </div>
              <div style={{ fontSize: 10.5, color: DIM, marginTop: 2 }}>
                {/* Deliberately never "live". See the note at the top of this file. */}
                {waiting ? `asking ${runner}…`
                         : logs?.fetchedAt
                           ? `podman logs · as of ${ago(logs.fetchedAt)}`
                           : `on ${runner}`}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => setFollow(v => !v)}
                      title={follow
                        ? `Stop re-fetching (every ${FOLLOW_MS / 1000}s)`
                        : `Re-fetch every ${FOLLOW_MS / 1000}s — the runner answers on its next poll`}
                      style={{ ...iconBtn, width: 'auto', padding: '0 9px',
                               fontSize: 10.5, fontFamily: 'var(--font-mono)',
                               color: follow ? '#3fb950' : DIM,
                               borderColor: follow ? '#238636' : '#30363d' }}>
                Follow
              </button>
              <button onClick={fetchLogs} disabled={waiting} style={iconBtn}
                      title="Fetch again">
                {waiting ? <Loader2 size={13} className="animate-spin" />
                         : <RefreshCw size={13} />}
              </button>
              <button onClick={copy} disabled={!text} style={iconBtn}
                      title={copied ? 'Copied' : 'Copy all'}>
                {copied ? <Check size={13} color="#3fb950" /> : <Copy size={13} />}
              </button>
              <button onClick={onClose} style={iconBtn} title="Close"><X size={14} /></button>
            </div>
          </div>
        </header>

        <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
          {waiting && !text && (
            <p style={{ fontSize: 11.5, color: DIM, fontFamily: 'var(--font-mono)',
                        display: 'flex', gap: 8, alignItems: 'center', margin: 0 }}>
              <Loader2 size={13} className="animate-spin" />
              Waiting for {runner} to answer — it collects requests on its next poll.
            </p>
          )}
          {!!error && (
            <p style={{ fontSize: 11.5, color: '#f85149', lineHeight: 1.6,
                        fontFamily: 'var(--font-mono)' }}>{error}</p>
          )}
          {!waiting && !error && !text && (
            <p style={{ fontSize: 11.5, color: DIM, fontFamily: 'var(--font-mono)' }}>
              This container has produced no output yet.
            </p>
          )}
          {!!text && (
            <>
              {logs?.truncated && (
                <p style={{ fontSize: 10.5, color: '#d29922', marginBottom: 8,
                            fontFamily: 'var(--font-mono)' }}>
                  Truncated — showing the most recent output.
                </p>
              )}
              <pre style={{ margin: 0, fontSize: 11.5, lineHeight: 1.65,
                            fontFamily: 'var(--font-mono)',
                            whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
                            userSelect: 'text', color: TEXT }}>
                {text}
              </pre>
            </>
          )}
        </div>
      </motion.aside>
    </AnimatePresence>
  )
}

/** How old what is on screen actually is. The whole honesty of this panel rests on it. */
function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return 'just now'
  const s = Math.floor(ms / 1000)
  if (s < 5) return 'just now'
  return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`
}

const iconBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 26, borderRadius: 6, cursor: 'pointer',
  border: '1px solid #30363d', background: 'transparent', color: DIM,
}
