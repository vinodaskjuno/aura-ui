import { Coins, ArrowDown, ArrowUp } from 'lucide-react'

interface TokenMetricsBadgeProps {
  inputTokens: number
  outputTokens: number
  cost: number
  model?: string
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export default function TokenMetricsBadge({ inputTokens, outputTokens, cost, model }: TokenMetricsBadgeProps) {
  if (!inputTokens && !outputTokens) return null
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 10px', borderRadius: 20,
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      fontSize: 11, color: 'var(--color-muted)', marginTop: 6,
    }}>
      <ArrowUp size={10} style={{ color: 'var(--color-subtext)' }} />
      <span>{formatTokens(inputTokens)}</span>
      <ArrowDown size={10} style={{ color: 'var(--color-subtext)' }} />
      <span>{formatTokens(outputTokens)}</span>
      {cost > 0 && (
        <>
          <span style={{ color: 'var(--color-border)' }}>·</span>
          <Coins size={10} style={{ color: 'var(--color-warning)' }} />
          <span style={{ color: 'var(--color-warning)' }}>${cost.toFixed(4)}</span>
        </>
      )}
      {model && (
        <>
          <span style={{ color: 'var(--color-border)' }}>·</span>
          <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>
            {model.split('.').pop()?.split('-').slice(0, 3).join('-') ?? model}
          </span>
        </>
      )}
    </div>
  )
}
