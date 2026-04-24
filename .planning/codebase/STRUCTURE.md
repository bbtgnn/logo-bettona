# Codebase Structure

**Analysis Date:** 2026-04-24

## Directory Layout

```text
logo-bettona/
├── src/                    # Application source code (SvelteKit routes + shared lib)
│   ├── routes/             # Route entry points, layouts, and route-local experiments
│   └── lib/                # Reusable app modules (components, state, geometry, UI kit)
├── static/                 # Public static assets served as-is
├── docs/                   # Project notes/specs and planning artifacts outside runtime app
├── .cursor/                # Local workflow automation, skills, and agent definitions
├── .planning/              # Generated codebase/planning documents
├── package.json            # Scripts and dependency manifest
├── svelte.config.js        # SvelteKit and compiler configuration
├── vite.config.ts          # Vite + Vitest project configuration
└── tsconfig.json           # TypeScript compiler settings
```

## Directory Purposes

**`src/routes`:**
- Purpose: SvelteKit routing layer and page-level entry points.
- Contains: `+layout.ts`, `+layout.svelte`, `+page.svelte`, and feature/demo route trees.
- Key files: `src/routes/+page.svelte`, `src/routes/experiments/+page.svelte`, `src/routes/demo/playwright/+page.svelte`.

**`src/lib/components`:**
- Purpose: Feature-level UI components for the shape editor.
- Contains: Editable panels, canvas renderers, and composed sections.
- Key files: `src/lib/components/Sidebar.svelte`, `src/lib/components/RingEditor.svelte`, `src/lib/components/PreviewCanvas.svelte`.

**`src/lib/state`:**
- Purpose: Shared mutable application state and state mutation API.
- Contains: Composition state, palette state, UI expansion state.
- Key files: `src/lib/state/composition.ts`.

**`src/lib/geometry`:**
- Purpose: Geometry transformation, render orchestration, and SVG import adapters.
- Contains: Paper.js pipeline modules and parsing logic.
- Key files: `src/lib/geometry/render-pipeline.ts`, `src/lib/geometry/bend.ts`, `src/lib/geometry/svg-import.ts`.

**`src/lib/color`:**
- Purpose: Palette parsing and color application algorithms.
- Contains: Color-mode algorithms and helpers.
- Key files: `src/lib/color/apply.ts`.

**`src/lib/shadcn`:**
- Purpose: Design-system primitives and utility wrappers used by feature UI.
- Contains: UI primitives (`ui/*`), hooks, and utility helpers.
- Key files: `src/lib/shadcn/ui/sidebar/index.ts`, `src/lib/shadcn/ui/button/index.ts`, `src/lib/shadcn/utils.ts`.

**`src/lib/vitest-examples`:**
- Purpose: Example/demo test assets separate from core feature logic.
- Contains: Sample Svelte and TypeScript units with tests.
- Key files: `src/lib/vitest-examples/Welcome.svelte`, `src/lib/vitest-examples/greet.spec.ts`.

## Key File Locations

**Entry Points:**
- `src/app.html`: Base HTML document template for SvelteKit.
- `src/routes/+layout.ts`: Runtime mode flags (`prerender`, `ssr`) for route tree.
- `src/routes/+layout.svelte`: Global CSS and favicon wiring.
- `src/routes/+page.svelte`: Primary feature composition entry.

**Configuration:**
- `package.json`: Script entry points for dev/build/check/test.
- `svelte.config.js`: Static adapter + runes compiler behavior.
- `vite.config.ts`: Vite plugins and Vitest project matrix.
- `playwright.config.ts`: E2E runner setup and preview server command.
- `eslint.config.js`: Linting stack for JS/TS/Svelte.
- `components.json`: shadcn alias and style configuration.

**Core Logic:**
- `src/lib/state/composition.ts`: Domain state and mutation boundary.
- `src/lib/geometry/render-pipeline.ts`: Render lifecycle + validation.
- `src/lib/geometry/bend.ts`: Template-to-ring geometric transformation.
- `src/lib/geometry/svg-import.ts`: SVG path ingestion into internal path schema.
- `src/lib/types.ts`: Shared domain types across UI/state/geometry.

**Testing:**
- `src/lib/**/*.spec.ts`: Unit tests colocated with implementation modules.
- `src/routes/demo/playwright/page.svelte.e2e.ts`: E2E coverage for route behavior.
- `vite.config.ts`: Client/server test project split.

## Naming Conventions

**Files:**
- Svelte components use PascalCase names in feature/UI folders: `PreviewCanvas.svelte`, `RingEditor.svelte`.
- Logic modules use kebab-case names in domain folders: `render-pipeline.ts`, `svg-import.ts`.
- Tests use `*.spec.ts` for unit tests and `*.e2e.ts` for Playwright tests.
- Route files follow SvelteKit conventions: `+layout.svelte`, `+page.svelte`, `+layout.ts`.

**Directories:**
- Feature/domain grouping under `src/lib/` uses lowercase folder names: `components`, `state`, `geometry`, `color`.
- Nested design-system primitives are namespaced by component family: `src/lib/shadcn/ui/sidebar/`, `src/lib/shadcn/ui/sheet/`.

## Where to Add New Code

**New Feature:**
- Primary code: add feature components to `src/lib/components/` and route wiring in `src/routes/`.
- Tests: colocate `*.spec.ts` beside logic modules (for example under `src/lib/geometry/` or `src/lib/color/`), and add `*.e2e.ts` under relevant route subtree when behavior is page-level.

**New Component/Module:**
- Implementation: use `src/lib/components/` for UI components and `src/lib/{domain}/` for logic modules (for example `src/lib/geometry/` for render/math concerns).

**Utilities:**
- Shared helpers: add to closest domain folder (`src/lib/color/`, `src/lib/geometry/`, `src/lib/state/`).
- Cross-domain UI utilities: place in `src/lib/shadcn/utils.ts` or a focused sibling utility module under `src/lib/shadcn/`.

## Special Directories

**`.cursor/`:**
- Purpose: Agent workflows, skills, templates, and tooling metadata.
- Generated: Yes (tool-managed plus project-managed files).
- Committed: Yes.

**`.planning/`:**
- Purpose: Planning and mapping artifacts consumed by GSD workflows.
- Generated: Yes.
- Committed: Yes.

**`static/`:**
- Purpose: Public files served directly by the static adapter.
- Generated: No.
- Committed: Yes.

---

*Structure analysis: 2026-04-24*
