/**
 * WebSocket origin, derived from the page's own location.
 *
 * Vite inlines `import.meta.env.*` at BUILD time, so deriving the WS host from
 * VITE_API_URL bakes one environment's hostname into the bundle and breaks
 * everywhere else. Reading window.location instead means a single image runs
 * unchanged in local dev, dev, and prod — which is the whole point of the
 * same-origin deployment (SPA and API behind one ALB hostname).
 *
 * Returns e.g. "ws://localhost:5173" or "wss://app.example.com".
 */
export function wsOrigin(): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}`
}

export default wsOrigin
