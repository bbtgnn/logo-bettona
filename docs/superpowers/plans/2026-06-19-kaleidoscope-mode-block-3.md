# Kaleidoscope Block 3 — Animate all parameters + WebM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user animate every kaleidoscope slider via an After-Effects-style per-slider stopwatch, with the timeline showing only armed parameters, and record the animated kaleidoscope to WebM.

**Architecture:** A single non-Svelte registry (`KALEIDO_PARAMS`) is the source of truth for the 8 animatable kaleidoscope sliders (id/label/min/max/step/get/set). Three consumers derive from it: the apply seam (`applyKaleidoscopeKeyframes` loops the registry), the sidebar (a reusable `AnimatableSlider` per entry), and the timeline (dynamic track rows + a graph-editor param selector). WebM reuses the existing `Export Animation` button — in kaleidoscope mode the visible canvas already *is* the kaleidoscope and the clock already calls the apply seam — plus a fix to stop the draw-loop effect thrashing when `sectors`/`repeat` are animated.

**Tech Stack:** SvelteKit + Svelte 5 runes, TypeScript, bun, vitest (node + chromium browser projects), paper.js, Canvas 2D, MediaRecorder/WebM.

## Global Constraints

- Package manager **bun**. Run unit tests: `bun run test:unit -- run [path]`. Type check: `bun run check`.
- **Run the FULL unit suite before each commit** (`bun run test:unit -- run`). The `Sidebar.svelte.spec.ts` `vi.mock('$lib/state/animation', ...)` only surfaces failures in the full chromium run. If any sidebar-reachable component starts importing a NEW export from `animation.svelte.ts`, add it to that mock (this plan introduces none — `AnimatableSlider` consumes only `animationState` + `applyKaleidoscopeKeyframes`, both already mocked).
- **vitest routing** (`vite.config.ts`): chromium/browser project = `*.svelte.{test,spec}.{js,ts}`; node project = `*.test.*` + `*.!(*.svelte).spec.*`, with `animation.svelte.spec.ts` special-cased into node. DOM/window/localStorage tests MUST be `*.svelte.spec.ts`. In `animation.svelte.spec.ts`, `vi.resetModules()` runs per test → import modules with `await import(...)` INSIDE each test so `keyframes`/`kaleidoscope` are the same fresh instances.
- Every edited `.svelte` MUST pass the `svelte-autofixer` MCP (`issues: []`) before its commit. The "function inside `$effect`" suggestions on the PreviewCanvas canvas/rAF functions are a known false-positive class — ignore only those.
- **Tab indentation** in `.svelte` and `.ts` (match existing files).
- `getByLabelText` matches by **substring** — keep new `aria-label`s from colliding with existing ones (e.g. a stopwatch labelled `"Anima Settori"` must not be confused with the `"Settori"` slider in a test; select by role/testid where ambiguous).
- Discrete params stay valid via existing setters: `setSectors` → `clampSectors` (even, 4–24), `setRepeat` → `clampRepeat` (integer, 1–10). Never round in the registry — delegate to setters.
- Headless playwright canvas is NOT faithful here — do not trust preview-canvas screenshots; rely on unit tests for geometry and ask the designer for live visual checks.
- Commit only; do NOT push (origin is intentionally behind; designer pushes/merges on request).

---

### Task 1: Kaleidoscope param registry

**Files:**
- Create: `src/lib/state/kaleidoscope-params.ts`
- Test: `src/lib/state/kaleidoscope-params.spec.ts` (node project — non-`.svelte.spec`)

**Interfaces:**
- Consumes: existing `kaleidoscope` state + setters from `src/lib/state/kaleidoscope.svelte.ts`; `KALEIDO_GLOBAL_ROTATION` literal `'kaleidoscope.globalRotation'` (kept as-is in `keyframes.svelte.ts`).
- Produces:
  - `type KaleidoParam = { id: string; label: string; min: number; max: number; step: number; get(): number; set(v: number): void }`
  - `const KALEIDO_PARAMS: KaleidoParam[]` (ordered for the sidebar; 8 entries)
  - `const KALEIDO_PARAM_BY_ID: Record<string, KaleidoParam>`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/state/kaleidoscope-params.spec.ts
import { describe, expect, it } from 'vitest';
import { KALEIDO_PARAMS, KALEIDO_PARAM_BY_ID, type KaleidoParam } from './kaleidoscope-params';
import { kaleidoscope } from './kaleidoscope.svelte';
import { KALEIDO_GLOBAL_ROTATION } from './keyframes.svelte';

describe('KALEIDO_PARAMS registry', () => {
	it('exposes the 8 animatable sliders with unique ids', () => {
		expect(KALEIDO_PARAMS).toHaveLength(8);
		const ids = KALEIDO_PARAMS.map((p) => p.id);
		expect(new Set(ids).size).toBe(8);
	});

	it('includes globalRotation under the Block-2 track id', () => {
		const rot = KALEIDO_PARAM_BY_ID[KALEIDO_GLOBAL_ROTATION];
		expect(rot).toBeDefined();
		expect(rot.min).toBe(0);
		expect(rot.max).toBe(360);
	});

	it('get/set round-trips a continuous param through state', () => {
		const scale = KALEIDO_PARAM_BY_ID['kaleidoscope.scale'];
		scale.set(1.5);
		expect(scale.get()).toBe(1.5);
		expect(kaleidoscope.scale).toBe(1.5);
	});

	it('set clamps sectors to an even value in range', () => {
		const sectors = KALEIDO_PARAM_BY_ID['kaleidoscope.sectors'];
		sectors.set(9.4);
		expect(sectors.get()).toBe(8); // 9.4 -> round 9 -> even 8
		sectors.set(99);
		expect(sectors.get()).toBe(24);
	});

	it('set clamps repeat to an integer in range', () => {
		const repeat = KALEIDO_PARAM_BY_ID['kaleidoscope.repeat'];
		repeat.set(3.9);
		expect(repeat.get()).toBe(3);
		repeat.set(-2);
		expect(repeat.get()).toBe(1);
	});

	it('every entry id matches its KALEIDO_PARAM_BY_ID key', () => {
		for (const p of KALEIDO_PARAMS as KaleidoParam[]) {
			expect(KALEIDO_PARAM_BY_ID[p.id]).toBe(p);
		}
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/state/kaleidoscope-params.spec.ts`
Expected: FAIL — cannot resolve `./kaleidoscope-params`.

- [ ] **Step 3: Write the registry**

```ts
// src/lib/state/kaleidoscope-params.ts
import {
	kaleidoscope,
	setGlobalRotation,
	setTileRotation,
	setCarpetRotation,
	setScale,
	setOffsetDistance,
	setTileSize,
	setSectors,
	setRepeat
} from './kaleidoscope.svelte';
import { KALEIDO_GLOBAL_ROTATION } from './keyframes.svelte';

export type KaleidoParam = {
	id: string;
	label: string;
	min: number;
	max: number;
	step: number;
	get(): number;
	set(v: number): void;
};

// Single source of truth for every animatable kaleidoscope slider. Order = sidebar order.
// Booleans (masks, live tile) and the background color are intentionally absent: not animatable.
export const KALEIDO_PARAMS: KaleidoParam[] = [
	{
		id: KALEIDO_GLOBAL_ROTATION,
		label: 'Rotazione globale',
		min: 0,
		max: 360,
		step: 1,
		get: () => kaleidoscope.globalRotation,
		set: setGlobalRotation
	},
	{
		id: 'kaleidoscope.tileRotation',
		label: 'Rotazione tessera',
		min: 0,
		max: 360,
		step: 1,
		get: () => kaleidoscope.tileRotation,
		set: setTileRotation
	},
	{
		id: 'kaleidoscope.carpetRotation',
		label: 'Rotazione tappeto',
		min: 0,
		max: 360,
		step: 1,
		get: () => kaleidoscope.carpetRotation,
		set: setCarpetRotation
	},
	{
		id: 'kaleidoscope.scale',
		label: 'Scala globale',
		min: 0.3,
		max: 3,
		step: 0.05,
		get: () => kaleidoscope.scale,
		set: setScale
	},
	{
		id: 'kaleidoscope.offsetDistance',
		label: 'Distanza dal centro',
		min: 0,
		max: 1,
		step: 0.01,
		get: () => kaleidoscope.offsetDistance,
		set: setOffsetDistance
	},
	{
		id: 'kaleidoscope.tileSize',
		label: 'Dimensione tessera',
		min: 0.1,
		max: 2,
		step: 0.05,
		get: () => kaleidoscope.tileSize,
		set: setTileSize
	},
	{
		id: 'kaleidoscope.sectors',
		label: 'Settori',
		min: 4,
		max: 24,
		step: 2,
		get: () => kaleidoscope.sectors,
		set: setSectors
	},
	{
		id: 'kaleidoscope.repeat',
		label: 'Ripetizioni',
		min: 1,
		max: 10,
		step: 1,
		get: () => kaleidoscope.repeat,
		set: setRepeat
	}
];

export const KALEIDO_PARAM_BY_ID: Record<string, KaleidoParam> = Object.fromEntries(
	KALEIDO_PARAMS.map((p) => [p.id, p])
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/state/kaleidoscope-params.spec.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Type check + commit**

Run: `bun run check`
Expected: 0 errors.

```bash
git add src/lib/state/kaleidoscope-params.ts src/lib/state/kaleidoscope-params.spec.ts
git commit -m "feat: kaleidoscope animatable-param registry (single source of truth)"
```

---

### Task 2: Generalize the apply seam to all registry params

**Files:**
- Modify: `src/lib/state/animation.svelte.ts:16-17,209-212`
- Test: `src/lib/state/animation.svelte.spec.ts` (append to the existing `kaleidoscope keyframe application` describe at `:468`)

**Interfaces:**
- Consumes: `KALEIDO_PARAMS` from Task 1; `keyframes.sampleParam(id, t)` (returns `number | null`, `null` when disabled/empty).
- Produces: `applyKaleidoscopeKeyframes(progress: number): void` — unchanged signature, now applies every armed registry param.

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe('kaleidoscope keyframe application', ...)` block in `src/lib/state/animation.svelte.spec.ts`:

```ts
	it('applies multiple armed params at the same progress', async () => {
		const animation = await import('./animation');
		const { keyframes } = await import('./keyframes.svelte');
		const { kaleidoscope } = await import('./kaleidoscope.svelte');
		const SCALE = 'kaleidoscope.scale';
		const TILEROT = 'kaleidoscope.tileRotation';
		keyframes.addKeyframe(SCALE, { time: 0, value: 1 });
		keyframes.addKeyframe(SCALE, { time: 1, value: 3 });
		keyframes.setTrackEnabled(SCALE, true);
		keyframes.addKeyframe(TILEROT, { time: 0, value: 0 });
		keyframes.addKeyframe(TILEROT, { time: 1, value: 100 });
		keyframes.setTrackEnabled(TILEROT, true);
		animation.applyKaleidoscopeKeyframes(0.5);
		expect(kaleidoscope.scale).toBeCloseTo(2, 4);
		expect(kaleidoscope.tileRotation).toBeCloseTo(50, 4);
	});

	it('leaves an unarmed param at its static value while another is armed', async () => {
		const animation = await import('./animation');
		const { keyframes } = await import('./keyframes.svelte');
		const { kaleidoscope, setOffsetDistance } = await import('./kaleidoscope.svelte');
		const SCALE = 'kaleidoscope.scale';
		setOffsetDistance(0.25); // unarmed
		keyframes.addKeyframe(SCALE, { time: 0, value: 1 });
		keyframes.addKeyframe(SCALE, { time: 1, value: 3 });
		keyframes.setTrackEnabled(SCALE, true);
		animation.applyKaleidoscopeKeyframes(0.5);
		expect(kaleidoscope.offsetDistance).toBe(0.25);
	});

	it('rounds a discrete (sectors) sample to a valid even value', async () => {
		const animation = await import('./animation');
		const { keyframes } = await import('./keyframes.svelte');
		const { kaleidoscope } = await import('./kaleidoscope.svelte');
		const SECTORS = 'kaleidoscope.sectors';
		keyframes.addKeyframe(SECTORS, { time: 0, value: 8 });
		keyframes.addKeyframe(SECTORS, { time: 1, value: 12 });
		keyframes.setTrackEnabled(SECTORS, true);
		animation.applyKaleidoscopeKeyframes(0.5); // sample ~10
		expect(kaleidoscope.sectors).toBe(10);
		expect(kaleidoscope.sectors % 2).toBe(0);
	});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test:unit -- run src/lib/state/animation.svelte.spec.ts`
Expected: FAIL — the new params are never applied (`scale`/`tileRotation` keep defaults; sectors unchanged).

- [ ] **Step 3: Rewrite the apply seam**

In `src/lib/state/animation.svelte.ts`, replace the imports at lines 16-17:

```ts
import { keyframes, KALEIDO_GLOBAL_ROTATION } from './keyframes.svelte';
import { setGlobalRotation } from './kaleidoscope.svelte';
```

with:

```ts
import { keyframes } from './keyframes.svelte';
import { KALEIDO_PARAMS } from './kaleidoscope-params';
```

Then replace the function body at lines 209-212:

```ts
export function applyKaleidoscopeKeyframes(progress: number): void {
	for (const p of KALEIDO_PARAMS) {
		const v = keyframes.sampleParam(p.id, progress);
		if (v !== null) p.set(v);
	}
}
```

Update the doc-comment above it (lines 204-208) to drop the "Block 2 wires only globalRotation" note:

```ts
/**
 * Applies every armed kaleidoscope keyframe track at the given normalized progress.
 * Each registry param samples its track; a disabled/empty track returns null and leaves
 * the static slider value in place. Discrete params (sectors/repeat) are rounded/clamped
 * by their setters.
 */
```

> Note: `KALEIDO_GLOBAL_ROTATION` is no longer imported here. Check no other line in this file references `KALEIDO_GLOBAL_ROTATION` or `setGlobalRotation` (grep before committing); the only uses were in this function.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test:unit -- run src/lib/state/animation.svelte.spec.ts`
Expected: PASS — including the original two globalRotation tests (still green: globalRotation is registry entry 0).

- [ ] **Step 5: Full suite + type check + commit**

Run: `bun run test:unit -- run` → all green (was 345; +4 here).
Run: `bun run check` → 0 errors.

```bash
git add src/lib/state/animation.svelte.ts src/lib/state/animation.svelte.spec.ts
git commit -m "feat: apply all armed kaleidoscope keyframe tracks (registry-driven)"
```

---

### Task 3: AnimatableSlider component (stopwatch + arm-aware slider)

**Files:**
- Create: `src/lib/components/AnimatableSlider.svelte`
- Test: `src/lib/components/AnimatableSlider.svelte.spec.ts` (chromium project)

**Interfaces:**
- Consumes: `KaleidoParam` (Task 1); `keyframes` API (`ensureTrack`, `tracks`, `setTrackEnabled`, `upsertKeyframeAtTime`) from `keyframes.svelte`; `animationState` + `applyKaleidoscopeKeyframes` from `$lib/state/animation`.
- Produces: `<AnimatableSlider param={KaleidoParam} />` — a label + stopwatch toggle + range input. Arming writes through `keyframes`; the timeline/apply seam pick it up by id.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/AnimatableSlider.svelte.spec.ts
import { page } from 'vitest/browser';
import { describe, expect, it, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AnimatableSlider from './AnimatableSlider.svelte';
import { keyframes } from '$lib/state/keyframes.svelte';
import { kaleidoscope } from '$lib/state/kaleidoscope.svelte';

const param = {
	id: 'kaleidoscope.scale',
	label: 'Scala globale',
	min: 0.3,
	max: 3,
	step: 0.05,
	get: () => kaleidoscope.scale,
	set: (v: number) => (kaleidoscope.scale = v)
};

describe('AnimatableSlider', () => {
	beforeEach(() => {
		keyframes.tracks[param.id] = { paramId: param.id, enabled: false, keyframes: [] };
		kaleidoscope.scale = 1;
	});

	it('arms the track when the stopwatch is toggled on', async () => {
		render(AnimatableSlider, { param });
		const stopwatch = page.getByLabelText('Anima Scala globale');
		await stopwatch.click();
		expect(keyframes.tracks[param.id].enabled).toBe(true);
	});

	it('unarmed slider input sets the value directly (no keyframe)', async () => {
		render(AnimatableSlider, { param });
		const slider = page.getByLabelText('Scala globale', { exact: true });
		await slider.fill('2');
		expect(kaleidoscope.scale).toBe(2);
		expect(keyframes.tracks[param.id].keyframes).toHaveLength(0);
	});

	it('armed slider input upserts a keyframe instead of setting directly', async () => {
		keyframes.tracks[param.id].enabled = true;
		render(AnimatableSlider, { param });
		const slider = page.getByLabelText('Scala globale', { exact: true });
		await slider.fill('2');
		expect(keyframes.tracks[param.id].keyframes.length).toBeGreaterThan(0);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/components/AnimatableSlider.svelte.spec.ts`
Expected: FAIL — cannot resolve `./AnimatableSlider.svelte`.

- [ ] **Step 3: Write the component**

```svelte
<!-- src/lib/components/AnimatableSlider.svelte -->
<script lang="ts">
	import { keyframes } from '$lib/state/keyframes.svelte';
	import { animationState, applyKaleidoscopeKeyframes } from '$lib/state/animation';
	import type { KaleidoParam } from '$lib/state/kaleidoscope-params';

	let { param }: { param: KaleidoParam } = $props();

	keyframes.ensureTrack(param.id);
	const armed = $derived(keyframes.tracks[param.id]?.enabled ?? false);

	function onInput(e: Event) {
		const value = Number((e.target as HTMLInputElement).value);
		if (armed) {
			keyframes.upsertKeyframeAtTime(param.id, animationState.progress, value);
			// tick only applies while playing; refresh the paused preview immediately.
			if (!animationState.isPlaying) applyKaleidoscopeKeyframes(animationState.progress);
		} else {
			param.set(value);
		}
	}
</script>

<div class="flex flex-col gap-1">
	<div class="flex items-center gap-2">
		<button
			type="button"
			aria-label="Anima {param.label}"
			aria-pressed={armed}
			title="Anima questo parametro"
			class="grid h-5 w-5 shrink-0 place-items-center rounded text-xs {armed
				? 'bg-primary text-primary-foreground'
				: 'bg-muted text-muted-foreground'}"
			onclick={() => keyframes.setTrackEnabled(param.id, !armed)}
		>
			⏱
		</button>
		<!-- Plain span (NOT a <label for>) so the input's accessible name is the aria-label
		     EXACTLY (`param.label`), with no value text appended. This keeps exact-match label
		     queries unambiguous against the "Anima {label}" stopwatch button. -->
		<span class="text-xs">{param.label} ({param.get()})</span>
	</div>
	<input
		id="k-{param.id}"
		aria-label={param.label}
		type="range"
		min={param.min}
		max={param.max}
		step={param.step}
		value={param.get()}
		oninput={onInput}
	/>
</div>
```

> **Label-collision rule for every test in this plan:** the slider's accessible name is
> exactly `param.label` (e.g. `Settori`), and the stopwatch's is `Anima {param.label}`
> (e.g. `Anima Settori`). A non-exact `getByLabelText('Settori')` matches BOTH → ambiguous.
> Always query sliders with `getByLabelText(label, { exact: true })` and stopwatches with
> their full `Anima …` name.

- [ ] **Step 4: Pass the svelte-autofixer MCP**

Run the `svelte-autofixer` MCP tool on `AnimatableSlider.svelte`. Iterate until `issues: []`. (No canvas/`$effect` here, so no expected false positives.)

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/components/AnimatableSlider.svelte.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Type check + commit**

Run: `bun run check` → 0 errors.

```bash
git add src/lib/components/AnimatableSlider.svelte src/lib/components/AnimatableSlider.svelte.spec.ts
git commit -m "feat: AnimatableSlider — per-slider stopwatch with arm-aware keyframing"
```

---

### Task 4: Convert KaleidoscopeSection sliders to AnimatableSlider

**Files:**
- Modify: `src/lib/components/KaleidoscopeSection.svelte` (replace the 8 inline numeric slider blocks + remove the old "Anima rotazione" checkbox and inline `onRotationInput`/`rotationAnimated` logic)
- Modify (existing): `src/lib/components/KaleidoscopeSection.svelte.spec.ts` — update queries that now collide with the stopwatch and rename the old stopwatch label

**Interfaces:**
- Consumes: `KALEIDO_PARAMS` (Task 1), `AnimatableSlider` (Task 3).
- Produces: the sidebar section, where every numeric slider is an `AnimatableSlider` and the non-animatable controls (mode, circular mask, live tile + refresh, tile background, background color) are unchanged.

- [ ] **Step 1: Update the EXISTING spec (it already exists) for the new markup**

`src/lib/components/KaleidoscopeSection.svelte.spec.ts` already asserts the old inline
markup. Make these exact edits:

1. The `updates sectors from the range input` test — make the slider query exact (it would
   otherwise also match the new `Anima Settori` stopwatch):

```ts
await userEvent.fill(page.getByLabelText('Settori', { exact: true }), '12');
```

2. The parametrized `rangeCases` loop — make its slider query exact:

```ts
for (const [label, value, get] of rangeCases) {
	it(`wires the "${label}" slider to its setter`, async () => {
		render(KaleidoscopeSection);
		await userEvent.fill(page.getByLabelText(label, { exact: true }), value);
		expect(get()).toBe(Number(value));
	});
}
```

3. In the `KaleidoscopeSection rotation keyframing` describe, rename the stopwatch label and
   make the slider queries exact:

```ts
	it('enables the rotation track via the stopwatch', async () => {
		render(KaleidoscopeSection);
		await userEvent.click(page.getByLabelText('Anima Rotazione globale'));
		expect(keyframes.tracks[ROT].enabled).toBe(true);
	});

	it('writes a keyframe at the playhead when the track is enabled', async () => {
		keyframes.setTrackEnabled(ROT, true);
		animationState.progress = 0.5;
		render(KaleidoscopeSection);
		await userEvent.fill(page.getByLabelText('Rotazione globale', { exact: true }), '120');
		const kf = keyframes.tracks[ROT].keyframes.find((k) => Math.abs(k.time - 0.5) < 1e-3);
		expect(kf?.value).toBe(120);
	});

	it('reflects the authored keyframe in the paused preview', async () => {
		keyframes.setTrackEnabled(ROT, true);
		animationState.progress = 0.5;
		animationState.isPlaying = false;
		render(KaleidoscopeSection);
		await userEvent.fill(page.getByLabelText('Rotazione globale', { exact: true }), '210');
		expect(kaleidoscope.globalRotation).toBeCloseTo(210, 4);
	});
```

4. Add one new test (covers a discrete-slider stopwatch beyond globalRotation) to the first
   describe, after the `rangeCases` loop:

```ts
	it('arms the sectors track via its stopwatch', async () => {
		keyframes.ensureTrack('kaleidoscope.sectors');
		keyframes.setTrackEnabled('kaleidoscope.sectors', false);
		render(KaleidoscopeSection);
		await userEvent.click(page.getByLabelText('Anima Settori'));
		expect(keyframes.tracks['kaleidoscope.sectors'].enabled).toBe(true);
	});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/components/KaleidoscopeSection.svelte.spec.ts`
Expected: FAIL — `Anima Rotazione globale` / `Anima Settori` not present yet (still the old `Anima rotazione` checkbox); the exact-match edits also assume the new component.

- [ ] **Step 3: Edit the section**

In `src/lib/components/KaleidoscopeSection.svelte`:

1. Replace the script's kaleidoscope-setter imports so only the non-animatable ones remain, and add the registry + component imports. The new script block:

```svelte
<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import SidebarCollapsible from './SidebarCollapsible.svelte';
	import AnimatableSlider from './AnimatableSlider.svelte';
	import {
		kaleidoscope,
		setKaleidoscopeEnabled,
		setCircularMask,
		setLiveTile,
		setTileBackground,
		setKaleidoscopeBackgroundColor,
		requestTileRefresh
	} from '$lib/state/kaleidoscope.svelte';
	import { KALEIDO_PARAMS } from '$lib/state/kaleidoscope-params';

	const checked = (e: Event) => (e.target as HTMLInputElement).checked;
</script>
```

2. Replace the entire run of numeric slider blocks (the `Settori`, `Ripetizioni`, `Distanza dal centro`, `Scala globale`, `Dimensione tessera`, `Rotazione tessera`, `Rotazione tappeto` blocks, the old `Anima rotazione` checkbox, and the `Rotazione globale` block — original lines ~59-179) with a single loop placed where the sliders should appear (after the mode checkbox, before the `Maschera circolare` checkbox):

```svelte
{#each KALEIDO_PARAMS as param (param.id)}
	<AnimatableSlider {param} />
{/each}
```

3. Leave the remaining markup intact: the mode checkbox (`Modalità caleidoscopio`), `Maschera circolare`, `Tessera viva`, `Aggiorna istantanea` button, `Sfondo tessera`, and the background-color picker — all keep their existing `setCircularMask` / `setLiveTile` / `requestTileRefresh` / `setTileBackground` / `setKaleidoscopeBackgroundColor` handlers and `checked(e)` helper.

> The order of `KALEIDO_PARAMS` is Rotazione globale, Rotazione tessera, Rotazione tappeto, Scala globale, Distanza dal centro, Dimensione tessera, Settori, Ripetizioni. This differs slightly from today's hand-written order; that is acceptable (sliders grouped, rotations first). If the designer wants the old order, reorder the registry array — it is the single source of truth.

- [ ] **Step 4: Pass the svelte-autofixer MCP**

Run `svelte-autofixer` on `KaleidoscopeSection.svelte` until `issues: []`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test:unit -- run src/lib/components/KaleidoscopeSection.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 6: Full suite + type check + commit**

Run: `bun run test:unit -- run` → all green (watch the `Sidebar.svelte.spec` chromium case; no animation-mock change is needed).
Run: `bun run check` → 0 errors.

```bash
git add src/lib/components/KaleidoscopeSection.svelte src/lib/components/KaleidoscopeSection.svelte.spec.ts
git commit -m "feat: kaleidoscope sidebar sliders become AnimatableSliders (stopwatch per param)"
```

---

### Task 5: Dynamic timeline tracks + graph-editor param selector

**Files:**
- Modify: `src/lib/components/TimelinePanel.svelte`
- Modify (existing): `src/lib/components/TimelinePanel.svelte.spec.ts` — the existing `toggles the graph editor mode` test assumes a track is always present; with the dynamic panel it must arm a param first, else the empty-state shows instead of `timeline-graph`.

**Interfaces:**
- Consumes: `KALEIDO_PARAMS` (Task 1); `keyframes` (`tracks`, `ensureTrack`, `setTrackEnabled`); existing `TimelineTrack` (`paramId`, `label`) and `KeyframeGraphEditor` (`paramId`, `min`, `max`).
- Produces: a timeline that renders one `TimelineTrack` per **armed** param, a `<select>` choosing the graph-editor param among armed params, and an empty-state hint when nothing is armed.

- [ ] **Step 1: Update the EXISTING spec**

Rewrite `src/lib/components/TimelinePanel.svelte.spec.ts` to (a) reset tracks per test, (b)
fix the graph-mode test to arm a param first, and (c) add empty-state + armed-row tests:

```ts
import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TimelinePanel from './TimelinePanel.svelte';
import { keyframes } from '$lib/state/keyframes.svelte';

describe('TimelinePanel', () => {
	beforeEach(() => {
		for (const id of Object.keys(keyframes.tracks)) delete keyframes.tracks[id];
	});

	it('starts collapsed and expands on toggle', async () => {
		render(TimelinePanel);
		expect(page.getByTestId('timeline-body').query()).toBeNull();
		await userEvent.click(page.getByRole('button', { name: 'Timeline' }));
		await expect.element(page.getByTestId('timeline-body')).toBeInTheDocument();
	});

	it('shows the empty-state hint when no param is armed', async () => {
		render(TimelinePanel);
		await userEvent.click(page.getByRole('button', { name: 'Timeline' }));
		await expect.element(page.getByTestId('timeline-empty')).toBeInTheDocument();
	});

	it('renders a track row for an armed param', async () => {
		keyframes.ensureTrack('kaleidoscope.scale');
		keyframes.setTrackEnabled('kaleidoscope.scale', true);
		render(TimelinePanel);
		await userEvent.click(page.getByRole('button', { name: 'Timeline' }));
		await expect.element(page.getByTestId('track-kaleidoscope.scale')).toBeInTheDocument();
	});

	it('toggles the graph editor mode (with a param armed)', async () => {
		keyframes.ensureTrack('kaleidoscope.scale');
		keyframes.setTrackEnabled('kaleidoscope.scale', true);
		render(TimelinePanel);
		await userEvent.click(page.getByRole('button', { name: 'Timeline' }));
		await userEvent.click(page.getByRole('button', { name: 'Graph Editor' }));
		await expect.element(page.getByTestId('timeline-graph')).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/components/TimelinePanel.svelte.spec.ts`
Expected: FAIL — no `timeline-empty` element; the panel still renders only the hard-coded globalRotation track.

- [ ] **Step 3: Rewrite TimelinePanel**

```svelte
<!-- src/lib/components/TimelinePanel.svelte -->
<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { keyframes } from '$lib/state/keyframes.svelte';
	import { KALEIDO_PARAMS } from '$lib/state/kaleidoscope-params';
	import TimelineRuler from './TimelineRuler.svelte';
	import TimelineTrack from './TimelineTrack.svelte';
	import KeyframeGraphEditor from './KeyframeGraphEditor.svelte';

	let open = $state(false);
	let graphMode = $state(false);
	let graphParamId = $state<string | null>(null);

	const armedParams = $derived(KALEIDO_PARAMS.filter((p) => keyframes.tracks[p.id]?.enabled));

	// Keep the graph selection valid: default to / fall back to the first armed param.
	const graphParam = $derived(
		armedParams.find((p) => p.id === graphParamId) ?? armedParams[0] ?? null
	);
</script>

<section data-testid="timeline-panel" class="w-full border-t bg-background">
	<div class="flex items-center gap-2 p-2">
		<Button variant="ghost" size="sm" onclick={() => (open = !open)}>Timeline</Button>
		{#if open}
			<Button
				variant={graphMode ? 'default' : 'ghost'}
				size="sm"
				onclick={() => (graphMode = !graphMode)}
			>
				Graph Editor
			</Button>
		{/if}
	</div>

	{#if open}
		<div data-testid="timeline-body" class="flex flex-col gap-1 p-2">
			{#if armedParams.length === 0}
				<p data-testid="timeline-empty" class="p-2 text-xs text-muted-foreground">
					Arma un cronometro ⏱ nella sidebar per animare un parametro.
				</p>
			{:else if graphMode}
				<div data-testid="timeline-graph" class="flex flex-col gap-2">
					<select
						aria-label="Parametro grafico"
						class="h-7 w-fit rounded border bg-background text-xs"
						value={graphParam?.id ?? ''}
						onchange={(e) => (graphParamId = (e.target as HTMLSelectElement).value)}
					>
						{#each armedParams as p (p.id)}
							<option value={p.id}>{p.label}</option>
						{/each}
					</select>
					{#if graphParam}
						<KeyframeGraphEditor paramId={graphParam.id} min={graphParam.min} max={graphParam.max} />
					{/if}
				</div>
			{:else}
				<div data-testid="timeline-tracks" class="flex flex-col gap-1">
					<TimelineRuler />
					{#each armedParams as p (p.id)}
						<TimelineTrack paramId={p.id} label={p.label} />
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</section>
```

- [ ] **Step 4: Pass the svelte-autofixer MCP**

Run `svelte-autofixer` on `TimelinePanel.svelte` until `issues: []`.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/components/TimelinePanel.svelte.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Full suite + type check + commit**

Run: `bun run test:unit -- run` → all green.
Run: `bun run check` → 0 errors.

```bash
git add src/lib/components/TimelinePanel.svelte src/lib/components/TimelinePanel.svelte.spec.ts
git commit -m "feat: timeline shows armed params dynamically + graph-editor param selector"
```

---

### Task 6: Stop rAF thrash on animated sectors/repeat + verify WebM

**Files:**
- Modify: `src/lib/components/PreviewCanvas.svelte` (the kaleidoscope draw-loop `$effect`, ~lines 199-223)
- Test: manual (headless canvas is unfaithful) + a small reasoning check below

**Interfaces:**
- Consumes: existing `drawKaleidoscope()` (reads `kaleidoscope.sectors`/`.repeat` live each frame), `exportCanvasAnimation`, `togglePlay`, `applyKaleidoscopeKeyframes` (now multi-param).
- Produces: a draw loop that does NOT tear down when `sectors`/`repeat` change, so animating them is smooth; WebM export of the animated kaleidoscope via the existing `Export Animation` button.

- [ ] **Step 1: Read the current effect**

Open `src/lib/components/PreviewCanvas.svelte` around lines 199-223. The effect currently does `void kaleidoscope.sectors; void kaleidoscope.repeat; void kaleidoscope.liveTile;` then sets up the rAF loop. Those `void` reads make the whole effect (which cancels + restarts the rAF loop and resets `staticTile`) re-run on every change of those values — fine for an occasional slider drag, but a per-frame teardown storm when `sectors`/`repeat` are keyframed.

- [ ] **Step 2: Edit the effect to drop sectors/repeat from its deps**

`drawKaleidoscope()` already reads `kaleidoscope.sectors` and `kaleidoscope.repeat` live every frame, so the picture stays correct without restarting the loop. Keep `liveTile` (it genuinely needs the `staticTile` reset + restart) but remove the sector/repeat reads:

```svelte
	$effect(() => {
		if (!kaleidoscope.enabled) {
			if (kaleidoFrame !== null) {
				cancelAnimationFrame(kaleidoFrame);
				kaleidoFrame = null;
			}
			return;
		}
		// Restart only when the tile SOURCE changes (live vs static). sectors/repeat are read
		// live inside drawKaleidoscope every frame, so they must NOT be dependencies here —
		// keyframing them would otherwise tear down and rebuild the rAF loop every frame.
		void kaleidoscope.liveTile;
		staticTile = undefined;
		const loop = () => {
			drawKaleidoscope();
			kaleidoFrame = requestAnimationFrame(loop);
		};
		kaleidoFrame = requestAnimationFrame(loop);
		return () => {
			if (kaleidoFrame !== null) {
				cancelAnimationFrame(kaleidoFrame);
				kaleidoFrame = null;
			}
		};
	});
```

(Only the two `void kaleidoscope.sectors;` / `void kaleidoscope.repeat;` lines and the comment change; the loop body is identical.)

- [ ] **Step 3: Pass the svelte-autofixer MCP**

Run `svelte-autofixer` on `PreviewCanvas.svelte` until `issues: []` — **ignore only** the known false-positive "function declared inside `$effect`" suggestions on the canvas/rAF helpers; do not refactor those.

- [ ] **Step 4: Confirm the WebM path needs no code change**

Read `exportAnimation()` (PreviewCanvas ~lines 101-127). Verify by inspection that in kaleidoscope mode it already records the animated kaleidoscope:
- guard `scope.project.activeLayer.children.length === 0` checks the composition (the tile source still has children) → passes;
- `togglePlay()` starts the clock; with ≥1 armed kaleidoscope track, `hasEnabledKeyframeTracks()` lets the clock start even with no driver/morph mode;
- the clock's `tick` calls `applyKaleidoscopeKeyframes(progress)` → registry params update → the kaleidoscope rAF loop reads them and redraws `canvasEl`;
- `exportCanvasAnimation({ canvas: canvasEl, ... })` records `canvasEl`.

No code change required for WebM. (If, and only if, the clock does not start in manual testing, the fallback is to expose a small "play kaleidoscope" toggle — but the gate already accounts for keyframe tracks, so this should not be needed.)

- [ ] **Step 5: Type check + commit**

Run: `bun run check` → 0 errors.
Run: `bun run test:unit -- run` → all green (no test targets this file; confirm nothing regressed).

```bash
git add src/lib/components/PreviewCanvas.svelte
git commit -m "fix: kaleidoscope draw loop no longer restarts when sectors/repeat animate"
```

- [ ] **Step 6: Manual live verification (designer)**

Run `bun run dev`. Then:
1. Enable kaleidoscope mode.
2. Arm the stopwatches for `Rotazione globale`, `Scala globale`, and `Settori`.
3. Open the timeline → confirm three track rows appear; add/scrub keyframes; confirm the paused preview updates and playing animates all three.
4. Confirm `Settori` steps through even values (8 → 10 → 12) without flicker.
5. Open the Graph Editor → switch the param selector between the three.
6. Set a duration and click **Export Animation** → confirm a WebM downloads and plays back the animated kaleidoscope.

---

## Self-Review

**Spec coverage:**
- Stopwatch per slider (fluid + discrete) → Tasks 3 + 4. ✓
- Booleans/color excluded → registry omits them (Task 1); section keeps them static (Task 4). ✓
- Single source of truth registry → Task 1, consumed by Tasks 2/4/5. ✓
- Discrete integer-step animation + rounding via setters → Task 1 (clamp tests) + Task 2 (sectors rounding test). ✓
- Apply seam loops registry → Task 2. ✓
- Dynamic timeline (armed only) + empty state → Task 5. ✓
- Graph editor multi-param selector with per-param min/max → Task 5. ✓
- WebM reuse + verification → Task 6. ✓
- rAF thrash risk on animated sectors/repeat → Task 6 Step 2. ✓
- `KALEIDO_GLOBAL_ROTATION` literal unchanged, no new import coupling → Task 1 (registry references the constant; keyframes.svelte.ts untouched). ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Type consistency:** `KaleidoParam` shape (id/label/min/max/step/get/set) is used identically in Tasks 1, 3 (`{ param }` prop), 4 (`{#each KALEIDO_PARAMS}`), 5 (`p.id/p.label/p.min/p.max`). `applyKaleidoscopeKeyframes(progress: number): void` signature unchanged across Tasks 2/3/5/6. `TimelineTrack`(`paramId`,`label`) and `KeyframeGraphEditor`(`paramId`,`min`,`max`) match their existing definitions. ✓
