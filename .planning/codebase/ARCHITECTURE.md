# Architecture

**Analysis Date:** 2026-04-24

## Pattern Overview

**Overall:** Client-side SvelteKit single-page editor with domain-first modules and component-composed UI.

**Key Characteristics:**
- Routing and shell are defined in `src/routes/+layout.svelte` and `src/routes/+page.svelte`, with rendering forced to static client mode via `src/routes/+layout.ts`.
- Business state is centralized in persistent rune-sync stores in `src/lib/state/composition.ts` and consumed directly by UI components.
- Geometry/rendering logic is isolated in pure TypeScript modules under `src/lib/geometry/` and invoked by canvas components.

## Layers

**Route and App Shell Layer:**
- Purpose: Owns page composition, global CSS, and top-level navigation/entry behavior.
- Location: `src/routes/`, `src/routes/+layout.svelte`, `src/routes/+page.svelte`, `src/routes/layout.css`.
- Contains: Route-level Svelte files, demo/experiment routes, and global style tokens.
- Depends on: UI components from `$lib/components` and shadcn wrappers in `$lib/shadcn`.
- Used by: SvelteKit runtime bootstrapped from `src/app.html`.

**Feature UI Layer:**
- Purpose: Implements editor interactions for rings, palettes, settings, and export actions.
- Location: `src/lib/components/`.
- Contains: Stateful Svelte components such as `src/lib/components/Sidebar.svelte`, `src/lib/components/RingEditor.svelte`, `src/lib/components/PreviewCanvas.svelte`, `src/lib/components/ColorsSection.svelte`.
- Depends on: State module `src/lib/state/composition.ts`, geometry modules in `src/lib/geometry/`, and primitives in `src/lib/shadcn/ui/`.
- Used by: Route page `src/routes/+page.svelte`.

**State and Domain Layer:**
- Purpose: Defines composition domain model and mutating operations used across the editor.
- Location: `src/lib/types.ts`, `src/lib/state/composition.ts`, `src/lib/color/apply.ts`.
- Contains: Core types (`Path`, `Ring`, `Composition`) and state mutation functions (`addRing`, `updateRing`, `setColorMode`, palette management).
- Depends on: `rune-sync/localstorage` persistence and color helpers.
- Used by: Most editor components and exported via `src/lib/index.ts`.

**Geometry and Rendering Layer:**
- Purpose: Converts imported path data into ring geometry and paints final composition on Paper.js canvases.
- Location: `src/lib/geometry/bend.ts`, `src/lib/geometry/compose.ts`, `src/lib/geometry/svg-import.ts`.
- Contains: SVG import/parsing, ring path deformation, render ordering, fit-to-view scaling.
- Depends on: Paper.js (`paper`) and shared domain types from `src/lib/types.ts`.
- Used by: `src/lib/components/RingEditor.svelte`, `src/lib/components/RingCanvas.svelte`, `src/lib/components/PreviewCanvas.svelte`.

## Data Flow

**Editor Interaction Flow:**
1. User input in components (`src/lib/components/SettingsSection.svelte`, `src/lib/components/RingEditor.svelte`, `src/lib/components/ColorsSection.svelte`) calls mutation functions from `src/lib/state/composition.ts`.
2. Mutations update rune-sync backed objects (`composition`, `colorMode`, `uiState`) in `src/lib/state/composition.ts`, persisting to localStorage.
3. Reactive effects in canvas components (`src/lib/components/PreviewCanvas.svelte`, `src/lib/components/RingCanvas.svelte`) trigger geometry/render functions in `src/lib/geometry/compose.ts` and related modules.
4. Paper.js view updates redraw visual output and optionally export to SVG from `src/lib/components/PreviewCanvas.svelte`.

**SVG Import Flow:**
1. File input in `src/lib/components/RingEditor.svelte` passes selected file to `importSvg` from `src/lib/geometry/svg-import.ts`.
2. Import pipeline parses and validates path shape, rejecting compound paths in `src/lib/geometry/svg-import.ts`.
3. Imported `Path` data is written into the selected ring through `updateRing` in `src/lib/state/composition.ts`.
4. Updated ring data propagates to editors/previews and is rendered through `buildRingPath` in `src/lib/geometry/bend.ts`.

**State Management:**
- Use `lsSync` stores from `rune-sync/localstorage` in `src/lib/state/composition.ts` as the single source of truth for editor and palette state.
- Keep domain mutations inside `src/lib/state/composition.ts`; components should call exported functions rather than mutate nested state ad hoc.

## Key Abstractions

**Composition Model:**
- Purpose: Represents the full editable artifact (rings + palette + layout parameters).
- Examples: `Composition` in `src/lib/types.ts`, `composition` store in `src/lib/state/composition.ts`.
- Pattern: Strongly-typed shared model passed through reactive stores.

**Path Representation:**
- Purpose: Store editable/imported vector paths as command + coordinate arrays.
- Examples: `Path` in `src/lib/types.ts`, conversion logic in `src/lib/geometry/svg-import.ts` and `src/lib/components/RingCanvas.svelte`.
- Pattern: Domain-specific serialized path format independent of Paper.js runtime objects.

**Shadcn Wrapper Modules:**
- Purpose: Consolidate primitive exports and keep feature components consuming stable wrapper interfaces.
- Examples: `src/lib/shadcn/ui/sidebar/index.ts`, `src/lib/shadcn/ui/button/index.ts`, `src/lib/shadcn/ui/collapsible/index.ts`.
- Pattern: Barrel re-export modules for UI primitives.

## Entry Points

**Primary App Entry:**
- Location: `src/routes/+page.svelte`.
- Triggers: Browser navigation to root route.
- Responsibilities: Composes sidebar editor and preview area using shadcn sidebar layout.

**Global Layout Entry:**
- Location: `src/routes/+layout.svelte` with flags in `src/routes/+layout.ts`.
- Triggers: Any route render.
- Responsibilities: Injects global CSS, favicon, and route child rendering; enforces static prerender and disables SSR.

**Experimental/Testing Entries:**
- Location: `src/routes/demo/+page.svelte`, `src/routes/demo/playwright/+page.svelte`, `src/routes/experiments/+page.svelte`.
- Triggers: Manual navigation to demo/experiment routes and e2e path.
- Responsibilities: Host minimal routes for Playwright validation and Paper.js experimentation.

## Error Handling

**Strategy:** Guard-return and validation-first behavior, with lightweight user-facing messaging in components.

**Patterns:**
- Geometry/import modules return `null` on invalid/unsupported input instead of throwing outward (`src/lib/geometry/svg-import.ts`, `src/lib/geometry/bend.ts`).
- UI components gate actions with early returns and local error state (`importError` in `src/lib/components/RingEditor.svelte`).

## Cross-Cutting Concerns

**Logging:** No dedicated logging subsystem detected; runtime behavior is handled directly without structured logs.
**Validation:** Input/path validation is implemented in `src/lib/geometry/svg-import.ts` and `src/lib/color/apply.ts` (e.g., hex color filtering).
**Authentication:** Not applicable; no auth middleware, user identity flow, or protected server endpoints detected.

---

*Architecture analysis: 2026-04-24*
