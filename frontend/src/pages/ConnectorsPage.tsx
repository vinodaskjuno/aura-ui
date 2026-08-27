import { useEffect, useState } from 'react'
import {
  Plus, X, Trash2, RefreshCw, CheckCircle2, XCircle, Clock,
  GitBranch, GitFork, Plug2, Database, Cloud, ShieldCheck,
  Ticket, Server, Search, ChevronDown, Link2, Eye, EyeOff,
  Wifi, WifiOff, FolderGit2, AlertTriangle, Layers,
} from 'lucide-react'
import {
  getConnectors, createConnector, updateConnector, deleteConnector, testConnector,
  type Connector, type ConnectorType, type ConnectorCreatePayload,
} from '../api/connectors'

// ── Connector type definitions ────────────────────────────────────────────────

interface ConnectorTypeDef {
  key: ConnectorType
  label: string
  description: string
  icon: React.ReactNode
  color: string
  providers: Array<{ key: string; label: string; fields: FieldDef[] }>
}

interface FieldDef {
  key: string
  label: string
  type: 'text' | 'password' | 'url' | 'select'
  placeholder?: string
  required?: boolean
  options?: Array<{ value: string; label: string }>
}

const CONNECTOR_TYPE_DEFS: ConnectorTypeDef[] = [
  {
    key: 'git',
    label: 'Git Repository',
    description: 'Connect to GitHub, GitLab, Bitbucket, or Azure DevOps',
    icon: <FolderGit2 size={18} />,
    color: '#10b981',
    providers: [
      {
        key: 'github',
        label: 'GitHub',
        fields: [
          { key: 'baseUrl', label: 'Base URL', type: 'url', placeholder: 'https://github.com', required: false },
          { key: 'token', label: 'Personal Access Token', type: 'password', placeholder: 'ghp_...', required: true },
          { key: 'org', label: 'Organisation / Owner', type: 'text', placeholder: 'my-org', required: false },
        ],
      },
      {
        key: 'gitlab',
        label: 'GitLab',
        fields: [
          { key: 'baseUrl', label: 'GitLab URL', type: 'url', placeholder: 'https://gitlab.com', required: true },
          { key: 'token', label: 'Access Token', type: 'password', placeholder: 'glpat-...', required: true },
          { key: 'org', label: 'Group / Namespace', type: 'text', placeholder: 'my-group', required: false },
        ],
      },
      {
        key: 'bitbucket',
        label: 'Bitbucket',
        fields: [
          { key: 'baseUrl', label: 'Base URL', type: 'url', placeholder: 'https://bitbucket.org', required: false },
          { key: 'token', label: 'App Password', type: 'password', placeholder: 'App password', required: true },
          { key: 'org', label: 'Workspace', type: 'text', placeholder: 'my-workspace', required: false },
        ],
      },
      {
        key: 'azure_devops',
        label: 'Azure DevOps',
        fields: [
          { key: 'baseUrl', label: 'Organisation URL', type: 'url', placeholder: 'https://dev.azure.com/my-org', required: true },
          { key: 'token', label: 'Personal Access Token', type: 'password', placeholder: 'PAT token', required: true },
        ],
      },
    ],
  },
  {
    key: 'project_mgmt',
    label: 'Project Management',
    description: 'Connect to Jira, Rally, or Azure Boards',
    icon: <Ticket size={18} />,
    color: '#3b82f6',
    providers: [
      {
        key: 'jira',
        label: 'Jira',
        fields: [
          { key: 'baseUrl', label: 'Jira URL', type: 'url', placeholder: 'https://mycompany.atlassian.net', required: true },
          { key: 'token', label: 'API Token', type: 'password', placeholder: 'API token', required: true },
          { key: 'projectKey', label: 'Project Key', type: 'text', placeholder: 'PROJ', required: false },
        ],
      },
      {
        key: 'rally',
        label: 'Rally',
        fields: [
          { key: 'baseUrl', label: 'Rally URL', type: 'url', placeholder: 'https://rally1.rallydev.com', required: true },
          { key: 'token', label: 'API Key', type: 'password', placeholder: '_rally_apikey_...', required: true },
          { key: 'projectKey', label: 'Project Name', type: 'text', placeholder: 'My Project', required: false },
        ],
      },
      {
        key: 'azure_boards',
        label: 'Azure Boards',
        fields: [
          { key: 'baseUrl', label: 'Organisation URL', type: 'url', placeholder: 'https://dev.azure.com/my-org', required: true },
          { key: 'token', label: 'Personal Access Token', type: 'password', placeholder: 'PAT token', required: true },
          { key: 'projectKey', label: 'Project', type: 'text', placeholder: 'My Project', required: false },
        ],
      },
    ],
  },
  {
    key: 'itsm',
    label: 'IT Service Management',
    description: 'Connect to ServiceNow for CMDB, incidents, and changes',
    icon: <Server size={18} />,
    color: '#f59e0b',
    providers: [
      {
        key: 'servicenow',
        label: 'ServiceNow',
        fields: [
          { key: 'instanceUrl', label: 'Instance URL', type: 'url', placeholder: 'https://myinstance.service-now.com', required: true },
          { key: 'username', label: 'Username', type: 'text', placeholder: 'admin', required: true },
          { key: 'password', label: 'Password', type: 'password', placeholder: 'Password', required: true },
        ],
      },
    ],
  },
  {
    key: 'security',
    label: 'Security',
    description: 'Connect to Wiz or Snyk for vulnerability data',
    icon: <ShieldCheck size={18} />,
    color: '#ef4444',
    providers: [
      {
        key: 'wiz',
        label: 'Wiz',
        fields: [
          { key: 'clientId', label: 'Client ID', type: 'text', placeholder: 'Wiz client ID', required: true },
          { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: 'Wiz client secret', required: true },
        ],
      },
      {
        key: 'snyk',
        label: 'Snyk',
        fields: [
          { key: 'token', label: 'API Token', type: 'password', placeholder: 'snyk_token_...', required: true },
          { key: 'org', label: 'Organisation', type: 'text', placeholder: 'my-org-id', required: false },
        ],
      },
    ],
  },
  {
    key: 'storage',
    label: 'Cloud Storage',
    description: 'Connect to S3, Azure Blob, or Google Cloud Storage',
    icon: <Cloud size={18} />,
    color: '#06b6d4',
    providers: [
      {
        key: 's3',
        label: 'Amazon S3',
        fields: [
          { key: 'region', label: 'Region', type: 'text', placeholder: 'us-east-1', required: true },
          { key: 'bucket', label: 'Bucket Name', type: 'text', placeholder: 'my-bucket', required: true },
          { key: 'token', label: 'Access Key ID', type: 'text', placeholder: 'AKIA...', required: false },
          { key: 'secret', label: 'Secret Access Key', type: 'password', placeholder: 'Secret key', required: false },
        ],
      },
      {
        key: 'azure_blob',
        label: 'Azure Blob',
        fields: [
          { key: 'baseUrl', label: 'Storage Account URL', type: 'url', placeholder: 'https://myaccount.blob.core.windows.net', required: true },
          { key: 'token', label: 'Connection String', type: 'password', placeholder: 'DefaultEndpointsProtocol=https;...', required: true },
        ],
      },
      {
        key: 'gcs',
        label: 'Google Cloud Storage',
        fields: [
          { key: 'bucket', label: 'Bucket Name', type: 'text', placeholder: 'my-bucket', required: true },
          { key: 'token', label: 'Service Account JSON', type: 'password', placeholder: '{"type":"service_account",...}', required: true },
        ],
      },
    ],
  },
  {
    key: 'sql',
    label: 'SQL Database',
    description: 'Connect to PostgreSQL, MySQL, or SQL Server',
    icon: <Database size={18} />,
    color: '#8b5cf6',
    providers: [
      {
        key: 'postgresql',
        label: 'PostgreSQL',
        fields: [{ key: 'connectionString', label: 'Connection String', type: 'password', placeholder: 'postgresql://user:pass@host:5432/db', required: true }],
      },
      {
        key: 'mysql',
        label: 'MySQL',
        fields: [{ key: 'connectionString', label: 'Connection String', type: 'password', placeholder: 'mysql://user:pass@host:3306/db', required: true }],
      },
      {
        key: 'mssql',
        label: 'SQL Server',
        fields: [{ key: 'connectionString', label: 'Connection String', type: 'password', placeholder: 'mssql://user:pass@host:1433/db', required: true }],
      },
    ],
  },
  {
    key: 'api',
    label: 'REST API',
    description: 'Connect to any REST API endpoint',
    icon: <Link2 size={18} />,
    color: '#ec4899',
    providers: [
      {
        key: 'rest',
        label: 'REST API',
        fields: [
          { key: 'baseUrl', label: 'Base URL', type: 'url', placeholder: 'https://api.example.com', required: true },
          { key: 'token', label: 'Bearer Token', type: 'password', placeholder: 'API key or token', required: false },
        ],
      },
    ],
  },
  {
    key: 'mcp',
    label: 'MCP Server',
    description: 'Connect to a Model Context Protocol (MCP) server',
    icon: <Plug2 size={18} />,
    color: '#a78bfa',
    providers: [
      {
        key: 'custom',
        label: 'MCP Endpoint',
        fields: [
          { key: 'baseUrl', label: 'Endpoint URL', type: 'url', placeholder: 'http://localhost:3000/sse', required: true },
          { key: 'token', label: 'Auth Token (optional)', type: 'password', placeholder: 'Bearer token', required: false },
        ],
      },
    ],
  },
]

function getTypeDef(type: string): ConnectorTypeDef | undefined {
  return CONNECTOR_TYPE_DEFS.find(d => d.key === type)
}

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  connected: { label: 'Connected', color: '#10b981', icon: <CheckCircle2 size={13} /> },
  failed:    { label: 'Failed',    color: '#ef4444', icon: <XCircle size={13} /> },
  untested:  { label: 'Untested',  color: '#6b7280', icon: <Clock size={13} /> },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.untested
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: cfg.color + '1a', color: cfg.color, border: `1px solid ${cfg.color}33`,
    }}>
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never'
  const d = Date.now() - new Date(iso).getTime()
  if (d < 60_000) return 'just now'
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`
  return `${Math.floor(d / 86_400_000)}d ago`
}

// ── Connector Card ────────────────────────────────────────────────────────────

interface ConnectorCardProps {
  connector: Connector
  onDelete: () => void
  onTest: () => void
  testing: boolean
  testResult: { success: boolean; message: string; latencyMs: number } | null
}

function ConnectorCard({ connector, onDelete, onTest, testing, testResult }: ConnectorCardProps) {
  const def = getTypeDef(connector.type)
  const color = def?.color ?? '#6b7280'

  return (
    <div style={{
      background: 'var(--color-card)', border: '1px solid var(--color-border)',
      borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 14,
      boxShadow: 'var(--glow-card)', transition: 'border-color 0.2s, transform 0.15s',
      position: 'relative', overflow: 'hidden',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = color + '55'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)' }}
    >
      {/* Top color accent */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${color}, ${color}00)` }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: color + '1a', border: `1px solid ${color}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color,
        }}>
          {def?.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {connector.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 500 }}>
              {def?.label}
            </span>
            {connector.provider && (
              <>
                <span style={{ color: 'var(--color-border)' }}>·</span>
                <span style={{ fontSize: 11, color: 'var(--color-subtext)' }}>{connector.provider}</span>
              </>
            )}
          </div>
        </div>
        <StatusBadge status={connector.testStatus} />
      </div>

      {/* Last tested */}
      <div style={{ fontSize: 11, color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
        <Clock size={11} />
        Last tested: {timeAgo(connector.lastTested)}
      </div>

      {/* Test result inline */}
      {testResult && (
        <div style={{
          padding: '8px 12px', borderRadius: 8, fontSize: 12,
          background: testResult.success ? '#10b98111' : '#ef444411',
          color: testResult.success ? '#10b981' : '#ef4444',
          border: `1px solid ${testResult.success ? '#10b98133' : '#ef444433'}`,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {testResult.success ? <Wifi size={13} /> : <WifiOff size={13} />}
          {testResult.message}
          {testResult.success && testResult.latencyMs && (
            <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.8 }}>{testResult.latencyMs}ms</span>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <button
          onClick={onTest}
          disabled={testing}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            color: 'var(--color-text)', cursor: testing ? 'not-allowed' : 'pointer',
            opacity: testing ? 0.7 : 1, transition: 'background 0.15s',
          }}
          onMouseEnter={e => !testing && ((e.currentTarget as HTMLButtonElement).style.background = 'var(--color-card-hover)')}
          onMouseLeave={e => !testing && ((e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface)')}
        >
          {testing
            ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
            : <Wifi size={13} />}
          {testing ? 'Testing...' : 'Test'}
        </button>
        <button
          onClick={onDelete}
          style={{
            width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#ef444411', border: '1px solid #ef444433',
            color: '#ef4444', cursor: 'pointer', transition: 'background 0.15s',
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#ef444422')}
          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = '#ef444411')}
          title="Delete connector"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

// ── Add Connector Modal ───────────────────────────────────────────────────────

interface AddConnectorModalProps {
  onClose: () => void
  onAdded: () => void
}

function AddConnectorModal({ onClose, onAdded }: AddConnectorModalProps) {
  const [step, setStep] = useState<'type' | 'config'>('type')
  const [selectedType, setSelectedType] = useState<ConnectorTypeDef | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [name, setName] = useState('')
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({})
  const [repoUrl, setRepoUrl] = useState('')
  const [repoType, setRepoType] = useState('auto')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const REPO_TYPE_OPTS = [
    { value: 'auto',        label: '🔍 Auto-Detect' },
    { value: 'mule',        label: '🔷 Mule 4' },
    { value: 'spring',      label: '☕ Spring Boot (Java)' },
    { value: 'python',      label: '🐍 Python (FastAPI/Django)' },
    { value: 'ui-react',    label: '⚛️ React / Next.js' },
    { value: 'ui-angular',  label: '🅰️ Angular' },
    { value: 'terraform',   label: '🏗️ Terraform / CloudFormation' },
    { value: 'cicd',        label: '⚙️ Jenkins / GitHub Actions / K8s' },
    { value: 'config',      label: '📄 Config / RAML / OpenAPI' },
    { value: 'library',     label: '📦 Library / Shared Module' },
  ]

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  }

  const providerDef = selectedType?.providers.find(p => p.key === selectedProvider)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedType || !selectedProvider) return
    setError('')
    setLoading(true)
    try {
      const payload: ConnectorCreatePayload = {
        name: name || `${selectedType.label} — ${selectedProvider}`,
        type: selectedType.key,
        provider: selectedProvider,
        config: { ...fieldValues },
        ...(selectedType.key === 'git' && repoUrl ? { repoUrl, repoType } : {}),
      }
      await createConnector(payload)
      onAdded()
      onClose()
    } catch {
      setError('Failed to create connector. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: 'var(--color-card)', border: '1px solid var(--color-border)',
        borderRadius: 18, width: '100%', maxWidth: step === 'type' ? 680 : 480,
        boxShadow: 'var(--shadow-lg)', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>
              {step === 'type' ? 'Add Connector' : `Configure ${selectedType?.label}`}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-subtext)', marginTop: 2 }}>
              {step === 'type' ? 'Choose a connector type to get started' : selectedType?.description}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Step 1: Type selection */}
        {step === 'type' && (
          <div style={{ padding: 24, overflowY: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {CONNECTOR_TYPE_DEFS.map(typeDef => (
                <button
                  key={typeDef.key}
                  type="button"
                  onClick={() => {
                    setSelectedType(typeDef)
                    setSelectedProvider(typeDef.providers[0].key)
                    setName(`${typeDef.providers[0].label} Connection`)
                    setStep('config')
                  }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10,
                    padding: 16, borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = typeDef.color + '66'
                    ;(e.currentTarget as HTMLButtonElement).style.background = typeDef.color + '0d'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)'
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface)'
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                    background: typeDef.color + '1a', border: `1px solid ${typeDef.color}33`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: typeDef.color,
                  }}>
                    {typeDef.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 3 }}>{typeDef.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-subtext)', lineHeight: 1.4 }}>{typeDef.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Configuration */}
        {step === 'config' && selectedType && (
          <form onSubmit={handleSubmit} style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Provider picker if multiple */}
            {selectedType.providers.length > 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, color: 'var(--color-subtext)', fontWeight: 600 }}>Provider</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {selectedType.providers.map(p => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => { setSelectedProvider(p.key); setName(`${p.label} Connection`) }}
                      style={{
                        padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        background: selectedProvider === p.key ? selectedType.color + '22' : 'var(--color-surface)',
                        border: `1px solid ${selectedProvider === p.key ? selectedType.color + '66' : 'var(--color-border)'}`,
                        color: selectedProvider === p.key ? selectedType.color : 'var(--color-text)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, color: 'var(--color-subtext)', fontWeight: 600 }}>Connection Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={`${selectedType.label} connection`}
                style={inputStyle}
              />
            </div>

            {/* Git-specific: Repo URL + Repo Type */}
            {selectedType.key === 'git' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, color: 'var(--color-subtext)', fontWeight: 600 }}>
                    Repository URL <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}>(optional — for single-repo connectors)</span>
                  </label>
                  <input
                    type="url"
                    value={repoUrl}
                    onChange={e => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/org/repo-name"
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, color: 'var(--color-subtext)', fontWeight: 600 }}>Repo Type</label>
                  <select
                    value={repoType}
                    onChange={e => setRepoType(e.target.value)}
                    style={{ ...inputStyle }}
                  >
                    {REPO_TYPE_OPTS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Dynamic fields */}
            {providerDef?.fields.map(field => (
              <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, color: 'var(--color-subtext)', fontWeight: 600 }}>
                  {field.label} {field.required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={field.type === 'password' && !showPassword[field.key] ? 'password' : 'text'}
                    value={fieldValues[field.key] ?? ''}
                    onChange={e => setFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    required={field.required}
                    style={{ ...inputStyle, paddingRight: field.type === 'password' ? 36 : 12 }}
                  />
                  {field.type === 'password' && (
                    <button
                      type="button"
                      onClick={() => setShowPassword(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
                    >
                      {showPassword[field.key] ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: '#ef444411', border: '1px solid #ef444433', color: '#ef4444', fontSize: 12 }}>
                <AlertTriangle size={14} />
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setStep('type')}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 9, fontSize: 13, fontWeight: 600,
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  color: 'var(--color-text)', cursor: 'pointer',
                }}
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 2, padding: '10px 0', borderRadius: 9, fontSize: 13, fontWeight: 600,
                  background: selectedType.color, color: '#fff', border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.8 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {loading && <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                {loading ? 'Creating...' : 'Create Connector'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string; latencyMs: number }>>({})
  const [testingId, setTestingId] = useState<string | null>(null)

  const fetchConnectors = () => {
    setLoading(true)
    getConnectors()
      .then(res => setConnectors(res.data))
      .catch(() => setConnectors([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchConnectors() }, [])

  const handleTest = async (id: string) => {
    setTestingId(id)
    try {
      const res = await testConnector(id)
      setTestResults(prev => ({ ...prev, [id]: res.data }))
      // Refresh status from server
      fetchConnectors()
    } catch {
      setTestResults(prev => ({ ...prev, [id]: { success: false, message: 'Connection failed', latencyMs: 0 } }))
    } finally {
      setTestingId(null)
    }
  }

  const handleDelete = async (connector: Connector) => {
    if (!confirm(`Delete connector "${connector.name}"?`)) return
    try {
      await deleteConnector(connector.connectorId)
      setConnectors(prev => prev.filter(c => c.connectorId !== connector.connectorId))
    } catch {
      alert('Failed to delete connector')
    }
  }

  // Filter connectors
  const filtered = connectors.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.provider.toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'all' || c.type === typeFilter
    return matchSearch && matchType
  })

  // Group by type
  const grouped = CONNECTOR_TYPE_DEFS.reduce<Record<string, Connector[]>>((acc, def) => {
    const group = filtered.filter(c => c.type === def.key)
    if (group.length > 0) acc[def.key] = group
    return acc
  }, {})

  const connectedCount = connectors.filter(c => c.testStatus === 'connected').length
  const types = [...new Set(connectors.map(c => c.type))]

  return (
    <div style={{ padding: '24px 28px', minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'var(--color-primary)1a', border: '1px solid var(--color-primary)33',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-primary)',
            }}>
              <Plug2 size={18} />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>Connectors</h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--color-subtext)', margin: 0 }}>
            {connectors.length} connectors · {connectedCount} connected
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
            background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer',
            boxShadow: 'var(--glow-primary)', transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.opacity = '0.9')}
          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
        >
          <Plus size={16} />
          Add Connector
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search connectors..."
            style={{
              width: '100%', padding: '9px 12px 9px 36px', borderRadius: 9, fontSize: 13,
              background: 'var(--color-card)', border: '1px solid var(--color-border)',
              color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['all', ...types].map(type => {
            const def = CONNECTOR_TYPE_DEFS.find(d => d.key === type)
            return (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: typeFilter === type ? 'var(--color-primary)' : 'var(--color-card)',
                  color: typeFilter === type ? '#fff' : 'var(--color-text)',
                  border: `1px solid ${typeFilter === type ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  transition: 'all 0.15s',
                }}
              >
                {type === 'all' ? 'All' : (def?.label ?? type)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 10, color: 'var(--color-muted)' }}>
          <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
          Loading connectors...
        </div>
      ) : connectors.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 0',
          background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 16,
        }}>
          <Layers size={40} style={{ color: 'var(--color-muted)', margin: '0 auto 16px' }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 }}>No connectors yet</div>
          <div style={{ fontSize: 13, color: 'var(--color-subtext)', marginBottom: 20 }}>
            Add connectors to access your Git repositories, project trackers, and more
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer',
            }}
          >
            <Plus size={16} />
            Add Your First Connector
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-muted)', fontSize: 14 }}>
          No connectors match your filters
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {Object.entries(grouped).map(([typeKey, group]) => {
            const def = getTypeDef(typeKey)
            if (!def) return null
            return (
              <div key={typeKey}>
                {/* Group header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ color: def.color }}>{def.icon}</div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{def.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-muted)', padding: '2px 8px', borderRadius: 20, background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                    {group.length}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                  {group.map(connector => (
                    <ConnectorCard
                      key={connector.connectorId}
                      connector={connector}
                      onDelete={() => handleDelete(connector)}
                      onTest={() => handleTest(connector.connectorId)}
                      testing={testingId === connector.connectorId}
                      testResult={testResults[connector.connectorId] ?? null}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <AddConnectorModal
          onClose={() => setShowModal(false)}
          onAdded={fetchConnectors}
        />
      )}
    </div>
  )
}
