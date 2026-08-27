import React from 'react'
import { CheckCircle2, Radio, Clock, XCircle, AlertTriangle, MinusCircle } from 'lucide-react'

export type StationState = 'completed' | 'live' | 'pending' | 'failed' | 'blocked' | 'skipped'

export interface StationNodeProps {
  name: string
  state: StationState
  progressPercent?: number
  tasksCompleted?: number
  tasksTotal?: number
  onClick?: () => void
  isExpanded?: boolean
}

const BADGE_ICONS: Record<StationState, React.ReactNode> = {
  completed: <CheckCircle2 size={10} />,
  live:      <Radio size={10} />,
  pending:   <Clock size={10} />,
  failed:    <XCircle size={10} />,
  blocked:   <AlertTriangle size={10} />,
  skipped:   <MinusCircle size={10} />,
}

const BADGE_LABELS: Record<StationState, string> = {
  completed: 'Done',
  live:      'Live',
  pending:   'Pending',
  failed:    'Failed',
  blocked:   'Blocked',
  skipped:   'Skipped',
}

export const StationNode: React.FC<StationNodeProps> = ({
  name, state, progressPercent, tasksCompleted, tasksTotal, onClick, isExpanded,
}) => {
  return (
    <div
      className={`station-card ${state}`}
      onClick={onClick}
      style={{ userSelect: 'none' }}
    >
      <div className="station-name">{name}</div>

      {state === 'live' && progressPercent !== undefined && (
        <>
          <div className="transit-progress-bar" style={{ marginTop: 6 }}>
            <div className="transit-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <div style={{ fontSize: 10, color: '#00aaff', marginTop: 3 }}>
            {progressPercent.toFixed(0)}%
          </div>
        </>
      )}

      <div className={`station-badge ${state}`} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {state === 'live' ? <span className="blink-dot" /> : BADGE_ICONS[state]}
        {BADGE_LABELS[state]}
      </div>

      {isExpanded && tasksTotal !== undefined && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#5a7a9a' }}>
          {tasksCompleted ?? 0} / {tasksTotal} tasks
        </div>
      )}
    </div>
  )
}
