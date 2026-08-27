import { useState, useRef, useEffect } from 'react'
import { Cpu, ChevronDown, Check, Brain, Bot } from 'lucide-react'

export interface ModelOption {
  id: string
  label: string
  provider: 'bedrock' | 'anthropic' | 'openai'
  contextWindow?: string
  tier?: 'fast' | 'balanced' | 'powerful'
}

const MODEL_GROUPS: Array<{ group: string; icon: React.ReactNode; models: ModelOption[] }> = [
  {
    group: 'AWS Bedrock',
    icon: <Cpu size={13} />,
    models: [
      { id: 'us.anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4.6', provider: 'bedrock', contextWindow: '200k', tier: 'balanced' },
      { id: 'us.anthropic.claude-opus-5-20251101-v1:0',   label: 'Claude Opus 5',     provider: 'bedrock', contextWindow: '200k', tier: 'powerful' },
      { id: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',label: 'Claude Haiku 4.5',  provider: 'bedrock', contextWindow: '200k', tier: 'fast' },
      { id: 'amazon.nova-pro-v1:0',                       label: 'Amazon Nova Pro',   provider: 'bedrock', contextWindow: '300k', tier: 'balanced' },
    ],
  },
  {
    group: 'Anthropic Direct',
    icon: <Brain size={13} />,
    models: [
      { id: 'claude-sonnet-4-5',         label: 'Claude Sonnet 4.5', provider: 'anthropic', contextWindow: '200k', tier: 'balanced' },
      { id: 'claude-opus-5-20251101',     label: 'Claude Opus 5',     provider: 'anthropic', contextWindow: '200k', tier: 'powerful' },
      { id: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5',  provider: 'anthropic', contextWindow: '200k', tier: 'fast' },
    ],
  },
  {
    group: 'OpenAI',
    icon: <Bot size={13} />,
    models: [
      { id: 'gpt-4o',      label: 'GPT-4o',      provider: 'openai', contextWindow: '128k', tier: 'balanced' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini', provider: 'openai', contextWindow: '128k', tier: 'fast' },
    ],
  },
]

const TIER_COLORS: Record<string, string> = { fast: '#10b981', balanced: '#3b82f6', powerful: '#8b5cf6' }

interface ModelSelectorProps {
  value: string
  onChange: (model: ModelOption) => void
  disabled?: boolean
}

export function getModelById(id: string): ModelOption | undefined {
  for (const g of MODEL_GROUPS) {
    const m = g.models.find(m => m.id === id)
    if (m) return m
  }
  return MODEL_GROUPS[0].models[0]
}

export default function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const currentModel = getModelById(value) ?? MODEL_GROUPS[0].models[0]

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 10px', borderRadius: 20,
          background: 'var(--color-card)', border: '1px solid var(--color-border)',
          color: 'var(--color-text)', cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 12, fontWeight: 600, transition: 'all 0.2s',
          opacity: disabled ? 0.6 : 1,
        }}
        onMouseEnter={e => !disabled && ((e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-primary)')}
        onMouseLeave={e => !disabled && ((e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)')}
      >
        <Cpu size={13} style={{ color: 'var(--color-primary)' }} />
        {currentModel.label}
        <ChevronDown size={12} style={{ color: 'var(--color-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6,
          background: 'var(--color-card)', border: '1px solid var(--color-border)',
          borderRadius: 10, boxShadow: 'var(--shadow-md)', zIndex: 200,
          width: 280, overflow: 'hidden',
        }}>
          {MODEL_GROUPS.map(group => (
            <div key={group.group}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 12px', fontSize: 10, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.8px',
                background: 'var(--color-surface)',
                color: 'var(--color-subtext)',
              }}>
                {group.icon}
                {group.group}
              </div>
              {group.models.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { onChange(m); setOpen(false) }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px',
                    background: m.id === value ? `${TIER_COLORS[m.tier ?? 'balanced']}11` : 'none',
                    border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = m.id === value ? `${TIER_COLORS[m.tier ?? 'balanced']}22` : 'var(--color-card-hover)'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = m.id === value ? `${TIER_COLORS[m.tier ?? 'balanced']}11` : 'none'}
                >
                  <span style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>{m.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--color-muted)', marginTop: 1 }}>
                      {m.contextWindow} context
                    </div>
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 12,
                    background: `${TIER_COLORS[m.tier ?? 'balanced']}22`,
                    color: TIER_COLORS[m.tier ?? 'balanced'],
                  }}>
                    {m.tier}
                  </span>
                  {m.id === value && <Check size={13} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
