# External Integrations

**Analysis Date:** 2026-04-24

## APIs & External Services

**Runtime application APIs:**
- Not detected in application source under `src/` (no `fetch(...)` usage and no API SDK imports found in route/component/state modules)
  - SDK/Client: Not applicable
  - Auth: Not applicable

**Developer tooling services:**
- Svelte MCP endpoint for IDE integration declared in `.cursor/mcp.json`
  - SDK/Client: MCP server URL `https://mcp.svelte.dev/mcp` in `.cursor/mcp.json`
  - Auth: Not specified in repository config

## Data Storage

**Databases:**
- Not detected (no DB client/ORM usage in `src/`, no server directory under `src/lib/server/`)
  - Connection: Not applicable
  - Client: Not applicable

**File Storage:**
- Local static assets only (`static/`, `$lib/assets` import in `src/routes/+layout.svelte`)

**Caching:**
- Browser localStorage-backed reactive state via `rune-sync/localstorage` (`src/lib/state/composition.ts`)

## Authentication & Identity

**Auth Provider:**
- None detected
  - Implementation: Not applicable

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry/Bugsnag/etc. packages or imports in `package.json` and `src/`)

**Logs:**
- Not detected as a dedicated logging framework in app code (`src/`)

## CI/CD & Deployment

**Hosting:**
- GitHub Pages static hosting pipeline (`.github/workflows/deploy.yml` with `actions/deploy-pages@v4`)

**CI Pipeline:**
- GitHub Actions workflow triggers on pushes to `main` (`.github/workflows/deploy.yml`)
- Build uses Bun (`oven-sh/setup-bun@v2`, `bun i`, `bun run build` in `.github/workflows/deploy.yml`)

## Environment Configuration

**Required env vars:**
- `BASE_PATH` is provided in CI during build (`.github/workflows/deploy.yml`)
- No other app env-var consumption detected (`src/` has no `process.env` or `import.meta.env` matches)

**Secrets location:**
- GitHub Actions repository/environment secrets (implied by workflow environment model in `.github/workflows/deploy.yml`)
- No secret files detected in repository root for runtime configuration

## Webhooks & Callbacks

**Incoming:**
- None detected (no webhook endpoints in `src/routes/` or server handlers)

**Outgoing:**
- None detected (no webhook emitters or external callback clients in `src/`)

---

*Integration audit: 2026-04-24*
