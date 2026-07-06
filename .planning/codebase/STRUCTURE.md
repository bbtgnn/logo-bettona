# Codebase Structure

**Analysis Date:** 2026-07-06

## Directory Layout

```
logo-bettona/
├── src/
│   ├── app.d.ts                      # SvelteKit ambient types
│   ├── lib/
│   │   ├── actions/                  # Svelte actions (draggable.ts)
│   │   ├── animation/                # Keyframe math + timeline geometry helpers
│   │   ├── assets/                   # Static assets (favicon.svg)
│   │   ├── color/                    # Palette application logic + tests
│   │   ├── components/               # Sidebar sections, ring editor, preview canvas, timeline UI
│   │   ├── export/                   # Runtime video export (WebM via MediaRecorder)
│   │   ├── geometry/                 # Path morph, bending, render pipeline, kaleidoscope, composition facade
│   │   ├── paraglide/                # Generated i18n runtime + messages (gitignored)
│   │   ├── shadcn/                   # Vendored UI primitives (button, sidebar, sheet, ...)
│   │   ├── state/                    # Composition persistence, animation controller, drivers, path library
│   │   │   └── animation-drivers/    # Per-layer drivers (audio bars/zones, data series, runtime)
│   │   ├── types.ts                  # Core domain types
│   │   ├── index.ts                  # Public exports
│   │   ├── messages-parity.spec.ts   # Checks en.json/it.json key parity
│   │   └── vitest-examples/          # Example tests (Welcome.svelte, greet.ts)
│   └── routes/
│       ├── +layout.svelte            # Root layout: favicon, cross-route View Transitions
│       ├── +layout.ts                # `prerender = true; ssr = false`
│       ├── +page.ts                  # Redirects `/` → `/paths`
│       ├── layout.css                # Global stylesheet imported by root layout
│       ├── paths/                    # Tracciati page — NOT inside the (app) group (own sidebar shell)
│       ├── (app)/                    # Route group: shared sidebar shell for the editing pipeline
│       │   ├── +layout.svelte        # SidebarNav + PreviewCanvas + conditional TimelinePanel on /animate
│       │   ├── editor/               # Editor page
│       │   ├── composition/          # Composition page
│       │   └── animate/              # Animate page
│       ├── about/                    # About page
│       ├── demo/                     # Demo routes (incl. demo/playwright/)
│       └── experiments/              # Experimental routes (paper.js scratch)
├── messages/                         # Paraglide source i18n (en.json, it.json)
├── project.inlang/                   # Inlang project config feeding Paraglide codegen
├── static/                           # Static files served by SvelteKit
├── .planning/                        # Planning artifacts and codebase map documents
├── package.json
├── vite.config.ts
├── playwright.config.ts
├── svelte.config.js
└── tsconfig.json
```

## Directory Purposes

**`src/routes/paths/`:**
- Purpose: Tracciati (path library) page — first stop in the pipeline, reached by the `/` redirect.
- Contains: its own `SidebarUI`/`SidebarNav` wiring (does **not** share `(app)/+layout.svelte`); builtin + custom curve list; curve creation.
- Key files: `src/routes/paths/+page.svelte`, `src/routes/paths/path-manager.e2e.ts`.
- Note: physically a sibling of `(app)/`, not nested inside it — despite appearing as a peer tab in `SidebarNav`. See "Special Directories" below.

**`src/routes/(app)/`:**
- Purpose: Route group sharing one shell (sidebar + live preview canvas) across the Editor/Composizione/Animate pages.
- Contains: `+layout.svelte` (SidebarNav, PreviewCanvas, conditional TimelinePanel when `pathname` starts with `/animate`), and the three page subdirs below.
- Key files: `src/routes/(app)/+layout.svelte`.

**`src/routes/(app)/editor/`:**
- Purpose: Editor page — ring settings and color assignment.
- Contains: `SettingsSection`, ring list (`RingEditor`, drag-reorder), `ColorsSection`.
- Key files: `src/routes/(app)/editor/+page.svelte`.

**`src/routes/(app)/composition/`:**
- Purpose: Composizione page — layout mode + kaleidoscope tiling controls.
- Contains: `CanvasSection`, `LayoutModeSwitch`, conditional `KaleidoscopePanel` (shown when `kaleidoscope.enabled`).
- Key files: `src/routes/(app)/composition/+page.svelte`.

**`src/routes/(app)/animate/`:**
- Purpose: Animate page — per-layer animation authoring (simple, data series, audio bars/zones, kaleidoscope audio).
- Contains: `SimpleSection`, `DataSeriesSection`, `AudioBarsSection`, `AudioZonesSection`, `KaleidoscopeAudioSection`.
- Key files: `src/routes/(app)/animate/+page.svelte`.

**`src/lib/components/`:**
- Purpose: Feature UI — sidebar nav/sections, ring editing, preview canvas, timeline.
- Contains: `SidebarNav.svelte`, `SettingsSection.svelte`, `ColorsSection.svelte`, `RingEditor.svelte`, `RingCanvas.svelte`, `PreviewCanvas.svelte`, `preview-presenter.svelte.ts`, `CanvasSection.svelte`, `LayoutModeSwitch.svelte`, `KaleidoscopePanel.svelte`, `SimpleSection.svelte`, `DataSeriesSection.svelte`, `AudioBarsSection.svelte`, `AudioZonesSection.svelte`, `KaleidoscopeAudioSection.svelte`, `TimelinePanel.svelte`, `TimelineRuler.svelte`, `TimelineTrack.svelte`, `KeyframeGraphEditor.svelte`.
- Key files: `src/lib/components/preview-presenter.svelte.ts`, `src/lib/components/PreviewCanvas.svelte`, `src/lib/components/SidebarNav.svelte`.

**`src/lib/state/`:**
- Purpose: Reactive app state, persistence, and the animation controller.
- Contains: `composition.ts` (action facade), `composition-persistence.svelte.ts` (`lsSync` singleton), `animation.svelte.ts`/`animation.ts` (playback controller, re-export), `kaleidoscope.svelte.ts` (singleton), `keyframes.svelte.ts`, `path-library.ts`, `locale.svelte.ts`, `ring-id.ts`, `animatable-params.ts`, `builtin-curves.ts`, `kaleidoscope-params.ts`, `export-status.svelte.ts`, `default.ts`.
- Key files: `src/lib/state/composition.ts`, `src/lib/state/animation.svelte.ts`, `src/lib/state/composition-persistence.svelte.ts`.

**`src/lib/state/animation-drivers/`:**
- Purpose: Per-layer animation drivers plugged into the animation runtime.
- Contains: `runtime.ts` (`createAnimationRuntime`), `audio-source.ts`, `audio-bars-driver.ts`, `audio-zones-driver.ts`, `data-series-driver.ts`, `fallback-bars.ts`, `demo-zones.ts`, `types.ts`.
- Key files: `src/lib/state/animation-drivers/runtime.ts`, `src/lib/state/animation-drivers/types.ts`.

**`src/lib/geometry/`:**
- Purpose: Geometry transformations and render orchestration.
- Contains: `bend.ts`, `path-morph.ts`, `render-pipeline.ts`, `svg-import.ts`, `compose.ts`, `compose-ring.ts`, `kaleidoscope.ts`, `kaleidoscope-tile.ts`, `wave.ts`, `zones.ts`, `aspect-ratio.ts`, `fit-to-view.ts`, `grid-snap.ts`, `path-codec.ts`, `path-to-svg.ts`, `path-transform.ts`, plus co-located `*.spec.ts`/`*.svelte.spec.ts` tests.
- Key files: `src/lib/geometry/render-pipeline.ts`, `src/lib/geometry/path-morph.ts`, `src/lib/geometry/compose.ts`.

**`src/lib/export/`:**
- Purpose: Runtime video export.
- Contains: `canvas-export.ts` — WebM export via MediaRecorder. (Static SVG/PNG download is a separate concern; see Special Directories / Naming Conventions notes.)
- Key files: `src/lib/export/canvas-export.ts`.

**`src/lib/animation/`:**
- Purpose: Standalone keyframe/timeline math shared by state and UI (distinct from `state/animation.svelte.ts`, the controller).
- Contains: `keyframes.ts`, `timeline-geometry.ts`.
- Key files: `src/lib/animation/keyframes.ts`.

**`src/lib/color/`:**
- Purpose: Palette application logic.
- Contains: `apply.ts`.
- Key files: `src/lib/color/apply.ts`.

**`src/lib/actions/`:**
- Purpose: Svelte actions.
- Contains: `draggable.ts` (ring drag-reorder).
- Key files: `src/lib/actions/draggable.ts`.

## Key File Locations

**Entry Points:**
- `src/routes/+page.ts`: Redirects `/` → `/paths` via `redirect(307, resolve('/paths'))`.
- `src/routes/paths/+page.svelte`: Tracciati page; owns its own sidebar shell.
- `src/routes/(app)/+layout.svelte`: Shared shell (SidebarNav, PreviewCanvas, conditional TimelinePanel) for editor/composition/animate.
- `src/lib/components/SidebarNav.svelte`: Defines the four pipeline tabs (`/paths`, `/editor`, `/composition`, `/animate`) and active-tab pill.

**Configuration:**
- `package.json`: scripts/dependencies (`animejs`, `paper`, `rune-sync` runtime deps; rest dev).
- `svelte.config.js`: `adapter-static` with `fallback: '404.html'`, `base: process.env.BASE_PATH ?? ''`, Svelte runes mode.
- `vite.config.ts`: build/dev config.
- `playwright.config.ts`: E2E settings.

**Core Logic:**
- `src/lib/state/composition.ts`: action facade for rings, colors, morph targets, path variants, aspect ratio, background color.
- `src/lib/state/composition-persistence.svelte.ts`: `lsSync`-backed persisted composition singleton.
- `src/lib/state/animation.svelte.ts`: animation controller (`AnimationLayer`, `LayerKind`, `DRIVER_LAYERS`, `setLayerEnabled`/`syncActiveDrivers`, `applyKeyframes`, `getExportAudioStream`, `fps`); re-exported by `src/lib/state/animation.ts`.
- `src/lib/state/kaleidoscope.svelte.ts`: kaleidoscope singleton (`enabled`, `sectors`, `repeat`, `liveTile`, `circularMask`, ...).
- `src/lib/geometry/render-pipeline.ts`: render-time interpolation (`interpolatePath`) and radial ring drawing (`buildRingPath`).
- `src/lib/components/preview-presenter.svelte.ts`: single-writer canvas presenter — flat composition `$effect` defers to the kaleidoscope rAF loop while `kaleidoscope.enabled`; inline `exportSvg`/`exportPng`; `exportAnimation` delegates to `src/lib/export/canvas-export.ts`.
- `src/lib/types.ts`: shared model (`Composition`, `Ring`, `Path`).

**Testing:**
- `src/lib/state/animation.svelte.spec.ts`: controller behavior and stale-composition safety.
- `src/lib/components/preview-presenter.svelte.spec.ts` and `preview-presenter.export.svelte.spec.ts`: presenter/export wiring.
- `src/lib/geometry/*.spec.ts` / `*.svelte.spec.ts`: geometry invariants.
- `src/routes/(app)/*/page.svelte.spec.ts`, `src/routes/(app)/layout.svelte.spec.ts`, `src/routes/paths/page.svelte.spec.ts`: per-page/layout component tests.
- `src/routes/(app)/workspace-nav.e2e.ts`, `src/routes/paths/path-manager.e2e.ts`, `src/routes/about/about-nav.e2e.ts`, `src/routes/demo/playwright/page.svelte.e2e.ts`: Playwright E2E specs.

## Naming Conventions

**Files:**
- UI components use `PascalCase.svelte` (for example `AudioBarsSection.svelte`, `SidebarNav.svelte`).
- State and geometry modules use lowercase/kebab TypeScript filenames (for example `composition.ts`, `animation.svelte.ts`, `render-pipeline.ts`).
- Modules that use Svelte 5 runes outside `.svelte` files use the `*.svelte.ts` suffix (for example `composition-persistence.svelte.ts`, `kaleidoscope.svelte.ts`).
- Browser/DOM-dependent tests are co-located and use `*.svelte.spec.ts` (run in the `client` Vitest project); plain-logic tests use `*.spec.ts` (run in the `server`/node project).
- E2E specs use `*.e2e.ts`.

**Directories:**
- Organize by concern under `src/lib/` (`actions`, `animation`, `color`, `components`, `export`, `geometry`, `shadcn`, `state`).
- Pipeline pages live under `src/routes/(app)/` (`editor`, `composition`, `animate`) except `paths`, which is a sibling top-level route with its own layout wiring — see Special Directories.

## Where to Add New Code

**New pipeline page section (editor/composition/animate):**
- UI control surface: the relevant `*Section.svelte` in `src/lib/components/`, mounted from `src/routes/(app)/<page>/+page.svelte`.
- Shell-level changes (nav tabs, canvas, timeline visibility): `src/routes/(app)/+layout.svelte` and `src/lib/components/SidebarNav.svelte`.

**New animation driver / animate-page layer:**
- Driver implementation: `src/lib/state/animation-drivers/` (new `*-driver.ts`, following `audio-bars-driver.ts`/`data-series-driver.ts`).
- Register the layer: `src/lib/state/animation.svelte.ts` (`AnimationLayer`, `LayerKind`, `DRIVER_LAYERS`, `setLayerEnabled`/`syncActiveDrivers`).
- UI control surface: new `Audio*Section.svelte`/equivalent in `src/lib/components/`, mounted from `src/routes/(app)/animate/+page.svelte`.

**New composition or ring morph field:**
- Type definition: `src/lib/types.ts`.
- Persistence/defaults/mutations: `src/lib/state/composition.ts` and `src/lib/state/composition-persistence.svelte.ts`.
- Render behavior for field: `src/lib/geometry/render-pipeline.ts` or `src/lib/geometry/bend.ts`.

**New morph algorithm behavior:**
- Compatibility/interpolation rules: `src/lib/geometry/path-morph.ts`.
- Ring application order and fallback behavior: `src/lib/geometry/render-pipeline.ts`.

**New path/curve in the library:**
- Builtin curve seeding: `src/lib/state/builtin-curves.ts`.
- Library state/mutations: `src/lib/state/path-library.ts`.
- UI: `src/routes/paths/+page.svelte` and `src/lib/components/CustomCurveItem.svelte`/`PathThumbnail.svelte`.

**New export format:**
- Runtime video export changes: `src/lib/export/canvas-export.ts`, wired from `src/lib/components/preview-presenter.svelte.ts` (`exportAnimation`).
- Static SVG/PNG export changes: inline in `src/lib/components/preview-presenter.svelte.ts` (`exportSvg`/`exportPng`) — keep this path distinct from `canvas-export.ts`; do not intertwine video and static-image export.

**Utilities and exports:**
- Public re-exports: `src/lib/index.ts`.
- Keep compatibility facades in `src/lib/geometry/compose.ts` only when needed for legacy call sites.

## Special Directories

**`src/routes/paths/`:**
- Purpose: Tracciati page.
- Note: physically a sibling of `src/routes/(app)/`, not nested inside it. It re-implements its own `SidebarUI`/`SidebarNav` shell rather than sharing `(app)/+layout.svelte`. The root layout's `onNavigate` comment explicitly calls this out: cross-route View Transitions have to bridge "`/paths` vs the `(app)` group" because the two use different layout components.
- Generated: No. Committed: Yes.

**`src/lib/paraglide/`:**
- Purpose: Generated Paraglide i18n runtime + per-locale message functions, compiled from `messages/{en,it}.json` and `project.inlang/`.
- Generated: Yes. Committed: No (gitignored).

**`src/lib/shadcn/`:**
- Purpose: Vendored component primitives and helpers (button, sidebar, sheet, tooltip, etc.) used by feature components.
- Generated: Partially (vendor-style UI layer, adapted from shadcn/svelte).
- Committed: Yes.

**`.planning/`:**
- Purpose: planning artifacts and codebase map documents.
- Generated: No.
- Committed: Yes.

---

*Structure analysis: 2026-07-06*
