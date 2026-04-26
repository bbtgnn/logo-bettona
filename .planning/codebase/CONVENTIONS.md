# Coding Conventions

**Analysis Date:** 2026-04-26

## Naming Patterns

**Files:**

- Svelte components: PascalCase — `RingEditor.svelte`, `PreviewCanvas.svelte`, `RingCanvas.svelte` under `src/lib/components/`.
- Library modules: kebab-case TypeScript — `path-morph.ts`, `render-pipeline.ts`, `svg-import.ts` under `src/lib/geometry/` and siblings.
- State modules: single logical name — `composition.ts` in `src/lib/state/`.
- Vitest: co-located tests next to implementation; see `TESTING.md` for the `*.svelte.spec.ts` vs `*.spec.ts` split enforced by `vite.config.ts`.

**Functions:**

- Verb-led exported functions for mutations and actions — `addRing`, `updateRingPathVariant`, `createRingMorphTarget`, `setRingMorphT`, `interpolatePath`, `validatePathCompatibility`, `createRenderPipeline`.
- Small helpers use descriptive names — `clamp01` in `src/lib/state/composition.ts`.

**Variables:**

- `camelCase` for locals and bindings; Svelte 5 runes use `$state` / `$props` identifiers in lower camelCase (`editVariant`, `ringPathError`, `importScope`).

**Types:**

- Domain types live in `src/lib/types.ts` — `Path`, `Ring`, `Composition`, `ColorModeState`, etc.
- String-literal unions for modes — `'primary' | 'secondary'`, `'monochrome' | 'palette' | 'manual'`.
- Discriminated results for fallible updates — `UpdateRingPathVariantResult` in `src/lib/state/composition.ts` is `{ ok: true } | { ok: false; reason: string }`, aligned with `validatePathCompatibility` return shape from `src/lib/geometry/path-morph.ts`.

## Code Style

**Formatting:**

- Prettier drives formatting; config in `.prettierrc`.
- **Tabs** for indentation (`"useTabs": true`).
- **Single quotes** for strings; **no trailing commas** (`"trailingComma": "none"`).
- **Print width** 100.
- Plugins: `prettier-plugin-svelte`, `prettier-plugin-tailwindcss` with `"tailwindStylesheet": "./src/routes/layout.css"`.
- Svelte files use the `svelte` parser via Prettier `overrides` in `.prettierrc`.

**Linting:**

- Flat config in `eslint.config.js`: `@eslint/js` recommended, `typescript-eslint` recommended, `eslint-plugin-svelte` recommended, `eslint-config-prettier` + `svelte.configs.prettier` to avoid style conflicts with Prettier.
- `no-undef` is **off** (TypeScript owns undefined-symbol checking).
- Svelte/TS files use `projectService: true` and `svelteConfig` from `./svelte.config.js` for typed linting of `**/*.svelte`, `**/*.svelte.ts`, `**/*.svelte.js`.
- Project scripts: `npm run lint` runs `prettier --check .` then `eslint .`; `npm run format` runs `prettier --write .`.

## Import Organization

**Order (observed in `src/lib/components/RingEditor.svelte` and similar):**

1. Default or namespace third-party — e.g. `import paper from 'paper'`.
2. Internal UI primitives — `$lib/shadcn/ui/...`.
3. Icon packages — `phosphor-svelte`.
4. App state and geometry — `$lib/state/composition`, `$lib/geometry/svg-import`.
5. Relative sibling components — `./RingCanvas.svelte`.
6. Type-only imports last among groups — `import type { Ring } from '$lib/types'`.

**Path Aliases:**

- Use `$lib/...` for everything under `src/lib/` (SvelteKit convention); do not deep-relative-cross into `src` from unrelated trees when `$lib` is clearer.

## Error Handling

**Patterns:**

- **Result objects** for user-actionable failures without exceptions — `updateRingPathVariant` in `src/lib/state/composition.ts` returns `{ ok: false; reason: string }` and does not mutate rings when validation fails (see tests in `src/lib/state/composition.svelte.spec.ts`).
- **Typed errors** for invalid interpolation — `PathMorphError` from `src/lib/geometry/path-morph.ts` thrown by `interpolatePath` when paths are incompatible; `validatePathCompatibility` returns `{ ok: false, reason: string }` for the same rule set.
- **UI surfacing** — `RingEditor.svelte` sets `ringPathError` from `result.reason` when `updateRingPathVariant` fails; `importError` for SVG import failures from `importSvg`.

## Logging

**Framework:** No dedicated logging library detected; errors are user-facing strings in UI state.

**Patterns:**

- Prefer returning structured reasons over `console` for domain validation paths consumed by components.

## Comments

**When to Comment:**

- JSDoc on non-obvious public APIs — e.g. `updateRingPathVariant` documents primary vs secondary rules and non-mutation on rejection in `src/lib/state/composition.ts`.
- Inline comments where behavior is non-obvious — e.g. dedicated `PaperScope` for SVG import vs display scope in `RingEditor.svelte`.

**JSDoc/TSDoc:**

- Use on exported functions that encode business rules (`updateRingPathVariant`). Omit on trivial one-liners unless the type system is insufficient.

## Function Design

**Size:** Prefer focused functions; large UI stays in `.svelte` with extracted behavior in `$lib` modules (`path-morph`, `render-pipeline`, `composition`).

**Parameters:**

- Pass indices and patches explicitly (`updateRing(index, patch)`); use literal variant parameters (`'primary' | 'secondary'`) where the call site is discrete.

**Return Values:**

- Use discriminated unions for success/failure at module boundaries; keep `void` for pure UI event handlers that only mutate local `$state` or call stores.

## Module Design

**Exports:**

- Named exports for state and geometry (`composition`, `createRingMorphTarget`, `interpolatePath`).
- Svelte components default-exported implicitly by file.

**Barrel Files:**

- shadcn-style barrels under `src/lib/shadcn/ui/<component>/index.js` — import from those index files in components (`RingEditor.svelte` uses `$lib/shadcn/ui/collapsible/index.js`, etc.).

## Svelte 5 and UI Patterns

**Runes (project default):** `svelte.config.js` enables `runes: true` for all app files outside `node_modules`. Components use `$props()`, `$state()`, and `$effect()`.

**`RingEditor.svelte` patterns (morph-related):**

- Props: destructure `ring`, `index`, optional drag handlers from `$props()` with an explicit inline type for the props object.
- Sync collapsible open state from shared UI state with `$effect(() => { open = isRingExpanded(index); })`.
- When `secondaryTemplatePath` is removed, `$effect` resets `editVariant` to `'primary'` if it was `'secondary'`.
- **Primary vs secondary editing:** `editVariant` toggles UI; `{#key editVariant}` remounts `RingCanvas` when switching so the editor binds to the correct path.
- **Morph target lifecycle:** `createRingMorphTarget` / `removeRingMorphTarget` from `src/lib/state/composition.ts`; slider uses `setRingMorphT(index, v)` with `bits-ui` `Slider` `value` / `onValueChange`.
- **Path updates:** Always route path changes through `updateRingPathVariant(index, editVariant, path)` and branch on `result.ok`; clear `ringPathError` before attempts.

---

*Convention analysis: 2026-04-26*
