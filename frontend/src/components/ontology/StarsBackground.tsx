import { useGraphTheme } from '../../hooks/useGraphTheme'

export default function StarsBackground() {
  const { gradColors, isDark } = useGraphTheme()

  const background = isDark
    ? `radial-gradient(ellipse at 50% 40%, ${gradColors.start} 0%, ${gradColors.mid} 55%, ${gradColors.end} 100%)`
    : `radial-gradient(ellipse at 50% 30%, ${gradColors.start} 0%, ${gradColors.mid} 60%, ${gradColors.end} 100%)`

  return (
    <div
      className="absolute top-0 left-0 w-full h-full pointer-events-none z-0"
      style={{ background, transition: 'background 0.4s ease' }}
    />
  )
}
