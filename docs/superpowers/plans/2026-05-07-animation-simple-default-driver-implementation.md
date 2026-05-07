# Animation Simple Default Driver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class `simple` animation driver and make it the default mode while preserving the single-active-driver runtime architecture.

**Architecture:** Extend the existing driver contracts to include `simple`, implement `simple-driver.ts` as a runtime-only time cursor producer, and register it in `animation.svelte.ts` with default mode set to `simple`. Keep `None` as explicit no-driver mode and preserve composition as the render source of truth via `setRingMorphT`.

**Tech Stack:** TypeScript, Svelte 5 runes state, Vitest, vitest-browser.

---

## Scope check

This spec covers one subsystem (animation runtime mode extension with a new built-in driver), so one implementation plan is appropriate.

## File structure and responsibilities

**Create**
- `src/lib/state/animation-drivers/simple-driver.ts` - fixed, looping `t` progression driver that emits one value per ring index.
- `src/lib/state/animation-drivers/simple-driver.spec.ts` - unit tests for bounded, monotonic/wrapping frame output and per-ring emission.

**Modify**
- `src/lib/state/animation-drivers/types.ts` - add `simple` to driver type union.
- `src/lib/state/animation.svelte.ts` - set default mode to `simple`, register simple driver, and keep existing playback/tick semantics.
- `src/lib/state/animation.svelte.spec.ts` - verify default `simple` mode and runtime integration behavior.
- `src/lib/components/AnimationSection.svelte` - expose `Simple` option in mode selector.
- `src/lib/components/AnimationSection.svelte.spec.ts` - update mocked mode type and selector assertions for `simple`.

---

### Task 1: Extend Driver Type Contracts for `simple`

**Files:**
- Modify: `src/lib/state/animation-drivers/types.ts`
- Modify: `src/lib/state/animation.svelte.spec.ts`

- [ ] **Step 1: Write the failing test for default mode expectation**

```ts
// src/lib/state/animation.svelte.spec.ts (add near existing mode tests)
it('defaults to simple mode at startup', async () => {
	const animation = await import('./animation');
	expect(animation.animationState.mode).toBe('simple');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun vitest run "src/lib/state/animation.svelte.spec.ts" -t "defaults to simple mode at startup"`  
Expected: FAIL because mode is currently `null`.

- [ ] **Step 3: Add `simple` to animation driver type union**

```ts
// src/lib/state/animation-drivers/types.ts
export type AnimationDriverType = 'simple' | 'audioBars' | 'dataSeries';
```

- [ ] **Step 4: Run test to verify it still fails only on default value**

Run: `bun vitest run "src/lib/state/animation.svelte.spec.ts" -t "defaults to simple mode at startup"`  
Expected: FAIL with expected `'simple'` but received `null`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/animation-drivers/types.ts src/lib/state/animation.svelte.spec.ts
git commit -m "refactor: extend animation driver union with simple mode"
```

---

### Task 2: Implement `simple` Driver with Fixed Time Progression

**Files:**
- Create: `src/lib/state/animation-drivers/simple-driver.ts`
- Create: `src/lib/state/animation-drivers/simple-driver.spec.ts`

- [ ] **Step 1: Write failing unit tests for `simple` driver frame behavior**

```ts
// src/lib/state/animation-drivers/simple-driver.spec.ts
import { describe, expect, it } from 'vitest';
import { createSimpleDriver } from './simple-driver';

describe('createSimpleDriver', () => {
	it('emits one bounded t value per ring index', () => {
		const driver = createSimpleDriver({
			getRingCount: () => 3,
			getDurationSec: () => 2
		});
		driver.init();
		const frame = driver.frame(1000);

		expect(Object.keys(frame)).toEqual(['0', '1', '2']);
		expect(frame[0]).toBeGreaterThanOrEqual(0);
		expect(frame[0]).toBeLessThanOrEqual(1);
		expect(frame[1]).toBe(frame[0]);
		expect(frame[2]).toBe(frame[0]);
	});

	it('wraps progress when elapsed exceeds duration', () => {
		const driver = createSimpleDriver({
			getRingCount: () => 1,
			getDurationSec: () => 1
		});
		driver.init();
		driver.frame(0);
		const frame = driver.frame(1500);
		expect(frame[0]).toBeCloseTo(0.5, 5);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun vitest run "src/lib/state/animation-drivers/simple-driver.spec.ts"`  
Expected: FAIL because `createSimpleDriver` does not exist.

- [ ] **Step 3: Implement minimal simple driver**

```ts
// src/lib/state/animation-drivers/simple-driver.ts
function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function createSimpleDriver(deps: { getRingCount: () => number; getDurationSec: () => number }) {
	let startedAtMs: number | null = null;

	return {
		init() {
			startedAtMs = null;
		},
		dispose() {
			startedAtMs = null;
		},
		frame(nowMs: number): Record<number, number> {
			if (startedAtMs === null) startedAtMs = nowMs;
			const elapsedMs = Math.max(0, nowMs - startedAtMs);
			const durationMs = Math.max(100, deps.getDurationSec() * 1000);
			const progress = clamp01((elapsedMs / durationMs) % 1);
			const ringCount = Math.max(0, deps.getRingCount());
			const out: Record<number, number> = {};
			for (let i = 0; i < ringCount; i += 1) out[i] = progress;
			return out;
		}
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun vitest run "src/lib/state/animation-drivers/simple-driver.spec.ts"`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/animation-drivers/simple-driver.ts src/lib/state/animation-drivers/simple-driver.spec.ts
git commit -m "feat: add simple animation driver with looping time progression"
```

---

### Task 3: Integrate `simple` Driver and Set Default Mode

**Files:**
- Modify: `src/lib/state/animation.svelte.ts`
- Modify: `src/lib/state/animation.svelte.spec.ts`

- [ ] **Step 1: Write failing integration assertions**

```ts
// src/lib/state/animation.svelte.spec.ts (add to runtime integration describe)
it('applies simple driver values when playing in default mode', async () => {
	const animation = await import('./animation');
	const { setRingMorphT } = await import('./composition');

	animation.togglePlay();
	flushNextAnimationFrame(0);
	flushNextAnimationFrame(600);

	expect(animation.animationState.mode).toBe('simple');
	expect(setRingMorphT).toHaveBeenCalledWith(0, expect.any(Number));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun vitest run "src/lib/state/animation.svelte.spec.ts" -t "applies simple driver values when playing in default mode"`  
Expected: FAIL because default mode is `null` and no simple driver is registered.

- [ ] **Step 3: Wire `simple` driver into controller runtime**

```ts
// src/lib/state/animation.svelte.ts (imports)
import { createSimpleDriver } from './animation-drivers/simple-driver';
```

```ts
// src/lib/state/animation.svelte.ts (default state)
export const animationState = $state<AnimationState>({
	mode: 'simple',
	isPlaying: false,
	isPaused: false,
	progress: 0,
	audioBars: defaultAudioBarsConfig,
	dataSeries: defaultDataSeriesConfig,
	durationSec: 3,
	loop: false,
	alternate: false
});
```

```ts
// src/lib/state/animation.svelte.ts (runtime registration, before audio/data drivers)
runtime.registerDriver(
	'simple',
	createSimpleDriver({
		getRingCount: () => composition.rings.length,
		getDurationSec: () => animationState.durationSec
	})
);
```

- [ ] **Step 4: Run targeted tests**

Run: `bun vitest run "src/lib/state/animation.svelte.spec.ts" -t "defaults to simple mode at startup|applies simple driver values when playing in default mode"`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/animation.svelte.ts src/lib/state/animation.svelte.spec.ts
git commit -m "feat: make simple driver default animation runtime mode"
```

---

### Task 4: Update Animation UI Selector for `Simple` Default

**Files:**
- Modify: `src/lib/components/AnimationSection.svelte`
- Modify: `src/lib/components/AnimationSection.svelte.spec.ts`

- [ ] **Step 1: Write failing UI tests for simple option/default selection**

```ts
// src/lib/components/AnimationSection.svelte.spec.ts
it('shows Simple mode option and selects it when mode is simple', async () => {
	animationApi.animationState.mode = 'simple';
	render(AnimationSection);

	await expect.element(page.getByRole('option', { name: 'Simple' })).toBeInTheDocument();
	const select = page.getByLabelText('Animation mode');
	await expect.element(select).toHaveValue('simple');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun vitest run "src/lib/components/AnimationSection.svelte.spec.ts" -t "shows Simple mode option and selects it when mode is simple"`  
Expected: FAIL because `simple` is not in the mocked mode union or UI options.

- [ ] **Step 3: Implement selector changes and mock type updates**

```ts
// src/lib/components/AnimationSection.svelte.spec.ts (mode type mock)
mode: 'simple' as 'simple' | 'audioBars' | 'dataSeries' | null,
```

```svelte
<!-- src/lib/components/AnimationSection.svelte -->
<select
	id="animation-mode"
	class="h-9 rounded-md border border-input bg-background px-3 text-xs"
	value={animationState.mode ?? ''}
	onchange={(e) => {
		const mode = (e.target as HTMLSelectElement).value;
		setAnimationMode(mode === '' ? null : (mode as 'simple' | 'audioBars' | 'dataSeries'));
	}}
>
	<option value="simple">Simple</option>
	<option value="audioBars">Audio Bars</option>
	<option value="dataSeries">Data Series</option>
	<option value="">None</option>
</select>
```

- [ ] **Step 4: Run UI spec**

Run: `bun vitest run "src/lib/components/AnimationSection.svelte.spec.ts"`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/AnimationSection.svelte src/lib/components/AnimationSection.svelte.spec.ts
git commit -m "feat: expose simple as default animation mode in UI"
```

---

### Task 5: Full Animation Regression Verification

**Files:**
- Test: `src/lib/state/animation-drivers/*.spec.ts`
- Test: `src/lib/state/animation.svelte.spec.ts`
- Test: `src/lib/components/AnimationSection.svelte.spec.ts`

- [ ] **Step 1: Run focused animation test suite**

Run: `bun vitest run "src/lib/state/animation-drivers/*.spec.ts" "src/lib/state/animation.svelte.spec.ts" "src/lib/components/AnimationSection.svelte.spec.ts"`  
Expected: PASS.

- [ ] **Step 2: Run lint and unit tests**

Run: `bun run lint && bun run test:unit`  
Expected: PASS with no new lint/type/test regressions.

- [ ] **Step 3: Commit verification checkpoint**

```bash
git add src/lib/state/animation-drivers src/lib/state/animation.svelte.ts src/lib/state/animation.svelte.spec.ts src/lib/components/AnimationSection.svelte src/lib/components/AnimationSection.svelte.spec.ts
git commit -m "test: verify simple default driver integration across runtime and UI"
```

---

## Self-review checklist (completed)

### 1) Spec coverage

- First-class `simple` driver mode: covered by Tasks 1-3.
- `simple` as default mode: covered by Tasks 1 and 3.
- `None` preserved as explicit no-driver mode: covered by Task 4 selector ordering/value mapping.
- Runtime architecture preservation: covered by Task 3 registration model.
- UI update and regression safety: covered by Tasks 4-5.

### 2) Placeholder scan

No `TBD`, `TODO`, "implement later", or generic placeholder steps are present.

### 3) Type consistency

Plan uses consistent mode union and API names:
- `AnimationDriverType`: `'simple' | 'audioBars' | 'dataSeries'`
- `AnimationMode`: above union plus `null`
- `setAnimationMode`, `createSimpleDriver`, `animationState.mode` names remain consistent in all tasks.

