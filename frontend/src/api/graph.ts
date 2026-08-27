import client from './client'

export const getGraphData = (domain?: string) =>
  client.get('/graph/cytoscape', { params: { domain } })

export const getStats = () => client.get('/graph/stats')

export const getNodeDetail = (iriB64: string) => client.get(`/graph/node/${iriB64}`)

export const getSubgraph = (root: string, depth = 2) =>
  client.get('/graph/subgraph', { params: { root, depth } })
