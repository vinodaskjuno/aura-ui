import { useGraphTheme } from '../../hooks/useGraphTheme'
import {
  absTime, freshnessColor, isUnattributed, pipelineColor, pipelineMeta,
  relTime, triggerMeta,
} from './pipelineMeta'
import type { EntityTrace, RunBrief } from '../../api/provenance'

/**
 * Where this node or edge came from, always visible under the panel title.
 *
 * The provenance tab that shipped before this told most users nothing, partly
 * because the data was missing and partly because it was a tab — a place you go
 * only if you already suspect there is something to find. The point of a ribbon is
 * that nobody has to suspect anything: the answer to "where did this come from" is
 * simply present, the way a filename is present in an editor.
 *
 * Three facts, in the order people ask for them: which source, who, when.
 */

interface Props {
  trace: EntityTrace | null
  latestRun?: RunBrief | null
  loading?: boolean
  onOpenRun?: (runId: string) => void
  /** Rendered inline in the ribbon; used for the "view full trace" affordance. */
  onOpenTrace?: () => void
}

function initials(actor: string): string {
  const name = actor.split('@')[0] || actor
  const parts = name.split(/[.\-_\s]+/).filter(Boolean)
  return (parts.length > 1
    ? parts[0][0] + parts[parts.length - 1][0]
    : name.slice(0, 2)).toUpperCase()
}

export default function LineageRibbon({
  trace, latestRun, loading, onOpenRun, onOpenTrace,
}: Props) {
  const gt = useGraphTheme()

  if (loading) {
    return (
      <div style={{
        height: 52, marginBottom: 14, borderRadius: 10,
        background: gt.panelCard, border: `1px solid ${gt.panelCardBorder}`,
        opacity: 0.5,
      }} className="skeleton" />
    )
  }

  const unattributed = !trace || isUnattributed(trace.attribution)
  const meta = pipelineMeta(trace?.pipeline)
  const hue = pipelineColor(trace?.pipeline, gt.isDark)
  const Icon = meta.icon
  const trigger = triggerMeta(trace?.trigger)
  const lastSeen = trace?.lastSeenAt || trace?.updatedAt
  const dot = freshnessColor(lastSeen, gt.isDark)
  const actor = trace?.actor || trace?.createdBy || ''
  const detail = trace?.sourceDetail || trace?.source || ''

  return (
    <div
      onClick={onOpenTrace}
      role={onOpenTrace ? 'button' : undefined}
      tabIndex={onOpenTrace ? 0 : undefined}
      onKeyDown={(e) => {
        if (onOpenTrace && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onOpenTrace()
        }
      }}
      title={unattributed
        ? 'This entity was written before provenance tracking existed.'
        : `${meta.label} · ${actor || 'unknown actor'} · ${absTime(lastSeen)}`}
      style={{
        position: 'relative',
        display: 'flex', flexDirection: 'column', gap: 5,
        padding: '10px 12px 10px 15px',
        marginBottom: 14,
        borderRadius: 10,
        background: unattributed ? 'transparent' : `linear-gradient(100deg, ${hue}14, ${hue}05 55%, transparent)`,
        border: `1px ${unattributed ? 'dashed' : 'solid'} ${unattributed ? gt.panelBorder : `${hue}38`}`,
        cursor: onOpenTrace ? 'pointer' : 'default',
        transition: 'transform .15s, box-shadow .15s, border-color .15s',
      }}
      onMouseEnter={(e) => {
        if (!onOpenTrace) return
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.boxShadow = `0 4px 18px ${hue}22`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Left rail — the fastest read in the panel. */}
      <span style={{
        position: 'absolute', left: 0, top: 8, bottom: 8, width: 3,
        borderRadius: 3,
        background: unattributed ? gt.panelBorder : hue,
        opacity: unattributed ? 0.6 : 1,
      }} />

      {/* Row 1 — source, trigger, freshness */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={13} style={{ color: unattributed ? gt.mutedText : hue, flexShrink: 0 }} />
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '.3px',
          color: unattributed ? gt.panelSubtext : hue,
        }}>
          {meta.label}
        </span>

        {!unattributed && (
          <span
            title={trigger.hint}
            style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '.6px',
              textTransform: 'uppercase', color: gt.panelSubtext,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            <span style={{ fontSize: 8 }}>{trigger.glyph}</span>{trigger.label}
          </span>
        )}

        <span style={{ flex: 1 }} />

        <span
          title={absTime(lastSeen)}
          style={{
            fontSize: 10, color: gt.panelSubtext, whiteSpace: 'nowrap',
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: dot,
            boxShadow: `0 0 6px ${dot}88`,
          }} />
          {relTime(lastSeen)}
        </span>
      </div>

      {/* Row 2 — who, what, which run */}
      {unattributed ? (
        <div style={{ fontSize: 10.5, color: gt.mutedText, lineHeight: 1.45 }}>
          Origin not recorded — written before tracing began.
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          {actor && (
            <>
              <span
                title={actor}
                style={{
                  width: 17, height: 17, borderRadius: '50%', flexShrink: 0,
                  background: `${hue}26`, color: hue,
                  fontSize: 8, fontWeight: 800, letterSpacing: '.2px',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {initials(actor)}
              </span>
              <span style={{
                fontSize: 10.5, color: gt.panelText, whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130,
              }}>
                {actor}
              </span>
            </>
          )}

          {detail && (
            <span
              title={detail}
              style={{
                fontSize: 10, color: gt.panelSubtext, fontFamily: 'JetBrains Mono, monospace',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                minWidth: 0, flex: 1,
              }}
            >
              {detail}
            </span>
          )}

          {latestRun?.versionNumber && onOpenRun && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenRun(latestRun.runId) }}
              title="Open the ingestion run that last wrote this"
              style={{
                flexShrink: 0, border: `1px solid ${hue}44`, background: `${hue}18`,
                color: hue, borderRadius: 5, padding: '1px 7px',
                fontSize: 9.5, fontWeight: 700, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 3,
              }}
            >
              {latestRun.versionNumber}
              <span style={{ fontSize: 9, opacity: .75 }}>→</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
