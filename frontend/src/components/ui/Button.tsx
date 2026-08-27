import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

interface ButtonProps {
  children: ReactNode
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  loading?: boolean
  disabled?: boolean
  onClick?: () => void
  type?: 'button' | 'submit'
  style?: React.CSSProperties
  className?: string
}

export function Button({ children, variant = 'primary', size = 'md', loading, disabled, onClick, type = 'button', style, className = '' }: ButtonProps) {
  const variantClass = variant === 'primary' ? 'ov-btn-primary' : variant === 'ghost' ? 'ov-btn-ghost' : 'ov-btn-danger'
  const sizeStyle = size === 'sm' ? { padding: '6px 14px', fontSize: 12 } : {}
  const dangerStyle = variant === 'danger' ? { background: 'var(--color-danger)', color: '#fff' } : {}

  return (
    <motion.button
      type={type}
      className={`ov-btn ${variantClass} ${className}`}
      style={{ ...sizeStyle, ...dangerStyle, ...style }}
      disabled={disabled || loading}
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : null}
      {children}
    </motion.button>
  )
}
