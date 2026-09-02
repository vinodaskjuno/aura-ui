import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Routes that are BOTH a React Router page AND a backend API prefix.
// The bypass function ensures browser navigations (Accept: text/html) are served
// by the SPA (index.html) while XHR/fetch API calls are still proxied.
// Where a locally-running Opik is served from. A variable rather than inlined so a
// developer whose Vite already holds 5173 can move it without editing the table.
//   OPIK_ORIGIN=http://localhost:5273 npm run dev
const opikOrigin = process.env.OPIK_ORIGIN || 'http://localhost:5173'

const spaAndApi = () => ({
  target: 'http://localhost:8000',
  changeOrigin: true,
  bypass(req: any) {
    if (req.headers.accept?.includes('text/html')) return '/index.html'
  },
})

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Dedicated WS rules — these MUST come before the generic '/api' rule, which
      // is an http proxy and does not perform the Upgrade handshake.
      '/api/ontology/ws': { target: 'ws://localhost:8000', changeOrigin: true, ws: true },
      '/api/observability/ws': { target: 'ws://localhost:8000', changeOrigin: true, ws: true },
      // QualityMind streams a local run's progress. wsOrigin() derives the WS host
      // from window.location, so this goes through the proxy and needs an explicit
      // ws rule — the generic '/api' entry below is an http proxy and silently fails
      // the Upgrade handshake.
      '/api/qa/ws': { target: 'ws://localhost:8000', changeOrigin: true, ws: true },

      // Pure API prefixes — no React Router collision
      '/api':      { target: 'http://localhost:8000', changeOrigin: true },
      '/auth':     { target: 'http://localhost:8000', changeOrigin: true },
      '/graph':    { target: 'http://localhost:8000', changeOrigin: true },
      '/sparql':   { target: 'http://localhost:8000', changeOrigin: true },
      '/upload':   { target: 'http://localhost:8000', changeOrigin: true },
      '/sdlc':     { target: 'http://localhost:8000', changeOrigin: true },
      '/health':   { target: 'http://localhost:8000', changeOrigin: true },
      '/build':    { target: 'http://localhost:8000', changeOrigin: true },
      '/progress': { target: 'http://localhost:8000', changeOrigin: true },

      // Dual-use paths (React Router page + backend API) — use bypass
      '/connectors': spaAndApi(),
      '/ontology':   spaAndApi(),

      // Mock MCP server (SSE)
      '/mock-mcp': { target: 'http://localhost:8000', changeOrigin: true },

      // ── Opik's API, for testing the SDK path through Aura ──────────────────
      // Only the API. The Opik UI is NOT proxied here and is not served under a
      // sub-path at all: its published bundle uses absolute asset URLs, so under
      // /opik/ the browser would fetch /assets/* from Aura and get Aura's own SPA
      // back, rendering Aura inside the iframe. The UI is loaded from its own
      // origin instead, which the backend reports via /capabilities.
      //
      // Set OPIK_UI_URL on the backend to match (usually http://localhost:5173).
      '/opik/api': {
        target: opikOrigin,
        changeOrigin: true,
        // Aura's nginx proxies /opik/api/ straight through, so strip the prefix
        // to mirror it: Opik itself serves the API at /api/.
        rewrite: (path: string) => path.replace(/^\/opik/, ''),
      },

      // WebSockets
      '/ws': { target: 'ws://localhost:8000', changeOrigin: true, ws: true },
    },
  },
})
