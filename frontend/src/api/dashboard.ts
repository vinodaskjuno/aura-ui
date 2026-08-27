import client from './client'

export const getDashboardSummary = () => client.get('/api/dashboard/summary')
export const getGraphHealth = () => client.get('/api/dashboard/graph-health')
export const getInfrastructureOverview = () => client.get('/api/dashboard/infrastructure')
export const getSecurityPosture = () => client.get('/api/dashboard/security')
export const getActivityFeed = (limit = 20) => client.get(`/api/dashboard/activity-feed?limit=${limit}`)
export const getSystemHealth = () => client.get('/api/dashboard/system-health')
export const getApplications = () => client.get('/api/dashboard/applications')
export const getDataLandscape = () => client.get('/api/dashboard/data-landscape')
