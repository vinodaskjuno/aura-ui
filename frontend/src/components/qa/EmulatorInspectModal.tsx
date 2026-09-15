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
 * A centred MODAL rather than a side drawer, and shaped like Floci's own console: this
 * is a dashboard, not a log tail. A drawer is right for a stream of text you read beside
 * something else; a grid of service cards wants the width and the focus of the screen.
 *
 * NOT live, and the header says so. The API is on Fargate and can never reach a
 * laptop's :4566; only the runner can, and the runner polls. So this is a round trip of
 * up to one poll interval, exactly like ContainerLogsDrawer, and it carries the same
 * honest "as of Ns ago" rather than pretending to stream.
 */
//: Floci's fixed ports, shown in the stat strip the way its own console shows the
//: endpoint it is connected to. Display only — nothing connects from the browser.
const PORTS: Record<string, number> = { aws: 4566, azure: 4577, gcp: 4588, oci: 4599 }

const POLL_MS = 2000
const GIVE_UP_MS = 40000

const CHROME = '#161b22'
const TEXT   = '#e6edf3'
const DIM    = '#7d8590'

export default function EmulatorInspectModal({ runner, cloud, machine, onClose }: {
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
  // One re-ask only. Two clients racing for the slot would otherwise
  // re-request forever, each superseding the other.
  const retried = useRef(false)

  const fetchInventory = useCallback(async () => {
    setWaiting(true)
    setError('')
    startedAt.current = Date.now()
    retried.current = false
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
        if (data.status === 'superseded') {
          // A newer request took the runner's single command slot. Re-ask once rather
          // than polling a dead id until the timeout and claiming the runner is silent.
          if (!retried.current) {
            retried.current = true
            stop = true
            clearInterval(timer)
            fetchInventory()
          }
          return
        }
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
  }, [waiting, runner, commandId, fetchInventory])

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 800, display: 'flex',
                 alignItems: 'center', justifyContent: 'center', padding: 24,
                 background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}>
        <motion.div
          initial={{ scale: 0.96, y: 12, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.97, y: 8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          onClick={e => e.stopPropagation()}
          style={{ width: 'min(1020px, 96vw)', maxHeight: '88vh',
                   display: 'flex', flexDirection: 'column',
                   background: 'var(--color-card)', borderRadius: 14,
                   border: '1px solid var(--color-border)',
                   boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>

          {/* Floci's own chrome: traffic lights, the runtime it is connected to, and how
              old the answer is. */}
          <header style={{ padding: '11px 14px', background: CHROME,
                           borderBottom: '1px solid #30363d', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span aria-hidden style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                {['#ff5f57', '#febc2e', '#28c840'].map(c => (
                  <span key={c} style={{ width: 10, height: 10, borderRadius: '50%',
                                         background: c, opacity: 0.9 }} />
                ))}
              </span>
              <div style={{ minWidth: 0, marginLeft: 5 }}>
                <div style={{ fontSize: 13, fontWeight: 650, color: TEXT,
                              fontFamily: 'var(--font-mono)' }}>
                  {cloud} emulator{machine ? ` — ${machine}` : ''}
                </div>
                <div style={{ fontSize: 10.5, color: DIM, marginTop: 2 }}>
                  {/* Deliberately never "live". See the note at the top of this file. */}
                  {waiting ? `asking the runner…`
                           : result?.fetchedAt ? `floci · as of ${ago(result.fetchedAt)}`
                           : 'floci'}
                </div>
              </div>
              <span style={{ marginLeft: 'auto', display: 'inline-flex',
                             alignItems: 'center', gap: 6, flexShrink: 0,
                             fontSize: 10.5, color: DIM, padding: '3px 9px',
                             border: '1px solid #30363d', borderRadius: 999 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%',
                               background: waiting ? '#d29922' : '#3fb950' }} />
                {`http://localhost:${PORTS[cloud] ?? 4566}`}
              </span>
              <button onClick={fetchInventory} disabled={waiting} style={iconBtn}
                      title="Look again">
                {waiting ? <Loader2 size={13} className="animate-spin" />
                         : <RefreshCw size={13} />}
              </button>
              <button onClick={onClose} style={iconBtn} title="Close">
                <X size={14} />
              </button>
            </div>
          </header>

          <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
            {waiting && !result && (
              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)',
                          display: 'flex', gap: 8, alignItems: 'center', margin: 0 }}>
                <Loader2 size={13} className="animate-spin" />
                Waiting for the runner to look — it collects requests on its next poll.
              </p>
            )}
            {!!error && (
              <p style={{ fontSize: 12, color: '#ef4444', lineHeight: 1.7 }}>{error}</p>
            )}
            {!waiting && !error && (
              <ResourceTable
                endpoint={`http://localhost:${PORTS[cloud] ?? 4566}`}
                resources={result?.resources}
                emptyReason={'This emulator is running but holds nothing yet. Aura '
                             + 'starts the emulator; your application creates the '
                             + 'resources when it boots. Press Populate on the Floci '
                             + 'panel to run it once, or run the tests — either fills '
                             + 'this. Floci also keeps state in memory by default, so '
                             + 'restarting the container empties it again.'} />
            )}
          </div>
        </motion.div>
      </motion.div>
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
