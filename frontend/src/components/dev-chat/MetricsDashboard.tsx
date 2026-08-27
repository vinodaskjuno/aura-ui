import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, TrendingDown, DollarSign, MessageSquare, Zap,
  Activity, Clock, BarChart3, PieChart, Calendar
} from 'lucide-react'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart as RePieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { getTokenMetrics, type MetricPeriod } from '../../api/metrics'
import { aiopsGatewayApi, type TimeseriesRow } from '../../api/aiopsGateway'

interface MetricsDashboardProps {
  onClose?: () => void
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4']

// MetricPeriod -> the period token the gateway usage endpoints accept.
const TIMESERIES_PERIOD: Record<MetricPeriod, string> = {
  today: 'today',
  week: '7d',
  month: '30d',
  all: '90d',
}

function formatDayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) { return iso }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/**
 * Percentage change between the first and second half of a series.
 * Returns undefined when there is not enough data to say anything — the card
 * then renders without a trend arrow rather than showing a made-up one.
 */
function trendPct(series: Array<Record<string, number>>, key: string): number | undefined {
  if (series.length < 4) { return undefined }
  const mid = Math.floor(series.length / 2)
  const sum = (rows: Array<Record<string, number>>) =>
    rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0)
  const prev = sum(series.slice(0, mid))
  const curr = sum(series.slice(mid))
  if (prev <= 0) { return undefined }
  return ((curr - prev) / prev) * 100
}

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null
  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.95)',
      border: '1px solid rgba(99, 102, 241, 0.3)',
      borderRadius: '8px',
      padding: '12px',
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: '#a5b4fc', marginBottom: '6px' }}>
        {label}
      </div>
      {payload.map((entry: any, idx: number) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: entry.color
          }} />
          <span style={{ fontSize: '11px', color: 'var(--color-subtext)' }}>{entry.name}:</span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text)' }}>
            {entry.name.includes('Cost') ? `$${entry.value.toFixed(4)}` : entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

// Animated metric card
interface MetricCardProps {
  title: string
  value: string | number
  change?: number
  icon: React.ReactNode
  color: string
  delay?: number
}

function AnimatedMetricCard({ title, value, change, icon, color, delay = 0 }: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      style={{
        background: 'var(--color-surface)',
        border: `1px solid ${color}33`,
        borderRadius: '14px',
        padding: '16px',
        position: 'relative',
        overflow: 'hidden',
      }}
      whileHover={{ 
        scale: 1.02,
        borderColor: `${color}88`,
        transition: { duration: 0.2 }
      }}
    >
      {/* Gradient accent */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '2px',
        background: `linear-gradient(90deg, ${color}, ${color}00)`
      }} />
      
      {/* Icon */}
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '10px',
        background: `${color}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '12px',
      }}>
        <div style={{ color }}>{icon}</div>
      </div>

      {/* Value */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: delay + 0.2 }}
        style={{
          fontSize: '26px',
          fontWeight: 800,
          color: 'var(--color-text)',
          lineHeight: 1,
          marginBottom: '6px',
        }}
      >
        {value}
      </motion.div>

      {/* Title */}
      <div style={{
        fontSize: '12px',
        color: 'var(--color-muted)',
        fontWeight: 600,
        marginBottom: '6px',
      }}>
        {title}
      </div>

      {/* Change indicator */}
      {change !== undefined && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '11px',
          fontWeight: 700,
          color: change >= 0 ? '#10b981' : '#ef4444',
        }}>
          {change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(change).toFixed(1)}% vs yesterday
        </div>
      )}

      {/* Pulse effect */}
      <motion.div
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.5, 0, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: color,
        }}
      />
    </motion.div>
  )
}

export default function MetricsDashboard({ onClose }: MetricsDashboardProps) {
  const [period, setPeriod] = useState<MetricPeriod>('week')
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [historicalData, setHistoricalData] = useState<any[]>([])

  useEffect(() => {
    loadMetrics()
  }, [period])

  async function loadMetrics() {
    setLoading(true)
    try {
      // The daily series comes from the gateway rollups, which are populated by
      // Claude Code's telemetry and by AURA's own agent usage. This panel used
      // to fill these charts with Math.random() values, so every token count and
      // dollar figure below the KPI row was invented.
      const [data, series] = await Promise.all([
        getTokenMetrics(period),
        aiopsGatewayApi
          .getTimeseries(TIMESERIES_PERIOD[period])
          .then(r => r.data.timeseries)
          .catch(() => [] as TimeseriesRow[]),
      ])
      setMetrics(data)
      setHistoricalData(
        series.map(row => ({
          name: formatDayLabel(row.date),
          date: row.date,
          tokens: row.totalTokens ?? 0,
          cost: row.costUsd ?? 0,
          input: row.inputTokens ?? 0,
          output: row.outputTokens ?? 0,
          cacheRead: row.cacheReadTokens ?? 0,
          cacheWrite: row.cacheCreationTokens ?? 0,
          calls: row.calls ?? 0,
        })),
      )
    } catch (err) {
      console.error('Failed to load metrics:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        flexDirection: 'column',
        gap: '16px',
      }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Activity size={32} style={{ color: '#6366f1' }} />
        </motion.div>
        <div style={{ fontSize: '14px', color: 'var(--color-muted)' }}>
          Loading metrics dashboard...
        </div>
      </div>
    )
  }

  if (!metrics) return null

  const totalTokens = metrics.totalInputTokens + metrics.totalOutputTokens
  const avgCostPerSession = metrics.totalSessions > 0 
    ? metrics.totalCost / metrics.totalSessions 
    : 0

  // Trends derived from the real series. undefined => no arrow is drawn.
  const tokenTrend = trendPct(historicalData, 'tokens')
  const costTrend = trendPct(historicalData, 'cost')
  const callTrend = trendPct(historicalData, 'calls')

  // Cache economics — only meaningful once cache tokens are being reported.
  const cacheRead = metrics.totalCacheReadTokens ?? 0
  const cacheWrite = metrics.totalCacheCreationTokens ?? 0
  const allTokens = metrics.totalTokens
    ?? (metrics.totalInputTokens + metrics.totalOutputTokens + cacheRead + cacheWrite)
  const cacheHitRate = metrics.cacheHitRate
    ?? (allTokens > 0 ? (cacheRead / allTokens) * 100 : 0)
  const topModel = (metrics.byModel ?? [])[0]
  const topModelShare = topModel && metrics.totalCost > 0
    ? (topModel.cost / metrics.totalCost) * 100
    : 0

  // Insights, all computed from the data actually fetched above.
  const insights: Array<{ title: string; detail: string; color: string }> = []

  if (allTokens > 0 && (cacheRead > 0 || cacheWrite > 0)) {
    const good = cacheHitRate >= 50
    insights.push({
      title: `${good ? '✓' : '⚠'} Cache hit rate: ${cacheHitRate.toFixed(0)}%`,
      detail: good
        ? `${cacheRead.toLocaleString()} tokens served from cache at ~10% of the input rate.`
        : 'A low hit rate usually means the prompt prefix is changing between calls, '
          + 'which forces a full re-read at the input rate.',
      color: good ? '#10b981' : '#f59e0b',
    })
  }

  if (costTrend !== undefined) {
    const up = costTrend > 0
    insights.push({
      title: `${up ? '⚠' : '✓'} Cost trend: ${up ? '+' : ''}${costTrend.toFixed(0)}%`,
      detail: `Second half of this period versus the first, across ${historicalData.length} days.`,
      color: up ? '#f59e0b' : '#10b981',
    })
  }

  if (topModel && topModelShare > 0) {
    insights.push({
      title: `ℹ ${topModel.model}: ${topModelShare.toFixed(0)}% of spend`,
      detail: `$${(topModel.cost ?? 0).toFixed(4)} across ${topModel.calls ?? 0} calls`
        + `${metrics.byModel.length > 1 ? ` of ${metrics.byModel.length} models used.` : '.'}`,
      color: '#6366f1',
    })
  }

  // Model breakdown for pie chart
  const modelData = metrics.byModel.map((m: any, idx: number) => ({
    name: m.model.split('.').pop()?.split('-').slice(0, 3).join('-') || m.model,
    value: m.inputTokens + m.outputTokens,
    cost: m.cost,
    color: COLORS[idx % COLORS.length],
  }))

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        padding: '0',
      }}
    >
      {/* Compact header with period selector */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
          }}>
            <BarChart3 size={20} style={{ color: '#fff' }} />
          </div>
          <div>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 800,
              color: 'var(--color-text)',
              margin: 0,
            }}>
              Usage Analytics
            </h2>
            <p style={{
              fontSize: '11px',
              color: 'var(--color-muted)',
              margin: '2px 0 0 0',
            }}>
              AI usage, costs, and performance trends
            </p>
          </div>
        </div>

        {/* Period selector */}
        <div style={{
          display: 'flex',
          gap: '6px',
          background: 'var(--color-surface)',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid var(--color-border)',
        }}>
          {(['today', 'week', 'month'] as MetricPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                background: period === p 
                  ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' 
                  : 'transparent',
                color: period === p ? '#fff' : 'var(--color-muted)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={11} />
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Key metrics cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px',
        marginBottom: '24px',
      }}>
        <AnimatedMetricCard
          title="Total Tokens"
          value={totalTokens.toLocaleString()}
          change={tokenTrend}
          icon={<Zap size={20} />}
          color="#6366f1"
          delay={0}
        />
        <AnimatedMetricCard
          title="Total Cost"
          value={`$${metrics.totalCost.toFixed(2)}`}
          change={costTrend}
          icon={<DollarSign size={20} />}
          color="#f59e0b"
          delay={0.1}
        />
        <AnimatedMetricCard
          title="Sessions"
          value={metrics.totalSessions}
          change={callTrend}
          icon={<MessageSquare size={20} />}
          color="#10b981"
          delay={0.2}
        />
        <AnimatedMetricCard
          title="Avg Cost/Session"
          value={`$${avgCostPerSession.toFixed(4)}`}
          icon={<Activity size={20} />}
          color="#ec4899"
          delay={0.3}
        />
      </div>

      {/* Charts grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '20px',
        marginBottom: '24px',
      }}>
        {/* Token usage over time - Area chart */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '16px',
            padding: '24px',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px',
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <TrendingUp size={18} style={{ color: '#6366f1' }} />
            </div>
            <div>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--color-text)',
                margin: 0,
              }}>
                Token Usage Trend
              </h3>
              <p style={{
                fontSize: '11px',
                color: 'var(--color-muted)',
                margin: '2px 0 0 0',
              }}>
                Input vs Output tokens over time
              </p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={historicalData}>
              <defs>
                <linearGradient id="colorInput" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorOutput" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis 
                dataKey="name" 
                stroke="var(--color-muted)" 
                style={{ fontSize: '11px' }}
              />
              <YAxis 
                stroke="var(--color-muted)" 
                style={{ fontSize: '11px' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: '12px' }}
              />
              <Area
                type="monotone"
                dataKey="input"
                name="Input Tokens"
                stroke="#6366f1"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorInput)"
              />
              <Area
                type="monotone"
                dataKey="output"
                name="Output Tokens"
                stroke="#8b5cf6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorOutput)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Cost over time - Line chart */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '16px',
            padding: '24px',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px',
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <DollarSign size={18} style={{ color: '#f59e0b' }} />
            </div>
            <div>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--color-text)',
                margin: 0,
              }}>
                Cost Analysis
              </h3>
              <p style={{
                fontSize: '11px',
                color: 'var(--color-muted)',
                margin: '2px 0 0 0',
              }}>
                Daily spending breakdown
              </p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis 
                dataKey="name" 
                stroke="var(--color-muted)" 
                style={{ fontSize: '11px' }}
              />
              <YAxis 
                stroke="var(--color-muted)" 
                style={{ fontSize: '11px' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line
                type="monotone"
                dataKey="cost"
                name="Cost (USD)"
                stroke="#f59e0b"
                strokeWidth={3}
                dot={{ fill: '#f59e0b', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Bottom row - Model distribution and bar chart */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '20px',
        marginBottom: '24px',
      }}>
        {/* Model distribution - Pie chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '16px',
            padding: '24px',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px',
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <PieChart size={18} style={{ color: '#10b981' }} />
            </div>
            <div>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--color-text)',
                margin: 0,
              }}>
                Usage by Model
              </h3>
              <p style={{
                fontSize: '11px',
                color: 'var(--color-muted)',
                margin: '2px 0 0 0',
              }}>
                Token distribution across models
              </p>
            </div>
          </div>4
          <ResponsiveContainer width="100%" height={280}>
            <RePieChart>
              <Pie
                data={modelData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${((entry.value / totalTokens) * 100).toFixed(1)}%`}
                outerRadius={90}
                fill="#8884d8"
                dataKey="value"
              >
                {modelData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </RePieChart>
          </ResponsiveContainer>

          {/* Model legend with costs */}
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {modelData.map((model: any, idx: number) => (
              <div key={idx} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.02)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '3px',
                    background: model.color,
                  }} />
                  <span style={{ fontSize: '12px', color: 'var(--color-text)' }}>
                    {model.name}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                    {model.value.toLocaleString()} tokens
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b' }}>
                    ${model.cost.toFixed(4)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Token comparison - Bar chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '16px',
            padding: '24px',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px',
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(236, 72, 153, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <BarChart3 size={18} style={{ color: '#ec4899' }} />
            </div>
            <div>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--color-text)',
                margin: 0,
              }}>
                Daily Token Volume
              </h3>
              <p style={{
                fontSize: '11px',
                color: 'var(--color-muted)',
                margin: '2px 0 0 0',
              }}>
                Total tokens processed per day
              </p>
            </div>
          </div>4
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={historicalData.slice(-7)}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis 
                dataKey="name" 
                stroke="var(--color-muted)" 
                style={{ fontSize: '11px' }}
              />
              <YAxis 
                stroke="var(--color-muted)" 
                style={{ fontSize: '11px' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar 
                dataKey="tokens" 
                name="Total Tokens"
                fill="#ec4899" 
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Additional insights section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.8 }}
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.08))',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: '12px',
          padding: '20px',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '14px',
        }}>
          <Activity size={18} style={{ color: '#6366f1' }} />
          <h3 style={{
            fontSize: '14px',
            fontWeight: 700,
            color: 'var(--color-text)',
            margin: 0,
          }}>
            Insights & Recommendations
          </h3>
        </div>
        {/*
          Every tile below is derived from the fetched data. These used to be
          hardcoded strings ("Efficiency Score: 87%", "Cost Trend: +8% this
          week", "Peak Usage: 2-4 PM") that never changed regardless of usage.
          When there is nothing real to say, we say that instead of inventing it.
        */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
        }}>
          {insights.length === 0 && (
            <div style={{ fontSize: '11px', color: 'var(--color-muted)', gridColumn: '1 / -1' }}>
              Not enough usage recorded yet to draw conclusions.
            </div>
          )}
          {insights.map((tile) => (
            <div key={tile.title} style={{
              padding: '16px',
              borderRadius: '10px',
              background: `${tile.color}1a`,
              border: `1px solid ${tile.color}33`,
            }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: tile.color, marginBottom: '6px' }}>
                {tile.title}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-subtext)' }}>
                {tile.detail}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
