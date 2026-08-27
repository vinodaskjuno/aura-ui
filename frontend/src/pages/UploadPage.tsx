import { useCallback, useEffect, useRef, useState } from 'react'
import { Upload, Trash2, FileText, CheckCircle, XCircle, Loader2 } from 'lucide-react'
// Cytoscape replaced by React Flow in Phase 7
const cytoscape = (..._: any[]) => ({ on: () => {}, layout: () => ({ run: () => {} }), add: () => {}, nodes: () => ({ forEach: () => {} }), style: () => {}, fit: () => {}, destroy: () => {} })
const fcose = {}
import { uploadFile, getUploadHistory, deleteUpload } from '../api/upload'
import type { UploadResult } from '../api/upload'
import { getGraphData } from '../api/graph'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'

try { (cytoscape as any).use?.(fcose) } catch (_) {}

const ACCEPTED = '.xlsx,.xls,.csv,.json,.txt,.yaml,.yml,.md,.py,.ts,.js'

type Stage = 'idle' | 'parsing' | 'extracting' | 'storing' | 'done' | 'error'

const STAGE_LABELS: Record<Stage, string> = {
  idle: 'Ready',
  parsing: 'Parsing file…',
  extracting: 'Extracting ontology…',
  storing: 'Storing triples…',
  done: 'Complete',
  error: 'Failed',
}

export default function UploadPage() {
  const [stage, setStage] = useState<Stage>('idle')
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<UploadResult | null>(null)
  const [history, setHistory] = useState<UploadResult[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [graphData, setGraphData] = useState<{ nodes: unknown[]; edges: unknown[] } | null>(null)
  const [graphLoading, setGraphLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchHistory = useCallback(() => {
    setHistoryLoading(true)
    getUploadHistory()
      .then((res) => setHistory(res.data))
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
  }, [])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const loadGraph = useCallback(() => {
    setGraphLoading(true)
    getGraphData('sdlc')
      .then((res) => setGraphData(res.data))
      .catch(() => {})
      .finally(() => setGraphLoading(false))
  }, [])

  useEffect(() => { loadGraph() }, [loadGraph])

  // Render graph
  useEffect(() => {
    if (!graphData || !containerRef.current) return
    if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null }
    const cs = getComputedStyle(document.documentElement)
    const resolveVar = (v: string) => cs.getPropertyValue(v).trim() || '#888'

    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...(graphData.nodes as any[]),
        ...(graphData.edges as any[]),
      ],
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            width: 42, height: 42,
            'font-size': 9,
            'font-family': 'Inter, system-ui, sans-serif',
            'font-weight': 600 as any,
            color: '#ffffff',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 6,
            'text-outline-color': resolveVar('--color-surface'),
            'text-outline-width': 2,
            'border-width': 2,
            'background-fill': 'radial-gradient',
            'background-gradient-stop-colors': ['#a78bfa', '#7c3aed', '#4c1d95'] as any,
            'background-gradient-stop-positions': [0, 55, 100] as any,
            'border-color': '#8b5cf6',
          },
        },
        {
          selector: 'node[domain = "infra"]',
          style: {
            'background-gradient-stop-colors': ['#93c5fd', '#3b82f6', '#1d4ed8'] as any,
            'border-color': '#60a5fa',
          } as any,
        },
        {
          selector: 'node[domain = "sdlc"]',
          style: {
            'background-gradient-stop-colors': ['#6ee7b7', '#10b981', '#065f46'] as any,
            'border-color': '#34d399',
          } as any,
        },
        {
          selector: 'edge',
          style: {
            'line-color': '#3a3a4a',
            'target-arrow-color': '#3a3a4a',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-size': 8,
            color: resolveVar('--color-subtext'),
            'text-rotation': 'autorotate',
            'text-outline-color': resolveVar('--color-surface'),
            'text-outline-width': 1,
            width: 1.5,
            opacity: 0.6,
          },
        },
      ],
      layout: { name: 'fcose', animate: true, padding: 40 },
    })
    cyRef.current = cy
    return () => { cy.destroy(); cyRef.current = null }
  }, [graphData])

  const processFile = async (file: File) => {
    setError(null)
    setLastResult(null)
    setStage('parsing')

    try {
      setStage('extracting')
      const res = await uploadFile(file)
      setStage('storing')
      await new Promise((r) => setTimeout(r, 300))
      setLastResult(res.data)
      setStage('done')
      fetchHistory()
      loadGraph()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Upload failed'
      setError(msg)
      setStage('error')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteUpload(id)
      setHistory((prev) => prev.filter((h) => h.upload_id !== id))
    } catch {}
  }

  const busy = stage === 'parsing' || stage === 'extracting' || stage === 'storing'
  const nodeCount = (graphData?.nodes as unknown[])?.length ?? 0

  return (
    <div className="flex flex-col gap-6 h-full" style={{ height: 'calc(100vh - 56px - 48px)' }}>

      {/* Top row: upload zone + history */}
      <div className="flex gap-4 flex-shrink-0" style={{ maxHeight: 280 }}>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !busy && fileInputRef.current?.click()}
          style={{
            flex: '0 0 300px',
            border: `2px dashed ${dragOver ? 'var(--color-primary)' : 'var(--color-border)'}`,
            borderRadius: 16,
            background: dragOver ? 'rgba(124,58,237,0.06)' : 'var(--color-card)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 10, cursor: busy ? 'not-allowed' : 'pointer', padding: '24px 16px',
            transition: 'all 0.2s',
          }}
        >
          <input ref={fileInputRef} type="file" accept={ACCEPTED} onChange={handleFileInput} style={{ display: 'none' }} />

          {busy ? (
            <Loader2 size={32} style={{ color: 'var(--color-primary)', animation: 'spin 1s linear infinite' }} />
          ) : stage === 'done' ? (
            <CheckCircle size={32} style={{ color: 'var(--color-success)' }} />
          ) : stage === 'error' ? (
            <XCircle size={32} style={{ color: 'var(--color-danger)' }} />
          ) : (
            <Upload size={32} style={{ color: 'var(--color-primary)' }} />
          )}

          <div style={{ textAlign: 'center' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              {busy ? STAGE_LABELS[stage] : 'Drop file or click to upload'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-subtext)' }}>
              {busy ? 'Processing…' : 'XLSX, CSV, JSON, YAML, Python, TypeScript…'}
            </p>
          </div>

          {/* Progress stages */}
          <div className="flex items-center gap-1 mt-1">
            {(['parsing', 'extracting', 'storing'] as Stage[]).map((s) => (
              <div
                key={s}
                className="rounded-full text-xs px-2 py-0.5"
                style={{
                  background: stage === s ? 'var(--color-primary)' :
                    stage === 'done' || (stage === 'storing' && s !== 'storing') ? 'rgba(16,185,129,0.2)' :
                    'var(--color-bg)',
                  color: stage === s ? '#fff' : stage === 'done' ? 'var(--color-success)' : 'var(--color-subtext)',
                  fontSize: 10,
                }}
              >
                {s}
              </div>
            ))}
          </div>

          {error && (
            <p className="text-xs text-center" style={{ color: 'var(--color-danger)', maxWidth: 240 }}>{error}</p>
          )}
        </div>

        {/* Last result + history */}
        <div className="flex flex-col gap-3 flex-1 min-w-0 overflow-hidden">
          {lastResult && !lastResult.error && (
            <Card style={{ flexShrink: 0 }}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={14} style={{ color: 'var(--color-success)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                  {lastResult.filename}
                </span>
                <Badge variant="success">{lastResult.triples_inserted} triples</Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(lastResult.entities).map(([cls, count]) => (
                  <Badge key={cls} variant="info">{cls}: {count}</Badge>
                ))}
              </div>
            </Card>
          )}

          <div className="flex-1 overflow-y-auto">
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-subtext)' }}>
              Upload History
            </p>
            {historyLoading ? (
              <div className="flex justify-center py-4"><Spinner /></div>
            ) : history.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--color-subtext)' }}>No uploads yet</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {history.map((h) => (
                  <div
                    key={h.upload_id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
                  >
                    <FileText size={12} style={{ color: 'var(--color-subtext)', flexShrink: 0 }} />
                    <span className="text-xs flex-1 truncate" style={{ color: 'var(--color-text)' }}>
                      {h.filename}
                    </span>
                    {h.error ? (
                      <Badge variant="danger">error</Badge>
                    ) : (
                      <Badge variant="success">{h.triples_inserted}t</Badge>
                    )}
                    <button
                      onClick={() => handleDelete(h.upload_id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-subtext)', display: 'flex', padding: 2 }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Graph panel */}
      <div
        className="flex-1 rounded-2xl overflow-hidden relative"
        style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', minHeight: 200 }}
      >
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            Ontology Graph — SDLC Domain
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="info">{nodeCount} nodes</Badge>
            <Button size="sm" variant="ghost" onClick={loadGraph} loading={graphLoading}>
              Refresh
            </Button>
          </div>
        </div>

        {graphLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10"
            style={{ background: 'rgba(0,0,0,0.4)' }}>
            <Spinner size="lg" />
          </div>
        )}

        <div ref={containerRef} className="w-full" style={{ height: 'calc(100% - 41px)', background: 'var(--color-bg)' }} />
      </div>
    </div>
  )
}
