import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Routes that are BOTH a React Router page AND a backend API prefix.
// The bypass function ensures browser navigations (Accept: text/html) are served
// by the SPA (index.html) while XHR/fetch API calls are still proxied.
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
      // Dedicated WS rule for ontology maintainer chat — must be BEFORE /api
      '/api/ontology/ws': { target: 'ws://localhost:8000', changeOrigin: true, ws: true },

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

      // WebSockets
      '/ws': { target: 'ws://localhost:8000', changeOrigin: true, ws: true },
    },
  },
})
