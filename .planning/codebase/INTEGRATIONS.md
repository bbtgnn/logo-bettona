# External Integrations

**Analysis Date:** 2026-07-06

## APIs & External Services

**Remote APIs:**
- Not detected — no REST/GraphQL client and no server API route layer. The app is a client-only static SPA (`+layout.ts`: `ssr = false`, `prerender = true`).

**In-process third-party engines:**
- `paper` — vector/path engine for ring geometry, render pipeline, SVG import/export, and the kaleidoscope tile (`src/lib/geometry/**`, `src/lib/components/preview-presenter.svelte.ts`, `RingCanvas.svelte`).
  - SDK/Client: `paper`
  - Auth: Not applicable
- `animejs` — listed in `package.json` `dependencies` but **not imported anywhere** in `src/`; playback is in-house (`createAnimationRuntime` + rAF), so anime.js is not an active integration. Effectively a dead dependency (see CONCERNS/STACK).

**Browser platform APIs:**
- **WebAudio** — `src/lib/state/animation-drivers/audio-source.ts` owns one `AudioContext` + one `AnalyserNode` and feeds the audio-reactive drivers. Two source modes: `mic` (`navigator.mediaDevices.getUserMedia({ audio: true })` → `MediaStreamAudioSourceNode`, connected to the analyser but NOT to the destination — silent) and `file` (`createMediaElementSource` → analyser → destination, audible while tuning; `decodeAudioData` builds the static waveform). Mode `off` tears the graph down.
- **MediaRecorder** — `src/lib/export/canvas-export.ts` captures the live `<canvas>` to a WebM video (`pickWebmMimeType()` prefers `video/webm;codecs=vp9`, then vp8, then webm; `isAnimationExportSupported()` gates on `MediaRecorder` + `canvas.captureStream`). Where unsupported (e.g. Safari, no `MediaRecorder`), the export button is disabled (`PreviewCanvas.svelte`) and an unsupported-browser notice is shown. See the "Animation Integration Surface" section for how this wires to the presenter.

## Data Storage

**Databases:**
- Not applicable.

**Browser persistence (`localStorage`):**
- `composition` — the composition model, via `createPersistedComposition('composition', …)` in `src/lib/state/composition-persistence.svelte.ts` (a `rune-sync`-backed persisted store that strips transient audio-driven fields — `wave`/`zoneDrive`/mid-animation `morphT` — before every write, so a reload never restores a mid-animation pose).
- `color-mode` — `colorMode` state, `lsSync<ColorModeState>('color-mode', …)` (`src/lib/state/composition.ts`).
- `composition-ui` — per-ring expanded/collapsed UI state, `lsSync('composition-ui', …)` (`src/lib/state/composition.ts`).
- `path-library` — the Tracciati path library, `lsSync<PathLibrary>('path-library', …)` (`src/lib/state/path-library.ts`).
- `PARAGLIDE_LOCALE` — the active locale, written by Paraglide's `localStorage` strategy (not `rune-sync`; see i18n below).

**File Storage:**
- Local browser file input only: SVG import (`src/lib/geometry/svg-import.ts`) and audio-file load (fed into the WebAudio graph above). No uploads leave the browser.

**Caching:**
- None beyond browser static-asset caching. Rendering reads current state only (no render cache in shared state).

## Authentication & Identity

**Auth Provider:**
- Not applicable. No auth middleware, tokens, or session state anywhere in `src/**`.

## Monitoring & Observability

**Error Tracking:**
- None integrated.

**Logs:**
- Client-side only. The render pipeline accumulates per-call diagnostics in `RenderResult.warnings` (`src/lib/geometry/render-pipeline.ts`) rather than logging; the preview does not surface them (see CONCERNS).

## CI/CD & Deployment

**Hosting:**
- GitHub Pages, static, via `.github/workflows/deploy.yml`. The SvelteKit static adapter emits `build/` with a `404.html` fallback (SPA deep-link support).

**CI Pipeline:**
- On push to `main`: `oven-sh/setup-bun@v2` → `bun i` → `bun run build` (with `BASE_PATH: '/${{ github.event.repository.name }}'`) → `actions/upload-pages-artifact` → `actions/deploy-pages`.
- Note: CI uses **bun**, while `package.json` scripts and `playwright.config.ts` invoke `npm run …`. The workflow does NOT gate on `test:unit`/`test:e2e`. Both points are tracked in CONCERNS.

## Environment Configuration

**Required env vars:**
- `BASE_PATH` — build-time base path (`svelte.config.js`: `base: process.env.BASE_PATH ?? ''`), set by CI to the repo name so every `resolve()`-built link works under the Pages sub-path.

**Secrets location:**
- Not applicable at runtime. `.env` files are git-ignored; none are committed.

## Webhooks & Callbacks

**Incoming:**
- None.

**Outgoing:**
- None.

## Animation Integration Surface

**Driver runtime + WebAudio:**
- `src/lib/state/animation.svelte.ts` owns `animationState` (playback clock, per-layer flags, per-driver configs, `fps`) and a driver runtime (`state/animation-drivers/runtime.ts`). `DRIVER_LAYERS` is derived as the layers whose `LayerKind` is `driver` — currently just `audioBars` and `audioZones`; `kaleidoscope` is a `gate` and `dataSeries` is `inert` (registered as a driver but never activated). Only the driver layers call `runtime.setActive`.
- Turning off the last active driver layer tears down the shared `audioSource` (WebAudio graph). `state/animation.ts` re-exports the controller as the public boundary.

**Video export tap:**
- `getExportAudioStream()` calls `audioSource.createRecordingStream()`, which taps the live analyser into a fresh `MediaStreamAudioDestinationNode` and returns its `MediaStream` for muxing into the WebM export. Returns `null` for `off`/`demo` (no live graph).
- `preview-presenter.exportAnimation()` passes that stream into `exportCanvasAnimation` (`src/lib/export/canvas-export.ts`), which records the visible canvas for `animationState.durationSec` at `animationState.fps`, reporting `0..1` progress through the presenter-local `presenter.exportProgress` while `exportStatus.rendering` (`state/export-status.svelte.ts`, its only field) gates other controls. This is the **runtime video** export path; static SVG/PNG download is a separate inline path in the presenter (see ARCHITECTURE, decision 3).

**i18n (Paraglide):**
- `messages/{en,it}.json` are the source catalogs; `@inlang/paraglide-js` compiles them into `src/lib/paraglide/` (generated, git-ignored). Message access is `m.*` from `$lib/paraglide/messages`.
- Locale resolution strategy (`vite.config.ts` paraglide plugin): `['localStorage', 'preferredLanguage', 'baseLocale']`. `src/lib/state/locale.svelte.ts` wraps `getLocale`/`setLocale` from `$lib/paraglide/runtime`; the switch stores the choice under `PARAGLIDE_LOCALE`.

**Animation-related tests:**
- `src/lib/state/animation.svelte.spec.ts` (node) — controller/runtime behavior.
- `src/lib/state/animation-drivers/*.spec.ts` — per-driver `frame()` math and audio-source wiring.
- `src/lib/components/preview-presenter.export.svelte.spec.ts` — the export surface.

---

*Integration audit: 2026-07-06*
</content>
