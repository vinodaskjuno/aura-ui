import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  animate?: boolean
  delay?: number
  style?: React.CSSProperties
}

export function Card({ children, className = '', animate = true, delay = 0, style }: CardProps) {
  const El = animate ? motion.div : 'div' as any
  const animProps = animate ? {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, delay, ease: 'easeOut' },
  } : {}
  return (
    <El className={`ov-card ${className}`} style={style} {...animProps}>
      {children}
    </El>
  )
}
