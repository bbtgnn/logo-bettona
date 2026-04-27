# Architecture

**Analysis Date:** 2026-04-27

## Pattern Overview

**Overall:** Client-only SvelteKit editor with local-first reactive state, a dedicated animation controller for morph playback, and a Paper.js render pipeline that derives ring geometry from composition state.

**Key Characteristics:**
- Sidebar sections are ordered by editing workflow in `src/lib/components/Sidebar.svelte`: `SettingsSection` -> `AnimationSection` -> `ColorsSection` -> ring editors.
- Ring morph animation is controller-driven in `src/lib/state/animation.svelte.ts` and writes only `morphT` through `setRingMorphT` from `src/lib/state/composition.ts`.
- Preview rendering remains stateless and derived: `src/lib/components/PreviewCanvas.svelte` reacts to `composition` and delegates all drawing/morph blending to `src/lib/geometry/render-pipeline.ts`.

## Layers

**Presentation (routes + shell):**
- Purpose: Application frame and split layout between sidebar and preview canvas.
- Location: `src/routes/+page.svelte`, `src/routes/+layout.svelte`
- Contains: shadcn sidebar provider/inset and main editor viewport.
- Depends on: `src/lib/components/Sidebar.svelte`, `src/lib/components/PreviewCanvas.svelte`
- Used by: SvelteKit browser entry.

**Feature components (sidebar and editors):**
- Purpose: User controls for settings, animation playback, colors, and per-ring editing.
- Location: `src/lib/components/`
- Contains: `SettingsSection.svelte`, `AnimationSection.svelte`, `ColorsSection.svelte`, `RingEditor.svelte`, `RingCanvas.svelte`, `PreviewCanvas.svelte`.
- Depends on: `src/lib/state/composition.ts`, `src/lib/state/animation.svelte.ts`, `src/lib/geometry/*`, shadcn UI.
- Used by: `src/routes/+page.svelte`.

**Composition state layer:**
- Purpose: Persisted composition model, palette state, ring CRUD/reorder, and morph path integrity rules.
- Location: `src/lib/state/composition.ts`
- Contains: `composition`, `colorMode`, `uiState`, `setRingMorphT`, `createRingMorphTarget`, `removeRingMorphTarget`, `updateRingPathVariant`.
- Depends on: `src/lib/types.ts`, `src/lib/color/apply.ts`, `src/lib/geometry/path-morph.ts`.
- Used by: ring editors, animation controller, preview rendering.

**Animation controller layer:**
- Purpose: Playback lifecycle for morph sweep animation across all rings with a secondary path.
- Location: `src/lib/state/animation.svelte.ts` (re-exported by `src/lib/state/animation.ts`)
- Contains: `animationState`, `togglePlay`, `setAnimationDurationSec`, `setAnimationLoop`, `setAnimationAlternate`, `handleCompositionChanged`, `stopAnimation`.
- Depends on: `animejs` (`animate`), `composition` and `setRingMorphT` from `src/lib/state/composition.ts`.
- Used by: `src/lib/components/AnimationSection.svelte`.

**Geometry/render core:**
- Purpose: Morph compatibility checks, path interpolation, radial path composition, and canvas drawing.
- Location: `src/lib/geometry/path-morph.ts`, `src/lib/geometry/bend.ts`, `src/lib/geometry/render-pipeline.ts`, `src/lib/geometry/compose.ts`
- Contains: `validatePathCompatibility`, `interpolatePath`, `buildRingPath`, `createRenderPipeline().render`, `renderComposition`.
- Depends on: `paper`, `src/lib/types.ts`.
- Used by: `PreviewCanvas.svelte`, `RingEditor.svelte` (import flow), legacy callers through `compose.ts`.

## Data Flow

**Animation control placement and trigger flow:**

1. `src/lib/components/Sidebar.svelte` mounts `AnimationSection.svelte` between `SettingsSection.svelte` and `ColorsSection.svelte`.
2. `AnimationSection.svelte` reads/writes `animationState` and controller actions from `src/lib/state/animation.svelte.ts`.
3. An `$effect` in `AnimationSection.svelte` tracks `composition.rings.length` and calls `handleCompositionChanged()` via `untrack` to stop stale playback when ring topology changes.

**Morph playback flow (controller -> composition -> render):**

1. User clicks Play in `AnimationSection.svelte`; `togglePlay()` starts/reuses an anime instance.
2. `startNewAnimation()` in `src/lib/state/animation.svelte.ts` computes `animatedIndices` from rings where `secondaryTemplatePath` exists.
3. Every anime update writes `t` to each target ring via `setRingMorphT(index, t)` in `src/lib/state/composition.ts` and mirrors progress to `animationState.progress`.
4. `PreviewCanvas.svelte` has an `$effect` on `composition`; each `morphT` update triggers `renderPipeline.render(...)`.
5. `render()` in `src/lib/geometry/render-pipeline.ts` composes `effectiveRing` per index: if primary and secondary paths are compatible, it applies `interpolatePath(primary, secondary, morphT)` before `buildRingPath(...)`.
6. Paper.js fills each rendered ring and fits the result to the viewport.

**Ring morph authoring flow (composition/ring updates):**

1. `RingEditor.svelte` creates/removes morph targets through `createRingMorphTarget()` and `removeRingMorphTarget()` in `src/lib/state/composition.ts`.
2. Primary/secondary variant edits (canvas or SVG import) are routed through `updateRingPathVariant(index, variant, path)`.
3. `updateRingPathVariant` enforces compatibility with `validatePathCompatibility` and rejects incompatible writes with `{ ok: false, reason }`, preserving existing composition state.

**State Management:**
- Persisted source of truth: `composition`, `colorMode`, `uiState` from `lsSync` in `src/lib/state/composition.ts`.
- Ephemeral runtime control: `animationState` and anime instance internals in `src/lib/state/animation.svelte.ts`.
- Rendering reads current state only; no render cache is stored in state.

## Key Abstractions

**Composition + Ring model:**
- Purpose: Serializable editor state including geometry templates and morph scalar.
- Examples: `src/lib/types.ts`, `src/lib/state/composition.ts`
- Pattern: Ring-level immutable replacement updates (array map/filter/splice) to trigger reactive redraw.

**Animation controller:**
- Purpose: Centralized play/pause/reconfigure logic for morph sweeps across eligible rings.
- Examples: `src/lib/state/animation.svelte.ts`, `src/lib/components/AnimationSection.svelte`
- Pattern: Controller owns timeline and eligibility (`animatedIndices`), but delegates actual ring value writes to composition actions.

**Render pipeline:**
- Purpose: Deterministic conversion from composition data to Paper.js scene with warnings and metrics.
- Examples: `src/lib/geometry/render-pipeline.ts`
- Pattern: Validate input -> clear scope -> ring loop with morph interpolation -> fit and update view.

## Entry Points

**App shell:**
- Location: `src/routes/+layout.svelte`, `src/routes/+layout.ts`
- Triggers: Initial app load.
- Responsibilities: Global styles/head and route composition.

**Editor route:**
- Location: `src/routes/+page.svelte`
- Triggers: Navigation to `/`.
- Responsibilities: Mount sidebar controls and preview canvas.

## Error Handling

**Strategy:** Reject invalid morph path updates at state boundaries; stop/cleanup animation when composition changes invalidate targets; degrade gracefully during render with warnings.

**Patterns:**
- `updateRingPathVariant` returns explicit failure reasons without mutating invalid input (`src/lib/state/composition.ts`).
- `handleCompositionChanged` halts running animations if ring count or morph-capable indices drift (`src/lib/state/animation.svelte.ts`).
- Render loop catches ring-level failures and records them in `warnings` while continuing other rings (`src/lib/geometry/render-pipeline.ts`).

## Cross-Cutting Concerns

**Logging:** Render-time issues accumulate in `RenderResult.warnings` (`src/lib/geometry/render-pipeline.ts`).

**Validation:** Path compatibility is enforced in both mutation (`src/lib/state/composition.ts`) and interpolation (`src/lib/geometry/render-pipeline.ts`).

**Authentication:** Not applicable.

---

*Architecture analysis: 2026-04-27*
