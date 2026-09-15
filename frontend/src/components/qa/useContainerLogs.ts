import { useCallback, useEffect, useRef, useState } from 'react'
import { qaApi } from '../../api/qa'
import type { QaContainerLogs } from '../../api/qa'

/**
 * `podman logs` for one Floci container, as a round trip.
 *
 * NOT a stream, and no caller may present it as one. The runner has no inbound port by
 * design — it polls — so a request is parked and collected on its next poll. `follow`
 * re-issues that same round trip on a cycle; it makes the view current, not live, and
 * the age of what is on screen has to stay visible to the reader either way.
 *
 * Extracted so the drawer and DevMate's inline terminal share ONE implementation. Three
 * behaviours here are easy to get subtly wrong and were each a bug once:
 *
 *   - a superseded request is re-asked exactly once (the runner has a single command
 *     slot, so two viewers racing for it would otherwise re-request forever);
 *   - results REPLACE rather than append, because `--tail` returns a window, not a delta;
 *   - only one request is ever in flight, so a slow runner cannot accumulate a queue.
 *
 * A second copy of that would drift, and the drift would be invisible until someone was
 * staring at a log that had quietly stopped updating.
 */
const POLL_MS = 2000
const GIVE_UP_MS = 40000
/** One agent state-report interval plus slack. Asking faster cannot produce newer
 *  output; it only spends requests. */
export const FOLLOW_MS = 15000

export function useContainerLogs(runner: string, container: string, follow: boolean) {
  const [logs, setLogs] = useState<QaContainerLogs | null>(null)
  const [error, setError] = useState('')
  const [waiting, setWaiting] = useState(true)
  // STATE, not a ref. The polling effect is gated on having a command id, and a ref
  // assignment triggers no re-render — so the effect ran once while the id was still
  // empty, returned early, and never ran again. The request was sent, the answer was
  // ready, and the view waited for it forever.
  const [commandId, setCommandId] = useState('')
  const startedAt = useRef(0)
  const retried = useRef(false)

  const refetch = useCallback(async () => {
    setWaiting(true)
    setError('')
    startedAt.current = Date.now()
    retried.current = false
    try {
      const { data } = await qaApi.requestLogs(runner, container)
      setCommandId(data.commandId)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Could not ask the runner for logs.')
      setWaiting(false)
    }
  }, [runner, container])

  useEffect(() => { refetch() }, [refetch])

  useEffect(() => {
    if (!waiting || !commandId) return
    let stop = false
    const timer = setInterval(async () => {
      if (stop) return
      try {
        const { data } = await qaApi.getLogs(runner, commandId)
        if (stop) return
        if (data.status === 'superseded') {
          if (!retried.current) {
            retried.current = true
            stop = true
            clearInterval(timer)
            refetch()
          }
          return
        }
        if (data.status === 'ready' || data.status === 'failed') {
          setLogs(data)
          setWaiting(false)
          if (data.status === 'failed') {
            setError(data.error || 'The runner could not read that container.')
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
  }, [waiting, runner, commandId, refetch])

  // A new cycle starts from the END of the last one, never on a fixed clock.
  useEffect(() => {
    if (!follow || waiting) return
    const t = setTimeout(refetch, FOLLOW_MS)
    return () => clearTimeout(t)
  }, [follow, waiting, refetch, logs])

  return { logs, error, waiting, refetch }
}
