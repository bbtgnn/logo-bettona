# Per-Ring Wave Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-ring wave character (`WaveConfig`) with a global default + optional per-ring override, and an accordion UI in the AudioBars panel that mirrors the ring list.

**Architecture:** Add `WaveConfig = {crests, amplitudeGain, phaseSpeed}` to the type system; `Ring` gains an optional `waveConfig` field (authoritative, persisted). `resolveWaveConfig(ring, globalDefault)` is the single merge point, called in the audioBars driver per ring. The UI accordion mirrors `composition.rings` via a new `RingWaveConfigItem` component that reuses `WavePreview`.

**Tech Stack:** TypeScript, Svelte 5 (runes), paper.js, shadcn/svelte Collapsible, vitest-browser-svelte.

---

## File Map

| Path | Status | Purpose |
|------|--------|---------|
| `src/lib/types.ts` | modify | Add `WaveConfig` type; add `waveConfig?: WaveConfig \| null` to `Ring` |
| `src/lib/geometry/wave.ts` | modify | Add `resolveWaveConfig` pure helper |
| `src/lib/geometry/wave.spec.ts` | modify | Add `resolveWaveConfig` tests |
| `src/lib/state/animation-drivers/audio-bars-driver.ts` | modify | Add `getRing` dep; use `resolveWaveConfig` per ring |
| `src/lib/state/animation-drivers/audio-bars-driver.spec.ts` | modify | Update `makeDriver` for new dep; add per-ring override test |
| `src/lib/state/animation.svelte.ts` | modify | Provide `getRing` dep when wiring audioBars driver |
| `src/lib/state/composition-persistence.svelte.spec.ts` | modify | Verify `waveConfig` persists; `ring.wave` still stripped |
| `src/lib/components/RingWaveConfigItem.svelte` | **create** | Per-ring collapsible: WavePreview + override toggle + sliders |
| `src/lib/components/AnimationSection.svelte` | modify | Import `RingWaveConfigItem`; add accordion; remove global `WavePreview`; drop `sampleRing` |
| `src/lib/components/AnimationSection.svelte.spec.ts` | modify | Add `updateRing: vi.fn()` to composition mock |

---

## Task 1 — Add `WaveConfig` type and `resolveWaveConfig`

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/geometry/wave.ts`
- Test: `src/lib/geometry/wave.spec.ts`

- [ ] **Step 1.1: Write the failing tests for `resolveWaveConfig`**

Append to `src/lib/geometry/wave.spec.ts` (after existing `describe` block):

```ts
import { resolveWaveConfig } from './wave';
import type { WaveConfig } from '$lib/types';

// (add this import at top of file alongside the existing ones)
```

Add a new `describe` block at the **end** of the file:

```ts
describe('resolveWaveConfig', () => {
	const globalDefault: WaveConfig = { crests: 3, amplitudeGain: 0.3, phaseSpeed: 2.2 };

	it('returns globalDefault when ring has no waveConfig', () => {
		expect(resolveWaveConfig({}, globalDefault)).toEqual(globalDefault);
	});

	it('returns globalDefault when ring.waveConfig is null', () => {
		expect(resolveWaveConfig({ waveConfig: null }, globalDefault)).toEqual(globalDefault);
	});

	it('returns ring.waveConfig when set, ignoring globalDefault', () => {
		const override: WaveConfig = { crests: 6, amplitudeGain: 0.8, phaseSpeed: 0.5 };
		expect(resolveWaveConfig({ waveConfig: override }, globalDefault)).toEqual(override);
	});
});
```

- [ ] **Step 1.2: Run tests to confirm they fail**

```
cd /Users/tommaso/Documents/GitHub/logo-bettona
npm run test:unit -- --run --reporter=verbose 2>&1 | grep -E "(FAIL|PASS|resolveWaveConfig)"
```

Expected: 3 failures — `resolveWaveConfig` not exported.

- [ ] **Step 1.3: Add `WaveConfig` to `src/lib/types.ts`**

Add after the `WaveState` block (line 10):

```ts
export type WaveConfig = {
	crests: number; // integer >= 1, periods along the petal
	amplitudeGain: number; // band energy (0..1) → wave amplitude scaling
	phaseSpeed: number; // rad/sec, travel speed of the wave
};
```

Also add `waveConfig?: WaveConfig | null` to `Ring` (after the `wave?` field):

```ts
export type Ring = {
	copies: number;
	color: string;
	templatePath: Path | null;
	secondaryTemplatePath: Path | null;
	morphT: number;
	ringHeight: number;
	wave?: WaveState | null;
	waveConfig?: WaveConfig | null; // null/absent = inherit global AudioBarsConfig default
};
```

- [ ] **Step 1.4: Add `resolveWaveConfig` to `src/lib/geometry/wave.ts`**

Add this import at top (alongside existing `Path, WaveState`):

```ts
import type { Path, WaveConfig, WaveState } from '$lib/types';
```

Append the function at the **end** of `wave.ts` (after `applyWaveToPath`):

```ts
export function resolveWaveConfig(
	ring: { waveConfig?: WaveConfig | null },
	globalDefault: WaveConfig
): WaveConfig {
	return ring.waveConfig ?? globalDefault;
}
```

- [ ] **Step 1.5: Run tests to confirm all 3 pass**

```
npm run test:unit -- --run --reporter=verbose 2>&1 | grep -E "(FAIL|PASS|resolveWaveConfig)"
```

Expected: 3 passing.

- [ ] **Step 1.6: Type-check**

```
npm run check 2>&1 | grep -v "animation.svelte.spec\|runtime.spec"
```

Expected: only the 2 pre-existing errors (`animation.svelte.spec.ts:270`, `runtime.spec.ts:34`).

- [ ] **Step 1.7: Commit**

```bash
git add src/lib/types.ts src/lib/geometry/wave.ts src/lib/geometry/wave.spec.ts
git commit -m "feat: add WaveConfig type and resolveWaveConfig helper"
```

---

## Task 2 — Update audioBars driver to use per-ring config

**Files:**
- Modify: `src/lib/state/animation-drivers/audio-bars-driver.ts`
- Modify: `src/lib/state/animation-drivers/audio-bars-driver.spec.ts`
- Modify: `src/lib/state/animation.svelte.ts`

- [ ] **Step 2.1: Write the new per-ring test and update makeDriver**

Replace `makeDriver` and add a new test in `audio-bars-driver.spec.ts`. The existing tests must still pass with the updated helper (rings without `waveConfig` inherit the global — behavior unchanged).

**Updated imports at top of file:**
```ts
import { describe, expect, it } from 'vitest';
import type { Ring, WaveConfig, WaveState } from '$lib/types';
import type { AudioBarsConfig } from './types';
import { createAudioBarsDriver } from './audio-bars-driver';
```

**Updated `makeDriver` helper** (replaces the existing one):
```ts
function makeRing(waveConfig?: WaveConfig | null): Ring {
	return {
		copies: 8,
		color: '#000000',
		templatePath: null,
		secondaryTemplatePath: null,
		morphT: 0,
		ringHeight: 0.4,
		waveConfig
	};
}

function makeDriver(overrides: {
	ringCount?: number;
	bars?: number[];
	calls: WaveCall[];
	rings?: Ring[];
}) {
	const rings = overrides.rings ?? [];
	return createAudioBarsDriver({
		getConfig: () => config,
		getRingCount: () => overrides.ringCount ?? 2,
		getRing: (i) => rings[i] ?? makeRing(),
		readBars: () => overrides.bars ?? [0.5, 1.1],
		applyRingWave: (index, wave) => overrides.calls.push({ index, wave })
	});
}
```

**Add new test** inside the `describe` block (after the last existing `it`):
```ts
it('uses per-ring waveConfig when set, falls back to global for rings without override', () => {
	const calls: WaveCall[] = [];
	const ringOverride: WaveConfig = { crests: 6, amplitudeGain: 0.8, phaseSpeed: 0.5 };
	const driver = makeDriver({
		ringCount: 2,
		bars: [0.5, 1.0],
		calls,
		rings: [makeRing(ringOverride), makeRing()] // ring 0 override; ring 1 inherits global
	});

	driver.frame(2000); // nowMs=2000

	// ring 0: override crests=6, amplitudeGain=0.8, phaseSpeed=0.5
	expect(calls[0].wave?.crests).toBe(6);
	expect(calls[0].wave?.amplitude).toBeCloseTo(0.5 * 0.8, 6); // 0.4
	expect(calls[0].wave?.phase).toBeCloseTo((2000 / 1000) * 0.5 + 0 * 0.4, 6); // 1.0

	// ring 1: inherits global (crests=3, amplitudeGain=0.3, phaseSpeed=2.2)
	expect(calls[1].wave?.crests).toBe(3);
	expect(calls[1].wave?.amplitude).toBeCloseTo(1.0 * 0.3, 6); // 0.3
	expect(calls[1].wave?.phase).toBeCloseTo((2000 / 1000) * 2.2 + 1 * 0.4, 6); // 4.8
});
```

- [ ] **Step 2.2: Run tests to confirm the new test fails**

```
npm run test:unit -- --run --reporter=verbose 2>&1 | grep -E "(FAIL|PASS|per-ring)"
```

Expected: the new test fails; existing tests may also fail (TypeScript error on missing `getRing` dep).

- [ ] **Step 2.3: Update `audio-bars-driver.ts`**

Full replacement of `audio-bars-driver.ts`:

```ts
import type { Ring, WaveState } from '$lib/types';
import type { AudioBarsConfig } from './types';
import { resolveWaveConfig } from '$lib/geometry/wave';

type AnimationDriver = {
	init: () => void;
	dispose: () => void;
	frame: (nowMs: number) => Record<number, number>;
};

type CreateAudioBarsDriverDeps = {
	getConfig: () => AudioBarsConfig;
	getRingCount: () => number;
	getRing: (index: number) => Ring;
	readBars: () => number[];
	applyRingWave: (index: number, wave: WaveState | null) => void;
};

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function normalizeRingCount(value: number): number {
	if (!Number.isFinite(value)) return 0;
	if (!Number.isInteger(value)) return Math.max(0, Math.floor(value));
	return Math.max(0, value);
}

export function createAudioBarsDriver(deps: CreateAudioBarsDriverDeps): AnimationDriver {
	return {
		init() {
			deps.getConfig();
		},
		dispose() {
			const ringCount = normalizeRingCount(deps.getRingCount());
			for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
				deps.applyRingWave(ringIndex, null);
			}
		},
		frame(nowMs) {
			const cfg = deps.getConfig();
			const ringCount = normalizeRingCount(deps.getRingCount());
			const bars = deps.readBars();
			const nowSec = (Number.isFinite(nowMs) ? nowMs : 0) / 1000;

			const globalDefault = {
				crests: cfg.waveCrests,
				amplitudeGain: cfg.waveAmplitudeGain,
				phaseSpeed: cfg.wavePhaseSpeed
			};

			for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
				const ring = deps.getRing(ringIndex);
				const ringCfg = resolveWaveConfig(ring, globalDefault);
				deps.applyRingWave(ringIndex, {
					amplitude: clamp01(bars[ringIndex] ?? 0) * ringCfg.amplitudeGain,
					crests: ringCfg.crests,
					phase: nowSec * ringCfg.phaseSpeed + ringIndex * 0.4
				});
			}

			return {};
		}
	};
}
```

- [ ] **Step 2.4: Wire `getRing` dep in `animation.svelte.ts`**

In `animation.svelte.ts`, find the `createAudioBarsDriver({...})` call (around line 87–104) and add `getRing`:

```ts
runtime.registerDriver(
	'audioBars',
	createAudioBarsDriver({
		getConfig: () => animationState.audioBars,
		getRingCount: () => composition.rings.length,
		getRing: (index) => composition.rings[index],
		readBars: () => {
			switch (animationState.audioSource) {
				case 'demo':
					return fallbackBars.readBars();
				case 'mic':
				case 'file':
					return audioSource.readBars();
				default:
					return [];
			}
		},
		applyRingWave: (index, wave) => setRingWave(index, wave)
	})
);
```

- [ ] **Step 2.5: Run all tests**

```
npm run test:unit -- --run 2>&1 | tail -5
```

Expected: all pass (139+ tests, 0 failures).

- [ ] **Step 2.6: Type-check**

```
npm run check 2>&1 | grep -v "animation.svelte.spec\|runtime.spec"
```

Expected: only the 2 pre-existing errors.

- [ ] **Step 2.7: Commit**

```bash
git add src/lib/state/animation-drivers/audio-bars-driver.ts \
        src/lib/state/animation-drivers/audio-bars-driver.spec.ts \
        src/lib/state/animation.svelte.ts
git commit -m "feat: use per-ring waveConfig in audioBars driver"
```

---

## Task 3 — Verify persistence: `waveConfig` saved, `ring.wave` still stripped

**Files:**
- Modify: `src/lib/state/composition-persistence.svelte.spec.ts`

- [ ] **Step 3.1: Add two persistence tests**

Append inside the existing `describe('createPersistedComposition', ...)` block:

```ts
it('persists ring.waveConfig to localStorage', () => {
	const state = createPersistedComposition(key, makeComposition());

	flushSync(() => {
		state.rings = state.rings.map((ring) => ({
			...ring,
			waveConfig: { crests: 5, amplitudeGain: 0.8, phaseSpeed: 1.0 }
		}));
	});

	const stored = JSON.parse(localStorage.getItem(key) ?? '{}');
	expect(stored.rings[0].waveConfig).toEqual({ crests: 5, amplitudeGain: 0.8, phaseSpeed: 1.0 });
});

it('strips ring.wave but preserves ring.waveConfig in the same write', () => {
	const state = createPersistedComposition(key, makeComposition());

	flushSync(() => {
		state.rings = state.rings.map((ring) => ({
			...ring,
			wave: { amplitude: 0.4, crests: 3, phase: 1.2 },
			waveConfig: { crests: 4, amplitudeGain: 0.5, phaseSpeed: 2.0 }
		}));
		state.baseRadius = 175; // trigger write (wave-only change wouldn't write)
	});

	const stored = JSON.parse(localStorage.getItem(key) ?? '{}');
	expect(stored.rings[0].wave).toBeUndefined();
	expect(stored.rings[0].waveConfig).toEqual({ crests: 4, amplitudeGain: 0.5, phaseSpeed: 2.0 });
});
```

- [ ] **Step 3.2: Run persistence tests**

```
npm run test:unit -- --run --reporter=verbose 2>&1 | grep -E "(FAIL|PASS|persist|strip)"
```

Expected: all pass (including the 2 new ones — `waveConfig` is not touched by `stripWave`, so it already persists).

- [ ] **Step 3.3: Commit**

```bash
git add src/lib/state/composition-persistence.svelte.spec.ts
git commit -m "test: verify waveConfig persists and ring.wave is still stripped"
```

---

## Task 4 — UI: `RingWaveConfigItem` + accordion in `AnimationSection`

**Files:**
- Create: `src/lib/components/RingWaveConfigItem.svelte`
- Modify: `src/lib/components/AnimationSection.svelte`
- Modify: `src/lib/components/AnimationSection.svelte.spec.ts`

- [ ] **Step 4.1: Create `RingWaveConfigItem.svelte`**

```svelte
<script lang="ts">
	import * as Collapsible from '$lib/shadcn/ui/collapsible/index.js';
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import { CaretDown, CaretRight } from 'phosphor-svelte';
	import { updateRing } from '$lib/state/composition';
	import { resolveWaveConfig } from '$lib/geometry/wave';
	import WavePreview from './WavePreview.svelte';
	import type { Ring, WaveConfig } from '$lib/types';

	let {
		ring,
		index,
		globalDefault
	}: {
		ring: Ring;
		index: number;
		globalDefault: WaveConfig;
	} = $props();

	let open = $state(false);

	const hasOverride = $derived(ring.waveConfig != null);
	const resolved = $derived(resolveWaveConfig(ring, globalDefault));
</script>

<div class="mb-1 rounded border bg-background">
	<Collapsible.Collapsible bind:open>
		<div class="flex items-center gap-1 px-2 py-1.5">
			<Collapsible.CollapsibleTrigger
				class="flex flex-1 items-center gap-1 text-left text-sm font-medium hover:text-foreground"
			>
				{#if open}
					<CaretDown size={14} />
				{:else}
					<CaretRight size={14} />
				{/if}
				Ring {index + 1}
				{#if hasOverride}
					<span class="ml-1 text-[10px] text-muted-foreground">(custom)</span>
				{/if}
			</Collapsible.CollapsibleTrigger>
		</div>

		<Collapsible.CollapsibleContent class="space-y-3 px-3 pb-3">
			<WavePreview
				template={ring.templatePath ?? null}
				copies={ring.copies ?? 1}
				ringHeight={ring.ringHeight ?? 0.4}
				crests={resolved.crests}
				amplitude={resolved.amplitudeGain}
				phaseSpeed={resolved.phaseSpeed}
			/>

			<div class="flex items-center gap-2">
				<input
					id="wave-override-{index}"
					type="checkbox"
					checked={hasOverride}
					onchange={(e) => {
						if ((e.target as HTMLInputElement).checked) {
							updateRing(index, { waveConfig: { ...globalDefault } });
						} else {
							updateRing(index, { waveConfig: null });
						}
					}}
				/>
				<Label for="wave-override-{index}" class="text-xs"
					>Customize wave for this ring</Label
				>
			</div>

			{#if hasOverride && ring.waveConfig}
				<div class="flex flex-col gap-1">
					<Label for="ring-crests-{index}" class="text-xs">Wave crests</Label>
					<input
						id="ring-crests-{index}"
						type="range"
						min="1"
						max="8"
						step="1"
						value={ring.waveConfig.crests}
						oninput={(e) =>
							updateRing(index, {
								waveConfig: { ...ring.waveConfig!, crests: Number((e.target as HTMLInputElement).value) }
							})}
					/>
				</div>

				<div class="flex flex-col gap-1">
					<Label for="ring-amplitude-{index}" class="text-xs">Amplitude gain</Label>
					<input
						id="ring-amplitude-{index}"
						type="range"
						min="0"
						max="1"
						step="0.01"
						value={ring.waveConfig.amplitudeGain}
						oninput={(e) =>
							updateRing(index, {
								waveConfig: {
									...ring.waveConfig!,
									amplitudeGain: Number((e.target as HTMLInputElement).value)
								}
							})}
					/>
				</div>

				<div class="flex flex-col gap-1">
					<Label for="ring-phase-speed-{index}" class="text-xs">Phase speed</Label>
					<input
						id="ring-phase-speed-{index}"
						type="range"
						min="0"
						max="6"
						step="0.1"
						value={ring.waveConfig.phaseSpeed}
						oninput={(e) =>
							updateRing(index, {
								waveConfig: {
									...ring.waveConfig!,
									phaseSpeed: Number((e.target as HTMLInputElement).value)
								}
							})}
					/>
				</div>
			{/if}
		</Collapsible.CollapsibleContent>
	</Collapsible.Collapsible>
</div>
```

- [ ] **Step 4.2: Run `svelte-autofixer` on `RingWaveConfigItem.svelte`**

Use the MCP tool `mcp__svelte__svelte-autofixer` on the file content. Fix any reported issues. Repeat until no issues remain.

- [ ] **Step 4.3: Update `AnimationSection.svelte`**

Changes to make:
1. Add import for `RingWaveConfigItem` and `WaveConfig`
2. Remove `sampleRing` derived
3. Replace global `WavePreview` with per-ring accordion
4. Add `globalWaveDefault` derived

**Updated `<script>` section** — replace the entire `<script>` block:

```svelte
<script lang="ts">
	import { untrack } from 'svelte';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { Input } from '$lib/shadcn/ui/input/index.js';
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import {
		animationState,
		handleCompositionChanged,
		setAnimationMode,
		setAnimationDurationSec,
		togglePlay,
		setAudioBarsConfig,
		setAudioSource,
		audioSource
	} from '$lib/state/animation';
	import { composition } from '$lib/state/composition';
	import SidebarCollapsible from './SidebarCollapsible.svelte';
	import RingWaveConfigItem from './RingWaveConfigItem.svelte';
	import type { WaveConfig } from '$lib/types';

	const progressPercent = $derived(
		Math.round(Math.max(0, Math.min(1, animationState.progress)) * 100)
	);
	const hasMorphRings = $derived(
		composition.rings.some((ring) => ring.secondaryTemplatePath !== null)
	);
	const requiresMorphRings = $derived(animationState.mode !== 'audioBars');
	const blockPlayback = $derived(requiresMorphRings && !hasMorphRings);

	const showInputLevel = $derived(
		animationState.mode === 'audioBars' &&
			(animationState.audioSource === 'mic' || animationState.audioSource === 'file')
	);

	const globalWaveDefault = $derived<WaveConfig>({
		crests: animationState.audioBars.waveCrests,
		amplitudeGain: animationState.audioBars.waveAmplitudeGain,
		phaseSpeed: animationState.audioBars.wavePhaseSpeed
	});

	let inputLevel = $state(0);
	$effect(() => {
		if (!showInputLevel) {
			inputLevel = 0;
			return;
		}
		let raf = requestAnimationFrame(function loop() {
			inputLevel = audioSource.readLevel();
			raf = requestAnimationFrame(loop);
		});
		return () => cancelAnimationFrame(raf);
	});
	const inputLevelPercent = $derived(Math.round(Math.max(0, Math.min(1, inputLevel)) * 100));

	$effect(() => {
		composition.rings.length;
		untrack(handleCompositionChanged);
	});
</script>
```

**Replace the `WavePreview` block** in the template — find this section:

```svelte
					<WavePreview
						template={sampleRing?.templatePath ?? null}
						copies={sampleRing?.copies ?? 1}
						ringHeight={sampleRing?.ringHeight ?? 0.4}
						crests={animationState.audioBars.waveCrests}
						amplitude={animationState.audioBars.waveAmplitudeGain}
						phaseSpeed={animationState.audioBars.wavePhaseSpeed}
					/>
```

Replace it with the per-ring accordion:

```svelte
					<div class="flex flex-col gap-1">
						<p class="text-[11px] font-medium text-muted-foreground">Wave per ring</p>
						{#each composition.rings as ring, i}
							<RingWaveConfigItem {ring} index={i} {globalWaveDefault} />
						{/each}
					</div>
```

Also remove the `WavePreview` import from the `<script>` block since it's now used only inside `RingWaveConfigItem`.

- [ ] **Step 4.4: Run `svelte-autofixer` on `AnimationSection.svelte`**

Use the MCP tool `mcp__svelte__svelte-autofixer` on the file content. Fix any reported issues. Repeat until no issues remain.

- [ ] **Step 4.5: Update `AnimationSection.svelte.spec.ts` — add `updateRing` to mock**

In the `compositionApi` definition, the composition mock currently only exposes `composition`. When `RingWaveConfigItem` is rendered as a child, it imports `updateRing` from the mocked module. Add `updateRing: vi.fn()` to prevent a missing-export runtime error if any test interacts with the checkbox.

Find the `compositionApi` definition:

```ts
const compositionApi = vi.hoisted(() => ({
	composition: {
		rings: [{ secondaryTemplatePath: { cmds: ['M'], crds: [0, 0] }, morphT: 0 }] as RingMock[]
	}
}));
```

Replace with:

```ts
const compositionApi = vi.hoisted(() => ({
	composition: {
		rings: [{ secondaryTemplatePath: { cmds: ['M'], crds: [0, 0] }, morphT: 0 }] as RingMock[]
	},
	updateRing: vi.fn()
}));
```

Also add `animationApi.animationState.audioBars.waveCrests` etc. are already in the mock — no change needed there.

- [ ] **Step 4.6: Run all tests**

```
npm run test:unit -- --run 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 4.7: Type-check**

```
npm run check 2>&1 | grep -v "animation.svelte.spec\|runtime.spec"
```

Expected: only the 2 pre-existing errors.

- [ ] **Step 4.8: Commit**

```bash
git add src/lib/components/RingWaveConfigItem.svelte \
        src/lib/components/AnimationSection.svelte \
        src/lib/components/AnimationSection.svelte.spec.ts
git commit -m "feat: per-ring wave config accordion in audioBars panel"
```

---

## Task 5 — Manual QA

- [ ] **Step 5.1: Start dev server**

```
npm run dev
```

Open `http://localhost:5173` in browser (Chromium preferred for Web Audio).

- [ ] **Step 5.2: Acceptance checklist**

- [ ] Set animation mode → Audio Bars. Audio panel shows global sliders (Wave crests, Amplitude gain, Phase speed, Smoothing, Input gain).
- [ ] Below global sliders, a "Wave per ring" accordion appears with N items (N = number of rings). Order matches ring list (Ring 1 = outermost or innermost, same as rings section).
- [ ] Open Ring 1 accordion item → shows WavePreview with Ring 1's shape + global wave defaults.
- [ ] Open Ring 4 accordion item → shows WavePreview with Ring 4's shape (different petal shape vs Ring 1). Same global defaults.
- [ ] Check "Customize wave for this ring" on Ring 4 → sliders appear, initialized to global values. Preview unchanged (copy of global = same).
- [ ] Move Phase speed slider on Ring 4 → Ring 4 preview animates at different speed. Other rings unaffected.
- [ ] Move global Wave crests slider → all rings WITHOUT override update. Ring 4 (with override) stays at its own crests.
- [ ] Uncheck "Customize wave for this ring" on Ring 4 → sliders hidden, preview returns to global defaults.
- [ ] Reload page → override on Ring 4 is gone (was removed). Any override set before reload survives reload with correct values. Logo is at rest (no frozen ripples).
- [ ] Add a ring in the rings section → new Ring N+1 appears in wave accordion. Remove it → accordion updates.
- [ ] Play audio → flower reacts per ring. Ring 4 with override uses different wave character from the rest.

- [ ] **Step 5.3: Final commit (if any fixups needed from QA)**

```bash
git add -p  # stage only relevant fixups
git commit -m "fix: <describe fixup>"
```

---

## Self-Review

### Spec coverage

| Brief requirement | Task |
|---|---|
| `WaveConfig = {crests, amplitudeGain, phaseSpeed}` | Task 1 |
| `ring.waveConfig?: WaveConfig \| null` on `Ring` | Task 1 |
| `resolveWaveConfig(ring, globalDefault)` pure helper | Task 1 |
| `waveConfig` persisted; `ring.wave` still stripped | Task 3 |
| Driver uses resolved config per ring | Task 2 |
| Global sliders stay (now represent defaults) | Task 4 |
| Accordion mirrors ring list, same order | Task 4 |
| No "Add Ring" in accordion | Task 4 (`{#each}` only — no add button) |
| Accordion syncs when rings added/removed | Task 4 (`{#each composition.rings as ring, i}`) |
| Per-ring WavePreview with resolved config + ring shape | Task 4 |
| Toggle OFF → null, hide sliders | Task 4 |
| Toggle ON → copy global default, show sliders | Task 4 |
| Test: resolveWaveConfig (no override / null / with override) | Task 1 |
| Test: driver uses resolved per-ring | Task 2 |
| Test: waveConfig persists; ring.wave stripped; reload at rest | Task 3 |
| All existing tests green | Tasks 2, 4 (makeDriver + mock updated) |
| lint / typecheck clean | Steps 1.6, 2.6, 4.7 |
| svelte-autofixer on .svelte files | Steps 4.2, 4.4 |

### Type consistency

- `WaveConfig` defined in `types.ts`, used in `wave.ts`, `audio-bars-driver.ts`, `RingWaveConfigItem.svelte`, `AnimationSection.svelte` — all consistent.
- `resolveWaveConfig` signature: `(ring: { waveConfig?: WaveConfig | null }, globalDefault: WaveConfig): WaveConfig` — called from driver with `Ring` (structural subtype) and from component with `Ring` — both valid.
- `globalDefault` in driver is `{ crests, amplitudeGain, phaseSpeed }` (satisfies `WaveConfig`) — consistent.
- `ring.waveConfig!` in per-ring sliders is safe: the `{#if hasOverride && ring.waveConfig}` guard ensures non-null.
