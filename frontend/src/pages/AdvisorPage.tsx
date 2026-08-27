import { useEffect, useRef, useState, useCallback } from 'react'
import { Send, ChevronDown, ChevronUp, Bot, User } from 'lucide-react'
import { getStats } from '../api/graph'
import { useAuthStore } from '../store/authStore'
import { Spinner } from '../components/ui/Spinner'

// Generate a simple UUID
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

interface ToolCallData {
  tool: string
  input: Record<string, unknown>
  output?: unknown
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCallData[]
  streaming?: boolean
}

interface Stats {
  by_domain: { infra: number; enterprise: number; data: number }
  total_triples: number
}

function ToolCallCard({ tc }: { tc: ToolCallData }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="rounded-lg mt-2 text-xs overflow-hidden"
      style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full px-3 py-2"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-primary)',
        }}
      >
        <span className="font-mono font-medium">Tool: {tc.tool}</span>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {expanded && (
        <div
          className="px-3 pb-3 flex flex-col gap-2"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <div>
            <p className="text-xs mb-1" style={{ color: 'var(--color-subtext)' }}>Input</p>
            <pre
              className="text-xs p-2 rounded overflow-x-auto"
              style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}
            >
              {JSON.stringify(tc.input, null, 2)}
            </pre>
          </div>
          {tc.output !== undefined && (
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--color-subtext)' }}>Output</p>
              <pre
                className="text-xs p-2 rounded overflow-x-auto"
                style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}
              >
                {typeof tc.output === 'string' ? tc.output : JSON.stringify(tc.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StreamingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="rounded-full"
          style={{
            width: 6,
            height: 6,
            background: 'var(--color-subtext)',
            display: 'inline-block',
            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </span>
  )
}

export default function AdvisorPage() {
  const token = useAuthStore((s) => s.token)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: uuid(),
      role: 'assistant',
      content: 'Hello! I am your Aura AI Advisor. Ask me anything about your knowledge graph — entities, relationships, or ontology structure.',
    },
  ])
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const sessionId = useRef(uuid())
  const bottomRef = useRef<HTMLDivElement>(null)
  const streamingMsgId = useRef<string | null>(null)

  // Load stats for context panel
  useEffect(() => {
    getStats().then((res) => setStats(res.data)).catch(() => {})
  }, [])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // WebSocket connection — uses mounted flag to survive React 18 Strict Mode double-invoke
  const connect = useCallback((mounted: { current: boolean }) => {
    if (wsRef.current) return
    setConnecting(true)
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const wsUrl = `${proto}://${window.location.host}/ws/advisor?token=${token}&session_id=${sessionId.current}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      if (!mounted.current) { ws.close(); return }
      setConnected(true)
      setConnecting(false)
    }

    ws.onmessage = (event) => {
      if (!mounted.current) return
      try {
        const data = JSON.parse(event.data)

        if (data.type === 'token') {
          const chunk: string = data.content ?? ''
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (last && last.id === streamingMsgId.current) {
              return [...prev.slice(0, -1), { ...last, content: last.content + chunk, streaming: true }]
            }
            const newMsg: Message = { id: streamingMsgId.current ?? uuid(), role: 'assistant', content: chunk, streaming: true }
            streamingMsgId.current = newMsg.id
            return [...prev, newMsg]
          })
        } else if (data.type === 'tool_call') {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (last && last.id === streamingMsgId.current) {
              const tc: ToolCallData = { tool: data.name ?? data.tool, input: data.input ?? {} }
              return [...prev.slice(0, -1), { ...last, toolCalls: [...(last.toolCalls ?? []), tc] }]
            }
            return prev
          })
        } else if (data.type === 'tool_result') {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (last && last.id === streamingMsgId.current && last.toolCalls) {
              const updatedTcs = last.toolCalls.map((tc, i) =>
                i === last.toolCalls!.length - 1 ? { ...tc, output: data.output } : tc
              )
              return [...prev.slice(0, -1), { ...last, toolCalls: updatedTcs }]
            }
            return prev
          })
        } else if (data.type === 'done') {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (last && last.id === streamingMsgId.current) {
              return [...prev.slice(0, -1), { ...last, streaming: false }]
            }
            return prev
          })
          streamingMsgId.current = null
        } else if (data.type === 'error') {
          setMessages((prev) => [...prev, {
            id: uuid(), role: 'assistant',
            content: `Error: ${data.message ?? 'Something went wrong'}`,
          }])
          streamingMsgId.current = null
        }
      } catch { /* ignore parse errors */ }
    }

    ws.onclose = () => {
      if (!mounted.current) return
      setConnected(false)
      setConnecting(false)
      wsRef.current = null
    }

    ws.onerror = () => {
      if (!mounted.current) return
      setConnected(false)
      setConnecting(false)
      wsRef.current = null
    }
  }, [token])

  useEffect(() => {
    const mounted = { current: true }
    connect(mounted)
    return () => {
      mounted.current = false
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connect])

  const sendMessage = () => {
    const text = input.trim()
    if (!text) return
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      connect({ current: true })
      return
    }

    const userMsg: Message = { id: uuid(), role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setInput('')

    // Prepare streaming message slot
    const assistantId = uuid()
    streamingMsgId.current = assistantId
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', streaming: true }
    setMessages((prev) => [...prev, assistantMsg])

    wsRef.current.send(JSON.stringify({ type: 'message', content: text, session_id: sessionId.current }))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex h-full gap-4" style={{ height: 'calc(100vh - 56px - 48px)' }}>
      {/* Chat Area */}
      <div
        className="flex flex-col flex-1 min-w-0 rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--color-border)', background: 'var(--color-card)' }}
      >
        {/* Status Bar */}
        <div
          className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <span
            className="rounded-full"
            style={{
              width: 8,
              height: 8,
              background: connected ? 'var(--color-success)' : connecting ? 'var(--color-warning)' : 'var(--color-danger)',
              display: 'inline-block',
            }}
          />
          <span className="text-xs" style={{ color: 'var(--color-subtext)' }}>
            {connected ? 'Connected' : connecting ? 'Connecting…' : 'Disconnected'}
          </span>
          {!connected && !connecting && (
            <button
              onClick={() => connect({ current: true })}
              className="ml-auto text-xs px-2 py-0.5 rounded"
              style={{
                background: 'var(--color-primary)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Reconnect
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div
                className="flex-shrink-0 rounded-full flex items-center justify-center"
                style={{
                  width: 32,
                  height: 32,
                  background: msg.role === 'user' ? 'var(--color-primary)' : 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {msg.role === 'user' ? (
                  <User size={14} color="#fff" />
                ) : (
                  <Bot size={14} style={{ color: 'var(--color-primary)' }} />
                )}
              </div>

              {/* Bubble */}
              <div className={`max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                <div
                  className="rounded-xl px-4 py-2.5 text-sm leading-relaxed"
                  style={{
                    background: msg.role === 'user' ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: msg.role === 'user' ? '#fff' : 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content || (msg.streaming ? null : '…')}
                  {msg.streaming && !msg.content && <StreamingDots />}
                  {msg.streaming && msg.content && (
                    <span className="ml-1 inline-flex"><StreamingDots /></span>
                  )}
                </div>

                {/* Tool Calls */}
                {(msg.toolCalls ?? []).map((tc, i) => (
                  <div key={i} className="w-full mt-1">
                    <ToolCallCard tc={tc} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input Bar */}
        <div
          className="flex items-end gap-2 p-4 flex-shrink-0"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your ontology… (Enter to send, Shift+Enter for newline)"
            rows={2}
            className="flex-1 resize-none text-sm rounded-xl px-4 py-2.5"
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || !connected}
            className="rounded-xl p-2.5 flex items-center justify-center transition-all"
            style={{
              background: 'var(--color-primary)',
              border: 'none',
              cursor: !input.trim() || !connected ? 'not-allowed' : 'pointer',
              opacity: !input.trim() || !connected ? 0.5 : 1,
              color: '#fff',
            }}
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* Context Panel */}
      <div
        className="w-64 flex-shrink-0 rounded-xl flex flex-col overflow-hidden"
        style={{ border: '1px solid var(--color-border)', background: 'var(--color-card)' }}
      >
        <div
          className="px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            Ontology Context
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {stats ? (
            <>
              <div
                className="rounded-xl p-3 flex flex-col gap-2"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
              >
                <p className="text-xs font-medium" style={{ color: 'var(--color-subtext)' }}>
                  Domain Summary
                </p>
                {[
                  { label: 'Infrastructure', count: stats.by_domain?.infra ?? 0, color: '#4f8ef7' },
                  { label: 'Enterprise', count: stats.by_domain?.enterprise ?? 0, color: '#7c3aed' },
                  { label: 'Data', count: stats.by_domain?.data ?? 0, color: '#10b981' },
                ].map((d) => (
                  <div key={d.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded-full"
                        style={{ width: 8, height: 8, background: d.color, display: 'inline-block' }}
                      />
                      <span className="text-xs" style={{ color: 'var(--color-text)' }}>{d.label}</span>
                    </div>
                    <span className="text-xs font-semibold" style={{ color: d.color }}>
                      {d.count.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              <div
                className="rounded-xl p-3"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
              >
                <p className="text-xs" style={{ color: 'var(--color-subtext)' }}>Total Triples</p>
                <p className="text-xl font-bold mt-1" style={{ color: 'var(--color-text)' }}>
                  {(stats?.total_triples ?? 0).toLocaleString()}
                </p>
              </div>
            </>
          ) : (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          )}

          <div
            className="rounded-xl p-3"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-subtext)' }}>
              Session
            </p>
            <p className="text-xs font-mono break-all" style={{ color: 'var(--color-subtext)' }}>
              {sessionId.current}
            </p>
          </div>

          <div
            className="rounded-xl p-3"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-subtext)' }}>
              Available Tools
            </p>
            {['search_ontology', 'get_entity', 'sparql_query', 'explain_relation', 'find_path'].map((tool) => (
              <div key={tool} className="flex items-center gap-1.5 mb-1">
                <span
                  className="rounded-full flex-shrink-0"
                  style={{ width: 5, height: 5, background: 'var(--color-primary)', display: 'inline-block' }}
                />
                <span className="text-xs font-mono" style={{ color: 'var(--color-text)' }}>{tool}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
