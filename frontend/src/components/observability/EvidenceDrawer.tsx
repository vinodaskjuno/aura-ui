import { useEffect, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { ExternalLink, Copy, Link2 } from 'lucide-react'
import observabilityApi, { type Evidence, type EvidenceDetail, type Finding } from '../../api/observability'
import { MaskedText } from './evidenceCitations'
import { EVIDENCE_KIND_META, clockTime } from './observabilityFormat'

interface Props {
  investigationId: string
  evidence: Evidence | null
  findings: Finding[]
  demo: boolean
  onJumpToFinding: (findingId: string) => void
}

export default function EvidenceDrawer({
  investigationId, evidence, findings, demo, onJumpToFinding,
}: Props) {
  const [detail, setDetail] = useState<EvidenceDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setDetail(null)
    if (!evidence || demo) return
    let cancelled = false
    setLoading(true)
    observabilityApi.getEvidenceDetail(investigationId, evidence.evidenceId)
      .then((r) => { if (!cancelled) setDetail(r.data) })
      .catch(() => { /* the summary is still useful without the payload */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [investigationId, evidence, demo])

  if (!evidence) {
    return (
      <div style={{ padding: 18, fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.7 }}>
        Click a citation chip to inspect the data behind a claim.
        <div style={{ marginTop: 10, fontSize: 11.5 }}>
          Every conclusion in this workspace links to the evidence that produced it.
          A claim with no citations is drawn with a dashed border and marked
          <b style={{ color: '#f59e0b' }}> unsupported</b>.
        </div>
      </div>
    )
  }

  const meta = EVIDENCE_KIND_META[evidence.kind] ?? EVIDENCE_KIND_META.log
  const citedBy = findings.filter((f) => f.evidenceIds.includes(evidence.evidenceId))
  const points = (detail?.payload?.points as { timestamp: string; value: number }[]) ?? []
  const spans = (detail?.payload?.spans as { operation: string; duration_ms: number;
    service: string; status: string }[]) ?? []
  const body = (detail?.payload?.body as string) ?? ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
            textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4,
            background: `${meta.color}22`, color: meta.color }}>{meta.label}</span>
          <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{evidence.provider}</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--color-muted)' }}>{clockTime(evidence.timestamp)}</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
          {evidence.title}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--color-muted)', marginTop: 3 }}>{evidence.evidenceId}</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', minHeight: 0 }}>
        <div style={{ fontSize: 12.5, lineHeight: 1.7, color: 'var(--color-text)',
          fontFamily: evidence.kind === 'log' ? 'var(--font-mono)' : undefined,
          wordBreak: 'break-word' }}>
          <MaskedText text={evidence.summary} />
        </div>

        {loading && (
          <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 10 }}>
            Loading full payload…
          </div>
        )}

        {body && (
          <pre style={{ marginTop: 12, padding: 10, borderRadius: 6, fontSize: 11,
            lineHeight: 1.6, background: 'var(--color-surface)',
            border: '1px solid var(--color-border)', overflowX: 'auto',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}>
            <MaskedText text={body} />
          </pre>
        )}

        {points.length > 0 && (
          <div style={{ marginTop: 14, height: 130 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points.map((p) => ({ t: clockTime(p.timestamp), v: p.value }))}>
                <defs>
                  <linearGradient id="gEvidence" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={meta.color} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={meta.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" tick={{ fontSize: 9 }} hide />
                <YAxis tick={{ fontSize: 9 }} width={38} />
                <Tooltip contentStyle={{ fontSize: 11, background: 'var(--color-card)',
                  border: '1px solid var(--color-border)', borderRadius: 6 }} />
                <ReferenceLine x={points[Math.floor(points.length / 2)]
                  ? clockTime(points[Math.floor(points.length / 2)].timestamp) : undefined}
                  stroke="#ef4444" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="v" stroke={meta.color}
                  fill="url(#gEvidence)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {spans.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6 }}>
              Slowest spans
            </div>
            {spans.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7,
                fontSize: 11, padding: '3px 0' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: s.status === 'error' ? '#ef4444' : '#10b981' }} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.operation}</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>
                  {Math.round(s.duration_ms)}ms
                </span>
              </div>
            ))}
          </div>
        )}

        {citedBy.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 11,
            borderTop: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 7,
              display: 'flex', alignItems: 'center', gap: 5 }}>
              <Link2 size={11} /> Cited by
            </div>
            {/* Bidirectionality is what makes this read as evidence rather than
                decoration — a one-way link is garnish. */}
            {citedBy.map((f) => (
              <button
                key={f.findingId}
                onClick={() => onJumpToFinding(f.findingId)}
                style={{ display: 'block', width: '100%', textAlign: 'left',
                  fontSize: 11.5, padding: '5px 8px', marginBottom: 4, borderRadius: 5,
                  background: 'var(--color-surface)', color: 'var(--color-text)',
                  border: '1px solid var(--color-border)', cursor: 'pointer' }}
              >
                <b style={{ fontFamily: 'var(--font-mono)', marginRight: 6 }}>
                  {String(f.rank).padStart(2, '0')}
                </b>
                {f.claim.replace(/\[\[ev:[^\]]+\]\]/g, '').slice(0, 70)}…
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--color-border)',
        display: 'flex', gap: 7 }}>
        {evidence.sourceUrl && evidence.sourceUrl !== '#' && (
          <a href={evidence.sourceUrl} target="_blank" rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5,
              fontWeight: 600, padding: '5px 10px', borderRadius: 6, textDecoration: 'none',
              background: 'var(--color-primary)', color: '#fff' }}>
            <ExternalLink size={12} /> Open in {evidence.provider}
          </a>
        )}
        <button
          onClick={() => navigator.clipboard?.writeText(`[[ev:${evidence.evidenceId}]]`)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5,
            fontWeight: 600, padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
            background: 'transparent', color: 'var(--color-muted)',
            border: '1px solid var(--color-border)' }}>
          <Copy size={12} /> Copy citation
        </button>
      </div>
    </div>
  )
}
