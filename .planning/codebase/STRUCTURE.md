# Codebase Structure

**Analysis Date:** 2026-04-27

## Directory Layout

```
logo-bettona/
├── src/
│   ├── app.d.ts                      # SvelteKit ambient types
│   ├── lib/
│   │   ├── assets/                   # Static assets
│   │   ├── color/                    # Palette application logic + tests
│   │   ├── components/               # Sidebar sections, ring editor, preview canvas
│   │   ├── geometry/                 # Path morph, bending, render pipeline, composition facade
│   │   ├── shadcn/                   # UI primitives
│   │   ├── state/                    # Composition persistence + animation controller
│   │   ├── types.ts                  # Core domain types
│   │   ├── index.ts                  # Public exports
│   │   └── vitest-examples/          # Example tests
│   └── routes/
│       ├── +layout.svelte            # Root layout
│       ├── +layout.ts                # Layout loader
│       ├── +page.svelte              # Main editor route
│       ├── demo/                     # Demo routes
│       └── experiments/              # Experimental routes
├── static/                           # Static files served by SvelteKit
├── package.json
├── vite.config.ts
├── playwright.config.ts
└── tsconfig.json
```

## Directory Purposes

**`src/routes/`:**
- Purpose: App entry routes and layout framing.
- Contains: root layout files and main editor page.
- Key files: `src/routes/+page.svelte`, `src/routes/+layout.svelte`

**`src/lib/components/`:**
- Purpose: Feature UI components for editing and preview.
- Contains: `Sidebar.svelte`, `SettingsSection.svelte`, `AnimationSection.svelte`, `ColorsSection.svelte`, `RingEditor.svelte`, `RingCanvas.svelte`, `PreviewCanvas.svelte`.
- Key files: `src/lib/components/Sidebar.svelte`, `src/lib/components/AnimationSection.svelte`, `src/lib/components/PreviewCanvas.svelte`

**`src/lib/state/`:**
- Purpose: Reactive app state and controller logic.
- Contains: persisted composition model and playback controller.
- Key files: `src/lib/state/composition.ts`, `src/lib/state/animation.svelte.ts`, `src/lib/state/animation.ts`

**`src/lib/geometry/`:**
- Purpose: Geometry transformations and render orchestration.
- Contains: `bend.ts`, `path-morph.ts`, `render-pipeline.ts`, `svg-import.ts`, `compose.ts`, plus co-located `*.svelte.spec.ts` tests.
- Key files: `src/lib/geometry/render-pipeline.ts`, `src/lib/geometry/path-morph.ts`, `src/lib/geometry/compose.ts`

## Key File Locations

**Entry Points:**
- `src/routes/+page.svelte`: Wires `Sidebar` and `PreviewCanvas` in the editor screen.
- `src/lib/components/Sidebar.svelte`: Defines section order and placement of animation controls.

**Configuration:**
- `package.json`: scripts/dependencies (`animejs`, `paper`, `rune-sync`, Svelte 5 tooling).
- `vite.config.ts`: build/dev config.
- `playwright.config.ts`: E2E settings.

**Core Logic:**
- `src/lib/state/composition.ts`: source of truth for ring data, morph target lifecycle, and path variant validation.
- `src/lib/state/animation.svelte.ts`: animation controller that maps timeline progress into `setRingMorphT` updates.
- `src/lib/geometry/render-pipeline.ts`: render-time interpolation (`interpolatePath`) and radial ring drawing (`buildRingPath`).
- `src/lib/types.ts`: shared model (`Composition`, `Ring`, `Path`).

**Animation Placement:**
- `src/lib/components/Sidebar.svelte`: mounts `AnimationSection` immediately after `SettingsSection` and before `ColorsSection`.
- `src/lib/components/AnimationSection.svelte`: playback controls, loop/alternate toggles, progress bar, and composition change safety hook.

**Testing:**
- `src/lib/state/animation.svelte.spec.ts`: controller behavior and stale-composition safety.
- `src/lib/components/AnimationSection.svelte.spec.ts`: UI wiring to animation controller actions.
- `src/lib/geometry/*.svelte.spec.ts` and `src/lib/state/composition.svelte.spec.ts`: geometry/state invariants.

## Naming Conventions

**Files:**
- UI components use `PascalCase.svelte` (for example `AnimationSection.svelte`).
- State and geometry modules use lowercase/kebab TypeScript filenames (for example `composition.ts`, `animation.svelte.ts`, `render-pipeline.ts`).
- Tests are co-located and use `*.svelte.spec.ts`.

**Directories:**
- Organize by concern under `src/lib/` (`components`, `state`, `geometry`, `color`, `shadcn`).

## Where to Add New Code

**New animation feature or control:**
- UI control surface: `src/lib/components/AnimationSection.svelte`.
- Playback/controller behavior: `src/lib/state/animation.svelte.ts`.
- Section placement changes: `src/lib/components/Sidebar.svelte`.

**New composition or ring morph field:**
- Type definition: `src/lib/types.ts`.
- Persistence/defaults/mutations: `src/lib/state/composition.ts`.
- Render behavior for field: `src/lib/geometry/render-pipeline.ts` or `src/lib/geometry/bend.ts`.

**New morph algorithm behavior:**
- Compatibility/interpolation rules: `src/lib/geometry/path-morph.ts`.
- Ring application order and fallback behavior: `src/lib/geometry/render-pipeline.ts`.

**Utilities and exports:**
- Public re-exports: `src/lib/index.ts`.
- Keep compatibility facades in `src/lib/geometry/compose.ts` only when needed for legacy call sites.

## Special Directories

**`.planning/`:**
- Purpose: planning artifacts and codebase map documents.
- Generated: No.
- Committed: Yes.

**`src/lib/shadcn/`:**
- Purpose: component primitives and helpers used by feature components.
- Generated: Partially (vendor-style UI layer).
- Committed: Yes.

---

*Structure analysis: 2026-04-27*
