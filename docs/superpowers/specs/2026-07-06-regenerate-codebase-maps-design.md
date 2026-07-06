# Regenerate `.planning/codebase/` maps — design

**Date:** 2026-07-06
**Type:** Maintenance (documentation-only)
**Scope:** Rewrite the 7 codebase-map files under `.planning/codebase/` so they describe the current tool. No source files touched.

## Problem

The 7 maps in `.planning/codebase/` are stamped `Analysis Date: 2026-04-27` and describe a single-page Svelte editor (Sidebar sections `Settings → Animation → Colors → rings`, morph-sweep animation via anime.js, one `+page.svelte`). The tool has since become a **four-section pipeline** and grown several subsystems the maps never mention. They mislead any reader (human or agent) who trusts them.

### What changed since April (verified against current code)

- **Four-section routing pipeline** under a `(app)` route group: `Tracciati` (`/paths`) → `Editor` (`/editor`) → `Composizione` (`/composition`) → `Animate` (`/animate`), plus `/about`. Root `+page.ts` redirects to `/paths`. `SidebarNav.svelte` renders the tabbed pill.
- **GitHub Pages routing hardening**: every internal link/redirect goes through `resolve()` from `$app/paths`; `adapter-static` uses `fallback: '404.html'`; `base` comes from `BASE_PATH`.
- **Composition section**: `CanvasSection` + `LayoutModeSwitch` (Poster/Caleidoscopio, backed by `kaleidoscope.enabled`) + `KaleidoscopePanel` (static look).
- **Kaleidoscope**: state singleton `state/kaleidoscope.svelte`, geometry `geometry/kaleidoscope.ts` + `kaleidoscope-tile.ts`, rendered by `preview-presenter` via an rAF loop.
- **Audio-reactive drivers**: `state/animation-drivers/` (audio-source, audio-bars-driver, audio-zones-driver, data-series-driver, runtime, fallback-bars, demo-zones, types). Animate exposes Audio Bars and Audio Zones sections.
- **Keyframes / timeline**: `state/keyframes.svelte`, `animation/keyframes.ts`, `animation/timeline-geometry.ts`, `TimelinePanel`/`TimelineRuler`/`TimelineTrack`, `KeyframeGraphEditor`.
- **Path library** (Tracciati): `state/path-library`, `PathThumbnail`, `LibraryPickerSheet`, arc/grid options.
- **Preview presenter**: `components/preview-presenter.svelte.ts` owns the visible canvas with single-writer arbitration (flat composition `$effect` yields to the kaleidoscope rAF loop) plus the offscreen tile lifecycle and export entry points.
- **Video export**: `export/canvas-export.ts` records the live canvas to **WebM via MediaRecorder** (audio stream tapped when live).
- **i18n**: Paraglide (`@inlang/paraglide-js`), `messages/{en,it}.json`, generated `src/lib/paraglide/` (gitignored), `messages-parity.spec.ts`, `state/locale.svelte`.
- **State split**: `composition-persistence.svelte` holds the `lsSync` singleton; `composition.ts` is the action facade over it.
- **Deps trimmed**: runtime `dependencies` are now only `animejs`, `paper`, `rune-sync`; everything else is dev.

## Decisions (locked with user)

1. **Preserve the generator skeleton.** Keep each file's existing section headings and footer format; only stamp `Analysis Date: 2026-07-06` and rewrite the body against current code. The maps stay a consistent, regenerable set.
2. **CONCERNS.md = faithful current-state audit.** List the real debt/risks of today, with priorities and file anchors — not a neutral fact dump.
3. **Export framing (ARCHITECTURE + CONCERNS).** Describe `export/canvas-export` explicitly as the **runtime video path (WebM/MediaRecorder)**. Note that static SVG/PNG download currently lives **inline in `preview-presenter`** (`exportSvg` / `exportPng`), and that a future dedicated **static PNG/SVG export** would be a **distinct path** — do not intertwine the two in the narrative.

## Per-file plan

Each file: same skeleton, `Analysis Date: 2026-07-06`, body grounded in real paths.

### STRUCTURE.md
- New tree: `src/routes/(app)/{paths,editor,composition,animate}/` + `about/`, `+page.ts` redirect, `layout.css`, `demo/`, `experiments/`.
- Grown `src/lib/`: `actions/`, `animation/`, `color/`, `components/`, `export/`, `geometry/`, `paraglide/` (generated, gitignored), `shadcn/`, `state/` (+ `animation-drivers/`), `types.ts`, `index.ts`, `messages-parity.spec.ts`.
- "Where to add new code" remapped to the four sections + drivers + keyframes + path library.

### ARCHITECTURE.md
- Overview: client-only SvelteKit, four-section pipeline, local-first reactive state, Paper.js render core, audio-reactive drivers, kaleidoscope rAF preview.
- Layers: `(app)` shell (SidebarNav pill, PreviewCanvas, conditional TimelinePanel on `/animate`); composition facade (`composition.ts`) over persistence singleton (`composition-persistence.svelte`); animate controller (`animation.svelte.ts`) owning driver runtime + layer flags + keyframes + export audio; kaleidoscope state; `preview-presenter` canvas arbitration; geometry/render core (+ `wave`, `zones`, `kaleidoscope`, `aspect-ratio`, `fit-to-view`, `path-*`).
- Data flows: layer→driver activation (`setLayerEnabled` → `syncActiveDrivers` → runtime `setActive`), per-frame driver `frame()` → `applyRingT`, keyframe sampling (`applyKeyframes` with gate coupling), kaleidoscope tile snapshot + single-writer canvas.
- Export subsystem paragraph per decision 3: video via `canvas-export` (WebM/MediaRecorder); static SVG/PNG inline in presenter; future static export = distinct path.

### STACK.md
- Runtime deps: `animejs`, `paper`, `rune-sync`. Everything else dev.
- Add: Paraglide i18n, Tailwind v4 stack (`@tailwindcss/vite` + forms + typography), `bits-ui`, `phosphor-svelte`, `adapter-static` with `fallback: '404.html'`, `BASE_PATH` base path.
- Note scripts are `npm run …` in `package.json` while bun is the declared package manager (`bun.lock`, CLAUDE.md) — cross-reference CONCERNS.

### CONVENTIONS.md
- Paraglide `m.*` message access + en/it parity requirement.
- `resolve()` for every internal link/redirect (GH Pages base-path idiom); `$app/state` `page`.
- Driver factory pattern: `create*Driver()` → `{ init, dispose, frame(nowMs) }`; runtime registry.
- `*.svelte.ts` rune-state modules; facade + persistence split; ring `id` keying (`ring-id`).
- `data-testid` conventions for nav/sections/layers.
- Keep existing formatting/lint/import-order guidance, refreshed to current examples.

### TESTING.md
- Refresh file map (large growth) and the browser-vs-node split: `*.svelte.spec.ts` → client/browser; `*.spec.ts` (non-svelte) → node; documented exception `state/animation.svelte.spec.ts` runs in node.
- `*.e2e.ts` Playwright (`workspace-nav`, `about-nav`, `path-manager`, `demo/playwright`).
- `messages-parity.spec.ts`; driver/keyframe/kaleidoscope/path-library/wave/zones coverage; `requireAssertions: true`.

### INTEGRATIONS.md
- In-process engines: `paper`, `animejs`.
- WebAudio: `audio-source` (mic/file → analyser), export audio tap (`getExportAudioStream`).
- MediaRecorder WebM export (`export/canvas-export`) — runtime video path.
- Browser persistence: `localStorage` via `rune-sync` (keys: `composition`, `color-mode`, `composition-ui`, path-library + locale keys as found); Paraglide localStorage locale strategy.
- CI/CD: GitHub Pages via `.github/workflows/deploy.yml`, `BASE_PATH` build var. No remote APIs, no auth.

### CONCERNS.md (faithful audit)
- Preview-presenter single-writer arbitration (flat `$effect` ↔ kaleidoscope rAF) is correctness-critical and subtle; flicker risk if a future writer ignores the gate.
- Driver ↔ audio-source lifecycle coupling: `DRIVER_LAYERS` "last driver off tears down the audio source" is an implicit global contract.
- Keyframe gate-coupling: `LayerKind` (`driver`/`gate`/`inert`) string special-cases across `setLayerEnabled` / `syncActiveDrivers` / `applyKeyframes`.
- `updateRingPathVariant` primary-reseed **stopgap** (structural primary edit re-seeds secondary instead of rejecting) — morph editing is slated to move to Animate.
- Kaleidoscope **parameter keyframe authoring dropped** (playback-only) per PR #13; authoring to be re-homed in a future Animate pass.
- Package identity: name `test-logo-2` + `npm run` scripts vs bun-declared PM (`bun.lock`, CLAUDE.md) — inconsistent tooling story.
- Carry forward `dispose()` render-pipeline lifecycle note only if still a no-op in current code (verify while writing).
- Export split (decision 3): static PNG/SVG lives inline in the presenter, not a dedicated module — a future static-export path is unbuilt.

## Verification

- All 7 files stamped `2026-07-06`; skeleton headings unchanged from the April versions.
- Every file/dir/symbol named in the maps exists in the current tree (spot-check paths while writing).
- `git status` shows only `.planning/codebase/*.md` modified — zero source changes.
- Final: print the list of regenerated files and stop. User commits.

## Out of scope

- Any source/code change.
- Fixing the concerns themselves (they are documented, not resolved).
- Renaming the package or switching scripts to bun.
- The committing step (user does it).
