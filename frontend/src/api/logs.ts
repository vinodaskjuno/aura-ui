import apiClient from './client';

export const logsApi = {
  /**
   * Get recent log entries
   */
  async getRecentLogs(limit: number = 100, level?: string) {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    if (level) params.append('level', level);
    
    return apiClient.get(`/api/logs/recent?${params.toString()}`);
  },

  /**
   * Stream logs since timestamp (for polling)
   */
  async streamLogs(since: number = 0, level?: string) {
    const params = new URLSearchParams();
    params.append('since', since.toString());
    if (level) params.append('level', level);
    
    return apiClient.get(`/api/logs/stream?${params.toString()}`);
  },

  /**
   * Clear all logs
   */
  async clearLogs() {
    return apiClient.delete('/api/logs/clear');
  },

  /**
   * Get log statistics
   */
  async getStats() {
    return apiClient.get('/api/logs/stats');
  },
};
