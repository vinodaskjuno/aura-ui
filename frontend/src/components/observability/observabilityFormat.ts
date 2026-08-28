/**
 * Constants and formatters only — NO components.
 *
 * A module that exports both a component and constants disables React Fast Refresh
 * for that module (see components/aiops-gateway/usageFormat.ts, which documents the
 * same trap). Keeping them apart is a build-ergonomics requirement, not style.
 */
import type { EvidenceKind, FindingStatus, ProviderStatus } from '../../api/observability'

export const EVIDENCE_KIND_META: Record<EvidenceKind, { label: string; color: string }> = {
  log:     { label: 'Log',     color: '#4f8ef7' },
  metric:  { label: 'Metric',  color: '#f59e0b' },
  trace:   { label: 'Trace',   color: '#8b5cf6' },
  deploy:  { label: 'Deploy',  color: '#10b981' },
  config:  { label: 'Config',  color: '#06b6d4' },
  alert:   { label: 'Alert',   color: '#ef4444' },
  runbook: { label: 'Runbook', color: '#a3a3a3' },
}

export const FINDING_STATUS_META: Record<FindingStatus, { label: string; color: string }> = {
  root_cause:  { label: 'Root cause',  color: '#ef4444' },
  supported:   { label: 'Supported',   color: '#10b981' },
  refuted:     { label: 'Refuted',     color: '#6b7280' },
  unsupported: { label: 'Unsupported', color: '#f59e0b' },
}

export const PROVIDER_STATUS_META: Record<ProviderStatus, { label: string; color: string }> = {
  connected:       { label: 'Connected',       color: '#10b981' },
  degraded:        { label: 'Degraded',        color: '#f59e0b' },
  failed:          { label: 'Failed',          color: '#ef4444' },
  not_configured:  { label: 'Not configured',  color: '#6b7280' },
}

export const AGENT_LABELS: Record<string, string> = {
  obs_signal_collector: 'Collect signals',
  obs_correlator: 'Correlate',
  obs_case_retrieval: 'Recall past incidents',
  obs_runbook: 'Match runbook',
  obs_hypothesis: 'Hypothesise',
  obs_root_cause: 'Root cause',
  obs_verifier: 'Verify',
  remediation_agent: 'Recommend actions',
}

export const PROVIDER_LABELS: Record<string, string> = {
  loki: 'Grafana Loki', mimir: 'Grafana Mimir', tempo: 'Grafana Tempo',
  grafana_loki: 'Grafana Loki', grafana_mimir: 'Grafana Mimir', grafana_tempo: 'Grafana Tempo',
  datadog: 'Datadog', sentry: 'Sentry', elasticsearch: 'Elasticsearch',
  cloudwatch: 'AWS CloudWatch', kubernetes: 'Kubernetes', pagerduty: 'PagerDuty',
  slack: 'Slack', telegram: 'Telegram',
}

export function fmtDuration(ms: number): string {
  if (!ms || ms < 0) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  return `${m}m ${Math.round(s % 60)}s`
}

export function fmtConfidence(v: number | string | undefined): string {
  const n = typeof v === 'string' ? parseFloat(v) : v
  if (n === undefined || Number.isNaN(n)) return '—'
  return `${Math.round(n * 100)}%`
}

export function fmtCost(v: number | undefined): string {
  if (v === undefined || Number.isNaN(v)) return '—'
  return `$${v.toFixed(4)}`
}

export function fmtTokens(n: number | undefined): string {
  if (!n) return '0'
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

export function relTime(iso: string): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const diff = Date.now() - then
  const mins = Math.round(diff / 60000)
  if (Math.abs(mins) < 1) return 'just now'
  if (Math.abs(mins) < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (Math.abs(hrs) < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

export function clockTime(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString()
}
