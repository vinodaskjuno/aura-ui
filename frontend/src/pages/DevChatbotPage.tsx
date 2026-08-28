import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { applyChange, cloneRepo, discardChange } from '../api/gitOps'
import {
  Bot, X, Loader2, Send, RefreshCw, BarChart3, Shield, Server,
  Users, Layers, Clock, Trash2, MessageSquare, GitBranch, Plus, ChevronRight,
  ExternalLink, TrendingUp, DollarSign, Pencil, ArrowLeft,
  PanelLeftOpen, PanelLeftClose, SquarePen, User, Wrench, Check,
} from 'lucide-react'
import { searchNodes, getOntologyStats, type OntologyStats } from '../api/ontologyUniverse'
import { getChatSessions, createChatSession, deleteChatSession, getChatStats, type ChatSession } from '../api/chatSessions'
import { useOntologyStore } from '../store/ontologyStore'
import ProjectGraphModal from '../components/dev/ProjectGraphModal'
import ModelSelector, { getModelById, type ModelOption } from '../components/dev-chat/ModelSelector'
import ContextSummaryDialog from '../components/dev-chat/ContextSummaryDialog'
import TokenMetricsBadge from '../components/dev-chat/TokenMetricsBadge'
import ProjectsPanel, { type WizardResult } from '../components/dev-chat/ProjectsPanel'
import CreateProjectWizard, { type WizardInitialValues } from '../components/dev-chat/CreateProjectWizard'
import MetricsDashboard from '../components/dev-chat/MetricsDashboard'
import { getTokenMetrics } from '../api/metrics'
import { type Project, projectsApi } from '../api/projects'

// ── Types ─────────────────────────────────────────────────────────────────────
interface SearchResult {
  id: string
  type: string
  name: string
  externalId?: string
  source?: string
  status?: string
}

interface TokenInfo {
  input: number
  output: number
  cost: number
}

interface ToolEvent {
  name: string
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  /** Set when the tool staged a file change awaiting approval. */
  stagedPath?: string
  diff?: string
  applied?: 'applied' | 'discarded'
}

interface ChatMsg {
  role: 'user' | 'assistant' | 'tool'
  content: string
  isStreaming?: boolean
  tokens?: TokenInfo
  tool?: ToolEvent
}

type Phase = 'select' | 'chat'

// ── Metric card ───────────────────────────────────────────────────────────────
interface MetricDef { label: string; key: string; color: string; icon: React.ReactNode }
const METRIC_DEFS: MetricDef[] = [
  { label: 'Projects',      key: 'project',         color: '#f59e0b', icon: <GitBranch size={16}/> },
  { label: 'Services',      key: 'service',         color: '#10b981', icon: <Layers size={16}/> },
  { label: 'Infrastructure',key: 'infrastructure',  color: '#06b6d4', icon: <Server size={16}/> },
  { label: 'Security',      key: 'securityfinding', color: '#ef4444', icon: <Shield size={16}/> },
  { label: 'Teams',         key: 'team',            color: '#ec4899', icon: <Users size={16}/> },
  { label: 'Databases',     key: 'database',        color: '#8b5cf6', icon: <BarChart3 size={16}/> },
]

function MetricCard({ def, value, loading }: { def: MetricDef; value: number; loading: boolean }) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: `1px solid ${def.color}33`,
      borderRadius: '12px', padding: '16px',
      display: 'flex', flexDirection: 'column', gap: '8px',
      position: 'relative', overflow: 'hidden',
      transition: 'border-color 0.2s, transform 0.15s',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = def.color + '88'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = def.color + '33'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)' }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${def.color}, ${def.color}00)` }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: def.color, opacity: 0.9 }}>{def.icon}</span>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: def.color, boxShadow: `0 0 8px ${def.color}` }} />
      </div>
      <div>
        {loading ? (
          <div style={{ width: '32px', height: '24px', background: 'var(--color-border)', borderRadius: '4px', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ) : (
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1 }}>{value}</div>
        )}
        <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '4px', fontWeight: 500 }}>{def.label}</div>
      </div>
    </div>
  )
}

// ── Session list item ─────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime()
  if (d < 60_000) return 'just now'
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`
  return `${Math.floor(d / 86_400_000)}d ago`
}

// ── Source badge colors ───────────────────────────────────────────────────────
const SOURCE_COLORS: Record<string, string> = {
  git:             '#10b981',
  servicenow:      '#06b6d4',
  servicenow_cmdb: '#06b6d4',
  wiz:             '#ef4444',
  mock:            '#a78bfa',
  seed:            '#6366f1',
}

function SourceBadge({ source }: { source?: string }) {
  const s = (source ?? 'unknown').toLowerCase()
  const color = SOURCE_COLORS[s] ?? '#6b7280'
  return (
    <span style={{
      fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
      background: color + '22', color, border: `1px solid ${color}44`,
      textTransform: 'uppercase', letterSpacing: '0.5px',
    }}>{s}</span>
  )
}

// ── Project search dropdown ───────────────────────────────────────────────────
interface DropdownProps {
  query: string
  results: SearchResult[]
  isSearching: boolean
  onSelect: (r: SearchResult) => void
  onCreateNew: () => void
}

function OntologyDropdown({ query, results, isSearching, onSelect, onCreateNew }: DropdownProps) {
  if (query.length < 2) return null

  return (
    <div style={{
      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
      marginTop: '4px', borderRadius: '12px', overflow: 'hidden',
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    }}>
      {isSearching ? (
        <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-subtext)', fontSize: '13px' }}>
          <Loader2 size={14} className="animate-spin" /> Searching ontology…
        </div>
      ) : results.length > 0 ? (
        <>
          <div style={{ padding: '8px 12px 4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-muted)' }}>
            Found in Ontology Graph
          </div>
          {results.map(r => (
            <button
              key={r.id}
              onClick={() => onSelect(r)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer',
                textAlign: 'left', transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <div style={{
                width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0,
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 800, color: '#fff',
              }}>
                {r.name.slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.name}
                </div>
                {r.externalId && (
                  <div style={{ fontSize: '10px', color: 'var(--color-muted)', marginTop: '1px' }}>{r.externalId}</div>
                )}
              </div>
              <SourceBadge source={r.source} />
              <ChevronRight size={12} style={{ color: 'var(--color-muted)', flexShrink: 0 }} />
            </button>
          ))}
          <div style={{ height: '1px', background: 'var(--color-border)', margin: '0 12px' }} />
        </>
      ) : (
        <div style={{ padding: '12px', fontSize: '12px', color: 'var(--color-muted)' }}>
          No ontology found for "{query}"
        </div>
      )}

      {/* Create new option */}
      <button
        onClick={onCreateNew}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left', transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        <div style={{
          width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0,
          background: 'rgba(99,102,241,0.15)', border: '1px dashed #6366f1',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Plus size={14} style={{ color: '#6366f1' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#6366f1' }}>
            Create "{query}" as new project
          </div>
          <div style={{ fontSize: '10px', color: 'var(--color-muted)', marginTop: '1px' }}>Start fresh without ontology</div>
        </div>
      </button>
    </div>
  )
}

// ── Ontology context banner ───────────────────────────────────────────────────
interface BannerProps {
  projectName: string
  nodeCount: number
  linkCount: number
  onViewGraph: () => void
  onUseContext: () => void
  onSkip: () => void
}

function OntologyContextBanner({ projectName, nodeCount, linkCount, onViewGraph, onUseContext, onSkip }: BannerProps) {
  return (
    <div style={{
      borderRadius: '12px', padding: '16px 20px', marginBottom: '20px',
      background: 'linear-gradient(135deg, rgba(96,165,250,0.08), rgba(167,139,250,0.08))',
      border: '1px solid rgba(96,165,250,0.25)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
          background: 'linear-gradient(135deg, #312e81, #4f46e5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 12px rgba(96,165,250,0.3)',
          fontSize: '16px',
        }}>✦</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '4px' }}>
            Ontology found for "{projectName}"
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-subtext)', marginBottom: '14px' }}>
            This project has <strong style={{ color: '#60a5fa' }}>{nodeCount} nodes</strong> and{' '}
            <strong style={{ color: '#34d399' }}>{linkCount} links</strong> in the knowledge graph.
            Load it as context to get ontology-aware answers.
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={onViewGraph}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)',
                color: '#60a5fa', cursor: 'pointer',
              }}
            >
              <ExternalLink size={12} /> View Graph
            </button>
            <button
              onClick={onUseContext}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', border: 'none',
                color: '#fff', cursor: 'pointer',
              }}
            >
              ✦ Use as Context
            </button>
            <button
              onClick={onSkip}
              style={{
                padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                background: 'none', border: '1px solid var(--color-border)',
                color: 'var(--color-subtext)', cursor: 'pointer',
              }}
            >
              Skip
            </button>
          </div>
        </div>
        <button onClick={onSkip} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: '2px' }}>
          <X size={14} />
        </button>
      </div>
    </div>
  )
}

// ── Markdown renderer ─────────────────────────────────────────────────────────
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const re = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|`(.+?)`|\*(.+?)\*)/g
  let last = 0, m: RegExpExecArray | null, i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[2]) parts.push(<strong key={i++}><em>{m[2]}</em></strong>)
    else if (m[3]) parts.push(<strong key={i++} style={{ color: 'var(--color-text)', fontWeight: 700 }}>{m[3]}</strong>)
    else if (m[4]) parts.push(<code key={i++} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '4px', padding: '1px 5px', fontFamily: 'monospace', fontSize: '12px', color: '#a5f3fc' }}>{m[4]}</code>)
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
        <ul key={key++} style={{ margin: '6px 0 6px 0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
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
      const mt   = h3 ? '14px' : '18px'
      nodes.push(
        <div key={key++} style={{ fontSize: size, fontWeight: 700, color: '#a5b4fc', marginTop: mt, marginBottom: '4px', textTransform: h3 ? 'uppercase' : 'none', letterSpacing: h3 ? '0.5px' : 'normal' }}>
          {renderInline(txt)}
        </div>
      )
      continue
    }

    if (/^---+$/.test(line)) {
      flushList()
      nodes.push(<hr key={key++} style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '10px 0' }} />)
      continue
    }

    const li = line.match(/^[-*]\s+(.+)/)
    if (li) {
      listItems.push(<li key={key++} style={{ color: 'var(--color-text)', lineHeight: 1.6 }}>{renderInline(li[1])}</li>)
      continue
    }

    const nl = line.match(/^\d+\.\s+(.+)/)
    if (nl) {
      listItems.push(<li key={key++} style={{ color: 'var(--color-text)', lineHeight: 1.6 }}>{renderInline(nl[1])}</li>)
      continue
    }

    flushList()

    if (!line.trim()) {
      nodes.push(<div key={key++} style={{ height: '6px' }} />)
      continue
    }

    nodes.push(
      <div key={key++} style={{ lineHeight: 1.7, color: 'var(--color-text)' }}>
        {renderInline(line)}
      </div>
    )
  }

  flushList()
  return <>{nodes}</>
}

// ── Agent tool activity ───────────────────────────────────────────────────────
// The model's file reads and proposed edits, made visible. A staged write is shown
// as a diff with Apply / Discard — nothing reaches disk until the operator says so.
function ToolCard({ tool, projectId, onResolved }: {
  tool: ToolEvent; projectId: string; onResolved: (path: string, how: 'applied' | 'discarded') => void
}) {
  const [busy, setBusy] = useState<'applied' | 'discarded' | null>(null)
  const [error, setError] = useState('')
  const pending = !!tool.stagedPath && !tool.applied
  const err = tool.output?.error as string | undefined

  const act = async (how: 'applied' | 'discarded') => {
    if (!tool.stagedPath) return
    setBusy(how); setError('')
    try {
      if (how === 'applied') await applyChange(projectId, tool.stagedPath)
      else await discardChange(projectId, tool.stagedPath)
      onResolved(tool.stagedPath, how)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(null)
    }
  }

  const label = TOOL_LABELS[tool.name] ?? tool.name
  const subject = String(tool.input?.file_path ?? tool.input?.directory ?? '')

  return (
    <div style={{
      margin: '6px 0 6px 34px', borderRadius: 8, overflow: 'hidden',
      border: `1px solid ${pending ? '#f59e0b55' : 'var(--color-border)'}`,
      background: pending ? '#f59e0b0f' : 'var(--color-card)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px' }}>
        <Wrench size={12} color={err ? '#ef4444' : pending ? '#f59e0b' : 'var(--color-muted)'} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>{label}</span>
        {subject && (
          <code style={{ fontSize: 11, color: 'var(--color-muted)',
            fontFamily: 'var(--font-mono)' }}>{subject}</code>
        )}
        <div style={{ flex: 1 }} />
        {!tool.output && (
          <span style={{ fontSize: 10.5, color: 'var(--color-muted)' }}>running…</span>
        )}
        {tool.applied && (
          <span style={{ fontSize: 10.5, fontWeight: 700,
            color: tool.applied === 'applied' ? '#10b981' : 'var(--color-muted)' }}>
            {tool.applied === 'applied' ? 'APPLIED' : 'DISCARDED'}
          </span>
        )}
        {pending && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 4,
            background: '#f59e0b22', color: '#f59e0b' }}>AWAITING APPROVAL</span>
        )}
      </div>

      {err && (
        <div style={{ padding: '0 11px 9px', fontSize: 11.5, color: '#ef4444' }}>{err}</div>
      )}

      {tool.diff && (
        <pre style={{ margin: 0, padding: '9px 11px', fontSize: 11, lineHeight: 1.55,
          overflowX: 'auto', background: 'var(--color-surface)',
          borderTop: '1px solid var(--color-border)', fontFamily: 'var(--font-mono)' }}>
          {tool.diff.split('\n').map((line, i) => (
            <div key={i} style={{
              color: line.startsWith('+') && !line.startsWith('+++') ? '#10b981'
                : line.startsWith('-') && !line.startsWith('---') ? '#ef4444'
                : line.startsWith('@@') ? '#8b5cf6' : 'var(--color-muted)',
            }}>{line || ' '}</div>
          ))}
        </pre>
      )}

      {pending && (
        <div style={{ display: 'flex', gap: 7, padding: '9px 11px',
          borderTop: '1px solid var(--color-border)' }}>
          <button onClick={() => act('applied')} disabled={busy !== null}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5,
              fontWeight: 600, padding: '5px 12px', borderRadius: 6, border: 'none',
              cursor: busy ? 'wait' : 'pointer', background: '#10b981', color: '#fff' }}>
            <Check size={12} /> Apply
          </button>
          <button onClick={() => act('discarded')} disabled={busy !== null}
            style={{ fontSize: 11.5, fontWeight: 600, padding: '5px 12px', borderRadius: 6,
              cursor: busy ? 'wait' : 'pointer', background: 'transparent',
              color: 'var(--color-muted)', border: '1px solid var(--color-border)' }}>
            Discard
          </button>
          {error && <span style={{ fontSize: 11, color: '#ef4444', alignSelf: 'center' }}>{error}</span>}
        </div>
      )}
    </div>
  )
}

const TOOL_LABELS: Record<string, string> = {
  list_files: 'Listed files',
  read_file: 'Read file',
  write_file: 'Proposed a change',
  get_diff: 'Read the working diff',
}

// ── Chat message renderer ─────────────────────────────────────────────────────
function ChatMessage({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{
      display: 'flex', gap: '10px', padding: '4px 0',
      flexDirection: isUser ? 'row-reverse' : 'row',
    }}>
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
        background: isUser
          ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
          : 'linear-gradient(135deg, #0ea5e9, #2563eb)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff',
        boxShadow: isUser
          ? '0 2px 8px rgba(99,102,241,0.45)'
          : '0 2px 8px rgba(14,165,233,0.45)',
      }}>
        {isUser ? <User size={15} /> : <Bot size={15} />}
      </div>
      <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
        <div style={{
          background: isUser ? 'rgba(99,102,241,0.12)' : 'rgba(15,23,42,0.6)',
          border: `1px solid ${isUser ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.07)'}`,
          borderRadius: isUser ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
          padding: '12px 16px',
          fontSize: '13px', wordBreak: 'break-word',
          backdropFilter: isUser ? 'none' : 'blur(4px)',
        }}>
          {isUser
            ? <span style={{ color: 'var(--color-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{msg.content}</span>
            : renderMarkdown(msg.content)
          }
          {msg.isStreaming && (
            <span style={{ display: 'inline-block', width: '8px', height: '14px', background: '#a5b4fc', borderRadius: '2px', marginLeft: '2px', animation: 'blink 1s step-end infinite', verticalAlign: 'text-bottom' }} />
          )}
        </div>
        {!isUser && msg.tokens && (
          <TokenMetricsBadge
            inputTokens={msg.tokens.input}
            outputTokens={msg.tokens.output}
            cost={msg.tokens.cost}
          />
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DevChatbotPage() {
  const navigate = useNavigate()
  const { nodes: ontologyNodes, links: ontologyLinks, loadProjectSubgraph } = useOntologyStore()

  // Phase
  const [phase, setPhase] = useState<Phase>('select')

  // Project selection state
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<SearchResult | null>(null)

  // Wizard
  const [showWizard, setShowWizard] = useState(false)
  const [showEditWizard, setShowEditWizard] = useState(false)
  const [editInitialValues, setEditInitialValues] = useState<WizardInitialValues | undefined>(undefined)
  const [loadingEditData, setLoadingEditData] = useState(false)

  // History side panel (left, ChatGPT-style)
  const [showHistoryPanel, setShowHistoryPanel] = useState(false)
  const [historyPanelSessions, setHistoryPanelSessions] = useState<ChatSession[]>([])
  const [loadingHistoryPanel, setLoadingHistoryPanel] = useState(false)
  const [showHistorySidebar, setShowHistorySidebar] = useState(true)
  const [sidebarSessions, setSidebarSessions] = useState<ChatSession[]>([])
  const [loadingSidebar, setLoadingSidebar] = useState(false)

  // Ontology context state
  const [showBanner, setShowBanner] = useState(false)
  const [contextLoaded, setContextLoaded] = useState(false)
  const [isLoadingSubgraph, setIsLoadingSubgraph] = useState(false)
  const [showGraphModal, setShowGraphModal] = useState(false)

  // Chat state
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncState, setSyncState] = useState<{ ok: boolean; error: boolean; message: string }>(
    { ok: false, error: false, message: '' })
  const [input, setInput] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)

  // Model selection
  const [selectedModel, setSelectedModel] = useState('us.anthropic.claude-sonnet-4-20250514-v1:0')
  const [showModelSwitch, setShowModelSwitch] = useState<{ show: boolean; toModel: ModelOption | null }>({ show: false, toModel: null })
  const [switchGenerating, setSwitchGenerating] = useState(false)

  // Token metrics
  const [tokenMetrics, setTokenMetrics] = useState<{ totalInputTokens: number; totalOutputTokens: number; totalCost: number; totalSessions: number } | null>(null)
  const [loadingMetrics, setLoadingMetrics] = useState(false)

  // Tier / budget notifications
  const [tierSwitchBanner, setTierSwitchBanner] = useState<{ fromTier: number; toTier: number; reason: string; newModel: string } | null>(null)
  const [budgetWarning, setBudgetWarning] = useState<{ tier: number; spentUSD: number; limitUSD: number; pct: number } | null>(null)

  // Metrics + session history
  const [stats, setStats] = useState<OntologyStats | null>(null)
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [chatStatsData, setChatStatsData] = useState({ totalSessions: 0, todaySessions: 0, totalMessages: 0 })
  const [loadingStats, setLoadingStats] = useState(true)
  const [deletingSession, setDeletingSession] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const sessionId = useRef<string>('')
  // True once the first user message has been sent in the current session
  const firstMessageSentRef = useRef(false)

  // Suppress unused navigate warning — keep for future route navigation
  void navigate

  // ── Load dashboard data on mount ───────────────────────────────────────────
  useEffect(() => {
    setLoadingStats(true)
    Promise.all([
      getOntologyStats().catch(() => null),
      getChatSessions().catch(() => []),
      getChatStats().catch(() => ({ totalSessions: 0, todaySessions: 0, totalMessages: 0 })),
    ]).then(([s, sessions, cs]) => {
      if (s) setStats(s)
      setChatSessions(sessions)
      setChatStatsData(cs)
    }).finally(() => setLoadingStats(false))
  }, [])

  // ── Load token metrics ────────────────────────────────────────────────────
  useEffect(() => {
    setLoadingMetrics(true)
    getTokenMetrics('today')
      .then(m => setTokenMetrics(m))
      .catch(() => {})
      .finally(() => setLoadingMetrics(false))
  }, [])

  const refreshSessions = useCallback(async () => {
    const [sessions, cs] = await Promise.all([getChatSessions(), getChatStats()])
    setChatSessions(sessions)
    setSidebarSessions(sessions)
    setChatStatsData(cs)
  }, [])

  // Load sidebar sessions when entering chat phase
  useEffect(() => {
    if (phase !== 'chat') return
    setLoadingSidebar(true)
    getChatSessions()
      .then(s => { setSidebarSessions(s); setChatSessions(s) })
      .catch(() => {})
      .finally(() => setLoadingSidebar(false))
  }, [phase])

  const handleLoadSession = useCallback(async (session: ChatSession) => {
    sessionId.current = session.sessionId
    setSelectedProject({ id: session.projectId || session.sessionId, type: 'Project', name: session.projectName })
    setContextLoaded(false)
    setShowBanner(false)
    try {
      const { getChatSession } = await import('../api/chatSessions')
      const detail = await getChatSession(session.sessionId)
      if (detail?.messages && detail.messages.length > 0) {
        setMessages(detail.messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })))
      } else {
        setMessages([{ role: 'assistant', content: `Welcome back! Continuing session for **${session.projectName}**.` }])
      }
    } catch {
      setMessages([{ role: 'assistant', content: `Welcome back! Continuing session for **${session.projectName}**.` }])
    }
    setPhase('chat')
  }, [])

  const handleDeleteSession = useCallback(async (e: React.MouseEvent, sessionId_: string) => {
    e.stopPropagation()
    setDeletingSession(sessionId_)
    try {
      await deleteChatSession(sessionId_)
      setChatSessions(prev => prev.filter(s => s.sessionId !== sessionId_))
    } finally {
      setDeletingSession(null)
    }
  }, [])

  // ── Debounced search ────────────────────────────────────────────────────────
  useEffect(() => {
    if (query.length < 2) { setResults([]); setDropdownOpen(false); return }
    setIsSearching(true)
    setDropdownOpen(true)
    const t = setTimeout(async () => {
      try {
        const r = await searchNodes(query, 'Project', 10) as SearchResult[]
        setResults(r)
      } catch {
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  // Click outside to close dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── WebSocket (connects when entering chat phase) ───────────────────────────
  useEffect(() => {
    if (phase !== 'chat') return
    const token = localStorage.getItem('ov_token') ?? ''
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${location.host}/ws/advisor?token=${token}`)
    wsRef.current = ws

    ws.onopen = () => setIsConnected(true)
    ws.onclose = () => setIsConnected(false)
    ws.onerror = () => setIsConnected(false)
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'token') {
          setMessages(prev => {
            const last = prev[prev.length - 1]
            if (last?.role === 'assistant') {
              return [...prev.slice(0, -1), { ...last, content: last.content + msg.content, isStreaming: true }]
            }
            return [...prev, { role: 'assistant', content: msg.content, isStreaming: true }]
          })
        } else if (msg.type === 'usage') {
          const input: number = msg.input ?? 0
          const output: number = msg.output ?? 0
          const cost: number = msg.cost ?? 0
          setMessages(prev => {
            const copy = [...prev]
            const last = copy[copy.length - 1]
            if (last?.role === 'assistant') {
              copy[copy.length - 1] = { ...last, tokens: { input, output, cost } }
            }
            return copy
          })
        } else if (msg.type === 'tier_switch') {
          setTierSwitchBanner({
            fromTier: msg.fromTier ?? 0,
            toTier: msg.toTier ?? 0,
            reason: msg.reason ?? '',
            newModel: msg.newModel ?? '',
          })
          if (msg.newModel) setSelectedModel(msg.newModel)
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `**Model switched automatically** — ${msg.reason ?? `Tier ${msg.fromTier} budget exhausted. Now using Tier ${msg.toTier} model.`}`,
          }])
        } else if (msg.type === 'budget_warning') {
          setBudgetWarning({
            tier: msg.tier ?? 0,
            spentUSD: msg.spentUSD ?? 0,
            limitUSD: msg.limitUSD ?? 0,
            pct: msg.pct ?? 0,
          })
        } else if (msg.type === 'tool_call') {
          // Previously ignored: tool activity was completely invisible.
          setMessages(prev => [...prev, {
            role: 'tool', content: '',
            tool: { name: msg.name, input: msg.input },
          }])
        } else if (msg.type === 'tool_result') {
          const out = (msg.output ?? {}) as Record<string, unknown>
          setMessages(prev => {
            // Attach the result to the most recent unresolved call of the same tool.
            const idx = [...prev].reverse().findIndex(
              m => m.role === 'tool' && m.tool?.name === msg.name && !m.tool?.output)
            if (idx === -1) return prev
            const at = prev.length - 1 - idx
            const next = [...prev]
            next[at] = { ...next[at], tool: {
              ...next[at].tool!, output: out,
              stagedPath: out.staged ? String(out.path ?? '') : undefined,
              diff: typeof out.diff === 'string' ? out.diff : undefined,
            } }
            return next
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
      } catch { /* ignore parse errors */ }
    }

    return () => ws.close()
  }, [phase, selectedModel])

  // ── Project selection handlers ──────────────────────────────────────────────
  const handleSelectProject = useCallback(async (r: SearchResult) => {
    setSelectedProject(r)
    setDropdownOpen(false)
    setQuery(r.name)
    setShowBanner(true)
    setIsLoadingSubgraph(true)
    try {
      await loadProjectSubgraph(r.name)
    } finally {
      setIsLoadingSubgraph(false)
    }
  }, [loadProjectSubgraph])

  const startSession = useCallback((name: string, projectId?: string) => {
    const sid = `devchat-${Date.now()}`
    sessionId.current = sid
    firstMessageSentRef.current = false
    createChatSession({ sessionId: sid, projectName: name, projectId: projectId ?? '', sessionName: name })
      .then(() => refreshSessions())
      .catch(() => {})
  }, [refreshSessions])

  // Update session name to the first user message (truncated to 60 chars) — upserts the DynamoDB record
  const updateSessionName = useCallback((firstMessage: string) => {
    if (firstMessageSentRef.current) return
    firstMessageSentRef.current = true
    const name = firstMessage.trim().slice(0, 60) || 'Chat'
    createChatSession({
      sessionId: sessionId.current,
      sessionName: name,
      projectName: selectedProject?.name ?? '',
      projectId: selectedProject?.id ?? '',
    }).then(() => {
      setSidebarSessions(prev =>
        prev.map(s => s.sessionId === sessionId.current ? { ...s, sessionName: name } : s)
      )
    }).catch(() => {})
  }, [selectedProject])

  // Handle project selected from ProjectsPanel — load existing history or start new session
  const handlePanelProjectSelect = useCallback(async (project: Project) => {
    const r: SearchResult = { id: project.projectId, type: 'Project', name: project.name }
    setSelectedProject(r)
    setQuery(project.name)
    setShowBanner(false)
    setContextLoaded(false)
    setTierSwitchBanner(null)
    setBudgetWarning(null)

    // Fetch all sessions, filter for this project, load most recent if available
    const allSessions = await getChatSessions().catch(() => [] as ChatSession[])
    setSidebarSessions(allSessions)
    const existing = allSessions
      .filter(s => s.projectName === project.name || s.projectId === project.projectId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

    if (existing.length > 0) {
      const latest = existing[0]
      sessionId.current = latest.sessionId
      firstMessageSentRef.current = true
      try {
        const { getChatSession } = await import('../api/chatSessions')
        const detail = await getChatSession(latest.sessionId)
        if (detail?.messages && detail.messages.length > 0) {
          setMessages(detail.messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })))
        } else {
          setMessages([{ role: 'assistant', content: `Hi! I'm **DevMate** for **${project.name}**. Ask me anything about this project.\n\nTip: Click the ✦ **Load Context** button in the header to load the knowledge graph for richer, project-specific answers.` }])
        }
      } catch {
        setMessages([{ role: 'assistant', content: `Hi! I'm **DevMate** for **${project.name}**. Ask me anything about this project.\n\nTip: Click the ✦ **Load Context** button in the header to load the knowledge graph for richer, project-specific answers.` }])
      }
    } else {
      startSession(project.name, project.projectId)
      setMessages([{
        role: 'assistant',
        content: `Hi! I'm **DevMate** for **${project.name}**. Ask me anything about this project.\n\nTip: Click the ✦ **Load Context** button in the header to load the knowledge graph for richer, project-specific answers.`,
      }])
    }

    setPhase('chat')
    loadProjectSubgraph(project.name).catch(() => {})
  }, [loadProjectSubgraph, startSession])

  const handleCreateNew = useCallback(() => {
    const name = query.trim() || 'New Project'
    startSession(name)
    setSelectedProject({ id: name, type: 'Project', name })
    setShowBanner(false)
    setContextLoaded(false)
    setMessages([{
      role: 'assistant',
      content: `Hi! I'm **DevMate** for **${name}**. This is a new project — no ontology context yet. Ask me anything about design, architecture, code, or best practices!`,
    }])
    setPhase('chat')
  }, [query, startSession])

  /**
   * Clone (or fast-forward) the project's repo into the server workspace.
   *
   * react_orchestrator only attaches list_files/read_file/write_file/get_diff when
   * a clone exists, and nothing used to call this endpoint — which is why the agent
   * always ran tool-less and gave no indication why.
   */
  const handleSyncRepo = useCallback(async () => {
    const pid = selectedProject?.id
    if (!pid) return
    setSyncing(true); setSyncState({ ok: false, error: false, message: '' })
    try {
      const { data: connectors } = await projectsApi.getConnectors(pid)
      const repo = (connectors ?? []).find(
        (c: { repoUrl?: string; localPath?: string }) => c.repoUrl || c.localPath)
      const raw = repo?.repoUrl || repo?.localPath
      if (!raw) throw new Error('This project has no repository configured.')
      // A local fixture path needs a file:// scheme for git to accept it.
      const url = /^[a-z]+:\/\//i.test(raw) ? raw : `file://${raw}`
      const res = await cloneRepo({ projectId: pid, repoUrl: url, branch: repo?.branch || 'main' })
      setSyncState({ ok: true, error: false, message: res.message })
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Repository synced — I can now read this project's files.\n\n\`${res.clonedPath}\``,
      }])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setSyncState({ ok: false, error: true, message: msg })
      setMessages(prev => [...prev, { role: 'assistant', content: `Could not sync the repo: ${msg}` }])
    } finally {
      setSyncing(false)
    }
  }, [selectedProject])

  const handleUseContext = useCallback(() => {
    const name = selectedProject?.name ?? ''
    const nodeCount = ontologyNodes.length
    const linkCount = ontologyLinks.length
    startSession(name, selectedProject?.id)
    setContextLoaded(true)
    setShowBanner(false)
    setMessages([{
      role: 'assistant',
      content: `Hi! I'm **DevMate** for **${name}**.\n\nOntology context loaded ✓ — ${nodeCount} nodes, ${linkCount} links from the knowledge graph. I can now answer questions with full awareness of this project's services, infrastructure, dependencies, and security posture.`,
    }])
    setPhase('chat')
  }, [selectedProject, ontologyNodes, ontologyLinks, startSession])

  const handleSkipContext = useCallback(() => {
    const name = selectedProject?.name ?? ''
    startSession(name, selectedProject?.id)
    setShowBanner(false)
    setContextLoaded(false)
    setMessages([{
      role: 'assistant',
      content: `Hi! I'm **DevMate** for **${name}**. Ask me anything — you can load the ontology context later by clicking "Load Context" in the header.`,
    }])
    setPhase('chat')
  }, [selectedProject, startSession])

  const handleWizardComplete = useCallback(async (result: WizardResult) => {
    const { projectName, projectId, useKnowledgeGraph: useKG, sessionChoice, existingSessionId } = result

    setSelectedProject({ id: projectId ?? projectName, type: 'Project', name: projectName })
    setQuery(projectName)
    setShowBanner(false)

    if (sessionChoice === 'history' && existingSessionId) {
      // Load an existing session's messages
      sessionId.current = existingSessionId
      try {
        const { getChatSession } = await import('../api/chatSessions')
        const detail = await getChatSession(existingSessionId)
        if (detail?.messages && detail.messages.length > 0) {
          setMessages(detail.messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })))
        } else {
          setMessages([{ role: 'assistant', content: `Welcome back! Continuing session for **${projectName}**.` }])
        }
      } catch {
        setMessages([{ role: 'assistant', content: `Welcome back! Continuing session for **${projectName}**.` }])
      }
      setContextLoaded(useKG)
      setPhase('chat')
      return
    }

    // New chat session
    startSession(projectName, projectId)

    if (useKG) {
      try {
        await loadProjectSubgraph(projectName)
      } catch { /* best-effort */ }
      setContextLoaded(true)
      setMessages([{
        role: 'assistant',
        content: `Hi! I'm **DevMate** for **${projectName}**.\n\nOntology context loaded ✓ — ${ontologyNodes.length} nodes, ${ontologyLinks.length} links from the knowledge graph. I can now answer questions with full awareness of this project's services, infrastructure, dependencies, and security posture.`,
      }])
    } else {
      setContextLoaded(false)
      setMessages([{
        role: 'assistant',
        content: `Hi! I'm **DevMate** for **${projectName}**. Ask me anything about design, architecture, code, or best practices!`,
      }])
    }
    setPhase('chat')
  }, [startSession, loadProjectSubgraph, ontologyNodes.length, ontologyLinks.length])

  const handleOpenEditWizard = useCallback(async () => {
    if (!selectedProject) { setShowEditWizard(true); return }
    setLoadingEditData(true)
    try {
      const [projRes, connectors] = await Promise.all([
        projectsApi.get(selectedProject.id).catch(() => null),
        projectsApi.getConnectors(selectedProject.id).catch(() => []),
      ])
      const proj = projRes?.data as any
      const initial: WizardInitialValues = {
        projectName: selectedProject.name,
        projectId: selectedProject.id,
        description: proj?.description ?? '',
      }
      // Map first connector to repo fields
      const conn = (connectors as any[])?.[0]
      if (conn) {
        if (conn.connectorType === 'mcp' || conn.sourceType === 'mcp') {
          initial.repoChoice = 'git-mcp'
          initial.mcpUrl = conn.repoUrl ?? ''
        } else if (conn.sourceType === 'local') {
          initial.repoChoice = 'local'
          initial.localPath = conn.localPath ?? conn.repoUrl ?? ''
        } else {
          initial.repoChoice = 'git-repo'
          initial.repoUrl = conn.repoUrl ?? ''
          initial.repoType = conn.repoType ?? 'github'
          initial.repoBranch = conn.branch ?? ''
          initial.hasToken = !!conn.hasToken
        }
      }
      setEditInitialValues(initial)
    } finally {
      setLoadingEditData(false)
      setShowEditWizard(true)
    }
  }, [selectedProject])

  const handleShowHistory = useCallback(async () => {
    setShowHistoryPanel(true)
    setLoadingHistoryPanel(true)
    try {
      const sessions = await getChatSessions()
      const projectName = selectedProject?.name ?? ''
      const filtered = projectName
        ? sessions.filter(s => s.projectName === projectName)
        : sessions
      setHistoryPanelSessions(filtered.length > 0 ? filtered : sessions)
    } catch {
      setHistoryPanelSessions([])
    } finally {
      setLoadingHistoryPanel(false)
    }
  }, [selectedProject])

  // ── Model switch handlers ──────────────────────────────────────────────────
  function handleModelChange(model: ModelOption) {
    setShowModelSwitch({ show: true, toModel: model })
  }

  async function confirmModelSwitch(includeSummary: boolean) {
    const { toModel } = showModelSwitch
    if (!toModel) return
    setSwitchGenerating(true)
    try {
      if (includeSummary) {
        const token = localStorage.getItem('ov_token') ?? ''
        try {
          const res = await fetch(`/api/chat/sessions/${sessionId.current}/summarize`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          })
          const { summary } = await res.json() as { summary: string }
          setMessages(prev => [
            { role: 'assistant', content: `**Context from previous conversation:**\n\n${summary}` },
            ...prev.slice(-3),
          ])
        } catch { /* best-effort */ }
      }
      setSelectedModel(toModel.id)
    } finally {
      setSwitchGenerating(false)
      setShowModelSwitch({ show: false, toModel: null })
    }
  }

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(() => {
    const text = input.trim()
    if (!text || !isConnected || isStreaming) return

    updateSessionName(text)
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setInput('')

    const payload: Record<string, unknown> = {
      type: 'chat',
      sessionId: sessionId.current,
      model: selectedModel,
      text,
      projectName: selectedProject?.name ?? '',
      projectId: selectedProject?.id ?? '',
    }
    if (contextLoaded && ontologyNodes.length > 0) {
      payload.context = {
        project: selectedProject?.name,
        nodes: ontologyNodes.slice(0, 80),
        links: ontologyLinks.slice(0, 160),
      }
    }
    wsRef.current?.send(JSON.stringify(payload))
    setIsStreaming(true)
    // Note: the backend advisor WebSocket handler already persists both the user
    // message and assistant response — no separate appendChatMessage call needed here.
  }, [input, isConnected, isStreaming, contextLoaded, ontologyNodes, ontologyLinks, selectedProject, selectedModel, updateSessionName])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  // ── Render: select phase ────────────────────────────────────────────────────
  if (phase === 'select') {
    const byType = stats?.byType ?? {}
    return (
      <>
      {showWizard && (
        <CreateProjectWizard
          onClose={() => setShowWizard(false)}
          onComplete={result => { setShowWizard(false); handleWizardComplete(result) }}
        />
      )}
      {showGraphModal && selectedProject && (
        <ProjectGraphModal
          isOpen={showGraphModal}
          onClose={() => setShowGraphModal(false)}
          projectName={selectedProject.name}
          nodes={ontologyNodes as any[]}
          links={ontologyLinks as any[]}
        />
      )}
      <div style={{
        marginTop: '-24px', marginRight: '-24px', marginBottom: '-24px', marginLeft: '-24px',
        minHeight: 'calc(100vh - 48px)', overflowY: 'auto', padding: '32px 40px',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* ── Header ───────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0,
              background: 'linear-gradient(135deg, #312e81, #4f46e5, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 24px rgba(124,58,237,0.4)',
            }}>
              <Bot size={22} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                DevMate
              </h1>
              <p style={{ fontSize: '12px', color: 'var(--color-muted)', margin: '2px 0 0' }}>
                AI-powered assistant with ontology context
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setShowWizard(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '9px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                color: '#fff', border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
                transition: 'opacity 0.15s, transform 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)' }}
            >
              <Plus size={15} /> New Project
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
              Platform Operational
            </div>
          </div>
        </div>

        {/* ── Token metrics strip ─────────────────────────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px',
        }}>
          {[
            {
              label: 'Tokens Today',
              value: loadingMetrics ? '—' : ((tokenMetrics?.totalInputTokens ?? 0) + (tokenMetrics?.totalOutputTokens ?? 0)).toLocaleString(),
              color: '#06b6d4',
              icon: <TrendingUp size={14} />,
            },
            {
              label: 'Cost Today',
              value: loadingMetrics ? '—' : `$${(tokenMetrics?.totalCost ?? 0).toFixed(4)}`,
              color: '#f59e0b',
              icon: <DollarSign size={14} />,
            },
            {
              label: 'Sessions Today',
              value: loadingMetrics ? '—' : String(tokenMetrics?.totalSessions ?? 0),
              color: '#10b981',
              icon: <MessageSquare size={14} />,
            },
          ].map((s, i) => (
            <div key={i} style={{
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: '10px', padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <span style={{ color: s.color }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: '10px', color: 'var(--color-muted)', marginTop: '2px' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Metrics Grid ──────────────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '12px', marginBottom: '24px',
        }}>
          {METRIC_DEFS.map(def => (
            <MetricCard
              key={def.key}
              def={def}
              value={byType[def.key] ?? 0}
              loading={loadingStats}
            />
          ))}
        </div>

        {/* ── Session + Activity stats row ──────────────────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '28px',
        }}>
          {[
            { label: 'Total Sessions', value: chatStatsData.totalSessions, color: '#a78bfa', icon: <MessageSquare size={14}/> },
            { label: "Today's Sessions", value: chatStatsData.todaySessions, color: '#f59e0b', icon: <Clock size={14}/> },
            { label: 'Total Messages', value: chatStatsData.totalMessages, color: '#10b981', icon: <BarChart3 size={14}/> },
          ].map((s, i) => (
            <div key={i} style={{
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: '10px', padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <span style={{ color: s.color }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: '10px', color: 'var(--color-muted)', marginTop: '2px' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Divider ─────────────────────────────────────────────────── */}
        <div style={{
          height: '1px',
          background: 'linear-gradient(90deg, transparent, var(--color-border), transparent)',
          margin: '32px 0',
        }} />

        {/* ── Analytics Dashboard ───────────────────────────────────── */}
        <div style={{ marginBottom: '32px' }}>
          <MetricsDashboard />
        </div>

        {/* ── Divider ─────────────────────────────────────────────────── */}
        <div style={{
          height: '1px',
          background: 'linear-gradient(90deg, transparent, var(--color-border), transparent)',
          margin: '0 0 32px 0',
        }} />

        {/* ── Main content: Projects panel + sessions ───────────────── */}
        <div style={{ display: 'flex', gap: '24px', minHeight: '420px' }}>
          {/* Projects Panel — fills available space */}
          <div style={{ flex: 1, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border)', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <ProjectsPanel
              onSelect={handlePanelProjectSelect}
              selectedId={selectedProject?.id}
              onCreateNew={handleWizardComplete}
            />
          </div>

          {/* Recent Sessions */}
          <div style={{ width: 320, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-muted)' }}>
                ◈ Recent Sessions
              </div>
              <button onClick={refreshSessions} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: '2px', display: 'flex' }}>
                <RefreshCw size={11} />
              </button>
            </div>

            {chatSessions.length === 0 ? (
              <div style={{
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderRadius: '12px', padding: '24px', textAlign: 'center',
                color: 'var(--color-muted)', fontSize: '12px',
              }}>
                <MessageSquare size={24} style={{ margin: '0 auto 8px', opacity: 0.4, display: 'block' }} />
                No sessions yet.<br />Start a chat to see history here.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {chatSessions.slice(0, 8).map(sess => (
                  <div
                    key={sess.sessionId}
                    onClick={() => handleLoadSession(sess)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 12px', borderRadius: '10px',
                      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                      cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
                      position: 'relative',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(124,58,237,0.4)'
                      const del = (e.currentTarget as HTMLDivElement).querySelector<HTMLElement>('.del-btn')
                      if (del) del.style.opacity = '1'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border)'
                      const del = (e.currentTarget as HTMLDivElement).querySelector<HTMLElement>('.del-btn')
                      if (del) del.style.opacity = '0'
                    }}
                  >
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                      background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Bot size={13} color="#fff" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sess.sessionName || sess.projectName}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--color-muted)' }}>{timeAgo(sess.updatedAt)}</span>
                        {sess.messageCount > 0 && (
                          <>
                            <span style={{ color: 'var(--color-border)', fontSize: '9px' }}>·</span>
                            <span style={{ fontSize: '10px', color: 'var(--color-muted)' }}>{sess.messageCount} msg</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      className="del-btn"
                      onClick={e => handleDeleteSession(e, sess.sessionId)}
                      disabled={deletingSession === sess.sessionId}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '3px',
                        color: '#ef4444', opacity: 0, transition: 'opacity 0.15s', flexShrink: 0,
                      }}
                    >
                      {deletingSession === sess.sessionId
                        ? <Loader2 size={11} className="animate-spin" />
                        : <Trash2 size={11} />
                      }
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
      </>
    )
  }

  // ── Render: chat phase ──────────────────────────────────────────────────────
  // Group sidebar sessions by date bucket
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const weekAgoMs = todayStart.getTime() - 6 * 24 * 60 * 60 * 1000
  // Show only sessions for the current project
  const projectSessions = selectedProject
    ? sidebarSessions.filter(s => s.projectName === selectedProject.name)
    : sidebarSessions
  const sidebarGroups = [
    { label: 'Today', items: projectSessions.filter(s => new Date(s.updatedAt).getTime() >= todayStart.getTime()) },
    { label: 'Previous 7 Days', items: projectSessions.filter(s => { const t = new Date(s.updatedAt).getTime(); return t >= weekAgoMs && t < todayStart.getTime() }) },
    { label: 'Older', items: projectSessions.filter(s => new Date(s.updatedAt).getTime() < weekAgoMs) },
  ].filter(g => g.items.length > 0)

  return (
    <>
    {showModelSwitch.show && showModelSwitch.toModel && (
      <ContextSummaryDialog
        fromModel={selectedModel}
        toModel={showModelSwitch.toModel}
        onConfirm={confirmModelSwitch}
        onCancel={() => setShowModelSwitch({ show: false, toModel: null })}
        generating={switchGenerating}
      />
    )}
    {showGraphModal && selectedProject && (
      <ProjectGraphModal
        isOpen={showGraphModal}
        onClose={() => setShowGraphModal(false)}
        projectName={selectedProject.name}
        nodes={ontologyNodes as any[]}
        links={ontologyLinks as any[]}
      />
    )}
    {showEditWizard && (
      <CreateProjectWizard
        key={editInitialValues?.projectId ?? 'edit'}
        initialValues={editInitialValues}
        onClose={() => { setShowEditWizard(false); setEditInitialValues(undefined) }}
        onComplete={result => { setShowEditWizard(false); setEditInitialValues(undefined); handleWizardComplete(result) }}
      />
    )}
    <div style={{
      display: 'flex', flexDirection: 'row',
      height: 'calc(100vh - 48px)',
      marginTop: '-24px', marginRight: '-24px', marginBottom: '-24px', marginLeft: '-24px',
    }}>
      {/* ── Main chat area ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 32px', minWidth: 0 }}>
        {/* Chat header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '12px 0 12px', borderBottom: '1px solid var(--color-border)', flexShrink: 0,
        }}>
          {/* Back to DevMate dashboard */}
          <button
            type="button"
            onClick={() => { setPhase('select'); setSelectedProject(null); setQuery(''); setMessages([]) }}
            title="Back to DevMate"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
              background: 'none', border: '1px solid var(--color-border)',
              color: 'var(--color-muted)', transition: 'all 0.15s', flexShrink: 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-primary)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-primary)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)' }}
          >
            <ArrowLeft size={14} />
          </button>

          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #312e81, #4f46e5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 12px rgba(124,58,237,0.3)',
            flexShrink: 0,
          }}>
            <Bot size={18} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedProject?.name ?? 'DevMate'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: isConnected ? '#10b981' : '#ef4444',
              }} />
              <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
              {contextLoaded && (
                <>
                  <span style={{ color: 'var(--color-muted)', fontSize: '10px' }}>·</span>
                  <span style={{
                    fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px',
                    background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)',
                  }}>✦ ontology context</span>
                </>
              )}
              <span style={{ color: 'var(--color-muted)', fontSize: '10px' }}>·</span>
              <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                {getModelById(selectedModel)?.label ?? selectedModel}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
            {/* Edit project settings */}
            <button
              type="button"
              onClick={handleOpenEditWizard}
              disabled={loadingEditData}
              title="Edit project / change Git source"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: 8, cursor: loadingEditData ? 'wait' : 'pointer',
                background: 'none', border: '1px solid var(--color-border)',
                color: 'var(--color-muted)', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!loadingEditData) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-primary)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-primary)' } }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)' }}
            >
              {loadingEditData
                ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                : <Pencil size={14} />
              }
            </button>

            {/* Sync repo — clones the project into the server workspace, which is
                what makes DevMate's file tools attach. Without a clone the agent
                silently runs with no tools at all. */}
            <button
              onClick={handleSyncRepo}
              disabled={syncing || !selectedProject?.id}
              title={syncState.message || 'Clone or update this project\'s repo so the agent can read its files'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5,
                fontWeight: 600, padding: '5px 10px', borderRadius: 7,
                cursor: syncing || !selectedProject?.id ? 'not-allowed' : 'pointer',
                background: 'transparent',
                color: syncState.ok ? '#10b981' : syncState.error ? '#ef4444' : 'var(--color-muted)',
                border: `1px solid ${syncState.ok ? '#10b98155' : syncState.error ? '#ef444455' : 'var(--color-border)'}`,
                opacity: !selectedProject?.id ? 0.5 : 1,
              }}
            >
              {syncing
                ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                : <GitBranch size={12} />}
              {syncState.ok ? 'Repo synced' : 'Sync repo'}
            </button>

            {/* Model selector */}
            <ModelSelector
              value={selectedModel}
              onChange={handleModelChange}
              disabled={isStreaming}
            />

            {!contextLoaded && selectedProject && ontologyNodes.length > 0 && (
              <button
                onClick={handleUseContext}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 600,
                  background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)',
                  color: '#a78bfa', cursor: 'pointer',
                }}
              >
                ✦ Load Context
              </button>
            )}
            <button
              onClick={() => { setPhase('select'); setSelectedProject(null); setQuery(''); setMessages([]) }}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 600,
                background: 'none', border: '1px solid var(--color-border)',
                color: 'var(--color-subtext)', cursor: 'pointer',
              }}
            >
              <RefreshCw size={11} /> Change Project
            </button>

            {/* History sidebar toggle — right side */}
            <button
              type="button"
              onClick={() => setShowHistorySidebar(v => !v)}
              title={showHistorySidebar ? 'Hide chat history' : 'Show chat history'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
                background: showHistorySidebar ? 'rgba(99,102,241,0.12)' : 'none',
                border: `1px solid ${showHistorySidebar ? 'rgba(99,102,241,0.35)' : 'var(--color-border)'}`,
                color: showHistorySidebar ? '#818cf8' : 'var(--color-muted)',
                transition: 'all 0.15s',
              }}
            >
              {showHistorySidebar ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
            </button>
          </div>
        </div>

        {/* Tier-switch banner */}
        {tierSwitchBanner && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '8px 14px', marginTop: '8px', borderRadius: '8px', flexShrink: 0,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
          }}>
            <span style={{ fontSize: '13px' }}>⚠</span>
            <span style={{ flex: 1, fontSize: '12px', color: 'var(--color-text)' }}>
              <strong>Budget limit reached for Tier {tierSwitchBanner.fromTier}.</strong>{' '}
              {tierSwitchBanner.reason || `Switched to Tier ${tierSwitchBanner.toTier} model.`}
            </span>
            <button
              onClick={() => setTierSwitchBanner(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: '2px 4px', fontSize: '14px', lineHeight: 1 }}
            >×</button>
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {messages.map((msg, i) => (
            msg.role === 'tool' && msg.tool ? (
              <ToolCard key={i} tool={msg.tool} projectId={selectedProject?.id ?? ''}
                onResolved={(_path, how) => setMessages(prev => prev.map(
                  (m, j) => j === i && m.tool ? { ...m, tool: { ...m.tool, applied: how } } : m))} />
            ) : (
              <ChatMessage key={i} msg={msg} />
            )
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Budget warning strip */}
        {budgetWarning && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '8px 14px', marginBottom: '6px', borderRadius: '8px', flexShrink: 0,
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
          }}>
            <span style={{ fontSize: '13px' }}>⚠</span>
            <span style={{ flex: 1, fontSize: '12px', color: 'var(--color-text)' }}>
              You've used <strong>${budgetWarning.spentUSD.toFixed(2)}</strong> of your{' '}
              <strong>${budgetWarning.limitUSD.toFixed(2)}</strong> Tier {budgetWarning.tier} budget{' '}
              ({budgetWarning.pct}%). Consider switching to a cheaper model.
            </span>
            <button
              onClick={() => setBudgetWarning(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: '2px 4px', fontSize: '14px', lineHeight: 1 }}
            >×</button>
          </div>
        )}

        {/* Input */}
        <div style={{
          borderTop: '1px solid var(--color-border)', paddingTop: '16px', flexShrink: 0, paddingBottom: '8px',
        }}>
          <div style={{
            display: 'flex', gap: '10px', alignItems: 'flex-end',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px', padding: '10px 12px',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask about ${selectedProject?.name ?? 'this project'}… (Enter to send, Shift+Enter for newline)`}
              rows={1}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none', resize: 'none',
                fontSize: '13px', color: 'var(--color-text)', lineHeight: 1.5,
                fontFamily: 'inherit', minHeight: '20px', maxHeight: '120px',
              }}
              onInput={e => {
                const t = e.target as HTMLTextAreaElement
                t.style.height = 'auto'
                t.style.height = Math.min(t.scrollHeight, 120) + 'px'
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || !isConnected || isStreaming}
              style={{
                width: '34px', height: '34px', borderRadius: '8px', flexShrink: 0,
                background: !input.trim() || !isConnected || isStreaming
                  ? 'var(--color-border)' : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                border: 'none', cursor: !input.trim() || !isConnected || isStreaming ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s',
              }}
            >
              {isStreaming
                ? <Loader2 size={15} color="#fff" className="animate-spin" />
                : <Send size={15} color="#fff" />
              }
            </button>
          </div>
          <p style={{ fontSize: '10px', color: 'var(--color-muted)', marginTop: '6px', textAlign: 'center' }}>
            Enter ↵ to send · Shift+Enter for newline
          </p>
        </div>

        <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} } @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      </div>

      {/* ── Right history sidebar ────────────────────────────────────────── */}
      {showHistorySidebar && (
        <div style={{
          width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column',
          background: 'var(--color-surface)',
          borderLeft: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}>
          {/* Sidebar header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 12px 10px', borderBottom: '1px solid var(--color-border)', flexShrink: 0,
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)' }}>
              {selectedProject?.name ?? 'History'}
            </div>
            <button
              type="button"
              onClick={() => {
                if (selectedProject) {
                  firstMessageSentRef.current = false
                  startSession(selectedProject.name, selectedProject.id)
                  setMessages([{
                    role: 'assistant',
                    content: `Hi! I'm **DevMate** for **${selectedProject.name}**. Ask me anything about this project.\n\nTip: Click the ✦ **Load Context** button in the header to load the knowledge graph for richer, project-specific answers.`,
                  }])
                  setContextLoaded(false)
                  refreshSessions().catch(() => {})
                } else {
                  setShowWizard(true)
                }
              }}
              title="New chat"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 26, height: 26, borderRadius: 6, cursor: 'pointer',
                background: 'none', border: '1px solid var(--color-border)',
                color: 'var(--color-muted)', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-primary)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-primary)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)' }}
            >
              <SquarePen size={12} />
            </button>
          </div>
          {/* Session list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
            {loadingSidebar ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 10px', color: 'var(--color-muted)', fontSize: 12 }}>
                <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
              </div>
            ) : projectSessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--color-muted)', fontSize: 12 }}>
                <MessageSquare size={20} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
                No sessions for this project
              </div>
            ) : sidebarGroups.map(group => (
              <div key={group.label}>
                <div style={{
                  fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px',
                  color: 'var(--color-muted)', padding: '8px 8px 4px',
                }}>
                  {group.label}
                </div>
                {group.items.map(s => {
                  const isActive = s.sessionId === sessionId.current
                  return (
                    <button
                      key={s.sessionId}
                      type="button"
                      onClick={() => handleLoadSession(s)}
                      style={{
                        width: '100%', display: 'block', textAlign: 'left',
                        padding: '7px 8px', borderRadius: 7, marginBottom: 1,
                        background: isActive ? 'rgba(99,102,241,0.14)' : 'none',
                        border: isActive ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                        cursor: 'pointer', transition: 'background 0.12s, border-color 0.12s',
                      }}
                      onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'var(--color-hover)' } }}
                      onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'none' } }}
                    >
                      <div style={{
                        fontSize: '12px', fontWeight: isActive ? 700 : 500,
                        color: isActive ? 'var(--color-text)' : 'var(--color-subtext)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        lineHeight: 1.4,
                      }}>
                        {s.sessionName || s.projectName}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--color-muted)', marginTop: '1px' }}>
                        {timeAgo(s.updatedAt)}{s.messageCount > 0 ? ` · ${s.messageCount} msg` : ''}
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    {/* New chat wizard from sidebar */}
    {showWizard && (
      <CreateProjectWizard
        onClose={() => setShowWizard(false)}
        onComplete={result => { setShowWizard(false); handleWizardComplete(result) }}
      />
    )}
    </>
  )
}
