import { useState } from 'react'
import { AlertCircle, RefreshCw, Cpu, CheckSquare, Square } from 'lucide-react'
import type { ModelOption } from './ModelSelector'

interface ContextSummaryDialogProps {
  fromModel: string
  toModel: ModelOption
  onConfirm: (includeSummary: boolean) => void
  onCancel: () => void
  generating?: boolean
}

export default function ContextSummaryDialog({ fromModel: _fromModel, toModel, onConfirm, onCancel, generating }: ContextSummaryDialogProps) {
  const [includeSummary, setIncludeSummary] = useState(true)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--color-card)', border: '1px solid var(--color-border)',
        borderRadius: 16, padding: 28, width: 420,
        boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'var(--color-primary)22',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Cpu size={20} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Switch Model</div>
            <div style={{ fontSize: 12, color: 'var(--color-subtext)' }}>Switching to {toModel.label}</div>
          </div>
        </div>

        <div style={{
          padding: 14, borderRadius: 10,
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          marginBottom: 20,
        }}>
          <button
            type="button"
            onClick={() => setIncludeSummary(v => !v)}
            style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
          >
            <div style={{ marginTop: 2, flexShrink: 0 }}>
              {includeSummary
                ? <CheckSquare size={18} style={{ color: 'var(--color-primary)' }} />
                : <Square size={18} style={{ color: 'var(--color-muted)' }} />}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 3 }}>
                Include conversation summary as context
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-subtext)', lineHeight: 1.5 }}>
                Recommended when switching models mid-conversation. A 150-word summary of key topics and decisions will be prepended to give the new model context.
              </div>
            </div>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, padding: '10px 14px', borderRadius: 8, background: 'var(--color-warning)11', border: '1px solid var(--color-warning)33' }}>
          <AlertCircle size={14} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
          <p style={{ fontSize: 12, color: 'var(--color-warning)', margin: 0 }}>
            The new model will start a fresh session. Previous messages won't be sent to the new model.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={generating}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              color: 'var(--color-text)', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(includeSummary)}
            disabled={generating}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'var(--color-primary)', color: '#fff', border: 'none',
              cursor: generating ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: generating ? 0.8 : 1,
            }}
          >
            {generating && <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />}
            {generating ? 'Summarizing...' : 'Switch Model'}
          </button>
        </div>
      </div>
    </div>
  )
}
