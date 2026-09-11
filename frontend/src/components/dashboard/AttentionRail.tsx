/**
 * The only coloured region on a dashboard.
 *
 * Everything else on the page is plain text. That is what makes this list work:
 * when three items appear here, they are the three things the person holding
 * this role should do something about today.
 *
 * A rule carries the severity, not an icon. Icons here would compete with each
 * other and with the text; a rule is invisible until it is red. The rule also
 * animates its own height on entry, so the rail assembles downward and the
 * worst item — always first — arrives first.
 */
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Check, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { AttentionItem, Severity } from '../../api/dashboardView'
import { SectionLabel } from './SectionLabel'

const RULE: Record<Severity, string> = {
  critical:  'var(--color-danger)',
  attention: 'var(--color-warning)',
  info:      'var(--color-border-hi)',
}

function Row({ item, index }: { item: AttentionItem; index: number }) {
  const reduced = useReducedMotion()
  const [hover, setHover] = useState(false)
  const accent = RULE[item.severity]

  const inner = (
    <motion.div
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      initial={reduced ? false : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.32, delay: reduced ? 0 : index * 0.06,
                    ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'flex-start',
        gap: 'var(--space-3)', justifyContent: 'space-between',
        padding: 'var(--space-3) var(--space-4)',
        paddingLeft: 'var(--space-4)',
        borderRadius: 'var(--radius-sm)',
        // A whisper of the severity colour on hover — enough to confirm the row
        // is live, not enough to read as a filled card.
        background: hover
          ? `color-mix(in srgb, ${accent} 7%, transparent)`
          : 'transparent',
        transition: 'background 0.18s ease',
      }}
    >
      {/* The rule, drawn by scaling from the top so the rail assembles. */}
      <motion.span
        aria-hidden="true"
        initial={reduced ? false : { scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.4, delay: reduced ? 0 : index * 0.06,
                      ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'absolute', left: 0, top: 6, bottom: 6, width: 2,
          borderRadius: 2, background: accent, transformOrigin: 'top',
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <span style={{
          fontSize: 'var(--text-body)', fontWeight: 500,
          color: 'var(--color-text)', lineHeight: 1.45,
        }}>{item.title}</span>
        {item.detail && (
          <span style={{
            fontSize: 'var(--text-caption)', lineHeight: 1.5,
            color: 'var(--color-subtext)',
            // Often an exception message — readable, but unmistakably machine output.
            fontFamily: 'var(--font-mono)',
          }}>{item.detail}</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                    flexShrink: 0, paddingTop: 2 }}>
        {item.when && (
          <span style={{
            fontSize: 'var(--text-caption)', color: 'var(--color-muted)',
            whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
          }}>{item.when}</span>
        )}
        {item.href && (
          <ChevronRight size={14} style={{
            color: hover ? accent : 'var(--color-muted)',
            transform: hover ? 'translateX(2px)' : 'none',
            transition: 'transform 0.18s ease, color 0.18s ease',
          }} />
        )}
      </div>
    </motion.div>
  )

  return item.href
    ? <Link to={item.href} style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link>
    : inner
}

export function AttentionRail({ items, title = 'Needs attention' }: {
  items: AttentionItem[]
  title?: string
}) {
  const reduced = useReducedMotion()

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)' }}>
        <SectionLabel>{title}</SectionLabel>
        {items.length > 0 && (
          <span style={{
            fontSize: 'var(--text-caption)', color: 'var(--color-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}>{items.length}</span>
        )}
      </div>

      {items.length === 0 ? (
        // A RESULT, not an absence. This is the best thing this panel can say.
        <motion.p
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            fontSize: 'var(--text-body)', color: 'var(--color-subtext)',
            margin: 0, padding: 'var(--space-2) 0',
          }}
        >
          <Check size={15} style={{ color: 'var(--color-success)' }} />
          Nothing needs attention.
        </motion.p>
      ) : (
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column',
                     gap: 2, margin: 0, padding: 0, marginLeft: 'calc(var(--space-4) * -1)' }}>
          {items.map((item, i) => (
            <li key={`${item.title}-${i}`}><Row item={item} index={i} /></li>
          ))}
        </ul>
      )}
    </section>
  )
}
