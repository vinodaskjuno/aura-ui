import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RadialBarChart, RadialBar, ResponsiveContainer, Tooltip,
  Treemap, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, Cell, Legend
} from 'recharts'
import {
  Server, GitBranch, Database, Users, Shield, AlertTriangle,
  Network, Code2, Package, Star, Brain, Bot, Building2,
  FolderOpen, Bug, Cloud, Lock, Table, FileCode, Cpu, Globe,
  Activity, Layers, Box, Settings, Zap, Eye, Blocks
} from 'lucide-react'
import { LogoMark } from '../components/ui/Logo'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'
import {
  getDashboardSummary, getGraphHealth, getInfrastructureOverview,
  getSecurityPosture, getActivityFeed, getSystemHealth, getApplications, getDataLandscape
} from '../api/dashboard'
import { getUserMetrics, getTokenMetrics } from '../api/metrics'

// Theme colors for charts
const CHART_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#a78bfa']

// Node type → Lucide icon mapping
const NODE_ICON_MAP: Record<string, React.ComponentType<any>> = {
  Service: Server,
  Repository: GitBranch,
  Infrastructure: Network,
  Database: Database,
  Server: Cpu,
  VM: Box,
  Container: Package,
  CloudResource: Cloud,
  KubernetesCluster: Layers,
  Network: Globe,
  Team: Users,
  Organization: Building2,
  Project: FolderOpen,
  BusinessDomain: Globe,
  BusinessUnit: Building2,
  BusinessProcess: Activity,
  BusinessApplication: Layers,
  BusinessRule: Settings,
  Application: Globe,
  API: Code2,
  Module: Package,
  Feature: Star,
  Function: Zap,
  Class: Box,
  CodeFile: FileCode,
  SecurityFinding: Shield,
  Vulnerability: Bug,
  IAMRole: Lock,
  IAMPolicy: Lock,
  Incident: AlertTriangle,
  Alert: AlertTriangle,
  AIModel: Brain,
  MCPServer: Bot,
  AgentDefinition: Bot,
  Document: FileCode,
  WikiArticle: Eye,
  Table: Table,
  DataFlow: Activity,
  Dependency: Blocks,
  default: Globe,
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

// Animated Metric Card Component - Compact Version
function MetricCard({ title, value, symbol, color, delay = 0, loading }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      whileHover={{ scale: 1.03, boxShadow: `0 4px 16px ${color}22`, transition: { duration: 0.2 } }}
      style={{
        background: 'var(--color-surface)',
        border: `1px solid ${color}33`,
        borderRadius: '10px',
        padding: '12px',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '2px',
        background: `linear-gradient(90deg, ${color}, ${color}00)`
      }} />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <motion.div 
          animate={{
            rotate: [0, 5, 0, -5, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: `${color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            fontWeight: 900,
            color: color,
            flexShrink: 0,
          }}
        >
          {symbol}
        </motion.div>

        {loading ? (
          <div style={{ width: '50%', height: '24px', background: 'var(--color-border)', borderRadius: '4px', animation: 'pulse 1.5s infinite' }} />
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: delay + 0.15 }}
            style={{
              fontSize: '24px',
              fontWeight: 800,
              color: 'var(--color-text)',
              lineHeight: 1,
            }}
          >
            {value}
          </motion.div>
        )}
      </div>

      <div style={{
        fontSize: '11px',
        color: 'var(--color-muted)',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {title}
      </div>

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
          top: '20px',
          right: '20px',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: color,
        }}
      />
    </motion.div>
  )
}

export function DashboardPage() {
  const { username, role } = useAuthStore()
  const { theme } = useThemeStore()
  
  // State for all dashboard data
  const [summary, setSummary] = useState<any>(null)
  const [graphHealth, setGraphHealth] = useState<any>(null)
  const [infrastructure, setInfrastructure] = useState<any>(null)
  const [security, setSecurity] = useState<any>(null)
  const [activities, setActivities] = useState<any[]>([])
  const [systemHealth, setSystemHealth] = useState<any[]>([])
  const [applications, setApplications] = useState<any>(null)
  const [dataLandscape, setDataLandscape] = useState<any>(null)
  const [tokenMetrics, setTokenMetrics] = useState<any>(null)
  const [userMetrics, setUserMetrics] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchAllData = async () => {
    setRefreshing(true)
    try {
      const promises = [
        getDashboardSummary(),
        getGraphHealth(),
        getInfrastructureOverview(),
        getSecurityPosture(),
        getActivityFeed(15),
        getSystemHealth(),
        getApplications(),
        getDataLandscape(),
        getTokenMetrics('today'),
      ]
      
      // Add user metrics for admin users
      if (role === 'admin' || role === 'super_admin') {
        promises.push(getUserMetrics('today'))
      }
      
      const results = await Promise.all(promises)
      
      // Dashboard APIs return AxiosResponse with .data
      setSummary((results[0] as any).data)
      setGraphHealth((results[1] as any).data)
      setInfrastructure((results[2] as any).data)
      setSecurity((results[3] as any).data)
      setActivities((results[4] as any).data.activities || [])
      setSystemHealth((results[5] as any).data.healthItems || [])
      setApplications((results[6] as any).data)
      setDataLandscape((results[7] as any).data)
      
      // Metrics APIs return unwrapped data directly
      setTokenMetrics(results[8] as any)
      
      if (results[9]) {
        setUserMetrics(results[9] as any || [])
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchAllData()
  }, [])

  const displayName = username ? username.charAt(0).toUpperCase() + username.slice(1) : 'Admin'

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '32px',
        }}
      >
        <div>
          <h2 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '28px',
            fontWeight: 800,
            color: 'var(--color-text)',
            marginBottom: '6px',
          }}>
            {getGreeting()}, <span style={{ color: 'var(--color-primary)' }}>{displayName}</span>
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-subtext)' }}>
            Enterprise Knowledge Graph Dashboard · Real-time Insights
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.25)',
            borderRadius: '8px',
            padding: '8px 14px',
          }}>
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#22c55e',
                boxShadow: '0 0 8px #22c55e',
              }}
            />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#22c55e' }}>
              All Systems Operational
            </span>
          </div>
          
          <motion.button
            onClick={fetchAllData}
            whileTap={{ scale: 0.95 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <motion.div
              animate={refreshing ? { rotate: 360 } : {}}
              transition={{ duration: 0.7, repeat: refreshing ? Infinity : 0, ease: 'linear' }}
              style={{
                width: '14px',
                height: '14px',
                border: '2px solid var(--color-text)',
                borderTopColor: 'transparent',
                borderRadius: '50%',
              }}
            />
            Refresh
          </motion.button>
        </div>
      </motion.div>

      {/* Executive Summary Cards - Compact Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 1fr)',
        gap: '10px',
        marginBottom: '24px',
      }}>
        <MetricCard
          title="Total Entities"
          value={summary?.totalNodes?.toLocaleString() || '0'}
          symbol="◈"
          color="#6366f1"
          delay={0}
          loading={loading}
        />
        <MetricCard
          title="Relationships"
          value={summary?.totalRelationships?.toLocaleString() || '0'}
          symbol="⚡"
          color="#8b5cf6"
          delay={0.1}
          loading={loading}
        />
        <MetricCard
          title="Critical Vulnerabilities"
          value={summary?.criticalVulnerabilities || '0'}
          symbol="⚠"
          color={summary?.criticalVulnerabilities > 0 ? '#ef4444' : '#10b981'}
          delay={0.2}
          loading={loading}
        />
        <MetricCard
          title="Active Projects"
          value={summary?.activeProjects || '0'}
          symbol="▣"
          color="#10b981"
          delay={0.3}
          loading={loading}
        />
        <MetricCard
          title="Infrastructure"
          value={summary?.infrastructureResources?.toLocaleString() || '0'}
          symbol="☁"
          color="#06b6d4"
          delay={0.1}
          loading={loading}
        />
        <MetricCard
          title="API Endpoints"
          value={summary?.apiEndpoints || '0'}
          symbol="⚡"
          color="#f59e0b"
          delay={0.2}
          loading={loading}
        />
        <MetricCard
          title="Data Assets"
          value={summary?.dataAssets?.toLocaleString() || '0'}
          symbol="◉"
          color="#a78bfa"
          delay={0.3}
          loading={loading}
        />
        <MetricCard
          title="AI Agents"
          value={summary?.aiAgents || '0'}
          symbol="◎"
          color="#ec4899"
          delay={0.4}
          loading={loading}
        />
      </div>

      {/* Main Content Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px',
        marginBottom: '24px',
      }}>
        {/* Graph Health */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '14px',
            padding: '18px',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '14px',
          }}>
            <motion.div 
              animate={{
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
              }}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                fontWeight: 900,
                color: '#6366f1',
              }}
            >
              ◈
            </motion.div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                Graph Health
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--color-muted)', margin: '2px 0 0 0' }}>
                Knowledge graph status
              </p>
            </div>
          </div>

          {loading || !graphHealth ? (
            <div style={{ height: '320px', background: 'var(--color-bg)', borderRadius: '12px', animation: 'pulse 1.5s infinite' }} />
          ) : (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                marginBottom: '16px',
              }}>
                {[
                  { 
                    value: graphHealth.relationshipDensity, 
                    label: 'Avg Connections', 
                    color: '#6366f1',
                    gradient: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(99, 102, 241, 0.05))',
                    symbol: '⚡'
                  },
                  { 
                    value: graphHealth.orphanNodes, 
                    label: 'Orphan Nodes', 
                    color: '#f59e0b',
                    gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.05))',
                    symbol: '◉'
                  },
                  { 
                    value: graphHealth.sourceBreakdown?.length || 0, 
                    label: 'Data Sources', 
                    color: '#10b981',
                    gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.05))',
                    symbol: '◈'
                  }
                ].map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + idx * 0.08, duration: 0.3 }}
                    whileHover={{ 
                      scale: 1.03, 
                      y: -3,
                      boxShadow: `0 6px 20px ${item.color}30`,
                      transition: { duration: 0.2 }
                    }}
                    style={{ 
                      padding: '12px', 
                      background: item.gradient,
                      border: `1px solid ${item.color}28`,
                      borderRadius: '10px',
                      position: 'relative',
                      overflow: 'hidden',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      fontSize: '14px',
                      fontWeight: 900,
                      opacity: 0.5,
                      color: item.color,
                    }}>
                      {item.symbol}
                    </div>
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.6 + idx * 0.08, type: 'spring', stiffness: 250 }}
                      style={{ fontSize: '22px', fontWeight: 900, color: item.color, lineHeight: 1, marginBottom: '6px' }}
                    >
                      {item.value}
                    </motion.div>
                    <div style={{ fontSize: '9px', fontWeight: 600, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      {item.label}
                    </div>
                    <motion.div
                      animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.2, 0.4, 0.2],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                      style={{
                        position: 'absolute',
                        bottom: '-8px',
                        right: '-8px',
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: `radial-gradient(circle, ${item.color}44, transparent)`,
                      }}
                    />
                  </motion.div>
                ))}  
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                style={{
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.08))',
                  borderRadius: '12px',
                  padding: '16px',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  position: 'relative',
                  overflow: 'hidden',
                  minHeight: '380px',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '8px', textAlign: 'center' }}>
                  Node Distribution • Orbital View
                </div>

                {/* Circular Orbital Visualization */}
                <div style={{
                  position: 'relative',
                  width: '100%',
                  height: '330px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {/* Background radial glow */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(ellipse at center, color-mix(in srgb, var(--color-primary) 12%, transparent) 0%, transparent 65%)',
                    pointerEvents: 'none',
                  }} />

                  {/* Outer orbital ring */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
                    style={{
                      position: 'absolute',
                      width: '256px',
                      height: '256px',
                      borderRadius: '50%',
                      border: '1px dashed color-mix(in srgb, var(--color-primary) 40%, transparent)',
                      pointerEvents: 'none',
                    }}
                  />
                  {/* Inner orbital ring */}
                  <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 90, repeat: Infinity, ease: 'linear' }}
                    style={{
                      position: 'absolute',
                      width: '188px',
                      height: '188px',
                      borderRadius: '50%',
                      border: '1px dashed color-mix(in srgb, var(--color-primary) 28%, transparent)',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Connecting lines (drawn behind nodes) */}
                  {(graphHealth.nodeDistribution || []).slice(0, 8).map((_node: any, index: number) => {
                    const nodeCount = Math.min((graphHealth.nodeDistribution || []).length, 8)
                    const angle = (index * 360) / nodeCount - 90
                    return (
                      <div
                        key={`line-${index}`}
                        style={{
                          position: 'absolute',
                          width: '88px',
                          height: '1.5px',
                          background: 'linear-gradient(90deg, color-mix(in srgb, var(--color-primary) 80%, transparent), color-mix(in srgb, var(--color-primary) 10%, transparent))',
                          transformOrigin: 'left center',
                          transform: `rotate(${angle}deg)`,
                          left: 'calc(50%)',
                          top: 'calc(50% - 0.75px)',
                          pointerEvents: 'none',
                          zIndex: 2,
                        }}
                      />
                    )
                  })}

                  {/* Center Aura Logo */}
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.9, type: 'spring', stiffness: 150 }}
                    style={{
                      position: 'absolute',
                      width: '80px',
                      height: '80px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 70%, #000))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 0 6px color-mix(in srgb, var(--color-primary) 20%, transparent), 0 0 32px color-mix(in srgb, var(--color-primary) 60%, transparent), 0 0 64px color-mix(in srgb, var(--color-primary) 25%, transparent)',
                      zIndex: 10,
                    }}
                  >
                    <LogoMark size={50} color="white" />
                    <motion.div
                      animate={{ scale: [1, 1.45, 1], opacity: [0.55, 0, 0.55] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut' }}
                      style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, color-mix(in srgb, var(--color-primary) 70%, transparent), transparent)',
                        pointerEvents: 'none',
                      }}
                    />
                  </motion.div>

                  {/* Orbiting Nodes */}
                  {(graphHealth.nodeDistribution || []).slice(0, 8).map((node: any, index: number) => {
                    const nodeCount = Math.min((graphHealth.nodeDistribution || []).length, 8)
                    const angle = (index * 360) / nodeCount - 90
                    const radius = 118
                    const x = Math.cos((angle * Math.PI) / 180) * radius
                    const y = Math.sin((angle * Math.PI) / 180) * radius
                    const Icon = NODE_ICON_MAP[node.label] ?? NODE_ICON_MAP.default
                    const shortLabel = node.label
                      .replace(/([A-Z])/g, ' $1').trim()
                      .split(' ').slice(0, 2).join(' ')

                    return (
                      <motion.div
                        key={index}
                        initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
                        animate={{ scale: 1, x, y, opacity: 1 }}
                        transition={{ delay: 1 + index * 0.12, type: 'spring', stiffness: 100, damping: 15 }}
                        whileHover={{ scale: 1.18, zIndex: 20, transition: { duration: 0.18 } }}
                        style={{
                          position: 'absolute',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          cursor: 'pointer',
                          zIndex: 5,
                        }}
                      >
                        {/* Icon circle */}
                        <div style={{
                          width: '58px',
                          height: '58px',
                          borderRadius: '50%',
                          background: 'linear-gradient(145deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 60%, transparent))',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 0 0 3px color-mix(in srgb, var(--color-primary) 30%, transparent), 0 0 22px color-mix(in srgb, var(--color-primary) 70%, transparent), 0 0 44px color-mix(in srgb, var(--color-primary) 35%, transparent), inset 0 1px 0 rgba(255,255,255,0.3)',
                          position: 'relative',
                          overflow: 'hidden',
                          flexShrink: 0,
                        }}>
                          {/* Inner specular highlight */}
                          <div style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: '50%',
                            background: 'radial-gradient(circle at 33% 28%, rgba(255,255,255,0.38) 0%, transparent 55%)',
                            pointerEvents: 'none',
                          }} />
                          <Icon
                            size={22}
                            color="white"
                            strokeWidth={1.7}
                            style={{ position: 'relative', zIndex: 1, filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.5))' }}
                          />
                        </div>

                        {/* Label + count */}
                        <div style={{ marginTop: '6px', textAlign: 'center', lineHeight: 1.25, pointerEvents: 'none' }}>
                          <div style={{
                            fontSize: '7.5px',
                            fontWeight: 700,
                            color: 'var(--color-primary)',
                            letterSpacing: '0.02em',
                            textShadow: '0 0 10px color-mix(in srgb, var(--color-primary) 80%, transparent)',
                            maxWidth: '64px',
                            wordBreak: 'break-word',
                          }}>
                            {shortLabel}
                          </div>
                          <div style={{
                            fontSize: '12px',
                            fontWeight: 800,
                            color: 'rgba(255,255,255,0.95)',
                            marginTop: '1px',
                          }}>
                            {node.count}
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>

                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
                  style={{
                    position: 'absolute',
                    top: '-50%',
                    right: '-50%',
                    width: '200%',
                    height: '200%',
                    background: 'radial-gradient(circle, color-mix(in srgb, var(--color-primary) 5%, transparent) 0%, transparent 70%)',
                    pointerEvents: 'none',
                  }}
                />
              </motion.div>
            </>
          )}
        </motion.div>

        {/* Security Posture */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '14px',
            padding: '18px',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '14px',
          }}>
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
              }}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                fontWeight: 900,
                color: '#ef4444',
              }}
            >
              ⚠
            </motion.div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                Security Posture
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--color-muted)', margin: '2px 0 0 0' }}>
                Vulnerability tracking
              </p>
            </div>
          </div>

          {loading || !security ? (
            <div style={{ height: '200px', background: 'var(--color-bg)', borderRadius: '12px', animation: 'pulse 1.5s infinite' }} />
          ) : (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                marginBottom: '16px',
              }}>
                <div style={{ padding: '12px', background: 'var(--color-bg)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#ef4444' }}>
                    {security.openFindings || 0}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '4px' }}>
                    Open Findings
                  </div>
                </div>
                <div style={{ padding: '12px', background: 'var(--color-bg)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b' }}>
                    {security.attackPaths || 0}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '4px' }}>
                    Attack Paths
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(security.severityDistribution || []).map((item: any, idx: number) => {
                  const colors: Record<string, string> = {
                    critical: '#ef4444',
                    high: '#f59e0b',
                    medium: '#fbbf24',
                    low: '#10b981',
                  }
                  const color = colors[item.severity] || '#6b7280'
                  
                  return (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: 'var(--color-bg)',
                      borderRadius: '8px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: color,
                        }} />
                        <span style={{ fontSize: '13px', color: 'var(--color-text)', textTransform: 'capitalize' }}>
                          {item.severity}
                        </span>
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: 700, color }}>
                        {item.count}
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* System Health & Activity Feed */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '350px 1fr',
        gap: '16px',
        marginBottom: '20px',
      }}>
        {/* System Health */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7 }}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '14px',
            padding: '16px',
          }}
        >
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '12px' }}>
            System Health
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {systemHealth.map((item: any, idx: number) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + idx * 0.05 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: 'var(--color-bg)',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: item.color,
                    boxShadow: `0 0 8px ${item.color}`,
                  }} />
                  <span style={{ fontSize: '13px', color: 'var(--color-text)' }}>
                    {item.label}
                  </span>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: item.color }}>
                  {item.status}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Activity Feed */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7 }}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '14px',
            padding: '16px',
          }}
        >
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '12px' }}>
            Recent Activity
          </h3>
          
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: '280px',
            overflowY: 'auto',
          }}>
            <AnimatePresence>
              {activities.map((item: any, idx: number) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: 0.8 + idx * 0.05 }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px 0',
                    borderBottom: idx < activities.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: item.color,
                    marginTop: '6px',
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '13px',
                      color: 'var(--color-text)',
                      marginBottom: '2px',
                      wordWrap: 'break-word',
                    }}>
                      {item.text}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                      {item.time} · {item.actor}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Users Token Usage & Cost (Admin Only) */}
      {(role === 'admin' || role === 'super_admin') && userMetrics.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '16px',
            padding: '24px',
            marginTop: '24px',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                }}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(139, 92, 246, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  fontWeight: 900,
                  color: '#8b5cf6',
                }}
              >
                ◎
              </motion.div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                  Users Token Usage & Cost
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--color-muted)', margin: '2px 0 0 0' }}>
                  AI usage across all users (Today)
                </p>
              </div>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '8px',
            }}>
              <div style={{
                width: '14px',
                height: '14px',
                borderRadius: '3px',
                background: '#8b5cf6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                color: 'white',
                fontWeight: 900,
              }}>
                {userMetrics.length}
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#8b5cf6' }}>
                Active Users
              </span>
            </div>
          </div>

          {/* Summary Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            marginBottom: '24px',
          }}>
            {[
              {
                label: 'Total Tokens',
                value: userMetrics.reduce((sum, u) => sum + u.inputTokens + u.outputTokens, 0).toLocaleString(),
                color: '#06b6d4',
                gradient: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(6, 182, 212, 0.05))',
                symbol: '◈'
              },
              {
                label: 'Total Cost',
                value: `$${userMetrics.reduce((sum, u) => sum + u.cost, 0).toFixed(4)}`,
                color: '#f59e0b',
                gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.05))',
                symbol: '$'
              },
              {
                label: 'Total Sessions',
                value: userMetrics.reduce((sum, u) => sum + u.sessions, 0).toLocaleString(),
                color: '#10b981',
                gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.05))',
                symbol: '◉'
              }
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.0 + idx * 0.1 }}
                whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
                style={{
                  padding: '20px',
                  background: item.gradient,
                  border: `1px solid ${item.color}33`,
                  borderRadius: '12px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  fontSize: '24px',
                  fontWeight: 900,
                  opacity: 0.6,
                  color: item.color,
                }}>
                  {item.symbol}
                </div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  {item.label}
                </div>
                <div style={{ fontSize: '32px', fontWeight: 900, color: item.color, lineHeight: 1 }}>
                  {item.value}
                </div>
                <motion.div
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.2, 0.4, 0.2],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  style={{
                    position: 'absolute',
                    bottom: '-20px',
                    right: '-20px',
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: `radial-gradient(circle, ${item.color}44, transparent)`,
                  }}
                />
              </motion.div>
            ))}
          </div>

          {/* Top Users Table */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05), rgba(99, 102, 241, 0.05))',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid rgba(139, 92, 246, 0.2)',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '12px' }}>
              Top Users by Cost
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Table Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 120px 120px 100px 100px',
                gap: '12px',
                padding: '8px 12px',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--color-muted)',
                letterSpacing: '0.5px'
              }}>
                <span>User</span>
                <span style={{ textAlign: 'right' }}>Tokens</span>
                <span style={{ textAlign: 'right' }}>Cost</span>
                <span style={{ textAlign: 'right' }}>Sessions</span>
                <span style={{ textAlign: 'right' }}>Avg/Session</span>
              </div>
              
              {/* User Rows */}
              {userMetrics.slice(0, 10).map((user: any, idx: number) => (
                <motion.div
                  key={user.userId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.2 + idx * 0.05 }}
                  whileHover={{ 
                    backgroundColor: 'var(--color-bg)', 
                    scale: 1.01,
                    transition: { duration: 0.2 }
                  }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 120px 120px 100px 100px',
                    gap: '12px',
                    padding: '12px',
                    background: idx % 2 === 0 ? 'rgba(139, 92, 246, 0.03)' : 'transparent',
                    borderRadius: '8px',
                    fontSize: '13px',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${CHART_COLORS[idx % CHART_COLORS.length]}, ${CHART_COLORS[(idx + 1) % CHART_COLORS.length]})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'white',
                    }}>
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                      {user.username}
                    </span>
                  </div>
                  <span style={{ textAlign: 'right', color: 'var(--color-subtext)', fontFamily: 'monospace' }}>
                    {(user.inputTokens + user.outputTokens).toLocaleString()}
                  </span>
                  <span style={{ textAlign: 'right', color: '#f59e0b', fontWeight: 700, fontFamily: 'monospace' }}>
                    ${user.cost.toFixed(4)}
                  </span>
                  <span style={{ textAlign: 'right', color: 'var(--color-muted)', fontFamily: 'monospace' }}>
                    {user.sessions}
                  </span>
                  <span style={{ textAlign: 'right', color: 'var(--color-subtext)', fontSize: '12px', fontFamily: 'monospace' }}>
                    ${(user.cost / user.sessions).toFixed(4)}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default DashboardPage
