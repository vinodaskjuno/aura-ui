import client from './client'

const BASE = '/api/mcp'

/** One tool a registered MCP server exposes. */
export interface McpTool {
  /** The namespaced name the model sees, e.g. mcp__acme_sre_3f2__list_deploys. */
  name: string
  /** The server's own name for it, which is what a human recognises. */
  remoteName: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface McpServer {
  connectorId: string
  name: string
  slug: string
  url: string
  transport: string
  /**
   * Three distinct states, because they are three different problems:
   *   connected     — dialled, tools discovered
   *   failed        — has an endpoint, did not answer
   *   unconfigured  — no endpoint filled in yet, finish it on the Connectors page
   */
  status: 'connected' | 'failed' | 'unconfigured'
  tools: McpTool[]
}

export interface McpServersResponse {
  servers: McpServer[]
  toolCount: number
  degraded?: string[]
}

export const listMcpServers = async () =>
  (await client.get(`${BASE}/servers`)).data as McpServersResponse

/** Drops the discovery cache and re-dials. The "I just changed something" button. */
export const refreshMcpServer = async (connectorId: string) =>
  (await client.post(`${BASE}/servers/${connectorId}/refresh`)).data as
    { toolCount: number; degraded: string[] }

/**
 * Call one tool and return its raw result.
 *
 * Scoped to the caller's own servers by construction — the dispatch map is built from
 * their connector rows, so a name they do not own is simply not in it.
 */
export const callMcpTool = async (name: string, args: Record<string, unknown> = {}) =>
  (await client.post(`${BASE}/tools/call`, { name, arguments: args })).data as
    { name: string; result: Record<string, unknown> }
