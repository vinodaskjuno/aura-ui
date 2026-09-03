import { safeUuid } from '../../utils/safeUuid'
import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Send, ClipboardList, Network, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { getAuditLog, type AuditLogEntry } from '../../api/ontologyUniverse'

interface ChatMessage {
  role: 'user' | 'assistant' | 'tool_start' | 'tool_end' | 'error'
  content: string
  toolName?: string
}

interface Props {
  onClose: () => void
  onHighlightNodes?: (nodeIds: string[]) => void
  onGraphRefresh?: () => void
}

type Tab = 'chat' | 'audit'

/**
 * Colour for an audit action, tolerant of a row that has none.
 *
 * This read `entry.action.startsWith(...)` inline, so a single row without an
 * `action` threw and the error boundary replaced the whole page — the tab showed
 * nothing at all rather than the other forty-nine entries. The backend no longer
 * returns such rows (`get_audit_log` filters on auditId), but a render path for a
 * list of remote records should not depend on every field being present.
 */
function actionTone(action?: string): { bg: string; fg: string } {
  const a = action ?? ''
  if (a.startsWith('CREATE')) return { bg: 'rgba(16,185,129,0.2)', fg: '#10b981' }
  if (a.startsWith('RETIRE')) return { bg: 'rgba(244,67,54,0.2)', fg: '#f44336' }
  if (!a) return { bg: 'rgba(148,163,184,0.18)', fg: '#94a3b8' }
  return { bg: 'rgba(74,158,255,0.2)', fg: '#4a9eff' }
}

export default function OntologyMaintainerChat({ onClose, onHighlightNodes, onGraphRefresh }: Props) {
  const { token } = useAuthStore()
  const [tab, setTab] = useState<Tab>('chat')
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hello! I can help you view and modify the Enterprise Ontology. Ask me to search nodes, update properties, add relationships, or retire outdated entities. All changes are audited.' }
  ])
  const [input, setInput] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [pendingChanges, setPendingChanges] = useState<Record<string, { changes: any[]; summary: string; confirmed: boolean }>>({})
  const [detailEntry, setDetailEntry] = useState<AuditLogEntry | null>(null)
  const [convoEntry, setConvoEntry] = useState<AuditLogEntry | null>(null)
  // Map of sessionId → messages saved when changes are confirmed
  const sessionConvoRef = useRef<Record<string, { role: string; content: string }[]>>({})
  const wsRef = useRef<WebSocket | null>(null)
  const sessionIdRef = useRef<string>(safeUuid())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // Stable refs for props that change every parent render — avoids reconnect storm
  const onGraphRefreshRef = useRef(onGraphRefresh)
  const onHighlightNodesRef = useRef(onHighlightNodes)
  useEffect(() => { onGraphRefreshRef.current = onGraphRefresh }, [onGraphRefresh])
  useEffect(() => { onHighlightNodesRef.current = onHighlightNodes }, [onHighlightNodes])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(scrollToBottom, [messages])

  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connectWs = useCallback(() => {
    if (!token) return
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/ontology/ws/chat?token=${token}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)
      setConnectError(null)
      if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null }
    }
    ws.onclose = (e) => {
      setIsConnected(false)
      setIsStreaming(false)
      // Hard errors — don't reconnect
      if (e.code === 4003) { setConnectError('Insufficient permissions — ontology_maintain role required'); return }
      if (e.code === 1008) { setConnectError('Authentication failed — please re-login'); return }
      // Abnormal close (1006 = server restart / proxy drop) — auto-reconnect after 3s
      if (e.code === 1006 || (e.code !== 1000 && e.code !== 1001)) {
        setConnectError(`Reconnecting… (closed ${e.code})`)
        reconnectTimerRef.current = setTimeout(() => { setConnectError(null); connectWs() }, 3000)
      }
    }

    ws.onmessage = (e) => {
      const frame = JSON.parse(e.data)
      if (frame.type === 'token') {
        // Bug 3 fix: agent sends frame.text, not frame.content
        const text = frame.text ?? frame.content ?? ''
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant' && !last.toolName) {
            return [...prev.slice(0, -1), { ...last, content: last.content + text }]
          }
          return [...prev, { role: 'assistant', content: text }]
        })
      } else if (frame.type === 'tool_start') {
        setMessages(prev => [...prev, { role: 'tool_start', content: frame.input ? JSON.stringify(frame.input, null, 2) : '', toolName: frame.tool }])
      } else if (frame.type === 'tool_end') {
        setMessages(prev => [...prev, { role: 'tool_end', content: typeof frame.result === 'string' ? frame.result : JSON.stringify(frame.result), toolName: frame.tool }])
      } else if (frame.type === 'pending_change') {
        setPendingChanges(prev => ({ ...prev, [frame.changeId]: { changes: frame.changes, summary: frame.summary, confirmed: false } }))
        setMessages(prev => [...prev, { role: 'pending_change' as any, content: frame.changeId, toolName: frame.summary }])
        setIsStreaming(false)
      } else if (frame.type === 'change_result') {
        const msg = frame.success
          ? `Changes applied successfully (${frame.results?.length ?? 0} operation${frame.results?.length !== 1 ? 's' : ''})`
          : `Changes cancelled: ${frame.message ?? 'rejected'}`
        setMessages(prev => [...prev, { role: frame.success ? 'tool_end' : 'error', content: msg, toolName: 'apply_changes' }])
        if (frame.success) onGraphRefreshRef.current?.()
      } else if (frame.type === 'graph_refresh_needed') {
        onGraphRefreshRef.current?.()
      } else if (frame.type === 'done') {
        setIsStreaming(false)
      } else if (frame.type === 'error') {
        setMessages(prev => [...prev, { role: 'error', content: frame.message ?? 'Unknown error' }])
        setIsStreaming(false)
      }
    }
  }, [token])

  useEffect(() => {
    connectWs()
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close(1000)
    }
  }, [connectWs])

  const loadAuditLog = async () => {
    setAuditLoading(true)
    try {
      const entries = await getAuditLog(0, 50)
      setAuditLog(entries)
    } catch {
      // silently ignore
    }
    setAuditLoading(false)
  }

  useEffect(() => {
    if (tab === 'audit') loadAuditLog()
  }, [tab])

  const sendMessage = () => {
    if (!input.trim() || !isConnected || isStreaming) return
    const text = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setIsStreaming(true)
    // Bug 2 fix: backend requires type:"chat" to process messages
    wsRef.current?.send(JSON.stringify({ type: 'chat', text, sessionId: sessionIdRef.current }))
  }

  const handleKey = (e: React.KeyboardEvent) => {
    e.stopPropagation() // prevent graph canvas from swallowing keystrokes (esp. spacebar)
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const roleColor = (role: ChatMessage['role']) => {
    switch (role) {
      case 'user': return '#4a9eff'
      case 'assistant': return '#e4e4f0'
      case 'tool_start': return '#ffc107'
      case 'tool_end': return '#10b981'
      case 'error': return '#f44336'
    }
  }

  return (
    <div style={{
      position: 'absolute',
      top: '52px',
      right: 0,
      bottom: 0,
      width: '420px',
      background: 'rgba(6, 13, 46, 0.98)',
      backdropFilter: 'blur(20px)',
      borderLeft: '1px solid rgba(255, 255, 255, 0.15)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 35,
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '6px',
          background: 'linear-gradient(135deg, #1a2060, #4a9eff)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', flexShrink: 0,
        }}>⬡</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#f0f0ff' }}>Ontology Maintainer</div>
          <div style={{ fontSize: '10px', color: isConnected ? '#10b981' : '#f44336' }}>
            {isConnected ? '● Connected' : connectError ? `○ ${connectError}` : '○ Disconnected'}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        {(['chat', 'audit'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '10px',
              background: tab === t ? 'rgba(74, 158, 255, 0.1)' : 'transparent',
              border: 'none',
              borderBottom: tab === t ? '2px solid #4a9eff' : '2px solid transparent',
              color: tab === t ? '#4a9eff' : '#6a7aaa',
              fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
              cursor: 'pointer', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
            }}
          >
            {t === 'audit' && <ClipboardList size={11} />}
            {t === 'chat' ? 'Chat' : 'Audit Log'}
          </button>
        ))}
      </div>

      {/* Chat panel */}
      {tab === 'chat' && (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.role === 'user' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{
                      maxWidth: '80%', padding: '10px 14px',
                      background: 'rgba(74, 158, 255, 0.2)',
                      border: '1px solid rgba(74, 158, 255, 0.3)',
                      borderRadius: '12px 12px 2px 12px',
                      color: '#e4e4f0', fontSize: '12px', lineHeight: 1.5,
                    }}>{msg.content}</div>
                  </div>
                )}
                {msg.role === 'assistant' && (
                  <div style={{ maxWidth: '90%', color: '#b0c0ee', fontSize: '12px', lineHeight: 1.6 }}>
                    {msg.content}
                  </div>
                )}
                {(msg.role === 'tool_start' || msg.role === 'tool_end') && (
                  <div style={{
                    padding: '8px 10px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${roleColor(msg.role)}33`,
                    borderRadius: '6px',
                    fontSize: '10px',
                  }}>
                    <div style={{ color: roleColor(msg.role), fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {msg.role === 'tool_start' ? '⚙ ' : '✓ '}{msg.toolName}
                    </div>
                    {msg.content && (
                      <pre style={{ color: '#8a9adb', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {msg.content.length > 200 ? msg.content.slice(0, 200) + '…' : msg.content}
                      </pre>
                    )}
                  </div>
                )}
                {(msg.role as string) === 'pending_change' && (() => {
                  const changeId = msg.content
                  const pending = pendingChanges[changeId]
                  if (!pending) return null
                  return (
                    <div style={{
                      padding: '12px',
                      background: 'rgba(245, 158, 11, 0.08)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: '10px',
                      fontSize: '12px',
                    }}>
                      <div style={{ color: '#f59e0b', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>⚠</span> Proposed Changes
                      </div>
                      <div style={{ color: '#b0c0ee', marginBottom: '10px', fontSize: '11px' }}>{pending.summary}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                        {pending.changes.map((c, ci) => (
                          <div key={ci} style={{ padding: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', fontSize: '11px' }}>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
                              <span style={{
                                padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 700,
                                background: c.changeType === 'RETIRE' ? 'rgba(244,67,54,0.2)' : c.changeType === 'CREATE' ? 'rgba(16,185,129,0.2)' : 'rgba(74,158,255,0.2)',
                                color: c.changeType === 'RETIRE' ? '#f44336' : c.changeType === 'CREATE' ? '#10b981' : '#4a9eff',
                              }}>{c.changeType}</span>
                              <span style={{ color: '#e4e4f0', fontWeight: 600 }}>{c.entityName}</span>
                              <span style={{ color: '#6a7aaa', fontSize: '10px' }}>({c.entityLabel})</span>
                            </div>
                            {c.before !== undefined && c.after !== undefined && c.changeType === 'UPDATE' && (
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <span style={{ color: '#f44336', fontSize: '10px' }}>
                                  {c.prop}: {JSON.stringify(c.before)}
                                </span>
                                <span style={{ color: '#6a7aaa' }}>→</span>
                                <span style={{ color: '#10b981', fontSize: '10px' }}>
                                  {JSON.stringify(c.after)}
                                </span>
                              </div>
                            )}
                            {(c.changeType === 'RELATIONSHIP_ADD' || c.changeType === 'RELATIONSHIP_ARCHIVE') && (
                              <div style={{ color: '#8a9adb', fontSize: '10px' }}>
                                {c.relType}: {c.entityName}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {!pending.confirmed && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => {
                              const entityIds = pending.changes.filter(c => c.entityId).map(c => c.entityId)
                              if (entityIds.length > 0) onHighlightNodesRef.current?.(entityIds)
                            }}
                            style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: '#b0c0ee', fontSize: '10px', cursor: 'pointer' }}
                          >
                            Highlight in graph
                          </button>
                          <button
                            onClick={() => {
                              wsRef.current?.send(JSON.stringify({ type: 'confirm_change', changeId, approved: true }))
                              setPendingChanges(prev => ({ ...prev, [changeId]: { ...prev[changeId], confirmed: true } }))
                              // Snapshot the conversation for this change so it can be shown in audit log
                              sessionConvoRef.current[changeId] = messages
                                .filter(m => m.role === 'user' || m.role === 'assistant')
                                .map(m => ({ role: m.role, content: m.content }))
                              setIsStreaming(true)
                            }}
                            style={{ padding: '6px 12px', background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '6px', color: '#10b981', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            ✓ Apply Changes
                          </button>
                          <button
                            onClick={() => {
                              wsRef.current?.send(JSON.stringify({ type: 'confirm_change', changeId, approved: false }))
                              setPendingChanges(prev => ({ ...prev, [changeId]: { ...prev[changeId], confirmed: true } }))
                            }}
                            style={{ padding: '6px 12px', background: 'rgba(244,67,54,0.15)', border: '1px solid rgba(244,67,54,0.3)', borderRadius: '6px', color: '#f44336', fontSize: '10px', cursor: 'pointer' }}
                          >
                            ✗ Cancel
                          </button>
                        </div>
                      )}
                      {pending.confirmed && (
                        <div style={{ color: '#6a7aaa', fontSize: '10px', fontStyle: 'italic' }}>Response submitted…</div>
                      )}
                    </div>
                  )
                })()}
                {msg.role === 'error' && (
                  <div style={{ color: '#f44336', fontSize: '12px', padding: '8px', background: 'rgba(244, 67, 54, 0.08)', borderRadius: '6px', border: '1px solid rgba(244,67,54,0.2)' }}>
                    {msg.content}
                  </div>
                )}
              </div>
            ))}
            {isStreaming && (
              <div style={{ display: 'flex', gap: '4px', padding: '4px 0' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: '50%', background: '#4a9eff',
                    animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div style={{ padding: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={isConnected ? 'Ask me to modify the ontology...' : 'Connecting...'}
                disabled={!isConnected || isStreaming}
                rows={2}
                style={{
                  flex: 1, padding: '10px 12px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  color: '#e4e4f0', fontSize: '12px',
                  outline: 'none', resize: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || !isConnected || isStreaming}
                style={{
                  padding: '10px',
                  background: 'rgba(74, 158, 255, 0.2)',
                  border: '1px solid rgba(74, 158, 255, 0.4)',
                  borderRadius: '8px',
                  color: '#4a9eff',
                  cursor: 'pointer',
                  opacity: (!input.trim() || !isConnected || isStreaming) ? 0.5 : 1,
                  transition: 'all 0.2s',
                }}
              >
                <Send size={14} />
              </button>
            </div>
            <div style={{ fontSize: '9px', color: '#4a7aaa', marginTop: '6px' }}>
              Enter to send · Shift+Enter for newline · All mutations are logged
            </div>
          </div>
        </>
      )}

      {/* Audit log panel */}
      {tab === 'audit' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {auditLoading ? (
            <div style={{ textAlign: 'center', color: '#6a7aaa', padding: '20px', fontSize: '12px' }}>Loading audit log...</div>
          ) : auditLog.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#6a7aaa', padding: '20px', fontSize: '12px' }}>No audit entries yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {auditLog.map((entry, i) => {
                let beforeObj: any = null, afterObj: any = null
                try { beforeObj = entry.before ? JSON.parse(entry.before) : null } catch { beforeObj = entry.before }
                try { afterObj  = entry.after  ? JSON.parse(entry.after)  : null } catch { afterObj  = entry.after  }
                const hasConvo = !!sessionConvoRef.current[entry.auditId]
                return (
                  <div key={i} style={{
                    padding: '10px 12px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px', fontSize: '11px',
                  }}>
                    {/* Header row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                      <span style={{
                        padding: '2px 7px', borderRadius: '4px', fontSize: '9px', fontWeight: 700,
                        background: actionTone(entry.action).bg,
                        color: actionTone(entry.action).fg,
                      }}>{entry.action || 'UNKNOWN'}</span>
                      <span style={{ flex: 1, color: '#4a7aaa', fontSize: '9px' }}>{new Date(entry.timestamp).toLocaleString()}</span>
                      {/* Highlight in graph icon */}
                      <button
                        title="Highlight in graph"
                        onClick={() => onHighlightNodesRef.current?.([entry.targetId])}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a9eff', padding: '2px 4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                      >
                        <Network size={12} />
                      </button>
                      {/* View details icon */}
                      <button
                        title="View before/after details"
                        onClick={() => setDetailEntry(detailEntry?.auditId === entry.auditId ? null : entry)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a78bfa', padding: '2px 4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                      >
                        {detailEntry?.auditId === entry.auditId ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                      {/* Conversation icon (only if snapshot exists) */}
                      {hasConvo && (
                        <button
                          title="View chat conversation"
                          onClick={() => setConvoEntry(entry)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981', padding: '2px 4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                        >
                          <MessageSquare size={12} />
                        </button>
                      )}
                    </div>

                    {/* Actor + target */}
                    <div style={{ color: '#8a9adb', fontSize: '10px', marginBottom: detailEntry?.auditId === entry.auditId ? 8 : 0 }}>
                      <span style={{ color: '#b0c0ee' }}>{entry.actor}</span>
                      {' → '}
                      <span style={{ color: '#e4e4f0', fontFamily: 'monospace', fontSize: '9px' }}>{entry.targetId}</span>
                    </div>

                    {/* Inline before/after summary */}
                    {(entry.before || entry.after) && detailEntry?.auditId !== entry.auditId && (
                      <div style={{ marginTop: '5px', display: 'flex', gap: '6px' }}>
                        {entry.before && (
                          <div style={{ flex: 1, padding: '3px 6px', background: 'rgba(244,67,54,0.08)', borderRadius: '4px', color: '#f44336', fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ opacity: 0.7 }}>Before: </span>
                            {typeof beforeObj === 'object' ? JSON.stringify(beforeObj) : String(entry.before)}
                          </div>
                        )}
                        {entry.after && (
                          <div style={{ flex: 1, padding: '3px 6px', background: 'rgba(16,185,129,0.08)', borderRadius: '4px', color: '#10b981', fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ opacity: 0.7 }}>After: </span>
                            {typeof afterObj === 'object' ? JSON.stringify(afterObj) : String(entry.after)}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Expanded detail panel */}
                    {detailEntry?.auditId === entry.auditId && (
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {entry.before && (
                          <div>
                            <div style={{ fontSize: '9px', fontWeight: 700, color: '#f44336', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Before</div>
                            <pre style={{
                              margin: 0, padding: '6px 8px', borderRadius: 6, fontSize: '9px',
                              background: 'rgba(244,67,54,0.07)', color: '#fca5a5',
                              whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 120, overflowY: 'auto',
                            }}>
                              {typeof beforeObj === 'object' ? JSON.stringify(beforeObj, null, 2) : String(entry.before)}
                            </pre>
                          </div>
                        )}
                        {entry.after && (
                          <div>
                            <div style={{ fontSize: '9px', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>After</div>
                            <pre style={{
                              margin: 0, padding: '6px 8px', borderRadius: 6, fontSize: '9px',
                              background: 'rgba(16,185,129,0.07)', color: '#6ee7b7',
                              whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 120, overflowY: 'auto',
                            }}>
                              {typeof afterObj === 'object' ? JSON.stringify(afterObj, null, 2) : String(entry.after)}
                            </pre>
                          </div>
                        )}
                        <button
                          onClick={() => onHighlightNodesRef.current?.([entry.targetId])}
                          style={{
                            alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 5,
                            padding: '5px 10px', borderRadius: 6, fontSize: '10px', fontWeight: 600,
                            background: 'rgba(74,158,255,0.12)', border: '1px solid rgba(74,158,255,0.3)',
                            color: '#4a9eff', cursor: 'pointer',
                          }}
                        >
                          <Network size={11} /> Highlight in graph
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Conversation popup modal ─────────────────────────────────────────── */}
      {convoEntry && (() => {
        const convo = sessionConvoRef.current[convoEntry.auditId] ?? []
        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
            onClick={e => { if (e.target === e.currentTarget) setConvoEntry(null) }}
          >
            <div style={{
              width: 480, maxHeight: '70vh', borderRadius: 14,
              background: 'rgba(6,13,46,0.98)', border: '1px solid rgba(255,255,255,0.15)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f0ff' }}>Change Conversation</div>
                  <div style={{ fontSize: 10, color: '#6a7aaa', marginTop: 2 }}>
                    {convoEntry.action} · {new Date(convoEntry.timestamp).toLocaleString()}
                  </div>
                </div>
                <button onClick={() => setConvoEntry(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: 4 }}>
                  <X size={16} />
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {convo.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#6a7aaa', padding: 20, fontSize: 12 }}>No conversation recorded for this change.</div>
                ) : convo.map((m, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '80%', padding: '8px 12px', borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '2px 12px 12px 12px',
                      background: m.role === 'user' ? 'rgba(74,158,255,0.18)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${m.role === 'user' ? 'rgba(74,158,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      fontSize: 11, color: m.role === 'user' ? '#e4e4f0' : '#b0c0ee', lineHeight: 1.5,
                    }}>{m.content}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
