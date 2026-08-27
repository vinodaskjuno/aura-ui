import { safeUuid } from '../../utils/safeUuid'
import React, {
  useState, useEffect, useRef, useCallback,
  useImperativeHandle, forwardRef,
} from 'react'
import { Send, Loader2, Bot, User } from 'lucide-react'
import type { OntologyNode, OntologyLink } from '../../api/ontologyUniverse'
import { useGraphTheme } from '../../hooks/useGraphTheme'

const DEFAULT_MODEL = 'us.anthropic.claude-sonnet-4-20250514-v1:0'

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

export interface WorkspaceChatHandle {
  injectMessage: (text: string) => void
}

interface WorkspaceChatPanelProps {
  selectedNode: OntologyNode | null
  contextNodes: OntologyNode[]
  contextLinks: OntologyLink[]
}

// ── Inline markdown from DevChatbotPage ─────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const re = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|`(.+?)`|\*(.+?)\*)/g
  let last = 0; let m: RegExpExecArray | null; let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[2]) parts.push(<strong key={i++}><em>{m[2]}</em></strong>)
    else if (m[3]) parts.push(<strong key={i++} style={{ color: 'var(--color-text)', fontWeight: 700 }}>{m[3]}</strong>)
    else if (m[4]) parts.push(<code key={i++} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, padding: '1px 5px', fontFamily: 'monospace', fontSize: 12, color: '#a5f3fc' }}>{m[4]}</code>)
    else if (m[5]) parts.push(<em key={i++}>{m[5]}</em>)
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function renderMarkdown(content: string): React.ReactNode {
  const lines = content.split('\n')
  const nodes: React.ReactNode[] = []
  let listItems: React.ReactNode[] = []
  let key = 0

  const flushList = () => {
    if (listItems.length) {
      nodes.push(
        <ul key={key++} style={{ margin: '6px 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {listItems}
        </ul>
      )
      listItems = []
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    const h3 = line.match(/^###\s+(.+)/)
    const h2 = line.match(/^##\s+(.+)/)
    const h1 = line.match(/^#\s+(.+)/)
    if (h3 || h2 || h1) {
      flushList()
      const txt = (h3?.[1] ?? h2?.[1] ?? h1?.[1])!
      const size = h3 ? '12px' : h2 ? '13px' : '15px'
      nodes.push(<div key={key++} style={{ fontSize: size, fontWeight: 700, color: '#a5b4fc', marginTop: 14, marginBottom: 4 }}>{renderInline(txt)}</div>)
      continue
    }
    if (/^---+$/.test(line)) {
      flushList()
      nodes.push(<hr key={key++} style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '10px 0' }} />)
      continue
    }
    const li = line.match(/^[-*]\s+(.+)/)
    if (li) { listItems.push(<li key={key++} style={{ color: 'var(--color-text)', lineHeight: 1.6 }}>{renderInline(li[1])}</li>); continue }
    const nl = line.match(/^\d+\.\s+(.+)/)
    if (nl) { listItems.push(<li key={key++} style={{ color: 'var(--color-text)', lineHeight: 1.6 }}>{renderInline(nl[1])}</li>); continue }
    flushList()
    if (!line.trim()) { nodes.push(<div key={key++} style={{ height: 6 }} />); continue }
    nodes.push(<div key={key++} style={{ lineHeight: 1.7, color: 'var(--color-text)' }}>{renderInline(line)}</div>)
  }
  flushList()
  return <>{nodes}</>
}

// ── Panel ────────────────────────────────────────────────────────────────────

export const WorkspaceChatPanel = forwardRef<WorkspaceChatHandle, WorkspaceChatPanelProps>(
  function WorkspaceChatPanel({ selectedNode, contextNodes, contextLinks }, ref) {
    const t = useGraphTheme()
    const [messages, setMessages] = useState<ChatMsg[]>([{
      role: 'assistant',
      content: 'Hi! Click a node in the graph, then ask me anything about it or the overall architecture.',
    }])
    const [input, setInput] = useState('')
    const [isConnected, setIsConnected] = useState(false)
    const [isStreaming, setIsStreaming] = useState(false)
    const wsRef = useRef<WebSocket | null>(null)
    const sessionIdRef = useRef(`workspace-${safeUuid()}`)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const selectedNodeRef = useRef(selectedNode)
    const contextNodesRef = useRef(contextNodes)
    const contextLinksRef = useRef(contextLinks)

    // Keep refs in sync so the WS send callback is always current
    useEffect(() => { selectedNodeRef.current = selectedNode }, [selectedNode])
    useEffect(() => { contextNodesRef.current = contextNodes }, [contextNodes])
    useEffect(() => { contextLinksRef.current = contextLinks }, [contextLinks])

    useImperativeHandle(ref, () => ({
      injectMessage: (text: string) => { doSend(text) },
    }))

    useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const doSend = useCallback((text: string) => {
      if (!text.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || isStreaming) return
      setMessages(prev => [...prev, { role: 'user', content: text }])
      const payload: Record<string, unknown> = {
        type: 'chat',
        sessionId: sessionIdRef.current,
        model: DEFAULT_MODEL,
        text: text.trim(),
        projectName: '',
        projectId: '',
      }
      if (selectedNodeRef.current) {
        payload.context = {
          node: selectedNodeRef.current,
          nodes: contextNodesRef.current.slice(0, 50),
          links: contextLinksRef.current.slice(0, 100),
        }
      }
      wsRef.current.send(JSON.stringify(payload))
      setIsStreaming(true)
    }, [isStreaming])

    // Connect once on mount
    useEffect(() => {
      const token = localStorage.getItem('ov_token') ?? ''
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${proto}://${location.host}/ws/advisor?token=${token}`)
      wsRef.current = ws

      ws.onopen = () => setIsConnected(true)
      ws.onclose = () => setIsConnected(false)
      ws.onerror = () => setIsConnected(false)
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as Record<string, unknown>
          if (msg.type === 'token') {
            setMessages(prev => {
              const last = prev[prev.length - 1]
              if (last?.role === 'assistant') {
                return [...prev.slice(0, -1), { ...last, content: last.content + String(msg.content), isStreaming: true }]
              }
              return [...prev, { role: 'assistant', content: String(msg.content), isStreaming: true }]
            })
          } else if (msg.type === 'done') {
            setMessages(prev => {
              const last = prev[prev.length - 1]
              if (last?.role === 'assistant') return [...prev.slice(0, -1), { ...last, isStreaming: false }]
              return prev
            })
            setIsStreaming(false)
          } else if (msg.type === 'error') {
            setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${msg.message}` }])
            setIsStreaming(false)
          }
        } catch { /* ignore */ }
      }
      return () => ws.close()
    }, [])

    const handleSend = useCallback(() => {
      doSend(input)
      setInput('')
    }, [input, doSend])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
    }

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        background: 'var(--color-bg)',
        borderRight: `1px solid var(--color-border)`,
      }}>
        {/* Header */}
        <div style={{
          padding: '0 12px', borderBottom: `1px solid var(--color-border)`,
          display: 'flex', alignItems: 'center', gap: 8,
          flexShrink: 0, height: 36,
        }}>
          <Bot size={13} color="var(--color-primary)" />
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: t.sectionLabel,
          }}>Chat Panel</span>
          <span style={{
            marginLeft: 'auto', fontSize: 10,
            color: isConnected ? '#22c55e' : '#ef4444',
          }}>● {isConnected ? 'live' : 'offline'}</span>
          {selectedNode && (
            <span style={{
              fontSize: 10, color: t.mutedText,
              padding: '1px 6px', borderRadius: 4,
              background: t.panelCard, border: `1px solid ${t.panelCardBorder}`,
              maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              ctx: {selectedNode.label.slice(0, 16)}
            </span>
          )}
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '10px 12px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {messages.map((msg, i) => {
            const isUser = msg.role === 'user'
            return (
              <div key={i} style={{
                display: 'flex', gap: 8,
                flexDirection: isUser ? 'row-reverse' : 'row',
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  background: isUser
                    ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                    : 'linear-gradient(135deg, #0ea5e9, #2563eb)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isUser ? <User size={12} color="#fff" /> : <Bot size={12} color="#fff" />}
                </div>
                <div style={{
                  maxWidth: '78%', padding: '8px 12px', fontSize: 12,
                  background: isUser ? 'rgba(99,102,241,0.12)' : t.panelCard,
                  border: `1px solid ${isUser ? 'rgba(99,102,241,0.25)' : t.panelCardBorder}`,
                  borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                  wordBreak: 'break-word',
                }}>
                  {isUser
                    ? <span style={{ color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                    : renderMarkdown(msg.content)
                  }
                  {msg.isStreaming && (
                    <span style={{
                      display: 'inline-block', width: 7, height: 12,
                      background: '#a5b4fc', borderRadius: 2, marginLeft: 2,
                      animation: 'blink 1s step-end infinite', verticalAlign: 'text-bottom',
                    }} />
                  )}
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '8px 10px', borderTop: `1px solid var(--color-border)`,
          flexShrink: 0,
        }}>
          <div style={{
            display: 'flex', gap: 8, alignItems: 'flex-end',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 10, padding: '7px 10px',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={selectedNode
                ? `Ask about ${selectedNode.label}…`
                : 'Ask about the architecture…'}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                resize: 'none', fontSize: 12, color: 'var(--color-text)',
                lineHeight: 1.5, fontFamily: 'inherit',
                minHeight: 18, maxHeight: 80,
              }}
              onInput={e => {
                const el = e.target as HTMLTextAreaElement
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 80) + 'px'
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || !isConnected || isStreaming}
              style={{
                width: 28, height: 28, borderRadius: 7, border: 'none', flexShrink: 0,
                background: !input.trim() || !isConnected || isStreaming
                  ? 'var(--color-border)'
                  : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                cursor: !input.trim() || !isConnected || isStreaming ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
              }}
            >
              {isStreaming
                ? <Loader2 size={12} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
                : <Send size={12} color="#fff" />
              }
            </button>
          </div>
        </div>

        <style>{`
          @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
          @keyframes spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        `}</style>
      </div>
    )
  }
)
