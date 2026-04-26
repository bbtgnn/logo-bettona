# Architecture

**Analysis Date:** 2026-04-26

## Pattern Overview

**Overall:** Client-only SvelteKit SPA with local-first state, Paper.js for vector geometry, and a thin render pipeline that turns domain models into canvas/SVG output.

**Key Characteristics:**
- Domain types (`Composition`, `Ring`, `Path`) live in TypeScript and persist via `rune-sync` localStorage.
- Two Paper.js usage modes: per-widget scopes for editing (`RingCanvas`) and import (`RingEditor`), and a dedicated preview scope in `PreviewCanvas`.
- Ring geometry is template-driven: a flat `Path` (cmds + crds) is bent around a circle in `buildRingPath`; optional morphing blends two compatible paths before bending.

## Layers

**Presentation (routes + layout):**
- Purpose: Shell, navigation chrome, and placement of sidebar vs main preview.
- Location: `src/routes/+page.svelte`, `src/routes/+layout.svelte`
- Contains: Svelte 5 UI composition, shadcn sidebar provider.
- Depends on: `Sidebar`, `PreviewCanvas`.
- Used by: Browser entry via SvelteKit.

**Feature components:**
- Purpose: User-facing editors and preview.
- Location: `src/lib/components/`
- Contains: `Sidebar.svelte` (rings list), `RingEditor.svelte` (per-ring controls + path editor), `RingCanvas.svelte` (interactive path), `PreviewCanvas.svelte` (full composition preview), color/settings sections.
- Depends on: `$lib/state/composition`, `$lib/geometry/*`, shadcn UI.
- Used by: `+page.svelte`.

**Application state:**
- Purpose: Serializable composition, color mode, UI expansion flags; mutations that enforce morph/path rules.
- Location: `src/lib/state/composition.ts`
- Contains: `composition`, `colorMode`, `uiState` (`lsSync`), CRUD for rings/palettes, `setRingMorphT`, `createRingMorphTarget`, `removeRingMorphTarget`, `updateRingPathVariant`.
- Depends on: `$lib/types`, `$lib/color/apply`, `$lib/geometry/path-morph` (`validatePathCompatibility`).
- Used by: Components and preview `$effect` dependencies.

**Domain types:**
- Purpose: Single source of truth for data shapes.
- Location: `src/lib/types.ts`
- Contains: `Path`, `Ring` (includes `templatePath`, `secondaryTemplatePath`, `morphT`, `ringHeight`, `copies`, `color`), `Composition`, palette types.
- Depends on: None.
- Used by: State, geometry, render pipeline.

**Geometry core:**
- Purpose: Path bending, SVG import, path morph validation/interpolation, orchestrated render.
- Location: `src/lib/geometry/bend.ts`, `src/lib/geometry/svg-import.ts`, `src/lib/geometry/path-morph.ts`, `src/lib/geometry/render-pipeline.ts`
- Contains: `buildRingPath`, `importSvg`, `validatePathCompatibility` / `interpolatePath`, `createRenderPipeline().render`.
- Depends on: `paper`, `$lib/types`.
- Used by: `RingCanvas` (bend not always direct—editor uses path as-is), `RingEditor` (import), `render-pipeline` (bend + morph).

**Design system (shadcn-svelte):**
- Purpose: Reusable primitives (buttons, sliders, sidebar).
- Location: `src/lib/shadcn/`
- Depends on: bits-ui patterns, Tailwind.
- Used by: Feature components.

## Data Flow

**Composition edit → preview (including morph interpolation):**

1. User edits rings in the sidebar: `Sidebar.svelte` iterates `composition.rings` and mounts `RingEditor.svelte` per index.
2. `RingEditor` calls `updateRing`, `setRingMorphT`, `createRingMorphTarget`, `removeRingMorphTarget`, or `updateRingPathVariant` from `src/lib/state/composition.ts`. Those functions mutate the `composition` rune (localStorage-backed).
3. `Ring` shape in `src/lib/types.ts` carries `templatePath` (primary), optional `secondaryTemplatePath`, and `morphT` in `[0, 1]`. When both paths exist, `updateRingPathVariant` requires `validatePathCompatibility` from `src/lib/geometry/path-morph.ts` so cmds and crds lengths match before accepting primary or secondary updates.
4. `PreviewCanvas.svelte` holds a `paper.PaperScope` on the main canvas. An `$effect` reads `composition` and calls `createRenderPipeline().render()` in `src/lib/geometry/render-pipeline.ts`.
5. For each ring (outer to inner), the render loop builds `effectiveRing`: if both `templatePath` and `secondaryTemplatePath` are set, it runs `validatePathCompatibility`; on success it replaces `templatePath` with `interpolatePath(primary, secondary, ring.morphT ?? 0)` (linear per-coordinate blend, cmds copied from primary). On failure it logs a warning and uses the unblended ring (fallback).
6. `buildRingPath(effectiveRing, radius, scope)` in `src/lib/geometry/bend.ts` maps the (possibly interpolated) template into a closed tiled ring at the composition radius for that index, then Paper.js draws and `fitToView` scales the layer to the viewport.

**Path editing (primary vs secondary, no interpolation on this canvas):**

1. `RingEditor` tracks `editVariant`: `'primary' | 'secondary'`. If `secondaryTemplatePath` is null, only primary editing applies; `createRingMorphTarget` seeds secondary as a copy of primary with clamped `morphT`.
2. `{#key editVariant}` remounts `RingCanvas.svelte` so the editor scope resets when switching which variant is edited.
3. `RingCanvas` receives `templatePath` bound to either `ring.templatePath` or `ring.secondaryTemplatePath` and emits `onchange` → `applyPathFromEditor` → `updateRingPathVariant(index, editVariant, newPath)` with the same compatibility rules as imports.

**SVG import:**

1. `RingEditor` uses a dedicated one-pixel `paper.PaperScope` for `importSvg` (`src/lib/geometry/svg-import.ts`), then applies the result via `updateRingPathVariant` for the active variant.

**Color mode:**

1. `applyColors` in `src/lib/color/apply.ts` is invoked from `composition.ts` when mode or palette changes; ring colors update in bulk without touching path geometry.

**State Management:**

- Primary store: `composition` and related runes from `rune-sync` (`lsSync`) in `src/lib/state/composition.ts`.
- Svelte 5 `$effect` in `PreviewCanvas` subscribes to `composition` implicitly by referencing it, triggering re-render on any ring field change (including `morphT`).

## Key Abstractions

**Path (flat vector):**
- Purpose: Serializable SVG-like path as parallel `cmds` and `crds` arrays.
- Examples: `src/lib/types.ts`
- Pattern: Explicit command stream; morphing assumes structural equality between two `Path` values.

**Ring morph (secondary template + morphT):**
- Purpose: Animate or design in-between shapes by blending two topologically identical paths before polar bend.
- Examples: `src/lib/types.ts` (`secondaryTemplatePath`, `morphT`), `src/lib/state/composition.ts`, `src/lib/geometry/path-morph.ts`, `src/lib/geometry/render-pipeline.ts`
- Pattern: State holds two paths + scalar `t`; render-time `interpolatePath`; editor-time strict validation on writes.

**Render pipeline:**
- Purpose: Validate inputs, clear scope, draw all rings, fit view, return metrics/warnings.
- Examples: `src/lib/geometry/render-pipeline.ts`
- Pattern: Factory `createRenderPipeline()` returning `{ render, dispose }`; morph applied inside per-ring loop before `buildRingPath`.

## Entry Points

**SvelteKit app shell:**
- Location: `src/routes/+layout.svelte`, `src/routes/+layout.ts`
- Triggers: App load.
- Responsibilities: Global CSS, favicon, child route rendering.

**Shape editor page:**
- Location: `src/routes/+page.svelte`
- Triggers: Navigation to `/`.
- Responsibilities: Sidebar + inset layout; hosts `PreviewCanvas` in main.

## Error Handling

**Strategy:** Validation at state boundaries (path variant updates); soft degradation in render (skip ring, collect warnings); user-visible strings in `RingEditor` for import/path errors.

**Patterns:**
- `updateRingPathVariant` returns `{ ok, reason }` without mutating on failure (`src/lib/state/composition.ts`).
- Render loop catches per-ring errors and increments `skippedCount` with warning messages (`src/lib/geometry/render-pipeline.ts`).
- `interpolatePath` throws `PathMorphError` if compatibility pre-check fails (used after `validatePathCompatibility` in pipeline—normally guarded).

## Cross-Cutting Concerns

**Logging:** Warnings accumulated in `RenderResult.warnings` from the render pipeline; UI does not centralize a logger.

**Validation:** Path compatibility for morph (`validatePathCompatibility`); composition shape assertions in `render` before drawing.

**Authentication:** Not applicable (static client app).

---

*Architecture analysis: 2026-04-26*
