# Testing Patterns

**Analysis Date:** 2026-04-24

## Test Framework

**Runner:**
- Vitest `^4.1.0` (configured in `vite.config.ts` via `test.projects`).
- Config: `vite.config.ts`

**Assertion Library:**
- Vitest `expect` for unit/server tests.
- Browser assertions via `vitest-browser-svelte` and `@vitest/browser` (`src/lib/vitest-examples/Welcome.svelte.spec.ts`).
- Playwright `expect` for E2E (`src/routes/demo/playwright/page.svelte.e2e.ts`).

**Run Commands:**
```bash
npm run test:unit        # Run Vitest projects
npm run test:unit -- --watch  # Watch mode
npm run test             # Unit (run mode) + Playwright E2E
```

## Test File Organization

**Location:**
- Co-located with source files under `src/` (examples: `src/lib/color/apply.ts` with `src/lib/color/apply.spec.ts`, `src/lib/geometry/render-pipeline.ts` with `src/lib/geometry/render-pipeline.svelte.spec.ts`).

**Naming:**
- Unit/integration-like specs use `*.spec.ts`.
- Svelte browser specs use `*.svelte.spec.ts`.
- End-to-end specs use `*.e2e.ts`.

**Structure:**
```
src/
  lib/
    <feature>/
      <module>.ts
      <module>.spec.ts
      <module>.svelte.spec.ts
  routes/
    demo/playwright/
      page.svelte.e2e.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { beforeEach, describe, expect, it } from 'vitest';

describe('createRenderPipeline().render', () => {
	it('renders one path per renderable ring in deterministic order', () => {
		// arrange
		// act
		// assert
	});
});
```

**Patterns:**
- Setup pattern: initialize fresh `paper.PaperScope` in `beforeEach` (`src/lib/geometry/*.svelte.spec.ts`).
- Teardown pattern: explicit cleanup in `afterEach` where module-level registries exist (`clearPreprocessors` in `src/lib/geometry/svg-import.svelte.spec.ts`).
- Assertion pattern: use exact structural assertions for deterministic behavior (`toEqual`, `toHaveLength`, `toThrow`) and tolerance checks for geometry (`toBeCloseTo`, bounded epsilon).

## Mocking

**Framework:** Vitest `vi`

**Patterns:**
```typescript
const preprocessor = vi.fn((item: paper.Item) => item);
addPreprocessor(preprocessor);
importSvgFromString(simpleSvg, scope);
expect(preprocessor).toHaveBeenCalledOnce();
```

**What to Mock:**
- Boundary callbacks and observer-style hooks (example above in `src/lib/geometry/svg-import.svelte.spec.ts`).
- Invalid/throwing boundary contracts with explicit fake objects to verify error wrapping (`throwingScope` in `src/lib/geometry/render-pipeline.svelte.spec.ts`).

**What NOT to Mock:**
- Core geometry/render behavior; tests use real `paper` scope instances to validate rendering and bounds behavior.
- Pure deterministic utility logic (`src/lib/color/apply.spec.ts`, `src/lib/vitest-examples/greet.spec.ts`).

## Fixtures and Factories

**Test Data:**
```typescript
const baseRing = (overrides: Partial<Ring> = {}): Ring => ({
	copies: 4,
	color: '#000000',
	ringHeight: 0.5,
	templatePath: rectPath,
	...overrides
});
```

**Location:**
- Fixtures are local constants/factories inside each spec file (`rectPath`, `composition`, `baseRing`, inline SVG strings).
- No shared `fixtures/` directory is detected.

## Coverage

**Requirements:** None enforced by configuration; no coverage thresholds or `--coverage` script detected in `package.json` or `vite.config.ts`.

**View Coverage:**
```bash
npx vitest run --coverage
```

## Test Types

**Unit Tests:**
- Pure function and state-transition behavior in Node environment (`src/lib/color/apply.spec.ts`, `src/lib/vitest-examples/greet.spec.ts`).

**Integration Tests:**
- Module-level integration with real `paper` rendering primitives and pipeline internals (`src/lib/geometry/render-pipeline.svelte.spec.ts`, `src/lib/geometry/compose.svelte.spec.ts`, `src/lib/geometry/bend.svelte.spec.ts`).

**E2E Tests:**
- Playwright is used (`playwright.config.ts` and `src/routes/demo/playwright/page.svelte.e2e.ts`), currently with a minimal smoke path assertion.

## Common Patterns

**Async Testing:**
```typescript
test('has expected h1', async ({ page }) => {
	await page.goto('/demo/playwright');
	await expect(page.locator('h1')).toBeVisible();
});
```

**Error Testing:**
```typescript
expect(() =>
	pipeline.render({
		composition,
		scope: undefined as unknown as paper.PaperScope,
		viewport: { width: 600, height: 600, padding: 32 }
	})
).toThrow(RenderPipelineError);
```

---

*Testing analysis: 2026-04-24*
