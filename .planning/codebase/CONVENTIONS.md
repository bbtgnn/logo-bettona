# Coding Conventions

**Analysis Date:** 2026-07-06

## Naming Patterns

**Files:**

- Svelte components use PascalCase in `src/lib/components/` (`RingEditor.svelte`, `SidebarNav.svelte`, `TimelinePanel.svelte`).
- Domain/state modules use lower-case kebab or single-topic names in `src/lib/state/` and `src/lib/geometry/` (`composition.ts`, `kaleidoscope.svelte.ts`, `render-pipeline.ts`, `path-morph.ts`).
- Rune-bearing modules carry the `.svelte.ts` suffix (`animation.svelte.ts`, `composition-persistence.svelte.ts`, `kaleidoscope.svelte.ts`, `export-status.svelte.ts`, `locale.svelte.ts`, `keyframes.svelte.ts`); plain `.ts` modules hold no runes.
- Facade/persistence pairs split one concern across two files: `state/composition-persistence.svelte.ts` owns the `$state` singleton + localStorage sync (`createPersistedComposition`), `state/composition.ts` re-exports it (`export { composition }`) and layers action functions on top. `state/animation.ts` similarly re-exports `./animation.svelte` for a stable import path.
- Tests are co-located with implementations. Node-runnable specs use `*.spec.ts`; specs that touch the DOM/browser APIs use `*.svelte.spec.ts` (routed to the browser Vitest project — see Tooling). E2E specs use `*.e2e.ts` (`path-manager.e2e.ts`, `workspace-nav.e2e.ts`).

**Functions:**

- Exported actions use verb-first names (`setKaleidoscopeEnabled`, `setSectors`, `reorderRings`, `updateRingPathVariant`, `createRingMorphTarget`, `setLayerEnabled`).
- Driver factories use `create<X>Driver` (`createAudioBarsDriver`, `createAudioZonesDriver`, `createDataSeriesDriver`) and the runtime constructor is `createAnimationRuntime`.
- Internal helpers stay short and explicit (`clamp01`, `normalizeRingCount` in `src/lib/state/animation-drivers/audio-bars-driver.ts`).

**Variables:**

- `camelCase` for locals and state (`ringCount`, `activeIndex`, `pathname`, `lastSavedStripped`).
- Svelte rune state objects use `$state(...)` with mutable properties, exported as a singleton binding rather than a class instance (`kaleidoscope.enabled`, `composition.rings`, `animationState.layers`).

**Types:**

- Domain types are centralized in `src/lib/types.ts` (`Path`, `Ring`, `Composition`, `ColorModeState`, `WaveState`, `ZoneDrive`).
- Literal union types encode mode/state domains (`AnimationLayer = 'audioBars' | 'audioZones' | 'dataSeries' | 'kaleidoscope'`, `LayerKind = 'driver' | 'gate' | 'inert'`, path variant `'primary' | 'secondary'`).
- Discriminated result unions are preferred for recoverable validation (`UpdateRingPathVariantResult = { ok: true } | { ok: false; reason: string }` in `src/lib/state/composition.ts`).
- Persisted-vs-runtime shapes are named explicitly (`PersistedRing = Omit<Ring, TransientRingField>`, `PersistedComposition` in `composition-persistence.svelte.ts`) rather than reusing the runtime type for storage.

## Code Style

**Formatting:**

- Prettier config in `.prettierrc` is authoritative: `useTabs: true`, `singleQuote: true`, `trailingComma: "none"`, `printWidth: 100`.
- Plugins: `prettier-plugin-svelte` (with a `*.svelte` → `svelte` parser override) and `prettier-plugin-tailwindcss` (normalizes Tailwind class order against `tailwindStylesheet: "./src/routes/layout.css"`).

**Linting:**

- Flat ESLint config in `eslint.config.js` composes `js.configs.recommended`, `ts.configs.recommended`, `svelte.configs.recommended`, `eslint-config-prettier`, and `svelte.configs.prettier`, plus `includeIgnoreFile(gitignorePath)` so `.gitignore` entries (including generated `src/lib/paraglide/`) are excluded from lint.
- `no-undef` is disabled for TypeScript files.
- `**/*.svelte`, `**/*.svelte.ts`, `**/*.svelte.js` get typed linting via `projectService: true` + `extraFileExtensions: ['.svelte']` + `svelteConfig` from `svelte.config.js`.
- Use `npm run lint` (`prettier --check . && eslint .`) and `npm run format` (`prettier --write .`) — scripts are invoked via `npm run`, though the package manager itself is bun (`bun.lock`; see Tooling notes elsewhere in this map for the inconsistency).

## Import Organization

**Order:**
1. Third-party packages first (`svelte`, `@sveltejs/kit`, `phosphor-svelte`, `vitest`).
2. Internal alias imports (`$app/state`, `$app/paths`, `$lib/...`) for framework hooks, state, geometry, UI primitives, and Paraglide messages.
3. Relative sibling imports last (`./composition-persistence.svelte`, `./ring-id`, `./types`).
4. `import type` is used for type-only imports, either standalone (`import type { Ring, WaveState } from '$lib/types'`) or inline as a named import alongside values.

**Path Aliases:**

- Prefer `$lib/...` for modules under `src/lib/` and avoid long relative traversals.
- `$app/state` is the source for reactive SvelteKit state (`page`); `$app/paths` is the source for `resolve()`. Both are framework aliases, imported the same way as `$lib`.

## Error Handling

**Patterns:**

- Use result objects for user-facing validation paths — `updateRingPathVariant` in `src/lib/state/composition.ts` returns `{ ok: false, reason: string }` instead of throwing, including a deliberate stopgap branch that re-seeds the secondary path rather than rejecting a structurally incompatible primary edit (see the JSDoc above that function).
- Defensive fallbacks over exceptions for malformed/legacy data: `ensureRingIds` and `normalizeComposition` in `composition-persistence.svelte.ts` backfill missing `id`s and migrate legacy palette shapes (`{main,bg}` → `{primary,secondary,background}`) rather than throwing on old localStorage payloads.
- Numeric setters clamp/sanitize instead of throwing on bad input — every setter in `kaleidoscope.svelte.ts` guards with `Number.isFinite(n) ? n : <default>` (`setOffsetDistance`, `setTileRotation`, `setGlobalRotation`, etc.).
- Throw typed errors for strict geometry invariants where recovery isn't meaningful (`PathMorphError`, `RenderPipelineError`).

## Logging

**Framework:** No dedicated logging framework detected.

**Patterns:**

- Prefer deterministic state transitions and returned reasons over runtime logging (see Error Handling).
- Warnings for render fallback paths are emitted inside geometry rendering (`src/lib/geometry/render-pipeline.ts`) and asserted in tests.

## Comments

**When to Comment:**

- Add comments for non-obvious data-shape decisions, not just tricky control flow — e.g. `composition-persistence.svelte.ts` explains *why* `TRANSIENT_RING_FIELDS` (`wave`, `zoneDrive`) must never reach localStorage, and `kaleidoscope.svelte.ts` explains why `backgroundColor` is intentionally omitted from live state.
- Comment stopgaps and their proper-fix pointer explicitly: `updateRingPathVariant`'s primary-reseed branch is flagged `// Stopgap: ... Proper fix relocates morph editing to Animate (spec Animate #2)`; `removeRingFromComposition` cross-references its counterpart in `animation.svelte.ts` by name.
- Keep behavior contracts in JSDoc on exported APIs whose mutation guarantees aren't obvious from the signature.

**JSDoc/TSDoc:**

- Used on exported state/action APIs with non-obvious constraints, e.g. `addRingWithPath`, `removeRingFromComposition`, `updateRingPathVariant`, `createPersistedComposition`, `ensureRingIds`, `normalizeComposition` in `src/lib/state/composition.ts` / `composition-persistence.svelte.ts`.

## Function Design

**Size:** Keep UI orchestration inside `.svelte` components (event bindings, derived display values) and move reusable behavior into focused `$lib/state` and `$lib/geometry` modules. Animation drivers keep `frame(nowMs)` bodies to a single pass over rings with no nested driver-to-driver calls.

**Parameters:**

- Pass ring index and explicit variant/mode literals (`setRingMorphT(index, t)`, `updateRingPathVariant(index, variant, path)`, `setRingZoneDrive(index, drive)`).
- Driver factories take a single `deps` object of getters/setters (`CreateAudioBarsDriverDeps = { getConfig, getRingCount, getRing, readBars, applyRingWave }`) rather than positional parameters — this is the standard shape for `create<X>Driver(deps)` across `state/animation-drivers/`.
- Clamp/sanitize user numeric input at state boundaries (`setRingMorphT` → `clamp01`, kaleidoscope setters → `clampSectors`/`clampRepeat`/`Number.isFinite` guards).

**Return Values:**

- Use `void` for direct state mutation handlers (`setKaleidoscopeEnabled`, `setLiveTile`, `reshuffle`).
- Use typed result unions for operations that can fail without throwing (`UpdateRingPathVariantResult`).
- Driver `frame(nowMs)` returns `Record<number, number>` (a sparse ring-index → value map), even when a driver has no direct numeric output and returns `{}` (e.g. `createAudioBarsDriver`, which communicates its effect via `applyRingWave` side calls instead).

## Module Design

**Exports:**

- State modules expose a named `$state` singleton plus verb-first action functions operating on it (`kaleidoscope` + `setSectors`/`setRepeat`/…; `composition` + `addRing`/`updateRing`/…).
- Components remain single-file default exports (implicit via `.svelte`).

**Barrel Files:**

- shadcn/ui components are imported through barrel `index.js`/`index.ts` modules (`$lib/shadcn/ui/button`, `$lib/shadcn/ui/input`).
- Thin re-export modules provide stable import paths over `.svelte.ts` logic: `src/lib/state/animation.ts` re-exports `./animation.svelte`; `src/lib/state/composition.ts` re-exports `composition` from `./composition-persistence.svelte` and adds the action-facade layer on top (facade/persistence split — see Naming Patterns).

## Svelte 5 and Animation Patterns

**Runes baseline:** `svelte.config.js` enables `runes: true`; components and `.svelte.ts` modules use `$state`, `$derived`, `$effect`, `$effect.root`, `$props`, and `untrack`.

**i18n:**

- All user-facing copy goes through Paraglide message functions imported as `import { m } from '$lib/paraglide/messages'` and called as `m.nav_paths()`, `m.nav_editor()`, etc. (see `src/lib/components/SidebarNav.svelte`). Message source lives in `messages/en.json` and `messages/it.json`; `src/lib/paraglide/` is generated by `paraglide-js` and gitignored (populated by the Vite plugin / `npm run` build, not hand-edited).
- `src/lib/messages-parity.spec.ts` asserts `en.json` and `it.json` define exactly the same key set (sorted key comparison, `$schema` excluded) — any new message key must be added to both locales or this spec fails.

**Routing:**

- Every internal `href` and every `redirect()` target is built with `resolve()` from `$app/paths`, never a hardcoded string — required because `svelte.config.js` sets `adapter-static` with a configurable `base: process.env.BASE_PATH ?? ''` for GitHub Pages deploys. Examples: `resolve('/paths')` in `SidebarNav.svelte`'s tab list, `redirect(307, resolve('/paths'))` in `src/routes/+page.ts`.
- Reactive route state (current pathname, etc.) is read from `page` imported as `import { page } from '$app/state'` (not the legacy `$app/stores` `$page` store) — `SidebarNav.svelte` derives `activeIndex` from `page.url?.pathname`.

**Driver factory pattern (`src/lib/state/animation-drivers/`):**

- Each driver module exports one `create<X>Driver(deps): AnimationDriver` returning `{ init(), dispose(), frame(nowMs) }`. `init` reads config once; `dispose` tears down any per-ring side effects it applied (e.g. `createAudioBarsDriver`'s `dispose` clears `applyRingWave(index, null)` for every ring); `frame` is called once per animation tick and returns a `Record<number, number>`.
- Drivers are registered against `state/animation-drivers/runtime.ts`'s `createAnimationRuntime(...)` via `runtime.registerDriver(type, driver)` inside `src/lib/state/animation.svelte.ts`, keyed by `AnimationDriverType`. `DRIVER_LAYERS` (derived by filtering `ALL_LAYERS` where `LAYER_KIND[l] === 'driver'`) is the list `syncActiveDrivers`/teardown code iterates to call `runtime.setActive(l, ...)`.

**State module pattern (`*.svelte.ts`):**

- A module-level `$state(...)` singleton is the source of truth (`kaleidoscope` in `kaleidoscope.svelte.ts`, `animationState` in `animation.svelte.ts`, `composition` in `composition-persistence.svelte.ts`), paired with verb-first setter functions that mutate it directly (`setSectors`, `setCircularMask`) rather than returning new state for callers to assign.
- Persisted singletons (`composition`, `colorMode`, `uiState`) use `rune-sync`'s `lsSync`/`localStorageSync` for cross-tab sync; `composition` additionally gates writes on a transient-stripped snapshot comparison (see Error Handling / Comments) so audio-driven fields never dirty the persisted JSON.
- Rings are keyed by a stable `id` minted with `newRingId()` from `state/ring-id.ts` (`crypto.randomUUID()` with a non-crypto fallback), not by array index, so identity survives `reorderRings`/`removeRingFromComposition`.

**Testing hooks:**

- Interactive elements carry `data-testid` for e2e/browser-spec targeting, applied broadly across nav, layout, and section components (`SidebarNav.svelte`'s `nav-paths`/`nav-editor`/`nav-composition`/`nav-animate` tabs and the `workspace-nav` container; also present in `RingEditor.svelte`, `AudioLayerSection.svelte`, `DataSeriesSection.svelte`, `KaleidoscopeAudioSection.svelte`, `TimelinePanel.svelte`, `src/routes/(app)/+layout.svelte`, `src/routes/about/+page.svelte`, `src/routes/paths/+page.svelte`). E2E specs (`workspace-nav.e2e.ts`, `path-manager.e2e.ts`) select on these ids rather than text/CSS.

---

*Convention analysis: 2026-07-06*
