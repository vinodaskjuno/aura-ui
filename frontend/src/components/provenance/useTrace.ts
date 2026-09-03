import { useCallback, useEffect, useState } from 'react'
import { getEdgeTrace, getNodeTrace } from '../../api/provenance'
import type { EntityTraceResponse } from '../../api/provenance'

/**
 * Loads the trace for a node or an edge.
 *
 * One hook for both because the response shape is the same and the panels should
 * not drift: edges having no provenance surface at all was the gap that made
 * "where did this claim come from" unanswerable for exactly the assertions people
 * most want to question.
 *
 * The ribbon is always visible, so this fetches as soon as an entity is selected
 * rather than waiting for a tab — `enabled` exists so a caller can defer it.
 */
export function useTrace(
  kind: 'node' | 'edge',
  id: string | null | undefined,
  enabled = true,
) {
  const [data, setData] = useState<EntityTraceResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce(n => n + 1), [])

  useEffect(() => {
    if (!id || !enabled) {
      setData(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    const fetcher = kind === 'node' ? getNodeTrace : getEdgeTrace
    fetcher(id)
      .then(d => { if (!cancelled) setData(d) })
      .catch((err) => {
        if (cancelled) return
        setData(null)
        // 404 is a real state, not a failure: a node held in the client may have
        // been retired, and saying so beats a generic error.
        setError(err?.response?.status === 404
          ? 'This entity is no longer in the graph.'
          : 'Could not load provenance.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [kind, id, enabled, nonce])

  return { data, loading, error, reload }
}
