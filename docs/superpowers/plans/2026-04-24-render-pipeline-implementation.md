# Render Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a deep `RenderPipeline` module so `PreviewCanvas` delegates rendering orchestration instead of owning composition render policy.

**Architecture:** Add a new `render-pipeline` boundary in `src/lib/geometry` that owns input validation, ring draw ordering, fit policy, and render warnings. Keep `bend.ts` focused on geometry primitives and make `PreviewCanvas` call a single `pipeline.render(...)` entrypoint. Migrate with behavior parity, then shift tests from orchestration internals to boundary outcomes.

**Tech Stack:** Svelte 5, TypeScript, paper.js, Vitest

---

## File Structure and Responsibilities

- Create: `src/lib/geometry/render-pipeline.ts` - public pipeline API (`createRenderPipeline`, `render`, `dispose`) plus internal helpers.
- Create: `src/lib/geometry/render-pipeline.svelte.spec.ts` - boundary tests for pipeline behavior and error/warning policy.
- Modify: `src/lib/components/PreviewCanvas.svelte` - delegate redraw to pipeline API.
- Modify: `src/lib/geometry/compose.ts` - keep backward-compatible wrappers delegating to pipeline (temporary compatibility layer).
- Modify: `src/lib/geometry/compose.svelte.spec.ts` - reduce tests to wrapper parity checks and move orchestration assertions to pipeline tests.

### Task 1: Add failing boundary tests for the new pipeline

**Files:**
- Create: `src/lib/geometry/render-pipeline.svelte.spec.ts`
- Test: `src/lib/geometry/render-pipeline.svelte.spec.ts`

- [ ] **Step 1: Write the failing test file**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import paper from 'paper';
import type { Composition, Path } from '$lib/types';
import { createRenderPipeline, RenderPipelineError } from './render-pipeline';

let scope: paper.PaperScope;

beforeEach(() => {
	scope = new paper.PaperScope();
	scope.setup(new paper.Size(600, 600));
});

const rectPath: Path = {
	cmds: ['M', 'L', 'L', 'L', 'Z'],
	crds: [0, 0, 100, 0, 100, 50, 0, 50]
};

const composition: Composition = {
	baseRadius: 100,
	ringIncrement: 60,
	rings: [
		{ copies: 4, color: '#ff0000', templatePath: rectPath, ringHeight: 0.4 },
		{ copies: 4, color: '#0000ff', templatePath: rectPath, ringHeight: 0.4 }
	],
	monochromePalettes: [{ main: '#000', bg: '#fff' }],
	fullPalettes: [{ colors: ['#000', '#fff'] }]
};

describe('createRenderPipeline().render', () => {
	it('renders one path per renderable ring in deterministic order', () => {
		const pipeline = createRenderPipeline();
		const result = pipeline.render({
			composition,
			scope,
			viewport: { width: 600, height: 600, padding: 32 }
		});

		expect(scope.project.activeLayer.children.length).toBe(2);
		expect(result.renderedCount).toBe(2);
		expect(result.skippedCount).toBe(0);
		expect(result.warnings).toEqual([]);
	});

	it('returns warning and skips ring when templatePath is null', () => {
		const pipeline = createRenderPipeline();
		const result = pipeline.render({
			composition: {
				...composition,
				rings: [{ ...composition.rings[0], templatePath: null }, composition.rings[1]]
			},
			scope,
			viewport: { width: 600, height: 600, padding: 32 }
		});

		expect(scope.project.activeLayer.children.length).toBe(1);
		expect(result.renderedCount).toBe(1);
		expect(result.skippedCount).toBe(1);
		expect(result.warnings[0]).toContain('Ring 0');
	});

	it('throws RenderPipelineError for invalid viewport', () => {
		const pipeline = createRenderPipeline();
		expect(() =>
			pipeline.render({
				composition,
				scope,
				viewport: { width: 0, height: 600, padding: 32 }
			})
		).toThrow(RenderPipelineError);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- --run src/lib/geometry/render-pipeline.svelte.spec.ts`  
Expected: FAIL with module-not-found or missing exports from `src/lib/geometry/render-pipeline.ts`

- [ ] **Step 3: Commit the failing test**

```bash
git add src/lib/geometry/render-pipeline.svelte.spec.ts
git commit -m "test: add failing boundary tests for render pipeline"
```

### Task 2: Implement `render-pipeline` minimal API to satisfy tests

**Files:**
- Create: `src/lib/geometry/render-pipeline.ts`
- Test: `src/lib/geometry/render-pipeline.svelte.spec.ts`

- [ ] **Step 1: Write minimal implementation**

```ts
import paper from 'paper';
import type { Composition } from '$lib/types';
import { buildRingPath } from './bend';

export class RenderPipelineError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'RenderPipelineError';
	}
}

export type RenderInput = {
	composition: Composition;
	scope: paper.PaperScope;
	viewport: { width: number; height: number; padding?: number };
};

export type RenderResult = {
	renderedCount: number;
	skippedCount: number;
	warnings: string[];
};

export function createRenderPipeline() {
	return {
		render(input: RenderInput): RenderResult {
			const { composition, scope, viewport } = input;
			if (viewport.width <= 0 || viewport.height <= 0) {
				throw new RenderPipelineError('Invalid viewport dimensions');
			}

			scope.activate();
			scope.project.clear();

			let renderedCount = 0;
			let skippedCount = 0;
			const warnings: string[] = [];

			for (let i = composition.rings.length - 1; i >= 0; i--) {
				const ring = composition.rings[i];
				const radius = composition.baseRadius + composition.ringIncrement * i;
				const path = buildRingPath(ring, radius, scope);
				if (!path) {
					skippedCount += 1;
					warnings.push(`Ring ${i} skipped: template path is not renderable`);
					continue;
				}
				path.fillColor = new paper.Color(ring.color);
				path.strokeColor = null;
				renderedCount += 1;
			}

			fitLayerToView(scope, viewport.padding ?? 32);
			scope.view.update();

			return { renderedCount, skippedCount, warnings };
		},
		dispose() {
			// no-op for now; reserved for future resource cleanup
		}
	};
}

function fitLayerToView(scope: paper.PaperScope, padding: number) {
	const items = scope.project.activeLayer.children;
	if (items.length === 0) return;

	let bounds = items[0].bounds.clone();
	for (let i = 1; i < items.length; i++) {
		bounds = bounds.unite(items[i].bounds);
	}
	if (bounds.width === 0 || bounds.height === 0) return;

	const available = Math.min(scope.view.bounds.width, scope.view.bounds.height) - padding * 2;
	const scale = available / Math.max(bounds.width, bounds.height);
	scope.project.activeLayer.scale(scale, bounds.center);
	scope.project.activeLayer.position = scope.view.center;
}
```

- [ ] **Step 2: Run tests to verify pass**

Run: `npm run test:unit -- --run src/lib/geometry/render-pipeline.svelte.spec.ts`  
Expected: PASS

- [ ] **Step 3: Commit implementation**

```bash
git add src/lib/geometry/render-pipeline.ts src/lib/geometry/render-pipeline.svelte.spec.ts
git commit -m "feat: add render pipeline boundary with typed errors"
```

### Task 3: Migrate `PreviewCanvas` to pipeline boundary

**Files:**
- Modify: `src/lib/components/PreviewCanvas.svelte`
- Test: `src/lib/geometry/render-pipeline.svelte.spec.ts`

- [ ] **Step 1: Update component to use pipeline**

```ts
import { createRenderPipeline } from '$lib/geometry/render-pipeline';

let scope: paper.PaperScope;
const renderPipeline = createRenderPipeline();

function redraw(comp: typeof composition) {
	renderPipeline.render({
		composition: comp,
		scope,
		viewport: { width: scope.view.size.width, height: scope.view.size.height, padding: 32 }
	});
}
```

```ts
return () => {
	scope.project.clear();
	renderPipeline.dispose();
};
```

- [ ] **Step 2: Run focused tests to guard behavior parity**

Run: `npm run test:unit -- --run src/lib/geometry/compose.svelte.spec.ts src/lib/geometry/render-pipeline.svelte.spec.ts`  
Expected: PASS

- [ ] **Step 3: Commit component migration**

```bash
git add src/lib/components/PreviewCanvas.svelte
git commit -m "refactor: delegate preview rendering to render pipeline"
```

### Task 4: Convert `compose.ts` into compatibility wrapper

**Files:**
- Modify: `src/lib/geometry/compose.ts`
- Test: `src/lib/geometry/compose.svelte.spec.ts`

- [ ] **Step 1: Replace internals with pipeline delegation**

```ts
import paper from 'paper';
import type { Composition } from '$lib/types';
import { createRenderPipeline } from './render-pipeline';

const defaultPipeline = createRenderPipeline();

export function renderComposition(composition: Composition, scope: paper.PaperScope): void {
	defaultPipeline.render({
		composition,
		scope,
		viewport: { width: scope.view.size.width, height: scope.view.size.height, padding: 32 }
	});
}

export function fitToView(scope: paper.PaperScope): void {
	// backward-compatible no-op; fitting is now pipeline-owned
	scope.activate();
	scope.view.update();
}
```

- [ ] **Step 2: Run compose tests**

Run: `npm run test:unit -- --run src/lib/geometry/compose.svelte.spec.ts`  
Expected: PASS

- [ ] **Step 3: Commit compatibility layer**

```bash
git add src/lib/geometry/compose.ts
git commit -m "refactor: make compose API delegate to render pipeline"
```

### Task 5: Rebalance tests toward boundary behavior

**Files:**
- Modify: `src/lib/geometry/compose.svelte.spec.ts`
- Modify: `src/lib/geometry/render-pipeline.svelte.spec.ts`
- Test: `src/lib/geometry/compose.svelte.spec.ts`
- Test: `src/lib/geometry/render-pipeline.svelte.spec.ts`

- [ ] **Step 1: Narrow compose tests to compatibility contract**

```ts
describe('renderComposition compatibility wrapper', () => {
	it('renders expected number of paths through pipeline', () => {
		renderComposition(twoRingComposition, scope);
		expect(scope.project.activeLayer.children.length).toBe(2);
	});
});
```

- [ ] **Step 2: Add missing boundary assertions to pipeline spec**

```ts
it('keeps ring 0 as top-most renderable child', () => {
	const pipeline = createRenderPipeline();
	pipeline.render({
		composition,
		scope,
		viewport: { width: 600, height: 600, padding: 32 }
	});

	const children = scope.project.activeLayer.children;
	const top = children[children.length - 1] as paper.Path;
	expect(Math.round(top.fillColor!.red * 255)).toBe(255);
});
```

- [ ] **Step 3: Run test suite for geometry module**

Run: `npm run test:unit -- --run src/lib/geometry/*.svelte.spec.ts`  
Expected: PASS

- [ ] **Step 4: Commit test rebalance**

```bash
git add src/lib/geometry/compose.svelte.spec.ts src/lib/geometry/render-pipeline.svelte.spec.ts
git commit -m "test: shift render assertions to pipeline boundary"
```

### Task 6: Final verification and docs consistency

**Files:**
- Modify: `docs/superpowers/specs/2026-04-24-render-pipeline-design.md` (only if implementation deviates)
- Test: repository checks

- [ ] **Step 1: Run full unit tests**

Run: `npm run test:unit -- --run`  
Expected: PASS

- [ ] **Step 2: Run static checks**

Run: `npm run check && npm run lint`  
Expected: PASS

- [ ] **Step 3: Update spec only if needed**

```md
## 8) Migration Plan

4. Remove obsolete helpers and rewrite affected tests toward boundary coverage.
5. Keep `compose.ts` wrapper temporarily for compatibility until all callers are migrated.
```

- [ ] **Step 4: Commit verification/docs**

```bash
git add src/lib/components/PreviewCanvas.svelte src/lib/geometry/compose.ts src/lib/geometry/render-pipeline.ts src/lib/geometry/compose.svelte.spec.ts src/lib/geometry/render-pipeline.svelte.spec.ts
git commit -m "chore: run full verification for render pipeline migration"
```
