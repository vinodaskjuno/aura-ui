import { useState, useEffect } from 'react'
import { GitBranch, Plus, RefreshCw, ChevronDown, GitFork, Check } from 'lucide-react'
import { listBranches, createBranch } from '../../api/gitOps'

interface BranchPickerProps {
  repoUrl: string
  token: string
  value: string
  onChange: (branch: string) => void
  disabled?: boolean
}

export default function BranchPicker({ repoUrl, token, value, onChange, disabled }: BranchPickerProps) {
  const [branches, setBranches] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newBranch, setNewBranch] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (repoUrl && token && repoUrl.startsWith('https://')) {
      fetchBranches()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoUrl, token])

  async function fetchBranches() {
    setLoading(true)
    setError('')
    try {
      const result = await listBranches(repoUrl, token)
      setBranches(result.branches)
      if (!value && result.defaultBranch) onChange(result.defaultBranch)
    } catch {
      setError('Could not fetch branches')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateBranch() {
    if (!newBranch.trim()) return
    setCreating(true)
    try {
      await createBranch({ repoUrl, token, baseBranch: value || 'main', newBranchName: newBranch.trim() })
      setBranches(prev => [...prev, newBranch.trim()])
      onChange(newBranch.trim())
      setNewBranch('')
      setOpen(false)
    } catch {
      setError('Failed to create branch')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 8,
          background: 'var(--color-card)', border: '1px solid var(--color-border)',
          color: 'var(--color-text)', cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 13, transition: 'border-color 0.2s',
          opacity: disabled ? 0.6 : 1,
        }}
        onMouseEnter={e => !disabled && ((e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-primary)')}
        onMouseLeave={e => !disabled && ((e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)')}
      >
        {loading
          ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-primary)' }} />
          : <GitBranch size={14} style={{ color: 'var(--color-primary)' }} />}
        <span style={{ flex: 1, textAlign: 'left', color: value ? 'var(--color-text)' : 'var(--color-muted)' }}>
          {loading ? 'Fetching branches...' : (value || 'Select branch')}
        </span>
        <ChevronDown size={14} style={{ color: 'var(--color-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {error && <p style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }}>{error}</p>}

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: 'var(--color-card)', border: '1px solid var(--color-border)',
          borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 100,
          maxHeight: 220, overflowY: 'auto',
        }}>
          {/* Existing branches */}
          {branches.map(b => (
            <button
              key={b}
              type="button"
              onClick={() => { onChange(b); setOpen(false) }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', background: 'none', border: 'none',
                color: 'var(--color-text)', cursor: 'pointer', fontSize: 13,
                textAlign: 'left',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-card-hover)'}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'none'}
            >
              <GitFork size={13} style={{ color: 'var(--color-muted)', flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{b}</span>
              {b === value && <Check size={13} style={{ color: 'var(--color-success)' }} />}
            </button>
          ))}

          {/* Divider + create new */}
          <div style={{ borderTop: '1px solid var(--color-border)', padding: '8px' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={newBranch}
                onChange={e => setNewBranch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateBranch()}
                placeholder="New branch name..."
                style={{
                  flex: 1, padding: '6px 10px', borderRadius: 6, fontSize: 12,
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  color: 'var(--color-text)', outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={handleCreateBranch}
                disabled={creating || !newBranch.trim()}
                style={{
                  padding: '6px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: 'var(--color-primary)', color: '#fff', border: 'none',
                  cursor: creating || !newBranch.trim() ? 'not-allowed' : 'pointer',
                  opacity: creating || !newBranch.trim() ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                {creating
                  ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                  : <Plus size={12} />}
                {creating ? '' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
