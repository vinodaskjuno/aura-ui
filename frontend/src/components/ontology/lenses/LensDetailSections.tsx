/**
 * Renders a lens's detail sections inside OntologyDetailPanel.
 *
 * The generic panel can only show flat properties; these sections answer the
 * questions that need the graph — "how does this reach production", "what
 * breaks if this dies", "is this compliant".
 */
import { useGraphTheme } from '../../../hooks/useGraphTheme'
import { formatField, thresholdColor } from './lensFormat'
import { chain, neighbours, reachable, reachableLayered } from './lensSelectors'
import type { LensDataContext, LensDefinition, LensDetailSection } from './lensTypes'
import type { OntologyNode } from '../../../api/ontologyUniverse'

interface Props {
  node: OntologyNode
  lens: LensDefinition
  ctx: LensDataContext
  onFocusNodes?: (ids: string[]) => void
  onSelectNode?: (n: OntologyNode) => void
}

export default function LensDetailSections({ node, lens, ctx, onFocusNodes, onSelectNode }: Props) {
  const t = useGraphTheme()
  const sections = lens.detail?.sections ?? []
  if (!sections.length) return null

  const type = ctx.typeOf(node)
  const applicable = sections.filter(s => !s.forTypes || s.forTypes.includes(type))
  if (!applicable.length) return null

  return (
    <>
      {applicable.map(section => (
        <Section
          key={section.id}
          section={section}
          node={node}
          ctx={ctx}
          lens={lens}
          theme={t}
          onFocusNodes={onFocusNodes}
          onSelectNode={onSelectNode}
        />
      ))}
    </>
  )
}

type Theme = ReturnType<typeof useGraphTheme>

function Header({ label, theme, right }: { label: string; theme: Theme; right?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6,
      fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '1.1px', color: theme.sectionLabel,
    }}>
      {label}
      {right}
    </div>
  )
}

function Chip({ n, theme, color, onClick }: {
  n: OntologyNode; theme: Theme; color?: string; onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={n.label}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '3px 8px', borderRadius: 6, maxWidth: '100%',
        background: theme.panelCard,
        border: `1px solid ${color ?? theme.panelCardBorder}55`,
        color: theme.panelText, fontSize: 10, cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <span style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: color ?? theme.mutedText,
      }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {n.label}
      </span>
    </button>
  )
}

function Section({ section, node, ctx, lens, theme, onFocusNodes, onSelectNode }: {
  section: LensDetailSection
  node: OntologyNode
  ctx: LensDataContext
  lens: LensDefinition
  theme: Theme
  onFocusNodes?: (ids: string[]) => void
  onSelectNode?: (n: OntologyNode) => void
}) {
  const box: React.CSSProperties = {
    marginBottom: 10, padding: '9px 10px', borderRadius: 8,
    background: theme.panelCard, border: `1px solid ${theme.panelCardBorder}`,
  }
  const colorOf = (n: OntologyNode) => lens.nodeTypes[ctx.typeOf(n)]?.color

  const focusButton = (nodes: OntologyNode[]) =>
    section.focusable && nodes.length && onFocusNodes ? (
      <button
        onClick={() => onFocusNodes([node.id, ...nodes.map(n => n.id)])}
        style={{
          marginLeft: 'auto', padding: '1px 7px', borderRadius: 4,
          background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.45)',
          color: '#fbbf24', fontSize: 8, fontWeight: 700, cursor: 'pointer',
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}
      >Highlight</button>
    ) : null

  switch (section.kind.type) {
    case 'fields': {
      const props = node as unknown as Record<string, unknown>
      const rows = section.kind.fields.filter(f => {
        const v = props[f.key]
        return v !== undefined && v !== null && v !== ''
      })
      if (!rows.length) return null
      return (
        <div style={box}>
          <Header label={section.label} theme={theme} />
          {rows.map(f => {
            const v = props[f.key]
            const danger = thresholdColor(v, f.thresholds)
            return (
              <div key={f.key} style={{
                display: 'flex', gap: 8, fontSize: 11, padding: '2px 0',
              }}>
                <span style={{ color: theme.panelSubtext, minWidth: 92 }}>{f.label}</span>
                <span style={{
                  flex: 1, textAlign: 'right', fontWeight: 600,
                  color: danger ?? theme.panelText,
                  fontFamily: f.format === 'mono' || f.format === 'pathTail'
                    ? '"Courier New", monospace' : undefined,
                  wordBreak: 'break-all',
                }}>
                  {formatField(v, f.format)}{f.suffix ?? ''}
                </span>
              </div>
            )
          })}
        </div>
      )
    }

    case 'chain': {
      const steps = chain(ctx, node, section.kind.steps)
      if (!steps.length) return null
      const all = steps.flatMap(s => s.nodes)
      return (
        <div style={box}>
          <Header label={section.label} theme={theme} right={focusButton(all)} />
          {steps.map((s, i) => (
            <div key={`${s.rel}-${i}`} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '3px 0' }}>
              <span style={{
                fontSize: 8, fontFamily: 'monospace', color: theme.mutedText,
                minWidth: 88, paddingTop: 4,
              }}>{s.rel}</span>
              <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {s.nodes.length
                  ? s.nodes.map(n => (
                      <Chip key={n.id} n={n} theme={theme} color={colorOf(n)}
                            onClick={onSelectNode ? () => onSelectNode(n) : undefined} />
                    ))
                  : (
                    // A broken chain is the answer, not an error state.
                    <span style={{ fontSize: 10, color: '#f87171', fontWeight: 600 }}>
                      chain ends here — no {s.rel} edge
                    </span>
                  )}
              </div>
            </div>
          ))}
        </div>
      )
    }

    case 'reachable':
    case 'related': {
      const k = section.kind
      const found = k.type !== 'reachable'
        ? neighbours(ctx, node, { rels: k.rels, dir: k.dir, types: k.types })
        : k.seedRels
          ? reachableLayered(ctx, node, {
              seedRels: k.seedRels, rels: k.rels ?? [], dir: k.dir,
              targetTypes: k.targetTypes, maxHops: k.maxHops })
          : reachable(ctx, node, { rels: k.rels, dir: k.dir, targetTypes: k.targetTypes, maxHops: k.maxHops })
      if (!found.length) return null
      return (
        <div style={box}>
          <Header
            label={`${section.label} (${found.length})`}
            theme={theme}
            right={focusButton(found)}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {found.slice(0, 40).map(n => (
              <Chip key={n.id} n={n} theme={theme} color={colorOf(n)}
                    onClick={onSelectNode ? () => onSelectNode(n) : undefined} />
            ))}
            {found.length > 40 && (
              <span style={{ fontSize: 9, color: theme.mutedText, alignSelf: 'center' }}>
                +{found.length - 40} more
              </span>
            )}
          </div>
        </div>
      )
    }

    case 'compliance': {
      const checks = section.kind.checks.map(c => ({ ...c, result: c.pass(node, ctx) }))
      return (
        <div style={box}>
          <Header label={section.label} theme={theme} />
          {checks.map(c => (
            <div key={c.label} title={c.hint} style={{
              display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, padding: '2px 0',
            }}>
              <span style={{
                width: 13, textAlign: 'center', fontWeight: 800,
                // null renders grey "unknown" — never green. Missing evidence is
                // not a pass.
                color: c.result === true ? '#22c55e' : c.result === false ? '#ef4444' : theme.mutedText,
              }}>
                {c.result === true ? '✓' : c.result === false ? '✗' : '–'}
              </span>
              <span style={{ color: theme.panelText, flex: 1 }}>{c.label}</span>
              {c.result === null && (
                <span style={{ fontSize: 9, color: theme.mutedText }}>unknown</span>
              )}
            </div>
          ))}
        </div>
      )
    }
  }
}
