import { useState, useCallback, useEffect, useRef } from 'react'
import {
  X, GitBranch, Share2, MessageSquare, Check, Eye, EyeOff,
  Loader2, FolderOpen, Globe, Clock, Plus, ChevronRight,
} from 'lucide-react'
import BranchPicker from '../git/BranchPicker'
import ProjectGraphModal from '../dev/ProjectGraphModal'
import { useOntologyStore } from '../../store/ontologyStore'
import { getChatSessions, type ChatSession } from '../../api/chatSessions'
import { projectsApi } from '../../api/projects'
import { cloneRepo, uploadFolder } from '../../api/gitOps'
import { describeApiError } from '../../api/errors'

/**
 * A folder the user picked in the browser, already filtered.
 *
 * The browser never reveals a real filesystem path, so there is nothing to store
 * but the files themselves — they are posted to /api/git/upload-folder and the
 * server rebuilds the tree in the project workspace.
 */
interface PickedFolder {
  id: string
  label: string
  files: { path: string; file: File }[]
  bytes: number
  skipped: number
  status: 'ready' | 'uploading' | 'done' | 'error'
  message?: string
}

// Mirrors _UPLOAD_SKIP_DIRS / _UPLOAD_SKIP_SUFFIXES in routers/git_ops.py. Filtering
// here as well as server-side is what keeps a picked folder from being a 40,000-file
// upload — the picker hands us node_modules whether we want it or not.
const SKIP_DIRS = new Set([
  'node_modules', '.git', '__pycache__', '.venv', 'venv', 'env',
  'dist', 'build', '.next', '.nuxt', '.turbo', 'target', 'vendor',
  '.mypy_cache', '.pytest_cache', '.ruff_cache', '.idea', '.vscode',
  'coverage', '.gradle', 'bin', 'obj',
])
const SKIP_EXT = new Set([
  '.pyc', '.pyo', '.so', '.dylib', '.dll', '.class', '.o', '.a',
  '.exe', '.zip', '.tar', '.gz', '.jar', '.war', '.png', '.jpg',
  '.jpeg', '.gif', '.ico', '.pdf', '.mp4', '.mov', '.woff', '.woff2',
])

const humanBytes = (n: number) =>
  n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`

/** Split a picked FileList into the files worth uploading and a skip count. */
function filterPicked(list: FileList): Omit<PickedFolder, 'id' | 'status'> {
  const all = Array.from(list)
  // webkitRelativePath is "<pickedFolder>/a/b.ts"; the first segment becomes the
  // label, so it is stripped from every path to avoid backend/backend/a/b.ts.
  const label = (all[0]?.webkitRelativePath ?? '').split('/')[0] || 'folder'
  const files: { path: string; file: File }[] = []
  let bytes = 0
  let skipped = 0
  for (const file of all) {
    const rel = (file.webkitRelativePath || file.name).split('/').slice(1).join('/')
    const parts = rel.split('/')
    const name = parts[parts.length - 1] ?? ''
    const dot = name.lastIndexOf('.')
    const ext = dot > 0 ? name.slice(dot).toLowerCase() : ''
    if (!rel || parts.some(seg => SKIP_DIRS.has(seg)) || SKIP_EXT.has(ext)) { skipped++; continue }
    files.push({ path: rel, file })
    bytes += file.size
  }
  return { label, files, bytes, skipped }
}

export interface WizardResult {
  projectName: string
  projectId?: string
  repo?: { type: 'git-mcp' | 'git-repo' | 'local'; url: string; token?: string; branch?: string }
  useKnowledgeGraph: boolean
  sessionChoice: 'new' | 'history'
  existingSessionId?: string
}

export interface WizardInitialValues {
  projectName?: string
  projectId?: string
  description?: string
  repoChoice?: 'git-mcp' | 'git-repo' | 'local'
  mcpUrl?: string
  repoUrl?: string
  repoType?: string
  repoBranch?: string
  localPath?: string
  hasToken?: boolean
}

interface Props {
  onClose: () => void
  onComplete: (result: WizardResult) => void
  initialValues?: WizardInitialValues
}

type Step = 0 | 1 | 2

const STEPS: { icon: React.ReactNode; label: string }[] = [
  { icon: <GitBranch size={15} />, label: 'Repository' },
  { icon: <Share2 size={15} />, label: 'Knowledge Graph' },
  { icon: <MessageSquare size={15} />, label: 'Session' },
]

const REPO_TYPES = ['github', 'gitlab', 'bitbucket', 'azure-devops', 'other']

export default function CreateProjectWizard({ onClose, onComplete, initialValues }: Props) {
  const { nodes: ontologyNodes, links: ontologyLinks, loadProjectSubgraph } = useOntologyStore()

  // Project header fields
  const [projectName, setProjectName] = useState(initialValues?.projectName ?? '')
  const [description, setDescription] = useState(initialValues?.description ?? '')

  // Project name autocomplete
  const [nameResults, setNameResults] = useState<{ projectId: string; name: string; description: string }[]>([])
  const [showNameDropdown, setShowNameDropdown] = useState(false)
  const [isSearchingName, setIsSearchingName] = useState(false)
  const nameInputRef = useRef<HTMLDivElement>(null)

  // Wizard navigation
  const [step, setStep] = useState<Step>(0)
  const [submitting, setSubmitting] = useState(false)

  // Step 0: Repository
  const [repoChoice, setRepoChoice] = useState<'git-mcp' | 'git-repo' | 'local' | null>(initialValues?.repoChoice ?? null)
  const [mcpUrl, setMcpUrl] = useState(initialValues?.mcpUrl ?? '')
  const [repoUrl, setRepoUrl] = useState(initialValues?.repoUrl ?? '')
  const [repoType, setRepoType] = useState(initialValues?.repoType ?? 'github')
  const [repoToken, setRepoToken] = useState('')
  const [repoBranch, setRepoBranch] = useState(initialValues?.repoBranch ?? '')
  const [showToken, setShowToken] = useState(false)
  const [localPath] = useState(initialValues?.localPath ?? '')
  const [folders, setFolders] = useState<PickedFolder[]>([])
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [analysing, setAnalysing] = useState(false)

  // Step 1: Knowledge Graph
  const [graphProjectName, setGraphProjectName] = useState(initialValues?.projectName ?? '')
  const [graphNameManuallySet, setGraphNameManuallySet] = useState(!!initialValues?.projectName)
  const [isLoadingGraph, setIsLoadingGraph] = useState(false)
  const [graphLoaded, setGraphLoaded] = useState(false)
  const [showGraphModal, setShowGraphModal] = useState(false)
  const [useKnowledgeGraph, setUseKnowledgeGraph] = useState<boolean | null>(null)

  // Step 2: Session
  const [sessionChoice, setSessionChoice] = useState<'new' | 'history' | null>(null)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  // Debounced project name search
  useEffect(() => {
    if (projectName.trim().length < 1) { setNameResults([]); setShowNameDropdown(false); return }
    setIsSearchingName(true)
    const t = setTimeout(async () => {
      try {
        const res = await projectsApi.list()
        const q = projectName.trim().toLowerCase()
        const filtered = (res.data ?? []).filter((p: any) =>
          p.name.toLowerCase().includes(q)
        ).slice(0, 6)
        setNameResults(filtered)
        setShowNameDropdown(filtered.length > 0)
      } catch {
        setNameResults([])
        setShowNameDropdown(false)
      } finally {
        setIsSearchingName(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [projectName])

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (nameInputRef.current && !nameInputRef.current.contains(e.target as Node)) {
        setShowNameDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13,
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: 'var(--color-subtext)',
    textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 5, display: 'block',
  }

  const canProceed = projectName.trim().length > 0
  const canFinish = canProceed && sessionChoice !== null &&
    (sessionChoice === 'new' || selectedSessionId !== null)

  const goNext = () => setStep(s => (s + 1) as Step)
  const goBack = () => setStep(s => (s - 1) as Step)

  const handleLoadGraph = useCallback(async () => {
    const name = graphProjectName.trim() || projectName.trim()
    if (!name) return
    setIsLoadingGraph(true)
    setGraphLoaded(false)
    try {
      await loadProjectSubgraph(name)
      setGraphLoaded(true)
    } catch {
      setGraphLoaded(false)
    } finally {
      setIsLoadingGraph(false)
    }
  }, [graphProjectName, projectName, loadProjectSubgraph])

  const handleLoadHistory = useCallback(async () => {
    setSessionChoice('history')
    setSelectedSessionId(null)
    setLoadingSessions(true)
    try {
      const list = await getChatSessions()
      setSessions(list)
    } catch {
      setSessions([])
    } finally {
      setLoadingSessions(false)
    }
  }, [])

  const handlePickFolder = useCallback((list: FileList) => {
    const picked = filterPicked(list)
    if (picked.files.length === 0) {
      window.alert(
        `Nothing to upload from "${picked.label}" — all ${picked.skipped} entries are ` +
        'dependency or build directories. Pick the source folder itself (e.g. backend/).')
      return
    }
    setFolders(prev => {
      // Two folders sharing a label would land in the same server directory and the
      // second would silently replace the first, so make the label unique instead.
      let label = picked.label
      for (let n = 2; prev.some(f => f.label === label); n++) label = `${picked.label}-${n}`
      const id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID() : `${Date.now()}-${prev.length}`
      return [...prev, { ...picked, label, id, status: 'ready' as const }]
    })
  }, [])

  const renameFolder = useCallback((id: string, raw: string) => {
    // Same sanitisation the server applies, so what you type is what you get.
    const label = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
    setFolders(list => list.map(f => (f.id === id ? { ...f, label } : f)))
  }, [])

  const handleFinish = useCallback(async () => {
    if (!canFinish) return
    setSubmitting(true)
    try {
      let projectId: string | undefined
      const repos: Record<string, unknown>[] = []
      if (repoChoice === 'git-mcp' && mcpUrl.trim()) {
        repos.push({ repoType: 'git-mcp', sourceType: 'mcp', repoUrl: mcpUrl.trim() })
      } else if (repoChoice === 'git-repo' && repoUrl.trim()) {
        repos.push({ repoType, sourceType: 'git', repoUrl: repoUrl.trim(), token: repoToken.trim() || undefined, branch: repoBranch.trim() || undefined })
      } else if (repoChoice === 'local' && folders.length === 0 && localPath.trim()) {
        // Only when editing a project that already had a path. Newly picked folders
        // become connectors after upload, below — the upload needs a projectId, so
        // it cannot happen before the project exists.
        //
        // `localPath` is the field code_analysis_agent reads; writing the path into
        // `repoUrl` meant local-folder projects always analysed as empty. Send both
        // so the edit path (which falls back to repoUrl) keeps working.
        repos.push({ repoType: 'local', sourceType: 'local',
                     localPath: localPath.trim(), repoUrl: localPath.trim() })
      }
      try {
        const res = await projectsApi.create({
          name: projectName.trim(),
          description: description.trim() || undefined,
          environment: 'development',
          repos,
        })
        projectId = res.data?.projectId
      } catch {
        // best-effort — chat works without a backend project
      }

      // Upload picked folders and register one connector each. Sequential, not
      // parallel: these are large multipart bodies and the progress ticks per
      // folder, which is the only feedback the user gets.
      let uploadedRoot = ''
      if (repoChoice === 'local' && folders.length > 0) {
        if (!projectId) {
          window.alert('Could not create the project, so the folders were not uploaded.')
        } else {
          for (const f of folders) {
            setFolders(list => list.map(x => (x.id === f.id ? { ...x, status: 'uploading' } : x)))
            try {
              const res = await uploadFolder({ projectId, label: f.label, files: f.files })
              uploadedRoot = res.projectPath
              await projectsApi.addConnector(projectId, {
                repoType: 'local', sourceType: 'local',
                localPath: res.localPath, repoUrl: res.localPath,
              })
              setFolders(list => list.map(x => (
                x.id === f.id ? { ...x, status: 'done', message: res.message } : x)))
            } catch (err) {
              const detail = describeApiError(err, 'Upload failed')
              setFolders(list => list.map(x => (
                x.id === f.id ? { ...x, status: 'error', message: detail } : x)))
              window.alert(`Folder "${f.label}" was not uploaded: ${detail}`)
            }
          }
        }
      }

      // A git project needs a server-side clone before anything can parse it —
      // code analysis walks the filesystem, so a repo URL alone yields nothing.
      let clonedOk = false
      if (repoChoice === 'git-repo' && repoUrl.trim() && projectId) {
        try {
          await cloneRepo({
            projectId, repoUrl: repoUrl.trim(),
            branch: repoBranch.trim() || 'main', token: repoToken.trim() || undefined,
          })
          clonedOk = true
        } catch (err) {
          window.alert(`Could not clone the repository: ${describeApiError(err, 'Clone failed')}`)
        }
      }

      // Kick off analysis, which is what writes the project into Neo4j. Deliberately
      // not awaited: it runs three agents including LLM calls and can take a minute,
      // and blocking the wizard on that would be worse than letting the graph fill
      // in behind it.
      if (projectId && (uploadedRoot || clonedOk)) {
        setAnalysing(true)
        projectsApi.analyse(projectId).catch(() => {})
      }

      let repo: WizardResult['repo']
      if (repoChoice === 'git-mcp' && mcpUrl.trim()) {
        repo = { type: 'git-mcp', url: mcpUrl.trim() }
      } else if (repoChoice === 'git-repo' && repoUrl.trim()) {
        repo = { type: 'git-repo', url: repoUrl.trim(), token: repoToken.trim() || undefined, branch: repoBranch.trim() || undefined }
      } else if (repoChoice === 'local' && (uploadedRoot || localPath.trim())) {
        repo = { type: 'local', url: uploadedRoot || localPath.trim() }
      }

      onComplete({
        projectName: projectName.trim(),
        projectId,
        repo,
        useKnowledgeGraph: useKnowledgeGraph === true && graphLoaded,
        sessionChoice: sessionChoice!,
        existingSessionId: selectedSessionId ?? undefined,
      })
    } finally {
      setSubmitting(false)
    }
  }, [
    canFinish, projectName, description, repoChoice, mcpUrl, repoUrl, repoType,
    repoToken, repoBranch, localPath, folders, useKnowledgeGraph, graphLoaded,
    sessionChoice, selectedSessionId, onComplete,
  ])

  // ── Timeline header ──────────────────────────────────────────────────────────
  const renderTimeline = () => (
    <div style={{ display: 'flex', alignItems: 'flex-start', padding: '20px 0 16px' }}>
      {STEPS.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', flex: i < STEPS.length - 1 ? 1 : 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              background: i < step
                ? '#10b981'
                : i === step
                  ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
                  : 'var(--color-surface)',
              border: `2px solid ${i < step ? '#10b981' : i === step ? 'transparent' : 'var(--color-border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: i <= step ? '#fff' : 'var(--color-muted)',
              boxShadow: i === step ? '0 0 10px rgba(124,58,237,0.4)' : 'none',
              transition: 'all 0.2s',
            }}>
              {i < step ? <Check size={13} /> : s.icon}
            </div>
            <span style={{
              fontSize: 10, fontWeight: i === step ? 700 : 500,
              color: i === step ? 'var(--color-text)' : 'var(--color-muted)',
              whiteSpace: 'nowrap',
            }}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div style={{
              flex: 1, height: 2, margin: '14px 6px 0',
              background: i < step ? '#10b981' : 'var(--color-border)',
              transition: 'background 0.3s',
            }} />
          )}
        </div>
      ))}
    </div>
  )

  // ── Step 0: Repository ───────────────────────────────────────────────────────
  const renderRepository = () => {
    const cards = [
      { id: 'git-mcp' as const, icon: <Globe size={18} />, label: 'Git MCP', desc: 'MCP server URL', color: '#a78bfa' },
      { id: 'git-repo' as const, icon: <GitBranch size={18} />, label: 'Git Repo', desc: 'GitHub / GitLab / etc.', color: '#10b981' },
      { id: 'local' as const, icon: <FolderOpen size={18} />, label: 'Local Folder', desc: 'Filesystem path', color: '#f59e0b' },
    ]
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 12, color: 'var(--color-subtext)' }}>
          Connect a code source for context —{' '}
          <span style={{ color: 'var(--color-muted)' }}>optional, you can skip this step.</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {cards.map(card => (
            <button
              key={card.id}
              type="button"
              onClick={() => setRepoChoice(repoChoice === card.id ? null : card.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '12px 8px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                background: repoChoice === card.id ? `${card.color}18` : 'var(--color-surface)',
                border: `2px solid ${repoChoice === card.id ? card.color : 'var(--color-border)'}`,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ color: card.color }}>{card.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>{card.label}</span>
              <span style={{ fontSize: 10, color: 'var(--color-muted)', lineHeight: 1.3 }}>{card.desc}</span>
            </button>
          ))}
        </div>

        {repoChoice === 'git-mcp' && (
          <div>
            <label style={labelStyle}>MCP Server URL</label>
            <input
              value={mcpUrl}
              onChange={e => setMcpUrl(e.target.value)}
              placeholder="http://localhost:3000"
              style={inputStyle}
              autoFocus
            />
          </div>
        )}

        {repoChoice === 'git-repo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Repo URL</label>
                <input value={repoUrl} onChange={e => setRepoUrl(e.target.value)} placeholder="https://github.com/org/repo" style={inputStyle} />
              </div>
              <div style={{ width: 120 }}>
                <label style={labelStyle}>Type</label>
                <select value={repoType} onChange={e => setRepoType(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {REPO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Access Token</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showToken ? 'text' : 'password'}
                  value={repoToken}
                  onChange={e => setRepoToken(e.target.value)}
                  placeholder={initialValues?.hasToken ? '••••••••  (leave blank to keep existing)' : 'ghp_... (optional, for private repos)'}
                  style={{ ...inputStyle, paddingRight: 38 }}
                />
                <button
                  type="button"
                  onClick={() => setShowToken(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', display: 'flex', padding: 0 }}
                >
                  {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Branch</label>
              {repoUrl.trim().startsWith('https://') && repoToken.trim() ? (
                <BranchPicker repoUrl={repoUrl.trim()} token={repoToken.trim()} value={repoBranch} onChange={setRepoBranch} />
              ) : (
                <input value={repoBranch} onChange={e => setRepoBranch(e.target.value)} placeholder="main" style={inputStyle} />
              )}
            </div>
          </div>
        )}

        {repoChoice === 'local' && (
          <div>
            <label style={labelStyle}>Local Folders</label>
            <input
              ref={folderInputRef}
              type="file"
              multiple
              webkitdirectory=""
              directory=""
              style={{ display: 'none' }}
              onChange={e => {
                if (e.target.files?.length) handlePickFolder(e.target.files)
                e.target.value = ''   // re-picking the same folder must fire onChange again
              }}
            />

            {folders.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                {folders.map(f => (
                  <div key={f.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    borderRadius: 6, fontSize: 12,
                  }}>
                    <FolderOpen size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
                    <input
                      value={f.label}
                      onChange={e => renameFolder(f.id, e.target.value)}
                      disabled={f.status === 'uploading' || f.status === 'done'}
                      style={{
                        background: 'transparent', border: 'none', outline: 'none',
                        color: 'var(--color-text)', fontWeight: 600, fontSize: 12,
                        width: 110, padding: 0,
                      }}
                    />
                    <span style={{ color: 'var(--color-subtext)', flex: 1 }}>
                      {f.files.length} files · {humanBytes(f.bytes)}
                      {f.skipped > 0 && ` · ${f.skipped} skipped`}
                    </span>
                    {f.status === 'uploading' && <Loader2 size={13} className="animate-spin" style={{ color: '#818cf8' }} />}
                    {f.status === 'done' && <Check size={13} style={{ color: '#10b981' }} />}
                    {f.status === 'error' && (
                      <span title={f.message} style={{ color: '#ef4444', fontSize: 11 }}>failed</span>
                    )}
                    {f.status === 'ready' && (
                      <button
                        type="button"
                        onClick={() => setFolders(list => list.filter(x => x.id !== f.id))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', display: 'flex', padding: 0 }}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, width: '100%',
                justifyContent: 'center', padding: '10px 12px',
                background: 'none', border: '1px dashed var(--color-border)',
                borderRadius: 6, color: 'var(--color-subtext)', fontSize: 12,
                cursor: 'pointer',
              }}
            >
              <Plus size={14} />
              {folders.length === 0 ? 'Browse for a folder…' : 'Add another folder'}
            </button>

            <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 7, lineHeight: 1.5 }}>
              Add each part of the project separately — e.g. <strong>backend</strong> and{' '}
              <strong>frontend</strong>. Dependency and build directories (node_modules,
              dist, .venv) are skipped automatically. The folder is uploaded to the
              server on Finish, since a browser cannot give the server a path on your machine.
            </div>

            {localPath && folders.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--color-subtext)', marginTop: 7 }}>
                Currently using <code>{localPath}</code> — add a folder above to replace it.
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Step 1: Knowledge Graph ──────────────────────────────────────────────────
  const renderKnowledgeGraph = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 12, color: 'var(--color-subtext)' }}>
        Load the ontology graph as chat context —{' '}
        <span style={{ color: 'var(--color-muted)' }}>optional, you can skip this step.</span>
      </div>

      <div>
        <label style={labelStyle}>Project Name (for graph lookup)</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={graphProjectName || projectName}
            onChange={e => {
              setGraphProjectName(e.target.value)
              setGraphNameManuallySet(true)
              setGraphLoaded(false)
              setUseKnowledgeGraph(null)
            }}
            placeholder={projectName || 'e.g. payment-service'}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            type="button"
            onClick={handleLoadGraph}
            disabled={isLoadingGraph || !(graphProjectName.trim() || projectName.trim())}
            style={{
              padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'var(--color-primary)', color: '#fff', border: 'none',
              cursor: isLoadingGraph ? 'not-allowed' : 'pointer',
              opacity: isLoadingGraph ? 0.7 : 1,
              display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            {isLoadingGraph && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
            Load Graph
          </button>
        </div>
      </div>

      {graphLoaded && ontologyNodes.length === 0 && (
        <div style={{
          borderRadius: 10, padding: '14px 16px', textAlign: 'center',
          background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
            No graph data found
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 12 }}>
            No knowledge graph data exists for &quot;{graphProjectName || projectName}&quot;. You can skip this step.
          </div>
          <button
            type="button"
            onClick={() => setUseKnowledgeGraph(false)}
            style={{
              padding: '7px 20px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              color: 'var(--color-text)', cursor: 'pointer',
            }}
          >
            Skip
          </button>
        </div>
      )}

      {graphLoaded && ontologyNodes.length > 0 && (
        <div style={{
          borderRadius: 10, padding: '14px 16px',
          background: 'linear-gradient(135deg, rgba(96,165,250,0.08), rgba(167,139,250,0.08))',
          border: '1px solid rgba(96,165,250,0.25)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
                ✦ Graph loaded
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-subtext)', marginTop: 2 }}>
                {ontologyNodes.length} nodes · {ontologyLinks.length} links
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowGraphModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)',
                color: '#60a5fa', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              View Graph
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setUseKnowledgeGraph(true)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
                background: useKnowledgeGraph === true
                  ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
                  : 'rgba(79,70,229,0.1)',
                border: `1px solid ${useKnowledgeGraph === true ? 'transparent' : 'rgba(79,70,229,0.3)'}`,
                color: useKnowledgeGraph === true ? '#fff' : '#a5b4fc', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              ✦ Use as Context
            </button>
            <button
              type="button"
              onClick={() => setUseKnowledgeGraph(false)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: useKnowledgeGraph === false ? 'var(--color-surface)' : 'none',
                border: `1px solid ${useKnowledgeGraph === false ? 'var(--color-subtext)' : 'var(--color-border)'}`,
                color: useKnowledgeGraph === false ? 'var(--color-text)' : 'var(--color-subtext)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  )

  // ── Step 2: Session ──────────────────────────────────────────────────────────
  const renderSession = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 12, color: 'var(--color-subtext)' }}>
        Start a new conversation or continue from a past session.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button
          type="button"
          onClick={() => { setSessionChoice('new'); setSessions([]) }}
          style={{
            padding: '16px 14px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
            background: sessionChoice === 'new' ? 'rgba(79,70,229,0.1)' : 'var(--color-surface)',
            border: `2px solid ${sessionChoice === 'new' ? 'var(--color-primary)' : 'var(--color-border)'}`,
            transition: 'all 0.15s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <Plus size={15} style={{ color: sessionChoice === 'new' ? 'var(--color-primary)' : 'var(--color-muted)' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>New Chat</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-muted)', lineHeight: 1.4 }}>
            Start a fresh conversation
          </div>
        </button>

        <button
          type="button"
          onClick={handleLoadHistory}
          style={{
            padding: '16px 14px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
            background: sessionChoice === 'history' ? 'rgba(16,185,129,0.08)' : 'var(--color-surface)',
            border: `2px solid ${sessionChoice === 'history' ? '#10b981' : 'var(--color-border)'}`,
            transition: 'all 0.15s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <Clock size={15} style={{ color: sessionChoice === 'history' ? '#10b981' : 'var(--color-muted)' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>Load History</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-muted)', lineHeight: 1.4 }}>
            Resume an existing session
          </div>
        </button>
      </div>

      {sessionChoice === 'history' && (
        <div style={{
          maxHeight: 200, overflowY: 'auto', borderRadius: 10,
          border: '1px solid var(--color-border)', background: 'var(--color-surface)',
        }}>
          {loadingSessions ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, color: 'var(--color-muted)', fontSize: 12 }}>
              <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Loading sessions…
            </div>
          ) : sessions.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-muted)', fontSize: 12 }}>
              No past sessions found
            </div>
          ) : (
            sessions.map((s, idx) => (
              <button
                key={s.sessionId}
                type="button"
                onClick={() => setSelectedSessionId(s.sessionId)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', textAlign: 'left',
                  background: selectedSessionId === s.sessionId ? 'rgba(16,185,129,0.08)' : 'none',
                  border: 'none', borderBottom: idx < sessions.length - 1 ? '1px solid var(--color-border)' : 'none',
                  borderLeft: `3px solid ${selectedSessionId === s.sessionId ? '#10b981' : 'transparent'}`,
                  cursor: 'pointer', transition: 'all 0.1s',
                } as React.CSSProperties}
              >
                <MessageSquare size={13} style={{ color: selectedSessionId === s.sessionId ? '#10b981' : 'var(--color-muted)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.sessionName || s.projectName}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--color-muted)', marginTop: 1 }}>
                    {s.messageCount} msg · {new Date(s.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                {selectedSessionId === s.sessionId && <Check size={13} style={{ color: '#10b981', flexShrink: 0 }} />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      {showGraphModal && (
        <ProjectGraphModal
          isOpen={showGraphModal}
          onClose={() => setShowGraphModal(false)}
          projectName={graphNameManuallySet ? graphProjectName : projectName}
          nodes={ontologyNodes as any[]}
          links={ontologyLinks as any[]}
        />
      )}

      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <div style={{
          background: 'var(--color-card)', border: '1px solid var(--color-border)',
          borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 620,
          boxShadow: 'var(--shadow-md)', maxHeight: '90vh', overflowY: 'auto',
        }}>
          {/* Modal header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: 'linear-gradient(135deg, #312e81, #4f46e5, #7c3aed)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 14px rgba(124,58,237,0.35)',
              }}>
                <Plus size={17} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Create Dev Session</div>
                <div style={{ fontSize: 11, color: 'var(--color-subtext)' }}>Configure your project workspace</div>
              </div>
            </div>
            <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: 4 }}>
              <X size={16} />
            </button>
          </div>

          {/* Project name + description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 4 }}>
            <div ref={nameInputRef} style={{ position: 'relative' }}>
              <label style={labelStyle}>Project Name *</label>
              <div style={{ position: 'relative' }}>
                <input
                  value={projectName}
                  onChange={e => {
                    setProjectName(e.target.value)
                    if (!graphNameManuallySet) setGraphProjectName(e.target.value)
                  }}
                  onFocus={() => { if (nameResults.length > 0) setShowNameDropdown(true) }}
                  placeholder="e.g. payment-service"
                  style={{ ...inputStyle, paddingRight: isSearchingName ? 32 : 12 }}
                  autoFocus
                  autoComplete="off"
                />
                {isSearchingName && (
                  <Loader2 size={13} style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--color-muted)', animation: 'spin 1s linear infinite',
                  }} />
                )}
              </div>
              {showNameDropdown && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  background: 'var(--color-card)', border: '1px solid var(--color-border)',
                  borderRadius: 10, marginTop: 4, overflow: 'hidden',
                  boxShadow: 'var(--shadow-md)',
                }}>
                  {nameResults.map(p => (
                    <button
                      key={p.projectId}
                      type="button"
                      onMouseDown={e => {
                        e.preventDefault()
                        setProjectName(p.name)
                        if (!graphNameManuallySet) setGraphProjectName(p.name)
                        if (p.description) setDescription(p.description)
                        setShowNameDropdown(false)
                      }}
                      style={{
                        width: '100%', display: 'flex', flexDirection: 'column', gap: 2,
                        padding: '9px 12px', textAlign: 'left', background: 'none',
                        border: 'none', borderBottom: '1px solid var(--color-border)',
                        cursor: 'pointer', transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>{p.name}</span>
                      {p.description && (
                        <span style={{ fontSize: 11, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.description}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label style={labelStyle}>Description <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--color-muted)' }}>(optional)</span></label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief description of this project"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Timeline */}
          {renderTimeline()}

          {/* Step content */}
          <div style={{ minHeight: 180 }}>
            {step === 0 && renderRepository()}
            {step === 1 && renderKnowledgeGraph()}
            {step === 2 && renderSession()}
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 }}>
            <div>
              {step > 0 && (
                <button
                  type="button"
                  onClick={goBack}
                  style={{
                    padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    color: 'var(--color-text)', cursor: 'pointer',
                  }}
                >
                  ← Back
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {step < 2 ? (
                <>
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!canProceed}
                    style={{
                      padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                      background: 'none', border: '1px solid var(--color-border)',
                      color: 'var(--color-subtext)', cursor: canProceed ? 'pointer' : 'not-allowed',
                      opacity: canProceed ? 1 : 0.5,
                    }}
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!canProceed}
                    style={{
                      padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                      background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff',
                      border: 'none', cursor: canProceed ? 'pointer' : 'not-allowed',
                      opacity: canProceed ? 1 : 0.6,
                    }}
                  >
                    Next →
                  </button>
                </>
              ) : (
                <>
                {analysing && (
                  <span style={{ fontSize: 11.5, color: 'var(--color-subtext)', marginRight: 10 }}>
                    Analysing code — the knowledge graph fills in shortly
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={!canFinish || submitting}
                  style={{
                    padding: '9px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                    background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff',
                    border: 'none', cursor: canFinish && !submitting ? 'pointer' : 'not-allowed',
                    opacity: canFinish && !submitting ? 1 : 0.6,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {submitting && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                  {submitting ? 'Starting…' : 'Start →'}
                </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </>
  )
}
