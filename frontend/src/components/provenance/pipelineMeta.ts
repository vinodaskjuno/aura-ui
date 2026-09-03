import {
  GitBranch, Plug, Globe, FileUp, Bot, FlaskConical, Sparkles,
  PenLine, HelpCircle, Shuffle, Sprout,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Attribution, Pipeline, Trigger } from '../../api/provenance'

/**
 * One visual identity per pipeline, defined once.
 *
 * The ribbon, the trace timeline, the canvas overlay legend and the Lineage page
 * all read from here. A source that looks like Git in one place and like something
 * else two panels over is worse than no colour at all — the whole value of the
 * overlay is that you learn the mapping once.
 *
 * Hues are given as light/dark pairs because the app ships three themes, two dark
 * and one light (see `useGraphTheme`). A single mid-tone that reads well on
 * #060c1a is not legible on #f0f4ff, and provenance is not worth showing if it
 * cannot be read.
 */
export interface PipelineMeta {
  id: Pipeline
  label: string
  icon: LucideIcon
  dark: string
  light: string
  /** Origin unknown — rendered hollow and dashed everywhere. */
  unknown?: boolean
}

export const PIPELINE_META: Record<Pipeline, PipelineMeta> = {
  'git':           { id: 'git',           label: 'Git',           icon: GitBranch,    dark: '#f59e0b', light: '#b45309' },
  'mcp':           { id: 'mcp',           label: 'MCP',           icon: Plug,         dark: '#a78bfa', light: '#6d28d9' },
  'api':           { id: 'api',           label: 'API',           icon: Globe,        dark: '#22d3ee', light: '#0e7490' },
  'file-upload':   { id: 'file-upload',   label: 'File upload',   icon: FileUp,       dark: '#2dd4bf', light: '#0f766e' },
  'dev-mate':      { id: 'dev-mate',      label: 'Dev Mate',      icon: Bot,          dark: '#60a5fa', light: '#1d4ed8' },
  'qa-mind':       { id: 'qa-mind',       label: 'QA Mind',       icon: FlaskConical, dark: '#34d399', light: '#047857' },
  'self-learning': { id: 'self-learning', label: 'Self-Learning', icon: Sparkles,     dark: '#e879f9', light: '#a21caf' },
  'manual':        { id: 'manual',        label: 'Manual',        icon: PenLine,      dark: '#94a3b8', light: '#475569' },
  'correlation':   { id: 'correlation',   label: 'Correlation',   icon: Shuffle,      dark: '#fb923c', light: '#c2410c' },
  'seed':          { id: 'seed',          label: 'Seed',          icon: Sprout,       dark: '#84cc16', light: '#4d7c0f' },
  'unattributed':  { id: 'unattributed',  label: 'Unattributed',  icon: HelpCircle,   dark: '#64748b', light: '#94a3b8', unknown: true },
}

export function pipelineMeta(id?: string | null): PipelineMeta {
  return PIPELINE_META[(id || 'unattributed') as Pipeline] ?? PIPELINE_META.unattributed
}

export function pipelineColor(id: string | null | undefined, isDark: boolean): string {
  const meta = pipelineMeta(id)
  return isDark ? meta.dark : meta.light
}

/**
 * Trigger is a SHAPE, not a colour.
 *
 * It has to be readable at the same time as the pipeline, and two colour scales
 * competing in one badge row is how a dashboard becomes unreadable. A glyph and a
 * hue occupy different channels, so both survive.
 */
export const TRIGGER_META: Record<Trigger, { label: string; glyph: string; hint: string }> = {
  manual:    { label: 'Manual',    glyph: '●', hint: 'A person asked for this' },
  scheduled: { label: 'Scheduled', glyph: '◆', hint: 'Run on a schedule' },
  automatic: { label: 'Automatic', glyph: '▲', hint: 'A system event caused this' },
  system:    { label: 'System',    glyph: '■', hint: 'Startup seed, migration or backfill' },
  unknown:   { label: 'Unknown',   glyph: '○', hint: 'Trigger not recorded' },
}

export function triggerMeta(id?: string | null) {
  return TRIGGER_META[(id || 'unknown') as Trigger] ?? TRIGGER_META.unknown
}

// ── Freshness ───────────────────────────────────────────────────────────────

export type Freshness = 'fresh' | 'recent' | 'stale' | 'unknown'

const HOUR = 3_600_000

export function freshnessOf(iso?: string | null): Freshness {
  if (!iso) return 'unknown'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return 'unknown'
  const age = Date.now() - t
  if (age < 24 * HOUR) return 'fresh'
  if (age < 7 * 24 * HOUR) return 'recent'
  return 'stale'
}

export const FRESHNESS_COLOR: Record<Freshness, { dark: string; light: string; label: string }> = {
  fresh:   { dark: '#34d399', light: '#047857', label: 'Seen in the last day' },
  recent:  { dark: '#fbbf24', light: '#b45309', label: 'Seen in the last week' },
  stale:   { dark: '#64748b', light: '#94a3b8', label: 'Not seen for over a week' },
  unknown: { dark: '#475569', light: '#cbd5e1', label: 'Never recorded' },
}

export function freshnessColor(iso: string | null | undefined, isDark: boolean): string {
  const f = FRESHNESS_COLOR[freshnessOf(iso)]
  return isDark ? f.dark : f.light
}

// ── Time ────────────────────────────────────────────────────────────────────

/**
 * "20m ago", "2h ago", "6d ago".
 *
 * `lensFormat.relative` only resolves to whole days and calls anything under 24
 * hours "today" — which is the wrong granularity here: the difference between a
 * node written twenty minutes ago and one written this morning is exactly what
 * someone opening a trace is trying to see.
 */
export function relTime(iso?: string | null): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '—'
  const secs = (Date.now() - t) / 1000
  if (secs < 0) return 'just now'
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  if (secs < 2592000) return `${Math.floor(secs / 86400)}d ago`
  if (secs < 31536000) return `${Math.floor(secs / 2592000)}mo ago`
  return `${(secs / 31536000).toFixed(1)}y ago`
}

export function absTime(iso?: string | null): string {
  if (!iso) return 'Not recorded'
  const t = Date.parse(iso)
  return Number.isNaN(t) ? String(iso) : new Date(t).toLocaleString()
}

export function fmtDuration(ms?: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  const rem = Math.round(s % 60)
  if (m < 60) return `${m}m ${rem}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

// ── Change types ────────────────────────────────────────────────────────────

export const CHANGE_COLOR: Record<string, string> = {
  CREATE: '#10b981',
  UPDATE: '#60a5fa',
  RETIRE: '#f87171',
  RELATIONSHIP_ADD: '#a78bfa',
  RELATIONSHIP_ARCHIVE: '#fbbf24',
  BULK_LOAD: '#94a3b8',
}

export function changeColor(changeType?: string): string {
  return CHANGE_COLOR[(changeType || '').toUpperCase()] ?? '#8a9adb'
}

/** Reads as prose in the timeline: "CREATE" is a database word, "Created" is not. */
export function changeVerb(changeType?: string): string {
  const map: Record<string, string> = {
    CREATE: 'Created',
    UPDATE: 'Updated',
    RETIRE: 'Retired',
    RELATIONSHIP_ADD: 'Linked',
    RELATIONSHIP_ARCHIVE: 'Unlinked',
    BULK_LOAD: 'Bulk loaded',
  }
  return map[(changeType || '').toUpperCase()] ?? (changeType || 'Changed')
}

// ── Attribution ─────────────────────────────────────────────────────────────

export function isUnattributed(attribution?: Attribution | string | null): boolean {
  return !attribution || attribution === 'none' || attribution === 'pre-trace'
}

export function attributionLabel(attribution?: Attribution | string | null): string {
  if (attribution === 'pre-trace') return 'Written before tracing began'
  if (attribution === 'none' || !attribution) return 'Origin not recorded'
  return 'Fully traced'
}
