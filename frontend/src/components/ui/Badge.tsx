interface BadgeProps {
  children: React.ReactNode
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'primary'
}
export function Badge({ children, variant = 'default' }: BadgeProps) {
  return <span className={`ov-badge badge-${variant}`}>{children}</span>
}
