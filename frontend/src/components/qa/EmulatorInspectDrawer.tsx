import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, RefreshCw, X } from 'lucide-react'
import { qaApi } from '../../api/qa'
import type { QaEmulatorInventory } from '../../api/qa'
import ResourceTable from './ResourceTable'

/**
 * What is inside a running emulator, right now.
 *
 * The run panel answers "what did this run touch" from the stored report. This answers
 * "what is in there at this moment", which only becomes a question worth asking once an
 * emulator outlives a run — started from `floci-cli` or from DevMate.
 *
 * NOT live, and the header says so. The API is on Fargate and can never reach a
 * laptop's :4566; only the runner can, and the runner polls. So this is a round trip of
 * up to one poll interval, exactly like ContainerLogsDrawer, and it carries the same
 * honest "as of Ns ago" rather than pretending to stream.
 */
const POLL_MS = 2000
const GIVE_UP_MS = 40000

const CHROME = '#161b22'
const TEXT   = '#e6edf3'
const DIM    = '#7d8590'

export default function EmulatorInspectDrawer({ runner, cloud, machine, onClose }: {
  runner: string
  cloud: string
  /** How the machine is labelled elsewhere, so the drawer names the same thing. */
  machine?: string
  onClose: () => void
}) {
  const [result, setResult] = useState<QaEmulatorInventory | null>(null)
  const [error, setError] = useState('')
  const [waiting, setWaiting] = useState(true)
  const [, tick] = useState(0)
  // STATE, not a ref. The polling effect below is gated on having a command id, and a
  // ref assignment triggers no re-render — so the effect ran once on mount while the id
  // was still empty, returned early, and never ran again. The request was sent, the
  // answer was ready, and the drawer waited for it forever.
  const [commandId, setCommandId] = useState('')
  const startedAt = useRef(0)

  const fetchInventory = useCallback(async () => {
    setWaiting(true)
    setError('')
    startedAt.current = Date.now()
    try {
      const { data } = await qaApi.requestInventory(runner, cloud)
      setCommandId(data.commandId)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Could not ask the runner to look.')
      setWaiting(false)
    }
  }, [runner, cloud])

  useEffect(() => { fetchInventory() }, [fetchInventory])

  // So "as of 12s ago" actually counts up between fetches.
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
        const { data } = await qaApi.getInventory(runner, commandId)
        if (stop) return
        if (data.status === 'ready' || data.status === 'failed') {
          setResult(data)
          setWaiting(false)
          if (data.status === 'failed') {
            setError(data.error || 'The runner could not read that emulator.')
          }
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

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ x: 560, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
        exit={{ x: 560, opacity: 0 }} transition={{ type: 'spring', damping: 26 }}
        style={{ position: 'fixed', top: 0, right: 0, bottom: 0,
                 width: 'min(520px, 92vw)', background: 'var(--color-surface)',
                 borderLeft: '1px solid var(--color-border)', zIndex: 800,
                 display: 'flex', flexDirection: 'column' }}>

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
                            fontFamily: 'var(--font-mono)' }}>
                {cloud} emulator{machine ? ` — ${machine}` : ''}
              </div>
              <div style={{ fontSize: 10.5, color: DIM, marginTop: 2 }}>
                {/* Deliberately never "live". See the note at the top of this file. */}
                {waiting ? `asking ${runner}…`
                         : result?.fetchedAt ? `floci · as of ${ago(result.fetchedAt)}`
                         : `on ${runner}`}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={fetchInventory} disabled={waiting} style={iconBtn}
                      title="Look again">
                {waiting ? <Loader2 size={13} className="animate-spin" />
                         : <RefreshCw size={13} />}
              </button>
              <button onClick={onClose} style={iconBtn} title="Close">
                <X size={14} />
              </button>
            </div>
          </div>
        </header>

        <div style={{ flex: 1, overflow: 'auto', padding: 14,
                      background: 'var(--color-surface)' }}>
          {waiting && !result && (
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)',
                        display: 'flex', gap: 8, alignItems: 'center', margin: 0 }}>
              <Loader2 size={13} className="animate-spin" />
              Waiting for {runner} to look — it collects requests on its next poll.
            </p>
          )}
          {!!error && (
            <p style={{ fontSize: 12, color: '#ef4444', lineHeight: 1.7 }}>{error}</p>
          )}
          {!waiting && !error && (
            <ResourceTable
              resources={result?.resources}
              emptyReason={'This emulator is running but holds nothing yet. Floci keeps '
                           + 'state in memory by default, so restarting the container '
                           + 'empties it.'} />
          )}
        </div>
      </motion.aside>
    </AnimatePresence>
  )
}

/** How old what is on screen actually is. The honesty of this panel rests on it. */
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
