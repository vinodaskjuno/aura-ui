import React, { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Terminal, X, Trash2, RefreshCw, Filter, Download } from 'lucide-react'
import { logsApi } from '../api/logs'

interface LogEntry {
  timestamp: number
  time: string
  level: string
  logger: string
  message: string
}

interface LogStats {
  total_entries: number
  by_level: Record<string, number>
  buffer_size: number
  oldest_timestamp: number | null
  newest_timestamp: number | null
}

const LEVEL_COLORS: Record<string, string> = {
  DEBUG: '#6b7280',
  INFO: '#3b82f6',
  WARNING: '#f59e0b',
  ERROR: '#ef4444',
  CRITICAL: '#dc2626',
}

const LEVEL_BG: Record<string, string> = {
  DEBUG: '#6b728022',
  INFO: '#3b82f622',
  WARNING: '#f59e0b22',
  ERROR: '#ef444422',
  CRITICAL: '#dc262622',
}

export default function LogsMonitor() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [stats, setStats] = useState<LogStats | null>(null)
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [isPolling, setIsPolling] = useState(true)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const lastTimestamp = useRef<number>(0)

  // Fetch initial logs
  useEffect(() => {
    fetchLogs()
    fetchStats()
  }, [selectedLevel])

  // Auto-refresh polling
  useEffect(() => {
    if (!isPolling) return

    const interval = setInterval(async () => {
      try {
        const data = await logsApi.streamLogs(lastTimestamp.current, selectedLevel || undefined)
        if (data.length > 0) {
          setLogs(prev => [...prev, ...data])
          lastTimestamp.current = data[data.length - 1].timestamp
        }
      } catch (error) {
        console.error('Failed to fetch logs:', error)
      }
    }, 2000) // Poll every 2 seconds

    return () => clearInterval(interval)
  }, [isPolling, selectedLevel])

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  async function fetchLogs() {
    try {
      const data = await logsApi.getRecentLogs(200, selectedLevel || undefined)
      setLogs(data)
      if (data.length > 0) {
        lastTimestamp.current = data[data.length - 1].timestamp
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    }
  }

  async function fetchStats() {
    try {
      const data = await logsApi.getStats()
      setStats(data)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  async function handleClear() {
    try {
      await logsApi.clearLogs()
      setLogs([])
      lastTimestamp.current = 0
      fetchStats()
    } catch (error) {
      console.error('Failed to clear logs:', error)
    }
  }

  function handleDownload() {
    const content = logs.map(log => 
      `[${log.time}] ${log.level.padEnd(8)} ${log.logger}: ${log.message}`
    ).join('\n')
    
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredLogs = logs

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'var(--color-bg)', 
      color: 'var(--color-text)', 
      padding: '24px 28px',
      fontFamily: 'var(--font-body)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <div style={{ 
          width: 44, 
          height: 44, 
          borderRadius: 11, 
          background: '#3b82f622', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#3b82f6'
        }}>
          <Terminal size={22} />
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
            Server <span style={{ color: 'var(--color-primary)' }}>Logs</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
            Real-time server logs monitor • {logs.length} entries
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Stats badges */}
          {stats && Object.entries(stats.by_level).map(([level, count]) => (
            <div key={level} style={{
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              background: LEVEL_BG[level],
              color: LEVEL_COLORS[level],
              border: `1px solid ${LEVEL_COLORS[level]}44`
            }}>
              {level}: {count}
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div style={{ 
        display: 'flex', 
        gap: 10, 
        marginBottom: 16, 
        padding: '12px 16px',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        alignItems: 'center'
      }}>
        {/* Level filter */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Filter size={14} style={{ color: 'var(--color-muted)' }} />
          <span style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 700 }}>FILTER:</span>
          {['ALL', 'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'].map(level => (
            <button
              key={level}
              onClick={() => {
                setSelectedLevel(level === 'ALL' ? null : level)
                setLogs([])
                lastTimestamp.current = 0
              }}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                background: selectedLevel === (level === 'ALL' ? null : level) 
                  ? (level === 'ALL' ? 'var(--color-primary)' : LEVEL_BG[level])
                  : 'transparent',
                color: selectedLevel === (level === 'ALL' ? null : level)
                  ? (level === 'ALL' ? '#fff' : LEVEL_COLORS[level])
                  : 'var(--color-muted)',
                border: `1px solid ${selectedLevel === (level === 'ALL' ? null : level) 
                  ? (level === 'ALL' ? 'var(--color-primary)' : LEVEL_COLORS[level])
                  : 'var(--color-border)'}`,
                transition: 'all 0.2s'
              }}
            >
              {level}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Auto-scroll toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--color-text)' }}>
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={e => setAutoScroll(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          Auto-scroll
        </label>

        {/* Polling toggle */}
        <button
          onClick={() => setIsPolling(!isPolling)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 7,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            background: isPolling ? 'var(--color-primary)' : 'transparent',
            color: isPolling ? '#fff' : 'var(--color-muted)',
            border: `1px solid ${isPolling ? 'var(--color-primary)' : 'var(--color-border)'}`,
            transition: 'all 0.2s'
          }}
        >
          <RefreshCw size={12} style={{ animation: isPolling ? 'spin 2s linear infinite' : 'none' }} />
          {isPolling ? 'Live' : 'Paused'}
        </button>

        {/* Download */}
        <button
          onClick={handleDownload}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 7,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            background: 'transparent',
            color: 'var(--color-primary)',
            border: '1px solid var(--color-border)',
            transition: 'all 0.2s'
          }}
        >
          <Download size={12} />
          Export
        </button>

        {/* Clear */}
        <button
          onClick={handleClear}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 7,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            background: 'transparent',
            color: 'var(--color-danger)',
            border: '1px solid var(--color-border)',
            transition: 'all 0.2s'
          }}
        >
          <Trash2 size={12} />
          Clear
        </button>
      </div>

      {/* Logs container */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        maxHeight: 'calc(100vh - 240px)',
        overflowY: 'auto',
        fontFamily: 'Consolas, Monaco, monospace',
        fontSize: 12
      }}>
        {filteredLogs.length === 0 ? (
          <div style={{ 
            padding: 40, 
            textAlign: 'center', 
            color: 'var(--color-muted)' 
          }}>
            No logs to display
          </div>
        ) : (
          <div style={{ padding: '8px 0' }}>
            {filteredLogs.map((log, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: '6px 16px',
                  borderLeft: `3px solid ${LEVEL_COLORS[log.level] || '#6b7280'}`,
                  background: idx % 2 === 0 ? 'transparent' : 'var(--color-bg)',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-card)')}
                onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'var(--color-bg)')}
              >
                <span style={{ color: 'var(--color-muted)', minWidth: 70 }}>{log.time}</span>
                <span style={{ 
                  color: LEVEL_COLORS[log.level] || '#6b7280',
                  fontWeight: 700,
                  minWidth: 80
                }}>
                  {log.level}
                </span>
                <span style={{ color: 'var(--color-subtext)', minWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {log.logger}
                </span>
                <span style={{ color: 'var(--color-text)', flex: 1 }}>{log.message}</span>
              </motion.div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
