import client from './client'

export interface Screenshot {
  key:      string
  url:      string
  filename: string
  failed:   boolean
}

export interface ContainerRunResult {
  session_id:        string
  run_id:            string
  status:            string
  total_screenshots: number
  total_passed:      number
  total_failed:      number
  log:               string[]
}

export interface TestRun {
  testRunId:         string
  projectId:         string
  userId:            string
  type:              'generation' | 'execution' | 'container_execution' | 'browser_use' | 'lambda' | string
  status:            string
  containerMode?:    string
  taskArn?:          string
  appUrl?:           string
  totalScreenshots?: number
  screenshots?:      string[]
  htmlReportKey?:    string
  suiteCount?: number
  totalTests?: number
  totalPassed?: number
  totalFailed?: number
  totalSkipped?: number
  createdAt: string
  completedAt?: string
  artifacts?: string[]
  results?: TestResult[]
}

export interface TestResult {
  file: string
  passed: number
  failed: number
  skipped: number
  duration: number
  status: string
}

// ── Local runs: evidence stored in S3 ────────────────────────────────────────
// report.json is the single object every surface reads — this UI, the CLI and the
// VS Code plugin — so a new surface never needs a new endpoint.

export interface RunStep {
  index:          number
  action:         string
  target:         string
  status:         'passed' | 'failed' | 'skipped' | 'unemulated'
  durationMs:     number
  error:          string
  screenshotKey:  string
  screenshotUrl?: string
  caseId:         string
  startedAt:      string
}

export interface EmulatorRecord {
  cloud:     string
  image:     string
  digest:    string
  port:      number
  container: string
  started:   boolean
  error:     string
}

export interface RunCase {
  case_id:        string
  kind:           'api' | 'ui' | 'smoke'
  name:           string
  verifies_label: string
  verifies_eid:   string
  method:         string
  path:           string
  source_file:    string
}

export interface RunReport {
  runId:           string
  projectId:       string
  appUrl:          string
  status:          'passed' | 'failed' | 'unavailable'
  reason:          string
  startedAt:       string
  completedAt:     string
  ranBy:           string
  totalPassed:     number
  totalFailed:     number
  totalSkipped:    number
  totalUnemulated: number
  durationMs:      number
  cases:           RunCase[]
  emulators:       EmulatorRecord[]
  covered:         { label: string; externalId: string }[]
  exploratory:     boolean
}

/**
 * Whether a run can execute AT ALL — either here, or on a connected self-hosted runner.
 *
 * `podman`/`browser`/`local` describe THIS backend; in a deployed Fargate task they are
 * always false, which is why they alone can no longer gate the button. `runners` is the
 * other way it can be true: an agent on a developer machine that has claimed and
 * heartbeated recently.
 */
export interface QaCapabilities {
  canRun:  boolean
  podman:  boolean
  browser: boolean
  /** This backend can execute a run itself (local development). */
  local:   boolean
  /** Self-hosted runners that reported within the last ~90s. */
  runners: { name: string; lastSeen: string }[]
  reason:  string
  clouds:  { name: string; port: number; image: string }[]
}

/** A run that has been queued but has not finished. S3 cannot see these at all —
 *  report.json is written last and its presence is the done signal. */
export interface QaActiveRun {
  runId:     string
  status:    'queued' | 'claimed' | 'running' | string
  phase:     string
  runner:    string
  appUrl:    string
  createdAt: string
  updatedAt: string
  /** Live counts from the runner's heartbeat, so a long run shows movement rather
   *  than sitting on the word "running". */
  totalPassed?:  number
  totalFailed?:  number
  totalSkipped?: number
  totalCases?:   number
}

export interface TestArtifact {
  key: string
  url: string
  filename: string
}

export const qaApi = {
  listProjects: () => client.get('/api/qa/projects'),
  getSuites: (projectId: string) => client.get<TestRun[]>(`/api/qa/projects/${projectId}/suites`),
  getRunDetail: (runId: string) => client.get<TestRun>(`/api/qa/runs/${runId}`),
  getArtifacts: (runId: string) => client.get<TestArtifact[]>(`/api/qa/runs/${runId}/artifacts`),
  getActivity: () => client.get('/api/qa/activity'),

  // Local execution: podman emulators + Playwright, evidence in S3
  capabilities: () => client.get<QaCapabilities>('/api/qa/capabilities'),
  runLocal: (data: { project_id: string; app_url: string; run_id?: string; exploratory?: boolean }) =>
    client.post<RunReport>('/api/qa/run/local', data),
  /** Stored runs from S3. A bare array — see the note in the backend handler. */
  listResults: (projectId: string) =>
    client.get<RunReport[]>(`/api/qa/results/${projectId}`),

  /**
   * Runs that are queued or executing.
   *
   * Its own endpoint rather than a field on listResults, because widening that
   * response broke any browser holding the previous bundle — an object arrived where
   * an array was expected and the run list crashed with "n.map is not a function".
   * An older client never calls this one at all.
   */
  activeRuns: (projectId: string) =>
    client.get<{ active: QaActiveRun[] }>(`/api/qa/active/${projectId}`),

  /**
   * Queue a run. Returns as soon as it is queued — nothing has executed yet.
   *
   * A self-hosted runner claims it and executes it elsewhere, so this deliberately
   * does not wait: the run outlives the browser tab, which the WebSocket-driven local
   * run does not.
   */
  enqueueRun: (projectId: string, appUrl = '', exploratory = false) =>
    client.post<{ runId: string; projectId: string; status: string }>(
      '/api/qa/runs', { project_id: projectId, app_url: appUrl, exploratory }),
  getResult: (projectId: string, runId: string) =>
    client.get<{ report: RunReport; steps: RunStep[] }>(`/api/qa/results/${projectId}/${runId}`),
}

export const TEST_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; desc: string }> = {
  playwright_ui: { label: 'Playwright UI',    icon: 'Monitor',      color: '#4f8ef7', desc: 'End-to-end browser tests' },
  api:           { label: 'API Testing',      icon: 'Plug2',        color: '#10b981', desc: 'REST endpoint validation' },
  integration:   { label: 'Integration',      icon: 'GitMerge',     color: '#8b5cf6', desc: 'Cross-service flow tests' },
  regression:    { label: 'Regression',       icon: 'RefreshCw',    color: '#f59e0b', desc: 'Diff-based change detection' },
  negative:      { label: 'Negative',         icon: 'XCircle',      color: '#ef4444', desc: 'Invalid input handling' },
  boundary:      { label: 'Boundary',         icon: 'SlidersHorizontal', color: '#06b6d4', desc: 'Min/max/null/overflow cases' },
}
