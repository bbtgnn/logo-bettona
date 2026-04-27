# Testing Patterns

**Analysis Date:** 2026-04-27

## Test Framework

**Runner:**

- Vitest `^4.1.0` with multi-project configuration in `vite.config.ts`.
- Global enforcement: `expect: { requireAssertions: true }` (each test must assert).

**Assertion Library:**

- Vitest built-in `expect`.

**Browser component testing:**

- `@vitest/browser-playwright` with Chromium headless provider.
- `vitest-browser-svelte` for rendering Svelte components in browser tests.

**Run Commands:**

```bash
npm run test:unit              # Vitest (watch mode by default)
npm run test:unit -- --run     # Single run of all Vitest projects
npm run test                   # Unit tests (--run) + Playwright e2e
npm run test:e2e               # Playwright suite
```

## Test File Organization

**Location:**

- Tests are co-located with source files under `src/lib/**`.
- Examples: `src/lib/components/AnimationSection.svelte.spec.ts`, `src/lib/state/animation.svelte.spec.ts`, `src/lib/geometry/render-pipeline.svelte.spec.ts`.

**Naming:**

- `*.svelte.spec.ts` targets the browser project by default.
- `*.spec.ts`/`*.test.ts` (non-`.svelte`) target the Node project.
- `src/lib/state/animation.svelte.spec.ts` is a deliberate exception: explicitly included in Node project and excluded from browser project in `vite.config.ts`.

**Structure:**

```
src/lib/
├── color/apply.spec.ts
├── components/
│   ├── AnimationSection.svelte.spec.ts
│   ├── PreviewCanvas.svelte.spec.ts
│   └── Sidebar.svelte.spec.ts
├── geometry/
│   ├── bend.svelte.spec.ts
│   ├── compose.svelte.spec.ts
│   ├── path-morph.svelte.spec.ts
│   ├── render-pipeline.svelte.spec.ts
│   └── svg-import.svelte.spec.ts
└── state/
    ├── animation.svelte.spec.ts
    └── composition.svelte.spec.ts
```

## Test Structure

**Suite Organization:**

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('feature name', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('does one observable thing', async () => {
		const mod = await import('./feature');
		expect(mod.value).toBeDefined();
	});
});
```

**Patterns:**

- Reset module state with `vi.resetModules()` when module-level runes/state are under test (`src/lib/state/animation.svelte.spec.ts`, `src/lib/state/composition.svelte.spec.ts`).
- Use dynamic `await import(...)` after mocks to ensure tests consume mocked dependencies.
- Browser tests use `render(...)`, `page`, and `userEvent` for UI interaction (`src/lib/components/AnimationSection.svelte.spec.ts`).
- Rendering tests that rely on Paper.js use `vi.waitFor(...)` to observe async draws.

## Animation and Morph Coverage

### `src/lib/state/animation.svelte.spec.ts`

- Tests animation controller behavior from `src/lib/state/animation.svelte.ts`.
- Mocks `animejs` and `./composition` with `vi.mock(...)` and hoisted fakes.
- Covers:
  - idle to playing transition (`togglePlay`)
  - pause/resume transitions
  - no-op when no morph targets exist
  - progress updates via mocked `onUpdate`
  - reset when composition ring set changes
  - robustness when play resumes after loop/alternate pause edge case
  - Svelte rune reactivity visibility via `$derived`

### `src/lib/components/AnimationSection.svelte.spec.ts`

- Component-level wiring tests for `src/lib/components/AnimationSection.svelte`.
- Mocks `$lib/state/animation` and `$lib/state/composition`.
- Covers:
  - control rendering (Play/Pause, Duration, Loop, Alternate, progress text)
  - handler wiring (`togglePlay`, `setAnimationDurationSec`, `setAnimationLoop`, `setAnimationAlternate`)
  - composition safety hook invocation (`handleCompositionChanged`) after render

### Related morph coverage

- `src/lib/state/composition.svelte.spec.ts`: morph target lifecycle and path-compatibility enforcement.
- `src/lib/geometry/path-morph.svelte.spec.ts`: interpolation and compatibility invariants.
- `src/lib/geometry/render-pipeline.svelte.spec.ts`: interpolation render path and fallback when morph paths diverge.

## Mocking

**Framework:** Vitest `vi.mock`, `vi.hoisted`, `vi.fn`, `vi.importActual`, `vi.waitFor`.

**Patterns:**

```typescript
const animationApi = vi.hoisted(() => ({
	togglePlay: vi.fn(),
	setAnimationDurationSec: vi.fn(),
	setAnimationLoop: vi.fn(),
	setAnimationAlternate: vi.fn(),
	handleCompositionChanged: vi.fn()
}));

vi.mock('$lib/state/animation', () => animationApi);
```

```typescript
vi.mock('animejs', () => ({
	animate: animeAnimate
}));
```

**What to Mock:**

- External animation engine boundaries (`animejs`) in state-controller tests.
- Persistence (`rune-sync/localstorage`) for deterministic composition tests.
- Cross-module wiring boundaries in component tests.

**What NOT to Mock:**

- Paper.js internals in render-pipeline tests; use real scope objects and assert layer output.

## Fixtures and Factories

**Test Data:**

```typescript
const mockComposition = {
	rings: [
		{ secondaryTemplatePath: { cmds: ['M'], crds: [0, 0] }, morphT: 0 },
		{ secondaryTemplatePath: null, morphT: 0 }
	]
};
```

```typescript
const initialComposition: Composition = {
	baseRadius: 100,
	ringIncrement: 50,
	rings: [],
	monochromePalettes: [{ main: '#000000', bg: '#ffffff' }],
	fullPalettes: [{ colors: ['#1a1a2e', '#16213e', '#0f3460', '#e94560'] }]
};
```

**Location:**

- Fixtures are defined inline in each spec file; no shared fixture directory.

## Coverage

**Requirements:** No minimum coverage threshold is configured in `package.json`, `vite.config.ts`, or dedicated coverage config.

**View Coverage:**

```bash
npm run test:unit -- --run --coverage
```

## Test Types

**Unit Tests:**

- Pure logic in Node (`src/lib/color/apply.spec.ts`, `src/lib/state/animation.svelte.spec.ts` via explicit Node inclusion).

**Integration Tests:**

- State and storage interactions (`src/lib/state/composition.svelte.spec.ts`).
- Geometry + Paper render flow (`src/lib/geometry/render-pipeline.svelte.spec.ts`, `src/lib/geometry/compose.svelte.spec.ts`).

**Component / Browser Tests:**

- UI behavior and wiring (`src/lib/components/AnimationSection.svelte.spec.ts`, `src/lib/components/PreviewCanvas.svelte.spec.ts`, `src/lib/components/Sidebar.svelte.spec.ts`).

**E2E Tests:**

- Playwright is configured in `playwright.config.ts` with `testMatch: '**/*.e2e.{ts,js}'`.

## Common Patterns

**Async Testing:**

```typescript
await vi.waitFor(() => {
	expect(animationApi.handleCompositionChanged).toHaveBeenCalledOnce();
});
```

**Error/edge-case Testing:**

```typescript
expect(() => animation.togglePlay()).not.toThrow();
expect(animation.animationState.isPlaying).toBe(true);
```

```typescript
expect(result.ok).toBe(false);
if (result.ok) throw new Error('expected failure');
expect(result.reason).toBe('Path commands must match exactly to interpolate');
```

---

*Testing analysis: 2026-04-27*
