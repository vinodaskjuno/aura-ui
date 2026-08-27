import React, { useState, useEffect } from 'react'
import type { OntologyNode, OntologyLink } from '../../types/ontology'
import { useGraphTheme } from '../../hooks/useGraphTheme'
import { useAuthStore } from '../../store/authStore'
import { useOntologyStore } from '../../store/ontologyStore'

interface ChangelogEntry {
  changeId: string
  timestamp: string
  entityId: string
  entityType: string
  entityLabel: string
  entityName: string
  changeType: string
  actor: string
  before: string | null
  after: string | null
  source: string
  notes: string
}

interface Props {
  node: OntologyNode | null
  allNodes: OntologyNode[]
  allLinks: OntologyLink[]
  onClose: () => void
  onTraverseProject?: (node: OntologyNode) => void
}

type DetailTab = 'info' | 'provenance' | 'history'

interface NodeVersionInfo {
  versionId: string
  versionNumber: string
  loadMethod: string
  actor: string
  startedAt: string
  finishedAt?: string
  status: string
  sources?: string[]
  notes?: string
}

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

interface ProvenancePanelProps {
  node: OntologyNode
  outgoing: OntologyLink[]
  incoming: OntologyLink[]
  allNodes: OntologyNode[]
  nodeVersion: NodeVersionInfo | null
  loading: boolean
}

function ProvenanceTab({ node, outgoing, incoming, allNodes, nodeVersion, loading }: ProvenancePanelProps) {
  const gt = useGraphTheme()
  const n = node as Record<string, unknown>
  const isCode = CODE_NODE_TYPES.has(node.node_type)
  const confidence = n.confidence as number | undefined
  const discoveredBy = n.discoveredBy as string | undefined
  const factType = n.factType as string | undefined
  const evidence = n.evidence as string | string[] | undefined
  const evidenceList = Array.isArray(evidence) ? evidence : evidence ? [evidence] : []

  const sectionLabel: React.CSSProperties = {
    fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '1.2px', color: gt.sectionLabel, marginBottom: '8px',
  }

  const card: React.CSSProperties = {
    padding: '10px 12px', background: gt.panelCard,
    border: `1px solid ${gt.panelCardBorder}`, borderRadius: '8px',
    marginBottom: '10px',
  }

  const factTypeColor = factType === 'known' ? '#22c55e' : factType === 'inferred' ? '#f59e0b' : '#a78bfa'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Version introduced-by */}
      <div style={{ marginBottom: 14 }}>
        <div style={sectionLabel}>Introduced By</div>
        {loading ? (
          <div style={{ color: gt.panelSubtext, fontSize: 12 }}>Loading version info…</div>
        ) : nodeVersion ? (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: gt.accent }}>{nodeVersion.versionNumber}</span>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 4,
                background: `${gt.accent}22`, color: gt.accent, textTransform: 'uppercase',
              }}>{nodeVersion.loadMethod}</span>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 4,
                background: nodeVersion.status === 'success' ? '#22c55e22' : '#f59e0b22',
                color: nodeVersion.status === 'success' ? '#22c55e' : '#f59e0b',
                textTransform: 'uppercase',
              }}>{nodeVersion.status}</span>
            </div>
            <div style={{ fontSize: 11, color: gt.panelSubtext }}>
              Actor: <span style={{ color: gt.panelText }}>{nodeVersion.actor}</span>
            </div>
            <div style={{ fontSize: 11, color: gt.panelSubtext, marginTop: 2 }}>
              {new Date(nodeVersion.startedAt).toLocaleString()}
            </div>
            {nodeVersion.sources && nodeVersion.sources.length > 0 && (
              <div style={{ fontSize: 11, color: gt.panelSubtext, marginTop: 4 }}>
                Sources: <span style={{ color: gt.panelText }}>{nodeVersion.sources.join(', ')}</span>
              </div>
            )}
            {nodeVersion.notes && (
              <div style={{ fontSize: 11, color: gt.panelSubtext, marginTop: 4, fontStyle: 'italic' }}>{nodeVersion.notes}</div>
            )}
          </div>
        ) : (
          <div style={{ color: gt.panelSubtext, fontSize: 12, padding: '8px 0' }}>
            No version record found for this node.
          </div>
        )}
      </div>

      {/* Discovery trail */}
      {(confidence !== undefined || discoveredBy || factType) && (
        <div style={{ marginBottom: 14 }}>
          <div style={sectionLabel}>Discovery Trail</div>
          <div style={card}>
            {confidence !== undefined && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: gt.panelSubtext, width: 80 }}>Confidence</span>
                <div style={{ flex: 1, height: 5, borderRadius: 3, background: `${gt.panelBorder}` }}>
                  <div style={{ width: `${confidence * 100}%`, height: '100%', borderRadius: 3, background: confidence > 0.8 ? '#22c55e' : confidence > 0.5 ? '#f59e0b' : '#ef4444', transition: 'width 0.4s' }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: confidence > 0.8 ? '#22c55e' : confidence > 0.5 ? '#f59e0b' : '#ef4444' }}>
                  {(confidence * 100).toFixed(0)}%
                </span>
              </div>
            )}
            {discoveredBy && (
              <div style={{ fontSize: 11, color: gt.panelSubtext, marginBottom: 4 }}>
                Discovered by: <span style={{ color: gt.panelText }}>{discoveredBy}</span>
              </div>
            )}
            {factType && (
              <div style={{ fontSize: 11, color: gt.panelSubtext, marginBottom: 4 }}>
                Fact type: <span style={{ fontWeight: 700, color: factTypeColor }}>{factType}</span>
              </div>
            )}
            {evidenceList.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: gt.panelSubtext, marginBottom: 4 }}>Evidence</div>
                {evidenceList.map((ev, i) => (
                  <div key={i} style={{ fontSize: 10, color: gt.accent, fontFamily: 'JetBrains Mono, monospace', padding: '2px 6px', background: `${gt.accent}11`, borderRadius: 4, marginBottom: 2 }}>
                    {ev}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Code explanation — only for code-type nodes */}
      {isCode && (
        <div style={{ marginBottom: 14 }}>
          <div style={sectionLabel}>Code Explanation</div>
          <div style={{ ...card, borderLeft: `3px solid ${gt.accent}` }}>
            <p style={{ fontSize: 12, color: gt.panelText, lineHeight: 1.6, margin: 0 }}>
              {buildCodeExplanation(node, outgoing, incoming, allNodes)}
            </p>
            {/* Linked business rule / domain entities */}
            {outgoing.filter(l => ['IMPLEMENTS', 'BELONGS_TO', 'GOVERNED_BY'].includes(l.type)).length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: gt.panelSubtext, marginBottom: 6 }}>Linked Entities</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {outgoing.filter(l => ['IMPLEMENTS', 'BELONGS_TO', 'GOVERNED_BY'].includes(l.type)).slice(0, 6).map((l, i) => {
                    const tid = typeof l.target === 'string' ? l.target : (l.target as OntologyNode).id
                    const t = allNodes.find(x => x.id === tid)
                    if (!t) return null
                    return (
                      <span key={i} style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 12,
                        background: gt.accentBg, color: gt.accent,
                        border: `1px solid ${gt.accentBorder}`, fontWeight: 600,
                      }}>
                        {l.type}: {t.label}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* No provenance at all */}
      {!nodeVersion && !loading && confidence === undefined && !discoveredBy && !isCode && (
        <div style={{ textAlign: 'center', color: gt.panelSubtext, padding: '24px 0', fontSize: 12 }}>
          No provenance metadata available for this node.
        </div>
      )}
    </div>
  )
}

export default function OntologyDetailPanel({ node, allNodes, allLinks, onClose, onTraverseProject }: Props) {
  const gt = useGraphTheme()
  const { hasPermission } = useAuthStore()
  const canMaintain = hasPermission('ontology_maintain')
  const { setSpecialistView, setFocusedProjectNode } = useOntologyStore()
  const [activeTab, setActiveTab] = useState<DetailTab>('info')
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([])
  const [changelogLoading, setChangelogLoading] = useState(false)
  const [nodeVersion, setNodeVersion] = useState<NodeVersionInfo | null>(null)
  const [nodeVersionLoading, setNodeVersionLoading] = useState(false)

  useEffect(() => {
    if (activeTab === 'provenance' && node) {
      setNodeVersionLoading(true)
      fetch(`/api/ontology/nodes/${encodeURIComponent(node.id)}/version`, {
        headers: { Authorization: `Bearer ${useAuthStore.getState().token}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(setNodeVersion)
        .catch(() => setNodeVersion(null))
        .finally(() => setNodeVersionLoading(false))
    }
  }, [activeTab, node?.id])

  useEffect(() => {
    if (activeTab === 'history' && node && canMaintain) {
      setChangelogLoading(true)
      fetch(`/api/ontology/nodes/${encodeURIComponent(node.id)}/changelog?limit=20`, {
        headers: { Authorization: `Bearer ${useAuthStore.getState().token}` },
      })
        .then(r => r.ok ? r.json() : [])
        .then(setChangelog)
        .catch(() => setChangelog([]))
        .finally(() => setChangelogLoading(false))
    }
  }, [activeTab, node?.id, canMaintain])

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

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: `1px solid ${gt.panelBorder}`, paddingBottom: '0' }}>
        {(['info', 'provenance', ...(canMaintain ? ['history'] : [])] as DetailTab[]).map(t => (
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
            {t === 'info' ? 'Details' : t === 'provenance' ? '✦ Provenance' : '⏱ History'}
          </button>
        ))}
      </div>

      {/* Provenance tab */}
      {activeTab === 'provenance' && (
        <ProvenanceTab
          node={node}
          outgoing={outgoing}
          incoming={incoming}
          allNodes={allNodes}
          nodeVersion={nodeVersion}
          loading={nodeVersionLoading}
        />
      )}

      {/* History tab */}
      {activeTab === 'history' && (
        <div>
          {changelogLoading ? (
            <div style={{ textAlign: 'center', color: gt.panelSubtext, padding: '24px', fontSize: '12px' }}>
              Loading history…
            </div>
          ) : changelog.length === 0 ? (
            <div style={{ textAlign: 'center', color: gt.panelSubtext, padding: '24px', fontSize: '12px' }}>
              No version history yet for this node.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {changelog.map((entry) => {
                const changeColors: Record<string, string> = {
                  CREATE: '#10b981', UPDATE: '#4a9eff', RETIRE: '#f44336',
                  RELATIONSHIP_ADD: '#a78bfa', RELATIONSHIP_ARCHIVE: '#f59e0b',
                  BULK_LOAD: '#6a7aaa',
                }
                const color = changeColors[entry.changeType] ?? '#8a9adb'
                let before: any = null, after: any = null
                try { if (entry.before) before = JSON.parse(entry.before) } catch {}
                try { if (entry.after) after = JSON.parse(entry.after) } catch {}
                return (
                  <div key={entry.changeId} style={{
                    padding: '10px 12px',
                    background: gt.panelCard,
                    border: `1px solid ${gt.panelCardBorder}`,
                    borderLeft: `3px solid ${color}`,
                    borderRadius: '6px',
                    fontSize: '11px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{
                        padding: '1px 6px', borderRadius: '3px', fontSize: '9px', fontWeight: 700,
                        background: `${color}22`, color,
                      }}>
                        {entry.changeType}
                      </span>
                      <span style={{ color: gt.panelSubtext, fontSize: '10px' }}>
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ color: gt.panelText, marginBottom: '4px' }}>
                      <span style={{ color: gt.accent }}>{entry.actor}</span>
                      {' via '}
                      <span style={{ color: gt.panelSubtext }}>{entry.source}</span>
                    </div>
                    {entry.notes && (
                      <div style={{ color: gt.panelSubtext, fontStyle: 'italic', marginBottom: '4px' }}>{entry.notes}</div>
                    )}
                    {(before || after) && (
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                        {before && (
                          <div style={{ flex: 1, padding: '3px 6px', background: 'rgba(244,67,54,0.08)', borderRadius: '3px', color: '#f44336', fontSize: '10px' }}>
                            {JSON.stringify(before)}
                          </div>
                        )}
                        {after && (
                          <div style={{ flex: 1, padding: '3px 6px', background: 'rgba(16,185,129,0.08)', borderRadius: '3px', color: '#10b981', fontSize: '10px' }}>
                            {JSON.stringify(after)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Details tab */}
      {activeTab === 'info' && <>
      {/* Domain View + Structural View buttons for project nodes */}
      {isProjectNode && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
          <button
            onClick={() => { setFocusedProjectNode(node as any); setSpecialistView('domain-layer') }}
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
            onClick={() => { setFocusedProjectNode(node as any); setSpecialistView('structural') }}
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
