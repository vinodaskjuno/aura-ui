import { useCallback, useEffect, useRef, useState } from 'react'
import { qaApi } from '../../api/qa'
import type { QaRunner } from '../../api/qa'

/**
 * One owner of the runner poll, for the whole page.
 *
 * The header chip, the Runner tab, the launcher and the run detail all want the same
 * answer. Three components polling independently would be three requests per tick
 * against an endpoint that reads shared state — so this is called once, at page level,
 * and the result is passed down.
 *
 * The cadence is matched to how fast the thing being watched actually changes:
 * containers appear and vanish inside a single run phase, but an idle machine is idle
 * for minutes. And it stops entirely when the tab is hidden — a tab left open
 * overnight would otherwise poll ~8,600 times for nobody.
 */
const FAST_MS = 3000     // a run is in flight: containers come and go within a phase
const TAB_MS  = 10000    // idle, but the user is looking at the Runner tab
const IDLE_MS = 30000    // idle, elsewhere — the header chip only needs to be roughly right

export interface RunnersState {
  runners:     QaRunner[]
  loading:     boolean
  error:       string
  lastUpdated: number
  refresh:     () => void
}

export function useQaRunners({ active, watching }: {
  /** A run is executing right now. */
  active: boolean
  /** The user is looking at a surface that shows containers. */
  watching: boolean
}): RunnersState {
  const [runners, setRunners] = useState<QaRunner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(0)

  // Guards a setState after the component has gone, and lets an in-flight request be
  // abandoned when the interval changes.
  const alive = useRef(true)
  const controller = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    controller.current?.abort()
    const ctrl = new AbortController()
    controller.current = ctrl
    try {
      const { data } = await qaApi.runners()
      // Checked after the await rather than passing a signal: the shared axios client
      // takes no per-call config here, and the only thing abort needs to prevent is a
      // stale response overwriting a newer one.
      if (!alive.current || ctrl.signal.aborted) return
      setRunners(data.runners || [])
      setError('')
      setLastUpdated(Date.now())
    } catch (e: any) {
      if (ctrl.signal.aborted || !alive.current) return
      // A backend without the endpoint is not an error the user should see as one —
      // it simply means no runner detail is available yet.
      setError(e?.response?.status === 404 ? '' : 'Could not reach the QA service.')
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; controller.current?.abort() }
  }, [])

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null

    const start = () => {
      if (document.hidden) return
      const every = active ? FAST_MS : watching ? TAB_MS : IDLE_MS
      load()
      timer = setInterval(load, every)
    }
    const stop = () => { if (timer) { clearInterval(timer); timer = null } }

    const onVisibility = () => { stop(); if (!document.hidden) start() }

    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility) }
  }, [active, watching, load])

  return { runners, loading, error, lastUpdated, refresh: load }
}

/** Every container across every runner, with the runner it belongs to. */
export function allContainers(runners: QaRunner[]) {
  return runners.flatMap(r => (r.containers || []).map(c => ({ ...c, runner: r.name,
                                                               stale: r.stale })))
}
