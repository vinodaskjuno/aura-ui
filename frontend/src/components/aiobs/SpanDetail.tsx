import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getSpanPayload, type SpanRow } from '../../api/aiObservability'

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, color: 'var(--color-muted)', textTransform: 'uppercase',
        letterSpacing: '0.6px' }}>{label}</span>
      <span style={{ fontSize: 12.5, color: 'var(--color-text)',
        fontFamily: 'var(--font-mono)' }}>{value}</span>
    </div>
  )
}

/** Payloads are fetched only when a span is opened — large ones live in S3, and the
 *  list and waterfall views must never pay for that. */
function Payload({ traceId, span, which }: {
  traceId: string; span: SpanRow; which: 'input' | 'output'
}) {
  const preview = which === 'input' ? span.inputPreview : span.outputPreview
  const ref = which === 'input' ? span.inputRef : span.outputRef
  const [full, setFull] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { setFull(null) }, [span.spanId, which])

  if (!preview && !ref) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, color: 'var(--color-muted)', textTransform: 'uppercase',
          letterSpacing: '0.6px' }}>{which}</span>
        {ref && !full && (
          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              setLoading(true)
              try {
                setFull((await getSpanPayload(traceId, span.spanId, which)).content)
              } finally { setLoading(false) }
            }}
            style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, cursor: 'pointer',
              background: 'var(--color-surface)', color: 'var(--color-subtext)',
              border: '1px solid var(--color-border)' }}
          >
            {loading ? <Loader2 size={9} className="animate-spin" /> : 'load full'}
          </button>
        )}
      </div>
      <pre style={{ margin: 0, fontSize: 11.5, lineHeight: 1.55, whiteSpace: 'pre-wrap',
        wordBreak: 'break-word', maxHeight: 220, overflowY: 'auto',
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 6, padding: '8px 10px', color: 'var(--color-text)' }}>
        {full ?? preview}
        {ref && !full ? '\n\n… truncated, load full to see everything' : ''}
      </pre>
    </div>
  )
}

export default function SpanDetail({ traceId, span }: { traceId: string; span: SpanRow | null }) {
  if (!span) {
    return (
      <div style={{ fontSize: 12, color: 'var(--color-subtext)', padding: 12 }}>
        Select a span to inspect its input, output, tokens and cost.
      </div>
    )
  }
  const tags = Object.entries(span.tags ?? {}).filter(([, v]) => v !== '' && v !== null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>{span.name}</div>
        <div style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
          {span.spanId}
        </div>
      </div>

      {span.status === 'error' && (
        <div style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '8px 10px' }}>
          {span.error || 'This span reported an error.'}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="kind" value={span.kind} />
        <Field label="latency" value={`${span.latencyMs} ms`} />
        {span.model && <Field label="model" value={span.model} />}
        <Field label="tokens" value={span.totalTokens || '—'} />
        <Field label="cost" value={span.costUsd ? `$${span.costUsd.toFixed(6)}` : '—'} />
        <Field label="status" value={span.status} />
      </div>

      <Payload traceId={traceId} span={span} which="input" />
      <Payload traceId={traceId} span={span} which="output" />

      {tags.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--color-muted)', textTransform: 'uppercase',
            letterSpacing: '0.6px' }}>attributes</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {tags.map(([k, v]) => (
              <span key={k} style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 4,
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                color: 'var(--color-subtext)', fontFamily: 'var(--font-mono)' }}>
                {k}={String(v).slice(0, 40)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
