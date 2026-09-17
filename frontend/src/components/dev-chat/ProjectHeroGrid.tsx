/**
 * The projects, as the first and largest thing on DevMate.
 *
 * A developer opens this screen to choose something to work on, so that choice
 * is the hero. It used to sit below four metric strips and a full analytics
 * dashboard — roughly three screens down.
 *
 * THE HERO IS A WORKING SET, NOT THE CATALOGUE. At most six cards, ranked
 * server-side by what is waiting on a decision and then by recency. With a
 * hundred projects the remaining ninety-four live in the searchable list below,
 * and the header says `6 of 100` so the cap is never mistaken for the total.
 *
 * Chrome follows `Metric`: one section accent for identity, state on the status
 * line only, no icons, no per-card colour.
 */
import { motion, useReducedMotion } from 'framer-motion'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { HeroCard } from '../../api/devmateView'
import { stateColor } from '../ui/metricState'
import { accentBorder, accentSurface } from '../dashboard/sectionAccent'

export default function ProjectHeroGrid({
  cards, total, onSelect, onCreateNew, onDelete, accent = 'var(--accent-1)',
}: {
  cards: HeroCard[]
  total: number
  onSelect: (projectId: string, name: string) => void
  onCreateNew: () => void
  onDelete: (card: HeroCard) => void
  accent?: string
}) {
  const reduced = useReducedMotion()

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(232px, 1fr))',
      gap: 'var(--space-3)',
    }}>
      {cards.map((card, i) => (
        <Card key={card.projectId} card={card} accent={accent}
              delay={reduced ? 0 : i * 0.05}
              onSelect={onSelect} onDelete={onDelete} />
      ))}

      <NewCard onClick={onCreateNew} accent={accent}
               delay={reduced ? 0 : cards.length * 0.05}
               first={total === 0} />
    </div>
  )
}

function Card({ card, accent, delay, onSelect, onDelete }: {
  card: HeroCard; accent: string; delay: number
  onSelect: (projectId: string, name: string) => void
  onDelete: (card: HeroCard) => void
}) {
  const reduced = useReducedMotion()
  const [hover, setHover] = useState(false)
  const color = stateColor(card.state)

  return (
    <div style={{ position: 'relative', display: 'flex', minWidth: 0 }}
         onMouseEnter={() => setHover(true)}
         onMouseLeave={() => setHover(false)}>
    <motion.button
      type="button"
      onClick={() => onSelect(card.projectId, card.name)}
      // Hover is owned by the wrapper, not this button: moving the pointer from
      // the card onto the delete control would otherwise fire onHoverEnd here,
      // hide the control mid-travel, and make it unclickable.
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
        textAlign: 'left', cursor: 'pointer', font: 'inherit',
        width: '100%', minWidth: 0, minHeight: 132,
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-md)',
        background: `linear-gradient(145deg, ${accentSurface(accent)} 0%, var(--color-card) 70%)`,
        border: `1px solid ${accentBorder(accent, hover ? 52 : 22)}`,
        transform: hover && !reduced ? 'translateY(-2px)' : 'none',
        boxShadow: hover
          ? `0 6px 20px color-mix(in srgb, ${accent} 16%, transparent)` : 'none',
        transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
      }}
    >
      <span style={{
        fontFamily: 'var(--font-heading)',
        fontSize: 'var(--text-title)', fontWeight: 700,
        color: 'var(--color-text)', lineHeight: 1.25,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{card.name}</span>

      {/* The status carries the state — this is the only coloured thing on the
          card, and only when something is actually waiting. */}
      <span style={{
        fontSize: 'var(--text-body)', lineHeight: 1.4,
        color: color ?? 'var(--color-subtext)',
        fontWeight: card.pending ? 600 : 400,
      }}>{card.status}</span>

      {card.detail && (
        <span style={{
          fontSize: 'var(--text-caption)', lineHeight: 1.4,
          color: 'var(--color-muted)',
          fontFamily: card.pending ? 'var(--font-mono)' : undefined,
          overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>{card.detail}</span>
      )}

      {/* Live state, when there is any. A dot rather than a word for "running",
          because the card's one coloured thing is already the status line and this
          must not compete with it. The URL is deliberately NOT here: it is loopback
          on the runner's machine and would point a colleague at their own computer. */}
      {(card.running || card.telemetry === 'key-refused') && (
        <span style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 'var(--text-caption)', color: 'var(--color-muted)',
        }}>
          {card.running && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%',
                             background: '#10b981', display: 'inline-block' }} />
              running locally
            </span>
          )}
          {card.telemetry === 'connected' && card.running && <span>· traced</span>}
          {card.telemetry === 'key-refused' && (
            <span style={{ color: '#ef4444' }}
                  title="A telemetry credential was refused. Its spans were dropped —
                         the exporter was told 200 so it would not retry in a loop
                         inside the application.">
              · telemetry refused
            </span>
          )}
        </span>
      )}

      <span style={{
        marginTop: 'auto', fontSize: 'var(--text-caption)',
        color: 'var(--color-muted)', fontVariantNumeric: 'tabular-nums',
      }}>{card.when}</span>
    </motion.button>

    <button
      type="button"
      aria-label={`Delete ${card.name}`}
      onClick={() => onDelete(card)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      style={{
        position: 'absolute', top: 'var(--space-2)', right: 'var(--space-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 26, height: 26, padding: 0,
        borderRadius: 'var(--radius-sm)',
        background: 'var(--color-card)',
        border: '1px solid var(--color-border)',
        color: 'var(--color-muted)',
        // Hidden until the card is hovered or the button itself is focused:
        // a destructive control should not be the first thing on a card whose
        // whole job is to be clicked.
        opacity: hover ? 1 : 0,
        pointerEvents: hover ? 'auto' : 'none',
        cursor: 'pointer',
        transition: 'opacity 0.15s ease, color 0.15s ease, border-color 0.15s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = 'var(--color-danger)'
        e.currentTarget.style.borderColor = 'var(--color-danger)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = 'var(--color-muted)'
        e.currentTarget.style.borderColor = 'var(--color-border)'
      }}
    >
      <Trash2 size={13} />
    </button>
    </div>
  )
}

/** The only icon on this grid, and it is on a button. */
function NewCard({ onClick, accent, delay, first }: {
  onClick: () => void; accent: string; delay: number; first: boolean
}) {
  const reduced = useReducedMotion()
  const [hover, setHover] = useState(false)

  return (
    <motion.button
      type="button"
      onClick={onClick}
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 'var(--space-2)', minHeight: 132, cursor: 'pointer', font: 'inherit',
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-md)',
        background: 'transparent',
        border: `1px dashed ${accentBorder(accent, hover ? 60 : 34)}`,
        color: hover ? accent : 'var(--color-subtext)',
        transition: 'border-color 0.18s ease, color 0.18s ease',
      }}
    >
      <Plus size={18} />
      <span style={{
        fontFamily: 'var(--font-heading)',
        fontSize: 'var(--text-body)', fontWeight: 600,
      }}>{first ? 'Create your first project' : 'New project'}</span>
    </motion.button>
  )
}
