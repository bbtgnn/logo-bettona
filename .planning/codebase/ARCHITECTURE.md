# Architecture

**Analysis Date:** 2026-07-06

## Pattern Overview

**Overall:** Client-only SvelteKit app (`adapter-static`, `ssr = false`, `prerender = true`) organized around a four-section editing pipeline — **Tracciati** (path library) → **Editor** (rings/settings/colors) → **Composizione** (canvas layout + kaleidoscope) → **Animate** (audio-reactive drivers + keyframes + export) — over local-first reactive state persisted through `rune-sync`. A Paper.js render pipeline derives ring geometry from composition state; the visible canvas is arbitrated by a single-writer presenter that switches between a flat composition render and a kaleidoscope rAF loop.

**Key Characteristics:**
- Four top-level destinations live behind `SidebarNav.svelte`: `/paths`, `/editor`, `/composition`, `/animate`; `src/routes/+page.ts` redirects `/` → `/paths` (`redirect(307, resolve('/paths'))`).
- **Two distinct route shells, not one.** `src/routes/(app)/+layout.svelte` is shared by `editor/`, `composition/`, and `animate/` only: it mounts `SidebarNav`, a single shared `PreviewCanvas` main pane, and a `TimelinePanel` that appears only while `page.url.pathname` starts with `/animate`. `src/routes/paths/+page.svelte` (Tracciati) is a **sibling** of `(app)/`, not nested inside it — it builds its own `SidebarUI.SidebarProvider`/`Sidebar` (reusing `SidebarNav`/`LanguageSwitcher`) with no shared preview pane, rendering a `RingPreview` of the selected library curve instead. `about/` is a third sibling.
- Animate is driver-based, not a single morph sweep: `AnimationLayer = 'audioBars' | 'audioZones' | 'dataSeries' | 'kaleidoscope'`, each classified by `LayerKind = 'driver' | 'gate' | 'inert'` in `state/animation.svelte.ts`. A keyframe system (`applyKeyframes`) samples per-param tracks (kaleidoscope, audio bars/zones, per-ring wave/morph) and gates layer-scoped params on that layer's flag.
- Preview rendering is single-writer arbitrated in `components/preview-presenter.svelte.ts`: a flat-composition `$effect` paints the visible canvas unless `kaleidoscope.enabled`, in which case an rAF loop is the sole writer and the flat effect yields.

## Layers

**Presentation (route shells):**
- Purpose: two different application frames depending on whether the route needs the shared preview pane.
- Location: `src/routes/(app)/+layout.svelte` (shared shell for `editor/`, `composition/`, `animate/`); `src/routes/paths/+page.svelte` (own shell, Tracciati); `src/routes/+layout.svelte` (root: view-transition wiring via `onNavigate`); `src/routes/+layout.ts` (`prerender = true`, `ssr = false`); `src/routes/+page.ts` (redirect to `/paths`).
- Contains: `SidebarUI.SidebarProvider`/`Sidebar`/`SidebarInset`, `SidebarNav.svelte`, `LanguageSwitcher.svelte`, and — only in `(app)` — `PreviewCanvas.svelte` + conditional `TimelinePanel.svelte`.
- Depends on: `$lib/shadcn/ui/sidebar`, `$lib/components/*`.
- Used by: SvelteKit browser entry (client-only; adapter-static with `404.html` fallback).

**Feature components (per section):**
- Purpose: user controls for each of the four sections.
- Location: `src/lib/components/`
- Contains: Editor — `SettingsSection.svelte`, `RingEditor.svelte` (drag-reorder via `reorderRings`), `ColorsSection.svelte`. Composition — `CanvasSection.svelte`, `LayoutModeSwitch.svelte`, `KaleidoscopePanel.svelte` (mounted only `{#if kaleidoscope.enabled}`). Animate — `SimpleSection.svelte`, `DataSeriesSection.svelte`, `AudioBarsSection.svelte`, `AudioZonesSection.svelte`, `KaleidoscopeAudioSection.svelte`. Shared — `PreviewCanvas.svelte` (wraps `createPreviewPresenter`), `TimelinePanel.svelte`.
- Depends on: `src/lib/state/composition.ts`, `src/lib/state/animation.ts`, `src/lib/state/kaleidoscope.svelte.ts`, `src/lib/geometry/*`, shadcn UI.
- Used by: the four `+page.svelte` route files.

**Composition state layer (persistence singleton + action facade):**
- Purpose: persisted composition model, palette state, ring CRUD/reorder/path-variant integrity.
- Location: `src/lib/state/composition-persistence.svelte.ts` (persistence singleton), `src/lib/state/composition.ts` (facade).
- Contains: `composition` (`createPersistedComposition('composition', DEFAULT_COMPOSITION)` — `$state` synced via `rune-sync`'s `localStorageSync`, with `TRANSIENT_RING_FIELDS` (`wave`, `zoneDrive`) stripped before every write and cross-tab `subscribe`); facade actions `addRing`, `removeRingFromComposition`, `reorderRings`, `setRingMorphT`, `setRingWave`, `setRingZoneDrive`, `createRingMorphTarget`/`removeRingMorphTarget`, `updateRingPathVariant`, `setAspectRatio`, `getCompositionBackgroundColor`, palette/color-mode actions (`colorMode` = `lsSync('color-mode', …)`), `uiState` = `lsSync('composition-ui', …)`.
- Depends on: `src/lib/types.ts`, `src/lib/color/apply.ts`, `src/lib/geometry/path-morph.ts`, `src/lib/state/ring-id.ts`.
- Used by: editor components, animate controller, preview-presenter.

**Animate controller + driver runtime layer:**
- Purpose: owns the playback clock, per-layer enable/disable, keyframe sampling, and export-audio tap; delegates actual driver math to the runtime.
- Location: `src/lib/state/animation.svelte.ts` (re-exported by `src/lib/state/animation.ts`), `src/lib/state/animation-drivers/runtime.ts`.
- Contains: `animationState` (`layers`, `audioBars`/`audioZones`/`dataSeries` configs, `audioSource`, `durationSec`, `fps`, `loop`, `alternate`); `setLayerEnabled`/`syncActiveDrivers` (mirror layer flags onto the runtime, driver layers only); `applyKeyframes` (samples every `AnimatableParam`, skipping a gate layer's `<layer>.*` params while that layer is off); `getExportAudioStream`; `createRingMorph`/`removeRingMorph`/`removeRing` (ties ring geometry actions to keyframe track lifecycle). `runtime.ts`: `createAnimationRuntime({ applyRingT })` → `registerDriver`/`setActive`/`tick` (clamps each driver's output via `clamp01` before calling `applyRingT`).
- Depends on: `state/animation-drivers/{audio-bars-driver,audio-zones-driver,data-series-driver,fallback-bars,audio-source,demo-zones}.ts`, `state/keyframes.svelte.ts`, `state/kaleidoscope-params.ts`, `state/animatable-params.ts`, `state/composition.ts`.
- Used by: Animate section components, `TimelinePanel.svelte`, `preview-presenter.svelte.ts` (`getExportAudioStream`).

**Kaleidoscope state:**
- Purpose: kaleidoscope-mode configuration singleton, independent of the animate driver layers (classified as a `'gate'` `LayerKind`).
- Location: `src/lib/state/kaleidoscope.svelte.ts`
- Contains: `kaleidoscope` (`enabled`, `sectors`, `repeat`, `liveTile`, `circularMask`, `drawBackground`, …) + setters.
- Depends on: `src/lib/geometry/kaleidoscope.ts`, `kaleidoscope-tile.ts`.
- Used by: `KaleidoscopePanel.svelte`, `KaleidoscopeAudioSection.svelte`, `preview-presenter.svelte.ts`.

**Preview/canvas presentation layer:**
- Purpose: single-writer arbitration of the one visible `<canvas>`, offscreen kaleidoscope tile lifecycle, and all export entry points.
- Location: `src/lib/components/preview-presenter.svelte.ts`
- Contains: `createPreviewPresenter()` → `attach` (Svelte attachment wiring three `$effect`s + teardown), `exportSvg`, `exportPng`, `exportAnimation`, `exportProgress`, `animationExportSupported`.
- Depends on: `state/composition.ts`, `state/animation.ts`, `state/kaleidoscope.svelte.ts`, `geometry/render-pipeline.ts`, `geometry/kaleidoscope.ts`, `geometry/kaleidoscope-tile.ts`, `geometry/aspect-ratio.ts`, `export/canvas-export.ts`, `state/export-status.svelte.ts`.
- Used by: `PreviewCanvas.svelte` (the only consumer; mounted once per `(app)` shell render via `{@attach presenter.attach}`).

**Geometry/render core:**
- Purpose: deterministic conversion from composition data to a Paper.js scene, plus the morph/wave/zone/kaleidoscope math that feeds it.
- Location: `src/lib/geometry/render-pipeline.ts`, `path-morph.ts`, `bend.ts`, `compose.ts`, `compose-ring.ts`, `kaleidoscope.ts`, `kaleidoscope-tile.ts`, `wave.ts`, `zones.ts`, `aspect-ratio.ts`, `fit-to-view.ts`, `grid-snap.ts`, `path-codec.ts`, `path-to-svg.ts`, `path-transform.ts`, `svg-import.ts`.
- Contains: `createRenderPipeline().render` (accepts `ignoreMorph`, `ignoreZoneDrive`, `fitScale`, `restFit` options; returns `RenderResult` with `warnings`/`renderedCount`/`skippedCount`), `composeRingTemplate`, `buildRingPath`, `validatePathCompatibility`, `interpolatePath`.
- Depends on: `paper`, `src/lib/types.ts`.
- Used by: `preview-presenter.svelte.ts` (visible canvas, offscreen tile, PNG export), `RingPreview.svelte`/`RingCanvas.svelte` (path-library and editor previews).

## Data Flow

**(a) Layer toggle → driver runtime:**
1. `setLayerEnabled(layer, on)` in `state/animation.svelte.ts` flips `animationState.layers[layer]`; if a driver layer was turned off and no driver layer remains active, it tears down the live `audioSource`.
2. `syncActiveDrivers()` mirrors the current flags onto the runtime — only `DRIVER_LAYERS` (`audioBars`, `audioZones`, `dataSeries`) call `runtime.setActive`; the `kaleidoscope` gate and `dataSeries`-as-inert-placeholder never touch the runtime directly.
3. On each animation frame, `runtime.tick(nowMs)` (in `animation-drivers/runtime.ts`) calls every active driver's `frame(nowMs)`, clamps each returned `t` via `clamp01`, and writes it through `deps.applyRingT(index, t)` → `setRingMorphT` in `state/composition.ts`.

**(b) Keyframes (progress-driven param sampling):**
1. `applyKeyframes(progress)` walks `getAllAnimatableParams()` — the kaleidoscope registry, audio-bars/audio-zones registries, and per-ring wave/morph params rebuilt live from `composition.rings`.
2. For any param whose id is scoped to a gate layer (`<layer>.*`), the sample is skipped unless `animationState.layers[gate]` is on.
3. `keyframes.sampleParam(id, progress)` returns a value or `null` (no track/disabled); a non-null value is written via the param's own setter. `tick()` calls this every animation frame; `scrubTo`/`refreshPreview` call it on demand while paused (e.g. after a keyframe edit).

**(c) Kaleidoscope single-writer canvas arbitration (`preview-presenter.svelte.ts`):**
1. The first `$effect` (flat composition render) returns early whenever `kaleidoscope.enabled` — it never writes to the canvas while kaleidoscope owns it.
2. The second `$effect` runs the kaleidoscope rAF loop only while enabled; it is the sole writer of the visible canvas in that mode, calling `drawKaleidoscope()` each frame, which renders either a fresh tile (`kaleidoscope.liveTile`) or a cached `staticTile` snapshot into the kaleidoscope renderer.
3. A third `$effect` keeps canvas pixel size in sync with the aspect ratio and re-snapshots `staticTile` whenever composition/aspect changes while kaleidoscope is enabled (deep-tracked via `$state.snapshot(composition)`), without ever touching the visible canvas directly (the tile renders into an offscreen `tileScope`).

**State Management:**
- Persisted source of truth: `composition` (`state/composition-persistence.svelte.ts`, key `'composition'`), `colorMode` (key `'color-mode'`), `uiState` (key `'composition-ui'`) — all `rune-sync` singletons.
- Ephemeral runtime control: `animationState` (playback clock, layer flags, per-driver configs) in `state/animation.svelte.ts`; `kaleidoscope` singleton state; driver-internal state inside each `animation-drivers/*` module.
- Rendering reads current state only — `RenderResult` carries per-call warnings/counts but no render cache is stored in shared state.

**(d) Export surfaces — runtime video vs. static (distinct paths):**

`export/canvas-export.ts` (`exportCanvasAnimation`, `isAnimationExportSupported`) is a **runtime video export**: it records the live `<canvas>` to WebM via `MediaRecorder`, invoked from `preview-presenter.exportAnimation()`, optionally taping in `getExportAudioStream()` (mic/file sources only — demo/off yield no stream) and reporting `0..1` progress through `exportStatus.rendering`/`exportProgress`.

Static SVG/PNG download is a **separate, already-built** path living **inline inside `preview-presenter.svelte.ts`** — not in `export/`: `exportSvg(opts?)` serializes the live Paper.js project (`scope.project.exportSVG`) when not in kaleidoscope mode, or the offscreen tile's SVG plus kaleidoscope framing (`generateKaleidoscopeSVG`) when `kaleidoscope.enabled`; `exportPng(opts)` renders into a scaled offscreen `paper.PaperScope` (flat) or re-renders the tile through `renderKaleidoscopeToCanvas` (kaleidoscope) and downloads a data URL. Both branch identically on `kaleidoscope.enabled` to choose flat-composition vs. kaleidoscope-tile output.

A dedicated, standalone static PNG/SVG export module (living under `export/`, alongside `canvas-export.ts`) does **not exist yet** — it is a distinct, unbuilt future path. Do not describe the two as one subsystem.

## Key Abstractions

**Composition + Ring model:**
- Purpose: serializable editor state — palettes, aspect ratio, and per-ring geometry (`templatePath`, optional `secondaryTemplatePath`, `morphT`, transient `wave`/`zoneDrive`).
- Examples: `src/lib/types.ts`, `src/lib/state/composition.ts`, `src/lib/state/composition-persistence.svelte.ts`.
- Pattern: ring-level immutable replacement (`.map(...)`) to trigger reactive redraw; transient (audio-driven) fields are stripped before every localStorage write so a reload never restores mid-animation values.

**Animate controller + `LayerKind` classification:**
- Purpose: single source of truth for what each `AnimationLayer` *is* (`driver` registers/activates a runtime driver; `gate` only toggles which keyframe params apply; `inert` is a UI-visible placeholder that never runs), replacing scattered string special-cases.
- Examples: `state/animation.svelte.ts` (`LAYER_KIND`, `DRIVER_LAYERS`, `GATE_LAYERS`, `isDriverLayer`), `state/animation-drivers/runtime.ts`.
- Pattern: the controller owns the shared playback clock and keyframe sampling; drivers own only their own `frame()` math; runtime owns activation lifecycle (`init`/`dispose`) per driver.

**Preview presenter (single-writer canvas):**
- Purpose: guarantee exactly one writer of the visible `<canvas>` at any time, avoiding flicker from two effects racing on the same pixels.
- Examples: `components/preview-presenter.svelte.ts`.
- Pattern: the flat-render effect explicitly yields (`if (kaleidoscope.enabled) return;`) to the rAF loop; the rAF loop is torn down and restarted only when its tile *source* changes (`liveTile` vs static), not every param change.

**Render pipeline:**
- Purpose: deterministic conversion from composition data to a Paper.js scene with warnings and metrics, reused identically by the visible canvas, the offscreen kaleidoscope tile, and PNG export.
- Examples: `src/lib/geometry/render-pipeline.ts`.
- Pattern: validate input → clear scope → per-ring loop (compose template → build path → fill) collecting warnings on failure → union-bounds fit (or fixed `fitScale`/`restFit` for audio-zones' stable rest scale) → view update.

## Entry Points

**Root shell:**
- Location: `src/routes/+layout.svelte`, `src/routes/+layout.ts`
- Triggers: initial app load (every route).
- Responsibilities: favicon/head, cross-route View Transitions (`onNavigate` + `document.startViewTransition`) so the `SidebarNav` pill morphs across the two different shells; `prerender = true`, `ssr = false`.

**Redirect:**
- Location: `src/routes/+page.ts`
- Triggers: navigation to `/`.
- Responsibilities: `redirect(307, resolve('/paths'))`.

**`(app)` shared shell:**
- Location: `src/routes/(app)/+layout.svelte`
- Triggers: navigation to `/editor`, `/composition`, `/animate`.
- Responsibilities: mounts `SidebarNav`, the single shared `PreviewCanvas` main pane (`animate` prop true only on `/animate`), and `TimelinePanel` conditionally when `page.url.pathname` starts with `/animate`.

**Tracciati shell:**
- Location: `src/routes/paths/+page.svelte`
- Triggers: navigation to `/paths` (also the redirect target of `/`).
- Responsibilities: own `SidebarProvider`/`Sidebar`, builtin + custom curve library browsing/selection, `RingPreview` of the selected curve — no shared `PreviewCanvas`.

## Error Handling

**Strategy:** Reject invalid morph-path updates at the state boundary without mutating state; degrade gracefully during render by recording per-ring warnings and continuing other rings; clamp driver output before it reaches ring state; fall back to a safe audio source on permission/support failure.

**Patterns:**
- `updateRingPathVariant` returns an explicit `UpdateRingPathVariantResult` (`{ ok: true } | { ok: false, reason }`) — an incompatible secondary-path edit is rejected without mutating state; an incompatible primary-path edit instead re-seeds the secondary from the new primary (a documented stopgap in `src/lib/state/composition.ts`, pending relocation of morph editing to Animate).
- `render-pipeline.ts` catches per-ring failures (non-positive `copies`, unrenderable template path, thrown errors during path build) and records them in `RenderResult.warnings` while continuing to render the remaining rings; validation-level failures (bad viewport/scope/composition shape) throw a `RenderPipelineError`.
- `animation-drivers/runtime.ts` clamps every driver frame value through `clamp01` before writing it via `applyRingT`, so a driver bug can't push `morphT` out of `[0,1]`.
- `setAudioSource` in `state/animation.svelte.ts` catches mic/file permission or support failures and falls back to the `'demo'` source so the preview keeps moving instead of erroring out.

## Cross-Cutting Concerns

**Logging:** Render-time issues accumulate in `RenderResult.warnings` (`src/lib/geometry/render-pipeline.ts`); no separate logging framework.

**Validation:** Path compatibility is enforced both at the mutation boundary (`updateRingPathVariant` in `src/lib/state/composition.ts`, via `validatePathCompatibility`) and again inside the render pipeline's morph handling (`compose-ring.ts`/`path-morph.ts`).

**Persistence hygiene:** `composition-persistence.svelte.ts` strips `TRANSIENT_RING_FIELDS` (`wave`, `zoneDrive`) before every localStorage write and gates the write on the stripped snapshot changing, so per-frame audio-driven mutation never touches `localStorage`.

**i18n:** Paraglide-generated `messages/{en,it}.json` (via `m.*`), strategy `['localStorage', 'preferredLanguage', 'baseLocale']`; `LanguageSwitcher.svelte` + `state/locale.svelte.ts`; both route shells wrap their tree in `{#key currentLocale()}` to force a full re-render on language switch.

**Authentication:** Not applicable (fully client-side, no backend).

---

*Architecture analysis: 2026-07-06*
