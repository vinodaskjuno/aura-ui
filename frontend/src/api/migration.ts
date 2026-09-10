import client from './client'

/**
 * Guided migration — any source stack to any target stack.
 *
 * The flow is a session that advances through stages, because the strategy is
 * amended at least once by design and conversion is many model calls. Both need
 * somewhere to live between clicks.
 */

export type Stage =
  | 'target' | 'architecture' | 'proposed' | 'revised'
  | 'finalized' | 'converting' | 'converted' | 'failed'

export type Verdict = 'migrate' | 'rewrite' | 'drop' | 'manual'

/** Where a component-mapping choice came from. Shown so a reviewer can ask why. */
export type Origin = 'inferred' | 'chat' | 'user' | 'unset'

export interface MigrationProfile {
  id: string
  source: string
  target: string
  label: string
  /** False for the generic path — the UI says which one you are watching. */
  curated: boolean
  componentMap: Record<string, string>
  knownRisks: string[]
  questions: string[]
}

export interface MappingRow {
  capability: string
  capabilityLabel: string
  technology: string
  origin: Origin
  /** How many services this was found in, and out of how many. */
  services: number
  totalServices: number
  confidence: 'strong' | 'mixed' | 'weak' | 'unknown'
  evidence: string[]
}

export interface StrategyComponent {
  name: string
  sourceType: string
  targetType: string
  verdict: Verdict
  confidence: number
  note: string
}

export interface Strategy {
  summary: string
  components: StrategyComponent[]
  risks: { severity: 'high' | 'medium' | 'low'; text: string }[]
  unknowns: string[]
  questions: { id: string; text: string; why: string }[]
  effort: { components: number; automatable: number; manual: number }
  /** Set when the plan looks suspiciously agreeable. Surfaced, not hidden. */
  warning?: string
}

export interface ConversionResult {
  component: string
  /** `empty` means the model returned no files — not migrated, whatever it said. */
  status: 'converted' | 'skipped' | 'failed' | 'empty'
  files: { filename: string; language: string; content?: string }[]
  notes: string[]
  todos: string[]
}

export interface MigrationSession {
  sessionId: string
  projectId: string
  projectName: string
  stage: Stage
  source: string
  target: string
  profileId: string
  curated: boolean
  mapping: MappingRow[]
  conversionShape: { granularity: string; extractShared: boolean; repoLayout: string }
  strategy: Strategy
  /** The mapping changed after this strategy was produced, so it no longer
   *  describes what would be generated. Re-analyse before converting. */
  strategyStale?: boolean
  archivedStrategies: { target: string; archivedAt: string }[]
  questions: Strategy['questions']
  answers: { questionId: string; question: string; answer: string }[]
  comments?: string[]
  components: StrategyComponent[]
  conversionProgress?: { done: number; total: number; current: string }
  conversionResults?: ConversionResult[]
  conversionFileCount?: number
  errors?: string[]
  artifactKey: string
  convertedProjectId: string
  createdAt: string
  updatedAt: string
}

export const getProfiles = async (): Promise<{
  pairs: MigrationProfile[]; targets: string[]
}> => (await client.get('/api/migration/profiles')).data

export const listSessions = async (projectId: string): Promise<MigrationSession[]> =>
  (await client.get(`/api/migration/projects/${encodeURIComponent(projectId)}/sessions`)).data

export const startSession = async (body: {
  projectId: string; source: string; target: string
}): Promise<MigrationSession> =>
  (await client.post('/api/migration/sessions', body)).data

const q = (sid: string, projectId: string, suffix = '') =>
  `/api/migration/sessions/${encodeURIComponent(sid)}${suffix}` +
  `?projectId=${encodeURIComponent(projectId)}`

export const getSession = async (sid: string, projectId: string): Promise<MigrationSession> =>
  (await client.get(q(sid, projectId))).data

export const getInferred = async (sid: string, projectId: string): Promise<{
  candidates: MappingRow[]
  mapping: MappingRow[]
  capabilities: { id: string; label: string }[]
}> => (await client.get(q(sid, projectId, '/inferred'))).data

export const putMapping = async (
  sid: string, projectId: string,
  mapping: MappingRow[], conversionShape?: MigrationSession['conversionShape'],
): Promise<MigrationSession> =>
  (await client.put(q(sid, projectId, '/mapping'), { mapping, conversionShape })).data

export const runStrategy = async (sid: string, projectId: string): Promise<MigrationSession> =>
  (await client.post(q(sid, projectId, '/strategy'))).data

export const submitAnswers = async (
  sid: string, projectId: string,
  answers: { questionId: string; question: string; answer: string }[],
  comments: string[] = [],
): Promise<MigrationSession> =>
  (await client.post(q(sid, projectId, '/answers'), { answers, comments })).data

export const finalize = async (sid: string, projectId: string): Promise<MigrationSession> =>
  (await client.post(q(sid, projectId, '/finalize'))).data

export const startConversion = async (sid: string, projectId: string): Promise<{
  accepted: boolean; components: number
}> => (await client.post(q(sid, projectId, '/convert'))).data

export const getDownload = async (sid: string, projectId: string): Promise<{
  url: string; expiresInSeconds: number; files: number
}> => (await client.get(q(sid, projectId, '/download'))).data

export const handoffToQa = async (sid: string, projectId: string): Promise<{
  projectId: string; created: boolean
}> => (await client.post(q(sid, projectId, '/handoff'))).data
