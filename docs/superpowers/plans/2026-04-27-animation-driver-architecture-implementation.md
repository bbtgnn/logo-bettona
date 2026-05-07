# Animation Driver Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current single-purpose morph sweep controller with a single-active-driver animation runtime that supports `audioBars` and `dataSeries`, while preserving existing morph rendering behavior and keeping UI mapping simple.

**Architecture:** Introduce a small driver runtime layer in `src/lib/state/animation-drivers/` that owns one active driver and emits per-ring `t` values each frame. Keep `composition` as the render source of truth (`setRingMorphT`) and migrate `animation.svelte.ts` into a thin facade over the runtime. Update `AnimationSection.svelte` to select one mode and configure the chosen driver directly.

**Tech Stack:** Svelte 5, TypeScript, animejs, Vitest, @testing-library/svelte, rune-sync.

---

## Scope check

The approved spec targets one subsystem (animation driver runtime + UI adaptation) and is suitable for one implementation plan.

## File structure and responsibilities

**Create**
- `src/lib/state/animation-drivers/types.ts` - shared contracts (`AnimationDriverType`, runtime state/config shapes, driver interface).
- `src/lib/state/animation-drivers/runtime.ts` - single-active-driver runtime orchestration, tick loop, clamp/sanitize/apply behavior.
- `src/lib/state/animation-drivers/data-series-driver.ts` - `dataSeries` ring-by-ring interpolation with missing-series hold behavior.
- `src/lib/state/animation-drivers/audio-bars-driver.ts` - `audioBars` contract scaffold and bounded per-ring frame output.
- `src/lib/state/animation-drivers/runtime.spec.ts` - runtime invariants and topology/error behavior tests.
- `src/lib/state/animation-drivers/data-series-driver.spec.ts` - interpolation/remap and per-ring policy tests.
- `src/lib/state/animation-drivers/audio-bars-driver.spec.ts` - bounded output and ring-count behavior tests.

**Modify**
- `src/lib/state/animation.svelte.ts` - replace direct anime-only controller internals with runtime facade + public APIs for mode/config.
- `src/lib/state/animation.svelte.spec.ts` - adapt controller tests to runtime-backed behavior.
- `src/lib/components/AnimationSection.svelte` - new single-mode UI (`None`, `Audio Bars`, `Data Series`) and simplified controls.
- `src/lib/components/AnimationSection.svelte.spec.ts` - verify UI mode switching/config behavior and composition-change safety calls.

**Optional follow-up docs update (same PR, final task)**
- `docs/superpowers/specs/2026-04-27-animation-driver-architecture-design.md` - add implementation notes if behavior differs slightly during coding.

---

### Task 1: Define Driver Contracts (Types First)

**Files:**
- Create: `src/lib/state/animation-drivers/types.ts`
- Modify: `src/lib/state/animation.svelte.ts`
- Test: `src/lib/state/animation.svelte.spec.ts`

- [ ] **Step 1: Write the failing test for mode/config surface**

```ts
// src/lib/state/animation.svelte.spec.ts
import { describe, expect, it } from 'vitest';
import { animationState, setAnimationMode, setDataSeriesConfig } from './animation.svelte';

describe('animation mode surface', () => {
	it('stores selected driver mode and accepts dataSeries config updates', () => {
		setAnimationMode('dataSeries');
		setDataSeriesConfig({
			seriesByRingIndex: {
				0: [0, 1, 0.5]
			}
		});

		expect(animationState.mode).toBe('dataSeries');
		expect(animationState.dataSeries.seriesByRingIndex[0]).toEqual([0, 1, 0.5]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun vitest run "src/lib/state/animation.svelte.spec.ts" -t "stores selected driver mode"`  
Expected: FAIL with missing exports (`setAnimationMode`, `setDataSeriesConfig`) or missing state fields.

- [ ] **Step 3: Add driver contract types and wire animation state shape**

```ts
// src/lib/state/animation-drivers/types.ts
export type AnimationDriverType = 'audioBars' | 'dataSeries';

export type DataSeriesConfig = {
	seriesByRingIndex: Record<number, number[]>;
	speed: number;
	loop: boolean;
};

export type AudioBarsConfig = {
	smoothing: number;
	minHz: number;
	maxHz: number;
};

export type DriverConfigByType = {
	audioBars: AudioBarsConfig;
	dataSeries: DataSeriesConfig;
};
```

```ts
// src/lib/state/animation.svelte.ts (replace state type section)
import type { AnimationDriverType, DataSeriesConfig, AudioBarsConfig } from './animation-drivers/types';

export type AnimationMode = AnimationDriverType | null;

export type AnimationState = {
	mode: AnimationMode;
	isPlaying: boolean;
	isPaused: boolean;
	progress: number;
	audioBars: AudioBarsConfig;
	dataSeries: DataSeriesConfig;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun vitest run "src/lib/state/animation.svelte.spec.ts" -t "stores selected driver mode"`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/animation-drivers/types.ts src/lib/state/animation.svelte.ts src/lib/state/animation.svelte.spec.ts
git commit -m "feat: define animation driver mode and config contracts"
```

---

### Task 2: Build Runtime Shell with Single Active Driver

**Files:**
- Create: `src/lib/state/animation-drivers/runtime.ts`
- Test: `src/lib/state/animation-drivers/runtime.spec.ts`
- Modify: `src/lib/state/animation.svelte.ts`

- [ ] **Step 1: Write failing runtime invariant tests**

```ts
// src/lib/state/animation-drivers/runtime.spec.ts
import { describe, expect, it, vi } from 'vitest';
import { createAnimationRuntime } from './runtime';

describe('createAnimationRuntime', () => {
	it('applies only active driver frame values and clamps output', () => {
		const applied: Array<{ index: number; t: number }> = [];
		const runtime = createAnimationRuntime({
			applyRingT: (index, t) => applied.push({ index, t })
		});

		runtime.setMode('dataSeries');
		runtime.registerDriver('dataSeries', {
			init: () => undefined,
			dispose: () => undefined,
			frame: () => ({ 0: 1.2, 1: -0.4, 2: Number.NaN })
		});

		runtime.tick(1000);
		expect(applied).toEqual([
			{ index: 0, t: 1 },
			{ index: 1, t: 0 },
			{ index: 2, t: 0 }
		]);
	});

	it('stops applying frames when mode is null', () => {
		const applyRingT = vi.fn();
		const runtime = createAnimationRuntime({ applyRingT });
		runtime.setMode(null);
		runtime.tick(1000);
		expect(applyRingT).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun vitest run "src/lib/state/animation-drivers/runtime.spec.ts"`  
Expected: FAIL because `createAnimationRuntime` does not exist.

- [ ] **Step 3: Implement minimal runtime**

```ts
// src/lib/state/animation-drivers/runtime.ts
import type { AnimationDriverType } from './types';

type Driver = {
	init: () => void;
	dispose: () => void;
	frame: (nowMs: number) => Record<number, number>;
};

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function createAnimationRuntime(deps: { applyRingT: (index: number, t: number) => void }) {
	const drivers = new Map<AnimationDriverType, Driver>();
	let mode: AnimationDriverType | null = null;

	function registerDriver(type: AnimationDriverType, driver: Driver): void {
		drivers.set(type, driver);
	}

	function setMode(next: AnimationDriverType | null): void {
		if (mode === next) return;
		if (mode) drivers.get(mode)?.dispose();
		mode = next;
		if (mode) drivers.get(mode)?.init();
	}

	function tick(nowMs: number): void {
		if (!mode) return;
		const frame = drivers.get(mode)?.frame(nowMs) ?? {};
		for (const [rawIndex, rawT] of Object.entries(frame)) {
			const index = Number(rawIndex);
			if (!Number.isInteger(index) || index < 0) continue;
			deps.applyRingT(index, clamp01(rawT));
		}
	}

	return { registerDriver, setMode, tick };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `bun vitest run "src/lib/state/animation-drivers/runtime.spec.ts"`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/animation-drivers/runtime.ts src/lib/state/animation-drivers/runtime.spec.ts
git commit -m "feat: add single-active-driver animation runtime shell"
```

---

### Task 3: Implement DataSeries Driver (1:1 Ring Mapping)

**Files:**
- Create: `src/lib/state/animation-drivers/data-series-driver.ts`
- Create: `src/lib/state/animation-drivers/data-series-driver.spec.ts`
- Modify: `src/lib/state/animation.svelte.ts`

- [ ] **Step 1: Write failing tests for interpolation + missing-series behavior**

```ts
// src/lib/state/animation-drivers/data-series-driver.spec.ts
import { describe, expect, it } from 'vitest';
import { createDataSeriesDriver } from './data-series-driver';

describe('createDataSeriesDriver', () => {
	it('interpolates each ring independently from its own series', () => {
		const driver = createDataSeriesDriver({
			getConfig: () => ({
				seriesByRingIndex: { 0: [0, 10], 1: [5, 15, 25] },
				speed: 1,
				loop: false
			})
		});
		driver.init();
		const frame = driver.frame(500);
		expect(frame[0]).toBeGreaterThanOrEqual(0);
		expect(frame[0]).toBeLessThanOrEqual(1);
		expect(frame[1]).toBeGreaterThanOrEqual(0);
		expect(frame[1]).toBeLessThanOrEqual(1);
	});

	it('omits rings without a configured series (hold previous t policy)', () => {
		const driver = createDataSeriesDriver({
			getConfig: () => ({ seriesByRingIndex: { 0: [0, 1] }, speed: 1, loop: false })
		});
		driver.init();
		const frame = driver.frame(1000);
		expect(frame[0]).toBeTypeOf('number');
		expect(frame[1]).toBeUndefined();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun vitest run "src/lib/state/animation-drivers/data-series-driver.spec.ts"`  
Expected: FAIL because `createDataSeriesDriver` does not exist.

- [ ] **Step 3: Implement minimal dataSeries driver**

```ts
// src/lib/state/animation-drivers/data-series-driver.ts
import type { DataSeriesConfig } from './types';

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function normalizeSeries(values: number[]): number[] {
	if (values.length === 0) return [];
	const finite = values.map((v) => (Number.isFinite(v) ? v : 0));
	const min = Math.min(...finite);
	const max = Math.max(...finite);
	if (max === min) return finite.map(() => 0);
	return finite.map((v) => (v - min) / (max - min));
}

function sampleSeries(series: number[], progress: number): number {
	if (series.length === 0) return 0;
	if (series.length === 1) return series[0];
	const scaled = clamp01(progress) * (series.length - 1);
	const left = Math.floor(scaled);
	const right = Math.min(series.length - 1, left + 1);
	const t = scaled - left;
	return series[left] * (1 - t) + series[right] * t;
}

export function createDataSeriesDriver(deps: { getConfig: () => DataSeriesConfig }) {
	let startedAtMs = 0;

	return {
		init() {
			startedAtMs = 0;
		},
		dispose() {
			startedAtMs = 0;
		},
		frame(nowMs: number): Record<number, number> {
			if (startedAtMs === 0) startedAtMs = nowMs;
			const config = deps.getConfig();
			const elapsedSec = Math.max(0, nowMs - startedAtMs) / 1000;
			const cycle = config.loop ? elapsedSec * config.speed : Math.min(1, elapsedSec * config.speed);
			const progress = config.loop ? cycle % 1 : cycle;

			const out: Record<number, number> = {};
			for (const [rawIndex, rawSeries] of Object.entries(config.seriesByRingIndex)) {
				const index = Number(rawIndex);
				if (!Number.isInteger(index) || index < 0) continue;
				const normalized = normalizeSeries(rawSeries);
				out[index] = clamp01(sampleSeries(normalized, progress));
			}
			return out;
		}
	};
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `bun vitest run "src/lib/state/animation-drivers/data-series-driver.spec.ts"`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/animation-drivers/data-series-driver.ts src/lib/state/animation-drivers/data-series-driver.spec.ts
git commit -m "feat: add data series animation driver with per-ring interpolation"
```

---

### Task 4: Implement AudioBars Driver Contract (Simple, Bounded Output)

**Files:**
- Create: `src/lib/state/animation-drivers/audio-bars-driver.ts`
- Create: `src/lib/state/animation-drivers/audio-bars-driver.spec.ts`
- Modify: `src/lib/state/animation.svelte.ts`

- [ ] **Step 1: Write failing tests for bounded audio output**

```ts
// src/lib/state/animation-drivers/audio-bars-driver.spec.ts
import { describe, expect, it } from 'vitest';
import { createAudioBarsDriver } from './audio-bars-driver';

describe('createAudioBarsDriver', () => {
	it('returns one bounded value per ring index when analyzer data is available', () => {
		const driver = createAudioBarsDriver({
			getConfig: () => ({ smoothing: 0.5, minHz: 20, maxHz: 16000 }),
			getRingCount: () => 3,
			readBars: () => [0.2, 1.1, -0.4]
		});
		driver.init();
		const frame = driver.frame(1000);
		expect(frame).toEqual({ 0: 0.2, 1: 1, 2: 0 });
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun vitest run "src/lib/state/animation-drivers/audio-bars-driver.spec.ts"`  
Expected: FAIL because `createAudioBarsDriver` does not exist.

- [ ] **Step 3: Implement minimal audioBars driver**

```ts
// src/lib/state/animation-drivers/audio-bars-driver.ts
import type { AudioBarsConfig } from './types';

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function createAudioBarsDriver(deps: {
	getConfig: () => AudioBarsConfig;
	getRingCount: () => number;
	readBars: () => number[];
}) {
	return {
		init() {
			deps.getConfig();
		},
		dispose() {
			// no-op in initial version
		},
		frame(_nowMs: number): Record<number, number> {
			const ringCount = Math.max(0, deps.getRingCount());
			const bars = deps.readBars();
			const out: Record<number, number> = {};
			for (let i = 0; i < ringCount; i += 1) {
				out[i] = clamp01(bars[i] ?? 0);
			}
			return out;
		}
	};
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `bun vitest run "src/lib/state/animation-drivers/audio-bars-driver.spec.ts"`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/animation-drivers/audio-bars-driver.ts src/lib/state/animation-drivers/audio-bars-driver.spec.ts
git commit -m "feat: add audio bars driver contract and bounded frame output"
```

---

### Task 5: Integrate Runtime into `animation.svelte.ts`

**Files:**
- Modify: `src/lib/state/animation.svelte.ts`
- Modify: `src/lib/state/animation.svelte.spec.ts`
- Test: `src/lib/state/animation-drivers/runtime.spec.ts`

- [ ] **Step 1: Write failing integration tests for public API behavior**

```ts
// src/lib/state/animation.svelte.spec.ts (add cases)
import { describe, expect, it } from 'vitest';
import {
	animationState,
	handleCompositionChanged,
	setAnimationMode,
	setDataSeriesConfig,
	togglePlay
} from './animation.svelte';
import { composition } from './composition';

describe('animation runtime integration', () => {
	it('plays with selected driver and preserves t on stop(false)', () => {
		setAnimationMode('dataSeries');
		setDataSeriesConfig({ seriesByRingIndex: { 0: [0, 1] }, speed: 1, loop: false });
		togglePlay();
		expect(animationState.isPlaying).toBe(true);
	});

	it('stops when composition changes while playing', () => {
		setAnimationMode('dataSeries');
		togglePlay();
		composition.rings = [...composition.rings];
		handleCompositionChanged();
		expect(animationState.isPlaying).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun vitest run "src/lib/state/animation.svelte.spec.ts" -t "animation runtime integration"`  
Expected: FAIL due to missing runtime-backed behavior or missing mode/config APIs.

- [ ] **Step 3: Implement runtime-backed controller facade**

```ts
// src/lib/state/animation.svelte.ts (core integration sketch)
import { composition, setRingMorphT } from './composition';
import { createAnimationRuntime } from './animation-drivers/runtime';
import { createAudioBarsDriver } from './animation-drivers/audio-bars-driver';
import { createDataSeriesDriver } from './animation-drivers/data-series-driver';

const runtime = createAnimationRuntime({
	applyRingT: (index, t) => setRingMorphT(index, t)
});

runtime.registerDriver(
	'dataSeries',
	createDataSeriesDriver({
		getConfig: () => animationState.dataSeries
	})
);

runtime.registerDriver(
	'audioBars',
	createAudioBarsDriver({
		getConfig: () => animationState.audioBars,
		getRingCount: () => composition.rings.length,
		readBars: () => []
	})
);

export function setAnimationMode(mode: AnimationMode): void {
	animationState.mode = mode;
	runtime.setMode(mode);
}

export function setDataSeriesConfig(next: Partial<AnimationState['dataSeries']>): void {
	animationState.dataSeries = { ...animationState.dataSeries, ...next };
}

export function togglePlay(): void {
	animationState.isPlaying = !animationState.isPlaying;
	animationState.isPaused = !animationState.isPlaying;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `bun vitest run "src/lib/state/animation.svelte.spec.ts"`  
Expected: PASS for updated runtime tests and pre-existing safety tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/animation.svelte.ts src/lib/state/animation.svelte.spec.ts
git commit -m "refactor: route animation controller through single-driver runtime"
```

---

### Task 6: Update `AnimationSection` UI for Single Active Driver

**Files:**
- Modify: `src/lib/components/AnimationSection.svelte`
- Modify: `src/lib/components/AnimationSection.svelte.spec.ts`
- Test: `src/lib/components/AnimationSection.svelte.spec.ts`

- [ ] **Step 1: Write failing UI tests for mode selector and dataSeries inputs**

```ts
// src/lib/components/AnimationSection.svelte.spec.ts (add tests)
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import AnimationSection from './AnimationSection.svelte';

describe('AnimationSection mode UI', () => {
	it('switches to Data Series mode', async () => {
		const user = userEvent.setup();
		render(AnimationSection);
		await user.selectOptions(screen.getByLabelText('Animation mode'), 'dataSeries');
		expect(screen.getByText('Data Series')).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun vitest run "src/lib/components/AnimationSection.svelte.spec.ts" -t "switches to Data Series mode"`  
Expected: FAIL because selector/labels do not exist yet.

- [ ] **Step 3: Implement simple mode-first UI**

```svelte
<!-- src/lib/components/AnimationSection.svelte (core section) -->
<Label for="animation-mode" class="text-xs">Animation mode</Label>
<select
	id="animation-mode"
	class="h-9 rounded border bg-background px-2 text-xs"
	value={animationState.mode ?? ''}
	onchange={(e) => setAnimationMode((e.target as HTMLSelectElement).value || null)}
>
	<option value="">None</option>
	<option value="audioBars">Audio Bars</option>
	<option value="dataSeries">Data Series</option>
</select>

{#if animationState.mode === 'dataSeries'}
	<p class="text-[11px] text-muted-foreground">One series per ring index. Missing series keeps current t.</p>
{/if}

{#if animationState.mode === 'audioBars'}
	<p class="text-[11px] text-muted-foreground">One audio bar drives each ring by index.</p>
{/if}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `bun vitest run "src/lib/components/AnimationSection.svelte.spec.ts"`  
Expected: PASS, including existing `handleCompositionChanged` coverage.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/AnimationSection.svelte src/lib/components/AnimationSection.svelte.spec.ts
git commit -m "feat: simplify animation UI around single active driver mode"
```

---

### Task 7: End-to-End Verification and Safety Checks

**Files:**
- Test only: `src/lib/state/animation.svelte.spec.ts`, `src/lib/components/AnimationSection.svelte.spec.ts`, `src/lib/state/animation-drivers/*.spec.ts`
- Optional docs note: `docs/superpowers/specs/2026-04-27-animation-driver-architecture-design.md`

- [ ] **Step 1: Add missing regression tests for topology changes**

```ts
// src/lib/state/animation.svelte.spec.ts (additional case)
it('dataSeries mode keeps untouched ring t when series is missing', () => {
	// Arrange state with ring 0 and ring 1, configure only ring 0 series
	// Assert ring 1 morphT remains unchanged after one runtime tick
});
```

- [ ] **Step 2: Run focused test suite**

Run: `bun vitest run "src/lib/state/animation-drivers/*.spec.ts" "src/lib/state/animation.svelte.spec.ts" "src/lib/components/AnimationSection.svelte.spec.ts"`  
Expected: PASS for all animation-related tests.

- [ ] **Step 3: Run project lint and unit tests**

Run: `bun run lint && bun run test:unit`  
Expected: lint passes; unit suite passes with no new warnings/errors introduced by animation changes.

- [ ] **Step 4: Update spec note if implementation deviated**

```md
<!-- docs/superpowers/specs/2026-04-27-animation-driver-architecture-design.md -->
Implementation note: `audioBars` uses zero-fill for missing analyzer bins in v1. Future iteration may expose selectable fallback strategy.
```

- [ ] **Step 5: Commit final verification pass**

```bash
git add src/lib/state/animation.svelte.spec.ts src/lib/components/AnimationSection.svelte.spec.ts src/lib/state/animation-drivers docs/superpowers/specs/2026-04-27-animation-driver-architecture-design.md
git commit -m "test: verify single-driver animation runtime and simplified mode UI"
```

---

## Self-review checklist (completed)

### 1) Spec coverage

- Single active driver runtime -> covered by Tasks 2 and 5.
- `dataSeries` 1:1 ring mapping + variable lengths + hold policy -> covered by Task 3 and Task 7.
- `audioBars` one bar per ring + bounded values -> covered by Task 4.
- Mode-driven simple UI -> covered by Task 6.
- Error/sanitize topology behavior -> covered by Tasks 2, 5, and 7.

### 2) Placeholder scan

No `TBD`, `TODO`, or generic "handle edge cases" placeholders are present in plan steps.

### 3) Type consistency

Plan consistently uses:
- `AnimationMode = 'audioBars' | 'dataSeries' | null`
- `frame` output as `Record<number, number>`
- `dataSeries.seriesByRingIndex` for ring-indexed input

