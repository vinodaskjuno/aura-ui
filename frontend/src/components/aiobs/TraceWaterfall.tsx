import { useState } from 'react'
import { ChevronRight, ChevronDown, AlertTriangle } from 'lucide-react'
import type { SpanRow } from '../../api/aiObservability'

const KIND_COLOR: Record<string, string> = {
  llm: '#8b5cf6', tool: '#f59e0b', retriever: '#06b6d4',
  chain: '#10b981', unknown: 'var(--color-muted)',
}

/**
 * Span tree as a waterfall. Bars are positioned against the trace's own wall
 * clock, so a child that starts late is visibly late rather than merely listed
 * after its sibling — which is the whole reason to draw this instead of a table.
 */
export default function TraceWaterfall({
  spans, selectedId, onSelect,
}: {
  spans: SpanRow[]
  selectedId: string
  onSelect: (span: SpanRow) => void
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  if (spans.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--color-subtext)' }}>No spans recorded.</div>
  }

  const times = spans.map(s => new Date(s.startTime).getTime()).filter(n => !Number.isNaN(n))
  const t0 = times.length ? Math.min(...times) : 0
  const totalMs = Math.max(
    1, ...spans.map(s => {
      const start = new Date(s.startTime).getTime()
      return Number.isNaN(start) ? 0 : start - t0 + (s.latencyMs || 0)
    }))

  const byParent = new Map<string, SpanRow[]>()
  const ids = new Set(spans.map(s => s.spanId))
  for (const s of spans) {
    // A span whose parent is not in this batch is treated as a root, otherwise a
    // trace split across exports would render as nothing at all.
    const key = s.parentSpanId && ids.has(s.parentSpanId) ? s.parentSpanId : '__root__'
    byParent.set(key, [...(byParent.get(key) ?? []), s])
  }

  const toggle = (id: string) => setCollapsed(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const render = (span: SpanRow, depth: number): React.ReactNode[] => {
    const children = byParent.get(span.spanId) ?? []
    const isCollapsed = collapsed.has(span.spanId)
    const start = new Date(span.startTime).getTime()
    const offsetPct = Number.isNaN(start) ? 0 : ((start - t0) / totalMs) * 100
    const widthPct = Math.max(0.6, ((span.latencyMs || 0) / totalMs) * 100)
    const selected = span.spanId === selectedId

    return [
      <div
        key={span.spanId}
        onClick={() => onSelect(span)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
          padding: '5px 8px', borderRadius: 6,
          background: selected ? 'rgba(79,70,229,0.14)' : 'transparent',
          borderLeft: `2px solid ${selected ? '#4f46e5' : 'transparent'}`,
        }}
      >
        <div style={{ width: 260, display: 'flex', alignItems: 'center', gap: 4,
          paddingLeft: depth * 14, minWidth: 0 }}>
          {children.length > 0 ? (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); toggle(span.spanId) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-muted)', display: 'flex', padding: 0 }}
            >
              {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            </button>
          ) : <span style={{ width: 12 }} />}
          <span style={{ width: 7, height: 7, borderRadius: 2, flexShrink: 0,
            background: KIND_COLOR[span.kind] ?? KIND_COLOR.unknown }} />
          <span style={{ fontSize: 12, color: 'var(--color-text)', overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {span.name}
          </span>
          {span.status === 'error' && <AlertTriangle size={11} style={{ color: '#ef4444', flexShrink: 0 }} />}
        </div>

        <div style={{ flex: 1, position: 'relative', height: 16, minWidth: 80 }}>
          <div style={{
            position: 'absolute', left: `${offsetPct}%`, width: `${widthPct}%`,
            top: 3, height: 10, borderRadius: 3,
            background: KIND_COLOR[span.kind] ?? KIND_COLOR.unknown,
            opacity: span.status === 'error' ? 0.45 : 0.85,
          }} />
        </div>

        <span style={{ width: 62, textAlign: 'right', fontSize: 11,
          color: 'var(--color-subtext)', fontFamily: 'var(--font-mono)' }}>
          {span.latencyMs}ms
        </span>
        <span style={{ width: 58, textAlign: 'right', fontSize: 11,
          color: span.totalTokens ? 'var(--color-subtext)' : 'var(--color-muted)',
          fontFamily: 'var(--font-mono)' }}>
          {span.totalTokens || '—'}
        </span>
        <span style={{ width: 72, textAlign: 'right', fontSize: 11,
          color: span.costUsd ? '#10b981' : 'var(--color-muted)',
          fontFamily: 'var(--font-mono)' }}>
          {span.costUsd ? `$${span.costUsd.toFixed(6)}` : '—'}
        </span>
      </div>,
      ...(isCollapsed ? [] : children.flatMap(child => render(child, depth + 1))),
    ]
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, padding: '0 8px 6px', fontSize: 10,
        color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
        <span style={{ width: 260 }}>Span</span>
        <span style={{ flex: 1 }}>Timeline</span>
        <span style={{ width: 62, textAlign: 'right' }}>Latency</span>
        <span style={{ width: 58, textAlign: 'right' }}>Tokens</span>
        <span style={{ width: 72, textAlign: 'right' }}>Cost</span>
      </div>
      {(byParent.get('__root__') ?? []).flatMap(root => render(root, 0))}
    </div>
  )
}
