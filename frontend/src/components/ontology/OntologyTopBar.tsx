import { type RefObject } from 'react'
import { RefreshCw, MessageSquareCode, Search, Play, ChevronRight, Cpu, Network, LayoutDashboard, GitBranch } from 'lucide-react'
import type { ViewMode } from '../../types/ontology'
import type { SpecialistView } from '../../store/ontologyStore'
import { useGraphTheme } from '../../hooks/useGraphTheme'

interface Props {
  currentView: ViewMode
  onViewChange: (view: ViewMode) => void
  searchTerm: string
  onSearchChange: (term: string) => void
  isPresentationMode: boolean
  searchInputRef?: RefObject<HTMLInputElement>
  totalNodes?: number
  totalLinks?: number
  projectFocus?: string | null
  canMaintain?: boolean
  onMaintainerChatToggle?: () => void
  maintainerChatOpen?: boolean
  onRefreshOrgGraph?: () => void
  onClearProjectFocus?: () => void
  specialistView?: SpecialistView | null
  onSpecialistViewChange?: (view: SpecialistView | null) => void
  onTourGuideToggle?: () => void
  tourGuideActive?: boolean
}

const VIEW_TABS: { id: ViewMode; label: string; Icon: any }[] = [
  { id: 'full',      label: 'Graph',      Icon: Network },
  { id: 'hierarchy', label: 'Hierarchy',  Icon: GitBranch },
]

const SPECIALIST_OPTIONS: { id: SpecialistView; label: string; Icon: any }[] = [
  { id: 'smartscape', label: 'Smartscape',  Icon: Cpu },
  { id: 'workspace',  label: 'Workspace',   Icon: LayoutDashboard },
]

// Specialist views accessible only from the detail panel (domain-layer, structural)
const DETAIL_VIEWS: SpecialistView[] = ['domain-layer', 'structural']
const DETAIL_VIEW_LABELS: Record<string, string> = {
  'domain-layer': 'Domain View',
  'structural':   'Structural View',
}

function Divider() {
  return <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
}

export default function OntologyTopBar({
  currentView, onViewChange, searchTerm, onSearchChange, searchInputRef,
  totalNodes, totalLinks, projectFocus, canMaintain,
  onMaintainerChatToggle, maintainerChatOpen, onRefreshOrgGraph, onClearProjectFocus,
  specialistView, onSpecialistViewChange, onTourGuideToggle, tourGuideActive,
}: Props) {
  const gt = useGraphTheme()

  const isDetailView = specialistView ? DETAIL_VIEWS.includes(specialistView) : false
  const showTourGuide = isDetailView && !!onTourGuideToggle

  // Common button base styles
  const btn = (active: boolean, accentColor = '#a78bfa'): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '5px 10px', height: 30,
    background: active ? `${accentColor}18` : 'transparent',
    border: active ? `1px solid ${accentColor}44` : '1px solid transparent',
    borderRadius: 7,
    color: active ? accentColor : 'rgba(148,163,184,0.7)',
    fontSize: 11, fontWeight: active ? 700 : 500,
    cursor: 'pointer', transition: 'all 0.18s',
    whiteSpace: 'nowrap' as const, flexShrink: 0,
  })

  return (
    <div
      style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 52, zIndex: 20,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 16px',
        background: 'rgba(6,10,22,0.92)',
        backdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(255,255,255,0.065)',
        boxShadow: '0 1px 0 0 rgba(99,102,241,0.12), 0 4px 24px rgba(0,0,0,0.45)',
      }}
    >
      {/* ── Logo ── */}
      <div style={{
        width: 30, height: 30, flexShrink: 0,
        background: 'linear-gradient(135deg, #312e81 0%, #4f46e5 50%, #7c3aed 100%)',
        borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, fontWeight: 900, color: '#fff',
        border: '1px solid rgba(167,139,250,0.35)',
        boxShadow: '0 0 12px rgba(124,58,237,0.45)',
      }}>✦</div>

      {/* ── Title + breadcrumb ── */}
      <div style={{ flexShrink: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 800, lineHeight: 1,
          background: 'linear-gradient(90deg, #a78bfa, #60a5fa)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          {projectFocus ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ WebkitTextFillColor: 'rgba(148,163,184,0.55)', background: 'none', fontSize: 10 }}>Ontology</span>
              <ChevronRight size={9} style={{ color: 'rgba(148,163,184,0.4)', WebkitTextFillColor: 'initial' }} />
              <span>{projectFocus}</span>
            </span>
          ) : 'Ontology Universe'}
        </div>
        {isDetailView && specialistView && (
          <div style={{
            fontSize: 8, color: '#6366f1', textTransform: 'uppercase',
            letterSpacing: '1.5px', fontWeight: 600, marginTop: 1,
          }}>
            ◈ {DETAIL_VIEW_LABELS[specialistView]}
          </div>
        )}
        {!isDetailView && (
          <div style={{
            fontSize: 8, color: 'rgba(99,102,241,0.7)', textTransform: 'uppercase',
            letterSpacing: '1.5px', fontWeight: 600, marginTop: 1,
          }}>
            {projectFocus ? '◈ Project Subgraph' : '◈ Org View'}
          </div>
        )}
      </div>

      {/* ── Stats ── */}
      {totalNodes !== undefined && totalLinks !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Nodes */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '4px 12px',
            background: 'rgba(96,165,250,0.07)',
            border: '1px solid rgba(96,165,250,0.2)',
            borderRadius: 8,
          }}>
            <span style={{
              fontSize: 18, fontWeight: 800, lineHeight: 1,
              background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>{totalNodes.toLocaleString()}</span>
            <span style={{
              fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '1.2px', color: '#6366f1', marginTop: 1,
            }}>Nodes</span>
          </div>
          {/* Links */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '4px 12px',
            background: 'rgba(52,211,153,0.07)',
            border: '1px solid rgba(52,211,153,0.2)',
            borderRadius: 8,
          }}>
            <span style={{
              fontSize: 18, fontWeight: 800, lineHeight: 1,
              background: 'linear-gradient(135deg, #34d399, #06b6d4)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>{totalLinks.toLocaleString()}</span>
            <span style={{
              fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '1.2px', color: '#0891b2', marginTop: 1,
            }}>Links</span>
          </div>
        </div>
      )}

      {/* ── Spacer ── */}
      <div style={{ flex: 1 }} />

      {/* ── Search ── */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Search
          size={12}
          style={{
            position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
            color: 'rgba(148,163,184,0.4)', pointerEvents: 'none',
          }}
        />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search nodes…"
          value={searchTerm}
          onChange={e => onSearchChange(e.target.value)}
          style={{
            width: 180, height: 30,
            paddingLeft: 28, paddingRight: 10,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 7, color: '#f1f5ff',
            fontSize: 11, outline: 'none',
            transition: 'all 0.18s',
          }}
          onFocus={e => {
            e.target.style.borderColor = 'rgba(99,102,241,0.5)'
            e.target.style.background = 'rgba(99,102,241,0.08)'
          }}
          onBlur={e => {
            e.target.style.borderColor = 'rgba(255,255,255,0.08)'
            e.target.style.background = 'rgba(255,255,255,0.04)'
          }}
        />
      </div>

      <Divider />

      {/* ── View mode tabs ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 8, padding: '3px',
      }}>
        {VIEW_TABS.map(({ id, label, Icon }) => {
          const active = currentView === id && !specialistView
          return (
            <button
              key={id}
              onClick={() => { onViewChange(id); onSpecialistViewChange?.(null) }}
              style={btn(active, '#60a5fa')}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                  e.currentTarget.style.color = '#e2e8f0'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'rgba(148,163,184,0.7)'
                }
              }}
            >
              <Icon size={12} strokeWidth={2} />
              {label}
            </button>
          )
        })}
      </div>

      <Divider />

      {/* ── Specialist views ── */}
      {onSpecialistViewChange && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 2,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 8, padding: '3px',
        }}>
          {SPECIALIST_OPTIONS.map(({ id, label, Icon }) => {
            const active = specialistView === id
            return (
              <button
                key={id}
                onClick={() => onSpecialistViewChange(active ? null : id)}
                title={`${label} — AI-powered topology map`}
                style={btn(active, '#a78bfa')}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.background = 'rgba(167,139,250,0.1)'
                    e.currentTarget.style.color = '#c4b5fd'
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'rgba(148,163,184,0.7)'
                  }
                }}
              >
                <Icon size={12} strokeWidth={2} />
                {label}
              </button>
            )
          })}

          {/* Detail-view back indicator when domain/structural is active */}
          {isDetailView && specialistView && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px',
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 6,
              fontSize: 10, fontWeight: 700, color: '#818cf8',
              whiteSpace: 'nowrap',
            }}>
              <LayoutDashboard size={11} strokeWidth={2} />
              {DETAIL_VIEW_LABELS[specialistView]}
            </div>
          )}
        </div>
      )}

      <Divider />

      {/* ── Actions ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* Refresh — icon only */}
        {onRefreshOrgGraph && (
          <button
            onClick={onRefreshOrgGraph}
            title="Reload ontology data"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30,
              background: 'transparent',
              border: '1px solid transparent',
              borderRadius: 7,
              color: 'rgba(148,163,184,0.5)',
              cursor: 'pointer', transition: 'all 0.18s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
              e.currentTarget.style.color = '#e2e8f0'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'rgba(148,163,184,0.5)'
              e.currentTarget.style.borderColor = 'transparent'
            }}
          >
            <RefreshCw size={13} strokeWidth={2} />
          </button>
        )}

        {/* Edit Ontology */}
        {canMaintain && onMaintainerChatToggle && (
          <button
            onClick={onMaintainerChatToggle}
            title="Open Ontology Maintainer Chat"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 10px', height: 30,
              background: maintainerChatOpen ? 'rgba(99,102,241,0.15)' : 'transparent',
              border: maintainerChatOpen
                ? '1px solid rgba(99,102,241,0.45)'
                : '1px solid transparent',
              borderRadius: 7,
              color: maintainerChatOpen ? '#818cf8' : 'rgba(148,163,184,0.6)',
              fontSize: 11, fontWeight: maintainerChatOpen ? 700 : 500,
              cursor: 'pointer', transition: 'all 0.18s',
            }}
            onMouseEnter={e => {
              if (!maintainerChatOpen) {
                e.currentTarget.style.background = 'rgba(99,102,241,0.1)'
                e.currentTarget.style.color = '#818cf8'
                e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'
              }
            }}
            onMouseLeave={e => {
              if (!maintainerChatOpen) {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'rgba(148,163,184,0.6)'
                e.currentTarget.style.borderColor = 'transparent'
              }
            }}
          >
            <MessageSquareCode size={12} strokeWidth={2} />
            Edit Ontology
          </button>
        )}

        {/* Clear project focus */}
        {projectFocus && onClearProjectFocus && (
          <button
            onClick={onClearProjectFocus}
            title="Return to organisation view"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 10px', height: 30,
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 7,
              color: '#fbbf24', fontSize: 11, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.18s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.1)')}
          >
            ← Org View
          </button>
        )}

        {/* ── Tour Guide — only for Domain / Structural views ── */}
        {showTourGuide && (
          <>
            <Divider />
            <button
              onClick={onTourGuideToggle}
              title="Live walkthrough of project nodes"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', height: 30,
                background: tourGuideActive
                  ? 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(16,185,129,0.15))'
                  : 'rgba(34,197,94,0.08)',
                border: `1px solid ${tourGuideActive ? 'rgba(34,197,94,0.6)' : 'rgba(34,197,94,0.25)'}`,
                borderRadius: 7,
                color: '#22c55e', fontSize: 11, fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.18s',
                boxShadow: tourGuideActive ? '0 0 12px rgba(34,197,94,0.25)' : 'none',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(34,197,94,0.18)'
                e.currentTarget.style.borderColor = 'rgba(34,197,94,0.5)'
                e.currentTarget.style.boxShadow = '0 0 10px rgba(34,197,94,0.2)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = tourGuideActive
                  ? 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(16,185,129,0.15))'
                  : 'rgba(34,197,94,0.08)'
                e.currentTarget.style.borderColor = tourGuideActive ? 'rgba(34,197,94,0.6)' : 'rgba(34,197,94,0.25)'
                e.currentTarget.style.boxShadow = tourGuideActive ? '0 0 12px rgba(34,197,94,0.25)' : 'none'
              }}
            >
              {tourGuideActive ? (
                <>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%', background: '#22c55e',
                    boxShadow: '0 0 6px #22c55e', display: 'inline-block',
                    animation: 'pulse-ring 1.4s ease-out infinite',
                  }} />
                  Tour Live
                </>
              ) : (
                <>
                  <Play size={11} strokeWidth={2.5} />
                  Tour Guide
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
