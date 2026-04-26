# Ring Dual-Path Interpolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional per-ring secondary paths and manual per-ring `t` interpolation so rendering can morph between two compatible template paths while preserving current behavior for single-path rings.

**Architecture:** Keep morph math in a new geometry helper module and keep ring rendering orchestration in the render pipeline. Extend ring state with `secondaryTemplatePath` and `morphT`, then add focused ring editor controls for creating/removing/editing morph targets and changing `t`. Enforce strict compatibility checks at edit time and defensively at render time with primary-path fallback.

**Tech Stack:** Svelte 5, TypeScript, paper.js, Vitest, Playwright

---

## File Structure and Responsibilities

- Create: `src/lib/geometry/path-morph.ts` - pure path compatibility + interpolation helpers.
- Create: `src/lib/geometry/path-morph.svelte.spec.ts` - unit tests for morph helper behavior and mismatch handling.
- Modify: `src/lib/types.ts` - extend `Ring` with `secondaryTemplatePath` and `morphT`.
- Create: `src/lib/state/composition.svelte.spec.ts` - state mutation tests for morph target lifecycle and `morphT` clamping.
- Modify: `src/lib/state/composition.ts` - add morph actions and defaults while preserving existing ring behavior.
- Modify: `src/lib/geometry/render-pipeline.ts` - use morph helper to derive effective template path per ring.
- Modify: `src/lib/geometry/render-pipeline.svelte.spec.ts` - verify interpolated render and fallback warning behavior.
- Modify: `src/lib/components/RingEditor.svelte` - add morph target controls, variant editor toggle, and per-ring slider.
- Modify: `src/lib/components/RingCanvas.svelte` - allow optional label so primary/secondary editor mode is explicit.
- Modify: `src/routes/demo/playwright/page.svelte.e2e.ts` - add UI regression coverage for morph controls.

### Task 1: Add failing geometry tests for path morph helper

**Files:**
- Create: `src/lib/geometry/path-morph.svelte.spec.ts`
- Test: `src/lib/geometry/path-morph.svelte.spec.ts`

- [ ] **Step 1: Write failing tests for compatibility + interpolation**

```ts
import { describe, expect, it } from 'vitest';
import type { Path } from '$lib/types';
import { interpolatePath, validatePathCompatibility, PathMorphError } from './path-morph';

const pathA: Path = {
	cmds: ['M', 'L', 'L', 'Z'],
	crds: [0, 0, 10, 0, 10, 10]
};

const pathB: Path = {
	cmds: ['M', 'L', 'L', 'Z'],
	crds: [0, 0, 20, 0, 20, 20]
};

describe('validatePathCompatibility', () => {
	it('returns ok for matching command and coordinate shapes', () => {
		expect(validatePathCompatibility(pathA, pathB)).toEqual({ ok: true });
	});

	it('returns mismatch when command sequence differs', () => {
		const mismatch: Path = { cmds: ['M', 'C', 'Z'], crds: [0, 0, 3, 3, 5, 5, 9, 9] };
		expect(validatePathCompatibility(pathA, mismatch)).toEqual({
			ok: false,
			reason: 'Path commands must match exactly to interpolate'
		});
	});
});

describe('interpolatePath', () => {
	it('returns primary at t=0 and secondary at t=1', () => {
		expect(interpolatePath(pathA, pathB, 0)).toEqual(pathA);
		expect(interpolatePath(pathA, pathB, 1)).toEqual(pathB);
	});

	it('returns midpoint coordinates at t=0.5', () => {
		expect(interpolatePath(pathA, pathB, 0.5).crds).toEqual([0, 0, 15, 0, 15, 15]);
	});

	it('clamps t to [0,1]', () => {
		expect(interpolatePath(pathA, pathB, -4).crds).toEqual(pathA.crds);
		expect(interpolatePath(pathA, pathB, 5).crds).toEqual(pathB.crds);
	});

	it('throws PathMorphError when paths are incompatible', () => {
		const mismatch: Path = { cmds: ['M', 'C', 'Z'], crds: [0, 0, 3, 3, 5, 5, 9, 9] };
		expect(() => interpolatePath(pathA, mismatch, 0.5)).toThrow(PathMorphError);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- --run src/lib/geometry/path-morph.svelte.spec.ts`  
Expected: FAIL with module-not-found for `src/lib/geometry/path-morph.ts`

- [ ] **Step 3: Commit failing test**

```bash
git add src/lib/geometry/path-morph.svelte.spec.ts
git commit -m "test: add failing tests for path morph helpers"
```

### Task 2: Implement path morph helper

**Files:**
- Create: `src/lib/geometry/path-morph.ts`
- Test: `src/lib/geometry/path-morph.svelte.spec.ts`

- [ ] **Step 1: Implement compatibility + interpolation module**

```ts
import type { Path } from '$lib/types';

export class PathMorphError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PathMorphError';
	}
}

export type PathCompatibilityResult = { ok: true } | { ok: false; reason: string };

function clamp01(value: number): number {
	if (Number.isNaN(value)) return 0;
	return Math.max(0, Math.min(1, value));
}

export function validatePathCompatibility(primary: Path, secondary: Path): PathCompatibilityResult {
	if (primary.cmds.length !== secondary.cmds.length) {
		return { ok: false, reason: 'Path commands must match exactly to interpolate' };
	}
	for (let i = 0; i < primary.cmds.length; i++) {
		if (primary.cmds[i] !== secondary.cmds[i]) {
			return { ok: false, reason: 'Path commands must match exactly to interpolate' };
		}
	}
	if (primary.crds.length !== secondary.crds.length) {
		return { ok: false, reason: 'Path coordinates must have the same length to interpolate' };
	}
	return { ok: true };
}

export function interpolatePath(primary: Path, secondary: Path, t: number): Path {
	const compatibility = validatePathCompatibility(primary, secondary);
	if (!compatibility.ok) {
		throw new PathMorphError(compatibility.reason);
	}
	const clampedT = clamp01(t);
	return {
		cmds: [...primary.cmds],
		crds: primary.crds.map((a, i) => a + (secondary.crds[i] - a) * clampedT)
	};
}
```

- [ ] **Step 2: Run test to verify pass**

Run: `npm run test:unit -- --run src/lib/geometry/path-morph.svelte.spec.ts`  
Expected: PASS

- [ ] **Step 3: Commit implementation**

```bash
git add src/lib/geometry/path-morph.ts src/lib/geometry/path-morph.svelte.spec.ts
git commit -m "feat: add strict path compatibility and interpolation helper"
```

### Task 3: Extend ring types and add state-level morph mutations with tests

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/state/composition.svelte.spec.ts`
- Modify: `src/lib/state/composition.ts`
- Test: `src/lib/state/composition.svelte.spec.ts`

- [ ] **Step 1: Add failing state tests for morph lifecycle**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('rune-sync/localstorage', () => ({
	lsSync: (_key: string, initial: unknown) => structuredClone(initial)
}));

describe('composition morph mutations', () => {
	beforeEach(async () => {
		vi.resetModules();
	});

	it('creates and removes ring morph target', async () => {
		const state = await import('./composition');
		state.addRing();
		const before = state.composition.rings[0].templatePath;
		state.createRingMorphTarget(0);
		expect(state.composition.rings[0].secondaryTemplatePath).toEqual(before);
		state.removeRingMorphTarget(0);
		expect(state.composition.rings[0].secondaryTemplatePath).toBeNull();
	});

	it('clamps ring morph t', async () => {
		const state = await import('./composition');
		state.addRing();
		state.setRingMorphT(0, 4.2);
		expect(state.composition.rings[0].morphT).toBe(1);
		state.setRingMorphT(0, -1);
		expect(state.composition.rings[0].morphT).toBe(0);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- --run src/lib/state/composition.svelte.spec.ts`  
Expected: FAIL with missing exports (`createRingMorphTarget`, `removeRingMorphTarget`, `setRingMorphT`)

- [ ] **Step 3: Extend ring types for morph support**

```ts
export type Ring = {
	copies: number;
	color: string;
	templatePath: Path | null;
	secondaryTemplatePath: Path | null;
	morphT: number;
	ringHeight: number;
};
```

- [ ] **Step 4: Implement state mutators and defaults**

```ts
const DEFAULT_RING: Ring = {
	copies: 8,
	color: '#000000',
	templatePath: {
		cmds: ['M', 'C', 'C'],
		crds: [
			20, 117.61326806392421, 59, 117.50800490602947, 32.43817613081838, 82.72961144836285,
			61.688995215311024, 62.77907643368346, 83.43200751345759, 47.9492445945898, 101,
			66.54953384995142, 180, 67.38673193607579
		]
	},
	secondaryTemplatePath: null,
	morphT: 0,
	ringHeight: 0.12
};

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function setRingMorphT(index: number, t: number) {
	updateRing(index, { morphT: clamp01(t) });
}

export function createRingMorphTarget(index: number) {
	const ring = composition.rings[index];
	if (!ring?.templatePath) return;
	updateRing(index, {
		secondaryTemplatePath: {
			cmds: [...ring.templatePath.cmds],
			crds: [...ring.templatePath.crds]
		}
	});
}

export function removeRingMorphTarget(index: number) {
	updateRing(index, { secondaryTemplatePath: null, morphT: 0 });
}

export function updateRingPathVariant(index: number, variant: 'primary' | 'secondary', path: Ring['templatePath']) {
	if (variant === 'primary') {
		updateRing(index, { templatePath: path });
		return;
	}
	updateRing(index, { secondaryTemplatePath: path });
}
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npm run test:unit -- --run src/lib/state/composition.svelte.spec.ts`  
Expected: PASS

- [ ] **Step 6: Commit type + state changes**

```bash
git add src/lib/types.ts src/lib/state/composition.ts src/lib/state/composition.svelte.spec.ts
git commit -m "feat: add per-ring morph state and actions"
```

### Task 4: Integrate interpolation into render pipeline with fallback policy

**Files:**
- Modify: `src/lib/geometry/render-pipeline.ts`
- Modify: `src/lib/geometry/render-pipeline.svelte.spec.ts`
- Test: `src/lib/geometry/render-pipeline.svelte.spec.ts`

- [ ] **Step 1: Add failing render-pipeline tests for interpolation and fallback**

```ts
it('interpolates ring template path when secondary path exists', () => {
	const pipeline = createRenderPipeline();
	const morphComposition: Composition = {
		...composition,
		rings: [
			{
				...composition.rings[0],
				secondaryTemplatePath: {
					cmds: ['M', 'L', 'L', 'L', 'Z'],
					crds: [0, 0, 200, 0, 200, 100, 0, 100]
				},
				morphT: 0.5
			}
		]
	};

	const result = pipeline.render({
		composition: morphComposition,
		scope,
		viewport: { width: 600, height: 600, padding: 32 }
	});
	expect(result.renderedCount).toBe(1);
	expect(result.warnings).toEqual([]);
});

it('falls back to primary path when morph paths are incompatible', () => {
	const pipeline = createRenderPipeline();
	const invalidMorph: Composition = {
		...composition,
		rings: [
			{
				...composition.rings[0],
				secondaryTemplatePath: { cmds: ['M', 'C', 'Z'], crds: [0, 0, 10, 10, 20, 20, 30, 30] },
				morphT: 0.5
			}
		]
	};
	const result = pipeline.render({
		composition: invalidMorph,
		scope,
		viewport: { width: 600, height: 600, padding: 32 }
	});
	expect(result.renderedCount).toBe(1);
	expect(result.warnings.some((w) => w.includes('morph fallback'))).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- --run src/lib/geometry/render-pipeline.svelte.spec.ts`  
Expected: FAIL because pipeline does not yet read `secondaryTemplatePath`/`morphT`

- [ ] **Step 3: Implement interpolation/fallback in pipeline**

```ts
import { interpolatePath, validatePathCompatibility } from './path-morph';

// inside ring loop before buildRingPath:
const ring = composition.rings[i];
const effectiveRing = { ...ring };

if (ring.templatePath && ring.secondaryTemplatePath) {
	const compatibility = validatePathCompatibility(ring.templatePath, ring.secondaryTemplatePath);
	if (compatibility.ok) {
		effectiveRing.templatePath = interpolatePath(
			ring.templatePath,
			ring.secondaryTemplatePath,
			ring.morphT ?? 0
		);
	} else {
		warnings.push(`Ring ${i} morph fallback: ${compatibility.reason}`);
		effectiveRing.templatePath = ring.templatePath;
	}
}

const ringPath = buildRingPath(effectiveRing, radius, scope);
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm run test:unit -- --run src/lib/geometry/path-morph.svelte.spec.ts src/lib/geometry/render-pipeline.svelte.spec.ts`  
Expected: PASS

- [ ] **Step 5: Commit render integration**

```bash
git add src/lib/geometry/render-pipeline.ts src/lib/geometry/render-pipeline.svelte.spec.ts
git commit -m "feat: interpolate ring paths in render pipeline with strict fallback"
```

### Task 5: Add ring editor controls for morph target and variant editing

**Files:**
- Modify: `src/lib/components/RingEditor.svelte`
- Modify: `src/lib/components/RingCanvas.svelte`
- Test: `npm run check`

- [ ] **Step 1: Add UI controls and wiring in `RingEditor`**

```svelte
<script lang="ts">
	import {
		updateRing,
		removeRing,
		setRingExpanded,
		isRingExpanded,
		colorMode,
		createRingMorphTarget,
		removeRingMorphTarget,
		setRingMorphT,
		updateRingPathVariant
	} from '$lib/state/composition';

	let editVariant = $state<'primary' | 'secondary'>('primary');
</script>

{#if ring.secondaryTemplatePath}
	<div class="flex items-center justify-between gap-2">
		<Label class="text-xs">Edit path</Label>
		<div class="flex gap-1">
			<Button size="sm" variant={editVariant === 'primary' ? 'default' : 'outline'} onclick={() => (editVariant = 'primary')}>Primary</Button>
			<Button size="sm" variant={editVariant === 'secondary' ? 'default' : 'outline'} onclick={() => (editVariant = 'secondary')}>Secondary</Button>
		</div>
	</div>
{/if}

<RingCanvas
	templatePath={editVariant === 'secondary' ? ring.secondaryTemplatePath : ring.templatePath}
	label={editVariant === 'secondary' ? 'Secondary path' : 'Primary path'}
	onchange={(newPath) => updateRingPathVariant(index, editVariant, newPath)}
/>

{#if !ring.secondaryTemplatePath}
	<Button variant="outline" size="sm" onclick={() => createRingMorphTarget(index)}>
		Create morph target
	</Button>
{:else}
	<div class="space-y-2">
		<Button variant="outline" size="sm" onclick={() => removeRingMorphTarget(index)}>Remove morph target</Button>
		<Label class="text-xs">Morph t <span class="text-muted-foreground">{(ring.morphT ?? 0).toFixed(2)}</span></Label>
		<Slider min={0} max={1} step={0.01} value={ring.morphT ?? 0} onValueChange={(v) => setRingMorphT(index, v)} />
	</div>
{/if}
```

- [ ] **Step 2: Add optional `label` prop to `RingCanvas`**

```svelte
<script lang="ts">
	let {
		templatePath,
		onchange,
		label = 'Path editor'
	}: {
		templatePath: Path | null;
		onchange?: (path: Path) => void;
		label?: string;
	} = $props();
</script>

<div class="w-full aspect-square ...">
	<span class="absolute left-2 top-2 text-[10px] text-muted-foreground">{label}</span>
	{#if !templatePath}
		<span class="text-xs text-muted-foreground absolute">Upload an SVG to preview</span>
	{/if}
	<canvas {@attach setupCanvas} width="200" height="200"></canvas>
</div>
```

- [ ] **Step 3: Run type and Svelte checks**

Run: `npm run check`  
Expected: PASS

- [ ] **Step 4: Commit editor updates**

```bash
git add src/lib/components/RingEditor.svelte src/lib/components/RingCanvas.svelte
git commit -m "feat: add per-ring morph controls and path variant editing"
```

### Task 6: Add e2e regression coverage for morph controls

**Files:**
- Modify: `src/routes/demo/playwright/page.svelte.e2e.ts`
- Test: `src/routes/demo/playwright/page.svelte.e2e.ts`

- [ ] **Step 1: Add failing e2e test for morph control lifecycle**

```ts
import { expect, test } from '@playwright/test';

test('ring morph controls appear after creating morph target', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: /add ring/i }).click();
	await page.getByRole('button', { name: /create morph target/i }).click();
	await expect(page.getByText('Morph t')).toBeVisible();
	await page.getByRole('button', { name: /remove morph target/i }).click();
	await expect(page.getByText('Morph t')).toHaveCount(0);
});
```

- [ ] **Step 2: Run e2e test to verify it fails first**

Run: `npm run test:e2e -- src/routes/demo/playwright/page.svelte.e2e.ts`  
Expected: FAIL (selectors not found until UI wiring is complete in prior task or button labels differ)

- [ ] **Step 3: Adjust selectors/labels to match final UI and make test pass**

```ts
await page.getByRole('button', { name: 'Create morph target' }).click();
await expect(page.getByText(/^Morph t/)).toBeVisible();
await page.getByRole('button', { name: 'Remove morph target' }).click();
await expect(page.getByText(/^Morph t/)).toHaveCount(0);
```

- [ ] **Step 4: Run e2e test to verify pass**

Run: `npm run test:e2e -- src/routes/demo/playwright/page.svelte.e2e.ts`  
Expected: PASS

- [ ] **Step 5: Commit e2e coverage**

```bash
git add src/routes/demo/playwright/page.svelte.e2e.ts
git commit -m "test: add morph control e2e regression coverage"
```

### Task 7: Final verification and docs sync

**Files:**
- Modify: `docs/superpowers/specs/2026-04-25-ring-dual-path-interpolation-design.md` (only if implementation diverges)
- Test: repository checks

- [ ] **Step 1: Run focused unit suite**

Run: `npm run test:unit -- --run src/lib/geometry/path-morph.svelte.spec.ts src/lib/state/composition.svelte.spec.ts src/lib/geometry/render-pipeline.svelte.spec.ts`  
Expected: PASS

- [ ] **Step 2: Run full quality gates**

Run: `npm run check && npm run lint && npm run test:unit -- --run`  
Expected: PASS

- [ ] **Step 3: Update design doc only if implementation changed behavior**

```md
## 9) Testing Strategy
- Added Playwright-based morph control visibility regression in place of component-level render tests.
```

- [ ] **Step 4: Commit verification/docs updates**

```bash
git add src/lib/types.ts src/lib/state/composition.ts src/lib/state/composition.svelte.spec.ts src/lib/geometry/path-morph.ts src/lib/geometry/path-morph.svelte.spec.ts src/lib/geometry/render-pipeline.ts src/lib/geometry/render-pipeline.svelte.spec.ts src/lib/components/RingEditor.svelte src/lib/components/RingCanvas.svelte src/routes/demo/playwright/page.svelte.e2e.ts docs/superpowers/specs/2026-04-25-ring-dual-path-interpolation-design.md
git commit -m "chore: verify dual-path morph feature and align docs"
```
