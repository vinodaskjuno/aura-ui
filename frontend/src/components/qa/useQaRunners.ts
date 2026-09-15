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
  /** The viewer's own username, as the server states it. Empty from a backend that
   *  predates it, which simply means nothing is labelled "your machine". */
  you:         string
  /** Set when the server refused a runner's key recently. This is what turns an empty
   *  runner list from a mystery into a diagnosis. */
  unauthorized: { at: string; hint?: string } | null
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
  const [you, setYou] = useState('')
  const [unauthorized, setUnauthorized] =
    useState<{ at: string; hint?: string } | null>(null)
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
      setYou(data.you || '')
      // `{}` from the server means "no recent rejection" — normalise it away so the UI
      // only has to test for truthiness.
      setUnauthorized(data.unauthorized?.at ? data.unauthorized : null)
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

  return { runners, you, unauthorized, loading, error, lastUpdated, refresh: load }
}

/**
 * What to call a machine on screen.
 *
 * GENERIC ON PURPOSE. The runner reports its real hostname and the server stores it —
 * it is genuinely useful in logs and support — but a personal machine name
 * ("Someone-MacBook-Air") does not belong on a screen being shown to a customer, or to
 * everyone else in the deployment. So the hostname is kept in the data and never
 * rendered; the UI says whose machine it is, which is the question a reader actually
 * has.
 *
 * `owner` is a username, not a device name, so naming it is safe.
 */
export function runnerLabel(runner: QaRunner, you?: string): string {
  if (runner.owner && you && runner.owner === you) return 'your machine'
  return runner.owner ? `${runner.owner}'s machine` : 'a local machine'
}

/** The machine a run is on, for chrome — a terminal title bar, a short heading. */
export function runMachineName(
  run: { runner?: string; runnerMachine?: string; runnerOwner?: string },
  you?: string,
): string {
  if (!(run.runnerMachine || run.runner)) return ''
  if (run.runnerOwner && you && run.runnerOwner === you) return 'your machine'
  return run.runnerOwner ? `${run.runnerOwner}'s machine` : 'a local machine'
}

/** The machine a run is on, for prose. Same wording — there is no longer a hostname to
 *  add, so the two differ only in that this one returns "" for an unclaimed run. */
export function runMachineLabel(
  run: { runner?: string; runnerMachine?: string; runnerOwner?: string },
  you?: string,
): string {
  return runMachineName(run, you)
}

/**
 * Is anything running locally, right now.
 *
 * `busy` is the distinction the header chip could not previously draw: it rendered
 * identically whether a podman container was live on someone's desk or the machine had
 * been idle all afternoon.
 */
export function localState(runners: QaRunner[]) {
  const online = runners.filter(r => r.online)
  return {
    online,
    connected:  online.length > 0,
    busy:       online.filter(r => r.busyRunId),
    containers: online.reduce((n, r) => n + (r.containers?.length || 0), 0),
    unhealthy:  online.some(r => r.health && !r.health.ok),
    settingUp:  online.filter(r => r.setup?.active),
  }
}

/** Every container across every runner, with the runner it belongs to. */
export function allContainers(runners: QaRunner[]) {
  return runners.flatMap(r => (r.containers || []).map(c => ({ ...c, runner: r.name,
                                                               stale: r.stale })))
}
