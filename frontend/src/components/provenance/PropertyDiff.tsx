import { useGraphTheme } from '../../hooks/useGraphTheme'

/**
 * `field  old → new`, one row per changed property.
 *
 * The history tab this replaces printed `JSON.stringify(before)` and
 * `JSON.stringify(after)` as two coloured blobs and left the reader to diff them by
 * eye. For a node with thirty properties where one changed, that is not a diff —
 * it is a puzzle. Here the unchanged fields are simply not shown.
 */

interface Props {
  before: unknown
  after: unknown
  redacted?: boolean
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (value == null) return null
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : { value: parsed }
    } catch {
      return { value }
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return { value }
}

function display(v: unknown): string {
  if (v === undefined || v === null || v === '') return '—'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/** Long hashes and paths are unreadable in a 380px panel and rarely need to be read whole. */
function truncate(s: string, max = 34): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`
}

export default function PropertyDiff({ before, after, redacted }: Props) {
  const gt = useGraphTheme()

  if (redacted) {
    return (
      <div style={{
        fontSize: 10, color: gt.mutedText, fontStyle: 'italic',
        padding: '5px 8px', borderRadius: 5,
        background: gt.panelCard, border: `1px dashed ${gt.panelBorder}`,
      }}>
        Values hidden — requires the ontology maintainer permission.
      </div>
    )
  }

  const a = toRecord(before) ?? {}
  const b = toRecord(after) ?? {}
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]))
    // Bookkeeping this panel already shows above the diff; repeating it on every
    // entry buries the one field the reader is looking for.
    .filter(k => !['updatedAt', 'lastSeenAt', 'lastSeenRunId', 'attribution',
                   'versionId', 'trigger', 'pipeline'].includes(k))
    .filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]))

  if (!keys.length) {
    return (
      <div style={{ fontSize: 10, color: gt.mutedText, padding: '4px 0' }}>
        No property values changed.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {keys.map((key) => {
        const oldV = display(a[key])
        const newV = display(b[key])
        return (
          <div
            key={key}
            style={{
              display: 'grid', gridTemplateColumns: '84px 1fr',
              gap: 8, alignItems: 'baseline',
              fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
            }}
          >
            <span style={{
              color: gt.panelSubtext, whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis',
            }} title={key}>
              {key}
            </span>
            <span style={{ minWidth: 0, lineHeight: 1.5 }}>
              {oldV !== '—' && (
                <>
                  <span
                    title={oldV}
                    style={{ color: '#f87171', textDecoration: 'line-through', opacity: .85 }}
                  >
                    {truncate(oldV)}
                  </span>
                  <span style={{ color: gt.mutedText, margin: '0 5px' }}>→</span>
                </>
              )}
              <span title={newV} style={{ color: '#34d399' }}>{truncate(newV)}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
