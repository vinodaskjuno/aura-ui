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
  /** Cases the runner could not emulate — no Floci image for the dependency. */
  totalUnemulated?: number
  /** Cases PLANNED. Kept on the finished row so a completed run can still
   *  answer "how many were there", which the pass/fail tallies alone cannot. */
  totalCases?: number
  createdAt: string
  completedAt?: string
  artifacts?: string[]
  results?: TestResult[]
  /** This run stored evidence in S3, so the full detail view can open it. Runs from
   *  the old generation agent have none. */
  hasEvidence?: boolean
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
  /** It was already running when the run began — started by `floci-cli` or from
   *  DevMate — so this run adopted it and left it alone at the end. */
  adopted?:  boolean
}

export interface RunCase {
  case_id:        string
  kind:           CaseKind
  name:           string
  verifies_label: string
  verifies_eid:   string
  method:         string
  path:           string
  source_file:    string
  /** Non-empty means the case was planned but cannot execute, and says why —
   *  "POST needs a request body the graph does not describe". */
  skip_reason?:   string
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
  covered:         { label: string; externalId: string; result?: string }[]
  /** Which kinds the person chose. Empty on a full run, and absent on any report
   *  written before the picker existed. */
  selectedKinds?:  CaseKind[]
  /** Cases in the FULL plan, before filtering — so a partial run is legible as one. */
  planTotal?:      number
  coverage?:       QaCoverage
  exploratory:     boolean
  /** What was inside the emulators when the run finished. Absent from every report
   *  written before this existed, which is not the same as an empty emulator. */
  resources?:      QaResources
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
  /** The commands to offer, in order. Structured because the panel used to scrape
   *  `reason` for a line starting with `python -m`. */
  commands?: string[]
  clouds:  { name: string; port: number; image: string }[]
}

/** A run that has been queued but has not finished. S3 cannot see these at all —
 *  report.json is written last and its presence is the done signal. */
export interface QaActiveRun {
  runId:     string
  status:    'queued' | 'claimed' | 'running' | string
  phase:     string
  runner:    string
  /** The machine this run is executing on, as its operator names it — stamped on the
   *  run when it was claimed, so it outlives the machine going offline. */
  runnerMachine?: string
  runnerOwner?:   string
  appUrl:    string
  createdAt: string
  updatedAt: string
  /** Live counts from the runner's heartbeat, so a long run shows movement rather
   *  than sitting on the word "running". */
  totalPassed?:     number
  totalFailed?:     number
  totalSkipped?:    number
  totalUnemulated?: number
  totalCases?:      number
  /** What the run is doing right now, in words — "aws emulator ready on :4566". */
  phaseDetail?: string
  /** Why it ended badly, when it did — "cancelled by alice". */
  reason?: string
  kinds?: CaseKind[]
  /** Floci containers serving this run, as the runner last reported them. */
  emulators?: LiveEmulator[]
  /** The run's own console — what has happened so far, oldest first. */
  activity?: RunActivity[]
  /** The runner went quiet: these containers are almost certainly gone. */
  emulatorsStale?: boolean
}

export type CaseKind = 'ui' | 'api' | 'smoke' | 'structure' | 'stack' | 'policy'

/** One line of a run's console: when, which phase, and what happened. */
export interface RunActivity {
  at:    string
  phase: string
  text:  string
}

/** One Floci container, as reported by the machine running it. */
export interface LiveEmulator {
  cloud:      string
  image?:     string
  digest?:    string
  port?:      number
  container?: string
  started?:   boolean
  stopped?:   boolean
  error?:     string
}

/** What a run WOULD do, so a choice can be offered before starting one. */
export interface QaPlanPreview {
  projectId:     string
  totalCases:    number
  runnableCases: number
  counts:        Record<CaseKind, number>
  cases:         RunCase[]
  clouds:        string[]
  graphTotals:   { apis: number; services: number }
  /** False when the project has no API or Service nodes — a different problem from
   *  "no cases", and the only one the user can act on. */
  graphReady:    boolean
  reason:        string
}

/**
 * Two numbers, because either alone misleads.
 *
 * `nodePct` is how much of the application is known to work; `executionPct` is how
 * much of the plan the harness could carry out. A run can score 100% execution and
 * 20% coverage — everything it chose to run ran, but most of the app was never
 * selected.
 *
 * `nodePct` is null, never 0, when there is nothing to measure.
 */
export interface QaCoverage {
  nodeTotal:    number
  nodeCovered:  number
  nodePct:      number | null
  api:          { total: number; covered: number; pct: number | null }
  service:      { total: number; covered: number; pct: number | null; note: string }
  planned:      number
  executed:     number
  executionPct: number | null
  skipped:      number
  unemulated:   number
  /** skipped + unemulated: how much of the plan could never have worked. A run
   *  reporting "0 failed" and a run where nothing executed are otherwise
   *  indistinguishable, and the second is the common case. */
  untestable:    number
  untestablePct: number | null
  /** Nodes the project has that this run's plan never referenced — an excluded kind,
   *  or a node added since. Counted in the denominator, so the UI must account for
   *  them or the arithmetic looks wrong on screen. */
  notPlanned: number
  /** The denominator came from the plan, not the graph, so it understates a filtered
   *  run. Worth saying out loud rather than presenting as project coverage. */
  denominatorFromPlan: boolean
  uncovered: {
    externalId: string
    label:      string
    name:       string
    method?:    string
    path?:      string
    result:     string
    reason:     string
  }[]
  runId: string
}

/** A machine that can execute runs, and what it is running right now. */
/** One app a runner is keeping alive for a project.
 *
 *  `url` is a LOOPBACK address on the runner's machine. It resolves on that machine
 *  and nowhere else, so it must only ever be rendered as a link to its owner — see
 *  the `mine` check FlociControl already makes for the Floci dashboard. */
export interface QaAppSession {
  projectId: string
  sessionId: string
  kind: string
  name: string
  url: string
  port: number
  pid: number
  compose: boolean
  healthy: boolean
  instrumented: boolean
  /** Why tracing is off, when the reader asked for it and it could not be done. */
  instrumentationError?: string
  startedAt: string
  runner: string
  ownerId?: string
  /** The runner has not reported recently. Last-known, never a live claim. */
  stale?: boolean
  appsAt?: string
}

export interface QaRunner {
  name:           string
  lastSeen:       string
  online:         boolean
  /** The report is older than the staleness window: these containers are LAST KNOWN,
   *  not current. A sleeping laptop must not look like a busy one. */
  stale:          boolean
  podman:         boolean
  browser:        boolean
  podmanVersion?: string
  browserVersion?: string
  os?:            string
  /** Who this machine belongs to, derived by the API from the gateway key — never
   *  self-reported. Absent until an upgraded runner's first poll. */
  owner?:         string
  ownerId?:       string
  /** What its operator calls it. Absent from a runner that predates this, in which
   *  case every reader falls back to `name`. */
  machine?:       string
  /** Floci's own dashboard, if the operator is running it. Reported BY the runner —
   *  the browser cannot probe localhost from an HTTPS page without tripping
   *  mixed-content, and the runner is already on the machine. */
  flociUi?:       { running: boolean; port?: number }
  busyRunId?:     string
  protocol:       number
  /** Protocol 1 agents never report state, so an empty container list from one means
   *  "cannot tell", not "nothing running". */
  reportsState:   boolean
  containers:     QaContainer[]
  containersAt:   string
  /** What the runner says is wrong with itself. Absent from an older agent, which is
   *  "we did not ask" — a different thing from "everything is fine". */
  health?:        QaRunnerHealth
  /** A setup the USER started on that machine, reported outward as it runs. Aura
   *  never starts one. */
  setup?:         QaRunnerSetup
  /** What this machine is doing for each project right now, without their logs. */
  jobs?:          QaJob[]
  /** Empty means this agent is too old to report jobs — NOT that nothing is running,
   *  the same distinction `reportsState` draws from `containersAt`. */
  jobsAt?:        string
}

export interface QaRunnerHealth {
  ok:        boolean
  platform?: string
  checkedAt?: string
  findings:  QaFinding[]
}

export interface QaFinding {
  check:    string
  /** `blocks` stops a run outright; `degrades` limits what it can test. */
  severity: 'blocks' | 'degrades' | string
  title:    string
  detail?:  string
  /** The exact commands for that machine. Rendered to copy — never run from here. */
  remedy?:  string[]
}

export interface QaRunnerSetup {
  active: boolean
  step:   string
  index:  number
  total:  number
  log:    { at: string; text: string }[]
}

/** Long-running work a runner is doing FOR A PROJECT, reported as it goes.
 *
 *  The sibling of `QaRunnerSetup` and deliberately the same shape, so the same
 *  `ProgressBar` renders both. It differs in being project-scoped, which is why it
 *  carries `projectId` and `commandId` — without the latter a panel cannot tell the
 *  job belonging to the command it is watching from one left over from a superseded
 *  command, and `COMMAND_DEDUPE_S` makes that a real case rather than a theoretical one.
 *
 *  `index` counts stages COMPLETED, so the bar is `index/total` and never an estimate.
 *  A failure leaves it where it stopped, which is the whole point: "2 of 7 · Locating
 *  the app · failed" says more than a bar snapped to 0 or 100. */
export interface QaJob {
  kind:      'populate' | 'emulator-start' | 'emulator-stop' | 'app-start' | 'app-stop'
  projectId: string
  commandId: string
  active:    boolean
  step:      string
  index:     number
  total:     number
  ok:        boolean
  error:     string
  startedAt: string
  endedAt:   string
  /** Present only on the per-project endpoint. The runners index drops it, because one
   *  400 KB item is shared by every runner. */
  log?:      { at: string; text: string }[]
  runner?:   string
  machine?:  string
  /** The runner has gone quiet, so this is LAST KNOWN. A frozen bar and a slow one look
   *  identical without it. */
  stale?:    boolean
}

export interface QaContainer {
  id:        string
  name:      string
  image:     string
  status:    string
  ports:     string
  createdAt: string
  cloud:     string
  /** Started by Aura. Only these can have their logs fetched. */
  managed:   boolean
}

export interface QaContainerLogs {
  status:     'pending' | 'ready' | 'failed' | 'superseded'
  container:  string
  lines?:     string[]
  fetchedAt?: string
  truncated?: boolean
  error?:     string
  requestedAt?: string
}

/** One emulated cloud resource. `count` is absent where the notion does not apply (an
 *  SNS topic has no items), and -1 means the listing was capped — rendered "50+" rather
 *  than a number that would understate it. */
export interface QaResource {
  name:   string
  count?: number
  items?: string[]
}

/** {cloud: {service: resources}} — what was inside the emulators. */
export type QaResources = Record<string, Record<string, QaResource[]>>

/** What a run spent on model calls. Zero today, by design — see `runCost`. */
export interface QaRunCost {
  runId:      string
  projectId:  string
  /** Model calls made during the run. 0 means none were made, which is not the same
   *  as $0.00 of measured spend. */
  calls:      number
  inputTokens:          number
  outputTokens:         number
  cacheReadTokens:      number
  cacheCreationTokens:  number
  totalTokens: number
  costUsd:     number
  byModel: { model: string; calls: number; cost: number
             inputTokens: number; outputTokens: number }[]
}

/** A live read of one emulator, from the runner. Up to one poll interval old — the
 *  drawer says so rather than calling itself live. */
export interface QaEmulatorInventory {
  /** `superseded`: a newer request replaced this one — re-ask rather than wait. The
   *  runner row holds a single command slot. */
  status:     'pending' | 'ready' | 'failed' | 'superseded'
  cloud:      string
  resources?: QaResources
  fetchedAt?: string
  error?:     string
  requestedAt?: string
}

/** One NIST control evaluated against the project's IaC. */
export interface QaPolicyControl {
  id:      string
  name:    string
  file:    string
  control: string
  passed:  boolean
  /** What was checked — and, on a pass, what was NOT. These read declared intent, so
   *  the message says so rather than implying a deployed resource was inspected. */
  detail:  string
}

/** One control's verdict on ONE resource. */
export interface QaPolicyResourceControl {
  id:     string
  title:  string
  ok:     boolean
  detail: string
  remedy: string
}

/** A declared resource and the controls that apply to it.
 *  `applicable: 0` means NO control reads this resource type — which is not the same as
 *  passing, and must never be rendered as though it were. */
export interface QaPolicyResource {
  name:       string
  type:       string
  file:       string
  applicable: number
  passed:     number
  controls:   QaPolicyResourceControl[]
}

export interface QaPolicy {
  /** False when the project ships no IaC. Distinct from "everything passed": a project
   *  nobody assessed and a clean one are different facts. */
  applicable: boolean
  controls:   QaPolicyControl[]
  passed:     number
  total:      number
  reason?:    string
  /** The same evaluation pivoted by resource. Absent on an older server. */
  resources?:             QaPolicyResource[]
  resourceTotal?:         number
  resourcesWithFindings?: number
  resourcesNotChecked?:   number
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
  runLocal: (data: { project_id: string; app_url: string; run_id?: string; kinds?: CaseKind[] }) =>
    client.post<RunReport>('/api/qa/run/local', data),

  /** What a run would do, before starting one. */
  planPreview: (projectId: string) =>
    client.get<QaPlanPreview>(`/api/qa/projects/${projectId}/plan`),
  projectCoverage: (projectId: string) =>
    client.get<{ projectId: string; runId: string; ranAt: string; coverage: QaCoverage | null }>(
      `/api/qa/projects/${projectId}/coverage`),
  /** Stop a queued or executing run.
   *
   *  It does NOT reach the runner — that polls and has no inbound port, and may be a
   *  laptop that is asleep. It takes the run out of the live set, so the Results tab
   *  stops showing something that will never finish and a project delete is no longer
   *  blocked by it. */
  cancelRun: (projectId: string, runId: string) =>
    client.post<{ ok: boolean; runId: string; status: string }>(
      `/api/qa/runs/${runId}/cancel`, null, { params: { projectId } }),

  /** A single run's counters. A GetItem on the backend — safe to poll. */
  runProgress: (projectId: string, runId: string) =>
    client.get(`/api/qa/runs/${runId}/progress`, { params: { projectId } }),

  // ── The machine doing the work ───────────────────────────────────────────
  /** What a run spent on model calls. 503 when this deployment's token-usage table
   *  predates the projectId index — an absence, deliberately not reported as zero. */
  runCost: (runId: string, projectId: string) =>
    client.get<QaRunCost>(`/api/qa/runs/${runId}/cost`, { params: { projectId } }),
  /** Ask a runner what is in one of its live emulators. Answered on its NEXT poll —
   *  a round trip, not a stream. */
  requestInventory: (runner: string, cloud: string, projectId = '') =>
    client.post<{ commandId: string; status: string }>(
      '/api/qa/runners/inventory', { runner, cloud, projectId }),
  getInventory: (runner: string, commandId: string) =>
    client.get<QaEmulatorInventory>(`/api/qa/runners/inventory/${commandId}`,
                                    { params: { runner } }),
  /** The outcome of a parked command. Start and Stop are fire-and-park, so this is the
   *  only way the UI learns that one FAILED rather than merely being slow. */
  commandStatus: (runner: string, commandId: string) =>
    client.get<{ status: 'pending' | 'ready' | 'failed' | 'superseded'
                 error?: string; reason?: string }>(
      `/api/qa/runners/command/${commandId}`, { params: { runner } }),
  /** This project's Floci identity, and what any runner is doing about it.
   *
   *  `account` is why this exists. One emulator is shared by every project on a machine
   *  and they are kept apart inside it by AWS account, so a console pointed at Floci's
   *  default namespace shows every page empty for a project whose resources are up.
   *  Empty for a project with no cloud dependency — ABSENT IS NOT ZERO, and
   *  `000000000000` is the exact wrong account to name. */
  getEmulators: (projectId: string) =>
    client.get<{ projectId: string; account: string; clouds: string[]
                 jobs: QaJob[]; staleAfterSeconds: number }>(
      `/api/qa/emulators/${projectId}`),
  /** Start or stop a project's own emulators, from DevMate. The clouds are derived
   *  server-side from the project's dependencies. */
  controlEmulators: (projectId: string, action: 'start' | 'stop', runner: string) =>
    client.post<{ commandId: string; status: string; clouds: string[]; account: string }>(
      `/api/qa/emulators/${projectId}/${action}`, { runner }),
  /** Boot the app under test once against the running emulator so it creates its cloud
   *  resources. Minutes, not seconds, the first time — it installs the app's
   *  dependencies on the runner before it can start anything. */
  populateEmulators: (projectId: string, runner: string) =>
    client.post<{ commandId: string; status: string; clouds: string[]; account: string }>(
      `/api/qa/emulators/${projectId}/populate`, { runner }),
  /** Start this project's app on the runner's machine and LEAVE IT RUNNING.
   *  Different from `populateEmulators` only in lifetime: populate boots the app
   *  inside a `with` block so its startup creates cloud resources, then stops it.
   *  Minutes the first time — it installs dependencies before it can start. */
  startApp: (projectId: string, runner: string, instrument = false) =>
    client.post<{ commandId: string; status: string; clouds: string[]
                  telemetry: { configured: boolean; skipped: string } }>(
      `/api/qa/apps/${projectId}/start`, { runner, instrument }),
  stopApp: (projectId: string, runner: string) =>
    client.post<{ commandId: string; status: string }>(
      `/api/qa/apps/${projectId}/stop`, { runner }),
  /** Read from the runner's regular state report, not by parking a command — so a
   *  panel polling this cannot starve the single command slot the log followers and
   *  every start/stop already contend for. */
  appState: (projectId: string) =>
    client.get<{ apps: QaAppSession[] }>(`/api/qa/apps/${projectId}`),
  appLogs: (projectId: string, runner: string) =>
    client.get<{ lines: string[]; at: string; kind: string }>(
      `/api/qa/apps/${projectId}/logs`, { params: { runner } }),
  /** NIST controls over the project's IaC. Answered by the API from the working copy —
   *  no runner, no podman, no round trip. */
  projectPolicy: (projectId: string) =>
    client.get<QaPolicy>(`/api/qa/projects/${projectId}/policy`),
  runners: () =>
    client.get<{ runners: QaRunner[]; staleAfterSeconds: number
                 /** The viewer's own username, so ownership is decided from one
                  *  server-stated fact rather than inferred in the browser. */
                 you?: string
                 /** Present when a poll was REFUSED recently. A rejected poll is
                  *  anonymous, so it can never appear as a runner — without this,
                  *  "nobody started an agent" and "an agent is running and its key is
                  *  being refused" render identically. */
                 unauthorized?: { at: string; hint?: string }
                 clouds: { name: string; port: number; image: string }[] }>(
      '/api/qa/runners'),
  /** Ask a runner for a container's output. Answered on its NEXT poll — this is a
   *  round trip, not a stream, and the UI must not call it one. */
  requestLogs: (runner: string, container: string, tail = 200) =>
    client.post<{ commandId: string; status: string; deduped?: boolean }>(
      '/api/qa/runners/logs', { runner, container, tail }),
  getLogs: (runner: string, commandId: string) =>
    client.get<QaContainerLogs>(`/api/qa/runners/logs/${commandId}`,
                                { params: { runner } }),
  getConsole: (projectId: string, runId: string) =>
    client.get<{ lines: string[] }>(`/api/qa/results/${projectId}/${runId}/console`),
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
  enqueueRun: (projectId: string, appUrl = '', kinds: CaseKind[] = []) =>
    client.post<{ runId: string; projectId: string; status: string; kinds: CaseKind[] }>(
      '/api/qa/runs', { project_id: projectId, app_url: appUrl, kinds }),
  getResult: (projectId: string, runId: string) =>
    client.get<{ report: RunReport; steps: RunStep[]; coverage: QaCoverage | null }>(
      `/api/qa/results/${projectId}/${runId}`),
}

/**
 * The kinds a plan actually contains, with the words the picker shows.
 *
 * This replaces a TEST_TYPE_CONFIG catalogue (playwright_ui / integration / regression
 * / negative / boundary) that no component ever imported and that named a taxonomy
 * `plan.build_plan` does not generate — wiring it to the picker would have mislabelled
 * every case.
 */
export const CASE_KINDS: { id: CaseKind; label: string; desc: string; color: string }[] = [
  { id: 'ui',    label: 'Application',  color: '#4f8ef7',
    desc: 'Does the app load, render, and not throw' },
  { id: 'api',   label: 'API routes',   color: '#10b981',
    desc: 'One case per API node in the knowledge graph' },
  { id: 'smoke', label: 'Services',     color: '#8b5cf6',
    desc: 'One per Service node — recorded as skipped, since a Service has no address' },
  { id: 'structure', label: 'File checks', color: '#f59e0b',
    desc: 'Validates the files themselves — needs no running application' },
  { id: 'policy', label: 'Policy', color: '#f43f5e',
    desc: 'NIST controls over the project\'s infrastructure-as-code — reads the '
        + 'template, needs no app and no emulator' },
  { id: 'stack', label: 'Running stack', color: '#06b6d4',
    desc: 'Starts the project\'s compose stack and asks what only it can answer' },
]
