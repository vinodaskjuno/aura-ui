import React, { useState, useEffect } from 'react'
import type { OntologyNode, OntologyLink } from '../../types/ontology'
import { useGraphTheme } from '../../hooks/useGraphTheme'
import { useOntologyStore } from '../../store/ontologyStore'
import LineageRibbon from '../provenance/LineageRibbon'
import TracePanel from '../provenance/TracePanel'
import { useTrace } from '../provenance/useTrace'

interface Props {
  node: OntologyNode | null
  allNodes: OntologyNode[]
  allLinks: OntologyLink[]
  onClose: () => void
  onTraverseProject?: (node: OntologyNode) => void
  /** Open one of the ontology lens's detail-only layouts (Domain / Structural). */
  onOpenLayout?: (layoutId: 'domain-layer' | 'structural') => void

  /** Lens-specific sections rendered above the generic properties. */
  lensSections?: React.ReactNode

  /** Open the ingestion run that wrote this node, in the Run Inspector. */
  onOpenRun?: (runId: string) => void

}

// `provenance` and `history` were two halves of one question — where did this
// come from, and what has happened to it since — and splitting them is why
// neither could answer it. They are now one tab.
type DetailTab = 'info' | 'trace'

const CODE_NODE_TYPES = new Set(['Function', 'Class', 'Module', 'CodeFile', 'Repository', 'API', 'Dependency'])

function buildCodeExplanation(node: OntologyNode, outgoing: OntologyLink[], incoming: OntologyLink[], allNodes: OntologyNode[]): string {
  const n = node as Record<string, unknown>
  const lang = (n.language as string) || ''
  const filePath = (n.filePath as string) || (n.file_path as string) || ''
  const confidence = n.confidence as number | undefined
  const discoveredBy = (n.discoveredBy as string) || 'system'
  const description = n.description as string | undefined

  const resolve = (l: OntologyLink, dir: 'source' | 'target') => {
    const id = typeof l[dir] === 'string' ? l[dir] as string : (l[dir] as OntologyNode).id
    return allNodes.find(x => x.id === id)
  }

  const callers = incoming.filter(l => l.type === 'CALLS').map(l => resolve(l, 'source')).filter(Boolean)
  const callees = outgoing.filter(l => l.type === 'CALLS').map(l => resolve(l, 'target')).filter(Boolean)
  const impls = outgoing.filter(l => l.type === 'IMPLEMENTS').map(l => resolve(l, 'target')).filter(Boolean)
  const dbs = outgoing.filter(l => ['ACCESSES', 'CONNECTS_TO', 'QUERIES'].includes(l.type)).map(l => resolve(l, 'target')).filter(Boolean)

  const typeStr = node.node_type === 'Function' ? `${lang ? lang + ' ' : ''}function` :
    node.node_type === 'Class' ? `${lang ? lang + ' ' : ''}class` :
    node.node_type === 'Module' ? 'module' :
    node.node_type === 'CodeFile' ? 'source file' : node.node_type.toLowerCase()

  const parts: string[] = []
  parts.push(`${node.label} is a ${typeStr}${filePath ? `, defined in ${filePath.split('/').slice(-2).join('/')}` : ''}.`)
  if (description) parts.push(description)
  if (callers.length) parts.push(`Called by: ${callers.slice(0, 3).map(x => x!.label).join(', ')}${callers.length > 3 ? ` +${callers.length - 3} more` : ''}.`)
  if (callees.length) parts.push(`Calls: ${callees.slice(0, 3).map(x => x!.label).join(', ')}${callees.length > 3 ? ` +${callees.length - 3} more` : ''}.`)
  if (impls.length) parts.push(`Implements: ${impls.map(x => x!.label).join(', ')}.`)
  if (dbs.length) parts.push(`Accesses: ${dbs.map(x => x!.label).join(', ')}.`)
  if (confidence !== undefined) parts.push(`Confidence: ${(confidence * 100).toFixed(0)}% — discovered by ${discoveredBy}.`)
  return parts.join(' ')
}

export default function OntologyDetailPanel({ node, allNodes, allLinks, onClose, onTraverseProject, onOpenLayout, lensSections, onOpenRun }: Props) {
  const gt = useGraphTheme()
  // Whether values may be shown is decided by the API (it redacts before/after
  // for non-maintainers) rather than re-derived here — one place to get right.
  const { setFocusedProjectNode } = useOntologyStore()
  const [activeTab, setActiveTab] = useState<DetailTab>('info')

  // Fetched as soon as a node is selected, not when a tab is opened: the lineage
  // ribbon is always visible, and the point of it is that nobody has to go looking.
  //
  // Both old fetches used raw `fetch` with a hand-built Authorization header, which
  // silently bypassed every interceptor in `api/client.ts`.
  const { data: trace, loading: traceLoading, error: traceError, reload } =
    useTrace('node', node?.id)

  // Reset tab when node changes
  useEffect(() => { setActiveTab('info') }, [node?.id])

  if (!node) return null

  const outgoing = allLinks.filter(l => {
    const sourceId = typeof l.source === 'string' ? l.source : l.source.id
    return sourceId === node.id
  })

  const incoming = allLinks.filter(l => {
    const targetId = typeof l.target === 'string' ? l.target : l.target.id
    return targetId === node.id
  })

  const childNodes = allNodes.filter(n => n.par === node.id)
  const isProjectNode = node.node_type === 'Project' || node.node_type === 'project'

  const sectionLabel: React.CSSProperties = {
    fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '1.2px', color: gt.sectionLabel, marginBottom: '8px',
  }

  const fieldLabel: React.CSSProperties = {
    color: gt.panelSubtext, fontSize: '12px',
  }

  const fieldValue: React.CSSProperties = {
    color: gt.panelText, fontSize: '12px',
  }

  const relBadge: React.CSSProperties = {
    fontSize: '9px', padding: '2px 7px',
    background: gt.accentBg, color: gt.accent,
    border: `1px solid ${gt.accentBorder}`,
    borderRadius: '4px', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
  }

  return (
    <div
      className="absolute right-0 z-30 overflow-y-auto"
      style={{
        top: '52px', bottom: 0, width: '380px',
        background: gt.panelBg,
        backdropFilter: 'blur(20px)',
        borderLeft: `1px solid ${gt.panelBorder}`,
        padding: '24px',
        transition: 'background 0.3s, border-color 0.3s',
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: gt.panelText }}>{node.label}</h2>
          {(node as any).source && (
            <span style={{
              fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '1px', color: gt.panelSubtext,
              marginTop: '2px', display: 'block',
            }}>
              Source: {(node as any).source}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            color: gt.panelSubtext, fontSize: '22px', lineHeight: 1,
            background: 'none', border: 'none', cursor: 'pointer',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = gt.panelText)}
          onMouseLeave={(e) => (e.currentTarget.style.color = gt.panelSubtext)}
        >
          &times;
        </button>
      </div>

      {/* Where this came from — always visible, no tab required. */}
      <LineageRibbon
        trace={trace?.trace ?? null}
        latestRun={trace?.latest ?? null}
        loading={traceLoading}
        onOpenRun={onOpenRun}
        onOpenTrace={() => setActiveTab('trace')}
      />

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: `1px solid ${gt.panelBorder}`, paddingBottom: '0' }}>
        {(['info', 'trace'] as DetailTab[]).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: '6px 12px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === t ? `2px solid ${gt.accent}` : '2px solid transparent',
              color: activeTab === t ? gt.accent : gt.panelSubtext,
              fontSize: '11px', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.5px',
              cursor: 'pointer', marginBottom: '-1px',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {t === 'info' ? 'Details' : '\u2726 Trace'}
          </button>
        ))}
      </div>

      {/* Trace tab — origin, contributors, trust, timeline */}
      {activeTab === 'trace' && (
        <TracePanel
          data={trace}
          loading={traceLoading}
          error={traceError}
          onOpenRun={onOpenRun}
          onRetry={reload}
        />
      )}

      {/* Details tab */}
      {activeTab === 'info' && <>
      {lensSections}

      {/* Code explanation. Lived under Provenance, which was the wrong home: it
          describes what this node IS, not where it came from. */}
      {CODE_NODE_TYPES.has(node.node_type) && (
        <div style={{ marginBottom: 14 }}>
          <div style={{
            fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '1.2px', color: gt.sectionLabel, marginBottom: '8px',
          }}>
            What this is
          </div>
          <div style={{
            padding: '10px 12px', background: gt.panelCard,
            border: `1px solid ${gt.panelCardBorder}`,
            borderLeft: `3px solid ${gt.accent}`, borderRadius: '8px',
          }}>
            <p style={{ fontSize: 12, color: gt.panelText, lineHeight: 1.6, margin: 0 }}>
              {buildCodeExplanation(node, outgoing, incoming, allNodes)}
            </p>
          </div>
        </div>
      )}
      {/* Domain View + Structural View buttons for project nodes */}
      {isProjectNode && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
          <button
            onClick={() => { setFocusedProjectNode(node as any); onOpenLayout?.('domain-layer') }}
            style={{
              padding: '10px 8px',
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.35)',
              borderRadius: '8px', color: '#10b981',
              fontSize: '11px', fontWeight: 700, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '4px', transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.18)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.08)' }}
          >
            <span style={{ fontSize: 16 }}>◫</span>
            Domain View
          </button>
          <button
            onClick={() => { setFocusedProjectNode(node as any); onOpenLayout?.('structural') }}
            style={{
              padding: '10px 8px',
              background: 'rgba(167,139,250,0.08)',
              border: '1px solid rgba(167,139,250,0.35)',
              borderRadius: '8px', color: '#a78bfa',
              fontSize: '11px', fontWeight: 700, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '4px', transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(167,139,250,0.18)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(167,139,250,0.08)' }}
          >
            <span style={{ fontSize: 16 }}>⬡</span>
            Structural View
          </button>
        </div>
      )}

      {/* Traverse project */}
      {isProjectNode && onTraverseProject && (
        <button
          onClick={() => onTraverseProject(node)}
          style={{
            width: '100%', padding: '10px', marginBottom: '16px',
            background: gt.accentBg,
            border: `1px solid ${gt.accentBorder}`,
            borderRadius: '8px', color: gt.accent,
            fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '6px', transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `${gt.accent}25`
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = gt.accentBg
          }}
        >
          ⬡ Traverse from this Project
        </button>
      )}

      <div className="space-y-5">
        {/* Basic Info */}
        <div>
          <div style={sectionLabel}>Basic Information</div>
          <div className="space-y-2">
            <div><span style={fieldLabel}>Type: </span><span style={fieldValue}>{node.node_type}</span></div>
            <div><span style={fieldLabel}>Group: </span><span style={fieldValue}>{node.group}</span></div>
            {node.tier !== undefined && (
              <div><span style={fieldLabel}>Tier: </span><span style={fieldValue}>{node.tier}</span></div>
            )}
            {node.description && (
              <div>
                <span style={fieldLabel}>Description: </span>
                <span style={{ ...fieldValue, opacity: 0.85 }}>{node.description}</span>
              </div>
            )}
          </div>
        </div>

        {/* Children */}
        {childNodes.length > 0 && (
          <div>
            <div style={sectionLabel}>Child Nodes ({childNodes.length})</div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {childNodes.slice(0, 20).map(child => (
                <div
                  key={child.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '7px 10px', borderRadius: '6px',
                    background: gt.panelCard,
                    border: `1px solid ${gt.panelCardBorder}`,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = gt.rowHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = gt.panelCard)}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: child.color, boxShadow: `0 0 4px ${child.color}` }}
                  />
                  <span style={{ flex: 1, color: gt.panelText, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {child.label}
                  </span>
                  <span style={{ fontSize: '10px', color: gt.panelSubtext }}>{child.node_type}</span>
                </div>
              ))}
              {childNodes.length > 20 && (
                <div style={{ fontSize: '11px', color: gt.panelSubtext, padding: '4px 8px' }}>
                  ... and {childNodes.length - 20} more
                </div>
              )}
            </div>
            <div style={{ marginTop: '8px', fontSize: '10px', color: gt.accent }}>
              💡 Click node to expand/collapse children
            </div>
          </div>
        )}

        {/* Properties */}
        {(node.status || node.risk || node.severity || node.priority) && (
          <div>
            <div style={sectionLabel}>Properties</div>
            <div className="space-y-2">
              {node.status && <div><span style={fieldLabel}>Status: </span><span style={fieldValue}>{node.status}</span></div>}
              {node.risk && <div><span style={fieldLabel}>Risk: </span><span style={fieldValue}>{node.risk}</span></div>}
              {node.severity && <div><span style={fieldLabel}>Severity: </span><span style={fieldValue}>{node.severity}</span></div>}
              {node.priority && <div><span style={fieldLabel}>Priority: </span><span style={fieldValue}>{node.priority}</span></div>}
            </div>
          </div>
        )}

        {/* Connections */}
        <div>
          <div style={sectionLabel}>Connections</div>
          <div className="space-y-1.5" style={{ fontSize: '12px' }}>
            <div><span style={fieldLabel}>Outgoing: </span><span style={fieldValue}>{outgoing.length}</span></div>
            <div><span style={fieldLabel}>Incoming: </span><span style={fieldValue}>{incoming.length}</span></div>
            <div><span style={fieldLabel}>Total: </span><span style={{ ...fieldValue, fontWeight: 700 }}>{outgoing.length + incoming.length}</span></div>
          </div>
        </div>

        {/* Relationships */}
        {(outgoing.length > 0 || incoming.length > 0) && (
          <div>
            <div style={sectionLabel}>Relationships ({outgoing.length + incoming.length})</div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {outgoing.slice(0, 10).map((link, idx) => {
                const tid = typeof link.target === 'string' ? link.target : link.target.id
                const tNode = allNodes.find(n => n.id === tid)
                if (!tNode) return null
                return (
                  <div
                    key={`out-${idx}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '9px 10px', fontSize: '11px',
                      background: gt.panelCard,
                      border: `1px solid ${gt.panelCardBorder}`,
                      borderRadius: '6px',
                    }}
                  >
                    <span style={{ color: gt.accent, fontSize: '13px', fontWeight: 700 }}>→</span>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: tNode.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: gt.panelText, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {tNode.label}
                    </span>
                    {link.type && <span style={relBadge}>{link.type}</span>}
                  </div>
                )
              })}
              {incoming.slice(0, 10).map((link, idx) => {
                const sid = typeof link.source === 'string' ? link.source : link.source.id
                const sNode = allNodes.find(n => n.id === sid)
                if (!sNode) return null
                return (
                  <div
                    key={`in-${idx}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '9px 10px', fontSize: '11px',
                      background: gt.panelCard,
                      border: `1px solid ${gt.panelCardBorder}`,
                      borderRadius: '6px',
                    }}
                  >
                    <span style={{ color: gt.panelSubtext, fontSize: '13px', fontWeight: 700 }}>←</span>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: sNode.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: gt.panelText, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {sNode.label}
                    </span>
                    {link.type && <span style={relBadge}>{link.type}</span>}
                  </div>
                )
              })}
              {(outgoing.length + incoming.length) > 20 && (
                <div style={{ fontSize: '11px', color: gt.panelSubtext, padding: '4px 8px' }}>
                  ... and {(outgoing.length + incoming.length) - 20} more connections
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      </>}
    </div>
  )
}
