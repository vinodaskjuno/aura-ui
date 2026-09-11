import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Copy, Loader2, RefreshCw, X } from 'lucide-react'
import { qaApi } from '../../api/qa'
import type { QaContainerLogs } from '../../api/qa'

/**
 * `podman logs` for one Floci container.
 *
 * NOT a live tail, and the header says so. The runner has no inbound port by design —
 * it polls — so a log request is left for it and collected on its next poll. That is a
 * round trip of up to ~15 seconds. A control labelled "Stream" that updates every
 * fifteen seconds is worse than an honest one labelled "Fetch".
 */
const POLL_MS = 2000
const GIVE_UP_MS = 40000

export default function ContainerLogsDrawer({ runner, container, onClose }: {
  runner: string
  container: string
  onClose: () => void
}) {
  const [logs, setLogs] = useState<QaContainerLogs | null>(null)
  const [error, setError] = useState('')
  const [waiting, setWaiting] = useState(true)
  const commandId = useRef('')
  const startedAt = useRef(0)

  const fetchLogs = useCallback(async () => {
    setWaiting(true)
    setError('')
    setLogs(null)
    startedAt.current = Date.now()
    try {
      const { data } = await qaApi.requestLogs(runner, container)
      commandId.current = data.commandId
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Could not ask the runner for logs.')
      setWaiting(false)
    }
  }, [runner, container])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  useEffect(() => {
    if (!waiting || !commandId.current) return
    let stop = false
    const timer = setInterval(async () => {
      if (stop) return
      try {
        const { data } = await qaApi.getLogs(runner, commandId.current)
        if (stop) return
        if (data.status === 'ready' || data.status === 'failed') {
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
  }, [waiting, runner])

  const text = (logs?.lines || []).join('\n')

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ x: 560, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
        exit={{ x: 560, opacity: 0 }} transition={{ type: 'spring', damping: 26 }}
        style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(560px, 92vw)',
                 background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)',
                 zIndex: 800, display: 'flex', flexDirection: 'column' }}>

        <header style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 650,
                            fontFamily: 'var(--font-mono, monospace)',
                            overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {container}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                {/* Deliberately not "live". See the note at the top of this file. */}
                {waiting ? `asking ${runner}…`
                         : logs?.fetchedAt
                           ? `podman logs · as of ${new Date(logs.fetchedAt).toLocaleTimeString()}`
                           : `on ${runner}`}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button onClick={fetchLogs} disabled={waiting} style={iconBtn} title="Fetch again">
                {waiting ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              </button>
              <button onClick={() => navigator.clipboard?.writeText(text)}
                      disabled={!text} style={iconBtn} title="Copy all">
                <Copy size={13} />
              </button>
              <button onClick={onClose} style={iconBtn} title="Close"><X size={14} /></button>
            </div>
          </div>
        </header>

        <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>
          {waiting && (
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)',
                        display: 'flex', gap: 8, alignItems: 'center' }}>
              <Loader2 size={13} className="animate-spin" />
              Waiting for {runner} to answer — it collects requests on its next poll.
            </p>
          )}
          {!!error && (
            <p style={{ fontSize: 12, color: '#ef4444', lineHeight: 1.6 }}>{error}</p>
          )}
          {!waiting && !error && !text && (
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              This container has produced no output yet.
            </p>
          )}
          {!!text && (
            <>
              {logs?.truncated && (
                <p style={{ fontSize: 11, color: '#f59e0b', marginBottom: 8 }}>
                  Truncated — showing the most recent output.
                </p>
              )}
              <pre style={{ margin: 0, fontSize: 11, lineHeight: 1.6,
                            fontFamily: 'var(--font-mono, monospace)',
                            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                            color: 'var(--color-text)' }}>
                {text}
              </pre>
            </>
          )}
        </div>
      </motion.aside>
    </AnimatePresence>
  )
}

const iconBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
  border: '1px solid var(--color-border)', background: 'transparent',
  color: 'var(--color-text)',
}
