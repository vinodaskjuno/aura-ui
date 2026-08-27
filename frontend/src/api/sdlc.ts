import apiClient from './client';

export interface Repository {
  type: string;
  url?: string;
  local_path?: string;
  branch: string;
}

export interface CreateProjectRequest {
  name: string;
  description: string;
  repositories?: Repository[];
  app_repo?: Omit<Repository, 'branch'> & { branch?: string };
  infra_repo?: Omit<Repository, 'branch'> & { branch?: string };
  devops_repo?: Omit<Repository, 'branch'> & { branch?: string };
}

export interface UpdateProgressRequest {
  progress_percent?: number;
  tasks_completed?: number;
  tasks_total?: number;
  notes?: string;
}

export interface TransitionPhaseRequest {
  target_phase: string;
  force?: boolean;
}

export type TestType = 'unit' | 'regression' | 'integration';

export interface StartTestingRequest {
  test_type: TestType;
  file_extensions?: string[];
}

export const sdlcApi = {
  // Projects
  async createProject(data: CreateProjectRequest) {
    return apiClient.post('/api/sdlc/projects', data);
  },

  async listProjects() {
    return apiClient.get('/api/sdlc/projects');
  },

  async getProject(projectId: string) {
    return apiClient.get(`/api/sdlc/projects/${projectId}`);
  },

  // Phase Tracking
  async getPhaseTracker(projectId: string) {
    return apiClient.get(`/api/sdlc/projects/${projectId}/tracker`);
  },

  async updateProgress(projectId: string, data: UpdateProgressRequest) {
    return apiClient.post(`/api/sdlc/projects/${projectId}/progress`, data);
  },

  async transitionPhase(projectId: string, data: TransitionPhaseRequest) {
    return apiClient.post(`/api/sdlc/projects/${projectId}/transition`, data);
  },

  // Testing
  async startTesting(projectId: string, data: StartTestingRequest) {
    return apiClient.post(`/api/sdlc/projects/${projectId}/test`, data);
  },

  async getTestStatus(sessionId: string) {
    return apiClient.get(`/api/sdlc/test-sessions/${sessionId}/status`);
  },

  async getTestPipeline(sessionId: string) {
    return apiClient.get(`/api/sdlc/test-sessions/${sessionId}/pipeline`);
  },

  async getTestMatrix(sessionId: string) {
    return apiClient.get(`/api/sdlc/test-sessions/${sessionId}/matrix`);
  },

  async executeTests(sessionId: string) {
    return apiClient.post(`/api/sdlc/test-sessions/${sessionId}/execute`, {});
  },

  // Dashboard
  async getDashboard() {
    return apiClient.get('/api/sdlc/dashboard');
  },

  // Code Analysis
  async getCodeAnalysis(projectId: string) {
    return apiClient.get(`/api/sdlc/projects/${projectId}/analysis`);
  },

  // Deployment Graph
  async getDeploymentGraph(projectId: string) {
    return apiClient.get(`/api/sdlc/projects/${projectId}/deployment-graph`);
  },

  async uploadPipeline(projectId: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    const token = localStorage.getItem('token') ?? '';
    const res = await fetch(`/api/sdlc/projects/${projectId}/pipeline-upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async ingestGit(projectId: string) {
    return apiClient.post(`/api/sdlc/projects/${projectId}/git-ingest`, {});
  },

  async getTestSuggestions(projectId: string) {
    return apiClient.get(`/api/sdlc/projects/${projectId}/test-suggestions`);
  },

  // Infra Data Upload
  async uploadInfraData(projectId: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    const token = localStorage.getItem('token') ?? '';
    const res = await fetch(`/api/sdlc/projects/${projectId}/infra-upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ resources_loaded: number; types: string[]; message: string }>;
  },
};
