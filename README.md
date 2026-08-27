# aura-ui

React + TypeScript single-page app for Aura, built with Vite and served by nginx.

## Layout

```
frontend/     the Vite app (package.json, src/, public/, vite.config.ts)
docker/       ui.Dockerfile, nginx.conf.template, snippets/
              (build context = this repo root)
```

## Run locally

```bash
cd frontend
npm ci
npm run dev        # http://localhost:5173, proxying to the backend on :8000
npm run typecheck  # tsc -b
npm run build      # emits frontend/dist
```

`vite.config.ts` proxies 13 path prefixes (`/api`, `/auth`, `/graph`, `/sparql`,
`/ws`, …) to `http://localhost:8000`, so run `aura-api` alongside it.

## Same-origin by design

`VITE_API_URL` is deliberately left unset in the image. Vite inlines
`import.meta.env.*` at build time, so baking a hostname would pin the image to one
environment. Instead the axios client falls back to a relative `baseURL`
(`frontend/src/api/client.ts:4`) and WebSocket URLs derive from `window.location`
(`frontend/src/api/wsUrl.ts`). One image runs unchanged in compose, dev, and prod.

**Consequence:** the SPA must be served same-origin with the API, or behind a proxy.
`docker/nginx.conf.template` is what enforces this in production; it proxies `/api/`,
`/auth/`, `/gateway/` and `/health` to `${BACKEND_URL}`. Its route table and the Vite
dev proxy encode the same contract as `aura-api`'s routers — keep the three in sync.

## Build the image

```bash
podman build --platform linux/amd64 -f docker/ui.Dockerfile -t aura-ui .
```

Built and deployed for real by `aura-infra` (`./deploy.sh ui`), which uses this repo
as the build context.

## Related repos

`aura-api` (backend) · `aura-vsix` (VS Code extension) · `aura-infra` (Terraform, compose, deploy)
