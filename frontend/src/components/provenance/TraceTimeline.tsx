import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, RotateCw } from 'lucide-react'
import { useGraphTheme } from '../../hooks/useGraphTheme'
import PropertyDiff from './PropertyDiff'
import {
  absTime, changeColor, changeVerb, pipelineColor, pipelineMeta, relTime, triggerMeta,
} from './pipelineMeta'
import type { RunBrief, TraceEvent } from '../../api/provenance'

/**
 * Every recorded touch of this entity, newest first.
 *
 * History is written only when a value actually changed, which keeps a 50k-node
 * analysis to a handful of rows instead of 50k. The cost of that choice is that
 * silence is ambiguous: no rows between August and today could mean nothing
 * touched this node, or that eleven runs re-confirmed it unchanged. The
 * "re-confirmed" band below states which — without it, diff-only history reads as
 * a gap in the record.
 */

interface Props {
  events: TraceEvent[]
  /** Runs that touched the entity but wrote no change row. */
  reconfirmedSince?: { count: number; sinceIso?: string } | null
  canSeeValues: boolean
  latestRun?: RunBrief | null
  onOpenRun?: (runId: string) => void
}

function TraceEntry({
  event, isLast, canSeeValues, onOpenRun,
}: {
  event: TraceEvent
  isLast: boolean
  canSeeValues: boolean
  onOpenRun?: (runId: string) => void
}) {
  const gt = useGraphTheme()
  const [open, setOpen] = useState(false)
  const accent = changeColor(event.changeType)
  const meta = pipelineMeta(event.pipeline || event.source)
  const hue = pipelineColor(event.pipeline || event.source, gt.isDark)
  const Icon = meta.icon
  const trigger = triggerMeta(event.trigger)
  const hasDiff = Boolean(event.before || event.after || event.valuesRedacted)

  return (
    <div style={{ display: 'flex', gap: 10, minWidth: 0 }}>
      {/* Rail */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        flexShrink: 0, width: 9,
      }}>
        <span style={{
          width: 9, height: 9, borderRadius: '50%', background: accent,
          boxShadow: `0 0 0 3px ${accent}22`, marginTop: 4,
        }} />
        {!isLast && (
          <span style={{ flex: 1, width: 1.5, background: gt.panelBorder, marginTop: 4 }} />
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: gt.panelText }}>
            {changeVerb(event.changeType)}
          </span>
          <span style={{ flex: 1 }} />
          <span
            title={absTime(event.timestamp)}
            style={{ fontSize: 10, color: gt.panelSubtext, whiteSpace: 'nowrap' }}
          >
            {relTime(event.timestamp)}
          </span>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap',
        }}>
          <Icon size={10} style={{ color: hue, flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: hue, fontWeight: 600 }}>{meta.label}</span>
          <span style={{ color: gt.mutedText, fontSize: 9 }}>·</span>
          <span style={{
            fontSize: 10, color: gt.panelSubtext, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150,
          }} title={event.actor}>
            {event.actor || 'unknown'}
          </span>
          <span title={trigger.hint} style={{ fontSize: 8, color: gt.mutedText }}>
            {trigger.glyph}
          </span>
        </div>

        {event.sourceDetail && (
          <div
            title={event.sourceDetail}
            style={{
              fontSize: 9.5, color: gt.mutedText, marginTop: 2,
              fontFamily: 'JetBrains Mono, monospace',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {event.sourceDetail}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
          {event.runId && onOpenRun && (
            <button
              onClick={() => onOpenRun(event.runId!)}
              style={{
                border: `1px solid ${hue}3a`, background: `${hue}14`, color: hue,
                borderRadius: 5, padding: '1px 6px', fontSize: 9, fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              run →
            </button>
          )}
          {hasDiff && (
            <button
              onClick={() => setOpen(o => !o)}
              style={{
                border: 'none', background: 'none', color: gt.panelSubtext,
                fontSize: 9.5, fontWeight: 600, cursor: 'pointer', padding: 0,
                display: 'inline-flex', alignItems: 'center', gap: 2,
              }}
            >
              <ChevronRight
                size={11}
                style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}
              />
              {open ? 'Hide changes' : 'What changed'}
            </button>
          )}
        </div>

        <AnimatePresence initial={false}>
          {open && hasDiff && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{
                marginTop: 7, padding: '7px 9px', borderRadius: 7,
                background: gt.panelCard, border: `1px solid ${gt.panelCardBorder}`,
              }}>
                <PropertyDiff
                  before={event.before}
                  after={event.after}
                  redacted={!canSeeValues && Boolean(event.valuesRedacted)}
                />
                {event.notes && (
                  <div style={{
                    marginTop: 6, fontSize: 9.5, color: gt.mutedText, fontStyle: 'italic',
                  }}>
                    {event.notes}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function TraceTimeline({
  events, reconfirmedSince, canSeeValues, onOpenRun,
}: Props) {
  const gt = useGraphTheme()

  if (!events.length) {
    return (
      <div style={{
        textAlign: 'center', color: gt.panelSubtext, fontSize: 11.5,
        padding: '20px 12px', lineHeight: 1.6,
      }}>
        No changes recorded yet.
        <div style={{ fontSize: 10, color: gt.mutedText, marginTop: 4 }}>
          History is written when a value actually changes, so an entity that has
          only ever been re-confirmed has none.
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* States the silence rather than leaving it to be misread as a gap. */}
      {reconfirmedSince && reconfirmedSince.count > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 9.5, color: gt.mutedText, marginBottom: 12, marginLeft: 19,
          padding: '4px 8px', borderRadius: 5,
          background: gt.panelCard, border: `1px dashed ${gt.panelBorder}`,
        }}>
          <RotateCw size={10} />
          Re-confirmed by {reconfirmedSince.count} run
          {reconfirmedSince.count === 1 ? '' : 's'} since — no change
        </div>
      )}

      {events.map((event, i) => (
        <TraceEntry
          key={event.changeId || `${event.timestamp}-${i}`}
          event={event}
          isLast={i === events.length - 1}
          canSeeValues={canSeeValues}
          onOpenRun={onOpenRun}
        />
      ))}
    </div>
  )
}
