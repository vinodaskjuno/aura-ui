import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle, ChevronDown, ChevronRight, Loader2, Plug2, Play,
  RefreshCw, Server, Wrench,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import * as api from '../api/mcp'
import { btn, card, ghost, input, mono } from './aiobs/styles'

/**
 * MCP servers — what is connected, what it can do, does it work.
 *
 * This reads the SAME `user-connectors` rows as the Connectors page (`type="mcp"`).
 * There is deliberately no second store: an MCP server is a connector, and giving
 * endpoints two homes is how they drift apart.
 *
 * What this screen adds is the part that makes MCP legible to someone who has not met
 * it before: the tools a server actually exposes, and a way to call one and see the
 * result. A list of URLs says nothing; a list of tools says what a model can now do.
 */

const STATUS = {
  connected:    { label: 'Connected',    color: '#10b981' },
  failed:       { label: 'Unreachable',  color: '#ef4444' },
  unconfigured: { label: 'Not finished', color: '#f59e0b' },
} as const

function StatusPill({ status }: { status: api.McpServer['status'] }) {
  const { label, color } = STATUS[status] ?? STATUS.failed
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px',
      borderRadius: 20, fontSize: 10.5, fontWeight: 700, color,
      background: `${color}1a`, border: `1px solid ${color}33`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 6, background: color }} />
      {label}
    </span>
  )
}

/** Calls one tool and shows the raw result. The moment MCP stops being abstract. */
function TryTool({ tool }: { tool: api.McpTool }) {
  const [args, setArgs] = useState('{}')
  const [busy, setBusy] = useState(false)
  const [out, setOut] = useState('')

  const run = () => {
    let parsed: Record<string, unknown> = {}
    try {
      parsed = args.trim() ? JSON.parse(args) : {}
    } catch {
      setOut('Arguments must be valid JSON.')
      return
    }
    setBusy(true); setOut('')
    api.callMcpTool(tool.name, parsed)
      .then(r => setOut(JSON.stringify(r.result, null, 2)))
      .catch(e => setOut(String(e?.response?.data?.detail || e)))
      .finally(() => setBusy(false))
  }

  const props = (tool.inputSchema?.properties ?? {}) as Record<string, unknown>
  const paramNames = Object.keys(props)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 8 }}>
      {paramNames.length > 0 && (
        <div style={{ fontSize: 10.5, color: 'var(--color-muted)' }}>
          Arguments: {paramNames.join(', ')}
        </div>
      )}
      <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
        <input value={args} onChange={e => setArgs(e.target.value)}
          placeholder='{"service": "checkout-svc"}'
          style={{ ...input, ...mono, flex: 1, fontSize: 11.5 }} />
        <button type="button" onClick={run} disabled={busy}
          style={{ ...btn, padding: '6px 12px' }}>
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
          Run
        </button>
      </div>
      {out && (
        <pre style={{
          ...mono, margin: 0, padding: '9px 11px', fontSize: 11, lineHeight: 1.6,
          maxHeight: 260, overflow: 'auto', borderRadius: 6,
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          color: 'var(--color-text)',
        }}>{out}</pre>
      )}
    </div>
  )
}

function ServerCard({ server, onRefresh }: {
  server: api.McpServer
  onRefresh: (id: string) => void
}) {
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = () => {
    setBusy(true)
    Promise.resolve(onRefresh(server.connectorId)).finally(() => setBusy(false))
  }

  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <Server size={15} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
            {server.name}
          </div>
          <div style={{ ...mono, fontSize: 10.5, color: 'var(--color-muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {server.url || 'no endpoint set'}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusPill status={server.status} />
          {server.status !== 'unconfigured' && (
            <button type="button" onClick={refresh} disabled={busy}
              style={{ ...ghost, padding: '4px 9px', fontSize: 11 }}>
              {busy ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
              Refresh
            </button>
          )}
        </div>
      </div>

      {server.status === 'unconfigured' ? (
        <div style={{ display: 'flex', gap: 7, fontSize: 12, color: '#f59e0b',
          lineHeight: 1.6 }}>
          <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            This connector has no endpoint URL yet, so there is nothing to connect to.
            Add one on the{' '}
            <Link to="/connectors" style={{ color: 'var(--color-primary)' }}>
              Connectors
            </Link>{' '}page and press Test.
          </span>
        </div>
      ) : server.status === 'failed' ? (
        <div style={{ display: 'flex', gap: 7, fontSize: 12, color: '#f59e0b',
          lineHeight: 1.6 }}>
          <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            This server did not answer. Its tools are unavailable to chat and to the
            knowledge-graph loader; everything else keeps working. Check the endpoint,
            then press Refresh.
          </span>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 11.5, color: 'var(--color-subtext)' }}>
            <strong style={{ color: 'var(--color-text)' }}>{server.tools.length}</strong>
            {' '}tools, available to DevMate and to the knowledge-graph loader
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {server.tools.map(tool => {
              const expanded = open === tool.name
              return (
                <div key={tool.name} style={{ borderTop: '1px solid var(--color-border)',
                  paddingTop: 7, paddingBottom: 7 }}>
                  <button type="button"
                    onClick={() => setOpen(expanded ? null : tool.name)}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%',
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      textAlign: 'left', color: 'var(--color-text)' }}>
                    {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <Wrench size={11} style={{ color: 'var(--color-muted)' }} />
                    <span style={{ ...mono, fontSize: 11.5, fontWeight: 600 }}>
                      {tool.remoteName}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--color-subtext)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tool.description}
                    </span>
                  </button>
                  {expanded && <TryTool tool={tool} />}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default function MCPServersPage() {
  const [data, setData] = useState<api.McpServersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    api.listMcpServers()
      .then(d => { setData(d); setErr('') })
      .catch(() => setErr('Could not load MCP servers. Check that you have the connectors permission.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const refresh = (connectorId: string) =>
    api.refreshMcpServer(connectorId).then(load).catch(() => {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 900 }}>
      <div>
        <div className="section-label" style={{ marginBottom: 4 }}>MCP Servers</div>
        <div style={{ fontSize: 12.5, color: 'var(--color-subtext)', lineHeight: 1.65 }}>
          Model Context Protocol servers you have connected. Their tools are offered to
          DevMate automatically, and can be loaded into the knowledge graph from{' '}
          <Link to="/ontology/data-loader" style={{ color: 'var(--color-primary)' }}>
            Data Loader
          </Link>. Add and remove servers on the{' '}
          <Link to="/connectors" style={{ color: 'var(--color-primary)' }}>
            Connectors
          </Link>{' '}page — they are stored as connectors of type <code>mcp</code>.
        </div>
      </div>

      {err && <div style={{ fontSize: 12, color: '#ef4444' }}>{err}</div>}

      {loading && !data && (
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12.5, color: 'var(--color-muted)' }}>
          <Loader2 size={13} className="animate-spin" /> Discovering tools…
        </div>
      )}

      {data && data.servers.length === 0 && (
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
            fontWeight: 700, color: 'var(--color-text)' }}>
            <Plug2 size={14} /> No MCP servers connected
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--color-subtext)', lineHeight: 1.65 }}>
            Add one from the <Link to="/connectors"
              style={{ color: 'var(--color-primary)' }}>Connectors</Link> page: choose
            type <strong>MCP</strong> and give it the server's endpoint, for example{' '}
            <code>http://mcp-sre:8081/mcp</code>. Test it there, then come back here to
            see what it exposes.
          </div>
        </div>
      )}

      {data && data.servers.map(server => (
        <ServerCard key={server.connectorId} server={server} onRefresh={refresh} />
      ))}

      {data && data.servers.length > 0 && (
        <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>
          {data.toolCount} tools available to chat across {data.servers.length} server
          {data.servers.length === 1 ? '' : 's'}.
        </div>
      )}
    </div>
  )
}
