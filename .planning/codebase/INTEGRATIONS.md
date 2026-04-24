# External Integrations

**Analysis Date:** 2026-04-24

## APIs & External Services

**Third-party APIs:**
- Not detected in application source (`src/` contains no Stripe/Supabase/AWS/OpenAI-style SDK usage and no HTTP client integration layer).
  - SDK/Client: Not applicable
  - Auth: Not applicable

**Browser platform services:**
- LocalStorage-backed persistence via `rune-sync/localstorage` in `src/lib/state/composition.ts`.
  - SDK/Client: `rune-sync`
  - Auth: Not applicable

## Data Storage

**Databases:**
- None detected (no ORM/client packages in `package.json`, no server endpoints in `src/routes/**/*+server.*`).
  - Connection: Not applicable
  - Client: Not applicable

**File Storage:**
- Local project assets and static build output only; no external object storage SDK detected.

**Caching:**
- None detected beyond client-side in-memory/runtime state and browser localStorage usage in `src/lib/state/composition.ts`.

## Authentication & Identity

**Auth Provider:**
- Custom/External auth not detected.
  - Implementation: Not applicable (static client-rendered app with `ssr = false` in `src/routes/+layout.ts`).

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry/Bugsnag/Rollbar SDKs in `package.json` or `src/` imports).

**Logs:**
- No centralized logging integration detected; project relies on local dev/test tooling logs from Vite/Vitest/Playwright scripts in `package.json`.

## CI/CD & Deployment

**Hosting:**
- Static hosting compatible output via `@sveltejs/adapter-static` in `svelte.config.js`.

**CI Pipeline:**
- Not detected (no CI workflow configuration files detected in repository scan).

## Environment Configuration

**Required env vars:**
- None detected for application runtime under `src/` (no `process.env`, `import.meta.env`, or `$env` references).

**Secrets location:**
- Not applicable for current app runtime (no secret-backed integrations detected).

## Webhooks & Callbacks

**Incoming:**
- None detected (no server webhook handlers; no `+server` endpoints present under `src/routes/`).

**Outgoing:**
- None detected (no external API client calls identified in app source).

---

*Integration audit: 2026-04-24*
