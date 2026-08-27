/**
 * Aura Professional Logo
 *
 * Visual concept: A knowledge graph sphere — nodes (entities) connected
 * by edges (relationships), arranged in a circular orbit, representing
 * multi-domain ontology interconnection.
 *
 * The leading "A" in the wordmark uses --color-primary so it
 * automatically shift across all 3 themes.
 */

interface LogoMarkProps {
  size?: number
  color?: string
  className?: string
}

/** Just the SVG icon mark — use anywhere (sidebar, topbar, favicon) */
export function LogoMark({ size = 32, color = 'currentColor', className = '' }: LogoMarkProps) {
  const s = size
  const cx = s / 2
  const cy = s / 2
  const r = s * 0.42          // orbit radius
  const nodeR = s * 0.072     // outer node radius
  const centerR = s * 0.1     // center node radius

  // 6 nodes evenly on the orbit + 1 center
  const angles = [270, 330, 30, 90, 150, 210] // degrees
  const nodes = angles.map(a => ({
    x: cx + r * Math.cos((a * Math.PI) / 180),
    y: cy + r * Math.sin((a * Math.PI) / 180),
  }))

  // Edges: center-to-all + some orbit connections (skip adjacent to avoid clutter)
  const orbitEdges: [number, number][] = [
    [0, 2], [0, 3], [1, 3], [1, 4], [2, 4], [2, 5], [3, 5],
  ]

  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Soft outer glow ring */}
      <circle
        cx={cx} cy={cy} r={s * 0.47}
        fill={color}
        opacity={0.06}
      />
      {/* Outer orbit circle (faint dashed) */}
      <circle
        cx={cx} cy={cy} r={r}
        stroke={color}
        strokeWidth={s * 0.018}
        strokeDasharray={`${s * 0.04} ${s * 0.06}`}
        opacity={0.2}
      />

      {/* Orbit-to-orbit edges */}
      {orbitEdges.map(([i, j], idx) => (
        <line
          key={`oe-${idx}`}
          x1={nodes[i].x} y1={nodes[i].y}
          x2={nodes[j].x} y2={nodes[j].y}
          stroke={color}
          strokeWidth={s * 0.022}
          strokeLinecap="round"
          opacity={0.22}
        />
      ))}

      {/* Center-to-orbit edges */}
      {nodes.map((n, i) => (
        <line
          key={`ce-${i}`}
          x1={cx} y1={cy}
          x2={n.x} y2={n.y}
          stroke={color}
          strokeWidth={s * 0.03}
          strokeLinecap="round"
          opacity={0.35}
        />
      ))}

      {/* Orbit nodes */}
      {nodes.map((n, i) => (
        <g key={`n-${i}`}>
          {/* Node glow */}
          <circle cx={n.x} cy={n.y} r={nodeR * 1.8} fill={color} opacity={0.1} />
          {/* Node fill */}
          <circle cx={n.x} cy={n.y} r={nodeR} fill={color} opacity={0.75 + (i % 2) * 0.15} />
        </g>
      ))}

      {/* Center node (brightest) */}
      <circle cx={cx} cy={cy} r={centerR * 1.6} fill={color} opacity={0.15} />
      <circle cx={cx} cy={cy} r={centerR} fill={color} opacity={1} />

      {/* Small highlight dot on center */}
      <circle
        cx={cx - centerR * 0.3}
        cy={cy - centerR * 0.3}
        r={centerR * 0.28}
        fill="white"
        opacity={0.5}
      />
    </svg>
  )
}

interface LogoWordmarkProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showTagline?: boolean
  vertical?: boolean
}

const SIZE_MAP = {
  sm: { icon: 22, title: 13, tagline: 8 },
  md: { icon: 28, title: 15, tagline: 9 },
  lg: { icon: 36, title: 20, tagline: 10 },
  xl: { icon: 52, title: 28, tagline: 12 },
}

/**
 * Full wordmark: [icon] Aura
 * The "A" inherits `--color-primary` so it auto-adapts per theme.
 */
export function LogoWordmark({ size = 'md', showTagline = false, vertical = false }: LogoWordmarkProps) {
  const dims = SIZE_MAP[size]

  return (
    <div style={{
      display: 'flex',
      flexDirection: vertical ? 'column' : 'row',
      alignItems: 'center',
      gap: vertical ? dims.icon * 0.3 : dims.icon * 0.35,
    }}>
      <LogoMark size={dims.icon} color="var(--color-primary)" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {/* Wordmark with colored O and V */}
        <span style={{
          fontFamily: 'var(--font-heading)',
          fontWeight: 900,
          fontSize: dims.title,
          letterSpacing: '-0.03em',
          lineHeight: 1,
          color: 'var(--color-text)',
          userSelect: 'none',
        }}>
          {/* Leading "A" takes the theme accent; the remaining letters take
              the foreground colour. Same split the VS Code plugin header uses,
              so both surfaces render the wordmark identically. */}
          <span style={{ color: 'var(--color-primary)' }}>A</span>
          <span style={{ color: 'var(--color-text)' }}>ura</span>
        </span>

        {showTagline && (
          <span style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            fontSize: dims.tagline,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--color-primary)',
            lineHeight: 1,
          }}>
            AI Dev Agent Platform
          </span>
        )}
      </div>
    </div>
  )
}

/** Compact square badge used in sidebar / topbar */
export function LogoBadge({ size = 32 }: { size?: number }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: size * 0.25,
      background: 'var(--color-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 0 16px rgba(var(--logo-glow-rgb, 232,76,14), 0.35)',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      <LogoMark size={size * 0.72} color="#ffffff" />
    </div>
  )
}
