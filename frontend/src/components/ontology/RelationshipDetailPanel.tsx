import type { OntologyLink, OntologyNode } from '../../types/ontology'
import { useGraphTheme } from '../../hooks/useGraphTheme'

// Inline color helper (matches OntologyGraph palette)
const NODE_TYPE_COLORS: Record<string, string> = {
  organization: '#60a5fa', project: '#f59e0b', service: '#10b981',
  repository: '#a78bfa', infrastructure: '#06b6d4', database: '#9c27b0',
  team: '#ec4899', securityfinding: '#ef4444', incident: '#f97316',
  auditlog: '#6b7280', cloud_provider: '#4285f4', container: '#10b981',
  location: '#8bc34a', ai_service: '#ff6b9d', api_service: '#ffc107',
  application: '#00bcd4', network_service: '#009688', security: '#f44336',
  legacy_process: '#795548', batch_process: '#607d8b', domain: '#3f51b5',
  category: '#5a7aaa', component: '#6a8fca', database_host: '#9c27b0',
  database_object: '#673ab7',
}

function getNodeColor(node: OntologyNode | null): string {
  if (!node) return '#6b7280'
  const key = (node.node_type || '').toLowerCase()
  return NODE_TYPE_COLORS[key] ?? node.color ?? '#6b7280'
}

function resolveId(endpoint: string | OntologyNode): string {
  return typeof endpoint === 'string' ? endpoint : endpoint?.id ?? ''
}

interface Props {
  link: OntologyLink | null
  allNodes: OntologyNode[]
  onClose: () => void
  onGoToSource: (node: OntologyNode) => void
  onGoToTarget: (node: OntologyNode) => void
}

function NodeCard({ node, label }: { node: OntologyNode | null; label: string }) {
  const color = getNodeColor(node)
  const nodeType = (node?.node_type || '').toLowerCase()

  return (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: color + 'aa' }}>
        {label}
      </p>
      <div
        className="rounded-xl p-3 border"
        style={{
          background: `linear-gradient(135deg, ${color}12, ${color}06)`,
          borderColor: color + '30',
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0 ring-2"
            style={{ background: color, boxShadow: `0 0 8px ${color}88`, ringColor: color + '44' }}
          />
          <span className="text-xs font-bold text-white truncate">{node?.label ?? '—'}</span>
        </div>
        <span
          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold"
          style={{ background: color + '22', color: color, border: `1px solid ${color}44` }}
        >
          {nodeType || 'unknown'}
        </span>
        {node?.description && (
          <p className="mt-2 text-[10px] text-slate-400 leading-relaxed line-clamp-2">
            {node.description}
          </p>
        )}
      </div>
    </div>
  )
}

export default function RelationshipDetailPanel({
  link, allNodes, onClose, onGoToSource, onGoToTarget,
}: Props) {
  const gt = useGraphTheme()
  if (!link) return null

  const srcId = resolveId(link.source)
  const tgtId = resolveId(link.target)
  const sourceNode = allNodes.find(n => n.id === srcId) ?? null
  const targetNode = allNodes.find(n => n.id === tgtId) ?? null
  const relType    = link.type || link.relationship || 'RELATES_TO'
  const relColor   = getNodeColor(sourceNode)

  const props = Object.entries(link as any).filter(([k]) =>
    !['source','target','type','relationship','__indexColor','index','x','y'].includes(k) &&
    typeof (link as any)[k] !== 'object'
  )

  return (
    <div
      className="absolute top-0 right-0 h-full flex flex-col z-20 overflow-hidden"
      style={{
        width: 380,
        background: gt.panelBg,
        borderLeft: `1px solid ${gt.panelBorder}`,
        backdropFilter: 'blur(12px)',
        transition: 'background 0.3s, border-color 0.3s',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 flex-shrink-0"
        style={{ borderBottom: `1px solid ${gt.panelBorder}` }}
      >
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs transition-colors"
          style={{ color: gt.panelSubtext }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: gt.sectionLabel }}>
          Relationship Detail
        </span>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-lg transition-all"
          style={{ color: gt.panelSubtext }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Node flow diagram */}
        <div className="flex items-center gap-2">
          <NodeCard node={sourceNode} label="Source" />

          <div className="flex flex-col items-center gap-1 flex-shrink-0 px-1">
            <div className="w-px h-3" style={{ background: relColor + '44' }} />
            <div
              className="px-2 py-1 rounded-full text-[9px] font-bold whitespace-nowrap"
              style={{
                background: relColor + '18',
                border: `1px solid ${relColor}44`,
                color: relColor,
              }}
            >
              {relType}
            </div>
            <svg className="w-3 h-3" fill={relColor + 'cc'} viewBox="0 0 24 24">
              <path d="M12 4l8 8-8 8V4z" />
            </svg>
            <div className="w-px h-1" style={{ background: relColor + '44' }} />
          </div>

          <NodeCard node={targetNode} label="Target" />
        </div>

        {/* Properties */}
        {props.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
              Properties
            </p>
            <div
              className="rounded-xl divide-y"
              style={{
                background: gt.panelCard,
                border: `1px solid ${gt.panelCardBorder}`,
                divideColor: 'rgba(255,255,255,0.05)',
              }}
            >
              {props.map(([k, v]) => (
                <div key={k} className="flex justify-between items-center px-3 py-2 gap-2">
                  <span className="text-[10px] capitalize" style={{ color: gt.panelSubtext }}>{k.replace(/_/g, ' ')}</span>
                  <span className="text-[10px] font-medium truncate max-w-[55%] text-right" style={{ color: gt.panelText }}>
                    {String(v)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          {sourceNode && (
            <button
              onClick={() => onGoToSource(sourceNode)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, ${getNodeColor(sourceNode)}25, ${getNodeColor(sourceNode)}12)`,
                border: `1px solid ${getNodeColor(sourceNode)}40`,
                color: getNodeColor(sourceNode),
              }}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Focus Source
            </button>
          )}
          {targetNode && (
            <button
              onClick={() => onGoToTarget(targetNode)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, ${getNodeColor(targetNode)}25, ${getNodeColor(targetNode)}12)`,
                border: `1px solid ${getNodeColor(targetNode)}40`,
                color: getNodeColor(targetNode),
              }}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l4.553 2.069A1 1 0 0015 15.18V8.82a1 1 0 00-1.447-.894L9 10M19 6H11a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V8a2 2 0 00-2-2z" />
              </svg>
              Focus Target
            </button>
          )}
        </div>

        {/* Meta */}
        <div className="pt-1">
          <div
            className="rounded-xl px-4 py-3"
            style={{ background: gt.panelCard, border: `1px solid ${gt.panelCardBorder}` }}
          >
            <p className="text-[10px] leading-relaxed" style={{ color: gt.panelSubtext }}>
              Relationship type&nbsp;
              <span style={{ color: relColor }} className="font-semibold">{relType}</span>
              &nbsp;connects&nbsp;
              <span className="text-white font-medium">{sourceNode?.label ?? srcId}</span>
              &nbsp;to&nbsp;
              <span className="text-white font-medium">{targetNode?.label ?? tgtId}</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
