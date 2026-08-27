import type { Alert, AIOpsKPIs, Pipeline } from '../api/aiops'

function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

export const SAMPLE_ALERTS: Alert[] = [
  // CRITICAL (2)
  {
    alertId: 'S-001', source: 'CloudWatch', severity: 'critical',
    service: 'EC2/web-server-prod',
    message: 'CPUUtilization exceeded 95% for 15 consecutive minutes',
    timestamp: ago(8), state: 'ALARM',
    namespace: 'AWS/EC2', metricName: 'CPUUtilization',
    rootCause: 'Memory leak in payment-service v2.3.1 causing CPU saturation',
  },
  {
    alertId: 'S-002', source: 'CloudWatch', severity: 'critical',
    service: 'ECS/checkout-service',
    message: 'Health checks failing on 3 of 4 ECS tasks; removed from LB rotation',
    timestamp: ago(5), state: 'ALARM',
    namespace: 'AWS/ECS', metricName: 'HealthyHostCount',
    rootCause: 'Out-of-memory error: missing pagination in product catalog query',
  },
  // HIGH (4)
  {
    alertId: 'S-003', source: 'CloudWatch', severity: 'high',
    service: 'RDS/aurora-prod-cluster',
    message: 'DatabaseConnections at 98% of max_connections (490/500)',
    timestamp: ago(12), state: 'ALARM',
    namespace: 'AWS/RDS', metricName: 'DatabaseConnections',
    rootCause: 'Connection pool exhaustion in order-service: unclosed sessions',
  },
  {
    alertId: 'S-004', source: 'CloudWatch', severity: 'high',
    service: 'Lambda/payment-processor',
    message: 'Error rate 8.3% (threshold 5%) over last 5 minutes',
    timestamp: ago(6), state: 'ALARM',
    namespace: 'AWS/Lambda', metricName: 'Errors',
  },
  {
    alertId: 'S-005', source: 'CloudWatch', severity: 'high',
    service: 'APIGateway/orders-api',
    message: '4XX error rate at 12% — unusually high client error responses',
    timestamp: ago(22), state: 'ALARM',
    namespace: 'AWS/ApiGateway', metricName: '4XXError',
  },
  {
    alertId: 'S-006', source: 'Datadog', severity: 'high',
    service: 'EC2/api-gateway-proxy',
    message: 'Network packet loss 2.4% on eth0',
    timestamp: ago(78), state: 'ALARM',
    namespace: 'AWS/EC2', metricName: 'NetworkPacketsOut',
  },
  // MEDIUM (5)
  {
    alertId: 'S-007', source: 'CloudWatch', severity: 'medium',
    service: 'ECS/inventory-service',
    message: 'RunningTaskCount dropped to 1 (minimum 3). Auto-scale triggered.',
    timestamp: ago(35), state: 'ALARM',
    namespace: 'AWS/ECS', metricName: 'RunningTaskCount',
  },
  {
    alertId: 'S-008', source: 'CloudWatch', severity: 'medium',
    service: 'EC2/worker-node-02',
    message: 'Memory utilization 78%, approaching 80% threshold',
    timestamp: ago(45), state: 'ALARM',
    namespace: 'AWS/EC2', metricName: 'mem_used_percent',
  },
  {
    alertId: 'S-009', source: 'CloudWatch', severity: 'medium',
    service: 'S3/aura-backups-prod',
    message: 'PutLatency p99 > 2000ms for last 10 minutes',
    timestamp: ago(67), state: 'ALARM',
    namespace: 'AWS/S3', metricName: 'PutLatency',
  },
  {
    alertId: 'S-010', source: 'CloudWatch', severity: 'medium',
    service: 'Lambda/report-generator',
    message: 'Duration p99 at 28400ms — approaching 30000ms timeout',
    timestamp: ago(18), state: 'ALARM',
    namespace: 'AWS/Lambda', metricName: 'Duration',
  },
  {
    alertId: 'S-011', source: 'CloudWatch', severity: 'medium',
    service: 'RDS/postgres-analytics',
    message: 'FreeStorageSpace below 20% threshold (184 GB of 1 TB)',
    timestamp: ago(90), state: 'ALARM',
    namespace: 'AWS/RDS', metricName: 'FreeStorageSpace',
  },
  // LOW (3)
  {
    alertId: 'S-012', source: 'CloudWatch', severity: 'low',
    service: 'ECS/notification-svc',
    message: 'SQS queue backlog: 12,400 messages pending — consumer lagging',
    timestamp: ago(52), state: 'ALARM',
    namespace: 'AWS/SQS', metricName: 'ApproximateNumberOfMessagesVisible',
  },
  {
    alertId: 'S-013', source: 'CloudWatch', severity: 'low',
    service: 'CloudWatch/synthetic-monitor',
    message: 'Canary health-check latency elevated: 1240ms avg (baseline 340ms)',
    timestamp: ago(120), state: 'ALARM',
    namespace: 'CloudWatchSynthetics', metricName: 'Duration',
  },
  {
    alertId: 'S-014', source: 'CloudWatch', severity: 'low',
    service: 'APIGateway/internal-api',
    message: 'Cache hit ratio 45% (target 75%). Increased origin load expected.',
    timestamp: ago(180), state: 'ALARM',
    namespace: 'AWS/ApiGateway', metricName: 'CacheHitCount',
  },
  // OK / RESOLVED (3)
  {
    alertId: 'S-015', source: 'CloudWatch', severity: 'ok',
    service: 'Lambda/auth-service',
    message: 'Throttle count normalized after scale-out (was 847/min)',
    timestamp: ago(15), state: 'OK',
    namespace: 'AWS/Lambda', metricName: 'Throttles',
  },
  {
    alertId: 'S-016', source: 'CloudWatch', severity: 'ok',
    service: 'EC2/cache-node-01',
    message: 'Disk I/O saturation resolved — throughput normalized at 450 IOPS',
    timestamp: ago(30), state: 'OK',
    namespace: 'AWS/EC2', metricName: 'DiskReadBytes',
  },
  {
    alertId: 'S-017', source: 'PagerDuty', severity: 'ok',
    service: 'S3/static-assets-cdn',
    message: 'High request rate resolved — rate throttling applied upstream',
    timestamp: ago(60), state: 'OK',
    namespace: 'AWS/S3', metricName: 'NumberOfObjects',
  },
]

export const SAMPLE_PIPELINES: Pipeline[] = [
  {
    runId: 'PL-001', intent: 'Auto-RCA: EC2 CPU saturation in web-server-prod',
    agents: ['AIOpsAgent', 'RCAAgent', 'KnowledgeGraphAgent'],
    status: 'completed', completedAt: ago(7),
  },
  {
    runId: 'PL-002', intent: 'Incident correlation: RDS connections + Lambda errors',
    agents: ['AIOpsAgent', 'CorrelationAgent', 'RCAAgent', 'NotificationAgent'],
    status: 'completed', completedAt: ago(11),
  },
  {
    runId: 'PL-003', intent: 'ECS remediation — inventory-service task recovery',
    agents: ['AIOpsAgent', 'RemediationAgent'],
    status: 'completed', completedAt: ago(34),
  },
  {
    runId: 'PL-004', intent: 'Anomaly detection — S3 latency spike analysis',
    agents: ['AIOpsAgent', 'AnomalyAgent', 'RCAAgent'],
    status: 'completed', completedAt: ago(65),
  },
  {
    runId: 'PL-005', intent: 'Predictive scale-out ahead of traffic peak',
    agents: ['ForecastAgent', 'RemediationAgent', 'KnowledgeGraphAgent'],
    status: 'completed', completedAt: ago(120),
  },
  {
    runId: 'PL-006', intent: 'Security posture check — anomalous S3 access patterns',
    agents: ['SecurityAgent', 'AIOpsAgent', 'KnowledgeGraphAgent'],
    status: 'completed', completedAt: ago(200),
  },
  {
    runId: 'PL-007', intent: 'Full RCA pipeline — manually triggered by on-call',
    agents: ['AIOpsAgent', 'RCAAgent', 'KnowledgeGraphAgent', 'SOPAgent'],
    status: 'completed', completedAt: ago(300),
  },
  {
    runId: 'PL-008', intent: 'Lambda throttle auto-remediation',
    agents: ['AIOpsAgent', 'RemediationAgent'],
    status: 'completed', completedAt: ago(14),
  },
]

const TREND_CRITICAL = [2,2,3,3,4,4,3,3,2,2,1,1,2,3,4,5,5,4,4,3,3,2,2,3,4,4,3,2,2,3]
const TREND_TOTAL    = [5,6,7,8,9,9,8,7,7,6,5,5,6,7,9,11,12,11,10,9,8,7,7,8,10,11,10,9,9,10]

export const SAMPLE_TREND_HISTORY = Array.from({ length: 30 }, (_, i) => {
  const minutesAgo = 30 - i
  const t = new Date(Date.now() - minutesAgo * 60_000)
  return {
    time: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    critical: TREND_CRITICAL[i] ?? 2,
    total: TREND_TOTAL[i] ?? 8,
  }
})

const SEV_ORDER = ['critical', 'high', 'medium', 'low', 'ok']

export function calcMTTR(alerts: Alert[]): number {
  const alarmAt: Record<string, number> = {}
  const diffs: number[] = []
  for (const a of [...alerts].sort((x, y) => x.timestamp.localeCompare(y.timestamp))) {
    if (a.state === 'ALARM') {
      alarmAt[a.service] = new Date(a.timestamp).getTime()
    } else if (a.state === 'OK' && alarmAt[a.service] !== undefined) {
      diffs.push((new Date(a.timestamp).getTime() - alarmAt[a.service]) / 60_000)
    }
  }
  return diffs.length === 0 ? 24 : Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length)
}

export function calcMTTD(_alerts: Alert[]): number {
  return 5
}

export function worstSeverity(alerts: Alert[]): string {
  return SEV_ORDER.find(s => alerts.some(a => a.severity === s)) ?? 'low'
}

export const SAMPLE_KPIS: AIOpsKPIs = {
  activeAlarms: SAMPLE_ALERTS.filter(a => a.state === 'ALARM').length,
  totalAlerts: SAMPLE_ALERTS.length,
  agentRuns: SAMPLE_PIPELINES.length,
  liveConnected: false,
}
