import { useEffect, useRef, useState } from 'react'
import { useEffect as useEffectPhrase } from 'react'
import { AlertTriangle, Check, MessageSquare, Send, X } from 'lucide-react'
import { wsOrigin } from '../../api/wsUrl'
import { useAuthStore } from '../../store/authStore'
import type { MigrationSession } from '../../api/migration'

/**
 * Adjust a migration by talking to it.
 *
 * The chat proposes; the mapping table is the state. Nothing takes effect until it
 * is accepted here, and every accepted change is stamped `chat` so the strategy can
 * still say where a choice came from.
 *
 * A proposal renders as a diff rather than prose, because "we'll use Vault" and
 * "Secrets: AWS Secrets Manager → HashiCorp Vault" are not equally checkable — and
 * the user is being asked to check it.
 */

// Each variant carries a SINGLE literal role. Collapsing 'you' and 'aura' into one
// member with `role: 'you' | 'aura'` reads more tidily but defeats discriminated-union
// narrowing — TypeScript then cannot exclude that member from the else branch, and
// every field access on the proposal variant errors.
type Msg =
  | { role: 'you'; text: string }
  | { role: 'aura'; text: string }
  | { role: 'note'; text: string }
  | {
      role: 'proposal'
      changeId: string
      changes: Change[]
      destructive: boolean
      decided?: 'applied' | 'rejected'
      accepted?: number
    }

interface Change {
  kind: 'mapping' | 'shape' | 'verdict' | 'target'
  label: string
  from: string
  to: string
  reason: string
  destructive: boolean
  warning?: string
}

const input: React.CSSProperties = {
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  borderRadius: 7, padding: '8px 10px', color: 'var(--color-text)', fontSize: 12.5,
}

export default function MigrationChat({ session, onSession }: {
  session: MigrationSession
  onSession: (s: MigrationSession) => void
}) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [connected, setConnected] = useState(false)
  const [thinking, setThinking] = useState(false)
  // Which changes are ticked, per proposal. Defaults to all — the common case is
  // accepting what was suggested, not curating it.
  const [selection, setSelection] = useState<Record<string, Set<number>>>({})

  const ws = useRef<WebSocket | null>(null)
  const scroller = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const token = useAuthStore.getState().token
    const url = `${wsOrigin()}/api/migration/ws/${encodeURIComponent(session.sessionId)}`
      + `?projectId=${encodeURIComponent(session.projectId)}`
      + `&token=${encodeURIComponent(token || '')}`
    const socket = new WebSocket(url)
    ws.current = socket

    socket.onopen = () => setConnected(true)
    socket.onclose = () => setConnected(false)
    socket.onerror = () => setConnected(false)

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      switch (msg.type) {
        case 'connected':
          break
        case 'token':
          setMessages(m => [...m, { role: 'aura', text: msg.text }])
          break
        case 'note':
          setMessages(m => [...m, { role: 'note', text: msg.text }])
          break
        case 'proposal':
          setSelection(s => ({
            ...s,
            [msg.changeId]: new Set(msg.changes.map((_: Change, i: number) => i)),
          }))
          setMessages(m => [...m, {
            role: 'proposal', changeId: msg.changeId, changes: msg.changes,
            destructive: !!msg.destructive,
          }])
          break
        case 'applied':
          setMessages(m => m.map(x =>
            x.role === 'proposal' && x.changeId === msg.changeId
              ? { ...x, decided: msg.applied ? 'applied' : 'rejected', accepted: msg.applied }
              : x))
          if (msg.session) onSession(msg.session)
          setThinking(false)
          break
        case 'error':
          setMessages(m => [...m, { role: 'note', text: msg.message }])
          setThinking(false)
          break
        case 'done':
          setThinking(false)
          break
      }
    }

    return () => socket.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.sessionId, session.projectId])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [messages])

  const send = () => {
    const body = text.trim()
    if (!body || !ws.current || ws.current.readyState !== WebSocket.OPEN) return
    setMessages(m => [...m, { role: 'you', text: body }])
    ws.current.send(JSON.stringify({ type: 'chat', text: body }))
    setText('')
    setThinking(true)
  }

  const decide = (changeId: string, approved: boolean) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return
    const picked = [...(selection[changeId] ?? new Set<number>())].sort((a, b) => a - b)
    ws.current.send(JSON.stringify({
      type: 'confirm', changeId, approved, accept: approved ? picked : [],
    }))
    setThinking(true)
  }

  const toggle = (changeId: string, index: number) =>
    setSelection(s => {
      const next = new Set(s[changeId] ?? [])
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return { ...s, [changeId]: next }
    })

  return (
    <div className="ov-card" style={{ padding: 0, display: 'flex', flexDirection: 'column',
      height: 420, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px',
        borderBottom: '1px solid var(--color-border)' }}>
        <MessageSquare size={13} style={{ color: 'var(--color-primary)' }} />
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 800 }}>
          Adjust by chat
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10.5, color: connected ? 'var(--color-success)' : 'var(--color-muted)' }}>
          {connected ? '● connected' : '○ offline'}
        </span>
      </div>

      {/* Transcript */}
      <div ref={scroller} style={{ flex: 1, overflowY: 'auto', padding: 14,
        display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.6 }}>
            Tell Aura what to change. It proposes; nothing is applied until you accept.
            <div style={{ marginTop: 8, fontSize: 12 }}>
              <em>“we use Vault for secrets, not AWS Secrets Manager”</em><br />
              <em>“don't port the OCR bot, we're replacing it with Textract”</em><br />
              <em>“one consolidated DAG rather than one per process”</em>
            </div>
          </div>
        )}

        {messages.map((m, i) => {
          if (m.role === 'you' || m.role === 'aura') {
            const mine = m.role === 'you'
            return (
              <div key={i} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '86%' }}>
                <div style={{
                  fontSize: 12.5, lineHeight: 1.55, padding: '8px 11px', borderRadius: 9,
                  background: mine ? 'var(--color-primary)' : 'var(--color-card)',
                  color: mine ? '#fff' : 'var(--color-text)',
                  border: mine ? 'none' : '1px solid var(--color-border)',
                }}>{m.text}</div>
              </div>
            )
          }

          if (m.role === 'note') {
            return (
              <div key={i} style={{ fontSize: 11.5, color: 'var(--color-warning)',
                display: 'flex', gap: 6, lineHeight: 1.5 }}>
                <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                {m.text}
              </div>
            )
          }

          // A proposal, as a diff the user checks.
          return (
            <div key={i} style={{
              border: `1px solid ${m.destructive ? 'var(--color-warning)' : 'var(--color-border)'}`,
              borderRadius: 9, padding: 11, background: 'var(--color-card)',
            }}>
              {m.destructive && (
                <div style={{ display: 'flex', gap: 6, fontSize: 11.5,
                  color: 'var(--color-warning)', marginBottom: 9, lineHeight: 1.5 }}>
                  <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                  {m.changes.find(c => c.warning)?.warning
                    ?? 'This discards the current strategy.'}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {m.changes.map((c, idx) => (
                  <label key={idx} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    fontSize: 12, cursor: m.decided ? 'default' : 'pointer',
                    opacity: m.decided ? 0.65 : 1,
                  }}>
                    <input
                      type="checkbox"
                      disabled={!!m.decided}
                      checked={selection[m.changeId]?.has(idx) ?? false}
                      onChange={() => toggle(m.changeId, idx)}
                      style={{ marginTop: 2 }}
                    />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ color: 'var(--color-subtext)' }}>{c.label}</span>
                      {'  '}
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                        <span style={{ color: 'var(--color-danger)',
                          textDecoration: 'line-through' }}>{c.from}</span>
                        <span style={{ color: 'var(--color-muted)' }}> → </span>
                        <span style={{ color: 'var(--color-success)' }}>{c.to}</span>
                      </span>
                      {c.reason && (
                        <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>
                          {c.reason}
                        </div>
                      )}
                    </span>
                  </label>
                ))}
              </div>

              {m.decided ? (
                <div style={{ fontSize: 11.5, marginTop: 9,
                  color: m.decided === 'applied' ? 'var(--color-success)' : 'var(--color-muted)' }}>
                  {m.decided === 'applied'
                    ? `Applied ${m.accepted} change${m.accepted === 1 ? '' : 's'}.`
                    : 'Rejected.'}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 7, marginTop: 11 }}>
                  <button
                    onClick={() => decide(m.changeId, true)}
                    disabled={(selection[m.changeId]?.size ?? 0) === 0}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '5px 11px', borderRadius: 6, border: 'none',
                      fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                      background: 'var(--color-primary)', color: '#fff',
                    }}
                  >
                    <Check size={12} />
                    Apply {selection[m.changeId]?.size ?? 0}
                  </button>
                  <button
                    onClick={() => decide(m.changeId, false)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '5px 11px', borderRadius: 6, fontSize: 11.5,
                      fontWeight: 600, cursor: 'pointer',
                      background: 'var(--color-surface)', color: 'var(--color-text)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <X size={12} /> Reject
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {thinking && <ChatThinking />}
      </div>

      {/* Composer */}
      <div style={{ display: 'flex', gap: 7, padding: 11,
        borderTop: '1px solid var(--color-border)' }}>
        <input
          value={text}
          placeholder={connected ? 'Tell Aura what to change…' : 'Reconnecting…'}
          disabled={!connected}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          style={{ ...input, flex: 1 }}
        />
        <button
          onClick={send}
          disabled={!connected || !text.trim()}
          style={{
            display: 'flex', alignItems: 'center', padding: '0 12px', borderRadius: 7,
            border: 'none', cursor: 'pointer', background: 'var(--color-primary)',
            color: '#fff', opacity: !connected || !text.trim() ? 0.5 : 1,
          }}
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  )
}


/**
 * The chat's own wait. Compact, because it sits inside a transcript rather than
 * replacing the panel — but it still has to move, and it still has to change, or a
 * slow reply is indistinguishable from a dropped connection.
 */
function ChatThinking() {
  const phrases = [
    'reading the current mapping…',
    'working out what you are asking for…',
    'checking it against the strategy…',
    'drafting a change…',
  ]
  const [i, setI] = useState(0)
  useEffectPhrase(() => {
    const t = setInterval(() => setI(x => (x < phrases.length - 1 ? x + 1 : x)), 2600)
    return () => clearInterval(t)
  }, [phrases.length])

  return (
    <div role="status" aria-live="polite" style={{
      display: 'flex', gap: 8, alignItems: 'center',
      fontSize: 11.5, color: 'var(--color-muted)',
    }}>
      <span style={{ display: 'inline-flex', gap: 3 }}>
        <span className="typing-dot" style={{ width: 5, height: 5 }} />
        <span className="typing-dot" style={{ width: 5, height: 5 }} />
        <span className="typing-dot" style={{ width: 5, height: 5 }} />
      </span>
      <span key={i} style={{ animation: 'fade-in .4s ease' }}>{phrases[i]}</span>
    </div>
  )
}
