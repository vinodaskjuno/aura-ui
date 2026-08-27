import { useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'
import { useGraphTheme } from '../../hooks/useGraphTheme'
import type { OntologyNode } from '../../api/ontologyUniverse'
import { detectNodeLanguage, buildNodeJsonContent } from './ontologyToFlow'

interface WorkspaceCodeViewerProps {
  selectedNode: OntologyNode | null
}

async function fetchFileContent(node: OntologyNode): Promise<string | null> {
  const n = node as Record<string, unknown>
  const filePath = String(n.filePath ?? n.file_path ?? n.path ?? '')
  if (!filePath || !filePath.includes('/')) return null
  const token = localStorage.getItem('ov_token') ?? ''
  try {
    const res = await fetch('/api/commands/understand', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        node_id: node.id,
        node_type: node.node_type,
        file_path: filePath,
        label: node.label,
      }),
    })
    if (!res.ok) return null
    const data = await res.json() as Record<string, unknown>
    return String(data.content ?? data.result ?? data.code ?? '') || null
  } catch {
    return null
  }
}

export default function WorkspaceCodeViewer({ selectedNode }: WorkspaceCodeViewerProps) {
  const t = useGraphTheme()
  const [content, setContent] = useState<string>('')
  const [language, setLanguage] = useState<string>('json')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedNode) {
      setContent('')
      setLanguage('json')
      return
    }
    const lang = detectNodeLanguage(selectedNode)
    setLanguage(lang)
    setContent(buildNodeJsonContent(selectedNode))

    setLoading(true)
    fetchFileContent(selectedNode)
      .then(fc => { if (fc) setContent(fc) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selectedNode?.id])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: t.panelBg,
      borderRight: `1px solid var(--color-border)`,
    }}>
      {/* Header */}
      <div style={{
        padding: '0 12px', borderBottom: `1px solid var(--color-border)`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, height: 36,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: t.sectionLabel,
        }}>
          Code Viewer
        </span>
        {selectedNode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 11, color: t.panelSubtext,
              overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', maxWidth: 200,
            }}>
              {selectedNode.label} · {selectedNode.node_type}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700,
              padding: '1px 6px', borderRadius: 4,
              background: t.accentBg, color: t.accent,
              border: `1px solid ${t.accentBorder}`,
            }}>
              {language}
            </span>
            {loading && (
              <span style={{ fontSize: 10, color: t.mutedText }}>fetching…</span>
            )}
          </div>
        )}
      </div>

      {/* Editor or placeholder */}
      {!selectedNode ? (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: t.panelSubtext, fontSize: 13,
          flexDirection: 'column', gap: 8,
        }}>
          <span style={{ fontSize: 32, opacity: 0.3 }}>📄</span>
          <span>Click a node in the graph to view its properties</span>
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Editor
            height="100%"
            language={language}
            value={content}
            theme={t.isDark ? 'vs-dark' : 'light'}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 12,
              lineNumbers: 'on',
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              folding: true,
              renderLineHighlight: 'all',
              automaticLayout: true,
              padding: { top: 8 },
            }}
            loading={
              <div style={{ padding: 16, color: t.panelSubtext, fontSize: 12 }}>
                Loading editor…
              </div>
            }
          />
        </div>
      )}
    </div>
  )
}
