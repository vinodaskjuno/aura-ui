import { Boxes, Database, FileText, Mail, Radio, Zap } from 'lucide-react'
import type { QaResources } from '../../api/qa'

/**
 * What was inside the cloud emulators — buckets, tables, queues, topics.
 *
 * This is the answer to the question a green test cannot answer. A passing case proves
 * the application responded; it does not prove the application reached anything, since
 * a route returning a literal passes identically with no emulator running at all. These
 * rows are read back out of the emulator itself, so they are evidence that it was used.
 *
 * Shared deliberately by three surfaces — the finished run's panel, the live inspect
 * drawer, and the DevMate control — so "a resource" looks the same wherever it is seen.
 */

const CLOUD_COLOUR: Record<string, string> = {
  aws: '#f59e0b', azure: '#38bdf8', gcp: '#ef4444', oci: '#a78bfa',
}

const SERVICE_ICON: Record<string, React.ReactNode> = {
  s3:       <Boxes size={12} />,
  dynamodb: <Database size={12} />,
  sqs:      <Mail size={12} />,
  sns:      <Radio size={12} />,
  lambda:   <Zap size={12} />,
}

const SERVICE_LABEL: Record<string, string> = {
  s3: 'S3', dynamodb: 'DynamoDB', sqs: 'SQS', sns: 'SNS', lambda: 'Lambda',
}

/** What the count means, in words. -1 is the cap, not a number. */
function countLabel(count: number | undefined, service: string): string {
  if (count === undefined || count === null) return ''
  if (count === -1) return '50+ items'
  const noun = service === 's3' ? 'object'
             : service === 'sqs' ? 'message'
             : 'item'
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

export default function ResourceTable({ resources, emptyReason }: {
  resources?: QaResources
  /** Why there is nothing to show. "No emulator ran" and "the emulator was empty" are
   *  different facts and the reader acts on them differently, so the caller says which. */
  emptyReason?: string
}) {
  const clouds = Object.entries(resources || {}).filter(([, s]) => Object.keys(s).length)

  if (!clouds.length) {
    return (
      <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0,
                  lineHeight: 1.7 }}>
        {emptyReason || 'No emulated cloud resources were found.'}
      </p>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {clouds.map(([cloud, services]) => (
        <div key={cloud} style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
                         padding: '2px 6px', borderRadius: 4, justifySelf: 'start',
                         color: CLOUD_COLOUR[cloud] ?? 'var(--color-text)',
                         background: `${CLOUD_COLOUR[cloud] ?? '#888'}22` }}>
            {cloud.toUpperCase()}
          </span>

          <div style={{ display: 'grid', gap: 2 }}>
            {Object.entries(services).map(([service, items]) =>
              items.map(item => (
                <div key={`${service}/${item.name}`}
                     style={{ display: 'flex', alignItems: 'center', gap: 9,
                              fontSize: 12, padding: '5px 8px', borderRadius: 6,
                              background: 'var(--color-surface-2, transparent)',
                              border: '1px solid var(--color-border)' }}>
                  <span style={{ color: 'var(--color-text-secondary)', display: 'flex',
                                 flexShrink: 0 }}>
                    {SERVICE_ICON[service] ?? <FileText size={12} />}
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 600, width: 68,
                                 flexShrink: 0,
                                 color: 'var(--color-text-secondary)' }}>
                    {SERVICE_LABEL[service] ?? service}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', overflow: 'hidden',
                                 textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={item.items?.length ? item.items.join('\n') : undefined}>
                    {item.name}
                  </span>
                  <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: 11,
                                 fontVariantNumeric: 'tabular-nums',
                                 color: 'var(--color-text-secondary)' }}>
                    {countLabel(item.count, service)}
                  </span>
                </div>
              )))}
          </div>
        </div>
      ))}
    </div>
  )
}
