import { Boxes, Database, FileText, Mail, Radio, Zap } from 'lucide-react'
import type { QaResources } from '../../api/qa'

/**
 * What is inside the cloud emulators, laid out like Floci's own console.
 *
 * Deliberately shaped after the Floci dashboard — a stat strip, then a card per service,
 * then the resources themselves — so the two read as views of the same thing and a demo
 * can cut between them without the audience re-orienting.
 *
 * Two honesty rules are borrowed with the layout, and they are the reason this is not
 * just a prettier list. Floci's own stance is "no fake resources, no demo rows, no mock
 * operational data", and the corollaries matter:
 *
 *   * a service that IS inventoried and empty shows 0 — a real measurement
 *   * a service Aura does not inventory is absent, never shown as 0 — "we did not look"
 *     and "there is nothing there" are different claims and only one is reassuring
 *
 * Shared by the run panel, the live inspect drawer and the DevMate control, so a
 * resource looks the same wherever it is seen.
 */

const CLOUD_COLOUR: Record<string, string> = {
  aws: '#f59e0b', azure: '#38bdf8', gcp: '#ef4444', oci: '#a78bfa',
}

/** Floci groups by capability rather than by API name, and so does this. */
const SERVICE: Record<string, { label: string; group: string; icon: React.ReactNode
                                noun: string }> = {
  s3:       { label: 'Storage',    group: 'STORAGE',   icon: <Boxes size={15} />,    noun: 'object' },
  dynamodb: { label: 'Database',   group: 'DATABASES', icon: <Database size={15} />, noun: 'item' },
  sqs:      { label: 'Queue',      group: 'MESSAGING', icon: <Mail size={15} />,     noun: 'message' },
  sns:      { label: 'Notify',     group: 'MESSAGING', icon: <Radio size={15} />,    noun: 'topic' },
  lambda:   { label: 'Serverless', group: 'COMPUTE',   icon: <Zap size={15} />,      noun: 'function' },
}

function look(service: string) {
  return SERVICE[service]
    ?? { label: service, group: 'OTHER', icon: <FileText size={15} />, noun: 'resource' }
}

function plural(n: number, noun: string) {
  return `${n} ${noun}${n === 1 ? '' : 's'}`
}

export default function ResourceTable({ resources, emptyReason, endpoint }: {
  resources?: QaResources
  /** Why there is nothing to show. "No emulator ran" and "the emulator was empty" are
   *  different facts, so the caller says which. */
  emptyReason?: string
  /** Shown in the stat strip, like Floci's own "Connected http://…". */
  endpoint?: string
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
    <div style={{ display: 'grid', gap: 16 }}>
      {clouds.map(([cloud, services]) => {
        const entries = Object.entries(services)
        const total = entries.reduce((n, [, items]) => n + items.length, 0)
        const accent = CLOUD_COLOUR[cloud] ?? '#888'

        return (
          <div key={cloud} style={{ display: 'grid', gap: 10 }}>

            {/* Stat strip — Floci's Console Home header. */}
            <div style={{ display: 'grid', gap: 1,
                          gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
                          border: '1px solid var(--color-border)', borderRadius: 8,
                          overflow: 'hidden', background: 'var(--color-border)' }}>
              <Stat label="CLOUD" value={cloud.toUpperCase()} colour={accent}
                    sub={endpoint} />
              <Stat label="RUNTIME" value="reachable" colour="#10b981"
                    sub="answered this request" />
              <Stat label="SERVICES" value={String(entries.length)}
                    sub="with resources" />
              <Stat label="RESOURCES" value={String(total)} sub="across all services" />
            </div>

            {/* A card per service. */}
            <div style={{ display: 'grid', gap: 8,
                          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
              {entries.map(([service, items]) => {
                const l = look(service)
                const count = items.reduce(
                  (n, i) => n + (i.count === -1 ? 50 : (i.count ?? 0)), 0)
                const capped = items.some(i => i.count === -1)
                return (
                  <div key={service}
                       style={{ border: '1px solid var(--color-border)', borderRadius: 8,
                                padding: '10px 12px', display: 'grid', gap: 6,
                                background: 'var(--color-surface-2, transparent)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: accent, display: 'flex' }}>{l.icon}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 650 }}>{l.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5,
                                  fontSize: 10.5, color: '#10b981' }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%',
                                     background: '#10b981' }} />
                      available
                    </div>
                    <div style={{ fontSize: 19, fontWeight: 700,
                                  fontVariantNumeric: 'tabular-nums' }}>
                      {items.length}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--color-text-secondary)' }}>
                      {plural(items.length, 'resource')}
                      {count > 0 && ` · ${capped ? '50+' : count} ${l.noun}${count === 1 ? '' : 's'}`}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* And the resources themselves, because a count is not a name. */}
            <div style={{ display: 'grid', gap: 2 }}>
              {entries.map(([service, items]) =>
                items.map(item => {
                  const l = look(service)
                  return (
                    <div key={`${service}/${item.name}`}
                         style={{ display: 'flex', alignItems: 'center', gap: 9,
                                  fontSize: 12, padding: '5px 9px', borderRadius: 6,
                                  border: '1px solid var(--color-border)' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, width: 68,
                                     flexShrink: 0,
                                     color: 'var(--color-text-secondary)' }}>
                        {l.label}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', overflow: 'hidden',
                                     textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={item.items?.length ? item.items.join('\n') : undefined}>
                        {item.name}
                      </span>
                      <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: 11,
                                     fontVariantNumeric: 'tabular-nums',
                                     color: 'var(--color-text-secondary)' }}>
                        {item.count === undefined || item.count === null ? ''
                          : item.count === -1 ? `50+ ${l.noun}s`
                          : plural(item.count, l.noun)}
                      </span>
                    </div>
                  )
                }))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Stat({ label, value, sub, colour }: {
  label: string; value: string; sub?: string; colour?: string
}) {
  return (
    <div style={{ background: 'var(--color-surface)', padding: '9px 11px',
                  display: 'grid', gap: 2 }}>
      <div style={{ fontSize: 9, letterSpacing: '.08em', fontWeight: 700,
                    color: 'var(--color-text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700,
                    color: colour ?? 'var(--color-text)' }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 9.5, color: 'var(--color-text-secondary)',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap' }} title={sub}>{sub}</div>
      )}
    </div>
  )
}
