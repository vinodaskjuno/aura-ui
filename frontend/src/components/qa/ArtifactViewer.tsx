import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Globe, Image, Code, Download, ExternalLink,
  ChevronDown, ChevronRight, X, FileCheck, ShieldCheck, ShieldX, ZoomIn,
} from 'lucide-react'
import { qaApi, type TestArtifact } from '../../api/qa'

interface ArtifactViewerProps {
  runId: string
  artifacts?: TestArtifact[]
}

type ArtifactGroup = 'html' | 'json' | 'screenshots' | 'scripts' | 'other'

function classifyArtifact(filename: string): ArtifactGroup {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html'
  if (lower.endsWith('.json')) return 'json'
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp')) return 'screenshots'
  if (lower.endsWith('.ts') || lower.endsWith('.py') || lower.endsWith('.spec.ts')) return 'scripts'
  return 'other'
}

function fileIcon(filename: string) {
  const type = classifyArtifact(filename)
  const iconProps = { size: 14 }
  switch (type) {
    case 'html':        return <Globe {...iconProps} color="#3b82f6" />
    case 'json':        return <FileText {...iconProps} color="#f59e0b" />
    case 'screenshots': return <Image {...iconProps} color="#8b5cf6" />
    case 'scripts':     return <Code {...iconProps} color="#10b981" />
    default:            return <FileCheck {...iconProps} color="var(--color-muted)" />
  }
}

const GROUP_LABELS: Record<ArtifactGroup, string> = {
  html:        'HTML Reports',
  json:        'JSON Results',
  screenshots: 'Screenshots',
  scripts:     'Test Scripts',
  other:       'Other Files',
}

function isFailed(filename: string): boolean {
  return filename.toLowerCase().includes('fail') || filename.toLowerCase().includes('error')
}

interface JsonResultData {
  passed?: number
  failed?: number
  skipped?: number
  tests?: Array<{ name: string; status: string; error?: string }>
  [key: string]: unknown
}

function JsonResultPanel({ url }: { url: string }) {
  const [data, setData] = useState<JsonResultData | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(url)
      .then(r => r.json())
      .then(d => setData(d as JsonResultData))
      .catch(() => setError(true))
  }, [url])

  if (error) return (
    <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--color-muted)' }}>
      Could not load JSON content.
    </div>
  )
  if (!data) return (
    <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--color-muted)' }}>Loading...</div>
  )

  const passed = data.passed ?? 0
  const failed = data.failed ?? 0
  const skipped = data.skipped ?? 0
  const tests = data.tests ?? []

  return (
    <div style={{ padding: '12px 14px' }}>
      {(passed + failed + skipped) > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          {[
            { label: 'Passed',  value: passed,  color: '#10b981' },
            { label: 'Failed',  value: failed,  color: '#ef4444' },
            { label: 'Skipped', value: skipped, color: '#f59e0b' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, textAlign: 'center',
              background: `${s.color}14`, border: `1px solid ${s.color}30` }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: 20, color: s.color }}>
                {s.value}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}
      {tests.length > 0 && (
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          {tests.map((t, i) => {
            const ok = (t.status ?? '').toLowerCase() === 'passed'
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
                {ok
                  ? <ShieldCheck size={12} color="#10b981" style={{ marginTop: 1, flexShrink: 0 }} />
                  : <ShieldX size={12} color="#ef4444" style={{ marginTop: 1, flexShrink: 0 }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>
                    {t.name}
                  </div>
                  {t.error && (
                    <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3, fontFamily: 'var(--font-mono)',
                      background: '#ef444410', padding: '4px 8px', borderRadius: 4 }}>
                      {String(t.error).slice(0, 200)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {!tests.length && (
        <pre style={{ fontSize: 11, color: 'var(--color-subtext)', fontFamily: 'var(--font-mono)',
          overflowX: 'auto', maxHeight: 200, margin: 0 }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}

function ArtifactCard({ artifact }: { artifact: TestArtifact }) {
  const [expanded, setExpanded] = useState(false)
  const [iframeVisible, setIframeVisible] = useState(false)
  const type = classifyArtifact(artifact.filename)
  const failed = type === 'screenshots' && isFailed(artifact.filename)

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden',
      background: 'var(--color-card)', transition: 'border-color 0.15s' }}>
      {/* Artifact row header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        cursor: type === 'html' || type === 'json' ? 'pointer' : 'default' }}
        onClick={() => { if (type === 'html' || type === 'json') setExpanded(e => !e) }}>

        {fileIcon(artifact.filename)}

        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--color-text)',
          fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {artifact.filename}
        </span>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {type === 'html' && (
            <a href={artifact.url} target="_blank" rel="noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: 'rgba(59,130,246,0.12)', color: '#3b82f6',
                border: '1px solid rgba(59,130,246,0.3)', textDecoration: 'none' }}>
              <ExternalLink size={10} /> Open
            </a>
          )}
          <a href={artifact.url} target="_blank" rel="noreferrer"
            download onClick={e => e.stopPropagation()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: 'var(--color-surface)', color: 'var(--color-subtext)',
              border: '1px solid var(--color-border)', textDecoration: 'none' }}>
            <Download size={10} />
          </a>
          {(type === 'html' || type === 'json') && (
            expanded
              ? <ChevronDown size={14} color="var(--color-muted)" />
              : <ChevronRight size={14} color="var(--color-muted)" />
          )}
        </div>
      </div>

      {/* Expanded preview */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden',
              borderTop: '1px solid var(--color-border)' }}>

            {type === 'html' && (
              <div>
                <div style={{ padding: '8px 14px', display: 'flex', gap: 8, alignItems: 'center',
                  background: 'var(--color-surface)' }}>
                  <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>Inline Preview</span>
                  <button onClick={() => setIframeVisible(v => !v)}
                    style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 5,
                      cursor: 'pointer', background: iframeVisible ? 'var(--color-primary)' : 'transparent',
                      border: '1px solid var(--color-border)',
                      color: iframeVisible ? '#fff' : 'var(--color-muted)' }}>
                    {iframeVisible ? 'Hide' : 'Show'} Preview
                  </button>
                </div>
                {iframeVisible && (
                  <iframe src={artifact.url} title={artifact.filename}
                    style={{ width: '100%', height: 400, border: 'none',
                      background: '#fff', display: 'block' }} />
                )}
              </div>
            )}

            {type === 'json' && <JsonResultPanel url={artifact.url} />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screenshot inline */}
      {type === 'screenshots' && (
        <div style={{ padding: '8px 14px 10px', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img src={artifact.url} alt={artifact.filename}
              style={{ maxWidth: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 6,
                border: `1.5px solid ${failed ? '#ef444466' : 'var(--color-border)'}`, display: 'block' }} />
            <div style={{ position: 'absolute', top: 4, left: 4 }}>
              {failed
                ? <ShieldX size={14} color="#ef4444" />
                : <ShieldCheck size={14} color="#10b981" />}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ScreenshotLightbox({ screenshots, onClose }: {
  screenshots: TestArtifact[]
  onClose: () => void
}) {
  const [current, setCurrent] = useState(0)
  const s = screenshots[current]

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setCurrent(c => Math.min(c + 1, screenshots.length - 1))
      if (e.key === 'ArrowLeft') setCurrent(c => Math.max(c - 1, 0))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, screenshots.length])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}>
      <div style={{ maxWidth: 960, width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isFailed(s.filename)
              ? <ShieldX size={16} color="#ef4444" />
              : <ShieldCheck size={16} color="#10b981" />}
            <span style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>{s.filename}</span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
              {current + 1} / {screenshots.length}
            </span>
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)',
              display: 'flex', padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <img src={s.url} alt={s.filename}
          style={{ width: '100%', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', display: 'block' }} />
        {screenshots.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
            {screenshots.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                style={{ width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: i === current ? 'var(--color-primary)' : 'rgba(255,255,255,0.3)', padding: 0 }} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function ScreenshotGrid({ screenshots }: { screenshots: TestArtifact[] }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
        {screenshots.map((s, i) => {
          const failed = isFailed(s.filename)
          return (
            <motion.div key={s.key} initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}
              onClick={() => setLightboxIdx(i)}
              style={{ cursor: 'pointer', borderRadius: 8, overflow: 'hidden',
                border: `1.5px solid ${failed ? '#ef444455' : 'var(--color-border)'}`,
                background: 'var(--color-card)', position: 'relative' }}>
              <img src={s.url} alt={s.filename}
                style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />
              <div style={{ position: 'absolute', top: 4, left: 4 }}>
                {failed
                  ? <ShieldX size={12} color="#ef4444" />
                  : <ShieldCheck size={12} color="#10b981" />}
              </div>
              <div style={{ position: 'absolute', top: 4, right: 4,
                background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: 3, display: 'flex' }}>
                <ZoomIn size={10} color="#fff" />
              </div>
              <div style={{ padding: '4px 6px' }}>
                <div style={{ fontSize: 10, color: 'var(--color-muted)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.filename.replace(/^\d+-/, '').replace(/\.(png|jpg|jpeg)$/, '')}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      <AnimatePresence>
        {lightboxIdx !== null && (
          <ScreenshotLightbox
            screenshots={screenshots}
            onClose={() => setLightboxIdx(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

export default function ArtifactViewer({ runId, artifacts: propArtifacts }: ArtifactViewerProps) {
  const [artifacts, setArtifacts] = useState<TestArtifact[]>(propArtifacts ?? [])
  const [loading, setLoading] = useState(!propArtifacts)
  const [expandedGroups, setExpandedGroups] = useState<Set<ArtifactGroup>>(
    new Set(['html', 'json', 'screenshots', 'scripts', 'other'])
  )

  useEffect(() => {
    if (propArtifacts) { setArtifacts(propArtifacts); return }
    setLoading(true)
    qaApi.getArtifacts(runId)
      .then(r => setArtifacts(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [runId, propArtifacts])

  if (loading) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>
        Loading artifacts...
      </div>
    )
  }

  if (artifacts.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>
        <FileCheck size={28} style={{ marginBottom: 8, opacity: 0.4, display: 'block', margin: '0 auto 8px' }} />
        <div>No artifacts for this run.</div>
      </div>
    )
  }

  // Group artifacts by type
  const grouped = artifacts.reduce<Record<ArtifactGroup, TestArtifact[]>>(
    (acc, a) => {
      const g = classifyArtifact(a.filename)
      acc[g].push(a)
      return acc
    },
    { html: [], json: [], screenshots: [], scripts: [], other: [] }
  )

  const toggleGroup = (g: ArtifactGroup) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(g) ? next.delete(g) : next.add(g)
      return next
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {(Object.entries(grouped) as [ArtifactGroup, TestArtifact[]][]).map(([group, items]) => {
        if (items.length === 0) return null
        const open = expandedGroups.has(group)

        return (
          <div key={group}>
            {/* Group header */}
            <button onClick={() => toggleGroup(group)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 0',
                background: 'none', border: 'none', cursor: 'pointer', marginBottom: 8 }}>
              {open
                ? <ChevronDown size={14} color="var(--color-muted)" />
                : <ChevronRight size={14} color="var(--color-muted)" />}
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: 'var(--color-subtext)' }}>
                {GROUP_LABELS[group]}
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 500 }}>
                ({items.length})
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--color-border)', marginLeft: 4 }} />
            </button>

            {/* Group items */}
            <AnimatePresence>
              {open && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {group === 'screenshots' ? (
                    <ScreenshotGrid screenshots={items} />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {items.map(a => (
                        <ArtifactCard key={a.key} artifact={a} />
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
