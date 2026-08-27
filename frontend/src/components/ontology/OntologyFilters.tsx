import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { OntologyNode } from '../../types/ontology'
import { useGraphTheme } from '../../hooks/useGraphTheme'

interface Props {
  activeFilters: Set<string>
  onFilterToggle: (filter: string) => void
  isPresentationMode: boolean
  allNodes?: OntologyNode[]
}

const NODE_TYPES = [
  { group: 'Data Sources', types: [
    { id: 'source:git',         label: 'Git',           color: '#f0564a' },
    { id: 'source:servicenow',  label: 'ServiceNow',    color: '#4fc3f7' },
    { id: 'source:wiz',         label: 'Wiz',           color: '#ff9800' },
    { id: 'source:mock',        label: 'Mock',          color: '#ab47bc' },
  ]},
  { group: 'Enterprise Entities', types: [
    { id: 'Project',        label: 'Projects',        color: '#4a9eff' },
    { id: 'Service',        label: 'Services',        color: '#10b981' },
    { id: 'Repository',     label: 'Repositories',    color: '#f0564a' },
    { id: 'Infrastructure', label: 'Infrastructure',  color: '#ffc107' },
    { id: 'Database',       label: 'Databases',       color: '#9c27b0' },
    { id: 'Team',           label: 'Teams',           color: '#00bcd4' },
  ]},
  { group: 'Risk & Operations', types: [
    { id: 'SecurityFinding', label: 'Security Findings', color: '#f44336' },
    { id: 'Incident',        label: 'Incidents',          color: '#ff6b6b' },
  ]},
  { group: 'Cloud & Compute', types: [
    { id: 'cloud_provider', label: 'Cloud Providers', color: '#4285f4' },
    { id: 'container',      label: 'Containers',      color: '#10b981' },
    { id: 'location',       label: 'Locations',       color: '#8bc34a' },
  ]},
  { group: 'AI & Intelligence', types: [
    { id: 'ai_service', label: 'AI Services', color: '#ff6b9d' },
  ]},
  { group: 'Applications & Services', types: [
    { id: 'api_service',      label: 'API Services',      color: '#ffc107' },
    { id: 'application',      label: 'Applications',      color: '#00bcd4' },
    { id: 'network_service',  label: 'Network Services',  color: '#009688' },
  ]},
  { group: 'Data & Storage', types: [
    { id: 'database_host',   label: 'Database Hosts',   color: '#9c27b0' },
    { id: 'database_object', label: 'Database Objects', color: '#673ab7' },
  ]},
  { group: 'Security & Compliance', types: [
    { id: 'security', label: 'Security', color: '#f44336' },
  ]},
  { group: 'Legacy & Batch', types: [
    { id: 'legacy_process', label: 'Legacy Processes', color: '#795548' },
    { id: 'batch_process',  label: 'Batch Processes',  color: '#607d8b' },
  ]},
  { group: 'Infrastructure', types: [
    { id: 'domain',    label: 'Domains',     color: '#3f51b5' },
    { id: 'category',  label: 'Categories',  color: '#5a7aaa' },
    { id: 'component', label: 'Components',  color: '#6a7aaa' },
  ]},
]

export default function OntologyFilters({ activeFilters, onFilterToggle, isPresentationMode, allNodes = [] }: Props) {
  const gt = useGraphTheme()
  const [filterSearch, setFilterSearch] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(NODE_TYPES.map(g => g.group))
  )

  const toggleGroup = (group: string) => {
    const s = new Set(collapsedGroups)
    s.has(group) ? s.delete(group) : s.add(group)
    setCollapsedGroups(s)
  }

  const typeCounts = new Map<string, number>()
  allNodes.forEach(node => {
    typeCounts.set(node.node_type, (typeCounts.get(node.node_type) || 0) + 1)
    if (node.source) {
      const k = `source:${node.source}`
      typeCounts.set(k, (typeCounts.get(k) || 0) + 1)
    }
  })

  const filteredGroups = NODE_TYPES.map(g => ({
    ...g,
    types: g.types.filter(t =>
      t.label.toLowerCase().includes(filterSearch.toLowerCase()) ||
      t.id.toLowerCase().includes(filterSearch.toLowerCase())
    ),
  })).filter(g => g.types.length > 0)

  return (
    <div
      className={`absolute z-10 transition-opacity ${isPresentationMode ? 'opacity-30' : 'opacity-100'}`}
      style={{
        top: '80px', left: '24px',
        background: gt.filterBg,
        backdropFilter: 'blur(20px)',
        border: `1px solid ${gt.filterBorder}`,
        borderRadius: '12px',
        padding: '12px',
        width: '240px',
        maxHeight: 'calc(100vh - 120px)',
        overflowY: 'auto',
        boxShadow: gt.isDark
          ? '0 8px 24px rgba(0,0,0,0.4)'
          : '0 8px 24px rgba(0,0,0,0.09)',
        transition: 'background 0.3s, border-color 0.3s',
      }}
    >
      <style>{`
        .ov-filter-scroll::-webkit-scrollbar { width: 3px; }
        .ov-filter-scroll::-webkit-scrollbar-thumb {
          background: ${gt.accent}55; border-radius: 2px;
        }
        .ov-filter-scroll::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      <div style={{
        fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '1.2px', color: gt.sectionLabel, marginBottom: '6px',
      }}>Filters</div>

      <input
        type="text"
        placeholder="Search types..."
        value={filterSearch}
        onChange={(e) => setFilterSearch(e.target.value)}
        style={{
          width: '100%', padding: '6px 10px',
          background: gt.inputBg,
          border: `1px solid ${gt.inputBorder}`,
          borderRadius: '6px', color: gt.inputText,
          fontSize: '10px', outline: 'none',
          transition: 'all 0.2s', marginBottom: '10px',
        }}
        onFocus={(e) => {
          e.target.style.borderColor = gt.inputBorderFocus
          e.target.style.background = gt.inputBgFocus
        }}
        onBlur={(e) => {
          e.target.style.borderColor = gt.inputBorder
          e.target.style.background = gt.inputBg
        }}
      />

      <div className="ov-filter-scroll">
        {filteredGroups.map(({ group, types }) => {
          const isCollapsed = collapsedGroups.has(group)
          const groupCount = types.reduce((s, t) => s + (typeCounts.get(t.id) || 0), 0)

          return (
            <div key={group} style={{ marginBottom: '8px' }}>
              <div
                onClick={() => toggleGroup(group)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '4px 2px', marginBottom: '4px',
                  cursor: 'pointer', userSelect: 'none',
                  borderBottom: `1px solid ${gt.divider}`,
                }}
              >
                <ChevronDown
                  size={12}
                  color={gt.accent}
                  style={{
                    transition: 'transform 0.2s',
                    transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                    flexShrink: 0,
                  }}
                />
                <div style={{
                  flex: 1, fontSize: '9px', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '1px',
                  color: gt.panelSubtext,
                }}>{group}</div>
                <div style={{ fontSize: '8px', color: gt.mutedText, fontWeight: 600 }}>
                  {groupCount}
                </div>
              </div>

              {!isCollapsed && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {types.map(type => {
                    const count = typeCounts.get(type.id) || 0
                    const active = activeFilters.has(type.id)
                    return (
                      <button
                        key={type.id}
                        onClick={() => onFilterToggle(type.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          width: '100%', padding: '4px 6px', borderRadius: '4px',
                          cursor: 'pointer', transition: 'all 0.2s',
                          border: active ? `1px solid ${gt.accentBorder}` : '1px solid transparent',
                          background: active ? gt.accentBg : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          if (!active) e.currentTarget.style.background = gt.rowHover
                        }}
                        onMouseLeave={(e) => {
                          if (!active) e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        <span style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          backgroundColor: type.color,
                          boxShadow: gt.isDark ? `0 0 6px ${type.color}` : 'none',
                          flexShrink: 0,
                        }} />
                        <span style={{ flex: 1, fontSize: '10px', color: gt.panelText, textAlign: 'left', opacity: 0.85 }}>
                          {type.label}
                        </span>
                        {count > 0 && (
                          <span style={{
                            fontSize: '9px', fontWeight: 600,
                            color: gt.panelSubtext,
                            fontFamily: '"Courier New", monospace',
                          }}>
                            {count}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
