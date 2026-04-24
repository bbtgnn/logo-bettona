# Architecture

**Analysis Date:** 2026-04-24

## Pattern Overview

**Overall:** Frontend feature-sliced architecture with route shell + state service + geometry pipeline modules.

**Key Characteristics:**
- UI composition is route-driven from `src/routes/+page.svelte` and delegated to focused components in `src/lib/components/`.
- Domain logic is extracted into pure TypeScript modules in `src/lib/geometry/` and `src/lib/color/`.
- Application state is centralized in `src/lib/state/composition.ts` and persisted through `rune-sync/localstorage`.

## Layers

**Route & App Shell Layer:**
- Purpose: Bootstraps SvelteKit app shell and page-level composition.
- Location: `src/app.html`, `src/routes/+layout.ts`, `src/routes/+layout.svelte`, `src/routes/+page.svelte`
- Contains: Layout flags, global styles import, root page composition.
- Depends on: SvelteKit runtime and `$lib` components.
- Used by: Browser entry flow for all routes.

**Feature UI Layer:**
- Purpose: Renders controls, editor panels, and canvas containers.
- Location: `src/lib/components/`
- Contains: `Sidebar.svelte`, `RingEditor.svelte`, `PreviewCanvas.svelte`, `ColorsSection.svelte`, `SettingsSection.svelte`.
- Depends on: `src/lib/state/composition.ts`, `src/lib/geometry/*`, `src/lib/shadcn/ui/*`.
- Used by: Route pages, primarily `src/routes/+page.svelte`.

**State & Domain Orchestration Layer:**
- Purpose: Owns composition state, color mode state, UI expansion state, and mutation actions.
- Location: `src/lib/state/composition.ts`
- Contains: `composition`, `colorMode`, `uiState`, and mutators (`addRing`, `updateRing`, `setColorMode`, `reorderRings`, etc.).
- Depends on: `rune-sync/localstorage`, `src/lib/types.ts`, `src/lib/color/apply.ts`.
- Used by: UI components and render-triggered effects.

**Geometry & Rendering Layer:**
- Purpose: Converts ring templates to rendered Paper.js paths and manages draw lifecycle.
- Location: `src/lib/geometry/`
- Contains: `render-pipeline.ts`, `bend.ts`, `svg-import.ts`, `compose.ts`.
- Depends on: `paper` and `src/lib/types.ts`.
- Used by: `src/lib/components/PreviewCanvas.svelte`, `src/lib/components/RingEditor.svelte`, tests in `src/lib/geometry/*.spec.ts`.

**Design System Layer:**
- Purpose: Provides reusable UI primitives and styling contracts.
- Location: `src/lib/shadcn/`
- Contains: Generated and adapted shadcn-svelte primitives (sidebar, button, input, tooltip, sheet, etc.).
- Depends on: Svelte, Bits UI ecosystem, Tailwind styles in `src/routes/layout.css`.
- Used by: Feature components in `src/lib/components/`.

## Data Flow

**Ring Editing to Canvas Render:**

1. User interaction in `src/lib/components/RingEditor.svelte` or `src/lib/components/Sidebar.svelte` invokes mutation functions from `src/lib/state/composition.ts`.
2. `composition` and related state stores update and persist to local storage via `lsSync` in `src/lib/state/composition.ts`.
3. Reactive effect in `src/lib/components/PreviewCanvas.svelte` observes `composition` and calls `createRenderPipeline().render(...)` from `src/lib/geometry/render-pipeline.ts`.
4. Render pipeline validates input, builds ring paths with `buildRingPath` in `src/lib/geometry/bend.ts`, clears/updates Paper.js scope, and redraws canvas.

**SVG Import to Ring Template:**

1. File input in `src/lib/components/RingEditor.svelte` calls `importSvg(file, importScope)` in `src/lib/geometry/svg-import.ts`.
2. SVG parser normalizes/imports the first valid path and converts segments to project `Path` shape in `segmentsToPath`.
3. Resulting `templatePath` is applied through `updateRing(...)` in `src/lib/state/composition.ts`.
4. Updated ring template is consumed on next render cycle by `src/lib/geometry/render-pipeline.ts`.

**State Management:**
- State is mutable reactive module state using rune-sync `lsSync` in `src/lib/state/composition.ts`.
- UI state and model state are colocated in the same state module, with UI-only map at `uiState.expandedRings`.

## Key Abstractions

**Composition Model:**
- Purpose: Canonical app domain model for rings, palettes, and geometry parameters.
- Examples: `src/lib/types.ts`, `src/lib/state/composition.ts`
- Pattern: Shared TypeScript types with a single mutable source-of-truth state module.

**Render Pipeline Boundary:**
- Purpose: Encapsulates rendering lifecycle and input validation around Paper.js.
- Examples: `src/lib/geometry/render-pipeline.ts`, `src/lib/geometry/compose.ts`
- Pattern: Factory-based service (`createRenderPipeline`) returning explicit `render` and `dispose` methods.

**Path Conversion Boundary:**
- Purpose: Normalizes SVG and template paths into internal `Path` command/coordinate representation.
- Examples: `src/lib/geometry/svg-import.ts`, `src/lib/geometry/bend.ts`
- Pattern: Adapter and transformation functions around a stable internal format (`Path` in `src/lib/types.ts`).

## Entry Points

**Application Entry Point:**
- Location: `src/app.html`
- Triggers: Browser load of SvelteKit app.
- Responsibilities: Host HTML shell and SvelteKit placeholders.

**Layout Entry Point:**
- Location: `src/routes/+layout.ts` and `src/routes/+layout.svelte`
- Triggers: Route initialization.
- Responsibilities: Static export config (`prerender`, `ssr`), global CSS import, favicon setup, child route rendering.

**Main Feature Entry Point:**
- Location: `src/routes/+page.svelte`
- Triggers: Root route navigation.
- Responsibilities: Compose sidebar/editor region and preview canvas region.

**Experimental Entry Point:**
- Location: `src/routes/experiments/+page.svelte` and `src/routes/experiments/paper.ts`
- Triggers: Navigation to experiments route.
- Responsibilities: Isolated Paper.js interaction experiments separate from main editor flow.

## Error Handling

**Strategy:** Fail-fast validation at rendering boundaries; soft failure for per-ring rendering.

**Patterns:**
- Input validation uses explicit assertions and throws `RenderPipelineError` in `src/lib/geometry/render-pipeline.ts`.
- Per-ring rendering failures are downgraded to warnings and skip behavior in `src/lib/geometry/render-pipeline.ts`.
- SVG import uses null-return fallback on invalid input in `src/lib/geometry/svg-import.ts`.

## Cross-Cutting Concerns

**Logging:** Not detected as a centralized concern; no app-level logger module is present.
**Validation:** Geometry/render input validation in `src/lib/geometry/render-pipeline.ts`; SVG structural validation in `src/lib/geometry/svg-import.ts`.
**Authentication:** Not applicable for this static client-side editor (`src/routes/+layout.ts` sets `ssr = false` and no auth modules are present).

---

*Architecture analysis: 2026-04-24*
