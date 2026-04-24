# Coding Conventions

**Analysis Date:** 2026-04-24

## Naming Patterns

**Files:**
- Use `kebab-case` for regular TypeScript modules and Svelte components (examples: `src/lib/color/apply.ts`, `src/lib/geometry/render-pipeline.ts`, `src/lib/components/PreviewCanvas.svelte`).
- Use suffix-based intent names for tests (`*.spec.ts` for Vitest, `*.e2e.ts` for Playwright) such as `src/lib/geometry/svg-import.svelte.spec.ts` and `src/routes/demo/playwright/page.svelte.e2e.ts`.
- Use Svelte library patterns with extension-aware module exports (`index.ts` that re-exports from `.svelte`), as in `src/lib/shadcn/ui/button/index.ts`.

**Functions:**
- Use `camelCase` for functions and methods (`parseHexColors`, `createRenderPipeline`, `setColorMode`, `renderComposition`).
- Use verb-first names for mutating state (`addRing`, `removeRing`, `updateRing`, `setActivePalette`) in `src/lib/state/composition.ts`.
- Use `PascalCase` for error classes and exported types (`RenderPipelineError`, `RenderInput`) in `src/lib/geometry/render-pipeline.ts`.

**Variables:**
- Use `UPPER_SNAKE_CASE` for constants (`HEX_RE`, `DEFAULT_COMPOSITION`, `DEFAULT_RING`).
- Use descriptive local names that reflect role in pipeline/state logic (`warnings`, `renderedCount`, `skippedCount`, `monoPalette`).

**Types:**
- Centralize domain types in `src/lib/types.ts` and import as type-only where possible.
- Prefer narrow union types for finite values (`ColorMode = 'monochrome' | 'palette' | 'manual'`).

## Code Style

**Formatting:**
- Tool used: Prettier (`.prettierrc`).
- Key settings: tabs enabled, single quotes, no trailing commas, print width 100, Svelte parser override for `*.svelte`, Tailwind class sorting via `prettier-plugin-tailwindcss`.

**Linting:**
- Tool used: ESLint flat config (`eslint.config.js`) with `@eslint/js`, `typescript-eslint`, `eslint-plugin-svelte`, and `eslint-config-prettier`.
- Key rules: `no-undef` is disabled for TypeScript projects; Svelte files (`*.svelte`, `*.svelte.ts`, `*.svelte.js`) are linted with parser options tied to `svelte.config.js`.

## Import Organization

**Order:**
1. External packages first (`paper`, `vitest`, `rune-sync/localstorage`).
2. Internal aliases next (`$lib/...`, `$app/...`).
3. Local relative imports last (`./render-pipeline`, `./apply`).

**Path Aliases:**
- Use `$lib/*` for application/library modules (`src/lib/components/PreviewCanvas.svelte`, `src/lib/state/composition.ts`).
- Use `$app/*` for SvelteKit runtime helpers (`src/routes/demo/+page.svelte`).

## Error Handling

**Patterns:**
- Validate inputs at module boundaries and throw typed domain errors (`RenderPipelineError`) in `src/lib/geometry/render-pipeline.ts`.
- Wrap unknown exceptions with contextual messages (`toPipelineError`) before propagating.
- Return safe fallbacks for user input parsing and empty-state conditions (`parseHexColors`, `applyColors` in `src/lib/color/apply.ts`).
- Prefer early returns for guard clauses in UI and state mutation paths (`if (!scope) return;`, `if (ringCount === 0) return []`).

## Logging

**Framework:** None (no logging framework detected, minimal/no `console` logging in inspected app modules).

**Patterns:**
- Communicate recoverable runtime issues through returned warning collections (`warnings: string[]` in `RenderResult`) instead of logs.
- Prefer typed error flows and test assertions over ad-hoc runtime logging.

## Comments

**When to Comment:**
- Add concise comments only for non-obvious intent, compatibility behavior, or algorithm boundaries.
- Keep comments near the logic they clarify (examples in `src/lib/geometry/compose.ts` and `src/lib/geometry/render-pipeline.ts`).

**JSDoc/TSDoc:**
- Lightweight JSDoc is used selectively for exported compatibility facades (`renderComposition`, `fitToView` in `src/lib/geometry/compose.ts`).
- Most modules rely on strong TypeScript signatures instead of heavy doc blocks.

## Function Design

**Size:** Small-to-medium pure utilities and larger orchestrator functions are both used; keep helpers focused and keep orchestration inside dedicated modules (`src/lib/geometry/render-pipeline.ts`).

**Parameters:** Prefer strongly typed object parameters for complex operations (`RenderInput`) and scalar parameters for simple transforms (`applyPalette`, `setRingIncrement`).

**Return Values:** Use explicit return types and stable result contracts (`RenderResult`, arrays of hex strings, typed domain objects).

## Module Design

**Exports:** Favor named exports for utilities and state operations (`src/lib/color/apply.ts`, `src/lib/state/composition.ts`), with targeted re-export barrels where component APIs need ergonomic access (`src/lib/shadcn/ui/button/index.ts`, `src/lib/index.ts`).

**Barrel Files:** Used in UI primitive directories and top-level `src/lib/index.ts`; keep barrels thin and avoid business logic inside them.

---

*Convention analysis: 2026-04-24*
