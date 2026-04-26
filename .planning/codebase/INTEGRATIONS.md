# External Integrations

**Analysis Date:** 2026-04-26

## APIs & External Services

**HTTP / SaaS backends:**
- Not applicable — no first-party REST/GraphQL client or server routes in `src/` for remote APIs. The app is a prerendered, client-rendered static front end.

**Third-party libraries (in-process, not network):**
- Paper.js (`paper`) — local vector engine for path I/O and rendering (see `STACK.md`). Experiments: `src/routes/experiments/+page.svelte` imports `src/routes/experiments/paper.ts`.

## Data Storage

**Databases:**
- Not applicable.

**Browser storage:**
- `localStorage` — via `rune-sync` `lsSync` in `src/lib/state/composition.ts` for keys such as `composition`, `color-mode`, `composition-ui`. Persisted `Ring` shape includes `secondaryTemplatePath` and `morphT` (`src/lib/types.ts`).

**File Storage:**
- Local filesystem only in the sense of **user-selected files** in the browser: `importSvg(file: File, ...)` in `src/lib/geometry/svg-import.ts` uses the File API; no cloud upload path in code.

**Caching:**
- None beyond browser defaults for static assets after deploy.

## Authentication & Identity

**Auth Provider:**
- Not applicable — no sign-in, tokens, or OAuth flows in application source.

## Monitoring & Observability

**Error Tracking:**
- None integrated (no Sentry/Datadog SDK in `package.json`).

**Logs:**
- Development/console only; no server-side logging pipeline.

## CI/CD & Deployment

**Hosting:**
- GitHub Pages — `.github/workflows/deploy.yml` builds and deploys via `actions/deploy-pages@v4` with `actions/upload-pages-artifact@v3` pointing at `build/`.

**CI Pipeline:**
- GitHub Actions on push to `main`: checkout, `oven-sh/setup-bun@v2`, `bun i`, `bun run build` with environment variable `BASE_PATH` set to `/${{ github.event.repository.name }}` for repository-subpath hosting.

**Local E2E:**
- Playwright starts preview with `npm run build && npm run preview` (`playwright.config.ts`); not the same as Pages `BASE_PATH` unless configured separately for local runs.

## Environment Configuration

**Required env vars:**
- None for local dev inferred from source (no `$env/static` / `process.env` usage found for app config in a quick repo scan). **CI:** `BASE_PATH` is set in `.github/workflows/deploy.yml` for the build step.

**Secrets location:**
- Not applicable for this repo’s app layer. Do not commit `.env` files; none were listed at repo root.

## Webhooks & Callbacks

**Incoming:**
- None.

**Outgoing:**
- None.

## Morph feature integration surface

**State and validation (client-only):**
- `src/lib/state/composition.ts` — `createRingMorphTarget`, `removeRingMorphTarget`, `setRingMorphT`, `updateRingPathVariant` with `validatePathCompatibility` from `src/lib/geometry/path-morph.ts`.
- Serialization of morph fields happens through the same `lsSync` composition payload as the rest of the ring model.

**Rendering integration:**
- `src/lib/geometry/render-pipeline.ts` — when both `templatePath` and `secondaryTemplatePath` exist, validates compatibility; on success uses `interpolatePath(..., ring.morphT ?? 0)` before `buildRingPath`; on mismatch logs a warning string and falls back to unmorphed primary behavior for that ring.

**User-facing controls:**
- `src/lib/components/RingEditor.svelte` — morph target creation/removal and `morphT` slider; separate PaperScope for SVG import (`importScope`).

---

*Integration audit: 2026-04-26*
