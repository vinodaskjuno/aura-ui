import { motion } from 'framer-motion'
import type { Progress } from './progress'

/**
 * One bar for every run, determinate or not.
 *
 * The indeterminate state is the point. A queued run has not been claimed, so nothing
 * has counted its cases yet — and a bar sitting at 0% says "nothing has worked",
 * which is a different and untrue statement. It sweeps instead, and says so.
 */
export default function ProgressBar({ progress, failing = false, height = 6 }: {
  progress: Progress
  failing?: boolean
  height?: number
}) {
  const colour = failing ? '#ef4444' : '#10b981'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
          {progress.label}
        </span>
        {progress.known && (
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600,
                         color: colour, fontVariantNumeric: 'tabular-nums' }}>
            {progress.pct}%
          </span>
        )}
      </div>

      <div style={{ height, borderRadius: height, overflow: 'hidden',
                    background: 'var(--color-surface-2, rgba(127,127,127,.18))' }}>
        {progress.known ? (
          <motion.div
            animate={{ width: `${progress.pct}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            style={{ height: '100%', background: colour, borderRadius: height }}
          />
        ) : (
          <motion.div
            animate={{ x: ['-40%', '140%'] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
            style={{ height: '100%', width: '40%', borderRadius: height,
                     background: `linear-gradient(90deg, transparent, ${colour}, transparent)` }}
          />
        )}
      </div>
    </div>
  )
}
