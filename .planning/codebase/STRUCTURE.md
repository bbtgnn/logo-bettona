# Codebase Structure

**Analysis Date:** 2026-04-26

## Directory Layout

```
logo-bettona/
├── src/
│   ├── app.d.ts              # SvelteKit ambient types
│   ├── lib/
│   │   ├── assets/           # Static assets (e.g. favicon)
│   │   ├── color/            # Palette application (`apply.ts`)
│   │   ├── components/     # App UI: sidebar, editors, preview canvas
│   │   ├── geometry/       # bend, path-morph, render-pipeline, svg-import
│   │   ├── shadcn/         # Generated/adapted UI primitives
│   │   ├── state/          # composition + rune-sync persistence
│   │   ├── types.ts        # Path, Ring, Composition, palette types
│   │   ├── index.ts        # Public lib exports (if any)
│   │   └── vitest-examples/# Sample tests (non-feature)
│   └── routes/
│       ├── +layout.svelte   # Root layout, CSS
│       ├── +layout.ts       # Layout load (minimal)
│       ├── +page.svelte     # Main shape editor page
│       ├── demo/            # Demo / Playwright routes
│       └── experiments/     # Experimental pages
├── static/                  # SvelteKit static files
├── playwright.config.ts
├── vite.config.ts
├── package.json
└── tsconfig.json
```

## Directory Purposes

**`src/routes/`:**
- Purpose: SvelteKit pages and layouts.
- Contains: `+page.svelte` (editor shell), optional demos under `demo/`, `experiments/`.
- Key files: `src/routes/+page.svelte`, `src/routes/+layout.svelte`

**`src/lib/components/`:**
- Purpose: Feature-level Svelte components (not generic design system).
- Contains: Ring list/editor, preview canvas, color/settings sections, sidebar wrapper.
- Key files: `src/lib/components/Sidebar.svelte`, `src/lib/components/RingEditor.svelte`, `src/lib/components/RingCanvas.svelte`, `src/lib/components/PreviewCanvas.svelte`

**`src/lib/state/`:**
- Purpose: Persistent reactive state and mutations.
- Contains: Composition defaults, ring morph helpers, palette CRUD.
- Key files: `src/lib/state/composition.ts`

**`src/lib/geometry/`:**
- Purpose: Pure and Paper-bound geometry: bending template paths into rings, morphing, rendering, SVG import.
- Contains: `bend.ts`, `path-morph.ts`, `render-pipeline.ts`, `svg-import.ts`, co-located `*.svelte.spec.ts` tests.
- Key files: `src/lib/geometry/render-pipeline.ts`, `src/lib/geometry/path-morph.ts`, `src/lib/geometry/bend.ts`

**`src/lib/types.ts`:**
- Purpose: Shared TypeScript types for paths, rings, composition, color modes.
- Contains: `Ring.secondaryTemplatePath`, `Ring.morphT` alongside `templatePath`.

**`src/lib/shadcn/`:**
- Purpose: UI primitives (sidebar, slider, button, sheet, etc.).
- Contains: Svelte components + small `index.ts` barrels per widget.

**`src/lib/color/`:**
- Purpose: Applying monochrome / full palette / manual colors to rings.

## Key File Locations

**Entry Points:**
- `src/routes/+page.svelte`: Main UI — sidebar inset + `PreviewCanvas`.
- `src/routes/+layout.svelte`: Global styles and document head.

**Configuration:**
- `vite.config.ts`: Vite + SvelteKit plugin.
- `playwright.config.ts`: E2E.
- `package.json`: Scripts and dependencies (`paper`, `rune-sync`, Svelte 5).

**Core Logic:**
- `src/lib/types.ts`: `Path`, `Ring` (primary + secondary template + `morphT`), `Composition`.
- `src/lib/state/composition.ts`: LocalStorage-backed `composition`; morph lifecycle (`createRingMorphTarget`, `removeRingMorphTarget`, `setRingMorphT`, `updateRingPathVariant`).
- `src/lib/geometry/path-morph.ts`: `validatePathCompatibility`, `interpolatePath` (linear coordinate blend).
- `src/lib/geometry/render-pipeline.ts`: Per-ring morph then `buildRingPath`, fit, export path for preview.
- `src/lib/geometry/bend.ts`: `buildRingPath` — polar mapping from template bbox to ring tiles.

**Canvas preview:**
- `src/lib/components/PreviewCanvas.svelte`: Main 600×600 canvas; `$effect` drives `createRenderPipeline().render({ composition, scope, viewport })` so **morph interpolation is visible here** whenever `morphT` or either template path changes.

**Testing:**
- `src/lib/geometry/*.svelte.spec.ts`, `src/lib/state/composition.svelte.spec.ts`, `src/lib/components/PreviewCanvas.svelte.spec.ts`: Vitest browser/component tests co-located with modules.

## Naming Conventions

**Files:**
- Svelte components: `PascalCase.svelte` (e.g. `RingEditor.svelte`, `PreviewCanvas.svelte`).
- TS modules: `kebab-case.ts` in geometry (`render-pipeline.ts`, `path-morph.ts`) or short domain names (`bend.ts`, `composition.ts`).
- Specs: `*.svelte.spec.ts` next to implementation.

**Directories:**
- `src/lib/` grouping by concern: `components/`, `geometry/`, `state/`, `shadcn/`, `color/`.

## Where to Add New Code

**New Feature:**
- Primary UI: `src/lib/components/`; wire from `Sidebar.svelte` or `+page.svelte` as appropriate.
- Shared logic: `src/lib/geometry/` or `src/lib/state/` depending on whether it is rendering/math vs persisted state.

**New persisted field on rings:**
- Extend `Ring` in `src/lib/types.ts`.
- Default and migrations in `src/lib/state/composition.ts` (`DEFAULT_RING`, any load normalization if added later).
- If it affects drawing, update `src/lib/geometry/render-pipeline.ts` and/or `src/lib/geometry/bend.ts`.
- If user-editable, extend `RingEditor.svelte` (or a child component).

**Morph-related changes:**
- Interpolation math: `src/lib/geometry/path-morph.ts`.
- When to blend vs fallback: `src/lib/geometry/render-pipeline.ts` loop over `composition.rings`.
- Edit rules and persistence: `src/lib/state/composition.ts` (`updateRingPathVariant`, morph target helpers).

**Utilities:**
- Small color helpers: `src/lib/color/apply.ts`.
- Generic UI: prefer `src/lib/shadcn/` patterns before ad-hoc CSS.

## Special Directories

**`.planning/`:**
- Purpose: GSD planning artifacts and codebase maps (this file).
- Generated: No (maintained by workflow).
- Committed: Typically yes for team visibility.

**`src/lib/shadcn/`:**
- Purpose: vendored or generated UI kit; treat as low-churn unless upgrading components.

---

*Structure analysis: 2026-04-26*
