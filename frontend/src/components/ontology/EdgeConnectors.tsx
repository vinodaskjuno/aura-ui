import React from 'react'

/**
 * Animated vertical connector: glowing dots flowing downward along a line.
 * Fixed height — uses SVG animateMotion, no DOM measurements needed.
 */
export function AnimatedVConnector({
  color = '#a78bfa',
  height = 40,
  dotCount = 3,
  duration = 1.0,
}: {
  color?: string
  height?: number
  dotCount?: number
  duration?: number
}) {
  const cx = 8
  const path = `M ${cx} 0 L ${cx} ${height}`
  const delays = Array.from({ length: dotCount }, (_, i) => -((duration / dotCount) * i))

  return (
    <div style={{ display: 'flex', justifyContent: 'center', height, flexShrink: 0 }}>
      <svg width="16" height={height} style={{ overflow: 'visible' }}>
        {/* Track line */}
        <line
          x1={cx} y1="0" x2={cx} y2={height}
          stroke={color} strokeWidth="1" strokeOpacity="0.18"
          strokeDasharray="3 4"
        />
        {delays.map((delay, i) => (
          <React.Fragment key={i}>
            {/* Glow halo */}
            <circle r="4" fill={color} fillOpacity="0.18">
              {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
              {/* @ts-ignore */}
              <animateMotion
                dur={`${duration}s`}
                repeatCount="indefinite"
                begin={`${delay}s`}
                path={path}
              />
            </circle>
            {/* Core dot */}
            <circle r="2.2" fill={color} style={{ filter: `drop-shadow(0 0 3px ${color})` }}>
              {/* @ts-ignore */}
              <animateMotion
                dur={`${duration}s`}
                repeatCount="indefinite"
                begin={`${delay}s`}
                path={path}
              />
            </circle>
          </React.Fragment>
        ))}
      </svg>
    </div>
  )
}

/**
 * Animated horizontal bus: a glowing sweep that moves left→right across any width.
 * Uses CSS animation so it adapts to the container width automatically.
 */
export function AnimatedHBus({
  color = '#10b981',
  sweepCount = 3,
}: {
  color?: string
  sweepCount?: number
}) {
  const sweeps = Array.from({ length: sweepCount }, (_, i) => i)

  return (
    <div style={{
      width: '100%', height: 12,
      display: 'flex', alignItems: 'center',
      position: 'relative',
      flexShrink: 0,
    }}>
      {/* Static track */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: '50%',
        height: 1, background: `${color}22`,
        transform: 'translateY(-50%)',
      }} />
      {/* Animated sweeps at different offsets */}
      {sweeps.map(i => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: '50%', transform: 'translateY(-50%)',
            width: '28%', height: 3,
            background: `linear-gradient(90deg, transparent 0%, ${color}cc 40%, ${color} 50%, ${color}cc 60%, transparent 100%)`,
            borderRadius: 2,
            animation: `ec-sweep-right ${2 + i * 0.3}s ease-in-out ${i * 0.65}s infinite`,
            filter: `drop-shadow(0 0 4px ${color})`,
          }}
        />
      ))}
    </div>
  )
}

/**
 * Animated zone-to-zone connector for DomainLayerView.
 * Shows direction flow (top zone → bottom zone) with multiple dots.
 */
export function AnimatedZoneConnector({
  fromColor = '#10b981',
  toColor = '#f59e0b',
  height = 28,
}: {
  fromColor?: string
  toColor?: string
  height?: number
}) {
  const path = `M 10 0 L 10 ${height}`

  return (
    <div style={{ display: 'flex', justifyContent: 'center', height, alignItems: 'center' }}>
      <svg width="20" height={height} style={{ overflow: 'visible' }}>
        {/* Track */}
        <line
          x1="10" y1="0" x2="10" y2={height}
          stroke={fromColor} strokeWidth="1.5" strokeOpacity="0.15"
        />
        {/* Arrow tip */}
        <polygon
          points={`7,${height - 5} 13,${height - 5} 10,${height}`}
          fill={toColor} fillOpacity="0.5"
        />
        {/* Moving dots */}
        {[0, 0.4, 0.8].map((delay, i) => (
          <React.Fragment key={i}>
            <circle r="3.5" fill={fromColor} fillOpacity="0.15">
              {/* @ts-ignore */}
              <animateMotion dur="0.9s" repeatCount="indefinite" begin={`-${delay}s`} path={path} />
            </circle>
            <circle r="1.8" fill={i === 0 ? fromColor : toColor}
              style={{ filter: `drop-shadow(0 0 3px ${i === 0 ? fromColor : toColor})` }}>
              {/* @ts-ignore */}
              <animateMotion dur="0.9s" repeatCount="indefinite" begin={`-${delay}s`} path={path} />
            </circle>
          </React.Fragment>
        ))}
      </svg>
    </div>
  )
}
