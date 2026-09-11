import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Terminal } from 'lucide-react'
import { qaApi } from '../../api/qa'

/**
 * Browser console errors and failed requests captured during a run.
 *
 * The runner collects these because a page that renders while throwing is a pass that
 * should not be trusted. They were written to S3 from the beginning and no screen ever
 * showed them.
 *
 * Fetched lazily on expand: most readers never open it, and it is a separate object.
 */
export default function ConsoleLog({ projectId, runId }: {
  projectId: string
  runId: string
}) {
  const [open, setOpen] = useState(false)
  const [lines, setLines] = useState<string[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!open || lines !== null) return
    let stop = false
    qaApi.getConsole(projectId, runId)
      .then(({ data }) => { if (!stop) setLines(data.lines || []) })
      .catch(() => { if (!stop) setFailed(true) })
    return () => { stop = true }
  }, [open, lines, projectId, runId])

  return (
    <div>
      <button onClick={() => setOpen(v => !v)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12,
                       background: 'transparent', border: 'none', cursor: 'pointer',
                       padding: 0, color: 'var(--color-text)' }}>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Terminal size={12} />
        Console output
        {lines !== null && (
          <span style={{ color: 'var(--color-text-secondary)' }}>({lines.length})</span>
        )}
      </button>

      {open && (
        <div style={{ marginTop: 8 }}>
          {failed && (
            <p style={muted}>Could not read the console log for this run.</p>
          )}
          {!failed && lines === null && <p style={muted}>Loading…</p>}
          {!failed && lines?.length === 0 && (
            <p style={muted}>No console errors or failed requests were captured.</p>
          )}
          {!!lines?.length && (
            <pre style={{ margin: 0, fontSize: 11, lineHeight: 1.6, maxHeight: 320,
                          overflow: 'auto', whiteSpace: 'pre-wrap',
                          fontFamily: 'var(--font-mono, monospace)',
                          color: 'var(--color-text-secondary)',
                          border: '1px solid var(--color-border)', borderRadius: 6,
                          padding: 10 }}>
              {lines.join('\n')}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

const muted: React.CSSProperties = {
  fontSize: 11, color: 'var(--color-text-secondary)', margin: 0,
}
