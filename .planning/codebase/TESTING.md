# Testing Patterns

**Analysis Date:** 2026-04-24

## Test Framework

**Runner:**
- Vitest `^4.1.0` configured through `vite.config.ts` (multi-project test setup).
- Config location: `vite.config.ts`.

**Assertion Library:**
- Vitest `expect` API for unit/server tests and browser assertions.
- `@playwright/test` assertions for E2E in `src/routes/demo/playwright/page.svelte.e2e.ts`.

**Run Commands:**
```bash
npm run test:unit         # Run Vitest projects
npm run test              # Run unit tests in run mode, then Playwright e2e
npm run test:e2e          # Run Playwright end-to-end tests
```

## Test File Organization

**Location:**
- Tests are co-located with source modules in `src/lib/...` and route demos in `src/routes/...`.

**Naming:**
- Unit/component tests use `.spec.ts`:
  - `src/lib/color/apply.spec.ts`
  - `src/lib/geometry/bend.svelte.spec.ts`
  - `src/lib/vitest-examples/greet.spec.ts`
- E2E tests use `.e2e.ts`:
  - `src/routes/demo/playwright/page.svelte.e2e.ts`

**Structure:**
```
src/lib/<feature>/<module>.ts
src/lib/<feature>/<module>.spec.ts
src/lib/<feature>/<component>.svelte
src/lib/<feature>/<component>.svelte.spec.ts
src/routes/<feature>/<page>.svelte.e2e.ts
```

## Test Structure

**Suite Organization:**
```typescript
describe('applyColors', () => {
	it('manual mode returns current colors unchanged', () => {
		expect(applyColors('manual', mono, full, current, 2)).toEqual(current);
	});
});
```

**Patterns:**
- Use `describe` and focused `it` blocks with behavior-oriented names (`src/lib/color/apply.spec.ts`).
- Use lifecycle hooks where setup/cleanup is required:
  - `beforeEach` for paper.js scope initialization (`src/lib/geometry/bend.svelte.spec.ts`, `src/lib/geometry/compose.svelte.spec.ts`).
  - `afterEach` cleanup for shared registration state (`clearPreprocessors()` in `src/lib/geometry/svg-import.svelte.spec.ts`).
- Browser component tests use async DOM assertions (`src/lib/vitest-examples/Welcome.svelte.spec.ts`).

## Mocking

**Framework:** Vitest mocks/spies via `vi`.

**Patterns:**
```typescript
const preprocessor = vi.fn((item: paper.Item) => item);
addPreprocessor(preprocessor);
importSvgFromString(simpleSvg, scope);
expect(preprocessor).toHaveBeenCalledOnce();
```

**What to Mock:**
- Use `vi.fn` for callback/observer behavior where invocation is the contract (`src/lib/geometry/svg-import.svelte.spec.ts`).

**What NOT to Mock:**
- Do not mock core geometry logic; tests instantiate real `paper.PaperScope` and validate generated path properties in `src/lib/geometry/bend.svelte.spec.ts` and `src/lib/geometry/compose.svelte.spec.ts`.

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
- Inline constants and builders inside each test file (`rectPath`, `twoRingComposition`, `simpleSvg`) rather than shared fixture directories.

## Coverage

**Requirements:** no explicit coverage threshold configuration detected.

**View Coverage:**
```bash
npx vitest run --coverage
```

## Test Types

**Unit Tests:**
- Pure function tests for parsing and color application in `src/lib/color/apply.spec.ts`.
- Basic utility sample test in `src/lib/vitest-examples/greet.spec.ts`.

**Integration Tests:**
- Geometry rendering and SVG import behavior with real paper.js runtime:
  - `src/lib/geometry/bend.svelte.spec.ts`
  - `src/lib/geometry/compose.svelte.spec.ts`
  - `src/lib/geometry/svg-import.svelte.spec.ts`
- Browser-rendered Svelte component integration test in `src/lib/vitest-examples/Welcome.svelte.spec.ts`.

**E2E Tests:**
- Playwright is used with static preview server bootstrap (`playwright.config.ts`).
- Current E2E coverage is minimal and validates page visibility in `src/routes/demo/playwright/page.svelte.e2e.ts`.

## Common Patterns

**Async Testing:**
```typescript
render(Welcome, { host: 'SvelteKit', guest: 'Vitest' });
await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('Hello, SvelteKit!');
```

**Error Testing:**
```typescript
it('returns null for malformed input', () => {
	const result = importSvgFromString('not valid svg at all <<<', scope);
	expect(result).toBeNull();
});
```

---

*Testing analysis: 2026-04-24*
