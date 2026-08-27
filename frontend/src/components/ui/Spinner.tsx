export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 16 : size === 'lg' ? 40 : 24
  return (
    <div style={{
      width: s, height: s, borderRadius: '50%',
      border: `2px solid var(--color-border)`,
      borderTopColor: 'var(--color-primary)',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}
