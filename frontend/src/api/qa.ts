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

export interface TestArtifact {
  key: string
  url: string
  filename: string
}

export const qaApi = {
  listProjects: () => client.get('/api/qa/projects'),
  getSuites: (projectId: string) => client.get<TestRun[]>(`/api/qa/projects/${projectId}/suites`),
  generate: (data: {
    project_id: string
    test_types: string[]
    coverage_target?: number
    focus_areas?: string[]
  }) => client.post(`/api/qa/generate`, data),
  run: (run_id?: string, test_types?: string[]) =>
    client.post(`/api/qa/run`, { run_id, test_types }),
  getRunDetail: (runId: string) => client.get<TestRun>(`/api/qa/runs/${runId}`),
  getArtifacts: (runId: string) => client.get<TestArtifact[]>(`/api/qa/runs/${runId}/artifacts`),
  getActivity: () => client.get('/api/qa/activity'),

  // Container test execution (ECS Fargate)
  runInContainer: (data: { run_id: string; project_id: string; app_url: string; app_description?: string }) =>
    client.post<ContainerRunResult>('/api/qa/run/container', data),
  getContainerScreenshots: (runId: string) =>
    client.get<Screenshot[]>(`/api/qa/run/container/${runId}/screenshots`),
}

export const TEST_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; desc: string }> = {
  playwright_ui: { label: 'Playwright UI',    icon: 'Monitor',      color: '#4f8ef7', desc: 'End-to-end browser tests' },
  api:           { label: 'API Testing',      icon: 'Plug2',        color: '#10b981', desc: 'REST endpoint validation' },
  integration:   { label: 'Integration',      icon: 'GitMerge',     color: '#8b5cf6', desc: 'Cross-service flow tests' },
  regression:    { label: 'Regression',       icon: 'RefreshCw',    color: '#f59e0b', desc: 'Diff-based change detection' },
  negative:      { label: 'Negative',         icon: 'XCircle',      color: '#ef4444', desc: 'Invalid input handling' },
  boundary:      { label: 'Boundary',         icon: 'SlidersHorizontal', color: '#06b6d4', desc: 'Min/max/null/overflow cases' },
}
