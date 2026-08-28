import type {
  Evidence, Finding, Incident, Investigation, PastCase, RunbookMatch,
} from '../api/observability'
import type { DagEvent } from '../hooks/useObservabilityStream'

/**
 * Demo data for the Observability workspace.
 *
 * Deliberately different from `aiops-sample.ts`: that file swaps arrays behind a
 * `demoMode` boolean, so the demo path and the live path exercise different code and
 * silently drift apart. Here `replaySampleRun` emits the REAL event sequence into the
 * REAL reducer, so the demo can only ever look like production.
 *
 * Nothing in here fakes masking status, integration health, or cost — see the
 * sample-data policy. Those three render as unavailable rather than lying.
 */

const T = (m: number) => `2026-08-01T10:${String(m).padStart(2, '0')}:00Z`

export const SAMPLE_INCIDENTS: Incident[] = [
  { incidentId: 'PD-4471', title: 'checkout-service 5xx rate above 5%', service: 'checkout-service',
    timestamp: T(21), severity: 'critical', state: 'triggered', source: 'pagerduty',
    sourceUrl: '#', description: 'Error budget burn 14x. Paging primary on-call.' },
  { incidentId: 'PD-4470', title: 'payment-service p99 latency degraded', service: 'payment-service',
    timestamp: T(12), severity: 'high', state: 'acknowledged', source: 'pagerduty', sourceUrl: '#' },
  { incidentId: 'CW-8812', title: 'RDS free storage below threshold', service: 'orders-db',
    timestamp: T(4), severity: 'medium', state: 'ALARM', source: 'cloudwatch', sourceUrl: '#' },
  { incidentId: 'SN-2210', title: 'Sentry: OutOfMemoryError spike', service: 'checkout-service',
    timestamp: T(22), severity: 'high', state: 'unresolved', source: 'sentry', sourceUrl: '#' },
]

const ev = (
  id: string, kind: Evidence['kind'], signal: Evidence['signal'], t: string,
  title: string, summary: string, provider: string, hasMasked = false,
): Evidence => ({
  evidenceId: id, signal, kind, provider, service: 'checkout-service', timestamp: t,
  title, summary, sourceUrl: '#', hasMasked,
})

export const SAMPLE_EVIDENCE: Evidence[] = [
  ev('ev_dep_2143', 'deploy', 'events', T(16), 'deploy: checkout-service v2.14.3',
     'Deployed v2.14.3 by ci-bot — raises JVM -Xmx from 512m to 1024m', 'kubernetes'),
  ev('ev_cfg_limit', 'config', 'events', T(16), 'config: pod memory limit unchanged',
     'Deployment memory limit remains 768Mi (unchanged since v2.11.0)', 'kubernetes'),
  ev('ev_metric_p99', 'metric', 'metrics', T(20), 'http_request_duration_seconds p99',
     'p99: 120ms → 2840ms (+2267%) at 10:20', 'mimir'),
  ev('ev_metric_mem', 'metric', 'metrics', T(20), 'container_memory_working_set_bytes',
     'working set: 520MB → 1.02GB (+96%), exceeding the 768Mi limit', 'mimir'),
  ev('ev_log_oom', 'log', 'logs', T(21), 'ERROR checkout-service',
     'java.lang.OutOfMemoryError: Java heap space in pod AURA_POD_01 (x41)', 'loki', true),
  ev('ev_k8s_oomkill', 'deploy', 'events', T(22), 'k8s_event: OOMKilled',
     'OOMKilled: AURA_POD_01 — container killed, exit code 137 (x7)', 'kubernetes', true),
  ev('ev_log_pool', 'log', 'logs', T(30), 'ERROR checkout-service',
     'HikariPool-1 - Connection is not available, request timed out after 30000ms (x6)', 'loki'),
  ev('ev_trace_slow', 'trace', 'traces', T(25), 'trace POST /checkout',
     '4820ms across 34 spans, 3 errors, touching checkout-service → payment-service', 'tempo'),
  ev('ev_alert_pd', 'alert', 'events', T(21), 'incident: checkout-service 5xx',
     'PagerDuty PD-4471 triggered, urgency high', 'pagerduty'),
]

export const SAMPLE_FINDINGS: Finding[] = [
  { findingId: 'f1', rank: 1, status: 'root_cause', confidence: 0.91, agent: 'obs_root_cause',
    category: 'deploy', createdAt: T(31), caseIds: ['case_oom_3'],
    claim: 'checkout-service was OOM-killed after deploy v2.14.3 [[ev:ev_dep_2143]] raised the ' +
           'JVM heap ceiling to 1024m while the pod memory limit stayed at 768Mi ' +
           '[[ev:ev_cfg_limit]]. Working set crossed the limit at 10:20 [[ev:ev_metric_mem]] and ' +
           'the kubelet began killing containers [[ev:ev_k8s_oomkill]].',
    evidenceIds: ['ev_dep_2143', 'ev_cfg_limit', 'ev_metric_mem', 'ev_k8s_oomkill', 'ev_log_oom'] },
  { findingId: 'f2', rank: 2, status: 'supported', confidence: 0.64, agent: 'obs_root_cause',
    category: 'dependency', createdAt: T(31),
    claim: 'Connection pool exhaustion [[ev:ev_log_pool]] is a downstream effect of the restart ' +
           'loop, not an independent cause — it begins 9 minutes after the first OOMKill.',
    evidenceIds: ['ev_log_pool', 'ev_trace_slow'] },
  { findingId: 'f3', rank: 3, status: 'refuted', confidence: 0.12, agent: 'obs_root_cause',
    category: 'infra', createdAt: T(31),
    claim: 'Network partition between checkout-service and payment-service — ruled out: the ' +
           'trace shows successful payment spans throughout [[ev:ev_trace_slow]].',
    evidenceIds: ['ev_trace_slow'] },
  // The unsupported state is the most important element on the page: it makes
  // "no conclusion without data" a visible property rather than a claim on a slide.
  { findingId: 'f4', rank: 4, status: 'unsupported', confidence: 0.2, agent: 'obs_root_cause',
    category: 'external', createdAt: T(31),
    claim: 'Possible upstream CDN degradation contributed to the error rate.',
    evidenceIds: [] },
]

export const SAMPLE_RUNBOOK: RunbookMatch = {
  runbook_id: 'runbook:rb-07', title: 'Pod OOMKill / memory pressure', origin: 'human',
  status: 'active', match_score: 0.88, matched_on: ['service', 'alert_signature', 'text'],
  steps_satisfied: 4, confirmedCount: 3, source_url: '#',
  steps: [
    { id: 's1', order: 1, title: 'Acknowledge the alert and declare severity',
      description: 'Page primary on-call; set incident severity.', status: 'satisfied',
      evidence_ids: ['ev_alert_pd'] },
    { id: 's2', order: 2, title: 'Confirm OOMKill from kubelet events',
      description: 'kubectl get events --field-selector reason=OOMKilled', status: 'satisfied',
      evidence_ids: ['ev_k8s_oomkill'] },
    { id: 's3', order: 3, title: 'Compare JVM heap settings to the pod memory limit',
      description: 'Check -Xmx against resources.limits.memory.', status: 'satisfied',
      evidence_ids: ['ev_dep_2143', 'ev_cfg_limit'] },
    { id: 's4', order: 4, title: 'Identify the change that introduced the mismatch',
      description: 'Review the most recent deploy for the service.', status: 'satisfied',
      evidence_ids: ['ev_dep_2143'] },
    { id: 's5', order: 5, title: 'Roll back or raise the memory limit',
      description: 'Prefer rollback during an active incident.', status: 'pending',
      evidence_ids: [] },
    { id: 's6', order: 6, title: 'Verify recovery and close',
      description: 'Confirm error rate returns to baseline for 15 minutes.',
      status: 'pending', evidence_ids: [] },
  ],
  alternatives: [
    { runbook_id: 'runbook:rb-12', title: 'JVM tuning for containerised services', score: 0.41 },
    { runbook_id: 'runbook:rb-03', title: 'Connection pool exhaustion', score: 0.33 },
  ],
}

export const SAMPLE_CASES: PastCase[] = [
  { case_id: 'case_oom_3', incident_id: 'INV-20260714-A31B', similarity: 0.82,
    matched_on: ['signatures', 'service', 'symptom_shape'], occurred_at: '2026-07-14T02:11:00Z',
    root_cause_statement: 'Heap ceiling raised above the pod memory limit in v2.9.1',
    root_cause_category: 'deploy', outcome_verdict: 'confirmed', outcome_confidence: 1.0,
    resolution: 'Rolled back to v2.9.0, then raised limits.memory to 1536Mi',
    service: 'checkout-service', source_url: '#' },
  { case_id: 'case_oom_7', incident_id: 'INV-20260602-77C2', similarity: 0.61,
    matched_on: ['signatures', 'service'], occurred_at: '2026-06-02T18:40:00Z',
    root_cause_statement: 'Memory leak in the cart serializer',
    root_cause_category: 'capacity', outcome_verdict: 'confirmed', outcome_confidence: 0.7,
    resolution: 'Patched serializer in v2.8.4', service: 'checkout-service', source_url: '#' },
]

export const SAMPLE_NEGATIVE_CASES: PastCase[] = [
  { case_id: 'case_wrong_2', incident_id: 'INV-20260519-4E10', similarity: 0.55,
    matched_on: ['signatures'], occurred_at: '2026-05-19T09:05:00Z',
    root_cause_statement: 'Actually a bad deploy, not a network fault',
    root_cause_category: 'deploy', wrong_category: 'infra', outcome_verdict: 'wrong',
    outcome_confidence: 1.0, resolution: 'Rollback', service: 'checkout-service', source_url: '#' },
]

export const SAMPLE_INVESTIGATION: Investigation = {
  investigationId: 'INV-20260801-DEMO01', createdAt: T(19), title: 'checkout-service OOM after deploy',
  status: 'complete', severity: 'critical', serviceName: 'checkout-service',
  services: ['checkout-service'], incidentId: 'PD-4471', runId: 'inv-demo',
  window: { start: T(0), end: T(59) },
  findings: SAMPLE_FINDINGS, evidence: SAMPLE_EVIDENCE,
  rootCause: SAMPLE_FINDINGS[0], evidenceCount: SAMPLE_EVIDENCE.length,
  citationCoverage: 0.8,
  cost: { inputTokens: 12400, outputTokens: 3100, totalCost: 0.0412, calls: 2,
          model: 'claude-sonnet-4-5' },
  masking: { enabled: true, reversible: true, totalTokens: 14,
             byType: { POD: 6, HOST: 3, IP: 3, CLUSTER: 2 } },
  outcome: null, runbookId: 'runbook:rb-07', caseCount: 2,
  startedAt: T(19), completedAt: T(31),
}

export const SAMPLE_INVESTIGATION_HISTORY: Investigation[] = [
  SAMPLE_INVESTIGATION,
  { ...SAMPLE_INVESTIGATION, investigationId: 'INV-20260731-9AB2',
    title: 'payment-service timeout storm', serviceName: 'payment-service',
    severity: 'high', createdAt: '2026-07-31T22:14:00Z',
    citationCoverage: 0.67, evidenceCount: 38,
    cost: { inputTokens: 9800, outputTokens: 2400, totalCost: 0.0311, calls: 2,
            model: 'claude-sonnet-4-5' },
    outcome: { verdict: 'confirmed', confidence: 1.0, sources: [], confirmed_by: 'sre-oncall' } },
  { ...SAMPLE_INVESTIGATION, investigationId: 'INV-20260729-1C40',
    title: 'orders-db connection saturation', serviceName: 'orders-db',
    severity: 'medium', createdAt: '2026-07-29T11:02:00Z',
    citationCoverage: 0.5, evidenceCount: 21,
    cost: { inputTokens: 6100, outputTokens: 1500, totalCost: 0.0198, calls: 2,
            model: 'claude-sonnet-4-5' },
    outcome: { verdict: 'wrong', confidence: 1.0, sources: [], confirmed_by: 'dba' } },
]

const STAGES: [number, string, string[]][] = [
  [1, 'Collect Signals', ['obs_signal_collector']],
  [2, 'Correlate', ['obs_correlator']],
  [3, 'Recall & Match', ['obs_case_retrieval', 'obs_runbook']],
  [4, 'Hypothesize', ['obs_hypothesis']],
  [5, 'Root Cause', ['obs_root_cause']],
  [6, 'Recommend', ['remediation_agent']],
]

/**
 * Emit the real DAG event sequence on a timer, into the real reducer.
 * `speed` > 1 runs faster; returns a cancel function.
 */
export function replaySampleRun(
  onEvent: (ev: DagEvent) => void,
  speed = 1,
): () => void {
  let seq = 0
  const id = SAMPLE_INVESTIGATION.investigationId
  const timers: ReturnType<typeof setTimeout>[] = []
  const script: [number, DagEvent][] = []
  let t = 0

  const push = (delay: number, ev: DagEvent) => {
    t += delay
    script.push([t, ev])
  }

  push(0, { type: 'dag_start', runId: 'inv-demo', total_stages: STAGES.length,
            total_agents: STAGES.reduce((n, s) => n + s[2].length, 0),
            title: SAMPLE_INVESTIGATION.title, service: 'checkout-service' })

  STAGES.forEach(([stage, title, agents]) => {
    push(220, { type: 'stage_start', stage, title, agents })
    agents.forEach((agent) => {
      push(120, { type: 'agent_start', agent, stage })
      if (stage === 1) {
        SAMPLE_EVIDENCE.forEach((e) => push(90, { type: 'evidence', evidence: e }))
      }
      if (stage === 5) {
        SAMPLE_FINDINGS.forEach((f) => push(260, { type: 'finding', finding: f }))
      }
      push(340, { type: 'agent_done', agent, stage, status: 'success',
                  elapsed_ms: 900 + stage * 220,
                  evidence_added: stage === 1 ? SAMPLE_EVIDENCE.length : 0,
                  costDelta: stage === 4 ? 0.0151 : stage === 5 ? 0.0261 : 0 })
    })
    push(140, { type: 'stage_done', stage, title, elapsed_ms: 1200 + stage * 300 })
  })

  push(200, { type: 'cost', cost: SAMPLE_INVESTIGATION.cost })
  push(120, { type: 'dag_done', runId: 'inv-demo', status: 'success',
              rootCause: SAMPLE_FINDINGS[0] as unknown as Record<string, unknown>,
              masking: SAMPLE_INVESTIGATION.masking as unknown as Record<string, unknown>,
              cost: SAMPLE_INVESTIGATION.cost,
              evidenceCount: SAMPLE_EVIDENCE.length, citationCoverage: 0.8 })

  script.forEach(([at, ev]) => {
    timers.push(setTimeout(() => {
      seq += 1
      onEvent({ ...ev, seq, investigationId: id })
    }, at / Math.max(0.1, speed)))
  })

  return () => timers.forEach(clearTimeout)
}
