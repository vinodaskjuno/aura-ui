import { useGraphTheme } from '../../hooks/useGraphTheme'
import TraceTimeline from './TraceTimeline'
import {
  absTime, isUnattributed, pipelineColor, pipelineMeta, relTime, triggerMeta,
} from './pipelineMeta'
import type { EntityTraceResponse } from '../../api/provenance'

/**
 * The Trace tab: origin, contributors, trust, then the timeline.
 *
 * This replaces the separate "Provenance" and "History" tabs. They were two halves
 * of one question — where did this come from, and what has happened to it since —
 * and splitting them meant neither could answer it. Reading them in one column, in
 * that order, is the whole point.
 */

interface Props {
  data: EntityTraceResponse | null
  loading: boolean
  error?: string | null
  onOpenRun?: (runId: string) => void
  onRetry?: () => void
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  const gt = useGraphTheme()
  return (
    <div style={{
      fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '1.2px', color: gt.sectionLabel, marginBottom: 8,
    }}>
      {children}
    </div>
  )
}

export default function TracePanel({ data, loading, error, onOpenRun, onRetry }: Props) {
  const gt = useGraphTheme()

  const card: React.CSSProperties = {
    padding: '10px 12px', background: gt.panelCard,
    border: `1px solid ${gt.panelCardBorder}`, borderRadius: 8,
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[64, 40, 96].map((h, i) => (
          <div key={i} className="skeleton"
               style={{ height: h, borderRadius: 8, background: gt.panelCard, opacity: .5 }} />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 12px' }}>
        <div style={{ color: gt.panelSubtext, fontSize: 12, marginBottom: 10 }}>{error}</div>
        {onRetry && (
          <button onClick={onRetry} style={{
            border: `1px solid ${gt.accentBorder}`, background: gt.accentBg,
            color: gt.accent, borderRadius: 6, padding: '4px 12px',
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}>
            Try again
          </button>
        )}
      </div>
    )
  }

  if (!data) return null

  const { trace, origin, latest, contributingSources, timeline } = data
  const unattributed = isUnattributed(trace.attribution)

  // Runs that touched this entity without changing it. The graph knows the run that
  // last wrote it; if that run left no changelog row, the entity was re-confirmed.
  const latestRunInTimeline = timeline.some(e => e.runId && e.runId === trace.lastSeenRunId)
  const reconfirmed = !latestRunInTimeline && trace.lastSeenRunId && timeline.length
    ? { count: 1, sinceIso: trace.lastSeenAt }
    : null

  const originMeta = pipelineMeta(trace.createdVia || trace.pipeline)
  const originHue = pipelineColor(trace.createdVia || trace.pipeline, gt.isDark)
  const OriginIcon = originMeta.icon
  const originTrigger = triggerMeta(origin?.trigger || trace.trigger)

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* ── Origin ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <SectionLabel>Origin</SectionLabel>
        {unattributed && !trace.firstSeenAt ? (
          <div style={{ ...card, borderStyle: 'dashed' }}>
            <div style={{ fontSize: 11.5, color: gt.panelSubtext, lineHeight: 1.55 }}>
              This was written before provenance tracking existed, so no actor or run
              was recorded. Everything written from now on carries a full trace.
            </div>
          </div>
        ) : (
          <div style={{ ...card, borderLeft: `3px solid ${originHue}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
              <OriginIcon size={12} style={{ color: originHue }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: originHue }}>
                {originMeta.label}
              </span>
              {origin?.status && (
                <span style={{
                  fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase',
                  padding: '1px 6px', borderRadius: 4,
                  background: origin.status === 'success' ? '#34d39922' : '#fbbf2422',
                  color: origin.status === 'success' ? '#34d399' : '#fbbf24',
                }}>
                  {origin.status}
                </span>
              )}
            </div>

            {(trace.createdBy || origin?.actor) && (
              <Row label="Created by" value={trace.createdBy || origin?.actor || ''} />
            )}
            <Row
              label="When"
              value={absTime(trace.firstSeenAt || trace.createdAt)}
              hint={relTime(trace.firstSeenAt || trace.createdAt)}
            />
            {(origin?.sourceDetail || trace.sourceDetail) && (
              <Row label="From" value={origin?.sourceDetail || trace.sourceDetail || ''} mono />
            )}
            <Row
              label="Trigger"
              value={`${originTrigger.glyph}  ${originTrigger.label}`}
            />

            {origin?.versionNumber && onOpenRun && (
              <button
                onClick={() => onOpenRun(origin.runId)}
                style={{
                  marginTop: 8, border: `1px solid ${originHue}44`,
                  background: `${originHue}18`, color: originHue,
                  borderRadius: 5, padding: '2px 8px', fontSize: 9.5,
                  fontWeight: 700, cursor: 'pointer',
                }}
              >
                {origin.versionNumber} →
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Contributing sources ───────────────────────────────────────── */}
      {contributingSources.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionLabel>Contributing sources</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {contributingSources.map(({ pipeline, count }) => {
              const meta = pipelineMeta(pipeline)
              const hue = pipelineColor(pipeline, gt.isDark)
              const Icon = meta.icon
              return (
                <span
                  key={pipeline}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 10, fontWeight: 600, padding: '2px 8px',
                    borderRadius: 12, color: hue,
                    background: `${hue}16`, border: `1px solid ${hue}33`,
                  }}
                >
                  <Icon size={10} />
                  {meta.label}
                  {count > 1 && (
                    <span style={{ opacity: .7, fontWeight: 700 }}>×{count}</span>
                  )}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Trust ──────────────────────────────────────────────────────── */}
      {(trace.confidence !== undefined || trace.discoveredBy || trace.factType
        || (trace.evidence?.length ?? 0) > 0) && (
        <div style={{ marginBottom: 16 }}>
          <SectionLabel>Trust</SectionLabel>
          <div style={card}>
            {trace.confidence !== undefined && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                <span style={{ fontSize: 10.5, color: gt.panelSubtext, width: 68 }}>
                  Confidence
                </span>
                <div style={{ flex: 1, height: 5, borderRadius: 3, background: gt.panelBorder }}>
                  <div style={{
                    width: `${Math.round(trace.confidence * 100)}%`, height: '100%',
                    borderRadius: 3, transition: 'width .4s',
                    background: trace.confidence > 0.8 ? '#34d399'
                      : trace.confidence > 0.5 ? '#fbbf24' : '#f87171',
                  }} />
                </div>
                <span style={{
                  fontSize: 10.5, fontWeight: 700,
                  color: trace.confidence > 0.8 ? '#34d399'
                    : trace.confidence > 0.5 ? '#fbbf24' : '#f87171',
                }}>
                  {Math.round(trace.confidence * 100)}%
                </span>
              </div>
            )}
            {trace.factType && (
              <Row
                label="Fact type"
                value={trace.factType}
                color={trace.factType === 'known' ? '#34d399'
                  : trace.factType === 'inferred' ? '#fbbf24' : '#a78bfa'}
              />
            )}
            {trace.discoveredBy && <Row label="Discovered by" value={trace.discoveredBy} />}
            {trace.writtenBy && <Row label="Written by" value={trace.writtenBy} mono />}

            {(trace.evidence?.length ?? 0) > 0 && (
              <div style={{ marginTop: 7 }}>
                <div style={{
                  fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '.8px', color: gt.panelSubtext, marginBottom: 4,
                }}>
                  Evidence
                </div>
                {trace.evidence!.map((ev, i) => (
                  <div key={i} style={{
                    fontSize: 9.5, color: gt.accent, fontFamily: 'JetBrains Mono, monospace',
                    padding: '2px 6px', background: gt.accentBg, borderRadius: 4,
                    marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }} title={ev}>
                    {ev}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Timeline ───────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Timeline</SectionLabel>
        <TraceTimeline
          events={timeline}
          reconfirmedSince={reconfirmed}
          canSeeValues={data.canSeeValues}
          latestRun={latest}
          onOpenRun={onOpenRun}
        />
      </div>
    </div>
  )
}

function Row({ label, value, hint, mono, color }: {
  label: string; value: string; hint?: string; mono?: boolean; color?: string
}) {
  const gt = useGraphTheme()
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 3, alignItems: 'baseline' }}>
      <span style={{ fontSize: 10.5, color: gt.panelSubtext, width: 68, flexShrink: 0 }}>
        {label}
      </span>
      <span
        title={value}
        style={{
          fontSize: 10.5, color: color || gt.panelText, minWidth: 0,
          fontFamily: mono ? 'JetBrains Mono, monospace' : undefined,
          fontWeight: color ? 700 : 400,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {value}
        {hint && <span style={{ color: gt.mutedText, marginLeft: 6 }}>· {hint}</span>}
      </span>
    </div>
  )
}
