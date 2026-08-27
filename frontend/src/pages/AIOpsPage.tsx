import { wsOrigin } from '../api/wsUrl'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, Activity, AlertTriangle, CheckCircle, RefreshCw,
  Clock, Database, Zap, X, ChevronRight,
  Radio, Workflow, TrendingUp, FileText,
  FlaskConical, ChevronDown, ChevronUp,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts'
import { aiopsApi, SEVERITY_COLORS, type Alert, type AIOpsKPIs, type Pipeline } from '../api/aiops'
import { useAuthStore } from '../store/authStore'
import SOPTab from '../components/sop/SOPTab'
import GatewayTab from '../components/aiops-gateway/GatewayTab'
import {
  SAMPLE_ALERTS, SAMPLE_PIPELINES, SAMPLE_TREND_HISTORY, SAMPLE_KPIS,
  calcMTTR, calcMTTD, worstSeverity,
} from '../data/aiops-sample'

// ── Severity badge ─────────────────────────────────────────────────────────────
function SeverityBadge({ severity }: { severity: string }) {
  const s = severity ?? 'unknown'
  const c = SEVERITY_COLORS[s] ?? '#6b7280'
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
      background: `${c}22`, color: c, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, display: 'inline-block', flexShrink: 0 }} />
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  )
}

// ── Live pulse indicator ───────────────────────────────────────────────────────
function LiveIndicator({ connected }: { connected: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%',
        background: connected ? '#10b981' : '#6b7280',
        boxShadow: connected ? '0 0 6px #10b981' : 'none',
        animation: connected ? 'pulse 2s infinite' : 'none' }} />
      <span style={{ fontSize: 11, fontWeight: 600,
        color: connected ? '#10b981' : 'var(--color-muted)' }}>
        {connected ? 'Live' : 'Polling'}
      </span>
    </div>
  )
}

// ── Alert row ─────────────────────────────────────────────────────────────────
function AlertRow({ alert, onAck }: { alert: Alert; onAck: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const c = SEVERITY_COLORS[alert.severity] ?? '#6b7280'
  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      style={{ borderLeft: `3px solid ${c}`, background: 'var(--color-card)',
        border: `1px solid var(--color-border)`, borderLeftColor: c,
        borderRadius: 8, overflow: 'hidden', marginBottom: 6 }}>
      <div style={{ padding: '10px 14px', cursor: 'pointer' }}
        onClick={() => setExpanded(v => !v)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
          <SeverityBadge severity={alert.severity} />
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', flex: 1, minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {alert.service}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-muted)', whiteSpace: 'nowrap', flexShrink: 0,
            fontFamily: 'var(--font-mono)' }}>
            {new Date(alert.timestamp).toLocaleTimeString()}
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, flexShrink: 0,
            background: alert.state === 'ALARM' ? '#ef444422' : '#10b98122',
            color: alert.state === 'ALARM' ? '#ef4444' : '#10b981' }}>
            {alert.state}
          </div>
          {expanded ? <ChevronRight size={13} style={{ transform: 'rotate(90deg)', color: 'var(--color-muted)', flexShrink: 0 }} />
            : <ChevronRight size={13} color="var(--color-muted)" style={{ flexShrink: 0 }} />}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-muted)', lineHeight: 1.5,
          wordBreak: 'break-all', whiteSpace: 'normal', paddingLeft: 2, paddingRight: 24 }}>
          {alert.message}
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            style={{ overflow: 'hidden', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[['Source', alert.source], ['Namespace', alert.namespace ?? '—'],
                  ['Metric', alert.metricName ?? '—'],
                  ['Time', new Date(alert.timestamp).toLocaleString()]].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 10, color: 'var(--color-muted)', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{k}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>{v}</div>
                  </div>
                ))}
              </div>
              {alert.rootCause && (
                <div style={{ background: '#ef444414', border: '1px solid #ef444433',
                  borderRadius: 6, padding: '8px 12px', fontSize: 12, color: 'var(--color-text)' }}>
                  <span style={{ fontWeight: 700, color: '#ef4444' }}>Root Cause: </span>
                  {alert.rootCause}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => onAck(alert.alertId)}
                  style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                    background: '#10b98122', border: '1px solid #10b981',
                    color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle size={11} /> Acknowledge
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Source Correlation panel ───────────────────────────────────────────────────
function CorrelationPanel({ alerts }: { alerts: Alert[] }) {
  const active = alerts.filter(a => a.state === 'ALARM').slice(0, 1)[0]
  if (!active) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', color: 'var(--color-muted)', gap: 8 }}>
      <CheckCircle size={32} color="#10b981" style={{ opacity: 0.6 }} />
      <div style={{ fontSize: 13 }}>No active alarms</div>
    </div>
  )
  const steps = [
    { label: 'Alert', value: active.severity.toUpperCase(), color: SEVERITY_COLORS[active.severity] },
    { label: 'Service', value: active.service, color: '#4f8ef7' },
    { label: 'Metric', value: active.metricName ?? 'N/A', color: '#8b5cf6' },
    { label: 'Source', value: active.namespace ?? active.source, color: '#f59e0b' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-muted)',
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
        Active Alert Correlation
      </div>
      {steps.map((s, i) => (
        <div key={i}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10,
            background: `${s.color}14`, border: `1px solid ${s.color}33`,
            borderRadius: 8, padding: '8px 14px' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: `${s.color}22`, border: `2px solid ${s.color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, color: s.color }}>
              {i + 1}
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--color-muted)', fontWeight: 600,
                textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{s.value}</div>
            </div>
          </div>
          {i < steps.length - 1 && (
            <div style={{ width: 2, height: 10, background: `${s.color}44`, margin: '0 13px' }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Alert trend chart ──────────────────────────────────────────────────────────
function AlertTrendChart({ history }: { history: { time: string; critical: number; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="gcritical" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gtotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4f8ef7" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#4f8ef7" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="time" tick={{ fill: 'var(--color-muted)', fontSize: 9 }} />
        <YAxis tick={{ fill: 'var(--color-muted)', fontSize: 9 }} />
        <Tooltip
          contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 6, fontSize: 11 }}
          labelStyle={{ color: 'var(--color-text)' }} />
        <Area type="monotone" dataKey="total" stroke="#4f8ef7" fill="url(#gtotal)" strokeWidth={1.5} />
        <Area type="monotone" dataKey="critical" stroke="#ef4444" fill="url(#gcritical)" strokeWidth={1.5} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Pipeline list ──────────────────────────────────────────────────────────────
function PipelineList({ pipelines }: { pipelines: Pipeline[] }) {
  if (pipelines.length === 0) return (
    <div style={{ fontSize: 12, color: 'var(--color-muted)', padding: 16, textAlign: 'center' }}>
      No agent runs yet
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {pipelines.slice(0, 8).map((p, i) => (
        <motion.div key={p.runId} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: i * 0.04 }}
          style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px',
            background: 'var(--color-card)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 4,
            background: p.status === 'completed' ? '#10b981' : '#f59e0b' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.intent || 'Agent run'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--color-muted)', marginTop: 2 }}>
              {p.agents?.slice(0, 3).join(' → ')}
              {p.agents?.length > 3 ? ` +${p.agents.length - 3}` : ''}
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--color-muted)', whiteSpace: 'nowrap',
            fontFamily: 'var(--font-mono)' }}>
            {p.completedAt ? new Date(p.completedAt).toLocaleTimeString() : '—'}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ── NEW: Incident Timeline (Gantt-style) ───────────────────────────────────────
function IncidentTimeline({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) return (
    <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-muted)', fontSize: 12 }}>
      No alerts to display in timeline
    </div>
  )

  const timestamps = alerts.map(a => new Date(a.timestamp).getTime())
  const minTime = Math.min(...timestamps)

  const serviceMap: Record<string, Alert[]> = {}
  for (const a of alerts) {
    const key = a.service ?? 'Unknown'
    if (!serviceMap[key]) serviceMap[key] = []
    serviceMap[key].push(a)
  }

  const chartData = Object.entries(serviceMap).map(([service, sAlerts]) => {
    const times = sAlerts.map(a => new Date(a.timestamp).getTime())
    const start = Math.min(...times)
    const end   = Math.max(...times)
    return {
      service,
      offset:   Math.round((start - minTime) / 60_000),
      duration: Math.max(1, Math.round((end - start) / 60_000)),
      color:    SEVERITY_COLORS[worstSeverity(sAlerts)] ?? '#6b7280',
      count:    sAlerts.length,
    }
  }).sort((a, b) => a.offset - b.offset)

  const height = Math.max(200, chartData.length * 40)

  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--color-muted)', marginBottom: 8 }}>
        Each bar shows the first-to-last alert span per service. Color = worst severity.
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart layout="vertical" data={chartData}
          margin={{ top: 4, right: 24, bottom: 20, left: 8 }}>
          <XAxis type="number" tick={{ fill: 'var(--color-muted)', fontSize: 9 }}
            label={{ value: 'minutes from first alert', position: 'insideBottom', offset: -10, fontSize: 9, fill: 'var(--color-muted)' }} />
          <YAxis dataKey="service" type="category" width={130}
            tick={{ fill: 'var(--color-text)', fontSize: 10 }} />
          <Tooltip
            contentStyle={{ background: 'var(--color-surface)',
              border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 11 }}
            formatter={(val: unknown, name: string) => {
              if (name === 'offset') return [null, null]
              return [`${val} min`, 'Duration']
            }}
          />
          <Bar dataKey="offset" stackId="g" fill="transparent" legendType="none" />
          <Bar dataKey="duration" stackId="g" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── NEW: Alert Cluster View ────────────────────────────────────────────────────
function AlertClusterView({ alerts, onAck }: { alerts: Alert[]; onAck: (id: string) => void }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const clusters = Object.entries(
    alerts.reduce((acc, a) => {
      const svc = a.service ?? 'Unknown'
      if (!acc[svc]) acc[svc] = []
      acc[svc].push(a)
      return acc
    }, {} as Record<string, Alert[]>)
  ).map(([service, sAlerts]) => ({
    service,
    alerts: sAlerts,
    worstSev: worstSeverity(sAlerts),
    alarmCount: sAlerts.filter(a => a.state === 'ALARM').length,
  })).sort((a, b) => b.alarmCount - a.alarmCount)

  const toggle = (service: string) => {
    setExpanded(prev => {
      const n = new Set(prev)
      if (n.has(service)) n.delete(service)
      else n.add(service)
      return n
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {clusters.map(cluster => {
        const isOpen = expanded.has(cluster.service)
        const c = SEVERITY_COLORS[cluster.worstSev] ?? '#6b7280'
        return (
          <div key={cluster.service} style={{ borderRadius: 8, overflow: 'hidden',
            border: `1px solid ${c}33`, background: 'var(--color-card)' }}>
            <div onClick={() => toggle(cluster.service)}
              style={{ display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', cursor: 'pointer', background: `${c}0a` }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--color-text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cluster.service}
              </div>
              <span style={{ fontSize: 10, color: 'var(--color-muted)', flexShrink: 0 }}>
                {cluster.alerts.length} alert{cluster.alerts.length !== 1 ? 's' : ''}
              </span>
              {cluster.alarmCount > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 4,
                  background: '#ef444420', color: '#ef4444', flexShrink: 0 }}>
                  {cluster.alarmCount} ALARM
                </span>
              )}
              {isOpen
                ? <ChevronUp size={13} color="var(--color-muted)" style={{ flexShrink: 0 }} />
                : <ChevronDown size={13} color="var(--color-muted)" style={{ flexShrink: 0 }} />}
            </div>
            {isOpen && (
              <div style={{ borderTop: `1px solid ${c}22` }}>
                {cluster.alerts.map(alert => (
                  <div key={alert.alertId} style={{ display: 'flex', alignItems: 'center',
                    gap: 8, padding: '7px 14px 7px 24px',
                    borderBottom: '1px solid var(--color-border)' }}>
                    <SeverityBadge severity={alert.severity} />
                    <div style={{ flex: 1, fontSize: 11, color: 'var(--color-text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {alert.message}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--color-muted)',
                      fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </div>
                    <button onClick={() => onAck(alert.alertId)}
                      style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5,
                        background: '#10b98112', border: '1px solid #10b981',
                        color: '#10b981', cursor: 'pointer', flexShrink: 0 }}>
                      Ack
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── NEW: Animated RCA Flow Diagram ────────────────────────────────────────────
function RcaFlowDiagram({ running }: { running: boolean }) {
  const agents = [
    { label: 'AIOpsAgent', desc: 'Fetches CloudWatch alarms and correlates service graph', color: '#4f8ef7', Icon: Activity },
    { label: 'RCAAgent', desc: 'Generates root cause via Bedrock Claude', color: '#8b5cf6', Icon: Brain },
    { label: 'KnowledgeGraphAgent', desc: 'Persists RCA findings as Neptune triples', color: '#10b981', Icon: Database },
  ]

  return (
    <div style={{ padding: '16px 0' }}>
      {running && (
        <style>{`
          @keyframes rcaPulse { 0%,100%{transform:scale(1);} 50%{transform:scale(1.07);} }
          @keyframes rcaFlow  { 0%{left:-35%;} 100%{left:135%;} }
        `}</style>
      )}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {agents.flatMap((agent, i) => {
          const items = [
            <div key={agent.label} style={{ flex: '0 0 auto', width: '30%', textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14, margin: '0 auto',
                background: `${agent.color}15`,
                border: `2px solid ${running ? agent.color : agent.color + '44'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: running ? `0 0 18px ${agent.color}44` : 'none',
                animation: running ? `rcaPulse 2s ease-in-out ${i * 0.6}s infinite` : 'none',
                transition: 'all 0.4s',
              }}>
                <agent.Icon size={24} color={running ? agent.color : `${agent.color}55`} />
              </div>
              <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700,
                color: running ? agent.color : 'var(--color-subtext)', lineHeight: 1.3 }}>
                {agent.label}
              </div>
              <div style={{ fontSize: 10, color: 'var(--color-muted)', marginTop: 3,
                lineHeight: 1.35, padding: '0 4px' }}>
                {agent.desc}
              </div>
            </div>,
          ]
          if (i < agents.length - 1) {
            items.push(
              <div key={`conn-${i}`} style={{ flex: 1, height: 3, position: 'relative',
                background: running ? `${agent.color}33` : 'var(--color-border)',
                borderRadius: 2, overflow: 'hidden', margin: '0 4px', marginBottom: 44 }}>
                {running && (
                  <div style={{
                    position: 'absolute', top: 0, height: '100%', width: '35%',
                    background: `linear-gradient(90deg, transparent, ${agent.color}, transparent)`,
                    animation: `rcaFlow 1.5s linear ${i * 0.6}s infinite`,
                  }} />
                )}
              </div>
            )
          }
          return items
        })}
      </div>
    </div>
  )
}

// ── Main AIOps Page ────────────────────────────────────────────────────────────
type Tab = 'alerts' | 'pipelines' | 'rca' | 'sop' | 'gateway'
type AlertView = 'list' | 'cluster' | 'timeline'

export default function AIOpsPage() {
  const { token } = useAuthStore()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [kpis, setKpis] = useState<AIOpsKPIs>({ activeAlarms: 0, totalAlerts: 0, agentRuns: 0, liveConnected: false })
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [tab, setTab] = useState<Tab>('alerts')
  const [liveMode, setLiveMode] = useState(true)
  const [loading, setLoading] = useState(true)
  const [triggeringRca, setTriggeringRca] = useState(false)

  // Demo mode state
  const [demoMode, setDemoMode] = useState(false)
  const [demoBannerDismissed, setDemoBannerDismissed] = useState(false)
  const [alertView, setAlertView] = useState<AlertView>('list')

  const wsRef = useRef<WebSocket | null>(null)
  const wsUrl = wsOrigin()
  const [trendHistory, setTrendHistory] = useState<{ time: string; critical: number; total: number }[]>([])

  // Display data — switches between live and demo
  const displayAlerts    = demoMode ? SAMPLE_ALERTS    : alerts
  const displayPipelines = demoMode ? SAMPLE_PIPELINES : pipelines
  const displayKpis      = demoMode ? SAMPLE_KPIS      : kpis
  const displayTrend     = demoMode ? SAMPLE_TREND_HISTORY : trendHistory
  const dataSourceCount  = new Set(displayAlerts.map(a => a.source)).size
  const mttr             = calcMTTR(displayAlerts)
  const mttd             = calcMTTD(displayAlerts)

  const severityDist = Object.entries(
    displayAlerts.reduce((acc, a) => { acc[a.severity] = (acc[a.severity] ?? 0) + 1; return acc }, {} as Record<string, number>)
  ).map(([sev, count]) => ({ name: sev, value: count, color: SEVERITY_COLORS[sev] ?? '#6b7280' }))

  const loadData = useCallback(async () => {
    try {
      const [alertsRes, kpisRes, plRes] = await Promise.all([
        aiopsApi.getAlerts(),
        aiopsApi.getKpis(),
        aiopsApi.getPipelines(),
      ])
      setAlerts(alertsRes.data)
      setKpis(kpisRes.data)
      setPipelines(plRes.data)
    } catch { /**/ }
    finally { setLoading(false) }
  }, [])

  const connectWs = useCallback(() => {
    if (!token || wsRef.current?.readyState === WebSocket.OPEN) return
    const ws = new WebSocket(`${wsUrl}/api/aiops/ws/live`)
    wsRef.current = ws
    ws.onopen = () => ws.send(JSON.stringify({ token, interval: 15 }))
    ws.onmessage = (e) => {
      const ev = JSON.parse(e.data)
      if (ev.type === 'alerts') {
        setAlerts(ev.data ?? [])
        setTrendHistory(h => {
          const critical = (ev.data ?? []).filter((a: Alert) => a.severity === 'critical').length
          const entry = { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            critical, total: (ev.data ?? []).length }
          return [...h, entry].slice(-10)
        })
      } else if (ev.type === 'kpis') {
        setKpis(prev => ({ ...prev, activeAlarms: ev.activeAlarms, totalAlerts: ev.totalAlerts,
          agentRuns: ev.agentRuns, liveConnected: ev.liveConnected }))
      }
    }
    ws.onclose = () => { if (liveMode) setTimeout(connectWs, 5000) }
    ws.onerror = () => ws.close()
  }, [token, wsUrl, liveMode])

  useEffect(() => {
    loadData()
    if (liveMode) connectWs()
    return () => { wsRef.current?.close() }
  }, [liveMode])

  const handleAck = useCallback(async (alertId: string) => {
    if (demoMode) {
      // In demo mode, just remove from local display
      setAlerts(prev => prev.filter(a => a.alertId !== alertId))
      return
    }
    try {
      await aiopsApi.acknowledgeAlert(alertId, 'Acknowledged via UI')
      setAlerts(prev => prev.filter(a => a.alertId !== alertId))
    } catch { /**/ }
  }, [demoMode])

  const handleTriggerRca = async () => {
    setTriggeringRca(true)
    try { await aiopsApi.triggerRca() } finally { setTriggeringRca(false); loadData() }
  }

  const activeAlerts = displayAlerts.filter(a => a.state === 'ALARM' || a.severity === 'critical')
  const TAB_ITEMS: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'alerts',    label: 'Live Alerts',     icon: <AlertTriangle size={13} />, count: activeAlerts.length },
    { id: 'pipelines', label: 'Agent Pipelines', icon: <Workflow size={13} />,      count: displayPipelines.length },
    { id: 'rca',       label: 'RCA Insights',    icon: <Brain size={13} /> },
    { id: 'sop',       label: 'SOP',             icon: <FileText size={13} /> },
    { id: 'gateway',   label: 'AI Gateway',      icon: <Zap size={13} /> },
  ]

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="section-label" style={{ marginBottom: 4 }}>Operations</div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 800,
            display: 'flex', alignItems: 'center', gap: 10 }}>
            <Brain size={22} color="var(--color-primary)" /> AI Ops
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <LiveIndicator connected={!demoMode && (kpis.liveConnected || liveMode)} />
          <button className="ov-btn ov-btn-ghost"
            onClick={() => { setDemoMode(v => !v); setDemoBannerDismissed(false) }}
            style={{ gap: 5, fontSize: 12,
              borderColor: demoMode ? '#f59e0b' : undefined,
              color: demoMode ? '#f59e0b' : undefined }}>
            <FlaskConical size={12} /> {demoMode ? 'Exit Demo' : 'Demo Mode'}
          </button>
          <button className="ov-btn ov-btn-ghost"
            onClick={() => { setLiveMode(v => !v); if (!liveMode) connectWs() }}
            style={{ gap: 5, fontSize: 12 }}>
            <Radio size={12} /> {liveMode ? 'Pause' : 'Resume Live'}
          </button>
          <button className="ov-btn ov-btn-ghost" onClick={loadData} style={{ gap: 5, fontSize: 12 }}>
            <RefreshCw size={12} /> Refresh
          </button>
          <motion.button className="ov-btn ov-btn-primary" onClick={handleTriggerRca}
            disabled={triggeringRca} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            style={{ gap: 6, fontSize: 12 }}>
            <Zap size={12} />{triggeringRca ? 'Running RCA...' : 'Trigger RCA'}
          </motion.button>
        </div>
      </div>

      {/* Demo Mode banner */}
      {demoMode && !demoBannerDismissed && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)',
          borderRadius: 8 }}>
          <FlaskConical size={14} color="#f59e0b" />
          <span style={{ flex: 1, fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>
            Demo Mode — Displaying sample data. Live WebSocket feed is paused.
          </span>
          <button onClick={() => setDemoBannerDismissed(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
              color: '#f59e0b', padding: '0 4px', display: 'flex' }}>
            <X size={13} />
          </button>
        </div>
      )}

      {/* KPI cards — 6 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12 }}>
        {[
          { label: 'Active Alarms',  value: displayKpis.activeAlarms,  icon: <AlertTriangle size={16} />, color: displayKpis.activeAlarms > 0 ? '#ef4444' : '#10b981' },
          { label: 'Total Alerts',   value: displayKpis.totalAlerts,   icon: <Activity size={16} />,      color: '#4f8ef7' },
          { label: 'Agent Runs',     value: displayKpis.agentRuns,     icon: <Workflow size={16} />,      color: '#8b5cf6' },
          { label: 'Data Sources',   value: dataSourceCount,           icon: <Database size={16} />,      color: '#10b981' },
          { label: 'MTTR',           value: `${mttr}m`,                icon: <Clock size={16} />,         color: '#f59e0b' },
          { label: 'MTTD',           value: `${mttd}m`,                icon: <TrendingUp size={16} />,    color: '#06b6d4' },
        ].map(kpi => (
          <motion.div key={kpi.label} className="ov-card" style={{ padding: '14px 18px' }}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ color: kpi.color, marginBottom: 8 }}>{kpi.icon}</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: 26,
              color: kpi.color }}>{loading && !demoMode ? '…' : kpi.value}</div>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>{kpi.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Main content grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr minmax(260px, 320px)', gap: 16, flex: 1, minHeight: 0 }}>
        {/* Left — tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border)' }}>
            {TAB_ITEMS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer',
                  padding: '8px 14px', fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
                  color: tab === t.id ? 'var(--color-primary)' : 'var(--color-subtext)',
                  borderBottom: `2px solid ${tab === t.id ? 'var(--color-primary)' : 'transparent'}`,
                  display: 'flex', alignItems: 'center', gap: 6, marginBottom: -1 }}>
                {t.icon}{t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                    background: 'var(--color-primary)', color: '#fff' }}>{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Alerts tab */}
          {tab === 'alerts' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {/* View switcher */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                <div style={{ display: 'flex', background: 'var(--color-card)',
                  borderRadius: 8, padding: 3, border: '1px solid var(--color-border)', gap: 2 }}>
                  {(['list', 'cluster', 'timeline'] as AlertView[]).map(v => (
                    <button key={v} onClick={() => setAlertView(v)}
                      style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: alertView === v ? 'var(--color-primary)' : 'transparent',
                        color: alertView === v ? '#fff' : 'var(--color-muted)',
                        border: 'none', cursor: 'pointer', textTransform: 'capitalize',
                        transition: 'all 0.15s' }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {loading && !demoMode ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>
                    Loading live alerts...
                  </div>
                ) : displayAlerts.length === 0 ? (
                  <motion.div className="ov-card" style={{ padding: 40, textAlign: 'center' }}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <CheckCircle size={36} color="#10b981" style={{ marginBottom: 10, opacity: 0.7 }} />
                    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15,
                      color: 'var(--color-text)', marginBottom: 6 }}>All systems nominal</div>
                    <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                      No active alerts from CloudWatch or stored events
                    </div>
                  </motion.div>
                ) : alertView === 'list' ? (
                  displayAlerts.map((alert, i) => (
                    <AlertRow key={alert.alertId ?? i} alert={alert} onAck={handleAck} />
                  ))
                ) : alertView === 'cluster' ? (
                  <AlertClusterView alerts={displayAlerts} onAck={handleAck} />
                ) : (
                  <motion.div className="ov-card" style={{ padding: 16 }}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <IncidentTimeline alerts={displayAlerts} />
                  </motion.div>
                )}
              </div>
            </div>
          )}

          {/* Pipelines tab */}
          {tab === 'pipelines' && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <motion.div className="ov-card" style={{ padding: 16 }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="section-label" style={{ marginBottom: 12 }}>
                  Recent Agent Runs ({displayPipelines.length})
                </div>
                <PipelineList pipelines={displayPipelines} />
              </motion.div>
            </div>
          )}

          {/* RCA tab */}
          {tab === 'rca' && (
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <motion.div className="ov-card" style={{ padding: 18 }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="section-label" style={{ marginBottom: 6 }}>Root Cause Analysis — Agent Flow</div>
                <div style={{ fontSize: 12, color: 'var(--color-subtext)', marginBottom: 4 }}>
                  Trigger the 3-stage AI pipeline to correlate live alerts, source code, and service dependencies.
                </div>
                <RcaFlowDiagram running={triggeringRca} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                  {[
                    { label: 'AIOpsAgent', desc: 'Fetches live CloudWatch alarms and correlates with service graph', color: '#4f8ef7' },
                    { label: 'RCAAgent', desc: 'Generates root cause report using Bedrock Claude — links alert → code → dependency', color: '#8b5cf6' },
                    { label: 'KnowledgeGraphAgent', desc: 'Stores RCA findings as triples in Neptune for future correlation', color: '#10b981' },
                  ].map((s, i) => (
                    <div key={s.label} style={{ display: 'flex', gap: 10, padding: '8px 12px',
                      background: `${s.color}0e`, border: `1px solid ${s.color}33`, borderRadius: 8 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        background: `${s.color}22`, border: `2px solid ${s.color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 800, color: s.color }}>
                        {i + 1}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-subtext)', marginTop: 1 }}>{s.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <motion.button className="ov-btn ov-btn-primary" onClick={handleTriggerRca}
                  disabled={triggeringRca}
                  style={{ marginTop: 16, width: '100%', justifyContent: 'center', gap: 6 }}
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                  <Zap size={13} />{triggeringRca ? 'Running analysis...' : 'Run Full RCA Pipeline'}
                </motion.button>
              </motion.div>
            </div>
          )}

          {/* SOP tab */}
          {tab === 'sop' && (
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <SOPTab
                projectId="aiops-global"
                stage="aiops"
                projectName="AIOps — Global Incident SOP"
              />
            </div>
          )}

          {/* AI Gateway tab */}
          {tab === 'gateway' && (
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <GatewayTab />
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Alert trend */}
          <motion.div className="ov-card" style={{ padding: 16 }}
            initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
            <div className="section-label" style={{ marginBottom: 10 }}>Alert Trend</div>
            {displayTrend.length > 1 ? (
              <AlertTrendChart history={displayTrend} />
            ) : (
              <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: 'var(--color-muted)' }}>
                Trend builds as live data arrives
              </div>
            )}
          </motion.div>

          {/* Severity distribution */}
          <motion.div className="ov-card" style={{ padding: 16 }}
            initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <div className="section-label" style={{ marginBottom: 10 }}>Severity Distribution</div>
            {severityDist.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <PieChart width={90} height={90}>
                  <Pie data={severityDist} cx={40} cy={40} innerRadius={22} outerRadius={40}
                    dataKey="value" strokeWidth={0}>
                    {severityDist.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                </PieChart>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {severityDist.map(s => (
                    <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, color: 'var(--color-subtext)', textTransform: 'capitalize' }}>{s.name}</span>
                      <span style={{ fontWeight: 700, color: s.color }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--color-muted)', textAlign: 'center', padding: 20 }}>
                No alerts to chart
              </div>
            )}
          </motion.div>

          {/* Source correlation */}
          <motion.div className="ov-card" style={{ padding: 16, flex: 1 }}
            initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
            <div className="section-label" style={{ marginBottom: 10 }}>Source Correlation</div>
            <CorrelationPanel alerts={displayAlerts} />
          </motion.div>
        </div>
      </div>
    </div>
  )
}
