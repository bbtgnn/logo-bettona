# Coding Conventions

**Analysis Date:** 2026-04-27

## Naming Patterns

**Files:**

- Svelte components use PascalCase in `src/lib/components/` (`RingEditor.svelte`, `PreviewCanvas.svelte`, `AnimationSection.svelte`).
- Domain/state modules use lower-case kebab or single-topic names in `src/lib/state/` and `src/lib/geometry/` (`composition.ts`, `animation.svelte.ts`, `render-pipeline.ts`, `path-morph.ts`).
- State re-export modules use plain passthrough names (`src/lib/state/animation.ts` re-exports `./animation.svelte`).
- Tests are co-located with implementations and follow `*.spec.ts` or `*.svelte.spec.ts` suffixes per `vite.config.ts`.

**Functions:**

- Exported actions use verb-first names (`togglePlay`, `setAnimationDurationSec`, `handleCompositionChanged`, `updateRingPathVariant`, `createRingMorphTarget`).
- Internal helpers stay short and explicit (`clamp01`, `getMorphRingIndices`, `haveSameIndices` in `src/lib/state/animation.svelte.ts`).

**Variables:**

- `camelCase` for locals and state (`progressPercent`, `currentAnimation`, `animatedIndices`, `lastRingCount`).
- Svelte rune state objects use `$state(...)` with mutable properties (`animationState.progress`, `animationState.isPlaying`).

**Types:**

- Domain types are centralized in `src/lib/types.ts` (`Path`, `Ring`, `Composition`, `ColorModeState`).
- Literal union types encode mode/state domains (`AnimationMode = 'morphSweep'`, path variant `'primary' | 'secondary'`).
- Discriminated result unions are preferred for recoverable validation (`{ ok: true } | { ok: false; reason: string }` in `src/lib/state/composition.ts`).

## Code Style

**Formatting:**

- Prettier config in `.prettierrc` is authoritative.
- Use tabs, single quotes, no trailing commas, and print width 100.
- Svelte files use the `svelte` parser override.
- Tailwind class ordering is normalized via `prettier-plugin-tailwindcss`.

**Linting:**

- Flat ESLint config in `eslint.config.js` composes `@eslint/js`, `typescript-eslint`, and `eslint-plugin-svelte` recommended sets plus Prettier compatibility.
- `no-undef` is disabled for TypeScript files.
- Typed linting for `**/*.svelte`, `**/*.svelte.ts`, `**/*.svelte.js` uses `projectService: true` and `svelteConfig`.
- Use `npm run lint` (`prettier --check . && eslint .`) and `npm run format` (`prettier --write .`).

## Import Organization

**Order:**
1. Third-party packages first (`animejs`, `paper`, `vitest`, `svelte`).
2. Internal alias imports (`$lib/...`) for state, geometry, UI primitives.
3. Relative sibling imports last (`./SidebarCollapsible.svelte`, `./animation.svelte`).
4. `import type` grouped with other imports but kept explicit.

**Path Aliases:**

- Prefer `$lib/...` for modules under `src/lib/` and avoid long relative traversals.

## Error Handling

**Patterns:**

- Use result objects for user-facing validation paths (`updateRingPathVariant` returns rejection reason instead of throwing).
- Throw typed errors for strict invariants in geometry (`PathMorphError`, `RenderPipelineError`).
- In animation control flow, handle third-party runtime failures defensively (`togglePlay` wraps `currentAnimation.play?.()` in `try/catch` and recreates animation).
- Surface recoverable errors in component state (`ringPathError`, `importError`) instead of console-only handling.

## Logging

**Framework:** No dedicated logging framework detected.

**Patterns:**

- Prefer deterministic state transitions and returned reasons over runtime logging.
- Warnings for render fallback paths are emitted inside geometry rendering (`src/lib/geometry/render-pipeline.ts`) and asserted in tests.

## Comments

**When to Comment:**

- Add comments only for non-obvious cross-library behavior (example: stale anime timer recovery in `src/lib/state/animation.svelte.ts`).
- Keep behavior contracts in JSDoc on exported APIs with business constraints (`updateRingPathVariant` in `src/lib/state/composition.ts`).

**JSDoc/TSDoc:**

- Use on exported state/action APIs where mutation guarantees or compatibility constraints are not obvious from signatures.

## Function Design

**Size:** Keep UI orchestration inside `.svelte` components and move reusable behavior into focused `$lib/state` and `$lib/geometry` modules.

**Parameters:**

- Pass ring index and explicit variant/mode literals (`setRingMorphT(index, t)`, `updateRingPathVariant(index, variant, path)`).
- Clamp/sanitize user numeric input at state boundaries (`setAnimationDurationSec`, `setRingMorphT`, animation `clamp01`).

**Return Values:**

- Use `void` for direct state mutation handlers (`togglePlay`, `setAnimationLoop`).
- Use typed result unions for operations that can fail without throwing.

## Module Design

**Exports:**

- State modules expose named bindings and action functions (`animationState`, `togglePlay`, `stopAnimation`).
- Components remain single-file default exports.

**Barrel Files:**

- shadcn/ui components are imported through barrel `index.js` modules (`$lib/shadcn/ui/button/index.js`, `$lib/shadcn/ui/input/index.js`).
- Thin re-export modules (`src/lib/state/animation.ts`) provide stable import paths to `.svelte.ts` logic.

## Svelte 5 and Animation Patterns

**Runes baseline:** `svelte.config.js` enables `runes: true`; components use `$props`, `$state`, `$effect`, `$derived`, and `untrack`.

**Animation state conventions (`src/lib/state/animation.svelte.ts`):**

- Keep a single mutable state object (`animationState`) as source of truth for play/pause/progress.
- Track external engine handles (`currentAnimation`) in module scope and centralize teardown in helper functions (`cleanupCurrentAnimation`, `stopInternal`).
- Derive animated ring targets from composition (`getMorphRingIndices`) and revalidate on composition changes (`handleCompositionChanged`).
- Reconfigure active animations when options mutate (`setAnimationLoop`, `setAnimationAlternate`, `setAnimationDurationSec`).

**Animation UI conventions (`src/lib/components/AnimationSection.svelte`):**

- Bind controls directly to state actions via event handlers (`oninput`, `onchange`, `onclick`).
- Derive display values from store state (`progressPercent`) and clamp to `[0, 100]`.
- Use `$effect` + `untrack(handleCompositionChanged)` to perform safety checks on ring list changes without creating nested reactive dependencies.

---

*Convention analysis: 2026-04-27*
