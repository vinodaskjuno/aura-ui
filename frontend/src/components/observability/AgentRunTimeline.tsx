import { motion } from 'framer-motion'
import { Check, Circle, Loader2, X } from 'lucide-react'
import type { RunState } from '../../hooks/useObservabilityStream'
import { AGENT_LABELS, fmtDuration } from './observabilityFormat'

const STATUS_COLOR: Record<string, string> = {
  pending: '#6b7280', running: '#4f8ef7', success: '#10b981',
  partial: '#f59e0b', failed: '#ef4444',
}

function AgentIcon({ status }: { status: string }) {
  if (status === 'running') {
    return <Loader2 size={11} color={STATUS_COLOR.running}
      style={{ animation: 'spin 1s linear infinite' }} />
  }
  if (status === 'failed') return <X size={11} color={STATUS_COLOR.failed} />
  if (status === 'pending') return <Circle size={11} color={STATUS_COLOR.pending} />
  return <Check size={11} color={STATUS_COLOR[status] ?? STATUS_COLOR.success} />
}

export default function AgentRunTimeline({ state }: { state: RunState }) {
  const pct = state.totalAgents
    ? Math.round((state.agentsDone / state.totalAgents) * 100)
    : 0

  return (
    <div>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 700,
            color: 'var(--color-text)' }}>
            {state.runId || '—'}
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
            {state.agentsDone}/{state.totalAgents || '?'}
          </span>
        </div>
        <div style={{ height: 5, borderRadius: 3, background: 'var(--color-border)',
          overflow: 'hidden' }}>
          <motion.div
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.3 }}
            style={{ height: '100%', background: state.status === 'failed'
              ? STATUS_COLOR.failed : 'var(--color-primary)' }}
          />
        </div>
        {state.elapsedMs > 0 && (
          <div style={{ fontSize: 10.5, color: 'var(--color-muted)', marginTop: 4,
            fontFamily: 'var(--font-mono)' }}>
            {fmtDuration(state.elapsedMs)} elapsed
          </div>
        )}
      </div>

      {state.stages.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--color-muted)', padding: '10px 0' }}>
          No run in progress.
        </div>
      )}

      {state.stages.map((stage) => (
        <div key={stage.stage} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
            <span style={{
              width: 16, height: 16, borderRadius: 4, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 800, fontFamily: 'var(--font-mono)',
              background: stage.status === 'done' ? '#10b98122'
                : stage.status === 'running' ? '#4f8ef722' : 'var(--color-border)',
              color: stage.status === 'done' ? '#10b981'
                : stage.status === 'running' ? '#4f8ef7' : 'var(--color-muted)',
            }}>{stage.stage}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)',
              flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap' }}>{stage.title}</span>
            {stage.elapsedMs !== undefined && stage.status === 'done' && (
              <span style={{ fontSize: 10, color: 'var(--color-muted)',
                fontFamily: 'var(--font-mono)' }}>{fmtDuration(stage.elapsedMs)}</span>
            )}
          </div>

          <div style={{ paddingLeft: 23 }}>
            {stage.agents.map((agent) => (
              <motion.div
                key={agent.name}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}
              >
                <AgentIcon status={agent.status} />
                <span style={{ fontSize: 11.5, flex: 1, minWidth: 0,
                  color: agent.status === 'pending' ? 'var(--color-muted)' : 'var(--color-text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {AGENT_LABELS[agent.name] ?? agent.name}
                </span>
                {agent.evidenceAdded ? (
                  <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)',
                    color: '#4f8ef7' }}>+{agent.evidenceAdded}</span>
                ) : null}
                {agent.elapsedMs ? (
                  <span style={{ fontSize: 9.5, color: 'var(--color-muted)',
                    fontFamily: 'var(--font-mono)' }}>{fmtDuration(agent.elapsedMs)}</span>
                ) : null}
              </motion.div>
            ))}
          </div>
        </div>
      ))}

      {state.error && (
        <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 6,
          background: '#ef444418', border: '1px solid #ef444455',
          color: '#ef4444', fontSize: 11.5 }}>
          {state.error}
        </div>
      )}
    </div>
  )
}
