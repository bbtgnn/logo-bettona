# Codebase Structure

**Analysis Date:** 2026-04-24

## Directory Layout

```text
logo-bettona/
├── src/                     # SvelteKit app source (routes, components, domain logic)
├── static/                  # Static public assets served as-is
├── .cursor/                 # Project-local GSD workflows, skills, and agent metadata
├── .github/workflows/       # CI/CD workflow definitions
├── .planning/codebase/      # Generated codebase mapping documents
├── package.json             # Scripts, dependencies, and toolchain entrypoint
├── svelte.config.js         # SvelteKit + adapter configuration
├── vite.config.ts           # Vite and Vitest projects configuration
├── playwright.config.ts     # Playwright e2e test configuration
└── tsconfig.json            # TypeScript compiler constraints
```

## Directory Purposes

**`src/routes`:**
- Purpose: Defines navigable pages and app shell.
- Contains: `+layout.svelte`, `+layout.ts`, `+page.svelte`, plus route folders under `demo/` and `experiments/`.
- Key files: `src/routes/+page.svelte`, `src/routes/+layout.ts`, `src/routes/demo/playwright/+page.svelte`.

**`src/lib/components`:**
- Purpose: Houses feature-level UI components for editing and previewing compositions.
- Contains: Sidebar, editors, canvas renderers, and reusable section components.
- Key files: `src/lib/components/Sidebar.svelte`, `src/lib/components/RingEditor.svelte`, `src/lib/components/PreviewCanvas.svelte`, `src/lib/components/RingCanvas.svelte`.

**`src/lib/state`:**
- Purpose: Centralized client state, mutations, and persistence bindings.
- Contains: `composition` state and action functions.
- Key files: `src/lib/state/composition.ts`.

**`src/lib/geometry`:**
- Purpose: Geometry transforms, rendering pipeline, and SVG import conversion.
- Contains: Pure TS modules with Paper.js integration and related tests.
- Key files: `src/lib/geometry/bend.ts`, `src/lib/geometry/compose.ts`, `src/lib/geometry/svg-import.ts`.

**`src/lib/shadcn`:**
- Purpose: UI primitive wrappers and utility modules used by feature components.
- Contains: component folders with Svelte primitives and `index.ts` barrel exports.
- Key files: `src/lib/shadcn/ui/sidebar/index.ts`, `src/lib/shadcn/ui/button/index.ts`, `src/lib/shadcn/utils.ts`.

## Key File Locations

**Entry Points:**
- `src/routes/+layout.svelte`: Global app layout and shared head/body setup.
- `src/routes/+layout.ts`: Runtime mode flags (`prerender`, `ssr`).
- `src/routes/+page.svelte`: Root editor page composition.

**Configuration:**
- `package.json`: npm scripts and dependency graph.
- `svelte.config.js`: Static adapter and Svelte compiler options (runes policy).
- `vite.config.ts`: Vite plugins and split Vitest projects.
- `playwright.config.ts`: Browser e2e test runner configuration.
- `eslint.config.js`: Linting configuration for JS/TS/Svelte.

**Core Logic:**
- `src/lib/state/composition.ts`: Domain state and mutation API.
- `src/lib/color/apply.ts`: Color assignment logic for modes/palettes.
- `src/lib/geometry/bend.ts`: Ring deformation/path construction logic.
- `src/lib/geometry/compose.ts`: Final draw ordering and view fitting.
- `src/lib/geometry/svg-import.ts`: SVG-to-domain-path ingestion.

**Testing:**
- `src/lib/geometry/*.svelte.spec.ts`: Geometry and import behavior tests.
- `src/lib/vitest-examples/*.spec.ts`: Minimal Vitest sample tests.
- `src/routes/demo/playwright/page.svelte.e2e.ts`: Playwright e2e smoke test.

## Naming Conventions

**Files:**
- Svelte route files follow SvelteKit naming (`+layout.svelte`, `+page.svelte`) in `src/routes/`.
- Feature components use PascalCase (`src/lib/components/PreviewCanvas.svelte`, `src/lib/components/SettingsSection.svelte`).
- Domain/util modules use kebab-case or lowercase words (`src/lib/geometry/svg-import.ts`, `src/lib/color/apply.ts`).

**Directories:**
- Feature/domain grouping by concern (`src/lib/components`, `src/lib/state`, `src/lib/geometry`, `src/lib/color`).
- UI primitive directories are namespaced under `src/lib/shadcn/ui/<component>/`.

## Where to Add New Code

**New Feature:**
- Primary code: add feature UI in `src/lib/components/` and state mutations in `src/lib/state/composition.ts` (or sibling state module when scope grows).
- Tests: place unit/component tests under `src/lib/<feature>/` as `*.spec.ts` or `*.svelte.spec.ts`; place browser-flow tests under `src/routes/**/` as `*.e2e.ts`.

**New Component/Module:**
- Implementation: put editor-facing components in `src/lib/components/`; if primitive-level and reusable, add in `src/lib/shadcn/ui/<name>/` with an `index.ts` export file.

**Utilities:**
- Shared helpers: geometry helpers in `src/lib/geometry/`, color helpers in `src/lib/color/`, generic app exports in `src/lib/index.ts`.

## Special Directories

**`src/lib/vitest-examples`:**
- Purpose: Demonstrates baseline Vitest patterns for TS and Svelte component tests.
- Generated: No.
- Committed: Yes.

**`src/routes/demo` and `src/routes/experiments`:**
- Purpose: Lightweight playground/demonstration routes for e2e checks and Paper.js experiments.
- Generated: No.
- Committed: Yes.

**`.cursor/get-shit-done` and `.cursor/skills`:**
- Purpose: Workflow automation, templates, and command skills used by GSD tooling.
- Generated: No.
- Committed: Yes.

---

*Structure analysis: 2026-04-24*
