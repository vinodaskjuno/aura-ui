/**
 * Block dispatcher. One entry per `kind` on the wire.
 *
 * An unknown kind renders nothing rather than throwing — the server may ship a
 * new block type before the UI knows about it, and a role's whole dashboard
 * going blank is a worse outcome than one missing section.
 */
import type { Block } from '../../api/dashboardView'
import { MetricRow } from './MetricRow'
import { DataList } from './DataList'
import { PipelineBoard } from './PipelineBoard'
import { SectionLabel } from './SectionLabel'

export function renderBlock(block: Block, key: string, delay = 0, accent?: string) {
  switch (block.kind) {
    case 'metrics':  return <MetricRow key={key} block={block} delay={delay} accent={accent} />
    case 'list':     return <DataList key={key} block={block} delay={delay} accent={accent} />
    case 'pipeline': return <PipelineBoard key={key} block={block} delay={delay} accent={accent} />
    case 'note':
      return (
        <section key={key} style={{ display: 'flex', flexDirection: 'column',
                                    gap: 'var(--space-2)' }}>
          <SectionLabel accent={accent}>{block.title}</SectionLabel>
          <p style={{ fontSize: 'var(--text-body)', color: 'var(--color-subtext)',
                      margin: 0, maxWidth: '62ch' }}>{block.text}</p>
        </section>
      )
    default:
      return null
  }
}
