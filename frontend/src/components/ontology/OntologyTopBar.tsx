import { type RefObject } from 'react'
import { RefreshCw, MessageSquareCode, Search, Play, ChevronRight } from 'lucide-react'
import LensLayoutTabs from '../ontology/lenses/LensLayoutTabs'
import LensSwitcher from '../ontology/lenses/LensSwitcher'
import type { LayoutId, LensDefinition, LensId, LensLayoutOption } from './lenses/lensTypes'

interface Props {
  lens: LensDefinition
  layout: LensLayoutOption
  onLensChange: (id: LensId) => void
  onLayoutChange: (id: LayoutId) => void
  onToggleOff: () => void
  searchTerm: string
  onSearchChange: (term: string) => void
  isPresentationMode: boolean
  searchInputRef?: RefObject<HTMLInputElement>
  projectFocus?: string | null
  canMaintain?: boolean
  onMaintainerChatToggle?: () => void
  maintainerChatOpen?: boolean
  onRefreshOrgGraph?: () => void
  onClearProjectFocus?: () => void
  onTourGuideToggle?: () => void
  tourGuideActive?: boolean
}

function Divider() {
  return <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
}

export default function OntologyTopBar({
  lens, layout, onLensChange, onLayoutChange, onToggleOff,
  searchTerm, onSearchChange, searchInputRef,
  projectFocus, canMaintain,
  onMaintainerChatToggle, maintainerChatOpen, onRefreshOrgGraph, onClearProjectFocus,
  onTourGuideToggle, tourGuideActive,
}: Props) {
  const isDetailView = !!layout.detailOnly
  const showTourGuide = layout.chrome.tourGuide && !!onTourGuideToggle

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
              <span style={{ WebkitTextFillColor: 'rgba(148,163,184,0.55)', background: 'none', fontSize: 10 }}>Onto Verse</span>
              <ChevronRight size={9} style={{ color: 'rgba(148,163,184,0.4)', WebkitTextFillColor: 'initial' }} />
              <span>{projectFocus}</span>
            </span>
          ) : 'Onto Verse'}
        </div>
        {isDetailView && (
          <div style={{
            fontSize: 8, color: '#6366f1', textTransform: 'uppercase',
            letterSpacing: '1.5px', fontWeight: 600, marginTop: 1,
          }}>
            ◈ {layout.label}
          </div>
        )}
        {!isDetailView && (
          <div style={{
            fontSize: 8, color: `${lens.accent}b3`, textTransform: 'uppercase',
            letterSpacing: '1.5px', fontWeight: 600, marginTop: 1,
          }}>
            {lens.id === 'ontology'
              ? (projectFocus ? '◈ Project Subgraph' : '◈ Org View')
              : `◈ ${lens.label} Lens · ${projectFocus ? 'Project Subgraph' : 'Org View'}`}
          </div>
        )}
      </div>

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

      {/* ── Group 1: how the active lens is drawn ── */}
      <LensLayoutTabs lens={lens} layout={layout} onChange={onLayoutChange} />

      <Divider />

      {/* ── Group 2: specialist views + other lenses ── */}
      <LensSwitcher
        lens={lens}
        layout={layout}
        onLensChange={onLensChange}
        onLayoutChange={onLayoutChange}
        onToggleOff={onToggleOff}
      />

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
