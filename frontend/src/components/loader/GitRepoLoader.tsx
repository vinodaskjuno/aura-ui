import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGraphTheme } from '../../hooks/useGraphTheme'
import { projectsApi, type Project } from '../../api/projects'
import {
  listServices, createService, deleteService,
  addRepo, removeRepo, ingestService, ingestAll, pollIngestStatus,
  type ServiceRecord, type RepoAttachment, type RepoType,
  REPO_TYPE_LABELS, REPO_TYPE_ICONS,
} from '../../api/repoLoader'
import { useWorkspaceStore } from '../../store/workspaceStore'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AddRepoForm {
  repoUrl: string
  repoType: RepoType
  token: string
  branch: string
  name: string
}

const EMPTY_REPO_FORM: AddRepoForm = {
  repoUrl: '', repoType: 'auto', token: '', branch: 'main', name: '',
}

const REPO_TYPES: RepoType[] = [
  'auto', 'mule', 'spring', 'python', 'ui-react', 'ui-angular',
  'terraform', 'cicd', 'config', 'library',
]

const TECH_COLORS: Record<string, string> = {
  'Mule 4': '#00A1DF', 'Mule': '#00A1DF',
  'Java': '#ED8B00', 'Spring Boot': '#6DB33F', 'Maven': '#C71A36',
  'Python': '#3776AB', 'FastAPI': '#009688', 'Django': '#092E20',
  'React': '#61DAFB', 'TypeScript': '#3178C6', 'Angular': '#DD0031',
  'Terraform': '#7B42BC', 'AWS': '#FF9900', 'Azure': '#0089D6', 'GCP': '#4285F4',
  'Kubernetes': '#326CE5', 'Docker': '#2496ED', 'Jenkins': '#D33833',
  'Kafka': '#231F20', 'PostgreSQL': '#336791', 'MySQL': '#4479A1',
  'MongoDB': '#47A248', 'Redis': '#DC382D', 'RAML': '#5BA4CF',
  'OpenAPI': '#85EA2D', 'GitHub Actions': '#2088FF', 'Helm': '#0F1689',
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function GitRepoLoader() {
  const gt = useGraphTheme()
  const navigate = useNavigate()
  const setWorkspaceNode = useWorkspaceStore(s => s.setSelectedNode)

  // Step state
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Project
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [newProjectName, setNewProjectName] = useState('')
  const [creatingProject, setCreatingProject] = useState(false)

  // Services
  const [services, setServices] = useState<ServiceRecord[]>([])
  const [loadingServices, setLoadingServices] = useState(false)
  const [newServiceName, setNewServiceName] = useState('')
  const [addingService, setAddingService] = useState(false)

  // Per-service repo form
  const [repoForms, setRepoForms] = useState<Record<string, AddRepoForm>>({})
  const [showRepoForm, setShowRepoForm] = useState<string | null>(null)
  const [showToken, setShowToken] = useState<Record<string, boolean>>({})
  const [savingRepo, setSavingRepo] = useState<string | null>(null)

  // Ingest
  const [ingestJobs, setIngestJobs] = useState<Record<string, { jobId: string; status: string; log: string[]; result: any }>>({})
  const [ingestingAll, setIngestingAll] = useState(false)
  const [globalJobId, setGlobalJobId] = useState('')
  const pollRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  // ── Load projects ───────────────────────────────────────────────────────────
  useEffect(() => {
    projectsApi.list().then(r => setProjects(r.data || [])).catch(() => {})
  }, [])

  // ── Load services when project selected ─────────────────────────────────────
  const loadServices = useCallback(async (projectId: string) => {
    setLoadingServices(true)
    try {
      const svcs = await listServices(projectId)
      setServices(svcs)
    } catch { setServices([]) }
    finally { setLoadingServices(false) }
  }, [])

  const selectProject = (p: Project) => {
    setSelectedProject(p)
    loadServices(p.projectId)
    setStep(2)
  }

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return
    setCreatingProject(true)
    try {
      const res = await projectsApi.create({ name: newProjectName.trim(), description: '', environment: 'production' })
      const proj = res.data
      setProjects(prev => [proj, ...prev])
      setNewProjectName('')
      selectProject(proj)
    } catch { setError('Failed to create project') }
    finally { setCreatingProject(false) }
  }

  // ── Service management ──────────────────────────────────────────────────────
  const handleAddService = async () => {
    if (!newServiceName.trim() || !selectedProject) return
    setAddingService(true)
    try {
      const svc = await createService(selectedProject.projectId, { name: newServiceName.trim() })
      setServices(prev => [svc, ...prev])
      setNewServiceName('')
    } catch { setError('Failed to create service') }
    finally { setAddingService(false) }
  }

  const handleDeleteService = async (svc: ServiceRecord) => {
    if (!selectedProject) return
    try {
      await deleteService(selectedProject.projectId, svc.serviceId)
      setServices(prev => prev.filter(s => s.serviceId !== svc.serviceId))
    } catch { setError('Failed to delete service') }
  }

  // ── Repo management ─────────────────────────────────────────────────────────
  const getRepoForm = (serviceId: string) =>
    repoForms[serviceId] || { ...EMPTY_REPO_FORM }

  const updateRepoForm = (serviceId: string, patch: Partial<AddRepoForm>) =>
    setRepoForms(prev => ({ ...prev, [serviceId]: { ...getRepoForm(serviceId), ...patch } }))

  const handleAddRepo = async (svc: ServiceRecord) => {
    if (!selectedProject) return
    const form = getRepoForm(svc.serviceId)
    if (!form.repoUrl.trim()) return setError('Enter a repository URL')
    setSavingRepo(svc.serviceId)
    try {
      const repo = await addRepo(selectedProject.projectId, svc.serviceId, {
        repoUrl: form.repoUrl.trim(),
        repoType: form.repoType,
        token: form.token,
        branch: form.branch || 'main',
        name: form.name || form.repoUrl.split('/').pop() || '',
      })
      setServices(prev => prev.map(s =>
        s.serviceId === svc.serviceId
          ? { ...s, repos: [...(s.repos || []), repo], repoCount: (s.repoCount || 0) + 1 }
          : s
      ))
      setRepoForms(prev => ({ ...prev, [svc.serviceId]: { ...EMPTY_REPO_FORM } }))
      setShowRepoForm(null)
    } catch { setError('Failed to attach repo') }
    finally { setSavingRepo(null) }
  }

  const handleRemoveRepo = async (svc: ServiceRecord, repo: RepoAttachment) => {
    if (!selectedProject) return
    try {
      await removeRepo(selectedProject.projectId, svc.serviceId, repo.repoId)
      setServices(prev => prev.map(s =>
        s.serviceId === svc.serviceId
          ? { ...s, repos: s.repos.filter(r => r.repoId !== repo.repoId), repoCount: Math.max(0, s.repoCount - 1) }
          : s
      ))
    } catch { setError('Failed to remove repo') }
  }

  // ── Ingestion ───────────────────────────────────────────────────────────────
  const startPolling = (serviceId: string, jobId: string, projectId: string) => {
    if (pollRefs.current[serviceId]) clearInterval(pollRefs.current[serviceId])
    pollRefs.current[serviceId] = setInterval(async () => {
      try {
        const job = await pollIngestStatus(projectId, serviceId, jobId)
        setIngestJobs(prev => ({
          ...prev,
          [serviceId]: { jobId, status: job.status, log: job.log || [], result: job.result },
        }))
        if (job.status === 'done' || job.status === 'failed') {
          clearInterval(pollRefs.current[serviceId])
          if (job.status === 'done') {
            setServices(prev => prev.map(s =>
              s.serviceId === serviceId
                ? { ...s, status: 'ingested', description: job.result?.description || s.description,
                    techStack: job.result?.tech_stack || s.techStack,
                    ontologyStats: job.result || s.ontologyStats }
                : s
            ))
          }
        }
      } catch { clearInterval(pollRefs.current[serviceId]) }
    }, 2500)
  }

  const handleIngest = async (svc: ServiceRecord) => {
    if (!selectedProject) return
    setIngestJobs(prev => ({ ...prev, [svc.serviceId]: { jobId: '', status: 'running', log: ['Starting...'], result: null } }))
    try {
      const { jobId } = await ingestService(selectedProject.projectId, svc.serviceId)
      setIngestJobs(prev => ({ ...prev, [svc.serviceId]: { jobId, status: 'running', log: ['Cloning repos...'], result: null } }))
      startPolling(svc.serviceId, jobId, selectedProject.projectId)
    } catch (e: any) {
      setIngestJobs(prev => ({ ...prev, [svc.serviceId]: { jobId: '', status: 'failed', log: [String(e)], result: null } }))
    }
  }

  const handleIngestAll = async () => {
    if (!selectedProject) return
    setIngestingAll(true)
    try {
      const { jobId } = await ingestAll(selectedProject.projectId)
      setGlobalJobId(jobId)
      // Trigger polling for each service
      services.forEach(svc => {
        startPolling(svc.serviceId, jobId, selectedProject.projectId)
        setIngestJobs(prev => ({ ...prev, [svc.serviceId]: { jobId, status: 'running', log: ['Queued...'], result: null } }))
      })
      setStep(3)
    } catch (e: any) { setError(String(e)) }
    finally { setIngestingAll(false) }
  }

  useEffect(() => () => { Object.values(pollRefs.current).forEach(clearInterval) }, [])

  // ── Styles ──────────────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: gt.panelCard, border: `1px solid ${gt.panelCardBorder}`,
    borderRadius: 12, padding: 16, marginBottom: 12,
  }
  const inp: React.CSSProperties = {
    background: gt.inputBg, border: `1px solid ${gt.inputBorder}`,
    borderRadius: 8, padding: '8px 12px', color: gt.inputText,
    fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
  }
  const btn = (variant: 'primary' | 'ghost' | 'danger' | 'green'): React.CSSProperties => ({
    padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
    fontSize: 12, fontWeight: 700, border: 'none',
    background: variant === 'primary' ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
      : variant === 'green' ? 'linear-gradient(135deg, #16a34a, #15803d)'
      : variant === 'danger' ? 'transparent'
      : gt.accentBg,
    color: variant === 'primary' || variant === 'green' ? '#fff'
      : variant === 'danger' ? '#ef4444'
      : gt.accent,
    border: variant === 'ghost' ? `1px solid ${gt.accentBorder}` : 'none',
  })

  // ── Render steps ─────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '0 0 40px 0' }}>
      {/* Step indicator */}
      <StepIndicator step={step} gt={gt} />

      {/* Toasts */}
      {error && (
        <div style={{ background: '#7f1d1d', border: '1px solid #ef4444', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#fca5a5' }}>
          {error} <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', float: 'right' }}>✕</button>
        </div>
      )}

      {/* ── STEP 1: Project ── */}
      {step === 1 && (
        <div>
          <h3 style={{ color: gt.panelText, fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Select or Create a Project</h3>

          {/* New project inline */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <input
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
              placeholder="New project name..."
              style={inp}
            />
            <button onClick={handleCreateProject} disabled={creatingProject || !newProjectName.trim()} style={btn('primary')}>
              {creatingProject ? '…' : '+ Create'}
            </button>
          </div>

          {/* Existing projects */}
          {projects.length === 0 && (
            <div style={{ color: gt.panelSubtext, fontSize: 13, textAlign: 'center', padding: 20 }}>
              No projects yet — create one above.
            </div>
          )}
          {projects.map(p => (
            <div
              key={p.projectId}
              onClick={() => selectProject(p)}
              style={{
                ...card, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                border: `1px solid ${selectedProject?.projectId === p.projectId ? gt.accent : gt.panelCardBorder}`,
                transition: 'border-color 0.15s',
              }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 8, background: gt.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📁</div>
              <div style={{ flex: 1 }}>
                <div style={{ color: gt.panelText, fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                <div style={{ color: gt.panelSubtext, fontSize: 11 }}>
                  {p.environment} · Created {new Date(p.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div style={{ color: gt.accent, fontSize: 12, fontWeight: 600 }}>Select →</div>
            </div>
          ))}
        </div>
      )}

      {/* ── STEP 2: Services + Repos ── */}
      {step === 2 && selectedProject && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ color: gt.panelText, fontSize: 15, fontWeight: 700, margin: 0 }}>
                Define Services — <span style={{ color: gt.accent }}>{selectedProject.name}</span>
              </h3>
              <div style={{ color: gt.panelSubtext, fontSize: 11, marginTop: 2 }}>
                Each service can have multiple repos (Mule API + Config + Terraform = 1 service)
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep(1)} style={btn('ghost')}>← Back</button>
              {services.some(s => (s.repos?.length || 0) > 0) && (
                <button
                  onClick={() => { handleIngestAll(); }}
                  disabled={ingestingAll}
                  style={btn('green')}
                >
                  {ingestingAll ? '⏳ Starting…' : '▶ Ingest All Services'}
                </button>
              )}
            </div>
          </div>

          {/* Add service */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              value={newServiceName}
              onChange={e => setNewServiceName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddService()}
              placeholder="New service name (e.g. Payment API)..."
              style={inp}
            />
            <button onClick={handleAddService} disabled={addingService || !newServiceName.trim()} style={btn('primary')}>
              {addingService ? '…' : '+ Add Service'}
            </button>
          </div>

          {loadingServices && <div style={{ color: gt.panelSubtext, fontSize: 12, padding: 12 }}>Loading services…</div>}

          {services.map(svc => (
            <ServiceCard
              key={svc.serviceId}
              svc={svc}
              gt={gt}
              card={card}
              inp={inp}
              btn={btn}
              repoForm={getRepoForm(svc.serviceId)}
              updateRepoForm={patch => updateRepoForm(svc.serviceId, patch)}
              showRepoForm={showRepoForm === svc.serviceId}
              setShowRepoForm={v => setShowRepoForm(v ? svc.serviceId : null)}
              showToken={showToken[svc.serviceId] || false}
              setShowToken={v => setShowToken(prev => ({ ...prev, [svc.serviceId]: v }))}
              savingRepo={savingRepo === svc.serviceId}
              onAddRepo={() => handleAddRepo(svc)}
              onRemoveRepo={repo => handleRemoveRepo(svc, repo)}
              onIngest={() => handleIngest(svc)}
              onDelete={() => handleDeleteService(svc)}
              job={ingestJobs[svc.serviceId]}
              onViewInWorkspace={(node: any) => { setWorkspaceNode(node); navigate('/workspace') }}
              onViewInOntology={() => navigate(`/ontology?focusService=${svc.serviceId}`)}
            />
          ))}

          {services.length === 0 && !loadingServices && (
            <div style={{ color: gt.panelSubtext, fontSize: 13, textAlign: 'center', padding: 32 }}>
              Add a service above, then attach its repositories.
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: Results ── */}
      {step === 3 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <button onClick={() => setStep(2)} style={btn('ghost')}>← Back</button>
            <h3 style={{ color: gt.panelText, fontSize: 15, fontWeight: 700, margin: 0 }}>
              Ingestion Results — {selectedProject?.name}
            </h3>
          </div>
          {services.map(svc => (
            <ServiceResultCard
              key={svc.serviceId}
              svc={svc}
              gt={gt}
              card={card}
              btn={btn}
              job={ingestJobs[svc.serviceId]}
              onViewInWorkspace={(node: any) => { setWorkspaceNode(node); navigate('/workspace') }}
              onViewInOntology={() => navigate(`/ontology?focusService=${svc.serviceId}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ step, gt }: { step: number; gt: any }) {
  const steps = ['Select Project', 'Define Services', 'Results']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 24 }}>
      {steps.map((label, i) => {
        const idx = i + 1
        const active = step === idx
        const done = step > idx
        return (
          <React.Fragment key={idx}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? '#16a34a' : active ? '#4f46e5' : gt.panelCard,
                border: `2px solid ${done ? '#16a34a' : active ? '#4f46e5' : gt.panelCardBorder}`,
                color: done || active ? '#fff' : gt.panelSubtext,
              }}>
                {done ? '✓' : idx}
              </div>
              <div style={{ fontSize: 10, color: active ? gt.accent : gt.panelSubtext, fontWeight: active ? 700 : 400 }}>
                {label}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, margin: '0 8px 16px 8px', background: step > idx ? '#16a34a' : gt.panelCardBorder }} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ── Service Card (Step 2) ─────────────────────────────────────────────────────

interface ServiceCardProps {
  svc: ServiceRecord
  gt: any; card: any; inp: any
  btn: (v: 'primary' | 'ghost' | 'danger' | 'green') => React.CSSProperties
  repoForm: AddRepoForm
  updateRepoForm: (patch: Partial<AddRepoForm>) => void
  showRepoForm: boolean; setShowRepoForm: (v: boolean) => void
  showToken: boolean; setShowToken: (v: boolean) => void
  savingRepo: boolean
  onAddRepo: () => void; onRemoveRepo: (r: RepoAttachment) => void
  onIngest: () => void; onDelete: () => void
  job?: { status: string; log: string[]; result: any }
  onViewInWorkspace: (node: any) => void
  onViewInOntology: () => void
}

function ServiceCard({
  svc, gt, card, inp, btn, repoForm, updateRepoForm,
  showRepoForm, setShowRepoForm, showToken, setShowToken,
  savingRepo, onAddRepo, onRemoveRepo, onIngest, onDelete,
  job, onViewInWorkspace, onViewInOntology,
}: ServiceCardProps) {
  const jobRunning = job?.status === 'running'
  const jobDone    = job?.status === 'done'
  const jobFailed  = job?.status === 'failed'

  return (
    <div style={{ ...card, marginBottom: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', marginTop: 5, flexShrink: 0,
          background: jobDone ? '#22c55e' : jobFailed ? '#ef4444' : jobRunning ? '#f59e0b' : '#6b7280' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: gt.panelText, fontWeight: 700, fontSize: 14 }}>{svc.name}</div>
          {svc.description && (
            <div style={{ color: gt.panelSubtext, fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
              {svc.description}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={() => setShowRepoForm(!showRepoForm)} style={btn('ghost')}>
            + Add Repo
          </button>
          <button
            onClick={onIngest}
            disabled={!svc.repos?.length || jobRunning}
            style={btn('primary')}
          >
            {jobRunning ? '⏳ Analyzing…' : '▶ Ingest'}
          </button>
          <button onClick={onDelete} style={{ ...btn('danger'), fontSize: 14, padding: '4px 8px' }}>✕</button>
        </div>
      </div>

      {/* Tech stack badges */}
      {svc.techStack && svc.techStack.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {svc.techStack.map(t => (
            <TechBadge key={t} tech={t} />
          ))}
        </div>
      )}

      {/* Repos list */}
      {svc.repos && svc.repos.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {svc.repos.map(repo => (
            <div
              key={repo.repoId}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                background: gt.panelBg, borderRadius: 6, marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 13 }}>{REPO_TYPE_ICONS[repo.repoType] || '📁'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: gt.panelText, fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {repo.name || repo.repoUrl}
                </div>
                <div style={{ color: gt.panelSubtext, fontSize: 10 }}>
                  {REPO_TYPE_LABELS[repo.repoType]} · {repo.branch}
                  {repo.repoUrl && ` · ${repo.repoUrl.replace('https://github.com/', '').replace('https://', '')}`}
                </div>
              </div>
              <button onClick={() => onRemoveRepo(repo)}
                style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 13 }}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add repo form */}
      {showRepoForm && (
        <div style={{ background: gt.panelBg, borderRadius: 8, padding: 12, marginBottom: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 8 }}>
            <input
              value={repoForm.repoUrl}
              onChange={e => updateRepoForm({ repoUrl: e.target.value })}
              placeholder="https://github.com/org/repo"
              style={inp}
            />
            <select
              value={repoForm.repoType}
              onChange={e => updateRepoForm({ repoType: e.target.value as RepoType })}
              style={{ ...inp, width: 'auto' }}
            >
              {REPO_TYPES.map(t => (
                <option key={t} value={t}>{REPO_TYPE_ICONS[t]} {REPO_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 8 }}>
            <input
              value={repoForm.branch}
              onChange={e => updateRepoForm({ branch: e.target.value })}
              placeholder="Branch (main)"
              style={inp}
            />
            <div style={{ position: 'relative' }}>
              <input
                type={showToken ? 'text' : 'password'}
                value={repoForm.token}
                onChange={e => updateRepoForm({ token: e.target.value })}
                placeholder="PAT token (optional)"
                style={inp}
              />
              <button
                onClick={() => setShowToken(!showToken)}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: gt.panelSubtext, fontSize: 11 }}
              >{showToken ? '🙈' : '👁'}</button>
            </div>
            <input
              value={repoForm.name}
              onChange={e => updateRepoForm({ name: e.target.value })}
              placeholder="Display name (optional)"
              style={inp}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onAddRepo} disabled={savingRepo || !repoForm.repoUrl.trim()} style={btn('primary')}>
              {savingRepo ? '…' : '+ Attach Repo'}
            </button>
            <button onClick={() => setShowRepoForm(false)} style={btn('ghost')}>Cancel</button>
          </div>
        </div>
      )}

      {/* Ingest log */}
      {job && (
        <IngestLog job={job} gt={gt} />
      )}

      {/* Post-ingest actions */}
      {jobDone && job?.result && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={onViewInOntology} style={btn('ghost')}>
            🕸 View in Ontology Graph
          </button>
          <button
            onClick={() => onViewInWorkspace({ id: svc.serviceId, label: svc.name, node_type: 'Service', properties: { name: svc.name, description: svc.description } })}
            style={btn('primary')}
          >
            ⊞ View in Workspace
          </button>
        </div>
      )}
    </div>
  )
}

// ── Service Result Card (Step 3) ──────────────────────────────────────────────

function ServiceResultCard({ svc, gt, card, btn, job, onViewInWorkspace, onViewInOntology }: {
  svc: ServiceRecord; gt: any; card: any; btn: any
  job?: { status: string; log: string[]; result: any }
  onViewInWorkspace: (node: any) => void; onViewInOntology: () => void
}) {
  const stats = job?.result || svc.ontologyStats || {}
  const done = job?.status === 'done' || svc.status === 'ingested'
  const failed = job?.status === 'failed'
  const running = job?.status === 'running'

  return (
    <div style={{ ...card, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
          background: done ? '#22c55e' : failed ? '#ef4444' : running ? '#f59e0b' : '#6b7280' }} />
        <div style={{ flex: 1 }}>
          <div style={{ color: gt.panelText, fontWeight: 700, fontSize: 14 }}>{svc.name}</div>
        </div>
        <div style={{ fontSize: 11, color: gt.panelSubtext }}>
          {done ? '✓ Ingested' : failed ? '✗ Failed' : running ? '⏳ Running…' : '⏸ Pending'}
        </div>
      </div>

      {/* LLM Description */}
      {svc.description && (
        <div style={{
          background: gt.accentBg, border: `1px solid ${gt.accentBorder}`,
          borderRadius: 8, padding: '10px 12px', marginBottom: 10,
          color: gt.panelText, fontSize: 13, lineHeight: 1.6, fontStyle: 'italic',
        }}>
          "{svc.description}"
        </div>
      )}

      {/* Tech stack */}
      {svc.techStack && svc.techStack.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
          {svc.techStack.map(t => <TechBadge key={t} tech={t} />)}
        </div>
      )}

      {/* Stats grid */}
      {(stats.apis_count !== undefined || stats.nodes_added !== undefined) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
          <StatPill label="APIs Exposed" value={stats.apis_count ?? 0} color="#4f46e5" gt={gt} />
          <StatPill label="Databases" value={stats.databases_count ?? 0} color="#0891b2" gt={gt} />
          <StatPill label="Dependencies" value={stats.dependencies_count ?? 0} color="#7c3aed" gt={gt} />
          <StatPill label="Nodes Added" value={stats.nodes_added ?? 0} color="#16a34a" gt={gt} />
          <StatPill label="Relationships" value={stats.rels_added ?? 0} color="#d97706" gt={gt} />
          <StatPill label="Repos" value={svc.repoCount || 0} color="#6b7280" gt={gt} />
        </div>
      )}

      {/* Log */}
      {job && <IngestLog job={job} gt={gt} collapsed />}

      {/* Actions */}
      {done && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onViewInOntology} style={btn('ghost')}>🕸 Ontology Graph</button>
          <button
            onClick={() => onViewInWorkspace({ id: svc.serviceId, label: svc.name, node_type: 'Service', properties: { name: svc.name, description: svc.description } })}
            style={btn('primary')}
          >⊞ Open in Workspace</button>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TechBadge({ tech }: { tech: string }) {
  const color = TECH_COLORS[tech] || '#6b7280'
  return (
    <span style={{
      background: color + '22', border: `1px solid ${color}55`,
      borderRadius: 5, padding: '2px 7px', fontSize: 10,
      color, fontWeight: 700, letterSpacing: '0.3px',
    }}>
      {tech}
    </span>
  )
}

function StatPill({ label, value, color, gt }: { label: string; value: number; color: string; gt: any }) {
  return (
    <div style={{
      background: gt.panelBg, border: `1px solid ${color}44`,
      borderRadius: 8, padding: '8px 10px', textAlign: 'center',
    }}>
      <div style={{ color, fontSize: 18, fontWeight: 800 }}>{value}</div>
      <div style={{ color: gt.panelSubtext, fontSize: 10, marginTop: 2 }}>{label}</div>
    </div>
  )
}

function IngestLog({ job, gt, collapsed = false }: { job: any; gt: any; collapsed?: boolean }) {
  const [expanded, setExpanded] = useState(!collapsed)
  if (!job?.log?.length) return null
  const statusColor = job.status === 'done' ? '#22c55e' : job.status === 'failed' ? '#ef4444' : '#f59e0b'

  return (
    <div style={{ background: '#0f172a', borderRadius: 6, padding: '8px 10px', marginTop: 8, fontSize: 11, fontFamily: 'monospace' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{ background: 'none', border: 'none', color: statusColor, cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: 0, marginBottom: expanded ? 6 : 0 }}
      >
        {expanded ? '▼' : '▶'} {job.status === 'running' ? '⏳ Analyzing…' : job.status === 'done' ? '✓ Complete' : '✗ Failed'}
        {' '}({job.log.length} log entries)
      </button>
      {expanded && (
        <div style={{ maxHeight: 140, overflowY: 'auto' }}>
          {job.log.map((line: string, i: number) => (
            <div key={i} style={{ color: line.startsWith('Error') ? '#ef4444' : '#94a3b8', lineHeight: 1.6 }}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
