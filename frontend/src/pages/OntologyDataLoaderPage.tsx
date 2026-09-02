import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Zap, Link2, Upload, GitBranch, RefreshCw, Play, Clock,
  GitCommit, Globe, Shield,
  Server, Database, Package,
  MessageSquare, CheckCircle2, XCircle, AlertCircle,
  FolderOpen, ChevronRight, Activity,
} from 'lucide-react'
import { useGraphTheme } from '../hooks/useGraphTheme'
import GitRepoLoader from '../components/loader/GitRepoLoader'
import {
  getVersions,
  getVersionDetail,
  getSchedulerStatus,
  loadViaMcp,
  loadViaApi,
  loadViaFile,
  updateSchedule,
  triggerSchedulerNow,
} from '../api/ontologyUniverse'
import { listMcpServers } from '../api/mcp'
import type { McpServer } from '../api/mcp'
import type { OntologyVersion, SchedulerJob } from '../api/ontologyUniverse'

// The MCP sources are whatever the user has actually connected — read at render time
// from their `type="mcp"` connector rows.
//
// This used to be a hardcoded list of eight names (git, servicenow, wiz, ...) which
// the backend then ignored entirely: `sources` was accepted by /api/ontology/load/mcp
// and never passed to the loader, and the data came from a random.seed() generator. The
// tick-boxes were decorative and the "MCP" label was aspirational.

type ActiveTab = 'mcp' | 'api' | 'file' | 'repos'

const TAB_CONFIG: { id: ActiveTab; label: string; Icon: React.ElementType }[] = [
  { id: 'mcp',   label: 'MCP Connector', Icon: Zap },
  { id: 'api',   label: 'API Endpoint',  Icon: Link2 },
  { id: 'file',  label: 'File Upload',   Icon: Upload },
  { id: 'repos', label: 'Git Repos',     Icon: GitBranch },
]

export default function OntologyDataLoaderPage() {
  const t = useGraphTheme()

  const [activeTab, setActiveTab] = useState<ActiveTab>('mcp')
  const [versions, setVersions] = useState<OntologyVersion[]>([])
  const [selectedVersion, setSelectedVersion] = useState<OntologyVersion | null>(null)
  const [schedulerJobs, setSchedulerJobs] = useState<SchedulerJob[]>([])
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [error, setError] = useState('')

  // MCP state
  const [mcpSources, setMcpSources] = useState<string[]>([])
  const [mcpNotes, setMcpNotes] = useState('')
  const [mcpServers, setMcpServers] = useState<McpServer[]>([])
  const [mcpLoadingServers, setMcpLoadingServers] = useState(true)
  // What the last load could not map. Reported rather than swallowed: a loader that
  // quietly discards half its input is worse than one that fails loudly.
  const [mcpSkipped, setMcpSkipped] = useState<{ server: string; nodes: number; skipped: number }[]>([])

  // API state
  const [apiUrl, setApiUrl] = useState('')
  const [apiAuthType, setApiAuthType] = useState<'none' | 'bearer' | 'basic' | 'apikey'>('none')
  const [apiToken, setApiToken] = useState('')
  const [apiNotes, setApiNotes] = useState('')

  // File state
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileNotes, setFileNotes] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Scheduler editing
  const [editingJob, setEditingJob] = useState<SchedulerJob | null>(null)
  const [editCron, setEditCron] = useState('')

  const { panelBg: bg, panelBorder: border, panelText: text, panelSubtext: sub,
          panelCard: card, panelCardBorder: cardBorder, inputBg: inp,
          inputBorder: inpBorder, inputText: inpText, accent: acc,
          accentBg: accBg, accentBorder: accBorder, divider } = t

  const refresh = useCallback(async () => {
    try {
      const [v, s] = await Promise.all([getVersions(30), getSchedulerStatus()])
      setVersions(v)
      setSchedulerJobs(s.jobs)
    } catch {/* non-fatal */}
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const toast = (msg: string, isError = false) => {
    isError ? setError(msg) : setStatusMsg(msg)
    setTimeout(() => isError ? setError('') : setStatusMsg(''), 4000)
  }

  useEffect(() => {
    listMcpServers()
      .then(d => {
        setMcpServers(d.servers)
        // Preselect the reachable ones: the common case is "load everything I have".
        setMcpSources(d.servers.filter(s => s.status === 'connected').map(s => s.connectorId))
      })
      .catch(() => setMcpServers([]))
      .finally(() => setMcpLoadingServers(false))
  }, [])

  const handleMcpLoad = async () => {
    if (!mcpSources.length) return toast('Select at least one MCP server', true)
    setLoading(true); setError(''); setMcpSkipped([])
    try {
      const r = await loadViaMcp(mcpSources, undefined, mcpNotes)
      setMcpSkipped(r.sources ?? [])
      const skipped = r.skipped ? `, ${r.skipped} records skipped` : ''
      toast(`Loaded ${r.nodesAdded} nodes and ${r.relsAdded ?? 0} relationships${skipped} (${r.versionNumber})`)
      refresh()
    } catch (e: unknown) { toast(String(e), true) }
    finally { setLoading(false) }
  }

  const toggleSource = (id: string) =>
    setMcpSources(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])

  const handleApiLoad = async () => {
    if (!apiUrl) return toast('Enter an API URL', true)
    setLoading(true); setError('')
    try {
      const r = await loadViaApi({ url: apiUrl, auth_type: apiAuthType, token: apiToken, notes: apiNotes })
      toast(`Loaded ${r.nodesAdded} nodes from API (${r.versionNumber})`)
      refresh()
    } catch (e: unknown) { toast(String(e), true) }
    finally { setLoading(false) }
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) setSelectedFile(f)
  }

  const handleFileLoad = async () => {
    if (!selectedFile) return toast('Select a file first', true)
    setLoading(true); setError('')
    try {
      const r = await loadViaFile(selectedFile, fileNotes)
      toast(`Loaded ${r.nodesAdded} nodes from ${r.filename} (${r.versionNumber})`)
      setSelectedFile(null); refresh()
    } catch (e: unknown) { toast(String(e), true) }
    finally { setLoading(false) }
  }

  const handleRunNow = async (jobId: string) => {
    setLoading(true)
    try {
      await triggerSchedulerNow(jobId)
      toast('Job started in background')
      setTimeout(refresh, 2000)
    } catch (e: unknown) { toast(String(e), true) }
    finally { setLoading(false) }
  }

  const handleSaveSchedule = async () => {
    if (!editingJob) return
    await updateSchedule(editingJob.id, editCron, true)
    toast('Schedule saved')
    setEditingJob(null); refresh()
  }

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString() : '—'

  const statusColor = (s: string) =>
    s === 'success' ? '#22c55e' : s === 'failed' ? '#ef4444' : s === 'in_progress' ? acc : sub

  const MethodIcon = ({ m }: { m: string }) => {
    const props = { size: 13, style: { marginRight: 4, verticalAlign: 'middle' } as React.CSSProperties }
    if (m === 'mcp')       return <Zap {...props} />
    if (m === 'api')       return <Link2 {...props} />
    if (m === 'file')      return <Upload {...props} />
    if (m === 'scheduler') return <Clock {...props} />
    if (m === 'chat')      return <MessageSquare {...props} />
    return <Package {...props} />
  }

  const panelStyle: React.CSSProperties = {
    background: bg, border: `1px solid ${border}`, borderRadius: 14,
    padding: '24px 28px', marginBottom: 20,
  }

  const btnPrimary: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '9px 20px', borderRadius: 9, fontWeight: 600, fontSize: 13,
    cursor: loading ? 'not-allowed' : 'pointer', border: 'none',
    background: `linear-gradient(135deg, ${acc}, ${acc}cc)`,
    color: '#fff', opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  }

  const btnSecondary: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '9px 18px', borderRadius: 9, fontWeight: 600, fontSize: 13,
    cursor: 'pointer', border: `1px solid ${cardBorder}`,
    background: card, color: text, transition: 'background 0.15s',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 13px', borderRadius: 9, fontSize: 13,
    background: inp, border: `1px solid ${inpBorder}`, color: inpText,
    outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ padding: '28px 36px', color: text, minHeight: '100%', boxSizing: 'border-box' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, background: accBg,
              border: `1px solid ${accBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Database size={20} color={acc} />
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: text }}>AURA Data Loader</h1>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: sub, paddingLeft: 48 }}>
            Ingest enterprise data into the Neo4j knowledge graph with full versioning
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {statusMsg && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
              color: '#22c55e', padding: '8px 14px', borderRadius: 9, fontSize: 13,
            }}>
              <CheckCircle2 size={14} /> {statusMsg}
            </div>
          )}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444', padding: '8px 14px', borderRadius: 9, fontSize: 13,
            }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>
      </div>

      {/* ── Ingestion Method Tabs ── */}
      <div style={panelStyle}>
        {/* Tab Bar */}
        <div style={{
          display: 'flex', gap: 2, marginBottom: 24,
          borderBottom: `1px solid ${divider}`, paddingBottom: 0,
        }}>
          {TAB_CONFIG.map(({ id, label, Icon }) => {
            const active = activeTab === id
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '10px 20px', borderRadius: '8px 8px 0 0',
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  cursor: 'pointer', border: 'none',
                  background: active ? accBg : 'transparent',
                  color: active ? acc : sub,
                  borderBottom: active ? `2px solid ${acc}` : '2px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            )
          })}
        </div>

        {/* ── MCP Panel ── */}
        {activeTab === 'mcp' && (
          <div>
            <p style={{ margin: '0 0 18px', fontSize: 13, color: sub }}>
              Pull entities from your connected MCP servers into the knowledge graph.
              Each run creates a versioned snapshot you can roll back.
            </p>

            {mcpLoadingServers && (
              <p style={{ margin: '0 0 18px', fontSize: 13, color: sub }}>
                Discovering connected servers…
              </p>
            )}

            {!mcpLoadingServers && mcpServers.some(s => s.status !== 'connected') && (
              <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#f59e0b', lineHeight: 1.7 }}>
                {mcpServers.filter(s => s.status !== 'connected').length} of{' '}
                {mcpServers.length} connectors cannot be loaded from — hover each one for
                the reason. They are listed so this screen matches the{' '}
                <a href="/connectors" style={{ color: acc }}>Connectors</a> page.
              </p>
            )}

            {!mcpLoadingServers && mcpServers.length === 0 && (
              <p style={{ margin: '0 0 18px', fontSize: 13, color: sub, lineHeight: 1.7 }}>
                No MCP servers connected. Add one on the{' '}
                <a href="/connectors" style={{ color: acc }}>Connectors</a> page (type{' '}
                <strong>MCP</strong>), then see what it exposes under{' '}
                <a href="/mcp" style={{ color: acc }}>MCP Servers</a>.
              </p>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
              {mcpServers.map(server => {
                const sel = mcpSources.includes(server.connectorId)
                const down = server.status !== 'connected'
                // Unusable servers are shown, not hidden. A connector that appears on
                // the Connectors page and then silently is not here leaves the user
                // comparing two lists and guessing which one vanished.
                const why = server.status === 'unconfigured'
                  ? 'No endpoint URL set — finish it on the Connectors page'
                  : server.status === 'failed'
                    ? 'This server did not answer'
                    : `${server.tools.length} tools — ${server.url}`
                return (
                  <button
                    key={server.connectorId}
                    onClick={() => !down && toggleSource(server.connectorId)}
                    disabled={down}
                    title={why}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '8px 16px', borderRadius: 9, fontSize: 13,
                      cursor: down ? 'not-allowed' : 'pointer', opacity: down ? 0.45 : 1,
                      background: sel ? accBg : card,
                      border: `1px solid ${sel ? accBorder : cardBorder}`,
                      color: sel ? acc : text, fontWeight: sel ? 600 : 400,
                      transition: 'all 0.15s',
                    }}
                  >
                    <Server size={13} />
                    {server.name}
                    <span style={{ fontSize: 11, color: sub }}>
                      {server.status === 'unconfigured' ? 'not finished'
                        : server.status === 'failed' ? 'unreachable'
                          : `${server.tools.length} tools`}
                    </span>
                  </button>
                )
              })}
            </div>

            {mcpSkipped.length > 0 && (
              <div style={{ marginBottom: 18, fontSize: 12.5, color: sub, lineHeight: 1.7 }}>
                {mcpSkipped.map(s => (
                  <div key={s.server}>
                    <strong style={{ color: text }}>{s.server}</strong>: {s.nodes} nodes
                    {s.skipped > 0 && (
                      <span style={{ color: '#f59e0b' }}>
                        {' '}— {s.skipped} records skipped (no recognised entity type)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <textarea
              placeholder="Notes (optional)..."
              value={mcpNotes}
              onChange={e => setMcpNotes(e.target.value)}
              style={{ ...inputStyle, height: 60, resize: 'none', marginBottom: 18 }}
            />
            <button style={btnPrimary} onClick={handleMcpLoad} disabled={loading}>
              <Zap size={14} />
              {loading ? 'Loading…' : `Load Now (${mcpSources.length} server${mcpSources.length !== 1 ? 's' : ''})`}
            </button>
          </div>
        )}

        {/* ── API Panel ── */}
        {activeTab === 'api' && (
          <div>
            <p style={{ margin: '0 0 18px', fontSize: 13, color: sub }}>
              Fetch JSON data from an external REST API endpoint.
            </p>
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <Globe size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: sub }} />
              <input
                style={{ ...inputStyle, paddingLeft: 34 }}
                placeholder="https://api.example.com/ontology/nodes"
                value={apiUrl}
                onChange={e => setApiUrl(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {(['none', 'bearer', 'basic', 'apikey'] as const).map(a => (
                <button key={a} onClick={() => setApiAuthType(a)} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                  background: apiAuthType === a ? accBg : card,
                  border: `1px solid ${apiAuthType === a ? accBorder : cardBorder}`,
                  color: apiAuthType === a ? acc : sub,
                }}>
                  {a === 'none' ? <><Globe size={11} /> No Auth</>
                    : a === 'bearer' ? <><Shield size={11} /> Bearer Token</>
                    : a === 'basic' ? <><Shield size={11} /> Basic Auth</>
                    : <><Shield size={11} /> API Key</>}
                </button>
              ))}
            </div>
            {apiAuthType !== 'none' && (
              <input
                style={{ ...inputStyle, marginBottom: 14 }}
                placeholder={apiAuthType === 'bearer' ? 'Bearer token' : apiAuthType === 'basic' ? 'username:password (base64)' : 'API Key'}
                type="password"
                value={apiToken}
                onChange={e => setApiToken(e.target.value)}
              />
            )}
            <textarea
              placeholder="Notes (optional)..."
              value={apiNotes}
              onChange={e => setApiNotes(e.target.value)}
              style={{ ...inputStyle, height: 60, resize: 'none', marginBottom: 18 }}
            />
            <button style={btnPrimary} onClick={handleApiLoad} disabled={loading}>
              <Link2 size={14} />
              {loading ? 'Fetching…' : 'Load from API'}
            </button>
          </div>
        )}

        {/* ── File Upload Panel ── */}
        {activeTab === 'file' && (
          <div>
            <p style={{ margin: '0 0 18px', fontSize: 13, color: sub }}>
              Upload a JSON, Excel (.xlsx), or CSV file. Excel: one sheet per label. JSON: array of node records.
            </p>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? acc : inpBorder}`,
                borderRadius: 12, padding: '40px 24px', textAlign: 'center',
                cursor: 'pointer', background: dragOver ? accBg : card,
                transition: 'all 0.2s', marginBottom: 18,
              }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 12, margin: '0 auto 14px',
                background: accBg, border: `1px solid ${accBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FolderOpen size={24} color={acc} />
              </div>
              {selectedFile ? (
                <>
                  <div style={{ color: acc, fontWeight: 600, fontSize: 14 }}>{selectedFile.name}</div>
                  <div style={{ color: sub, fontSize: 12, marginTop: 4 }}>
                    {(selectedFile.size / 1024).toFixed(1)} KB · Click to change
                  </div>
                </>
              ) : (
                <>
                  <div style={{ color: text, fontWeight: 500, fontSize: 14 }}>Drag & drop or click to browse</div>
                  <div style={{ color: sub, fontSize: 12, marginTop: 6 }}>JSON, Excel (.xlsx), CSV · Max 50 MB</div>
                </>
              )}
              <input
                ref={fileInputRef} type="file" accept=".json,.xlsx,.xls,.csv" hidden
                onChange={e => { if (e.target.files?.[0]) setSelectedFile(e.target.files[0]) }}
              />
            </div>
            <textarea
              placeholder="Load notes (optional)..."
              value={fileNotes}
              onChange={e => setFileNotes(e.target.value)}
              style={{ ...inputStyle, height: 60, resize: 'none', marginBottom: 18 }}
            />
            <button style={btnPrimary} onClick={handleFileLoad} disabled={loading || !selectedFile}>
              <Upload size={14} />
              {loading ? 'Uploading…' : 'Upload & Load'}
            </button>
          </div>
        )}

        {/* ── Git Repos Panel ── */}
        {activeTab === 'repos' && (
          <GitRepoLoader />
        )}
      </div>

      {/* ── Bottom Grid: Scheduler + Version History ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20, alignItems: 'start' }}>

        {/* Scheduler */}
        <div style={panelStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <Clock size={16} color={acc} />
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Scheduled Ingestion</h2>
          </div>
          {schedulerJobs.map(job => (
            <div key={job.id} style={{
              background: card, border: `1px solid ${cardBorder}`, borderRadius: 10,
              padding: '14px 16px', marginBottom: 10,
            }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{job.name}</div>
              <div style={{ color: sub, fontSize: 11, marginBottom: 6 }}>
                {job.schedule_human} · <code style={{ fontFamily: 'monospace' }}>{job.schedule}</code>
              </div>
              <div style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  color: job.status === 'running' ? '#f59e0b' : sub,
                }}>
                  <Activity size={10} />
                  {job.status}
                </span>
                {job.next_run && (
                  <span style={{ color: sub }}>Next: {fmtDate(job.next_run)}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => { setEditingJob(job); setEditCron(job.schedule) }}
                  style={{ ...btnSecondary, fontSize: 11, padding: '5px 12px' }}
                >
                  <Clock size={11} /> Edit Schedule
                </button>
                <button
                  onClick={() => handleRunNow(job.id)}
                  disabled={loading || job.status === 'running'}
                  style={{ ...btnPrimary, fontSize: 11, padding: '5px 12px' }}
                >
                  <Play size={11} /> Run Now
                </button>
              </div>
              {editingJob?.id === job.id && (
                <div style={{
                  marginTop: 12, paddingTop: 12, borderTop: `1px solid ${divider}`,
                  display: 'flex', gap: 8, alignItems: 'center',
                }}>
                  <input
                    style={{ ...inputStyle, width: 160, fontSize: 12 }}
                    value={editCron}
                    onChange={e => setEditCron(e.target.value)}
                    placeholder="0 2 * * *"
                  />
                  <button onClick={handleSaveSchedule} style={{ ...btnPrimary, fontSize: 11, padding: '6px 12px' }}>
                    Save
                  </button>
                  <button onClick={() => setEditingJob(null)} style={{ ...btnSecondary, fontSize: 11, padding: '6px 10px' }}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
          {!schedulerJobs.length && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              padding: '24px 0', color: sub, fontSize: 13,
            }}>
              <Clock size={28} color={cardBorder} />
              No scheduled jobs configured.
            </div>
          )}
        </div>

        {/* Version History */}
        <div style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <GitCommit size={16} color={acc} />
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Version History</h2>
            </div>
            <button onClick={refresh} style={btnSecondary}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          {selectedVersion ? (
            <div>
              <button
                onClick={() => setSelectedVersion(null)}
                style={{ ...btnSecondary, marginBottom: 16, fontSize: 12 }}
              >
                <ChevronRight size={12} style={{ transform: 'rotate(180deg)' }} /> Back to list
              </button>
              <div style={{ background: card, border: `1px solid ${cardBorder}`, borderRadius: 10, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <MethodIcon m={selectedVersion.loadMethod} />
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
                    {selectedVersion.versionNumber}
                    <span style={{ color: sub, fontWeight: 400, marginLeft: 8 }}>{selectedVersion.loadMethod}</span>
                  </h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    {[
                      ['Actor', selectedVersion.actor],
                      ['Started', fmtDate(selectedVersion.startedAt)],
                      ['Finished', fmtDate(selectedVersion.finishedAt)],
                      ['Status', selectedVersion.status],
                      ['Nodes Added', selectedVersion.stats?.nodesAdded ?? 0],
                      ['Nodes Updated', selectedVersion.stats?.nodesUpdated ?? 0],
                      ['Rels Added', selectedVersion.stats?.relsAdded ?? 0],
                      ['Total Nodes', selectedVersion.stats?.totalNodes ?? 0],
                      ['Sources', (selectedVersion.sources || []).join(', ') || '—'],
                      ['Notes', selectedVersion.notes || '—'],
                    ].map(([k, v]) => (
                      <tr key={String(k)} style={{ borderBottom: `1px solid ${divider}` }}>
                        <td style={{ padding: '7px 12px 7px 0', color: sub, width: 130, fontSize: 12 }}>{k}</td>
                        <td style={{ padding: '7px 0', color: k === 'Status' ? statusColor(String(v)) : text }}>
                          {String(v)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {Object.keys(selectedVersion.diffSummary || {}).length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: sub, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Diff Summary
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {Object.entries(selectedVersion.diffSummary).map(([label, count]) => (
                        <span key={label} style={{
                          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: count > 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                          color: count > 0 ? '#22c55e' : '#ef4444',
                          border: `1px solid ${count > 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                        }}>
                          {label}: {count > 0 ? '+' : ''}{count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${divider}` }}>
                    {['Version', 'Method', 'Actor', 'Date', '+Nodes', 'Status', ''].map(h => (
                      <th key={h} style={{
                        padding: '6px 12px 10px', textAlign: 'left',
                        fontWeight: 600, fontSize: 11, color: sub,
                        textTransform: 'uppercase', letterSpacing: '0.5px',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {versions.map(v => (
                    <tr
                      key={v.versionId}
                      style={{ borderBottom: `1px solid ${divider}`, transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = t.rowHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '9px 12px', fontWeight: 700, color: acc, fontSize: 13 }}>
                        {v.versionNumber}
                      </td>
                      <td style={{ padding: '9px 12px', color: text }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                          <MethodIcon m={v.loadMethod} />
                          {v.loadMethod}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', color: sub, fontSize: 12 }}>{v.actor}</td>
                      <td style={{ padding: '9px 12px', color: sub, fontSize: 12 }}>{fmtDate(v.startedAt)}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 600 }}>
                        <span style={{
                          color: '#22c55e', background: 'rgba(34,197,94,0.08)',
                          padding: '2px 8px', borderRadius: 12, fontSize: 11,
                        }}>
                          +{v.stats?.nodesAdded ?? 0}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          color: statusColor(v.status), fontWeight: 600, fontSize: 12,
                        }}>
                          {v.status === 'success'
                            ? <CheckCircle2 size={12} />
                            : v.status === 'failed'
                            ? <XCircle size={12} />
                            : <Activity size={12} />}
                          {v.status}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <button
                          onClick={async () => {
                            try {
                              const detail = await getVersionDetail(v.versionId)
                              setSelectedVersion(detail)
                            } catch { setSelectedVersion(v) }
                          }}
                          style={{ ...btnSecondary, padding: '5px 12px', fontSize: 11 }}
                        >
                          View <ChevronRight size={11} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!versions.length && (
                    <tr>
                      <td colSpan={7} style={{ padding: '32px 24px', textAlign: 'center', color: sub }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                          <GitCommit size={32} color={cardBorder} />
                          <div>No versions yet. Run a load to get started.</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
