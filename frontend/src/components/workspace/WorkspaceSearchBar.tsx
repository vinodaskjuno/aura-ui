import { Search, RefreshCw, Loader2 } from 'lucide-react'
import type { PersonaMode } from '../../store/workspaceStore'
import { useGraphTheme } from '../../hooks/useGraphTheme'

interface WorkspaceSearchBarProps {
  query: string
  onQueryChange: (q: string) => void
  persona: PersonaMode
  onPersonaChange: (p: PersonaMode) => void
  highlightCount: number
  totalNodes: number
  isLoading: boolean
  onReloadGraph: () => void
}

const PERSONA_LABELS: Record<PersonaMode, string> = {
  'non-technical': 'Overview',
  'junior-dev': 'Junior Dev',
  'experienced-dev': 'Expert',
}

export default function WorkspaceSearchBar({
  query, onQueryChange, persona, onPersonaChange,
  highlightCount, totalNodes, isLoading, onReloadGraph,
}: WorkspaceSearchBarProps) {
  const t = useGraphTheme()

  return (
    <div style={{
      gridArea: 'search',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '0 14px',
      background: t.topBarBg,
      borderBottom: `1px solid ${t.topBarBorder}`,
      flexShrink: 0,
    }}>
      {/* Logo + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{
          width: 28, height: 28,
          background: 'linear-gradient(135deg, #312e81, #4f46e5, #7c3aed)',
          borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 900, color: '#fff',
          boxShadow: '0 0 12px rgba(124,58,237,0.4)',
        }}>⚡</div>
        <span style={{
          fontSize: 12, fontWeight: 800, letterSpacing: '0.05em',
          background: 'linear-gradient(90deg, #a78bfa, #60a5fa)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>Workspace</span>
      </div>

      {/* Search input */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Search size={13} style={{
          position: 'absolute', left: 10,
          color: t.mutedText, pointerEvents: 'none',
        }} />
        <input
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          placeholder="Search nodes — e.g. 'communication layer', 'payment service'…"
          style={{
            width: '100%',
            paddingLeft: 32, paddingRight: query && highlightCount > 0 ? 90 : 12,
            height: 34, fontSize: 13,
            background: t.inputBg,
            border: `1px solid ${t.inputBorder}`,
            borderRadius: 8,
            color: t.inputText,
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => { e.target.style.borderColor = t.inputBorderFocus }}
          onBlur={e => { e.target.style.borderColor = t.inputBorder }}
        />
        {query && highlightCount > 0 && (
          <span style={{
            position: 'absolute', right: 10, fontSize: 11,
            color: t.accent, fontWeight: 700, pointerEvents: 'none',
          }}>
            {highlightCount} match{highlightCount !== 1 ? 'es' : ''}
          </span>
        )}
      </div>

      {/* Persona switcher */}
      <div style={{
        display: 'flex', gap: 3, flexShrink: 0,
        background: t.panelCard,
        border: `1px solid ${t.panelCardBorder}`,
        borderRadius: 8, padding: 3,
      }}>
        {(['non-technical', 'junior-dev', 'experienced-dev'] as PersonaMode[]).map(p => (
          <button key={p} onClick={() => onPersonaChange(p)}
            style={{
              fontSize: 11, fontWeight: 600, padding: '4px 10px',
              borderRadius: 6, border: 'none',
              background: persona === p ? t.accentBg : 'transparent',
              color: persona === p ? t.accent : t.mutedText,
              cursor: 'pointer', transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              if (persona !== p) e.currentTarget.style.color = t.panelText
            }}
            onMouseLeave={e => {
              if (persona !== p) e.currentTarget.style.color = t.mutedText
            }}
          >
            {PERSONA_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Node count */}
      <span style={{ fontSize: 11, color: t.mutedText, flexShrink: 0 }}>
        {totalNodes.toLocaleString()} nodes
      </span>

      {/* Reload */}
      <button
        onClick={onReloadGraph}
        disabled={isLoading}
        title="Reload graph"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28, borderRadius: 6, flexShrink: 0,
          background: t.panelCard,
          border: `1px solid ${t.panelCardBorder}`,
          color: t.mutedText, cursor: isLoading ? 'default' : 'pointer',
          opacity: isLoading ? 0.5 : 1,
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          if (!isLoading) e.currentTarget.style.color = t.accent
        }}
        onMouseLeave={e => { e.currentTarget.style.color = t.mutedText }}
      >
        {isLoading
          ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
          : <RefreshCw size={12} />
        }
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </button>
    </div>
  )
}
