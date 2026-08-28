import { useEffect, useState } from 'react'
import { Check, Circle, ListTree, Sparkles, Trash2, User } from 'lucide-react'
import observabilityApi, { type LearnedArtifact, type RunbookMatch } from '../../api/observability'
import { relTime } from './observabilityFormat'

const ORIGIN_META: Record<string, { label: string; color: string; Icon: typeof User }> = {
  human:       { label: 'Human-authored', color: '#10b981', Icon: User },
  confluence:  { label: 'Confluence',     color: '#4f8ef7', Icon: User },
  git:         { label: 'Git',            color: '#4f8ef7', Icon: User },
  synthesized: { label: 'Synthesized',    color: '#8b5cf6', Icon: Sparkles },
  template:    { label: 'Built-in',       color: '#6b7280', Icon: ListTree },
}

/** Governance at the point of use — a separate screen nobody visits does not work. */
export default function RunbookPanel({ matched }: { matched?: RunbookMatch | null }) {
  const [origin, setOrigin] = useState('')
  const [rows, setRows] = useState<RunbookMatch[]>([])
  const [learned, setLearned] = useState<LearnedArtifact[]>([])
  const [busy, setBusy] = useState('')

  const load = () => {
    observabilityApi.searchRunbooks(origin ? { origin } : {})
      .then((r) => setRows(r.data.runbooks ?? [])).catch(() => setRows([]))
    observabilityApi.listLearned()
      .then((r) => setLearned(r.data.artifacts ?? [])).catch(() => setLearned([]))
  }
  useEffect(load, [origin])

  const forget = async (id: string) => {
    setBusy(id)
    try { await observabilityApi.forgetLearned(id); load() } finally { setBusy('') }
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {matched && (
        <section>
          <SectionTitle>Matched for the current investigation</SectionTitle>
          <RunbookCard rb={matched} />
        </section>
      )}

      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <SectionTitle inline>Runbook library</SectionTitle>
          <div style={{ flex: 1 }} />
          {['', 'human', 'synthesized', 'candidate'].map((o) => (
            <button key={o || 'all'} onClick={() => setOrigin(o)}
              style={{
                fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20,
                cursor: 'pointer', border: '1px solid var(--color-border)',
                background: origin === o ? 'var(--color-primary)' : 'transparent',
                color: origin === o ? '#fff' : 'var(--color-muted)',
              }}>
              {o === '' ? 'All' : o === 'candidate' ? 'Candidates' : ORIGIN_META[o]?.label ?? o}
            </button>
          ))}
        </div>
        {rows.length === 0 && (
          <Empty>No runbooks yet. Upload one, connect Confluence, or let a confirmed
            investigation synthesize a candidate.</Empty>
        )}
        {rows.map((rb) => <RunbookCard key={rb.runbook_id ?? rb.runbookId} rb={rb} />)}
      </section>

      <section>
        <SectionTitle>Learned artifacts</SectionTitle>
        <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginBottom: 9,
          lineHeight: 1.6 }}>
          Everything the agents have learned from confirmed outcomes, with provenance.
          A lesson recorded during a chaotic outage can be wrong — forgetting one is a
          plain delete, because learned artifacts are data, not weights.
        </div>
        {learned.length === 0 && <Empty>Nothing learned yet.</Empty>}
        {learned.map((a) => (
          <div key={a.artifactId} style={{ display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px', marginBottom: 6, borderRadius: 7,
            background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 9.5, fontWeight: 800, padding: '2px 7px', borderRadius: 4,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              background: a.kind === 'runbook' ? '#8b5cf622' : '#4f8ef722',
              color: a.kind === 'runbook' ? '#8b5cf6' : '#4f8ef7' }}>{a.kind}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--color-text)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {a.title || a.artifactId}
            </span>
            <span style={{ fontSize: 10.5, color: 'var(--color-muted)' }}>
              from {a.learnedFrom.length} run{a.learnedFrom.length === 1 ? '' : 's'}
            </span>
            <span style={{ fontSize: 10.5, color: 'var(--color-muted)' }}>
              {relTime(a.createdAt)}
            </span>
            <button onClick={() => forget(a.artifactId)} disabled={busy === a.artifactId}
              title="Bad lesson — forget this"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11,
                padding: '3px 8px', borderRadius: 5, cursor: 'pointer',
                background: 'transparent', color: '#ef4444',
                border: '1px solid #ef444455' }}>
              <Trash2 size={11} /> Forget
            </button>
          </div>
        ))}
      </section>
    </div>
  )
}

function RunbookCard({ rb }: { rb: RunbookMatch }) {
  const origin = ORIGIN_META[rb.origin] ?? ORIGIN_META.human
  const Icon = origin.Icon
  const satisfied = rb.steps?.filter((s) => s.status === 'satisfied').length ?? 0
  return (
    <div style={{ padding: 13, marginBottom: 8, borderRadius: 8,
      background: 'var(--color-card)', border: '1px solid var(--color-border)',
      borderLeft: `3px solid ${origin.color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
        <Icon size={13} color={origin.color} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)',
          flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap' }}>{rb.title}</span>
        <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
          background: `${origin.color}22`, color: origin.color, textTransform: 'uppercase',
          letterSpacing: '0.05em' }}>{origin.label}</span>
        {rb.status === 'candidate' && (
          <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
            background: '#f59e0b22', color: '#f59e0b' }}>CANDIDATE</span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--color-muted)',
        marginBottom: rb.steps?.length ? 9 : 0 }}>
        {rb.match_score !== undefined && <span>score {rb.match_score.toFixed(2)}</span>}
        {rb.matched_on?.length ? <span>matched on {rb.matched_on.join(', ')}</span> : null}
        {rb.confirmedCount ? <span>confirmed {rb.confirmedCount}×</span> : null}
        {rb.steps?.length ? <span>{satisfied}/{rb.steps.length} steps satisfied</span> : null}
      </div>
      {rb.steps?.map((s) => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 7,
          padding: '3px 0', fontSize: 12 }}>
          {s.status === 'satisfied'
            ? <Check size={12} color="#10b981" style={{ marginTop: 3, flexShrink: 0 }} />
            : <Circle size={12} color="var(--color-muted)" style={{ marginTop: 3, flexShrink: 0 }} />}
          <span style={{ color: s.status === 'satisfied' ? 'var(--color-text)'
            : 'var(--color-muted)' }}>
            {s.title}
            {s.evidence_ids?.length ? (
              <span style={{ marginLeft: 6, fontSize: 10, fontFamily: 'var(--font-mono)',
                color: '#4f8ef7' }}>{s.evidence_ids.length} ev</span>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  )
}

function SectionTitle({ children, inline }: { children: React.ReactNode; inline?: boolean }) {
  return <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em',
    textTransform: 'uppercase', color: 'var(--color-muted)',
    marginBottom: inline ? 0 : 9 }}>{children}</div>
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 16, borderRadius: 8, background: 'var(--color-card)',
    border: '1px dashed var(--color-border)', fontSize: 12.5,
    color: 'var(--color-muted)', lineHeight: 1.6 }}>{children}</div>
}
