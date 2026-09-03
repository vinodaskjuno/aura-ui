import { pipelineColor, pipelineMeta, relTime } from '../provenance/pipelineMeta'
import { useEffect, useState } from 'react'
import type { OntologyNode } from '../../types/ontology'
import { useGraphTheme } from '../../hooks/useGraphTheme'

interface Props {
  node: OntologyNode | null
  mouseX: number
  mouseY: number
  connectionCount?: number
}

export default function NodeTooltip({ node, mouseX, mouseY, connectionCount }: Props) {
  const gt = useGraphTheme()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (node) {
      setShow(false)
      const timer = setTimeout(() => setShow(true), 100)
      return () => clearTimeout(timer)
    } else {
      setShow(false)
    }
  }, [node])

  if (!node) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: `${mouseX + 15}px`,
        top: `${mouseY + 15}px`,
        pointerEvents: 'none',
        zIndex: 2000,
        background: gt.tooltipBg,
        backdropFilter: 'blur(12px)',
        border: `1px solid ${gt.tooltipBorder}`,
        borderRadius: '10px',
        padding: '12px 14px',
        maxWidth: '250px',
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0)' : 'translateY(4px)',
        transition: 'opacity 0.2s, transform 0.2s, background 0.3s, border-color 0.3s',
        boxShadow: gt.isDark
          ? '0 8px 24px rgba(0,0,0,0.5)'
          : '0 8px 24px rgba(0,0,0,0.12)',
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 700, color: gt.tooltipText, marginBottom: '4px' }}>
        {node.label}
      </div>
      <div style={{
        fontSize: '9px', color: gt.tooltipSubtext,
        textTransform: 'uppercase', letterSpacing: '1px',
      }}>
        {node.node_type}
      </div>
      {connectionCount !== undefined && connectionCount > 0 && (
        <div style={{ fontSize: '9px', color: gt.tooltipSubtext, marginTop: '4px' }}>
          {connectionCount} connection{connectionCount !== 1 ? 's' : ''}
        </div>
      )}

      {/* One dim line of provenance. Enough to notice a stale or unattributed node
          while hovering, without turning the tooltip into a second detail panel. */}
      {(() => {
        const props = node as unknown as Record<string, unknown>
        const pipeline = (props.pipeline as string) || ''
        const lastSeen = (props.lastSeenAt as string) || (props.updatedAt as string) || ''
        if (!pipeline && !lastSeen) return null
        const meta = pipelineMeta(pipeline)
        const Icon = meta.icon
        return (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5, marginTop: 6,
            paddingTop: 6, borderTop: `1px solid ${gt.tooltipBorder}`,
            fontSize: 9, color: gt.tooltipSubtext,
          }}>
            <Icon size={9} style={{ color: pipelineColor(pipeline, gt.isDark) }} />
            <span>{meta.label}</span>
            {lastSeen && (
              <>
                <span style={{ opacity: .5 }}>·</span>
                <span>{relTime(lastSeen)}</span>
              </>
            )}
          </div>
        )
      })()}
    </div>
  )
}
