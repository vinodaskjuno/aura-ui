# ─────────────────────────────────────────────────────────────────────────────
# Aura UI — React SPA built with Vite, served by nginx
#
# Build from the REPO ROOT:  podman build --platform linux/amd64 \
#                              -f docker/ui.Dockerfile -t aura-ui .
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: build ──────────────────────────────────────────────────────────
# node:22, not 20: vite@8.2.0 and rolldown@1.2.2 both declare
# engines ^20.19.0 || >=22.12.0. (The local machine's Node 21.5.0 is outside
# that range entirely — Node 21 is EOL and lacks util.styleText, which is why a
# host-side `npm run dev` fails with a rolldown import error.)
# --platform=$BUILDPLATFORM pins this stage to the HOST architecture, not the
# target. That is essential on an Apple-silicon machine building a linux/amd64
# image: rolldown ships native binaries and running them under QEMU segfaults
# ("qemu: uncaught target signal 11"), which kills `vite build` outright.
#
# It is also free correctness: `vite build` emits static JS/CSS/HTML, which is
# architecture-neutral. Only the nginx stage below actually needs to be amd64.
FROM --platform=$BUILDPLATFORM node:22-slim AS build

WORKDIR /build

# Lockfile first so the dependency layer caches independently of source edits.
COPY frontend/package.json frontend/package-lock.json ./

# `npm ci` INSIDE the builder is mandatory, not a preference: rolldown ships
# platform-specific native binaries, so a node_modules copied from an arm64 Mac
# produces an image that cannot execute on linux/amd64.
RUN npm ci --no-audit --no-fund

COPY frontend/ ./

# VITE_API_URL is deliberately left UNSET.
#
# Vite inlines import.meta.env.* at build time, so baking a hostname here would
# pin the image to one environment. The app is designed for same-origin: the
# axios client falls back to a relative baseURL (src/api/client.ts:4), and WS
# URLs derive from window.location (src/api/wsUrl.ts). That combination lets one
# image run unchanged in compose, dev, and prod.
#
# It is also the only workable option: 11 call sites use raw fetch() with
# hardcoded relative paths and ignore VITE_API_URL entirely, so a split-origin
# build could never work without rewriting all of them.

# `npm run build` is `vite build` alone. It deliberately does NOT type-check:
# `tsc -b` currently reports 120 pre-existing errors (70 of them unused-variable
# TS6133 under noUnusedLocals), so gating the image on it would mean the UI could
# never be built at all. Rolldown transpiles TypeScript without type-checking, so
# the bundle is correct regardless.
#
# Type checking is still available as `npm run typecheck` and should be wired
# into CI once that backlog is cleared. Until then it is genuinely disabled, not
# merely relocated — worth knowing.
RUN npm run build

# ── Stage 2: serve ──────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS serve

# Drop the stock config; ours is a template so the image's envsubst entrypoint
# (/docker-entrypoint.d/20-envsubst-on-templates.sh) substitutes BACKEND_URL at
# container start. One image, any backend address.
RUN rm /etc/nginx/conf.d/default.conf

COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/snippets/ /etc/nginx/snippets/
COPY --from=build /build/dist /usr/share/nginx/html

# Overridden per environment: "backend:8000" in compose,
# "backend.aura.local:8000" via ECS Service Connect.
#
# OPIK_FRONTEND_URL defaults to a name that does NOT resolve when Opik is not
# deployed, which is deliberate: /opik/ then returns 502 rather than falling through
# to the SPA and rendering Aura's own index.html under an Opik URL. A confusing 502
# beats a page that looks like it worked.
ENV BACKEND_URL=backend:8000 \
    OPIK_FRONTEND_URL=opik-frontend:5173 \
    OPIK_UI_PORT=8081 \
    NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx/conf.d

EXPOSE 80
# Opik's UI, on its own port. It cannot share port 80 under a sub-path: the published
# Opik image is built with Vite base=/, so its assets are absolute and would resolve
# against Aura's origin. See the OPIK_UI_PORT server block in nginx.conf.template.
EXPOSE 8081

# Served by nginx itself, so UI health never depends on the backend being up.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1 || exit 1
