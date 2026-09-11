import client from './client'

export const getDashboardSummary = () => client.get('/api/dashboard/summary')
export const getGraphHealth = () => client.get('/api/dashboard/graph-health')
export const getSecurityPosture = () => client.get('/api/dashboard/security')
export const getActivityFeed = (limit = 20) => client.get(`/api/dashboard/activity-feed?limit=${limit}`)
export const getSystemHealth = () => client.get('/api/dashboard/system-health')

// getInfrastructureOverview, getApplications and getDataLandscape were removed
// with their endpoints: each was fetched on every dashboard load and referenced
// zero times in the rendered output, and each counted labels that exist nowhere
// in the graph.
