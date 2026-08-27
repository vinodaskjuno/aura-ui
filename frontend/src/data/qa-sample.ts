import type { TestRun } from '../api/qa'

export const DEMO_PROJECT_ID = 'demo-aura-api-gateway'

// ── Demo project ──────────────────────────────────────────────────────────────
export const SAMPLE_PROJECT = {
  projectId: DEMO_PROJECT_ID,
  name: 'AURA API Gateway',
  description: 'Enterprise AI agent platform — auth, credits, agent orchestration, and monitoring endpoints.',
  status: 'TESTING_COMPLETE',
  environment: 'staging',
  repoCount: 3,
  prUrl: 'https://github.com/aura/aura/pull/47',
  lastTestRun: { totalPassed: 54, totalFailed: 3 },
  createdAt: '2026-08-15T09:00:00Z',
  updatedAt: '2026-08-19T08:30:00Z',
}

// ── Demo test runs (most-recent first) ───────────────────────────────────────

const RUN1_ID = 'demo-run-ui-playwright-001'
const RUN2_ID = 'demo-run-api-tests-002'
const RUN3_ID = 'demo-run-integration-003'

export const SAMPLE_SUITES: TestRun[] = [
  // ── Run 1: Playwright UI ────────────────────────────────────────────────────
  {
    testRunId: RUN1_ID,
    projectId: DEMO_PROJECT_ID,
    userId: 'demo-user',
    type: 'execution',
    status: 'completed',
    totalTests: 20,
    totalPassed: 19,
    totalFailed: 1,
    totalSkipped: 0,
    suiteCount: 4,
    createdAt: '2026-08-19T07:45:00Z',
    completedAt: '2026-08-19T07:48:32Z',
    artifacts: [
      's3://aura-test-artifacts/demo/run1/playwright-report.html',
      's3://aura-test-artifacts/demo/run1/screenshot-login.png',
      's3://aura-test-artifacts/demo/run1/screenshot-dashboard.png',
      's3://aura-test-artifacts/demo/run1/screenshot-agent-chat.png',
      's3://aura-test-artifacts/demo/run1/screenshot-credits-FAIL.png',
    ],
    results: [
      { file: 'tests/ui/auth.spec.ts',          passed: 6, failed: 0, skipped: 0, duration: 8.4,  status: 'completed' },
      { file: 'tests/ui/dashboard.spec.ts',     passed: 5, failed: 0, skipped: 0, duration: 11.2, status: 'completed' },
      { file: 'tests/ui/agent-chat.spec.ts',    passed: 5, failed: 0, skipped: 0, duration: 14.7, status: 'completed' },
      { file: 'tests/ui/credits-widget.spec.ts',passed: 3, failed: 1, skipped: 0, duration: 6.1,  status: 'failed'    },
    ],
  },

  // ── Run 2: REST API tests ───────────────────────────────────────────────────
  {
    testRunId: RUN2_ID,
    projectId: DEMO_PROJECT_ID,
    userId: 'demo-user',
    type: 'execution',
    status: 'completed',
    totalTests: 24,
    totalPassed: 23,
    totalFailed: 1,
    totalSkipped: 0,
    suiteCount: 4,
    createdAt: '2026-08-19T06:15:00Z',
    completedAt: '2026-08-19T06:17:48Z',
    artifacts: [
      's3://aura-test-artifacts/demo/run2/api-test-report.html',
      's3://aura-test-artifacts/demo/run2/screenshot-api-auth.png',
      's3://aura-test-artifacts/demo/run2/screenshot-api-credits.png',
    ],
    results: [
      { file: 'tests/api/auth.api.spec.ts',       passed: 7, failed: 0, skipped: 0, duration: 3.2, status: 'completed' },
      { file: 'tests/api/credits.api.spec.ts',    passed: 6, failed: 1, skipped: 0, duration: 4.8, status: 'failed'    },
      { file: 'tests/api/metrics.api.spec.ts',    passed: 5, failed: 0, skipped: 0, duration: 2.9, status: 'completed' },
      { file: 'tests/api/connectors.api.spec.ts', passed: 5, failed: 0, skipped: 0, duration: 3.6, status: 'completed' },
    ],
  },

  // ── Run 3: Integration / end-to-end ────────────────────────────────────────
  {
    testRunId: RUN3_ID,
    projectId: DEMO_PROJECT_ID,
    userId: 'demo-user',
    type: 'execution',
    status: 'completed',
    totalTests: 17,
    totalPassed: 17,
    totalFailed: 0,
    totalSkipped: 0,
    suiteCount: 3,
    createdAt: '2026-08-18T14:30:00Z',
    completedAt: '2026-08-18T14:34:22Z',
    artifacts: [
      's3://aura-test-artifacts/demo/run3/integration-report.html',
      's3://aura-test-artifacts/demo/run3/screenshot-e2e-agent-flow.png',
    ],
    results: [
      { file: 'tests/integration/agent-workflow.spec.ts', passed: 7, failed: 0, skipped: 0, duration: 22.1, status: 'completed' },
      { file: 'tests/integration/credits-flow.spec.ts',   passed: 6, failed: 0, skipped: 0, duration: 14.3, status: 'completed' },
      { file: 'tests/integration/auth-handoff.spec.ts',   passed: 4, failed: 0, skipped: 0, duration: 9.8,  status: 'completed' },
    ],
  },
]

// ── Screenshot metadata for the demo gallery ──────────────────────────────────
export type DemoScreenshot = {
  id: string
  runId: string
  label: string
  sublabel: string
  status: 'passed' | 'failed'
  duration: string
  kind: 'ui' | 'api'
  note?: string
}

export const SAMPLE_SCREENSHOTS: DemoScreenshot[] = [
  {
    id: 'login',
    runId: RUN1_ID,
    label: 'Login Page — UI Test',
    sublabel: 'tests/ui/auth.spec.ts → "renders login form and accepts credentials"',
    status: 'passed',
    duration: '1.24s',
    kind: 'ui',
  },
  {
    id: 'dashboard',
    runId: RUN1_ID,
    label: 'Dashboard — UI Test',
    sublabel: 'tests/ui/dashboard.spec.ts → "shows agent list and credit balance"',
    status: 'passed',
    duration: '2.87s',
    kind: 'ui',
  },
  {
    id: 'credits-fail',
    runId: RUN1_ID,
    label: 'Credits Widget — UI Test (FAIL)',
    sublabel: 'tests/ui/credits-widget.spec.ts → "displays available credits"',
    status: 'failed',
    duration: '6.10s',
    kind: 'ui',
    note: 'Expected element "credits-available" to be visible — balance panel not rendered when API returns 404',
  },
  {
    id: 'api-credits',
    runId: RUN2_ID,
    label: 'POST /api/credits/record — API Test',
    sublabel: 'tests/api/credits.api.spec.ts → "records task cost and returns creditsConsumed"',
    status: 'failed',
    duration: '4.80s',
    kind: 'api',
    note: 'Expected status 201, received 404 — endpoint was missing until this sprint',
  },
  {
    id: 'api-auth',
    runId: RUN2_ID,
    label: 'POST /api/auth/login — API Test',
    sublabel: 'tests/api/auth.api.spec.ts → "returns JWT on valid credentials"',
    status: 'passed',
    duration: '0.98s',
    kind: 'api',
  },
  {
    id: 'api-metrics',
    runId: RUN2_ID,
    label: 'GET /api/metrics/tokens — API Test',
    sublabel: 'tests/api/metrics.api.spec.ts → "returns aggregated token usage by period"',
    status: 'passed',
    duration: '1.12s',
    kind: 'api',
  },
]
