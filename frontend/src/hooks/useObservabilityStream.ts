import { useCallback, useEffect, useRef, useState } from 'react'
import { wsOrigin } from '../api/wsUrl'
import type { Evidence, Finding, SessionCost } from '../api/observability'

/**
 * Live investigation stream.
 *
 * The reducer is a PURE FUNCTION exported from this module rather than living in the
 * component, because the same reducer must drive both the real socket and the sample
 * replay. That is what stops the demo path from silently diverging from production —
 * the AIOps page swaps arrays behind a `demoMode` boolean, so its demo and live paths
 * exercise different code.
 */

export interface AgentState {
  name: string
  stage: number
  status: 'pending' | 'running' | 'success' | 'partial' | 'failed'
  elapsedMs?: number
  evidenceAdded?: number
  costDelta?: number
  error?: string
}

export interface StageState {
  stage: number
  title: string
  status: 'pending' | 'running' | 'done'
  agents: AgentState[]
  elapsedMs?: number
}

export interface RunState {
  runId: string
  investigationId: string
  title: string
  service: string
  status: 'idle' | 'running' | 'complete' | 'failed'
  totalStages: number
  totalAgents: number
  agentsDone: number
  stages: StageState[]
  evidence: Evidence[]
  findings: Finding[]
  cost: SessionCost | null
  rootCause: Record<string, unknown> | null
  masking: Record<string, unknown> | null
  citationCoverage: number
  llmError: string | null
  lastSeq: number
  error: string | null
  startedAt: number | null
  elapsedMs: number
}

export const emptyRunState = (): RunState => ({
  runId: '', investigationId: '', title: '', service: '', status: 'idle',
  totalStages: 0, totalAgents: 0, agentsDone: 0, stages: [], evidence: [],
  findings: [], cost: null, rootCause: null, masking: null, citationCoverage: 0,
  llmError: null, lastSeq: 0, error: null, startedAt: null, elapsedMs: 0,
})

export interface DagEvent {
  type: string
  seq?: number
  investigationId?: string
  [k: string]: unknown
}

/** Pure. Drives both the live socket and `replaySampleRun`. */
export function reduceDagEvent(state: RunState, ev: DagEvent): RunState {
  const seq = typeof ev.seq === 'number' ? ev.seq : state.lastSeq
  const next: RunState = { ...state, lastSeq: Math.max(state.lastSeq, seq) }

  switch (ev.type) {
    case 'dag_start':
      return {
        ...next,
        runId: String(ev.runId ?? ''),
        investigationId: String(ev.investigationId ?? state.investigationId),
        title: String(ev.title ?? ''),
        service: String(ev.service ?? ''),
        status: 'running',
        totalStages: Number(ev.total_stages ?? 0),
        totalAgents: Number(ev.total_agents ?? 0),
        agentsDone: 0,
        stages: [],
        startedAt: Date.now(),
      }

    case 'stage_start': {
      const agents = (ev.agents as string[] | undefined) ?? []
      const stage: StageState = {
        stage: Number(ev.stage ?? 0),
        title: String(ev.title ?? ''),
        status: 'running',
        agents: agents.map((name) => ({ name, stage: Number(ev.stage ?? 0), status: 'pending' })),
      }
      const existing = next.stages.findIndex((s) => s.stage === stage.stage)
      const stages = [...next.stages]
      if (existing >= 0) stages[existing] = stage
      else stages.push(stage)
      return { ...next, stages }
    }

    case 'agent_start':
      return { ...next, stages: patchAgent(next.stages, ev, { status: 'running' }) }

    case 'agent_done': {
      const status = (ev.status as AgentState['status']) ?? 'success'
      return {
        ...next,
        agentsDone: next.agentsDone + 1,
        stages: patchAgent(next.stages, ev, {
          status,
          elapsedMs: Number(ev.elapsed_ms ?? 0),
          evidenceAdded: Number(ev.evidence_added ?? 0),
          costDelta: Number(ev.costDelta ?? 0),
          error: ev.error ? String(ev.error) : undefined,
        }),
      }
    }

    case 'stage_done':
      return {
        ...next,
        stages: next.stages.map((s) =>
          s.stage === Number(ev.stage)
            ? { ...s, status: 'done', elapsedMs: Number(ev.elapsed_ms ?? 0) }
            : s),
      }

    case 'evidence': {
      const e = ev.evidence as Evidence | undefined
      if (!e) return next
      if (next.evidence.some((x) => x.evidenceId === e.evidenceId)) return next
      return { ...next, evidence: [...next.evidence, e] }
    }

    case 'finding': {
      const f = ev.finding as Finding | undefined
      if (!f) return next
      if (next.findings.some((x) => x.findingId === f.findingId)) return next
      return { ...next, findings: [...next.findings, f] }
    }

    case 'cost':
      return { ...next, cost: (ev.cost as SessionCost) ?? next.cost }

    case 'dag_done':
      return {
        ...next,
        status: ev.status === 'failed' ? 'failed' : 'complete',
        rootCause: (ev.rootCause as Record<string, unknown>) ?? next.rootCause,
        masking: (ev.masking as Record<string, unknown>) ?? next.masking,
        cost: (ev.cost as SessionCost) ?? next.cost,
        citationCoverage: Number(ev.citationCoverage ?? next.citationCoverage),
        llmError: (ev.llmError as string) || next.llmError,
        elapsedMs: next.startedAt ? Date.now() - next.startedAt : next.elapsedMs,
      }

    case 'error':
      return { ...next, status: 'failed', error: String(ev.message ?? 'Unknown error') }

    default:
      return next
  }
}

function patchAgent(stages: StageState[], ev: DagEvent,
                    patch: Partial<AgentState>): StageState[] {
  const stageNo = Number(ev.stage ?? 0)
  const name = String(ev.agent ?? '')
  return stages.map((s) =>
    s.stage !== stageNo
      ? s
      : {
          ...s,
          agents: s.agents.some((a) => a.name === name)
            ? s.agents.map((a) => (a.name === name ? { ...a, ...patch } : a))
            : [...s.agents, { name, stage: stageNo, status: 'running', ...patch }],
        })
}

export function useObservabilityStream(investigationId: string | null) {
  const [state, setState] = useState<RunState>(emptyRunState)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const seqRef = useRef(0)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const push = useCallback((ev: DagEvent) => {
    setState((prev) => {
      const next = reduceDagEvent(prev, ev)
      seqRef.current = next.lastSeq
      return next
    })
  }, [])

  const reset = useCallback(() => {
    seqRef.current = 0
    setState(emptyRunState())
  }, [])

  useEffect(() => {
    if (!investigationId) return
    let closed = false

    const connect = () => {
      if (closed) return
      const token = localStorage.getItem('ov_token') ?? ''
      const ws = new WebSocket(`${wsOrigin()}/api/observability/ws/investigate`)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        // Auth in the FIRST MESSAGE, not the query string — a token in the URL
        // ends up in access logs. `sinceSeq` drives replay so a dropped socket
        // does not lose the run.
        ws.send(JSON.stringify({ token, investigationId, sinceSeq: seqRef.current }))
      }
      ws.onmessage = (msg) => {
        try {
          const ev = JSON.parse(msg.data) as DagEvent
          if (ev.type === 'heartbeat' || ev.type === 'connected') return
          push(ev)
        } catch { /* ignore malformed frames */ }
      }
      ws.onerror = () => setConnected(false)
      ws.onclose = () => {
        setConnected(false)
        if (!closed) retryRef.current = setTimeout(connect, 5000)
      }
    }

    connect()
    return () => {
      closed = true
      if (retryRef.current) clearTimeout(retryRef.current)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [investigationId, push])

  return { state, connected, push, reset }
}

export default useObservabilityStream
