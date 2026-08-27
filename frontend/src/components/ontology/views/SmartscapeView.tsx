import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ForceGraph from 'force-graph'
import type { OntologyNode, OntologyLink, SearchResult } from '../../../api/ontologyUniverse'
import { searchNodes as apiSearchNodes, getNodeSubgraph } from '../../../api/ontologyUniverse'
import { useGraphTheme } from '../../../hooks/useGraphTheme'
import { useOntologyStore } from '../../../store/ontologyStore'
import { useWorkspaceStore } from '../../../store/workspaceStore'
import client from '../../../api/client'

// ── Category definitions ──────────────────────────────────────────────────────

type CategoryId = 'all' | 'business' | 'app' | 'code' | 'infra' | 'domain' | 'ai'
type LayoutMode = 'force' | 'vertical' | 'horizontal'

interface Category {
  id: Exclude<CategoryId, 'all'>
  label: string
  color: string
  types: string[]
}

const SMARTSCAPE_CATEGORIES: Category[] = [
  {
    id: 'business',
    label: 'Business',
    color: '#a78bfa',
    types: [
      'Enterprise', 'Organization', 'BusinessUnit', 'BusinessDomain', 'Product',
      'BusinessProcess', 'BusinessRule', 'BusinessApplication', 'Requirement',
      'Policy', 'SOP', 'Document', 'WikiArticle', 'ADR', 'TechnicalSpec',
      'Runbook', 'Ticket', 'Project', 'AuditLog',
    ],
  },
  {
    id: 'app',
    label: 'Applications',
    color: '#60a5fa',
    types: ['Application', 'Service', 'API', 'Module', 'Class', 'Function', 'Feature'],
  },
  {
    id: 'code',
    label: 'Code & CI/CD',
    color: '#818cf8',
    types: [
      'Repository', 'CodeFile', 'Dependency', 'Configuration', 'FeatureFlag',
      'BuildPipeline', 'BuildArtifact', 'Deployment', 'DeploymentEnvironment',
    ],
  },
  {
    id: 'infra',
    label: 'Infrastructure',
    color: '#fb923c',
    types: [
      'Server', 'VM', 'Container', 'KubernetesCluster', 'CloudResource', 'Network',
      'Database', 'Table', 'Column', 'DataElement', 'DataFlow', 'Infrastructure',
    ],
  },
  {
    id: 'domain',
    label: 'Identity & Ops',
    color: '#34d399',
    types: [
      'User', 'Team', 'Role', 'ServiceAccount',
      'SecurityFinding', 'Vulnerability', 'AttackPath', 'IAMRole', 'IAMPolicy',
      'Incident', 'Alert', 'ChangeRequest',
    ],
  },
  {
    id: 'ai',
    label: 'AI & Intelligence',
    color: '#f0abfc',
    types: ['AIModel', 'PromptRepository', 'RAGKnowledgeBase', 'VectorDatabase', 'AgentDefinition', 'MCPServer'],
  },
]

// ── Relationship semantic direction ───────────────────────────────────────────

const RELATIONSHIP_SEMANTIC: Record<string, string> = {
  COMMITTED_TO:             'Code → Repository',
  BUILT_BY:                 'Repository → Pipeline',
  PRODUCES:                 'Pipeline → Artifact',
  DEPLOYED_TO:              'Artifact → Environment',
  RUNS_ON:                  'Service → Infrastructure',
  EXPOSED_VIA:              'Service → Network',
  ACCESSES_AS:              'Service → Identity',
  HAS_FINDING:              'Resource → SecurityFinding',
  CONNECTS_TO:              'Service → Database',
  IMPLEMENTS:               'Service → BusinessApplication',
  OWNED_BY:                 'Resource → Team/User',
  HAS_INCIDENT:             'Service → Incident',
  REMEDIATED_BY:            'Issue → ChangeRequest',
  BELONGS_TO:               'Child → Parent',
  PART_OF:                  'Component → Whole',
  CONTAINS:                 'Parent → Child',
  DEPENDS_ON:               'Consumer → Dependency',
  CALLS:                    'Caller → Callee',
  IMPORTS:                  'Module → Dependency',
  EXTENDS:                  'Child → Base',
  SUPPORTS_PROCESS:         'Application → BusinessProcess',
  IMPLEMENTS_BUSINESS_RULE: 'Application → BusinessRule',
  GOVERNED_BY:              'Resource → Policy',
  DOCUMENTS:                'Document → Resource',
  REFERENCED_BY:            'Source → Reference',
  HOSTS:                    'Server → Resource',
  ROUTES_TO:                'Network → Service',
  AUDITED_BY:               'Resource → AuditLog',
  MANAGED_BY:               'Resource → Team',
  HOSTED_IN:                'Service → Repository',
  STORED_IN:                'Service → Database',
  IS_SAME_AS:               'Entity ↔ Entity',
  CORRELATES_WITH:          'Service ↔ Infrastructure',
  AFFECTS_PROJECT:          'Issue → Project',
}

// ── Layout Y-bands and X-columns per category ─────────────────────────────────

const CAT_Y: Record<string, number> = {
  business: -280, app: -168, code: -56, domain: 56, infra: 168, ai: 280,
}
const CAT_X: Record<string, number> = {
  business: -500, app: -300, code: -100, infra: 100, domain: 300, ai: 500,
}

// ── Helper utilities ──────────────────────────────────────────────────────────

function getCategoryFor(nodeType: string): Category | undefined {
  return SMARTSCAPE_CATEGORIES.find(c => c.types.includes(nodeType))
}

function resolveNode(endpoint: unknown): OntologyNode | null {
  if (!endpoint || typeof endpoint !== 'object') return null
  return endpoint as OntologyNode
}

function confColor(c: number | undefined): string {
  if (c == null) return '#6b7280'
  if (c >= 0.8) return '#22c55e'
  if (c >= 0.5) return '#f59e0b'
  return '#ef4444'
}

function factTypeMeta(ft: string | undefined): { bg: string; color: string; label: string } {
  switch (ft) {
    case 'known':      return { bg: '#16a34a22', color: '#22c55e', label: 'Known' }
    case 'inferred':   return { bg: '#d9770622', color: '#f59e0b', label: 'Inferred' }
    case 'hypothesis': return { bg: '#7c3aed22', color: '#a78bfa', label: 'Hypothesis' }
    default:           return { bg: '#6b728022', color: '#9ca3af', label: ft ?? '—' }
  }
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) }
  catch { return iso }
}

function rawId(endpoint: unknown): string {
  if (endpoint != null && typeof endpoint === 'object') return (endpoint as OntologyNode).id ?? ''
  return (endpoint as string) ?? ''
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// ── SmartscapeRelationshipDrawer ──────────────────────────────────────────────

interface DrawerProps {
  link: Record<string, unknown>
  onClose: () => void
  onGoToSource: (node: OntologyNode) => void
  onGoToTarget: (node: OntologyNode) => void
  onOpenInWorkspace: (node: OntologyNode) => void
  onDrillDownToTarget?: (node: OntologyNode) => void
  gt: ReturnType<typeof useGraphTheme>
}

function SmartscapeRelationshipDrawer({ link, onClose, onGoToSource, onGoToTarget, onOpenInWorkspace, onDrillDownToTarget, gt }: DrawerProps) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [history, setHistory] = useState<Record<string, unknown>[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const srcNode = resolveNode(link.source)
  const tgtNode = resolveNode(link.target)
  const srcCat = srcNode ? getCategoryFor(srcNode.node_type) : undefined
  const tgtCat = tgtNode ? getCategoryFor(tgtNode.node_type) : undefined

  const relType = link.type as string
  const conf = link.confidence as number | undefined
  const ft = link.factType as string | undefined
  const semantic = RELATIONSHIP_SEMANTIC[relType]
    ?? `${srcNode?.node_type ?? '?'} → ${tgtNode?.node_type ?? '?'}`
  const ftMeta = factTypeMeta(ft)

  let evidencePills: string[] = []
  try { evidencePills = JSON.parse((link.evidence as string | undefined) ?? '[]') } catch {}

  const loadHistory = useCallback(async () => {
    const id = link.id as string | undefined
    if (!id || historyLoading) return
    setHistoryLoading(true)
    try {
      const res = await client.get(`/api/ontology/relationships/${id}/changelog?limit=20`)
      setHistory((res.data ?? []) as Record<string, unknown>[])
    } catch {
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }, [link.id, historyLoading])

  const toggleHistory = () => {
    if (!historyOpen && history.length === 0) loadHistory()
    setHistoryOpen(o => !o)
  }

  const NodeCard = ({ node, cat }: { node: OntologyNode | null; cat: Category | undefined }) => {
    if (!node) {
      return (
        <div style={{ flex: 1, padding: '8px 10px', background: gt.panelCard, border: `1px solid ${gt.panelCardBorder}`, borderRadius: 8 }}>
          <span style={{ fontSize: 10, color: gt.mutedText }}>Unknown</span>
        </div>
      )
    }
    return (
      <div style={{ flex: 1, padding: '8px 10px', background: gt.panelCard, border: `1px solid ${cat?.color ?? gt.panelCardBorder}44`, borderRadius: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: cat?.color ?? '#6b7280', flexShrink: 0 }} />
          <span style={{ fontSize: 9, color: cat?.color ?? gt.mutedText, textTransform: 'uppercase', letterSpacing: '0.7px', fontWeight: 700 }}>
            {node.node_type}
          </span>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: gt.panelText, lineHeight: 1.3, wordBreak: 'break-word' }}>
          {node.label || node.id}
        </div>
      </div>
    )
  }

  const SectionToggle = ({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) => (
    <button
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, width: '100%',
        background: 'none', border: 'none', padding: '8px 0', cursor: 'pointer',
        color: gt.panelSubtext, fontSize: 11, fontWeight: 600, textAlign: 'left',
      }}
    >
      <span style={{ fontSize: 9, color: gt.mutedText }}>{open ? '▾' : '▸'}</span>
      {label}
    </button>
  )

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: 360,
      background: gt.panelBg, borderLeft: `1px solid ${gt.panelBorder}`,
      display: 'flex', flexDirection: 'column', zIndex: 20,
      boxShadow: '-6px 0 24px rgba(0,0,0,0.35)',
      animation: 'ssDrawerIn 0.2s ease-out',
    }}>
      <style>{`@keyframes ssDrawerIn { from { transform: translateX(100%) } to { transform: translateX(0) } }`}</style>

      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${gt.panelBorder}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <div style={{
              padding: '3px 9px', background: gt.accentBg, border: `1px solid ${gt.accentBorder}`,
              borderRadius: 5, fontSize: 10, fontWeight: 800, color: gt.accent, letterSpacing: '0.5px',
            }}>
              {relType}
            </div>
            {link.active === false && (
              <div style={{ padding: '2px 6px', background: '#ef444422', border: '1px solid #ef444488', borderRadius: 4, fontSize: 9, color: '#ef4444', fontWeight: 700 }}>ARCHIVED</div>
            )}
          </div>
          <div style={{ fontSize: 10, color: gt.mutedText }}>{semantic}</div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: gt.mutedText, fontSize: 16, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}
        >✕</button>
      </div>

      {/* Source → Target */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${gt.panelBorder}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <NodeCard node={srcNode} cat={srcCat} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: gt.mutedText, fontSize: 12, flexShrink: 0 }}>
          →
        </div>
        <NodeCard node={tgtNode} cat={tgtCat} />
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>

        {/* Provenance */}
        <div style={{ borderBottom: `1px solid ${gt.divider}`, paddingBottom: 8 }}>
          <div style={{ padding: '10px 0 6px', fontSize: 9, fontWeight: 700, color: gt.sectionLabel, textTransform: 'uppercase', letterSpacing: '1.2px' }}>Provenance</div>

          {conf != null && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: gt.panelSubtext }}>Confidence</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: confColor(conf) }}>{Math.round(conf * 100)}%</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: gt.panelCardBorder, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${conf * 100}%`, background: confColor(conf), borderRadius: 2, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          )}

          {ft && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: gt.panelSubtext }}>Fact type</span>
              <span style={{ padding: '2px 8px', background: ftMeta.bg, color: ftMeta.color, border: `1px solid ${ftMeta.color}44`, borderRadius: 4, fontSize: 9, fontWeight: 700 }}>
                {ftMeta.label}
              </span>
            </div>
          )}

          {link.prov_source != null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 10, color: gt.panelSubtext }}>Source system</span>
              <span style={{ fontSize: 10, color: gt.panelText, fontWeight: 600 }}>{link.prov_source as string}</span>
            </div>
          )}

          {link.discoveredBy != null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 10, color: gt.panelSubtext }}>Discovered by</span>
              <span style={{ fontSize: 10, color: gt.panelText, fontFamily: 'monospace', maxWidth: '55%', textAlign: 'right' }}>{link.discoveredBy as string}</span>
            </div>
          )}

          {link.firstSeen != null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 10, color: gt.panelSubtext }}>First seen</span>
              <span style={{ fontSize: 10, color: gt.panelText }}>{fmtDate(link.firstSeen as string)}</span>
            </div>
          )}

          {link.lastSeen != null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 10, color: gt.panelSubtext }}>Last seen</span>
              <span style={{ fontSize: 10, color: gt.panelText }}>{fmtDate(link.lastSeen as string)}</span>
            </div>
          )}

          {conf == null && !ft && link.prov_source == null && link.discoveredBy == null && !link.firstSeen && (
            <div style={{ fontSize: 10, color: gt.mutedText, fontStyle: 'italic' }}>No provenance data available.</div>
          )}
        </div>

        {/* Evidence */}
        {evidencePills.length > 0 && (
          <div style={{ borderBottom: `1px solid ${gt.divider}`, paddingBottom: 8 }}>
            <SectionToggle label={`Evidence (${evidencePills.length})`} open={evidenceOpen} onToggle={() => setEvidenceOpen(o => !o)} />
            {evidenceOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {evidencePills.map((e, i) => (
                  <div key={i} style={{
                    padding: '4px 8px', background: gt.panelCard, border: `1px solid ${gt.panelCardBorder}`,
                    borderRadius: 5, fontSize: 10, fontFamily: 'monospace', color: gt.accent, wordBreak: 'break-all',
                  }}>{e}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Change history */}
        <div>
          <SectionToggle label="Change History" open={historyOpen} onToggle={toggleHistory} />
          {historyOpen && (
            historyLoading ? (
              <div style={{ fontSize: 10, color: gt.mutedText, padding: '4px 0' }}>Loading…</div>
            ) : history.length === 0 ? (
              <div style={{ fontSize: 10, color: gt.mutedText, fontStyle: 'italic' }}>No history available.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {history.slice(0, 10).map((h, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 9, color: gt.mutedText, whiteSpace: 'nowrap', marginTop: 2 }}>
                      {fmtDate(h.timestamp as string)}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: gt.accentBg, color: gt.accent, fontWeight: 700 }}>
                        {h.changeType as string ?? h.action as string ?? '?'}
                      </span>
                      {(h.actor as string | undefined) && (
                        <span style={{ fontSize: 9, color: gt.mutedText }}>{h.actor as string}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div style={{ padding: '10px 16px', borderTop: `1px solid ${gt.panelBorder}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {srcNode && (
            <button
              onClick={() => onGoToSource(srcNode)}
              style={{
                flex: 1, padding: '7px 8px', background: gt.accentBg, border: `1px solid ${gt.accentBorder}`,
                borderRadius: 7, color: gt.accent, fontSize: 10, fontWeight: 700, cursor: 'pointer',
              }}
            >→ Source</button>
          )}
          {tgtNode && (
            <button
              onClick={() => onGoToTarget(tgtNode)}
              style={{
                flex: 1, padding: '7px 8px', background: gt.panelCard, border: `1px solid ${gt.panelCardBorder}`,
                borderRadius: 7, color: gt.panelSubtext, fontSize: 10, fontWeight: 700, cursor: 'pointer',
              }}
            >→ Target</button>
          )}
        </div>
        {(srcNode || tgtNode) && (
          <div style={{ display: 'flex', gap: 8 }}>
            {srcNode && (
              <button
                onClick={() => onOpenInWorkspace(srcNode)}
                style={{
                  flex: 1, padding: '7px 8px', borderRadius: 7, cursor: 'pointer', fontSize: 10, fontWeight: 700,
                  background: 'linear-gradient(135deg, #312e81, #4f46e5)',
                  border: 'none', color: '#fff',
                }}
              >⊞ Source in Workspace</button>
            )}
            {tgtNode && (
              <button
                onClick={() => onOpenInWorkspace(tgtNode)}
                style={{
                  flex: 1, padding: '7px 8px', borderRadius: 7, cursor: 'pointer', fontSize: 10, fontWeight: 700,
                  background: 'linear-gradient(135deg, #312e81, #7c3aed)',
                  border: 'none', color: '#fff',
                }}
              >⊞ Target in Workspace</button>
            )}
          </div>
        )}
        {tgtNode && onDrillDownToTarget && (
          <button
            onClick={() => onDrillDownToTarget(tgtNode)}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 10, fontWeight: 700,
              background: 'linear-gradient(135deg, #0891b2, #06b6d4)',
              border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            🔍 Drill Down to Target
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main SmartscapeView ───────────────────────────────────────────────────────

// ── SmartscapeProjectPanel ────────────────────────────────────────────────────

interface ProjectPanelProps {
  projectFocus: string
  nodes: OntologyNode[]
  links: OntologyLink[]
  catCounts: Record<string, number>
  gt: ReturnType<typeof useGraphTheme>
  onClose: () => void
}

function SmartscapeProjectPanel({ projectFocus, nodes, links, catCounts, gt, onClose }: ProjectPanelProps) {
  const uniqueSources = useMemo(() => [...new Set(nodes.map(n => n.source).filter(Boolean))], [nodes])
  const uniqueTypes   = useMemo(() => [...new Set(nodes.map(n => n.node_type).filter(Boolean))], [nodes])
  const layerCount    = SMARTSCAPE_CATEGORIES.filter(c => (catCounts[c.id] ?? 0) > 0).length

  const StatCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div style={{
      background: gt.panelCard, border: `1px solid ${gt.panelCardBorder}`,
      borderRadius: 8, padding: '10px 8px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 8, color: gt.mutedText, textTransform: 'uppercase' as const, letterSpacing: '1.2px', marginTop: 2, fontWeight: 700 }}>{label}</div>
    </div>
  )

  return (
    <div style={{
      width: 300, flexShrink: 0,
      background: gt.filterBg, borderLeft: `1px solid ${gt.filterBorder}`,
      display: 'flex', flexDirection: 'column', overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 14px 10px', borderBottom: `1px solid ${gt.filterBorder}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, color: '#fff',
          }}>◈</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: gt.panelText, wordBreak: 'break-word', lineHeight: 1.3 }}>
              {projectFocus}
            </div>
            <div style={{ fontSize: 8, color: '#a78bfa', textTransform: 'uppercase' as const, letterSpacing: '1.5px', fontWeight: 700, marginTop: 2 }}>
              Project Deep-Dive
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: gt.mutedText, fontSize: 14, padding: '2px 4px', lineHeight: 1, flexShrink: 0 }}
          >✕</button>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <StatCard label="Nodes"  value={nodes.length}       color="#60a5fa" />
        <StatCard label="Edges"  value={links.length}       color="#34d399" />
        <StatCard label="Layers" value={layerCount}         color="#a78bfa" />
        <StatCard label="Types"  value={uniqueTypes.length} color="#f0abfc" />
      </div>

      {/* Layer breakdown */}
      <div style={{ padding: '0 14px 12px', borderTop: `1px solid ${gt.divider}` }}>
        <div style={{ padding: '10px 0 8px', fontSize: 9, fontWeight: 700, color: gt.sectionLabel, textTransform: 'uppercase' as const, letterSpacing: '1.5px' }}>
          Layer Breakdown
        </div>
        {SMARTSCAPE_CATEGORIES.filter(c => (catCounts[c.id] ?? 0) > 0).map(cat => (
          <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 11, color: gt.panelText }}>{cat.label}</span>
            <span style={{
              fontSize: 11, fontWeight: 700, color: cat.color,
              background: cat.color + '18', borderRadius: 4, padding: '1px 7px',
            }}>{catCounts[cat.id]}</span>
          </div>
        ))}
        {layerCount === 0 && (
          <div style={{ fontSize: 10, color: gt.mutedText }}>No layer data yet</div>
        )}
      </div>

      {/* Source systems */}
      {uniqueSources.length > 0 && (
        <div style={{ padding: '10px 14px 12px', borderTop: `1px solid ${gt.divider}` }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: gt.sectionLabel, textTransform: 'uppercase' as const, letterSpacing: '1.5px', marginBottom: 8 }}>
            Source Systems
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {uniqueSources.slice(0, 8).map(src => (
              <span key={src} style={{
                fontSize: 10, padding: '3px 9px', borderRadius: 12, fontWeight: 600,
                background: gt.accentBg, border: `1px solid ${gt.accentBorder}`, color: gt.accent,
              }}>{src}</span>
            ))}
          </div>
        </div>
      )}

      {/* Analyzed date */}
      <div style={{ padding: '8px 14px', borderTop: `1px solid ${gt.divider}`, flexShrink: 0 }}>
        <div style={{ fontSize: 9, color: gt.mutedText }}>
          Analyzed: {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
        </div>
      </div>

      {/* Back to org view */}
      <div style={{ padding: '0 14px 14px', flexShrink: 0 }}>
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '9px 0', borderRadius: 8, cursor: 'pointer',
            background: 'linear-gradient(135deg, #312e81, #4f46e5, #7c3aed)',
            border: 'none', color: '#fff', fontSize: 12, fontWeight: 700,
            boxShadow: '0 2px 12px rgba(99,102,241,0.4)',
          }}
        >
          ← Org View
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  nodes: OntologyNode[]
  links: OntologyLink[]
  selectedNode: OntologyNode | null
  onNodeClick: (node: OntologyNode) => void
}

export default function SmartscapeView({ nodes, links, onNodeClick }: Props) {
  const gt = useGraphTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null)

  // Store access for project focus
  const { projectFocus, loadProjectSubgraph, loadOrgGraph } = useOntologyStore()

  // Workspace navigation
  const navigate = useNavigate()
  const setWorkspaceNode = useWorkspaceStore(s => s.setSelectedNode)
  const handleOpenInWorkspace = useCallback((node: OntologyNode) => {
    setWorkspaceNode(node)
    navigate('/workspace')
  }, [setWorkspaceNode, navigate])

  // Refs for reading inside canvas callbacks (avoid stale closures)
  const selectedIdRef = useRef<string | null>(null)
  const gtRef = useRef(gt)

  const [activeCategory, setActiveCategory] = useState<CategoryId>('all')
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('force')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredNode, setHoveredNode] = useState<(OntologyNode & { _color: string; _dim: boolean }) | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [selectedLink, setSelectedLink] = useState<Record<string, unknown> | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Drill-down navigation state
  interface DrillDownLevel {
    nodeId: string
    nodeLabel: string
    nodeType: string
    graphData: { nodes: OntologyNode[]; links: OntologyLink[] }
  }
  const [drillDownStack, setDrillDownStack] = useState<DrillDownLevel[]>([])
  const [drillDownGraphData, setDrillDownGraphData] = useState<{ nodes: OntologyNode[]; links: OntologyLink[] } | null>(null)
  const [isDrillingDown, setIsDrillingDown] = useState(false)
  const isDrillDown = drillDownStack.length > 0

  // View mode toggles (localStorage persisted)
  const [showSplitView, setShowSplitView] = useState(() => localStorage.getItem('smartscape_splitView') === 'true')
  const [showMiniMap, setShowMiniMap] = useState(() => localStorage.getItem('smartscape_miniMap') === 'true')
  const [showPathView, setShowPathView] = useState(() => localStorage.getItem('smartscape_pathView') === 'true')

  // Project search state
  const [projectSearch, setProjectSearch] = useState('')
  const [projectSearchResults, setProjectSearchResults] = useState<SearchResult[]>([])
  const [projectSearchLoading, setProjectSearchLoading] = useState(false)
  const projectSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep refs in sync
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])
  useEffect(() => { gtRef.current = gt }, [gt])

  // Auto-switch to vertical layout when a project is focused
  useEffect(() => {
    if (projectFocus) {
      setLayoutMode('vertical')
      setActiveCategory('all')
    }
  }, [projectFocus])

  // Debounced project search
  useEffect(() => {
    if (projectSearchTimerRef.current) clearTimeout(projectSearchTimerRef.current)
    if (!projectSearch.trim()) { setProjectSearchResults([]); return }
    projectSearchTimerRef.current = setTimeout(async () => {
      setProjectSearchLoading(true)
      try {
        const results = await apiSearchNodes(projectSearch.trim(), undefined, 8)
        setProjectSearchResults(results)
      } catch { setProjectSearchResults([]) }
      finally { setProjectSearchLoading(false) }
    }, 300)
    return () => { if (projectSearchTimerRef.current) clearTimeout(projectSearchTimerRef.current) }
  }, [projectSearch])

  const handleProjectSelect = useCallback(async (label: string) => {
    setProjectSearch('')
    setProjectSearchResults([])
    await loadProjectSubgraph(label)
    setLayoutMode('vertical')
    setActiveCategory('all')
  }, [loadProjectSubgraph])

  const handleClearProjectFocus = useCallback(async () => {
    setLayoutMode('force')
    setActiveCategory('all')
    await loadOrgGraph()
  }, [loadOrgGraph])

  // ── Persist view mode preferences ──
  useEffect(() => {
    localStorage.setItem('smartscape_splitView', showSplitView.toString())
  }, [showSplitView])

  useEffect(() => {
    localStorage.setItem('smartscape_miniMap', showMiniMap.toString())
  }, [showMiniMap])

  useEffect(() => {
    localStorage.setItem('smartscape_pathView', showPathView.toString())
  }, [showPathView])

  // ── Drill-down navigation helpers ──
  const pushDrillDown = useCallback(async (node: OntologyNode) => {
    setIsDrillingDown(true)
    try {
      // Fetch subgraph for the target node
      const subgraph = await getNodeSubgraph(node.id, 2)
      
      // Save current graph state to the stack
      const currentData = drillDownGraphData || { nodes, links: links as OntologyLink[] }
      setDrillDownStack(prev => [...prev, {
        nodeId: node.id,
        nodeLabel: node.label,
        nodeType: node.node_type,
        graphData: currentData,
      }])
      
      // Set new drill-down graph
      setDrillDownGraphData(subgraph)
      setSelectedLink(null)
      setSelectedId(null)
      
      // Zoom to fit after a short delay
      setTimeout(() => {
        fgRef.current?.zoomToFit(400, 80)
      }, 100)
    } catch (error) {
      console.error('Failed to fetch node subgraph:', error)
      // TODO: Show error notification to user
    } finally {
      setIsDrillingDown(false)
    }
  }, [nodes, links, drillDownGraphData])

  const popDrillDown = useCallback(() => {
    if (drillDownStack.length === 0) return
    
    const newStack = [...drillDownStack]
    newStack.pop()
    setDrillDownStack(newStack)
    
    if (newStack.length === 0) {
      // Back to original view
      setDrillDownGraphData(null)
    } else {
      // Restore previous level
      const prevLevel = newStack[newStack.length - 1]
      setDrillDownGraphData(prevLevel.graphData)
    }
    
    setSelectedLink(null)
    setSelectedId(null)
    
    // Zoom to fit after a short delay
    setTimeout(() => {
      fgRef.current?.zoomToFit(400, 80)
    }, 100)
  }, [drillDownStack])

  const jumpToDrillDownLevel = useCallback((levelIndex: number) => {
    if (levelIndex < 0 || levelIndex >= drillDownStack.length) return
    
    const newStack = drillDownStack.slice(0, levelIndex + 1)
    setDrillDownStack(newStack)
    
    const targetLevel = newStack[newStack.length - 1]
    setDrillDownGraphData(targetLevel.graphData)
    
    setSelectedLink(null)
    setSelectedId(null)
    
    setTimeout(() => {
      fgRef.current?.zoomToFit(400, 80)
    }, 100)
  }, [drillDownStack])

  const clearDrillDownStack = useCallback(() => {
    setDrillDownStack([])
    setDrillDownGraphData(null)
    setSelectedLink(null)
    setSelectedId(null)
  }, [])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      if (isTyping) return

      // S - Toggle split view
      if (e.key === 's' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault()
        setShowSplitView(v => !v)
      }
      // M - Toggle mini-map
      else if (e.key === 'm' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault()
        setShowMiniMap(v => !v)
      }
      // P - Toggle path view
      else if (e.key === 'p' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault()
        setShowPathView(v => !v)
      }
      // Escape - Go back in drill-down stack
      else if (e.key === 'Escape' && isDrillDown) {
        e.preventDefault()
        popDrillDown()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDrillDown, popDrillDown])

  // ── Enrich nodes with category metadata ──
  const enrichedNodes = useMemo(() => {
    // Use drill-down data if available, otherwise use props data
    const sourceNodes = drillDownGraphData ? drillDownGraphData.nodes : nodes
    return sourceNodes.map(n => {
      const cat = getCategoryFor(n.node_type)
      return {
        ...n,
        _cat: (cat?.id ?? 'infra') as Exclude<CategoryId, 'all'>,
        _color: cat?.color ?? '#6b7280',
        _dim: false,
      }
    })
  }, [nodes, drillDownGraphData])

  // ── Graph data — always pass fresh string IDs so force-graph re-resolves positions ──
  const graphData = useMemo(() => {
    // Use drill-down data if available, otherwise use props data
    const sourceLinks = drillDownGraphData ? drillDownGraphData.links : (links as OntologyLink[])
    
    // Normalize all links to string IDs (force-graph mutates source/target in-place,
    // so spreading a mutated link would embed stale node positions from the old layout)
    const normalizeLink = (l: OntologyLink) => ({
      ...l,
      source: rawId(l.source),
      target: rawId(l.target),
    })

    if (activeCategory === 'all') {
      return {
        nodes: enrichedNodes.map(n => ({ ...n, _dim: false })),
        links: sourceLinks.map(normalizeLink),
      }
    }

    // Filter: only nodes in the active category
    const activeTypes = new Set(SMARTSCAPE_CATEGORIES.find(c => c.id === activeCategory)?.types ?? [])
    const filteredNodes = enrichedNodes
      .filter(n => activeTypes.has(n.node_type))
      .map(n => ({ ...n, _dim: false }))
    const visibleIds = new Set(filteredNodes.map(n => n.id))

    // Only include links where BOTH endpoints are visible (no dangling edges)
    const filteredLinks = (links as OntologyLink[])
      .filter(l => visibleIds.has(rawId(l.source)) && visibleIds.has(rawId(l.target)))
      .map(normalizeLink)

    return { nodes: filteredNodes, links: filteredLinks }
  }, [enrichedNodes, links, activeCategory])

  // ── Category counts (always from full enrichedNodes, not filtered graphData) ──
  const catCounts = useMemo(() => {
    const counts: Record<string, number> = { all: enrichedNodes.length }
    for (const n of enrichedNodes) counts[n._cat] = (counts[n._cat] ?? 0) + 1
    return counts
  }, [enrichedNodes])

  // ── Active connections = links within the visible filtered graph ──
  const activeConnections = useMemo(() => graphData.links.length, [graphData.links])

  // ── Mount force-graph (once) ──
  useEffect(() => {
    if (!containerRef.current) return

    const fg = ForceGraph()(containerRef.current)
    fgRef.current = fg

    fg
      .width(containerRef.current.clientWidth)
      .height(containerRef.current.clientHeight)
      .backgroundColor(gt.graphBg)
      .nodeId('id')
      .nodeLabel(() => '')
      .linkCurvature(0.1)
      .linkCanvasObjectMode(() => 'replace')
      .linkCanvasObject((link: Record<string, unknown>, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const src = link.source as Record<string, unknown>
        const tgt = link.target as Record<string, unknown>
        const sx = src?.x as number, sy = src?.y as number
        const tx = tgt?.x as number, ty = tgt?.y as number
        if (sx == null || sy == null || tx == null || ty == null) return

        const lw       = 1 / globalScale   // 1px on screen at any zoom
        const arrowLen = 5 / globalScale   // 5px arrowhead on screen
        const color    = 'rgba(148,163,184,0.65)'

        // Line
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(tx, ty)
        ctx.strokeStyle = color
        ctx.lineWidth   = lw
        ctx.stroke()

        // Arrowhead at target
        const angle = Math.atan2(ty - sy, tx - sx)
        const ax = tx - arrowLen * Math.cos(angle)
        const ay = ty - arrowLen * Math.sin(angle)
        ctx.beginPath()
        ctx.moveTo(tx, ty)
        ctx.lineTo(
          ax - arrowLen * 0.4 * Math.cos(angle - Math.PI / 2),
          ay - arrowLen * 0.4 * Math.sin(angle - Math.PI / 2),
        )
        ctx.lineTo(
          ax - arrowLen * 0.4 * Math.cos(angle + Math.PI / 2),
          ay - arrowLen * 0.4 * Math.sin(angle + Math.PI / 2),
        )
        ctx.closePath()
        ctx.fillStyle = color
        ctx.fill()

        // Relationship type label — only draw when zoomed in enough to read it
        if (globalScale >= 0.35 && link.type) {
          const mx = (sx + tx) / 2
          const my = (sy + ty) / 2
          const labelSize = 7 / globalScale
          ctx.save()
          ctx.font = `600 ${labelSize}px Inter, system-ui, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const labelText = String(link.type)
          const tw = ctx.measureText(labelText).width
          const padX = 3 / globalScale
          const padY = 2 / globalScale
          ctx.fillStyle = 'rgba(15,23,42,0.82)'
          ctx.fillRect(mx - tw / 2 - padX, my - labelSize / 2 - padY, tw + padX * 2, labelSize + padY * 2)
          ctx.fillStyle = 'rgba(148,163,184,0.92)'
          ctx.fillText(labelText, mx, my)
          ctx.restore()
        }
      })
      .d3AlphaDecay(0.04)
      .d3VelocityDecay(0.45)
      .onEngineStop(() => { fgRef.current?.zoomToFit(400, 60) })
      .nodeCanvasObject((node: Record<string, unknown>, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const x = node.x as number
        const y = node.y as number
        if (x == null || y == null) return

        const isSelected = selectedIdRef.current === node.id
        const color = (node._color as string | undefined) ?? '#6b7280'

        // All sizes are divided by globalScale so they stay constant in screen-pixels
        const r        = 5 / globalScale         // 5px on screen
        const lw       = 1.5 / globalScale       // stroke width
        const lw2      = 2.5 / globalScale       // selected stroke
        const gap      = 2 / globalScale         // gap between circle and label
        const fontSize = 9 / globalScale         // 9px label on screen

        ctx.save()

        // Glow (shadowBlur is CSS-space, not world-space — no globalScale divide)
        ctx.shadowColor = color
        ctx.shadowBlur = isSelected ? 12 : 3

        // Fill
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fillStyle = color + '28'
        ctx.fill()

        // Ring
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.strokeStyle = isSelected ? color : color + 'cc'
        ctx.lineWidth = isSelected ? lw2 : lw
        ctx.stroke()
        ctx.shadowBlur = 0

        // Label — show only when zoom is enough that text is legible
        // globalScale >= 0.25 keeps labels off when 1000+ nodes are squished together
        const showLabel = globalScale >= 0.25 && !isSelected
        if (showLabel) {
          const label = String(node.label ?? node.id ?? '').substring(0, 20)
          ctx.font = `${fontSize}px Inter, system-ui, sans-serif`
          ctx.fillStyle = color + '99'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.fillText(label, x, y + r + gap)
          ctx.textBaseline = 'alphabetic'
        }

        // Selected pill — always shown
        if (isSelected) {
          const label = String(node.label ?? node.id ?? '').substring(0, 26)
          ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`
          const tw  = ctx.measureText(label).width
          const ph  = fontSize + 6 / globalScale
          const pw  = tw + 14 / globalScale
          const px  = x + r + 4 / globalScale
          const py  = y - ph / 2

          roundRectPath(ctx, px, py, pw, ph, 3 / globalScale)
          ctx.fillStyle = color
          ctx.fill()

          ctx.fillStyle = '#ffffff'
          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.fillText(label, px + 7 / globalScale, y)
          ctx.textBaseline = 'alphabetic'
        }

        ctx.restore()
      })
      .nodePointerAreaPaint((node: Record<string, unknown>, color: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const x = node.x as number
        const y = node.y as number
        if (x == null || y == null) return
        // Hit area slightly larger than visual radius for easy clicking
        const r = 8 / globalScale
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
      })
      .onNodeHover((node: Record<string, unknown> | null) => {
        containerRef.current!.style.cursor = node ? 'pointer' : 'default'
        setHoveredNode(node as (OntologyNode & { _color: string; _dim: boolean }) | null)
      })
      .onNodeClick((node: Record<string, unknown>) => {
        const newId = selectedIdRef.current === node.id ? null : node.id as string
        setSelectedId(newId)
        setSelectedLink(null)
        onNodeClick(node as unknown as OntologyNode)
      })
      .onLinkClick((link: Record<string, unknown>) => {
        setSelectedLink({ ...link })
        setSelectedId(null)
      })
      .onBackgroundClick(() => {
        setSelectedId(null)
        setSelectedLink(null)
      })

    // Compact charge so 67 nodes stay within the viewport (–200 was too repulsive)
    const chargeForce = fg.d3Force('charge') as { strength: (s: number) => void } | null
    chargeForce?.strength?.(-80)

    // Shorter link distance so connected nodes cluster visually
    const linkForce = fg.d3Force('link') as { distance: (d: number) => void } | null
    linkForce?.distance?.(45)

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        fg.width(containerRef.current.clientWidth)
        fg.height(containerRef.current.clientHeight)
      }
    })
    ro.observe(containerRef.current)

    // Mouse move for tooltip position
    const onMouseMove = (e: MouseEvent) => {
      setTooltipPos({ x: e.clientX, y: e.clientY })
    }
    containerRef.current.addEventListener('mousemove', onMouseMove)

    return () => {
      ro.disconnect()
      containerRef.current?.removeEventListener('mousemove', onMouseMove)
      // force-graph cleanup
      try { (fg as unknown as { _destructor?: () => void })._destructor?.() } catch {}
    }
  }, []) // mount once — intentionally empty deps

  // ── Update graph data when nodes/links/category change ──
  useEffect(() => {
    fgRef.current?.graphData(graphData)
  }, [graphData])

  // ── Update canvas background when theme changes ──
  useEffect(() => {
    fgRef.current?.backgroundColor(gt.graphBg)
  }, [gt.graphBg])

  // ── Apply layout mode (pin fx/fy on internal simulation nodes) ──
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return

    // Small delay to let graphData settle
    const timer = setTimeout(() => {
      const gd = fg.graphData() as { nodes: Record<string, unknown>[]; links: unknown[] }
      if (!gd.nodes.length) return

      gd.nodes.forEach(n => {
        if (layoutMode === 'vertical') {
          n.fy = CAT_Y[n._cat as string] ?? 0
          n.fx = undefined
        } else if (layoutMode === 'horizontal') {
          n.fx = CAT_X[n._cat as string] ?? 0
          n.fy = undefined
        } else {
          n.fx = undefined
          n.fy = undefined
        }
      })

      fg.d3ReheatSimulation()
    }, 80)

    return () => clearTimeout(timer)
  }, [layoutMode, graphData]) // re-apply when graphData changes too (e.g., category filter)

  // ── Zoom to fit after category or layout change (fallback — onEngineStop is primary) ──
  useEffect(() => {
    const timer = setTimeout(() => {
      fgRef.current?.zoomToFit(500, 60)
    }, 1400)
    return () => clearTimeout(timer)
  }, [activeCategory, layoutMode])

  // ── Handlers ──
  const handleCategoryClick = useCallback((cat: CategoryId) => {
    setActiveCategory(cat)
    setSelectedId(null)
    setSelectedLink(null)
  }, [])

  const handleGoToNode = useCallback((node: OntologyNode) => {
    setSelectedLink(null)
    setSelectedId(node.id)
    onNodeClick(node)
    // Center on the node
    const gd = fgRef.current?.graphData() as { nodes: Record<string, unknown>[] } | undefined
    const internalNode = gd?.nodes.find(n => n.id === node.id)
    if (internalNode?.x != null && internalNode?.y != null) {
      fgRef.current?.centerAt(internalNode.x as number, internalNode.y as number, 600)
      fgRef.current?.zoom(3, 600)
    }
  }, [onNodeClick])

  // ── Render helpers ──
  const activeCat = SMARTSCAPE_CATEGORIES.find(c => c.id === activeCategory)
  const activeCatColor = activeCat?.color ?? gt.accent
  const maxCount = Math.max(1, ...Object.values(catCounts))

  // ── Collapsible section header ──
  const SectionHeader = ({
    label, open, onToggle, children,
  }: { label: string; open: boolean; onToggle: () => void; children?: React.ReactNode }) => (
    <div style={{ flexShrink: 0 }}>
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, width: '100%',
          padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer',
          color: gt.sectionLabel, fontSize: 9, fontWeight: 700,
          textTransform: 'uppercase' as const, letterSpacing: '1.5px',
          borderBottom: open ? `1px solid ${gt.divider}` : 'none',
        }}
      >
        <span style={{ fontSize: 9, color: gt.mutedText, transition: 'transform 0.15s', display: 'inline-block', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▾</span>
        {label}
        {children}
      </button>
    </div>
  )

  // ── Node types section (collapsible) ──
  const NodeTypesSection = () => {
    const [open, setOpen] = useState(true)
    const count = catCounts.all ?? 0
    const isAllActive = activeCategory === 'all'

    return (
      <div style={{ flexShrink: 0 }}>
        <SectionHeader label="Node types" open={open} onToggle={() => setOpen(o => !o)}>
          <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: gt.panelSubtext, textTransform: 'none' as const, letterSpacing: 0 }}>
            {count}
          </span>
        </SectionHeader>

        {open && (
          <div>
            {/* All tile */}
            <div
              onClick={() => handleCategoryClick('all')}
              style={{
                padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                background: isAllActive ? 'rgba(99,102,241,0.09)' : 'transparent',
                borderLeft: isAllActive ? '3px solid #6366f1' : '3px solid transparent',
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => { if (!isAllActive) (e.currentTarget as HTMLElement).style.background = gt.rowHover }}
              onMouseLeave={e => { if (!isAllActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <div style={{ width: 10, height: 10, borderRadius: 2, border: '2px solid #6366f1', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: isAllActive ? '#6366f1' : gt.panelText }}>All Entities</span>
                  <span style={{ fontSize: 11, fontWeight: isAllActive ? 700 : 400, color: isAllActive ? '#6366f1' : gt.panelSubtext }}>{count}</span>
                </div>
                {isAllActive && <div style={{ fontSize: 9, color: gt.mutedText, marginTop: 2 }}>{count} nodes · {links.length} connections</div>}
              </div>
              <div style={{ width: 4, height: Math.max(4, 40 * (count / maxCount)), background: '#6366f1', borderRadius: 2, flexShrink: 0, transform: 'skewY(-20deg)' }} />
            </div>

            {/* Category tiles */}
            {SMARTSCAPE_CATEGORIES.map(cat => {
              const catCount = catCounts[cat.id] ?? 0
              const isActive = activeCategory === cat.id
              const barH = Math.max(4, 40 * (catCount / maxCount))
              return (
                <div
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat.id)}
                  style={{
                    padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                    background: isActive ? cat.color + '12' : 'transparent',
                    borderLeft: isActive ? `3px solid ${cat.color}` : '3px solid transparent',
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = gt.rowHover }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: 2, border: `2px solid ${cat.color}`, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: isActive ? cat.color : gt.panelText }}>{cat.label}</span>
                      <span style={{ fontSize: 11, fontWeight: isActive ? 700 : 400, color: isActive ? cat.color : gt.panelSubtext }}>{catCount}</span>
                    </div>
                    {isActive && (
                      <div style={{ fontSize: 9, color: gt.mutedText, marginTop: 2 }}>{catCount} nodes · {activeConnections} connections</div>
                    )}
                  </div>
                  <div style={{ width: 4, height: barH, background: cat.color, borderRadius: 2, flexShrink: 0, transform: 'skewY(-20deg)' }} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Graph layout section (collapsible) ──
  const LayoutSection = () => {
    const [open, setOpen] = useState(true)
    return (
      <div style={{ flexShrink: 0 }}>
        <SectionHeader label="Graph layout" open={open} onToggle={() => setOpen(o => !o)} />
        {open && (
          <div style={{ padding: '6px 16px 10px', display: 'flex', gap: 4 }}>
            {(['force', 'vertical', 'horizontal'] as LayoutMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setLayoutMode(mode)}
                style={{
                  flex: 1, padding: '5px 4px', fontSize: 9, fontWeight: 600, cursor: 'pointer',
                  background: layoutMode === mode ? gt.accentBg : gt.panelCard,
                  border: `1px solid ${layoutMode === mode ? gt.accentBorder : gt.panelCardBorder}`,
                  borderRadius: 5, color: layoutMode === mode ? gt.accent : gt.panelSubtext,
                  transition: 'all 0.15s',
                }}
              >
                {mode === 'force' ? 'Force' : mode === 'vertical' ? 'Vert.' : 'Horiz.'}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', overflow: 'hidden', background: gt.graphBg }}>

      {/* ── Left Sidebar ── */}
      <div style={{
        width: sidebarCollapsed ? 40 : 244,
        flexShrink: 0,
        background: gt.filterBg,
        borderRight: `1px solid ${gt.filterBorder}`,
        display: 'flex',
        flexDirection: 'column',
        overflowY: sidebarCollapsed ? 'hidden' : 'auto',
        overflowX: 'hidden',
        transition: 'width 0.22s ease',
        position: 'relative',
      }}>

        {/* Collapse/expand toggle button — always visible */}
        <button
          onClick={() => setSidebarCollapsed(c => !c)}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            position: 'absolute', top: 10, right: 8, zIndex: 10,
            width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: gt.panelCard, border: `1px solid ${gt.panelCardBorder}`,
            borderRadius: 6, cursor: 'pointer', color: gt.panelSubtext,
            fontSize: 11, flexShrink: 0, transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = gt.accentBg; el.style.color = gt.accent; el.style.borderColor = gt.accentBorder
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = gt.panelCard; el.style.color = gt.panelSubtext; el.style.borderColor = gt.panelCardBorder
          }}
        >
          {sidebarCollapsed ? '›' : '‹'}
        </button>

        {/* Collapsed state — vertical label only */}
        {sidebarCollapsed ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 48, gap: 6 }}>
            <div style={{
              writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)',
              fontSize: 9, fontWeight: 800, color: gt.sectionLabel,
              textTransform: 'uppercase', letterSpacing: '2px',
            }}>Smartscape</div>
            {activeCategory !== 'all' && (
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: activeCatColor, marginTop: 8,
              }} />
            )}
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding: '14px 40px 10px 16px', borderBottom: `1px solid ${gt.filterBorder}`, flexShrink: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: gt.sectionLabel, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 2 }}>Smartscape</div>
              <div style={{ fontSize: 9, color: gt.mutedText }}>Enterprise Ontology Topology</div>
            </div>

            {/* Breadcrumb */}
            <div style={{ padding: '5px 16px', borderBottom: `1px solid ${gt.filterBorder}`, display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, flexShrink: 0 }}>
              <span
                style={{ color: activeCategory !== 'all' ? gt.accent : gt.mutedText, cursor: activeCategory !== 'all' ? 'pointer' : 'default' }}
                onClick={() => activeCategory !== 'all' && handleCategoryClick('all')}
              >All</span>
              {activeCategory !== 'all' && (
                <>
                  <span style={{ color: gt.mutedText }}>›</span>
                  <span style={{ color: activeCatColor, fontWeight: 700 }}>{activeCat?.label ?? activeCategory}</span>
                </>
              )}
            </div>

            {/* Project search / focus section */}
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${gt.filterBorder}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: gt.sectionLabel, textTransform: 'uppercase' as const, letterSpacing: '1.5px' }}>
                  Project Focus
                </span>
                {projectFocus && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: '#22c55e',
                    background: '#22c55e18', borderRadius: 4, padding: '1px 5px',
                  }}>active</span>
                )}
                {projectSearchLoading && (
                  <span style={{ fontSize: 9, color: gt.mutedText, marginLeft: 'auto' }}>…</span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search project or app…"
                  value={projectSearch}
                  onChange={e => setProjectSearch(e.target.value)}
                  style={{
                    width: '100%', padding: '6px 8px', boxSizing: 'border-box' as const,
                    background: gt.inputBg, border: `1px solid ${gt.inputBorder}`,
                    borderRadius: 6, color: gt.inputText, fontSize: 11, outline: 'none',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => { e.target.style.borderColor = gt.inputBorderFocus }}
                  onBlur={e => { e.target.style.borderColor = gt.inputBorder }}
                />
                {projectSearchResults.length > 0 && projectSearch.trim() && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: gt.filterBg, border: `1px solid ${gt.panelCardBorder}`,
                    borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
                    maxHeight: 180, overflowY: 'auto', marginTop: 2,
                  }}>
                    {projectSearchResults.map(r => (
                      <div
                        key={r.id}
                        onClick={() => { handleProjectSelect(r.label) }}
                        style={{
                          padding: '7px 10px', cursor: 'pointer', fontSize: 11,
                          color: gt.panelText, display: 'flex', alignItems: 'center', gap: 6,
                          transition: 'background 0.12s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = gt.rowHover }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        <span style={{
                          fontSize: 9, color: gt.accent, background: gt.accentBg,
                          borderRadius: 3, padding: '1px 5px', flexShrink: 0, fontWeight: 700,
                        }}>{r.type}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {projectFocus && (
                <button
                  onClick={handleClearProjectFocus}
                  style={{
                    marginTop: 6, width: '100%', padding: '4px 0', fontSize: 10, fontWeight: 600,
                    background: 'transparent', border: `1px solid ${gt.divider}`, borderRadius: 5,
                    color: gt.mutedText, cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = gt.accentBorder
                    e.currentTarget.style.color = gt.accent
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = gt.divider
                    e.currentTarget.style.color = gt.mutedText
                  }}
                >← Back to Org View</button>
              )}
            </div>

            {/* Node types section with expand/collapse */}
            <NodeTypesSection />

            <div style={{ margin: '8px 16px', borderTop: `1px solid ${gt.divider}`, flexShrink: 0 }} />

            {/* Graph layout section with expand/collapse */}
            <LayoutSection />

            <div style={{ flex: 1 }} />

            {/* Categories legend (always visible at bottom) */}
            <div style={{ padding: '10px 16px 12px', borderTop: `1px solid ${gt.divider}`, flexShrink: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: gt.sectionLabel, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 6 }}>Legend</div>
              {SMARTSCAPE_CATEGORIES.map(cat => (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: cat.color + '99', border: `1.5px solid ${cat.color}`, flexShrink: 0 }} />
                  <span style={{ fontSize: 9, color: gt.panelSubtext }}>{cat.label}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Main canvas ── */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {/* Back Button (shown when in drill-down mode) */}
        {isDrillDown && (
          <button
            onClick={popDrillDown}
            style={{
              position: 'absolute', top: 16, left: 16, zIndex: 15,
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
              background: gt.panelCard, border: `1px solid ${gt.panelCardBorder}`,
              color: gt.panelText, fontSize: 12, fontWeight: 700,
              boxShadow: '0 2px 12px rgba(0,0,0,0.3)', transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = gt.accentBg
              e.currentTarget.style.color = gt.accent
              e.currentTarget.style.borderColor = gt.accentBorder
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = gt.panelCard
              e.currentTarget.style.color = gt.panelText
              e.currentTarget.style.borderColor = gt.panelCardBorder
            }}
          >
            ← Back
          </button>
        )}

        {/* Breadcrumb Navigation (shown when in drill-down mode) */}
        {isDrillDown && (
          <div style={{
            position: 'absolute', top: 60, left: 16, right: 16, zIndex: 14,
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            background: gt.panelCard + 'dd', backdropFilter: 'blur(8px)',
            border: `1px solid ${gt.panelCardBorder}`,
            borderRadius: 8, padding: '8px 12px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
          }}>
            <button
              onClick={clearDrillDownStack}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'none', border: 'none', cursor: 'pointer',
                color: gt.panelSubtext, fontSize: 11, fontWeight: 600,
                padding: '2px 6px', borderRadius: 4, transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = gt.accentBg
                e.currentTarget.style.color = gt.accent
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = gt.panelSubtext
              }}
            >
              🏠 Org View
            </button>
            {drillDownStack.map((level, index) => {
              const cat = getCategoryFor(level.nodeType)
              const isLast = index === drillDownStack.length - 1
              return (
                <React.Fragment key={level.nodeId}>
                  <span style={{ color: gt.mutedText, fontSize: 11 }}>›</span>
                  <button
                    onClick={() => !isLast && jumpToDrillDownLevel(index)}
                    disabled={isLast}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      background: isLast ? gt.accentBg : 'none',
                      border: 'none', cursor: isLast ? 'default' : 'pointer',
                      color: isLast ? gt.accent : gt.panelSubtext,
                      fontSize: 11, fontWeight: isLast ? 700 : 600,
                      padding: '2px 6px', borderRadius: 4, transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      if (!isLast) {
                        e.currentTarget.style.background = gt.accentBg
                        e.currentTarget.style.color = gt.accent
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isLast) {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = gt.panelSubtext
                      }
                    }}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: cat?.color ?? '#6b7280' }} />
                    {level.nodeLabel}
                  </button>
                </React.Fragment>
              )
            })}
          </div>
        )}

        {/* Loading overlay (shown when drilling down) */}
        {isDrillingDown && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 30,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)',
          }}>
            <div style={{
              background: gt.panelCard, border: `1px solid ${gt.panelCardBorder}`,
              borderRadius: 12, padding: '20px 28px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 40, height: 40, border: `3px solid ${gt.panelCardBorder}`,
                borderTop: `3px solid ${gt.accent}`, borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              <div style={{ fontSize: 13, fontWeight: 600, color: gt.panelText }}>Loading subgraph...</div>
            </div>
          </div>
        )}

        {/* Hover tooltip */}
        {hoveredNode && (
          <div style={{
            position: 'fixed',
            left: tooltipPos.x + 14,
            top: tooltipPos.y - 10,
            background: gt.tooltipBg,
            border: `1px solid ${gt.tooltipBorder}`,
            borderRadius: 8, padding: '7px 11px',
            pointerEvents: 'none', zIndex: 50,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            maxWidth: 220,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: gt.tooltipText, marginBottom: 2 }}>
              {String(hoveredNode.label ?? hoveredNode.id ?? '').substring(0, 36)}
            </div>
            <div style={{ fontSize: 9, color: hoveredNode._color, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              {hoveredNode.node_type}
            </div>
          </div>
        )}

        {/* Node action bar — shown when a node is selected */}
        {selectedId && (() => {
          const selNode = enrichedNodes.find(n => n.id === selectedId)
          if (!selNode) return null
          const cat = SMARTSCAPE_CATEGORIES.find(c => c.id === selNode._cat)
          return (
            <div style={{
              position: 'absolute', bottom: 68, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', alignItems: 'center', gap: 8,
              background: gt.tooltipBg, border: `1px solid ${(cat?.color ?? gt.accentBorder)}55`,
              borderRadius: 10, padding: '8px 12px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              zIndex: 15, pointerEvents: 'all',
              animation: 'ssDrawerIn 0.15s ease-out',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat?.color ?? '#6b7280', flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: gt.panelText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                  {selNode.label || selNode.id}
                </div>
                <div style={{ fontSize: 9, color: cat?.color ?? gt.mutedText, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700 }}>
                  {selNode.node_type}
                </div>
              </div>
              <button
                onClick={() => handleOpenInWorkspace(selNode)}
                style={{
                  padding: '6px 11px', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  border: 'none', color: '#fff', whiteSpace: 'nowrap',
                  boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
                }}
              >⊞ Open in Workspace</button>
              <button
                onClick={() => setSelectedId(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: gt.mutedText, fontSize: 14, padding: '2px 4px', lineHeight: 1 }}
              >✕</button>
            </div>
          )
        })()}

        {/* Zoom controls */}
        <div style={{
          position: 'absolute', bottom: 20,
          right: selectedLink ? 376 : 20,
          display: 'flex', flexDirection: 'column', gap: 4,
          transition: 'right 0.2s ease',
        }}>
          {[
            { label: '+', title: 'Zoom in',      action: () => { const fg = fgRef.current; if (fg) fg.zoom((fg.zoom() ?? 1) * 1.35, 300) } },
            { label: '−', title: 'Zoom out',     action: () => { const fg = fgRef.current; if (fg) fg.zoom((fg.zoom() ?? 1) / 1.35, 300) } },
            { label: '⤢', title: 'Fit to screen', action: () => fgRef.current?.zoomToFit(400, 80) },
          ].map(({ label, title, action }) => (
            <button
              key={label}
              onClick={action}
              title={title}
              style={{
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: gt.panelCard, border: `1px solid ${gt.panelCardBorder}`,
                borderRadius: 8, color: gt.panelText, cursor: 'pointer',
                fontSize: label === '⤢' ? 14 : 16, fontWeight: 700,
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)', transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.background = gt.accentBg
                el.style.color = gt.accent
                el.style.borderColor = gt.accentBorder
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.background = gt.panelCard
                el.style.color = gt.panelText
                el.style.borderColor = gt.panelCardBorder
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Category label overlay when a category is selected (non-project mode) */}
        {activeCategory !== 'all' && activeCat && !projectFocus && (
          <div style={{
            position: 'absolute', top: 16, left: 16,
            display: 'flex', alignItems: 'center', gap: 8,
            background: gt.tooltipBg, border: `1px solid ${activeCat.color}44`,
            borderRadius: 8, padding: '6px 12px',
            pointerEvents: 'none',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: activeCat.color }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: activeCat.color }}>{activeCat.label}</span>
            <span style={{ fontSize: 10, color: gt.panelSubtext }}>{catCounts[activeCategory] ?? 0} nodes</span>
          </div>
        )}

        {/* Layer filter chips — shown only in project focus mode */}
        {projectFocus && (
          <div style={{
            position: 'absolute', top: 12, left: 12, right: 12,
            display: 'flex', gap: 5, flexWrap: 'wrap', zIndex: 10,
          }}>
            <button
              onClick={() => setActiveCategory('all')}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                background: activeCategory === 'all' ? '#6366f1' : gt.panelCard,
                border: `1px solid ${activeCategory === 'all' ? '#6366f1' : gt.panelCardBorder}`,
                color: activeCategory === 'all' ? '#fff' : gt.panelSubtext,
                boxShadow: '0 1px 6px rgba(0,0,0,0.3)', transition: 'all 0.15s',
              }}
            >All Layers</button>
            {SMARTSCAPE_CATEGORIES.filter(c => (catCounts[c.id] ?? 0) > 0).map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(activeCategory === cat.id ? 'all' : cat.id)}
                style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                  background: activeCategory === cat.id ? cat.color : gt.panelCard,
                  border: `1px solid ${activeCategory === cat.id ? cat.color : gt.panelCardBorder}`,
                  color: activeCategory === cat.id ? '#fff' : gt.panelSubtext,
                  boxShadow: '0 1px 6px rgba(0,0,0,0.3)', transition: 'all 0.15s',
                }}
              >
                {cat.label} <span style={{ opacity: 0.75 }}>({catCounts[cat.id] ?? 0})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Relationship Drawer ── */}
      {selectedLink && (
        <SmartscapeRelationshipDrawer
          link={selectedLink}
          onClose={() => setSelectedLink(null)}
          onGoToSource={handleGoToNode}
          onGoToTarget={handleGoToNode}
          onOpenInWorkspace={handleOpenInWorkspace}
          onDrillDownToTarget={pushDrillDown}
          gt={gt}
        />
      )}

      {/* ── Project Panel ── */}
      {projectFocus && !selectedLink && (
        <SmartscapeProjectPanel
          projectFocus={projectFocus}
          nodes={nodes}
          links={links as OntologyLink[]}
          catCounts={catCounts}
          gt={gt}
          onClose={handleClearProjectFocus}
        />
      )}
    </div>
  )
}
