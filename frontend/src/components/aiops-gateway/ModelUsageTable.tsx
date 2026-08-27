import type { UsageMetrics } from '../../api/aiopsGateway'
import { fmtTokens, fmtUsd, modelColor } from './usageFormat'

/**
 * Shared per-model / per-tool usage table.
 *
 * Every column here exists because it changes a spending decision:
 *   - Cache read vs Cache write are separate because they are priced very
 *     differently (~0.1x vs 1.25-2x the input rate). Merging them into "input"
 *     is how a dashboard ends up reporting several times the real cost.
 *   - Hit % is the single most actionable number on the page: a low cache-hit
 *     rate on a long agentic session usually means a prompt prefix is being
 *     invalidated, and that is expensive.
 */

export interface ModelUsageRow extends UsageMetrics {
  model?: string
  tool?: string
}

interface Props {
  rows: ModelUsageRow[]
  /** Show a Tool column — use when rows are the (tool, model) matrix. */
  showTool?: boolean
  /** Human label per tool id. */
  toolNames?: Record<string, string>
  emptyMessage?: string
  maxRows?: number
}

const TH: React.CSSProperties = {
  textAlign: 'right',
  padding: '7px 10px',
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  color: 'var(--color-muted)',
  whiteSpace: 'nowrap',
}
const TD: React.CSSProperties = {
  textAlign: 'right',
  padding: '7px 10px',
  fontSize: 12,
  color: 'var(--color-text)',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
}

export default function ModelUsageTable({
  rows,
  showTool = false,
  toolNames = {},
  emptyMessage = 'No usage recorded for this period.',
  maxRows,
}: Props) {
  if (!rows || rows.length === 0) {
    return (
      <div style={{ fontSize: 12, color: 'var(--color-muted)', padding: '18px 4px' }}>
        {emptyMessage}
      </div>
    )
  }

  const shown = maxRows ? rows.slice(0, maxRows) : rows
  const totals = rows.reduce(
    (acc, r) => ({
      inputTokens: acc.inputTokens + (r.inputTokens || 0),
      outputTokens: acc.outputTokens + (r.outputTokens || 0),
      cacheReadTokens: acc.cacheReadTokens + (r.cacheReadTokens || 0),
      cacheCreationTokens: acc.cacheCreationTokens + (r.cacheCreationTokens || 0),
      totalTokens: acc.totalTokens + (r.totalTokens || 0),
      costUsd: acc.costUsd + (r.costUsd || 0),
      calls: acc.calls + (r.calls || 0),
    }),
    {
      inputTokens: 0, outputTokens: 0, cacheReadTokens: 0,
      cacheCreationTokens: 0, totalTokens: 0, costUsd: 0, calls: 0,
    },
  )
  const totalHitRate = totals.totalTokens
    ? (totals.cacheReadTokens / totals.totalTokens) * 100
    : 0

  return (
    // Wide table: scroll inside its own container so the page body never
    // scrolls horizontally on a narrow viewport.
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: showTool ? 760 : 660 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
            {showTool && <th style={{ ...TH, textAlign: 'left' }}>Tool</th>}
            <th style={{ ...TH, textAlign: 'left' }}>Model</th>
            <th style={TH}>Calls</th>
            <th style={TH}>Input</th>
            <th style={TH}>Output</th>
            <th style={TH} title="Tokens read from the prompt cache — billed at ~0.1x the input rate">
              Cache rd
            </th>
            <th style={TH} title="Tokens written to the prompt cache — billed at 1.25x (5 min) or 2x (1 hour) the input rate">
              Cache wr
            </th>
            <th style={TH} title="Cache reads as a share of all tokens — higher is cheaper">Hit %</th>
            <th style={TH}>Avg ms</th>
            <th style={TH}>Cost</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr
              key={`${r.tool ?? ''}:${r.model ?? ''}:${i}`}
              style={{
                borderBottom: '1px solid var(--color-border)',
                background: i % 2 ? 'transparent' : 'var(--color-surface)',
              }}
            >
              {showTool && (
                <td style={{ ...TD, textAlign: 'left', color: 'var(--color-muted)' }}>
                  {toolNames[r.tool ?? ''] ?? r.tool ?? '—'}
                </td>
              )}
              <td style={{ ...TD, textAlign: 'left', fontWeight: 600 }}>
                <span style={{
                  display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                  background: modelColor(r.model ?? ''), marginRight: 7,
                }} />
                {r.model ?? '—'}
              </td>
              <td style={TD}>{r.calls ?? 0}</td>
              <td style={TD}>{fmtTokens(r.inputTokens || 0)}</td>
              <td style={TD}>{fmtTokens(r.outputTokens || 0)}</td>
              <td style={TD}>{fmtTokens(r.cacheReadTokens || 0)}</td>
              <td style={TD}>{fmtTokens(r.cacheCreationTokens || 0)}</td>
              <td style={{ ...TD, color: 'var(--color-muted)' }}>
                {(r.cacheHitRate ?? 0).toFixed(0)}%
              </td>
              <td style={{ ...TD, color: 'var(--color-muted)' }}>{r.avgLatencyMs ?? 0}</td>
              <td style={{ ...TD, fontWeight: 700 }}>{fmtUsd(r.costUsd || 0)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid var(--color-border)' }}>
            {showTool && <td style={{ ...TD, textAlign: 'left' }} />}
            <td style={{ ...TD, textAlign: 'left', fontWeight: 700, color: 'var(--color-muted)' }}>
              {maxRows && rows.length > maxRows
                ? `Total (all ${rows.length})`
                : 'Total'}
            </td>
            <td style={{ ...TD, fontWeight: 700 }}>{totals.calls}</td>
            <td style={{ ...TD, fontWeight: 700 }}>{fmtTokens(totals.inputTokens)}</td>
            <td style={{ ...TD, fontWeight: 700 }}>{fmtTokens(totals.outputTokens)}</td>
            <td style={{ ...TD, fontWeight: 700 }}>{fmtTokens(totals.cacheReadTokens)}</td>
            <td style={{ ...TD, fontWeight: 700 }}>{fmtTokens(totals.cacheCreationTokens)}</td>
            <td style={{ ...TD, fontWeight: 700, color: 'var(--color-muted)' }}>
              {totalHitRate.toFixed(0)}%
            </td>
            <td style={TD} />
            <td style={{ ...TD, fontWeight: 700 }}>{fmtUsd(totals.costUsd)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
