# Coding Conventions

**Analysis Date:** 2026-04-24

## Naming Patterns

**Files:**
- Use kebab-case for TS modules and Svelte components, e.g. `src/lib/color/apply.ts`, `src/lib/geometry/svg-import.ts`, `src/lib/components/FullPaletteEditor.svelte`.
- Use SvelteKit route naming (`+page.svelte`, `+layout.ts`), e.g. `src/routes/+page.svelte`, `src/routes/+layout.ts`.
- Keep tests co-located with implementation and suffix with `.spec.ts` or `.e2e.ts`, e.g. `src/lib/color/apply.spec.ts`, `src/routes/demo/playwright/page.svelte.e2e.ts`.

**Functions:**
- Use camelCase for exported and local functions, e.g. `applyColors`, `buildRingPath`, `setColorMode`, `handleDragStart`.
- Use verb-led names for state mutators in `src/lib/state/composition.ts`, e.g. `addRing`, `removeRing`, `reorderRings`.

**Variables:**
- Use camelCase for variables and constants (`dragFromIndex`, `gitignorePath`, `DEFAULT_COMPOSITION`, `HEX_RE`).
- Use SCREAMING_SNAKE_CASE for module constants representing defaults/regexes, e.g. `DEFAULT_RING`, `HEX_RE`.

**Types:**
- Define shared domain types in `src/lib/types.ts` with PascalCase names (`Path`, `Ring`, `Composition`, `ColorModeState`).
- Use `type` aliases consistently rather than `interface` in this codebase section.

## Code Style

**Formatting:**
- Tool: Prettier via `package.json` scripts (`lint`, `format`).
- Required settings from `.prettierrc`: tabs (`useTabs: true`), single quotes, no trailing commas, `printWidth: 100`.
- Apply Svelte and Tailwind-aware formatting with `prettier-plugin-svelte` and `prettier-plugin-tailwindcss`.

**Linting:**
- Tool: ESLint flat config in `eslint.config.js`.
- Base configs: `@eslint/js`, `typescript-eslint`, `eslint-plugin-svelte`, and `eslint-config-prettier`.
- Disable `no-undef` for TypeScript projects as configured in `eslint.config.js`.
- Avoid `any`; current exceptions are explicitly annotated in `src/lib/shadcn/utils.ts`.

## Import Organization

**Order:**
1. External dependencies first (`paper`, `phosphor-svelte`, `vitest`).
2. Internal alias imports second using `$lib` (for example in `src/lib/components/Sidebar.svelte` and `src/lib/state/composition.ts`).
3. Relative imports last (`./apply`, `./greet`, `./RingEditor.svelte`).

**Path Aliases:**
- Use `$lib` as the primary alias for application modules (`src/lib/...`) as seen across `src/routes/+page.svelte` and `src/lib/geometry/bend.ts`.
- Prefer explicit file extensions in some Svelte/UI imports where generated patterns require them, e.g. `$lib/shadcn/ui/button/index.js`.

## Error Handling

**Patterns:**
- Favor guard clauses and safe defaults over throwing in pure modules:
  - `src/lib/color/apply.ts` returns fallback palettes/arrays for invalid or empty input.
  - `src/lib/geometry/bend.ts` returns `null` for invalid geometry inputs.
- Use optional chaining and null-aware control flow in component/event code (`e.dataTransfer?.setData(...)` in `src/lib/components/Sidebar.svelte`).

## Logging

**Framework:** no app-level logging framework detected.

**Patterns:**
- Runtime logging calls are not present in inspected source files.
- Prefer deterministic return values and explicit state updates over console-based debugging.

## Comments

**When to Comment:**
- Add focused comments around mathematically complex transforms and rendering rules, e.g. the transformation strategy in `src/lib/geometry/bend.ts`.
- Keep comments concise and explanatory; avoid redundant line-by-line comments.

**JSDoc/TSDoc:**
- JSDoc-style block comments are used selectively for complex functions (`buildRingPath`, `transformHandle` in `src/lib/geometry/bend.ts`).
- Most straightforward state/UI functions rely on self-descriptive naming instead of doc blocks.

## Function Design

**Size:** function size varies by domain.
- Keep state and UI handlers short (`src/lib/state/composition.ts`, `src/lib/components/FullPaletteEditor.svelte`).
- Allow larger pure transformation functions where algorithmic complexity requires it (`src/lib/geometry/bend.ts`).

**Parameters:**
- Use typed parameters and `Partial<T>` patches for update operations (`updateRing`, `updateMonochromePalette`, `updateFullPalette` in `src/lib/state/composition.ts`).
- Use union types for mode switches (`ColorMode` in `src/lib/types.ts` and `applyColors`).

**Return Values:**
- Pure helper modules return explicit arrays/nullable objects without side effects (`src/lib/color/apply.ts`, `src/lib/geometry/bend.ts`).
- State modules mutate reactive/localstorage-backed stores in place via exported commands (`src/lib/state/composition.ts`).

## Module Design

**Exports:**
- Export named functions and type aliases from feature modules; default exports are uncommon outside framework config files.
- Centralize reusable types in `src/lib/types.ts` and utility composition in `src/lib/shadcn/utils.ts`.

**Barrel Files:**
- Barrel files are used for UI primitives under `src/lib/shadcn/ui/*/index.ts` and for library exports in `src/lib/index.ts`.
- Add new reusable UI module exports to the relevant local `index.ts` barrel to match existing access patterns.

---

*Convention analysis: 2026-04-24*
