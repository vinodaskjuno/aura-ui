import { useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { useGraphTheme } from '../../hooks/useGraphTheme'
import type { ActiveFilters, ResolvedFilterGroup } from './lenses/lensSelectors'

const EMPTY: ReadonlySet<string> = new Set()

interface Props {
  /** Derived from the active lens + the data — see resolveFilterGroups(). */
  groups: ResolvedFilterGroup[]
  activeFilters: ActiveFilters
  onFilterToggle: (groupId: string, optionId: string) => void
  onClearAll: () => void
  isPresentationMode: boolean
  accent?: string
  /** Distance from the top of the canvas — shifts when the KPI bar is shown. */
  topOffset?: number
}

export default function OntologyFilters({
  groups, activeFilters, onFilterToggle, onClearAll, isPresentationMode,
  topOffset = 80,
}: Props) {
  const gt = useGraphTheme()
  const [filterSearch, setFilterSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggleGroup = (id: string) => {
    const s = new Set(expanded)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    setExpanded(s)
  }

  const term = filterSearch.toLowerCase()
  const filteredGroups = groups
    .map(g => ({
      ...g,
      options: term
        ? g.options.filter(o =>
            o.label.toLowerCase().includes(term) || o.id.toLowerCase().includes(term))
        : g.options,
    }))
    .filter(g => g.options.length > 0)

  const activeCount = Object.values(activeFilters).reduce((n, s) => n + s.size, 0)

  return (
    <div
      className={`absolute z-10 transition-opacity ${isPresentationMode ? 'opacity-30' : 'opacity-100'}`}
      style={{
        top: `${topOffset}px`, left: '24px',
        background: gt.filterBg,
        backdropFilter: 'blur(20px)',
        border: `1px solid ${gt.filterBorder}`,
        borderRadius: '12px',
        padding: '12px',
        width: '240px',
        maxHeight: `calc(100vh - ${topOffset + 40}px)`,
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
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span>Filters</span>
        {activeCount > 0 && (
          <button
            onClick={onClearAll}
            title="Clear all filters"
            style={{
              display: 'flex', alignItems: 'center', gap: 3,
              marginLeft: 'auto', padding: '2px 6px',
              background: gt.accentBg, border: `1px solid ${gt.accentBorder}`,
              borderRadius: 4, color: gt.accent,
              fontSize: 8, fontWeight: 700, cursor: 'pointer',
              textTransform: 'uppercase', letterSpacing: '0.6px',
            }}
          >
            <X size={9} strokeWidth={3} />
            Clear {activeCount}
          </button>
        )}
      </div>

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
        {filteredGroups.map(group => {
          const { id: groupId, label, options } = group
          // A search, or a live selection, forces the group open so the user can
          // always see what they have chosen.
          const selected = activeFilters[groupId] ?? EMPTY
          // Open when the user opened it, when a search is narrowing the list,
          // or when it holds a live selection — never hide an active filter.
          const isCollapsed =
            !expanded.has(groupId) && !term && !selected.size && (group.defaultCollapsed ?? false)
          const groupCount = options.reduce((s, o) => s + o.count, 0)

          return (
            <div key={groupId} style={{ marginBottom: '8px' }}>
              <div
                onClick={() => toggleGroup(groupId)}
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
                }}>{label}</div>
                <div style={{ fontSize: '8px', color: gt.mutedText, fontWeight: 600 }}>
                  {groupCount}
                </div>
              </div>

              {!isCollapsed && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {options.map(type => {
                    const count = type.count
                    const active = selected.has(type.id)
                    return (
                      <button
                        key={type.id}
                        onClick={() => onFilterToggle(groupId, type.id)}
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
                          backgroundColor: type.color ?? gt.mutedText,
                          boxShadow: gt.isDark && type.color ? `0 0 6px ${type.color}` : 'none',
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
