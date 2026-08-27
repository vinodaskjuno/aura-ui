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

interface MetricsDashboardProps {
  onClose?: () => void
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4']

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
      const data = await getTokenMetrics(period)
      setMetrics(data)
      
      // Generate historical data for charts (mock data for demonstration)
      // In production, you'd fetch this from your backend
      const days = period === 'today' ? 24 : period === 'week' ? 7 : 30
      const historical = Array.from({ length: days }, (_, i) => {
        const date = new Date()
        if (period === 'today') {
          date.setHours(date.getHours() - (days - i - 1))
          return {
            name: `${date.getHours()}:00`,
            tokens: Math.floor(Math.random() * 50000 + 10000),
            cost: Math.random() * 0.5 + 0.1,
            input: Math.floor(Math.random() * 30000 + 5000),
            output: Math.floor(Math.random() * 20000 + 5000),
          }
        } else {
          date.setDate(date.getDate() - (days - i - 1))
          return {
            name: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            tokens: Math.floor(Math.random() * 200000 + 50000),
            cost: Math.random() * 5 + 1,
            input: Math.floor(Math.random() * 120000 + 30000),
            output: Math.floor(Math.random() * 80000 + 20000),
          }
        }
      })
      setHistoricalData(historical)
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
          change={15.3}
          icon={<Zap size={20} />}
          color="#6366f1"
          delay={0}
        />
        <AnimatedMetricCard
          title="Total Cost"
          value={`$${metrics.totalCost.toFixed(2)}`}
          change={-8.2}
          icon={<DollarSign size={20} />}
          color="#f59e0b"
          delay={0.1}
        />
        <AnimatedMetricCard
          title="Sessions"
          value={metrics.totalSessions}
          change={22.7}
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
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
        }}>
          <div style={{
            padding: '16px',
            borderRadius: '10px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#10b981', marginBottom: '6px' }}>
              ✓ Efficiency Score: 87%
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-subtext)' }}>
              Your input/output ratio is optimal. Continue using context-aware prompts.
            </div>
          </div>
          <div style={{
            padding: '14px',
            borderRadius: '10px',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#f59e0b', marginBottom: '6px' }}>
              ⚠ Cost Trend: +8% this week
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-subtext)' }}>
              Consider switching to more efficient models for routine tasks.
            </div>
          </div>
          <div style={{
            padding: '14px',
            borderRadius: '10px',
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#6366f1', marginBottom: '6px' }}>
              ℹ Peak Usage: 2-4 PM
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
              Higher token consumption during afternoon hours.
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
