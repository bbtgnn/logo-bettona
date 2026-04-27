# External Integrations

**Analysis Date:** 2026-04-27

## APIs & External Services

**Remote APIs:**
- Not detected - no REST/GraphQL client integration in `src/**` and no server API route layer.

**In-process third-party engines:**
- `animejs` (`animate`) - timeline engine integrated in `src/lib/state/animation.svelte.ts` for morph playback state transitions.
  - SDK/Client: `animejs`
  - Auth: Not applicable
- `paper` - vector/path engine used by ring editing and rendering (`src/lib/geometry/**`, `src/lib/components/RingEditor.svelte`, `src/lib/components/RingCanvas.svelte`).
  - SDK/Client: `paper`
  - Auth: Not applicable

## Data Storage

**Databases:**
- Not applicable.

**Browser persistence:**
- `localStorage` via `rune-sync/localstorage` in `src/lib/state/composition.ts`.
  - Connection: Browser `localStorage` keys (`composition`, `color-mode`, `composition-ui`)
  - Client: `lsSync` from `rune-sync`

**File Storage:**
- Local browser file input for SVG import only (`src/lib/components/RingEditor.svelte` -> `src/lib/geometry/svg-import.ts`).

**Caching:**
- None configured beyond browser static asset caching.

## Authentication & Identity

**Auth Provider:**
- Not applicable.
  - Implementation: No auth middleware/tokens/session state in `src/**`.

## Monitoring & Observability

**Error Tracking:**
- None integrated.

**Logs:**
- Client-side console logging only (for example compatibility fallback logging in `src/lib/geometry/render-pipeline.ts`).

## CI/CD & Deployment

**Hosting:**
- GitHub Pages static deployment via `.github/workflows/deploy.yml`.

**CI Pipeline:**
- GitHub Actions workflow builds with Bun then deploys Pages artifact from `build/`.
- Build-time base path is injected with `BASE_PATH` in `.github/workflows/deploy.yml`.

## Environment Configuration

**Required env vars:**
- `BASE_PATH` (CI build variable in `.github/workflows/deploy.yml`).

**Secrets location:**
- Not applicable for application runtime.
- `.env` files are intentionally git-ignored by `.gitignore`.

## Webhooks & Callbacks

**Incoming:**
- None.

**Outgoing:**
- None.

## Animation Integration Surface

**Animation state module:**
- `src/lib/state/animation.svelte.ts` owns playback state (`isPlaying`, `isPaused`, `progress`, `durationSec`, `loop`, `alternate`) and animejs lifecycle.
- `src/lib/state/animation.ts` provides public re-export boundary for consumers.

**Animation with composition model:**
- `src/lib/state/animation.svelte.ts` drives `morphT` updates through `setRingMorphT` from `src/lib/state/composition.ts`.
- `src/lib/state/composition.ts` persists morph fields and compatibility-checked target updates (`updateRingPathVariant`, `createRingMorphTarget`, `removeRingMorphTarget`).
- `src/lib/types.ts` defines persisted ring morph contract (`secondaryTemplatePath`, `morphT`).

**Animation UI section:**
- `src/lib/components/Sidebar.svelte` integrates `AnimationSection` between settings and color/rings sections.
- `src/lib/components/AnimationSection.svelte` exposes duration, loop, alternate, play/pause, and progress bar controls wired to animation state actions.

**Animation-related tests:**
- `src/lib/state/animation.svelte.spec.ts` validates animejs integration behavior, play/pause toggling, loop/alternate safety, and composition change handling.
- `src/lib/components/AnimationSection.svelte.spec.ts` validates control wiring and composition change checks in UI.
- `src/lib/components/Sidebar.svelte.spec.ts` verifies animation section placement/order in sidebar layout.

---

*Integration audit: 2026-04-27*
