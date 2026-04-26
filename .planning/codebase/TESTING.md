# Testing Patterns

**Analysis Date:** 2026-04-26

## Test Framework

**Runner:**

- Vitest `^4.1.0` with **two projects** defined in `vite.config.ts` (Vitest’s `defineConfig` from `vitest/config`).

**Assertion Library:**

- Vitest built-in `expect`.

**Browser component testing:**

- `@vitest/browser-playwright` with `playwright()` provider, Chromium headless.
- `vitest-browser-svelte` for `render()` / `unmount()` of Svelte components in browser tests.

**Run Commands:**

```bash
npm run test:unit              # vitest (default: watch; CI often uses flags below)
npm run test:unit -- --run    # single run (all Vitest projects)
npm run test                  # unit --run plus Playwright e2e
npm run test:e2e              # playwright test
```

Vitest global option in `vite.config.ts`: `expect: { requireAssertions: true }` — every `it` must contain at least one assertion.

## Test File Organization

**Location:**

- Co-located with source: `src/lib/geometry/path-morph.svelte.spec.ts` next to `path-morph.ts`; `src/lib/state/composition.svelte.spec.ts` next to `composition.ts`; `src/lib/components/PreviewCanvas.svelte.spec.ts` next to `PreviewCanvas.svelte`.

**Naming — critical split:**

| Pattern | Vitest project | Environment |
|--------|----------------|---------------|
| `src/**/*.svelte.spec.ts` (or `.test.ts`) | `client` | Browser (Playwright Chromium) |
| `src/**/*.{spec,test}.ts` **excluding** `*.svelte.spec.ts` | `server` | Node |

Configured in `vite.config.ts`: `client` `include` is `src/**/*.svelte.{test,spec}.{js,ts}`; `server` `include` is `src/**/*.{test,spec}.{js,ts}` with `exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']`.

**Prescriptive rule:** Pure Node unit tests (e.g. `src/lib/color/apply.spec.ts`) must **not** use the `*.svelte.spec.ts` suffix. Tests that need the browser project (Svelte `render`, `vitest/browser`, DOM) **must** use `*.svelte.spec.ts` (e.g. `src/lib/vitest-examples/Welcome.svelte.spec.ts`, `PreviewCanvas.svelte.spec.ts`).

**Note:** Several geometry/state specs use the `*.svelte.spec.ts` suffix while testing non-Svelte TS modules (`path-morph`, `render-pipeline`, `bend`, `compose`) so they execute in the **browser** project, not Node. Prefer **`*.spec.ts`** for true Node-only tests unless you intentionally need browser APIs or alignment with the component project.

**Structure:**

```
src/lib/
├── color/apply.spec.ts              # Node project
├── geometry/
│   ├── path-morph.ts
│   ├── path-morph.svelte.spec.ts    # Browser project
│   ├── render-pipeline.svelte.spec.ts
│   └── compose.svelte.spec.ts
├── state/composition.svelte.spec.ts
└── components/PreviewCanvas.svelte.spec.ts
```

## Test Structure

**Suite Organization:**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('feature name', () => {
	beforeEach(() => {
		// reset shared fixtures
	});

	it('does one observable thing', () => {
		expect(actual).toEqual(expected);
	});
});
```

**Patterns:**

- **Paper.js:** Fresh `paper.PaperScope` per test in `beforeEach`, `scope.setup(new paper.Size(600, 600))` — see `src/lib/geometry/render-pipeline.svelte.spec.ts`, `bend.svelte.spec.ts`, `compose.svelte.spec.ts`.
- **Module reset + mocks:** `composition.svelte.spec.ts` calls `vi.resetModules()` in `beforeEach` and uses `vi.mock('rune-sync/localstorage', ...)` so each `await import('./composition')` sees a clean module with mocked `lsSync`.
- **Async composition tests:** Use `async` `it` blocks when dynamically importing the module under test after mocks are installed.

## Morph and path pipeline — conventions

### `src/lib/geometry/path-morph.svelte.spec.ts`

- Tests **`path-morph.ts`** exports: `validatePathCompatibility`, `interpolatePath`, `PathMorphError`.
- Uses plain `Path` fixtures (`cmds` / `crds`) from `$lib/types`.
- Covers: matching shapes, command mismatch reasons, endpoints at `t=0` / `t=1`, midpoint interpolation, clamping `t` outside `[0,1]`, and `toThrow(PathMorphError)` for incompatible paths.
- **Naming:** File is `*.svelte.spec.ts` → runs in **browser** Vitest project even though no Svelte is imported; keep this in mind for CI time and environment.

### `src/lib/state/composition.svelte.spec.ts`

- Targets **`composition.ts`** ring morph API: `createRingMorphTarget`, `removeRingMorphTarget`, `setRingMorphT`, `updateRingPathVariant`.
- Mocks **`rune-sync/localstorage`** `lsSync` to return deterministic `composition`, `color-mode`, and `composition-ui` payloads via `structuredClone`.
- Asserts: secondary path equals primary clone after `createRingMorphTarget`; `removeRingMorphTarget` clears `secondaryTemplatePath`; `setRingMorphT` clamps to `[0,1]`; `updateRingPathVariant` success and failure (`ok: false`, unchanged ring via `structuredClone` snapshot) when secondary is incompatible with primary.

### `src/lib/geometry/render-pipeline.svelte.spec.ts`

- Targets **`render-pipeline.ts`** `createRenderPipeline().render` with real `paper` scope and `Composition` fixtures including `secondaryTemplatePath` and `morphT`.
- Covers: deterministic child count per ring, z-order (ring 0 top-most fill), skip + warning when `templatePath` is null, interpolation path when secondary exists, **fallback** to primary when morph paths are incompatible (warning contains `morph fallback`), per-ring try/catch behavior, re-render clears scene, `RenderPipelineError` for invalid viewport/scope/composition, and layout bounds vs padded viewport.

### `src/lib/geometry/compose.svelte.spec.ts`

- Thin integration check: `renderComposition` from `compose.ts` delegates to pipeline and leaves expected Paper layer child count for a two-ring composition (no morph-specific assertions yet).

### Component patterns vs tests — `RingEditor.svelte`

- UI behavior for morph is wired through the same APIs the tests hit: `createRingMorphTarget`, `removeRingMorphTarget`, `setRingMorphT`, `updateRingPathVariant`. There is **no** dedicated `RingEditor.svelte.spec.ts` in the repo; morph coverage is primarily **state** + **render-pipeline** + **path-morph**. Adding a browser spec would follow `PreviewCanvas.svelte.spec.ts` patterns (`vitest-browser-svelte` + optional pipeline mocks).

## Mocking

**Framework:** Vitest `vi.mock`, `vi.importActual`, `vi.fn`, `vi.waitFor`.

**Patterns:**

```typescript
vi.mock('$lib/geometry/render-pipeline', async () => {
	const actual = await vi.importActual<typeof import('$lib/geometry/render-pipeline')>(
		'$lib/geometry/render-pipeline'
	);
	return {
		...actual,
		createRenderPipeline: () => {
			const pipeline = actual.createRenderPipeline();
			return {
				render: (input: RenderInput) => {
					/* spy + delegate */
					return pipeline.render(input);
				},
				dispose: () => pipeline.dispose()
			};
		}
	};
});
```

From `src/lib/components/PreviewCanvas.svelte.spec.ts` — partial mock wrapping real pipeline to assert call counts and last `RenderInput`.

**What to Mock:**

- Persistence: `rune-sync/localstorage` in composition tests.
- Heavy or non-deterministic boundaries when asserting call contract — render pipeline factory when testing `PreviewCanvas.svelte`.

**What NOT to Mock:**

- Paper scope internals when testing `render-pipeline` or `bend` — use real `paper` and assert on `scope.project.activeLayer.children`.

## Fixtures and Factories

**Test Data:**

```typescript
const rectPath: Path = {
	cmds: ['M', 'L', 'L', 'L', 'Z'],
	crds: [0, 0, 100, 0, 100, 50, 0, 50]
};

const baseRing = (overrides: Partial<Ring> = {}): Ring => ({
	copies: 4,
	color: '#000000',
	ringHeight: 0.5,
	templatePath: rectPath,
	secondaryTemplatePath: null,
	morphT: 0,
	...overrides
});
```

**Location:** Inline at top of spec files or inside `describe` blocks; no central `fixtures/` directory.

## Coverage

**Requirements:** No enforced coverage threshold in repo config detected.

**View Coverage:** Add Vitest coverage flags locally if needed (`vitest --coverage` with provider installed); not pre-wired in `package.json`.

## Test Types

**Unit Tests:**

- Pure functions — `src/lib/color/apply.spec.ts` in **Node** project.
- Path morph — `path-morph.svelte.spec.ts` (browser project despite pure TS).

**Integration-style:**

- Paper + pipeline — `render-pipeline.svelte.spec.ts`, `compose.svelte.spec.ts`, `bend.svelte.spec.ts`.
- State + mocked storage — `composition.svelte.spec.ts`.

**Component / browser tests:**

- `Welcome.svelte.spec.ts` — `render` from `vitest-browser-svelte`, `page` from `vitest/browser`, `expect.element(...).toHaveTextContent` / `toBeInTheDocument`.
- `PreviewCanvas.svelte.spec.ts` — mutates real `composition` from `$lib/state/composition` with `beforeEach` / `afterEach` snapshot restore; uses `vi.waitFor` for async paint.

**E2E Tests:**

- Playwright: `playwright.config.ts` runs `npm run build && npm run preview` on port `4173`, `testMatch: '**/*.e2e.{ts,js}'`.

## Common Patterns

**Async Testing:**

```typescript
await vi.waitFor(() => {
	expect(renderCallCount).toBeGreaterThan(initialCount);
});
```

**Error Testing:**

```typescript
expect(() => interpolatePath(primaryPath, incompatiblePath, 0.5)).toThrow(PathMorphError);

expect(() =>
	pipeline.render({ composition, scope, viewport: { width: 0, height: 600, padding: 32 } })
).toThrow(RenderPipelineError);
```

**Narrowing after failure result:**

```typescript
const result = compositionModule.updateRingPathVariant(0, 'secondary', incompatible);
expect(result.ok).toBe(false);
if (result.ok) throw new Error('expected failure');
expect(result.reason).toBe('Path commands must match exactly to interpolate');
```

---

*Testing analysis: 2026-04-26*
