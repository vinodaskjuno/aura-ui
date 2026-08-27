import { useEffect } from 'react'
import { useGraphTheme } from '../../hooks/useGraphTheme'
import { useWorkspaceStore, type LearnMode } from '../../store/workspaceStore'
import type { OntologyNode } from '../../api/ontologyUniverse'

interface WorkspaceLearnPanelProps {
  selectedNode: OntologyNode | null
  allNodes: OntologyNode[]
  onNodeSelect: (n: OntologyNode) => void
  onAskAI: (message: string) => void
}

async function fetchExplanation(node: OntologyNode): Promise<string> {
  const token = localStorage.getItem('ov_token') ?? ''
  try {
    const res = await fetch('/api/commands/understand-domain', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        node_id: node.id,
        node_type: node.node_type,
        label: node.label,
        source: node.source,
        status: (node as Record<string, unknown>).status,
        externalId: node.externalId,
      }),
    })
    if (!res.ok) throw new Error('failed')
    const data = await res.json() as Record<string, unknown>
    return String(data.explanation ?? data.result ?? data.content ?? 'No explanation returned.')
  } catch {
    return `**${node.label}** (${node.node_type})\n\nClick "Ask in Chat" to get an explanation from the AI assistant.`
  }
}

function buildStaticCard(node: OntologyNode): string {
  const n = node as Record<string, unknown>
  const lines: string[] = [
    `## ${node.label}`,
    `**Type:** ${node.node_type}`,
    `**Source:** ${node.source}`,
  ]
  if (n.status) lines.push(`**Status:** ${String(n.status)}`)
  if (node.externalId) lines.push(`**ID:** \`${node.externalId}\``)
  if (n.environment) lines.push(`**Env:** ${String(n.environment)}`)
  if (n.region) lines.push(`**Region:** ${String(n.region)}`)
  if (n.language) lines.push(`**Language:** ${String(n.language)}`)
  if (n.version) lines.push(`**Version:** ${String(n.version)}`)
  return lines.join('\n\n')
}

export default function WorkspaceLearnPanel({
  selectedNode, allNodes, onNodeSelect, onAskAI,
}: WorkspaceLearnPanelProps) {
  const t = useGraphTheme()
  const {
    learnMode, learnContent, learnLoading, learnTourIndex,
    setLearnMode, setLearnContent, setLearnLoading, advanceTour, retreatTour,
  } = useWorkspaceStore()

  // Contextual mode — update card when selected node changes
  useEffect(() => {
    if (learnMode !== 'contextual' || !selectedNode) return
    setLearnContent(buildStaticCard(selectedNode))
  }, [selectedNode?.id, learnMode])

  // Tour mode — advance to current tour node
  useEffect(() => {
    if (learnMode !== 'tour' || allNodes.length === 0) return
    const node = allNodes[learnTourIndex % allNodes.length]
    if (node) {
      onNodeSelect(node)
      setLearnContent(buildStaticCard(node))
    }
  }, [learnTourIndex, learnMode, allNodes.length])

  const currentTourNode = learnMode === 'tour' && allNodes.length > 0
    ? allNodes[learnTourIndex % allNodes.length]
    : null

  const activeNode = learnMode === 'tour' ? currentTourNode : selectedNode

  async function handleExplainWithAI() {
    if (!activeNode) return
    setLearnLoading(true)
    const explanation = await fetchExplanation(activeNode)
    setLearnContent(explanation)
    setLearnLoading(false)
  }

  function handleAskInChat() {
    if (!activeNode) return
    onAskAI(
      `Explain how **${activeNode.label}** (type: ${activeNode.node_type}, source: ${activeNode.source}) fits into the overall architecture. What is its role and what does it connect to?`
    )
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--color-surface)',
    }}>
      {/* Header with mode toggle */}
      <div style={{
        padding: '0 12px', borderBottom: `1px solid var(--color-border)`,
        display: 'flex', alignItems: 'center', gap: 8,
        flexShrink: 0, height: 36,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: t.sectionLabel,
        }}>Learn</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
          {(['contextual', 'tour'] as LearnMode[]).map(m => (
            <button key={m} onClick={() => setLearnMode(m)}
              style={{
                fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
                background: learnMode === m ? t.accentBg : 'transparent',
                border: `1px solid ${learnMode === m ? t.accentBorder : t.panelCardBorder}`,
                color: learnMode === m ? t.accent : t.mutedText,
                cursor: 'pointer', textTransform: 'capitalize',
                transition: 'all 0.15s',
              }}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>

        {/* Tour navigation */}
        {learnMode === 'tour' && allNodes.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 12, padding: '6px 10px',
            background: t.panelCard, borderRadius: 8,
            border: `1px solid ${t.panelCardBorder}`,
          }}>
            <button onClick={retreatTour}
              style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 4,
                background: t.panelCard, border: `1px solid ${t.panelCardBorder}`,
                color: t.panelText, cursor: 'pointer',
              }}>←</button>
            <span style={{ flex: 1, textAlign: 'center', fontSize: 11, color: t.panelSubtext }}>
              {learnTourIndex % allNodes.length + 1} / {allNodes.length}
            </span>
            <button onClick={advanceTour}
              style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 4,
                background: t.panelCard, border: `1px solid ${t.panelCardBorder}`,
                color: t.panelText, cursor: 'pointer',
              }}>→</button>
          </div>
        )}

        {/* Empty state */}
        {!selectedNode && learnMode === 'contextual' && (
          <div style={{
            textAlign: 'center', padding: '24px 16px',
            color: t.panelSubtext, fontSize: 13,
          }}>
            <span style={{ fontSize: 32, opacity: 0.3, display: 'block', marginBottom: 8 }}>📚</span>
            Click a graph node to learn about it
          </div>
        )}

        {/* Content display */}
        {learnContent && (
          <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--color-text)' }}>
            {learnLoading ? (
              <div style={{ color: t.panelSubtext, fontSize: 12 }}>Generating explanation…</div>
            ) : (
              <pre style={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'var(--font-body, inherit)',
                margin: 0, fontSize: 13, lineHeight: 1.7,
                color: 'var(--color-text)',
              }}>
                {learnContent}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {activeNode && (
        <div style={{
          padding: '8px 12px', borderTop: `1px solid var(--color-border)`,
          display: 'flex', gap: 6, flexShrink: 0,
        }}>
          <button
            onClick={handleExplainWithAI}
            disabled={learnLoading}
            style={{
              flex: 1, padding: '7px 0', borderRadius: 7,
              background: learnLoading ? t.panelCard : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              border: 'none', color: '#fff', fontSize: 11, fontWeight: 700,
              cursor: learnLoading ? 'default' : 'pointer',
              opacity: learnLoading ? 0.6 : 1, transition: 'opacity 0.15s',
            }}>
            {learnLoading ? 'Loading…' : '✦ Explain with AI'}
          </button>
          <button
            onClick={handleAskInChat}
            style={{
              flex: 1, padding: '7px 0', borderRadius: 7,
              background: t.panelCard,
              border: `1px solid ${t.panelCardBorder}`,
              color: t.panelText, fontSize: 11, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = t.accentBg
              e.currentTarget.style.color = t.accent
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = t.panelCard
              e.currentTarget.style.color = t.panelText
            }}>
            Ask in Chat
          </button>
        </div>
      )}
    </div>
  )
}
