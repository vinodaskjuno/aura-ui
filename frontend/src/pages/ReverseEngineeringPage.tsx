import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  ScanSearch, Loader2, RefreshCw, GitBranch, Layers,
  Code2, Database, Server, ArrowRight, ChevronRight,
  GitFork, Box,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  Treemap, Sankey,
} from 'recharts'
import { projectsApi, type Project, type KnowledgeGraph } from '../api/projects'
import { listServices, type ServiceRecord } from '../api/repoLoader'
import ProjectsPanel from '../components/dev-chat/ProjectsPanel'
import SOPTab from '../components/sop/SOPTab'

// ── Language color map ────────────────────────────────────────────────────────
const LANG_COLORS: Record<string, string> = {
  TypeScript:   '#3178c6',
  JavaScript:   '#f7df1e',
  Python:       '#3776ab',
  Java:         '#ed8b00',
  Go:           '#00aed8',
  Rust:         '#ce422b',
  Kotlin:       '#7f52ff',
  Terraform:    '#5c4ee5',
  YAML:         '#cb171e',
  JSON:         '#6b7280',
  Shell:        '#4eaa25',
  Groovy:       '#4298b8',
  XML:          '#f97316',
  RAML:         '#8b5cf6',
  SQL:          '#f59e0b',
  Other:        '#6b7280',
}

const TECH_COLORS = [
  '#4f8ef7', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#a78bfa',
]

type RETab = 'architecture' | 'api-map' | 'code' | 'data-flow' | 'sop'

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 14,
      color: 'var(--color-muted)', padding: 48 }}>
      <ScanSearch size={48} style={{ opacity: 0.25 }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-subtext)', marginBottom: 6 }}>
          Select a project to begin analysis
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-muted)', maxWidth: 280, lineHeight: 1.6 }}>
          Choose a project from the left panel to view its architecture, API map, code structure, and data flow.
        </div>
      </div>
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <div className="ov-card" style={{ padding: '14px 18px' }}>
      <div style={{ color, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: 26, color }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

// ── Architecture tab ──────────────────────────────────────────────────────────
function ArchitectureTab({ kg, services }: { kg: KnowledgeGraph; services: ServiceRecord[] }) {
  const languages  = kg.code?.languages ?? []
  const techStack  = kg.code?.tech_stack ?? []
  const infra      = kg.infra ?? []
  const dbServers  = kg.db_servers ?? []
  const correlations = kg.correlations ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <KpiCard label="Services"     value={services.length}    icon={<Server size={16} />}   color="#4f8ef7" />
        <KpiCard label="Infra Nodes"  value={infra.length}       icon={<Layers size={16} />}   color="#8b5cf6" />
        <KpiCard label="Databases"    value={dbServers.length}   icon={<Database size={16} />} color="#10b981" />
        <KpiCard label="Correlations" value={correlations.length} icon={<GitBranch size={16} />} color="#f59e0b" />
      </div>

      {/* Tech stack */}
      {techStack.length > 0 && (
        <div className="ov-card" style={{ padding: 16 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>Tech Stack</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {techStack.map((tech, i) => (
              <span key={tech} style={{
                fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
                background: `${TECH_COLORS[i % TECH_COLORS.length]}18`,
                border: `1px solid ${TECH_COLORS[i % TECH_COLORS.length]}44`,
                color: TECH_COLORS[i % TECH_COLORS.length],
              }}>{tech}</span>
            ))}
          </div>
        </div>
      )}

      {/* Languages */}
      {languages.length > 0 && (
        <div className="ov-card" style={{ padding: 16 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>Languages Detected</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {languages.map(lang => {
              const c = LANG_COLORS[lang] ?? LANG_COLORS.Other
              return (
                <span key={lang} style={{
                  fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 6,
                  background: `${c}18`, border: `1px solid ${c}44`, color: c,
                }}>{lang}</span>
              )
            })}
          </div>
        </div>
      )}

      {/* Services list */}
      {services.length > 0 && (
        <div className="ov-card" style={{ padding: 16 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>
            Services ({services.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {services.map(svc => (
              <div key={svc.serviceId} style={{ display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', background: 'var(--color-surface)',
                border: '1px solid var(--color-border)', borderRadius: 8 }}>
                <Box size={14} color="var(--color-primary)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{svc.name}</div>
                  {svc.description && (
                    <div style={{ fontSize: 11, color: 'var(--color-muted)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {svc.description}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {(svc.techStack ?? []).slice(0, 3).map(t => (
                    <span key={t} style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4,
                      background: 'var(--color-card)', border: '1px solid var(--color-border)',
                      color: 'var(--color-muted)' }}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Correlations */}
      {correlations.length > 0 && (
        <div className="ov-card" style={{ padding: 16 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>
            Service Correlations ({correlations.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {correlations.slice(0, 10).map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 12, padding: '6px 10px', borderRadius: 6,
                background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {c.from}
                </span>
                <span style={{ fontSize: 10, padding: '1px 8px', borderRadius: 4,
                  background: '#8b5cf620', border: '1px solid #8b5cf644',
                  color: '#8b5cf6', flexShrink: 0 }}>
                  {c.relationship}
                </span>
                <ArrowRight size={12} color="var(--color-muted)" style={{ flexShrink: 0 }} />
                <span style={{ fontWeight: 600, color: 'var(--color-text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'right' }}>
                  {c.to}
                </span>
              </div>
            ))}
            {correlations.length > 10 && (
              <div style={{ fontSize: 11, color: 'var(--color-muted)', textAlign: 'center', padding: '4px 0' }}>
                +{correlations.length - 10} more correlations
              </div>
            )}
          </div>
        </div>
      )}

      {languages.length === 0 && techStack.length === 0 && services.length === 0 && correlations.length === 0 && (
        <div className="ov-card" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 8 }}>
            No architecture data found for this project.
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', opacity: 0.7 }}>
            Run "Analyse Project" to ingest the codebase and extract architecture information.
          </div>
        </div>
      )}
    </div>
  )
}

// ── API Map tab ───────────────────────────────────────────────────────────────
function ApiMapTab({ kg }: { kg: KnowledgeGraph }) {
  const [relFilter, setRelFilter] = useState<string>('all')
  const edges = kg.edges ?? []
  const nodes = kg.nodes ?? []

  const allRelTypes = Array.from(new Set(edges.map((e: any) => (e.relationship ?? e.type ?? 'unknown').toLowerCase())))
  const filterOptions = ['all', ...allRelTypes.slice(0, 5)]

  const filteredEdges = relFilter === 'all'
    ? edges
    : edges.filter((e: any) => (e.relationship ?? e.type ?? '').toLowerCase() === relFilter)

  const getNodeLabel = (id: string) => {
    const node = nodes.find((n: any) => n.id === id || n.uri === id)
    return node ? (node.label ?? node.name ?? id) : id
  }

  if (edges.length === 0) {
    return (
      <div className="ov-card" style={{ padding: 32, textAlign: 'center' }}>
        <GitFork size={32} style={{ opacity: 0.25, margin: '0 auto 10px' }} />
        <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 6 }}>
          No API edges found in the knowledge graph.
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-muted)', opacity: 0.7 }}>
          Run "Analyse Project" to discover service-to-service API relationships.
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Relationship type filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600 }}>Filter:</span>
        <div style={{ display: 'flex', background: 'var(--color-card)',
          borderRadius: 8, padding: 3, border: '1px solid var(--color-border)', gap: 2 }}>
          {filterOptions.map(opt => (
            <button key={opt} onClick={() => setRelFilter(opt)}
              style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: relFilter === opt ? 'var(--color-primary)' : 'transparent',
                color: relFilter === opt ? '#fff' : 'var(--color-muted)',
                border: 'none', cursor: 'pointer', textTransform: 'capitalize',
                transition: 'all 0.15s' }}>
              {opt}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
          {filteredEdges.length} connection{filteredEdges.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Edge cards */}
      <div className="ov-card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {filteredEdges.slice(0, 30).map((edge: any, i: number) => {
            const from = getNodeLabel(edge.from ?? edge.source ?? '')
            const to   = getNodeLabel(edge.to ?? edge.target ?? '')
            const rel  = edge.relationship ?? edge.type ?? 'relates-to'
            const relColor = rel.includes('call') ? '#4f8ef7'
              : rel.includes('store') ? '#10b981'
              : rel.includes('depend') ? '#f59e0b'
              : rel.includes('api') ? '#8b5cf6'
              : '#6b7280'
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 12px', borderRadius: 7,
                background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--color-text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {from}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <div style={{ width: 20, height: 1.5, background: relColor }} />
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                    background: `${relColor}18`, border: `1px solid ${relColor}44`,
                    color: relColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {rel}
                  </span>
                  <ArrowRight size={12} color={relColor} />
                </div>
                <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--color-text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
                  {to}
                </div>
              </div>
            )
          })}
          {filteredEdges.length > 30 && (
            <div style={{ fontSize: 11, color: 'var(--color-muted)', textAlign: 'center', padding: '6px 0' }}>
              +{filteredEdges.length - 30} more connections
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Code Analysis tab ─────────────────────────────────────────────────────────
function CodeAnalysisTab({ services, kg, analysing, onAnalyse }: {
  services: ServiceRecord[]
  kg: KnowledgeGraph
  analysing: boolean
  onAnalyse: () => void
}) {
  const totalApis  = services.reduce((s, r) => s + (r.ontologyStats?.apis_count ?? 0), 0)
  const totalDBs   = services.reduce((s, r) => s + (r.ontologyStats?.databases_count ?? 0), 0)
  const totalDeps  = services.reduce((s, r) => s + (r.ontologyStats?.dependencies_count ?? 0), 0)

  const languages = kg.code?.languages ?? []
  const techStack = kg.code?.tech_stack ?? []

  const langPieData = languages.map((lang, i) => ({
    name: lang,
    value: 1,
    color: LANG_COLORS[lang] ?? TECH_COLORS[i % TECH_COLORS.length],
  }))

  const treemapData = techStack.map((tech, i) => ({
    name: tech,
    size: 1,
    color: TECH_COLORS[i % TECH_COLORS.length],
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Aggregate stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        <KpiCard label="API Endpoints"  value={totalApis}  icon={<GitBranch size={16} />} color="#4f8ef7" />
        <KpiCard label="Databases"      value={totalDBs}   icon={<Database size={16} />}  color="#10b981" />
        <KpiCard label="Dependencies"   value={totalDeps}  icon={<Layers size={16} />}    color="#8b5cf6" />
      </div>

      {/* Language distribution */}
      {langPieData.length > 0 && (
        <div className="ov-card" style={{ padding: 16 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>Language Distribution</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={langPieData} cx={65} cy={65} innerRadius={30} outerRadius={60}
                  dataKey="value" strokeWidth={0}>
                  {langPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    borderRadius: 6, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {langPieData.map(l => (
                <div key={l.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color, flexShrink: 0 }} />
                  <span style={{ color: 'var(--color-text)', flex: 1 }}>{l.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tech stack treemap */}
      {treemapData.length > 0 && (
        <div className="ov-card" style={{ padding: 16 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>Tech Stack Composition</div>
          <ResponsiveContainer width="100%" height={160}>
            <Treemap
              data={treemapData}
              dataKey="size"
              nameKey="name"
              content={({ x, y, width, height, name, index }: any) => (
                width > 20 && height > 20 ? (
                  <g>
                    <rect x={x} y={y} width={width} height={height}
                      fill={TECH_COLORS[(index ?? 0) % TECH_COLORS.length]}
                      fillOpacity={0.7} rx={4} />
                    {width > 50 && (
                      <text x={x + width / 2} y={y + height / 2} textAnchor="middle"
                        dominantBaseline="middle" fill="#fff" fontSize={11} fontWeight={600}>
                        {name}
                      </text>
                    )}
                  </g>
                ) : <g />
              )}
            />
          </ResponsiveContainer>
        </div>
      )}

      {/* Services detail */}
      {services.length > 0 && (
        <div className="ov-card" style={{ padding: 16 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>Services Breakdown</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {services.map(svc => {
              const apis = svc.ontologyStats?.apis_count ?? 0
              const dbs  = svc.ontologyStats?.databases_count ?? 0
              const deps = svc.ontologyStats?.dependencies_count ?? 0
              return (
                <div key={svc.serviceId} style={{ padding: '8px 12px',
                  background: 'var(--color-surface)', borderRadius: 8,
                  border: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', flex: 1 }}>
                      {svc.name}
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                      background: svc.status === 'ingested' ? '#10b98120' : '#f59e0b20',
                      color: svc.status === 'ingested' ? '#10b981' : '#f59e0b',
                      border: `1px solid ${svc.status === 'ingested' ? '#10b98144' : '#f59e0b44'}`,
                      textTransform: 'uppercase' }}>
                      {svc.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--color-muted)' }}>
                    <span><strong style={{ color: '#4f8ef7' }}>{apis}</strong> APIs</span>
                    <span><strong style={{ color: '#10b981' }}>{dbs}</strong> DBs</span>
                    <span><strong style={{ color: '#8b5cf6' }}>{deps}</strong> deps</span>
                    <span><strong style={{ color: '#f59e0b' }}>{svc.repoCount}</strong> repos</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Placeholder insight cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[
          { label: 'Code Complexity', note: 'Automated complexity scoring — coming soon', color: '#f59e0b', icon: <Code2 size={16} /> },
          { label: 'Security Debt',   note: 'Sensitive data flow analysis — coming soon', color: '#ef4444', icon: <Server size={16} /> },
        ].map(item => (
          <div key={item.label} className="ov-card" style={{ padding: 16 }}>
            <div style={{ color: item.color, marginBottom: 8 }}>{item.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-subtext)', marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{item.note}</div>
          </div>
        ))}
      </div>

      {/* Re-analyse button */}
      <button className="ov-btn ov-btn-primary" onClick={onAnalyse} disabled={analysing}
        style={{ alignSelf: 'flex-start', gap: 8, fontSize: 13 }}>
        {analysing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />}
        {analysing ? 'Analysing…' : 'Re-Analyse Codebase'}
      </button>
    </div>
  )
}

// ── Data Flow tab ─────────────────────────────────────────────────────────────
function DataFlowTab({ kg, services }: { kg: KnowledgeGraph; services: ServiceRecord[] }) {
  const dbServers = kg.db_servers ?? []
  const edges     = kg.edges ?? []

  const nodeNames: string[] = [
    'External Clients',
    ...services.map(s => s.name),
    ...(dbServers as any[]).map((db: any) => db.name ?? db.label ?? 'Database'),
  ]

  const nameToIdx: Record<string, number> = Object.fromEntries(nodeNames.map((n, i) => [n, i]))
  const sankeyNodes = nodeNames.map(name => ({ name }))

  const FLOW_RELS = new Set(['calls', 'stores_in', 'connects_to', 'depends_on', 'uses'])
  let sankeyLinks = edges
    .filter((e: any) => FLOW_RELS.has((e.relationship ?? e.type ?? '').toLowerCase()))
    .map((e: any) => ({
      source: nameToIdx[e.from ?? e.source] ?? 0,
      target: nameToIdx[e.to ?? e.target] ?? 1,
      value:  1,
    }))
    .filter((l: any) => l.source !== l.target
      && l.source >= 0 && l.source < nodeNames.length
      && l.target >= 0 && l.target < nodeNames.length)

  // Synthetic fallback when no edges
  if (sankeyLinks.length === 0 && services.length > 0) {
    sankeyLinks = [
      { source: 0, target: 1, value: 3 },
      ...services.map((_, i) => ({
        source: i + 1,
        target: Math.min(i + 2, nodeNames.length - 1),
        value: 1,
      })),
    ].filter(l => l.source < nodeNames.length && l.target < nodeNames.length && l.source !== l.target)
  }

  if (nodeNames.length < 2 || sankeyLinks.length === 0) {
    return (
      <div className="ov-card" style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 6 }}>
          Insufficient graph data for data flow diagram.
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-muted)', opacity: 0.7 }}>
          Analyse the project to discover service connections and database relationships.
        </div>
      </div>
    )
  }

  return (
    <div className="ov-card" style={{ padding: 16 }}>
      <div className="section-label" style={{ marginBottom: 6 }}>Data Flow</div>
      <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 12 }}>
        Shows how data flows from entry points through services to data stores.
        {edges.length === 0 && ' (Synthetic fallback — run analysis for actual flow.)'}
      </div>
      <ResponsiveContainer width="100%" height={360}>
        <Sankey
          data={{ nodes: sankeyNodes, links: sankeyLinks }}
          nodePadding={12}
          nodeWidth={12}
          margin={{ top: 10, right: 60, bottom: 10, left: 60 }}
          link={{ stroke: 'var(--color-primary)', strokeOpacity: 0.15, fill: 'var(--color-primary)', fillOpacity: 0.12 }}
          node={{ fill: 'var(--color-primary)', stroke: 'none' }}
        >
          <Tooltip
            contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 6, fontSize: 11 }} />
        </Sankey>
      </ResponsiveContainer>
    </div>
  )
}

// ── Project Analysis view ─────────────────────────────────────────────────────
function ProjectAnalysisView({
  project, kg, services, loading, analysing, onAnalyse, tab, setTab,
}: {
  project: Project
  kg: KnowledgeGraph | null
  services: ServiceRecord[]
  loading: boolean
  analysing: boolean
  onAnalyse: () => void
  tab: RETab
  setTab: (t: RETab) => void
}) {
  const TABS: { id: RETab; label: string; icon: React.ReactNode }[] = [
    { id: 'architecture', label: 'Architecture', icon: <Layers size={13} /> },
    { id: 'api-map',      label: 'API Map',      icon: <GitFork size={13} /> },
    { id: 'code',         label: 'Code Analysis', icon: <Code2 size={13} /> },
    { id: 'data-flow',    label: 'Data Flow',     icon: <GitBranch size={13} /> },
    { id: 'sop',          label: 'SOP',           icon: <ChevronRight size={13} /> },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, gap: 12 }}>
      {/* Project header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
        background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10,
          background: 'var(--color-primary)1a', border: '1.5px solid var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ScanSearch size={18} color="var(--color-primary)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16,
            color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>
            {project.environment && <span style={{ marginRight: 8 }}>{project.environment}</span>}
            {project.description && (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {project.description}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 10,
            background: project.status === 'analyzed' ? '#10b98120' : '#f59e0b20',
            color: project.status === 'analyzed' ? '#10b981' : '#f59e0b',
            border: `1px solid ${project.status === 'analyzed' ? '#10b98144' : '#f59e0b44'}`,
            textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {project.status}
          </span>
          <button className="ov-btn ov-btn-primary" onClick={onAnalyse}
            disabled={analysing} style={{ gap: 7, fontSize: 12 }}>
            {analysing
              ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
              : <RefreshCw size={12} />}
            {analysing ? 'Analysing…' : 'Analyse Project'}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 14px', fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? 'var(--color-primary)' : 'var(--color-subtext)',
              borderBottom: `2px solid ${tab === t.id ? 'var(--color-primary)' : 'transparent'}`,
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: -1 }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 2 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: 200, gap: 10, color: 'var(--color-muted)' }}>
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 13 }}>Loading project data…</span>
          </div>
        ) : (
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}>
            {tab === 'architecture' && kg && (
              <ArchitectureTab kg={kg} services={services} />
            )}
            {tab === 'api-map' && kg && (
              <ApiMapTab kg={kg} />
            )}
            {tab === 'code' && kg && (
              <CodeAnalysisTab services={services} kg={kg} analysing={analysing} onAnalyse={onAnalyse} />
            )}
            {tab === 'data-flow' && kg && (
              <DataFlowTab kg={kg} services={services} />
            )}
            {tab === 'sop' && (
              <SOPTab projectId={project.projectId} stage="reverse_engineering" projectName={project.name} />
            )}
            {!kg && tab !== 'sop' && (
              <div className="ov-card" style={{ padding: 32, textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                  Failed to load knowledge graph data. Try analysing the project first.
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}

// ── Main ReverseEngineeringPage ───────────────────────────────────────────────
export default function ReverseEngineeringPage() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [kg, setKg] = useState<KnowledgeGraph | null>(null)
  const [services, setServices] = useState<ServiceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [analysing, setAnalysing] = useState(false)
  const [tab, setTab] = useState<RETab>('architecture')

  const handleProjectSelect = useCallback(async (project: Project) => {
    setSelectedProject(project)
    setKg(null)
    setServices([])
    setTab('architecture')
    setLoading(true)
    try {
      const [kgRes, svcs] = await Promise.all([
        projectsApi.getKnowledgeGraph(project.projectId),
        listServices(project.projectId),
      ])
      setKg(kgRes.data)
      setServices(svcs)
    } catch { /**/ }
    finally { setLoading(false) }
  }, [])

  const handleAnalyse = useCallback(async () => {
    if (!selectedProject) return
    setAnalysing(true)
    try {
      await projectsApi.analyse(selectedProject.projectId)
      const [kgRes, svcs] = await Promise.all([
        projectsApi.getKnowledgeGraph(selectedProject.projectId),
        listServices(selectedProject.projectId),
      ])
      setKg(kgRes.data)
      setServices(svcs)
    } catch { /**/ }
    finally { setAnalysing(false) }
  }, [selectedProject])

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page header */}
      <div>
        <div className="section-label" style={{ marginBottom: 4 }}>Engineering Intelligence</div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 800,
          display: 'flex', alignItems: 'center', gap: 10 }}>
          <ScanSearch size={22} color="var(--color-primary)" /> Reverse Engineering
        </h2>
      </div>

      {/* Main layout */}
      <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
        {/* Left panel — project selector */}
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column',
          background: 'var(--color-card)', border: '1px solid var(--color-border)',
          borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
            <div className="section-label">Projects</div>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <ProjectsPanel
              onSelect={handleProjectSelect}
              selectedId={selectedProject?.projectId}
            />
          </div>
        </div>

        {/* Right panel — analysis */}
        {selectedProject ? (
          <ProjectAnalysisView
            project={selectedProject}
            kg={kg}
            services={services}
            loading={loading}
            analysing={analysing}
            onAnalyse={handleAnalyse}
            tab={tab}
            setTab={setTab}
          />
        ) : (
          <div style={{ flex: 1, display: 'flex', background: 'var(--color-card)',
            border: '1px solid var(--color-border)', borderRadius: 10 }}>
            <EmptyState />
          </div>
        )}
      </div>
    </div>
  )
}
