import React, { useState } from 'react'
import { FlaskConical, RefreshCw, GitMerge, CheckCircle2, XCircle } from 'lucide-react'

export type TestTabType = 'unit' | 'regression' | 'integration'

export interface SubStop {
  index: number
  class_name: string
  file_path: string
  status: string        // 'pending' | 'running' | 'completed' | 'failed'
  tests_total: number
  tests_passed: number
  tests_failed: number
  is_current: boolean
}

interface SubTrackProps {
  activeTab: TestTabType
  onTabChange: (tab: TestTabType) => void
  stops: SubStop[]
  progressPercent: number
  sessionId?: string
  sublineColors?: Record<TestTabType, string>
}

function stopState(stop: SubStop): string {
  if (stop.is_current || stop.status === 'running') return 'live'
  if (stop.status === 'completed') return 'completed'
  if (stop.status === 'failed') return 'failed'
  return 'pending'
}

const TABS: { key: TestTabType; label: string; icon: React.ReactNode }[] = [
  { key: 'unit',        label: 'Unit Testing',           icon: <FlaskConical size={12} /> },
  { key: 'regression',  label: 'Regression',             icon: <RefreshCw size={12} /> },
  { key: 'integration', label: 'Integration (Playwright)', icon: <GitMerge size={12} /> },
]

const STOP_COLORS: Record<string, string> = {
  live:      '#00aaff',
  completed: '#00ff88',
  failed:    '#ff3333',
  pending:   '#1e3a5f',
}

const STOP_GLOW: Record<string, string> = {
  live:      '0 0 10px #00aaff',
  completed: '0 0 8px #00ff88',
  failed:    '0 0 8px #ff3333',
  pending:   'none',
}

const DEFAULT_COLORS: Record<TestTabType, string> = {
  unit: '#f59e0b', regression: '#3b82f6', integration: '#10b981',
}

export const SubTrack: React.FC<SubTrackProps> = ({
  activeTab, onTabChange, stops, progressPercent, sublineColors,
}) => {
  const lineColor = (sublineColors ?? DEFAULT_COLORS)[activeTab]
  const [hoveredStop, setHoveredStop] = useState<number | null>(null)

  return (
    <div className="subtrack-wrapper">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#5a7a9a', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Testing Sub-Line
        </span>
        <span style={{ fontSize: 11, color: '#00aaff' }}>
          {progressPercent.toFixed(0)}% complete
        </span>
      </div>

      {/* Tabs — each with its line color swatch */}
      <div className="subtrack-tabs">
        {TABS.map(tab => {
          const tColor = (sublineColors ?? DEFAULT_COLORS)[tab.key]
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 999, fontSize: 11,
                fontWeight: 700, cursor: 'pointer',
                background: isActive ? `${tColor}22` : 'transparent',
                border: `1.5px solid ${isActive ? tColor : 'var(--color-border)'}`,
                color: isActive ? tColor : 'var(--color-muted)',
                transition: 'all 0.2s',
              }}
            >
              {/* Color swatch line */}
              <div style={{ width: 14, height: 3, borderRadius: 2, background: tColor, opacity: isActive ? 1 : 0.4 }} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Progress bar */}
      <div className="transit-progress-bar" style={{ marginBottom: 20 }}>
        <div className="transit-progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>

      {/* Stops */}
      {stops.length === 0 ? (
        <div style={{ color: '#3a5a7a', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>
          Start a test run to see stops
        </div>
      ) : (
        <div className="subtrack-stops">
          {stops.map((stop, idx) => {
            const state = stopState(stop)
            const color = STOP_COLORS[state]
            const isHovered = hoveredStop === idx
            const connectorState = idx < stops.length - 1
              ? stopState(stops[idx])
              : null

            return (
              <React.Fragment key={stop.index}>
                {/* Stop node */}
                <div
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', minWidth: 80 }}
                  onMouseEnter={() => setHoveredStop(idx)}
                  onMouseLeave={() => setHoveredStop(null)}
                >
                  {/* Circle */}
                  <div style={{ position: 'relative', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {/* Pulse ring for live */}
                    {state === 'live' && (
                      <div style={{
                        position: 'absolute',
                        width: 28, height: 28,
                        borderRadius: '50%',
                        border: '2px solid #00aaff',
                        animation: 'pulse-ring 1.4s ease-out infinite',
                      }} />
                    )}
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%',
                      background: state === 'completed' ? lineColor
                                : state === 'live'      ? '#fff'
                                : state === 'failed'    ? '#ef4444'
                                : 'var(--color-surface)',
                      border: `2.5px solid ${state === 'pending' ? 'var(--color-border)' : state === 'failed' ? '#ef4444' : lineColor}`,
                      boxShadow: state !== 'pending' ? `0 0 8px ${lineColor}88` : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 900,
                      color: state === 'completed' ? '#fff' : state === 'live' ? lineColor : 'var(--color-muted)',
                      opacity: state === 'pending' ? 0.45 : 1,
                      transition: 'all 0.3s',
                    }}>
                      {state === 'completed' && <CheckCircle2 size={9} />}
                      {state === 'failed' && <XCircle size={9} />}
                    </div>
                  </div>

                  {/* Label */}
                  <div style={{
                    marginTop: 6,
                    fontSize: 10,
                    fontWeight: state === 'live' ? 700 : 500,
                    color: state === 'live' ? '#00aaff' : state === 'completed' ? '#00ff88' : state === 'failed' ? '#ff6666' : '#3a5a7a',
                    textAlign: 'center',
                    maxWidth: 80,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {stop.class_name}
                  </div>

                  {/* Live badge */}
                  {state === 'live' && (
                    <div style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 3, color: '#00aaff', marginTop: 2 }}>
                      <span className="blink-dot" style={{ width: 5, height: 5 }} />
                      LIVE
                    </div>
                  )}

                  {/* Tests count */}
                  {(state === 'completed' || state === 'failed') && (
                    <div style={{ fontSize: 9, color: state === 'completed' ? '#00aa55' : '#cc3333', marginTop: 2 }}>
                      {stop.tests_passed}/{stop.tests_total}
                    </div>
                  )}

                  {/* Hover tooltip */}
                  {isHovered && (
                    <div style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#0a1a30',
                      border: '1px solid #1e4a7a',
                      borderRadius: 6,
                      padding: '6px 10px',
                      fontSize: 10,
                      color: '#8ab0d0',
                      whiteSpace: 'nowrap',
                      zIndex: 10,
                      marginBottom: 6,
                      pointerEvents: 'none',
                    }}>
                      <div style={{ fontWeight: 700, color: '#c0d8f0', marginBottom: 2 }}>{stop.class_name}</div>
                      <div>{stop.file_path}</div>
                      <div>Passed: {stop.tests_passed} / {stop.tests_total}</div>
                    </div>
                  )}
                </div>

                {/* Metro-style connector line with active line color */}
                {idx < stops.length - 1 && (
                  <div style={{
                    flex: 1, height: 4, alignSelf: 'flex-start', marginTop: 12,
                    borderRadius: 2,
                    background: connectorState === 'completed' ? lineColor
                              : connectorState === 'active'    ? lineColor
                              : 'var(--color-border)',
                    opacity: connectorState === 'pending' ? 0.3 : 1,
                    boxShadow: connectorState !== 'pending' ? `0 0 6px ${lineColor}88` : 'none',
                    transition: 'background 0.4s',
                  }} />
                )}
              </React.Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}
