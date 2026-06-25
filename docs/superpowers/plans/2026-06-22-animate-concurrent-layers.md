# Animate: Concurrent Animation Layers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the animate workspace's single exclusive `animationState.mode` with independent concurrent **layers** (Simple, Data Series, Audio Bars, Audio Zones, Kaleidoscope), each with its own on/off switch, all riding the shared timeline clock.

**Architecture:** A generic `AnimatableParam` registry generalizes the kaleidoscope keyframe pattern so any slider can be keyframed. The runtime swaps its single `mode` for an **active set** of drivers that tick together — they write distinct ring properties (`morphT` / `wave` / `zoneDrive`) so they never collide. `AnimationSection` splits into one window per layer. Play becomes unconditionally activatable.

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, bun, vitest (node + browser modes), paper.js. Paraglide i18n (`messages/en.json` + `messages/it.json`).

## Global Constraints

- **Package manager: bun.** Single spec: `bun run test:unit -- run <path>` (`-t "name"` to filter). Full suite: `bun run test:unit -- run`. Types: `bun run check`.
- Every `.svelte` / `.svelte.ts` file touched MUST pass the Svelte MCP `svelte-autofixer` with `issues: []` before commit. IGNORE known false-positive *suggestions* (`bind:this`→attachment, "stateful-var called inside `$effect`"); gate on `issues: []` only. Pure `.ts` files need no autofixer.
- **Tab indentation** everywhere. Match surrounding code's idiom.
- Commit trailer on every commit: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Tailwind is absent in the vitest DOM.** Component tests assert structure / `data-testid` / ARIA / text content — NEVER computed layout or color.
- **Locale singleton leaks across browser specs.** Any `*.svelte.spec.ts` asserting English UI text MUST call `switchLocale('en')` in `beforeEach`.
- **Paraglide recompile race:** after editing `messages/*.json`, the first test run can transiently fail ~33 tests — rerun once. Generated `src/lib/paraglide/` is gitignored; `check` / `prepare` recompile it. Add BOTH `en.json` and `it.json` keys together.
- `bun run lint` is PRE-EXISTING RED (prettier/eslint debt on untouched files). NOT a gate. Do NOT run `prettier --write .`. Gates = `check` + unit tests + autofixer.
- New animatable params must keep getters/setters PURE factory functions (no module-level side effects) so they unit-test in isolation and create no import cycle with `animation.svelte.ts`.

---

## File Structure

**New files:**
- `src/lib/state/animatable-params.ts` — the generic `AnimatableParam` type + pure factory builders (`buildAudioBarsParams`, `buildAudioZonesParams`, `buildRingWaveParams`). No imports from `animation.svelte.ts` → no cycle.
- `src/lib/state/animatable-params.spec.ts` — pure unit tests for the factories.
- `src/lib/components/SimpleSection.svelte` — Simple layer window (switch + per-ring `morphT` sliders).
- `src/lib/components/DataSeriesSection.svelte` — disabled placeholder window.
- `src/lib/components/AudioBarsSection.svelte` — Audio Bars window (extracted from `AnimationSection`, switch + ⏱ sliders).
- `src/lib/components/AudioZonesSection.svelte` — Audio Zones window (extracted, switch + ⏱ sliders).
- Component specs for each new section.

**Modified files:**
- `src/lib/state/animation-drivers/runtime.ts` — `setMode` → `setActive(type, on)` + active `Set`; `tick` iterates all active drivers.
- `src/lib/state/animation.svelte.ts` — `mode` → `layers`; `setAnimationMode` → `setLayerEnabled`; build audio registries; `applyKaleidoscopeKeyframes` → `applyKeyframes`; `getAllAnimatableParams()` accessor; always-on play.
- `src/lib/state/kaleidoscope-params.ts` — re-type `KaleidoParam` as alias of `AnimatableParam`.
- `src/lib/components/AnimatableSlider.svelte` — prop retype `KaleidoParam` → `AnimatableParam`.
- `src/lib/components/KaleidoscopeSection.svelte` — add on/off switch bound to `layers.kaleidoscope`.
- `src/lib/components/TimelinePanel.svelte` — drop `blockPlayback` gating; `armedParams` from all registries.
- `src/lib/components/RingEditor.svelte` — remove the `morphT` slider + readout (drawing stays).
- `src/routes/(app)/animate/+page.svelte` — render the per-layer windows in order.
- `messages/en.json` + `messages/it.json` — new copy keys.

---

## Phase / Task map

- **Task 1** — Generic param registry (pure factories + `applyKeyframes` rename). No UI/behavior change.
- **Task 2** — Runtime: single mode → active set.
- **Task 3** — State: `mode` → `layers`; `setLayerEnabled`; tick drives active set; kaleidoscope gate.
- **Task 4** — Window split + switches (Simple / Data Series / Audio Bars / Audio Zones), Kaleidoscope switch, route wiring.
- **Task 5** — Play always active (TimelinePanel + start guard); `armedParams` from all registries.
- **Task 6** — Stopwatch on audio sliders + move `morphT` slider editor → Simple.

---

## Task 1: Generic param registry

Generalize the kaleidoscope `KaleidoParam` into a shared `AnimatableParam` and route the keyframe apply-loop through every registry. No UI or runtime behavior changes yet (no audio tracks are armed, so walking them is a no-op).

**Files:**
- Create: `src/lib/state/animatable-params.ts`
- Create: `src/lib/state/animatable-params.spec.ts`
- Modify: `src/lib/state/kaleidoscope-params.ts:15-23` (re-type `KaleidoParam`)
- Modify: `src/lib/state/animation.svelte.ts` (build audio registries, add `getAllAnimatableParams`, rename apply-loop)
- Modify: `src/lib/state/animation.svelte.spec.ts:480,491,507,521,533,552` (rename call site)
- Modify: `src/lib/components/AnimatableSlider.svelte:5` (prop type import)

**Interfaces:**
- Produces:
  - `type AnimatableParam = { id: string; label: string; min: number; max: number; step: number; get(): number; set(v: number): void }`
  - `buildAudioBarsParams(deps: { getConfig(): AudioBarsConfig; setConfig(p: Partial<AudioBarsConfig>): void; labels: AudioBarsParamLabels }): AnimatableParam[]`
  - `buildAudioZonesParams(deps: { getIntensity(): ZoneIntensity; setIntensity(p: Partial<ZoneIntensity>): void; labels: AudioZonesParamLabels }): AnimatableParam[]`
  - `buildRingWaveParams(rings: Ring[], deps: { updateRing(i: number, patch: Partial<Ring>): void; globalDefault(): WaveConfig; ringLabel(i: number): string }): AnimatableParam[]`
  - From `animation.svelte.ts`: `getAllAnimatableParams(): AnimatableParam[]`, `applyKeyframes(progress: number): void` (renamed from `applyKaleidoscopeKeyframes`).
- Consumes: `AudioBarsConfig` from `./animation-drivers/types`; `ZoneIntensity`, `Ring`, `WaveConfig` from `$lib/types`.

- [ ] **Step 1: Write the failing factory tests**

Create `src/lib/state/animatable-params.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
	buildAudioBarsParams,
	buildAudioZonesParams,
	buildRingWaveParams
} from './animatable-params';
import type { AudioBarsConfig } from './animation-drivers/types';
import type { Ring, WaveConfig } from '$lib/types';

const barsLabels = {
	inputGain: 'Gain',
	waveCrests: 'Crests',
	waveAmplitudeGain: 'Amplitude',
	wavePhaseSpeed: 'Phase',
	smoothing: 'Smoothing'
};

function makeBarsConfig(): AudioBarsConfig {
	return {
		smoothing: 0.5,
		minHz: 20,
		maxHz: 20000,
		waveCrests: 3,
		waveAmplitudeGain: 0.3,
		wavePhaseSpeed: 2.2,
		inputGain: 1
	};
}

describe('buildAudioBarsParams', () => {
	it('exposes one param per animatable bars field with stable ids', () => {
		const cfg = makeBarsConfig();
		const params = buildAudioBarsParams({
			getConfig: () => cfg,
			setConfig: () => {},
			labels: barsLabels
		});
		expect(params.map((p) => p.id)).toEqual([
			'audioBars.inputGain',
			'audioBars.waveCrests',
			'audioBars.waveAmplitudeGain',
			'audioBars.wavePhaseSpeed',
			'audioBars.smoothing'
		]);
	});

	it('get reads live config; set routes through setConfig', () => {
		let cfg = makeBarsConfig();
		const params = buildAudioBarsParams({
			getConfig: () => cfg,
			setConfig: (patch) => (cfg = { ...cfg, ...patch }),
			labels: barsLabels
		});
		const crests = params.find((p) => p.id === 'audioBars.waveCrests')!;
		expect(crests.get()).toBe(3);
		crests.set(5);
		expect(cfg.waveCrests).toBe(5);
	});
});

describe('buildAudioZonesParams', () => {
	it('exposes bass/mid/treble params routing through setIntensity', () => {
		let intensity = { bass: 0.5, mid: 0.5, treble: 0.5 };
		const params = buildAudioZonesParams({
			getIntensity: () => intensity,
			setIntensity: (patch) => (intensity = { ...intensity, ...patch }),
			labels: { bass: 'Bass', mid: 'Mid', treble: 'Treble' }
		});
		expect(params.map((p) => p.id)).toEqual([
			'audioZones.bass',
			'audioZones.mid',
			'audioZones.treble'
		]);
		params.find((p) => p.id === 'audioZones.mid')!.set(0.9);
		expect(intensity.mid).toBe(0.9);
	});
});

describe('buildRingWaveParams', () => {
	const globalDefault: WaveConfig = { crests: 3, amplitudeGain: 0.3, phaseSpeed: 2.2 };

	function ringWithOverride(): Ring {
		return {
			waveConfig: { crests: 2, amplitudeGain: 0.4, phaseSpeed: 1 }
		} as Ring;
	}

	it('builds per-ring descriptors only for rings with a wave override', () => {
		const rings = [ringWithOverride(), {} as Ring];
		const params = buildRingWaveParams(rings, {
			updateRing: () => {},
			globalDefault: () => globalDefault,
			ringLabel: (i) => `Ring ${i + 1}`
		});
		// ring 0 has override → 3 params; ring 1 has none → 0 params
		expect(params.map((p) => p.id)).toEqual([
			'ring.0.wave.crests',
			'ring.0.wave.amplitudeGain',
			'ring.0.wave.phaseSpeed'
		]);
	});

	it('set patches the ring waveConfig via updateRing, preserving siblings', () => {
		const ring = ringWithOverride();
		const calls: Array<[number, Partial<Ring>]> = [];
		const params = buildRingWaveParams([ring], {
			updateRing: (i, patch) => calls.push([i, patch]),
			globalDefault: () => globalDefault,
			ringLabel: (i) => `Ring ${i + 1}`
		});
		params.find((p) => p.id === 'ring.0.wave.crests')!.set(6);
		expect(calls).toEqual([[0, { waveConfig: { crests: 6, amplitudeGain: 0.4, phaseSpeed: 1 } }]]);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test:unit -- run src/lib/state/animatable-params.spec.ts`
Expected: FAIL — `Failed to resolve import "./animatable-params"`.

- [ ] **Step 3: Implement the factories**

Create `src/lib/state/animatable-params.ts`:

```ts
import type { AudioBarsConfig } from './animation-drivers/types';
import type { Ring, WaveConfig, ZoneIntensity } from '$lib/types';
import { resolveWaveConfig } from '$lib/geometry/wave';

// Everything a caller must know to drive one keyframable slider: a stable track id,
// a label, the slider bounds, and a get/set pair. Structurally identical to the old
// KaleidoParam — the kaleidoscope registry is now one consumer of this shape, not its owner.
export type AnimatableParam = {
	id: string;
	label: string;
	min: number;
	max: number;
	step: number;
	get(): number;
	set(v: number): void;
};

export type AudioBarsParamLabels = {
	inputGain: string;
	waveCrests: string;
	waveAmplitudeGain: string;
	wavePhaseSpeed: string;
	smoothing: string;
};

export type AudioZonesParamLabels = {
	bass: string;
	mid: string;
	treble: string;
};

export function buildAudioBarsParams(deps: {
	getConfig: () => AudioBarsConfig;
	setConfig: (patch: Partial<AudioBarsConfig>) => void;
	labels: AudioBarsParamLabels;
}): AnimatableParam[] {
	const { getConfig, setConfig, labels } = deps;
	return [
		{ id: 'audioBars.inputGain', label: labels.inputGain, min: 0.5, max: 4, step: 0.1, get: () => getConfig().inputGain, set: (v) => setConfig({ inputGain: v }) },
		{ id: 'audioBars.waveCrests', label: labels.waveCrests, min: 1, max: 8, step: 1, get: () => getConfig().waveCrests, set: (v) => setConfig({ waveCrests: v }) },
		{ id: 'audioBars.waveAmplitudeGain', label: labels.waveAmplitudeGain, min: 0, max: 1, step: 0.01, get: () => getConfig().waveAmplitudeGain, set: (v) => setConfig({ waveAmplitudeGain: v }) },
		{ id: 'audioBars.wavePhaseSpeed', label: labels.wavePhaseSpeed, min: 0, max: 6, step: 0.1, get: () => getConfig().wavePhaseSpeed, set: (v) => setConfig({ wavePhaseSpeed: v }) },
		{ id: 'audioBars.smoothing', label: labels.smoothing, min: 0, max: 0.95, step: 0.05, get: () => getConfig().smoothing, set: (v) => setConfig({ smoothing: v }) }
	];
}

export function buildAudioZonesParams(deps: {
	getIntensity: () => ZoneIntensity;
	setIntensity: (patch: Partial<ZoneIntensity>) => void;
	labels: AudioZonesParamLabels;
}): AnimatableParam[] {
	const { getIntensity, setIntensity, labels } = deps;
	const band = (key: keyof ZoneIntensity, label: string): AnimatableParam => ({
		id: `audioZones.${key}`,
		label,
		min: 0,
		max: 1,
		step: 0.01,
		get: () => getIntensity()[key],
		set: (v) => setIntensity({ [key]: v })
	});
	return [band('bass', labels.bass), band('mid', labels.mid), band('treble', labels.treble)];
}

// Per-ring wave overrides are DYNAMIC: a ring only contributes params while its
// `waveConfig` override is on, and ids carry the live index. Build from the current
// rings array every call — never cache indices across add/remove.
export function buildRingWaveParams(
	rings: Ring[],
	deps: {
		updateRing: (index: number, patch: Partial<Ring>) => void;
		globalDefault: () => WaveConfig;
		ringLabel: (index: number) => string;
	}
): AnimatableParam[] {
	const params: AnimatableParam[] = [];
	rings.forEach((ring, index) => {
		if (ring.waveConfig == null) return;
		const label = deps.ringLabel(index);
		const resolved = () => resolveWaveConfig(rings[index], deps.globalDefault());
		const patchWave = (patch: Partial<WaveConfig>) =>
			deps.updateRing(index, { waveConfig: { ...resolved(), ...patch } });
		params.push(
			{ id: `ring.${index}.wave.crests`, label: `${label} · crests`, min: 1, max: 8, step: 1, get: () => resolved().crests, set: (v) => patchWave({ crests: v }) },
			{ id: `ring.${index}.wave.amplitudeGain`, label: `${label} · amplitude`, min: 0, max: 1, step: 0.01, get: () => resolved().amplitudeGain, set: (v) => patchWave({ amplitudeGain: v }) },
			{ id: `ring.${index}.wave.phaseSpeed`, label: `${label} · phase`, min: 0, max: 6, step: 0.1, get: () => resolved().phaseSpeed, set: (v) => patchWave({ phaseSpeed: v }) }
		);
	});
	return params;
}
```

> NOTE: the test's `set(6)` on crests expects the exact patch `{ waveConfig: { crests: 6, amplitudeGain: 0.4, phaseSpeed: 1 } }`. `resolveWaveConfig` on a ring whose `waveConfig` is `{crests:2,amplitudeGain:0.4,phaseSpeed:1}` returns those override values verbatim, so `{...resolved(), crests:6}` produces the expected object. Confirm `resolveWaveConfig`'s field names match (`crests`/`amplitudeGain`/`phaseSpeed`) — they do per `RingWaveConfigItem.svelte:53-55`.

- [ ] **Step 4: Run the factory tests to verify they pass**

Run: `bun run test:unit -- run src/lib/state/animatable-params.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Re-type `KaleidoParam` as an alias**

In `src/lib/state/kaleidoscope-params.ts`, replace the local `export type KaleidoParam = {...}` (lines 15-23) with:

```ts
import type { AnimatableParam } from './animatable-params';

// Kaleidoscope params are one registry of the generic animatable shape.
export type KaleidoParam = AnimatableParam;
```

Keep the `KALEIDO_PARAMS` array and `KALEIDO_PARAM_BY_ID` unchanged.

- [ ] **Step 6: Build the audio registries + accessor in `animation.svelte.ts`, rename the apply-loop**

In `src/lib/state/animation.svelte.ts`:

1. Add imports near the existing param import:

```ts
import { KALEIDO_PARAMS } from './kaleidoscope-params';
import {
	buildAudioBarsParams,
	buildAudioZonesParams,
	buildRingWaveParams,
	type AnimatableParam
} from './animatable-params';
import { updateRing } from './composition';
import { m } from '$lib/paraglide/messages';
```

(Add `updateRing` to the existing `./composition` import line instead of a duplicate import.)

2. After the driver registrations, add the audio registries (static) and a live accessor:

```ts
const AUDIO_BARS_PARAMS = buildAudioBarsParams({
	getConfig: () => animationState.audioBars,
	setConfig: setAudioBarsConfig,
	get labels() {
		return {
			inputGain: m.animate_input_gain(),
			waveCrests: m.animate_wave_crests(),
			waveAmplitudeGain: m.animate_amplitude_gain(),
			wavePhaseSpeed: m.animate_phase_speed(),
			smoothing: m.animate_smoothing()
		};
	}
} as Parameters<typeof buildAudioBarsParams>[0]);

const AUDIO_ZONES_PARAMS = buildAudioZonesParams({
	getIntensity: () => animationState.audioZones.defaultIntensity,
	setIntensity: setAudioZonesDefaultIntensity,
	get labels() {
		return {
			bass: m.animate_zone_bass(),
			mid: m.animate_zone_mid(),
			treble: m.animate_zone_treble()
		};
	}
} as Parameters<typeof buildAudioZonesParams>[0]);

/**
 * Every keyframable param across all registries, resolved against live state.
 * Per-ring wave params are rebuilt each call from `composition.rings` so they
 * track ring add/remove without stale indices.
 */
export function getAllAnimatableParams(): AnimatableParam[] {
	const globalDefault = {
		crests: animationState.audioBars.waveCrests,
		amplitudeGain: animationState.audioBars.waveAmplitudeGain,
		phaseSpeed: animationState.audioBars.wavePhaseSpeed
	};
	return [
		...KALEIDO_PARAMS,
		...AUDIO_BARS_PARAMS,
		...AUDIO_ZONES_PARAMS,
		...buildRingWaveParams(composition.rings, {
			updateRing,
			globalDefault: () => globalDefault,
			ringLabel: (i) => m.editor_ring_label({ index: i + 1 })
		})
	];
}
```

> The `labels` getter inside the deps object means `buildAudioBarsParams` reads it once at build time — but `label` itself is consumed lazily by the UI through `m.*()`. To keep labels locale-reactive like `KALEIDO_PARAMS`, the simplest equivalent is to make each audio param's `label` a getter. If the structural-getter form above doesn't resolve locale on switch in the UI, fall back to defining the audio registries with getter `label` fields exactly like `KALEIDO_PARAMS` does (lines 32-34). Prefer the latter if unsure — it's the proven pattern.

3. Rename `applyKaleidoscopeKeyframes` → `applyKeyframes` and walk all registries:

```ts
/**
 * Applies every armed keyframe track at the given normalized progress. Walks every
 * registry (kaleidoscope + audio + per-ring wave). A disabled/empty track returns
 * null and leaves the static slider value in place. Discrete params are rounded by
 * their setters.
 */
export function applyKeyframes(progress: number): void {
	for (const p of getAllAnimatableParams()) {
		const v = keyframes.sampleParam(p.id, progress);
		if (v !== null) p.set(v);
	}
}
```

4. Update the two internal callers (`scrubTo`, `refreshPreview`, and the `tick` body) from `applyKaleidoscopeKeyframes(...)` to `applyKeyframes(...)`. There are 3 internal call sites: `scrubTo` (line ~225), `refreshPreview` (line ~235), `tick` (line ~282).

- [ ] **Step 7: Update the spec call sites**

In `src/lib/state/animation.svelte.spec.ts`, replace all 6 occurrences of `animation.applyKaleidoscopeKeyframes(` with `animation.applyKeyframes(` (lines 480, 491, 507, 521, 533, 552).

- [ ] **Step 8: Add a regression test — an armed audio track applies through `applyKeyframes`**

Append to `src/lib/state/animation.svelte.spec.ts` (mirror the existing kaleidoscope keyframe tests' setup):

```ts
it('applyKeyframes drives an armed audioBars param', async () => {
	const animation = await import('./animation.svelte');
	const { keyframes } = await import('./keyframes.svelte');
	keyframes.ensureTrack('audioBars.waveCrests');
	keyframes.setTrackEnabled('audioBars.waveCrests', true);
	keyframes.upsertKeyframeAtTime('audioBars.waveCrests', 0, 1);
	keyframes.upsertKeyframeAtTime('audioBars.waveCrests', 1, 8);

	animation.applyKeyframes(0.5);

	expect(animation.animationState.audioBars.waveCrests).toBeCloseTo(4.5, 1);
});
```

> Check the file's existing import style — if it imports `animation` once at top, reuse that binding instead of re-importing. Adapt to the established pattern in the file.

- [ ] **Step 9: Retype `AnimatableSlider` prop**

In `src/lib/components/AnimatableSlider.svelte:5`, change:

```ts
import type { KaleidoParam } from '$lib/state/kaleidoscope-params';
```
to:
```ts
import type { AnimatableParam } from '$lib/state/animatable-params';
```
and on line 7 change the prop type `param: KaleidoParam` → `param: AnimatableParam`. (`KaleidoParam` is now an alias of the same type, so this is a no-op at runtime; do it for clarity since the slider is no longer kaleidoscope-specific.)

- [ ] **Step 10: Autofix the touched Svelte file**

Run the Svelte MCP `svelte-autofixer` on `AnimatableSlider.svelte`. Confirm `issues: []`.

- [ ] **Step 11: Run check + full unit suite**

Run: `bun run check`
Expected: 0 errors.

Run: `bun run test:unit -- run`
Expected: all green (rerun once if the paraglide race trips it).

- [ ] **Step 12: Commit**

```bash
git add src/lib/state/animatable-params.ts src/lib/state/animatable-params.spec.ts src/lib/state/kaleidoscope-params.ts src/lib/state/animation.svelte.ts src/lib/state/animation.svelte.spec.ts src/lib/components/AnimatableSlider.svelte
git commit -m "feat(animate): generic AnimatableParam registry, applyKeyframes walks all registries

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Runtime — single mode → active set

Replace the runtime's single `mode` with an active `Set` of driver types. `tick` ticks every active driver; because drivers write distinct ring properties (simple→morphT map via `applyRingT`, audio→wave/zoneDrive self-applied, returning `{}`), concurrent ticks don't collide.

**Files:**
- Modify: `src/lib/state/animation-drivers/runtime.ts`
- Modify: `src/lib/state/animation-drivers/runtime.spec.ts`

**Interfaces:**
- Produces: `createAnimationRuntime(deps).setActive(type: AnimationDriverType, on: boolean): void` (replaces `setMode`); `tick(nowMs)` ticks all active drivers; `registerDriver` unchanged signature but keyed off membership in the active set.
- Consumes: `AnimationDriverType` from `./types`.

- [ ] **Step 1: Write the failing runtime tests**

Add to `src/lib/state/animation-drivers/runtime.spec.ts` (study the existing `setMode` tests first and convert/extend them):

```ts
it('setActive(on) inits a driver once; setActive(off) disposes once', () => {
	const applyRingT = vi.fn();
	const rt = createAnimationRuntime({ applyRingT });
	const init = vi.fn();
	const dispose = vi.fn();
	rt.registerDriver('simple', { init, dispose, frame: () => ({}) });

	rt.setActive('simple', true);
	rt.setActive('simple', true); // idempotent
	expect(init).toHaveBeenCalledTimes(1);

	rt.setActive('simple', false);
	rt.setActive('simple', false); // idempotent
	expect(dispose).toHaveBeenCalledTimes(1);
});

it('tick applies every active driver frame; distinct properties coexist', () => {
	const applyRingT = vi.fn();
	const rt = createAnimationRuntime({ applyRingT });
	rt.registerDriver('simple', { init() {}, dispose() {}, frame: () => ({ 0: 0.5 }) });
	const audioFrame = vi.fn(() => ({})); // audio self-applies, returns no morph map
	rt.registerDriver('audioBars', { init() {}, dispose() {}, frame: audioFrame });

	rt.setActive('simple', true);
	rt.setActive('audioBars', true);
	rt.tick(100);

	expect(applyRingT).toHaveBeenCalledWith(0, 0.5);
	expect(audioFrame).toHaveBeenCalledWith(100);
});

it('registering a driver that is already active inits it immediately', () => {
	const rt = createAnimationRuntime({ applyRingT: vi.fn() });
	rt.setActive('simple', true); // active before registration
	const init = vi.fn();
	rt.registerDriver('simple', { init, dispose() {}, frame: () => ({}) });
	expect(init).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run test:unit -- run src/lib/state/animation-drivers/runtime.spec.ts`
Expected: FAIL — `rt.setActive is not a function`.

- [ ] **Step 3: Rewrite the runtime**

Replace the body of `src/lib/state/animation-drivers/runtime.ts`:

```ts
import type { AnimationDriverType } from './types';

type AnimationDriver = {
	init: () => void;
	dispose: () => void;
	frame: (nowMs: number) => Record<number, number>;
};

type RuntimeDeps = {
	applyRingT: (index: number, t: number) => void;
};

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function createAnimationRuntime(deps: RuntimeDeps) {
	const drivers = new Map<AnimationDriverType, AnimationDriver>();
	const active = new Set<AnimationDriverType>();

	function registerDriver(type: AnimationDriverType, driver: AnimationDriver): void {
		const previousDriver = drivers.get(type);
		drivers.set(type, driver);
		// Contract preserved: registering a driver whose type is already active
		// disposes the previous (if any) and inits the new exactly once.
		if (active.has(type)) {
			previousDriver?.dispose();
			driver.init();
		}
	}

	function setActive(type: AnimationDriverType, on: boolean): void {
		if (on === active.has(type)) return;
		if (on) {
			active.add(type);
			drivers.get(type)?.init();
		} else {
			active.delete(type);
			drivers.get(type)?.dispose();
		}
	}

	function tick(nowMs: number): void {
		for (const type of active) {
			const frame = drivers.get(type)?.frame(nowMs) ?? {};
			for (const [rawIndex, rawT] of Object.entries(frame)) {
				const index = Number(rawIndex);
				if (!Number.isInteger(index) || index < 0) continue;
				deps.applyRingT(index, clamp01(rawT));
			}
		}
	}

	return {
		registerDriver,
		setActive,
		tick
	};
}
```

- [ ] **Step 4: Run runtime tests to verify they pass**

Run: `bun run test:unit -- run src/lib/state/animation-drivers/runtime.spec.ts`
Expected: PASS.

> If old `setMode` tests remain in the spec, convert them to `setActive` equivalents — `setMode(null)` becomes `setActive(prev, false)`; `setMode('x')` becomes `setActive('x', true)`. There must be no remaining `setMode` references in the spec after this step.

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/animation-drivers/runtime.ts src/lib/state/animation-drivers/runtime.spec.ts
git commit -m "feat(animate): runtime active-set of drivers replaces single mode

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: State — `mode` → `layers`, `setLayerEnabled`, concurrent tick, kaleidoscope gate

Swap `animationState.mode` for an independent `layers` record. Drive the runtime's active set from the layer flags. Gate kaleidoscope keyframe application behind `layers.kaleidoscope`.

**Files:**
- Modify: `src/lib/state/animation.svelte.ts`
- Modify: `src/lib/state/animation.svelte.spec.ts`

**Interfaces:**
- Produces:
  - `type AnimationLayer = 'simple' | 'audioBars' | 'audioZones' | 'dataSeries' | 'kaleidoscope'`
  - `type AnimationLayers = Record<AnimationLayer, boolean>`
  - `animationState.layers: AnimationLayers` (replaces `animationState.mode`)
  - `setLayerEnabled(layer: AnimationLayer, on: boolean): void` (replaces `setAnimationMode`)
- Consumes: `runtime.setActive` (Task 2); `getAllAnimatableParams` / `applyKeyframes` (Task 1).

- [ ] **Step 1: Write the failing state tests**

Add to `src/lib/state/animation.svelte.spec.ts`:

```ts
it('defaults to simple layer on, others off', async () => {
	const { animationState } = await import('./animation.svelte');
	expect(animationState.layers.simple).toBe(true);
	expect(animationState.layers.audioBars).toBe(false);
	expect(animationState.layers.audioZones).toBe(false);
	expect(animationState.layers.kaleidoscope).toBe(true);
});

it('setLayerEnabled toggles a layer independently of the others', async () => {
	const animation = await import('./animation.svelte');
	animation.setLayerEnabled('simple', true);
	animation.setLayerEnabled('audioBars', true);
	expect(animation.animationState.layers.simple).toBe(true);
	expect(animation.animationState.layers.audioBars).toBe(true);
});

it('turning off the last audio layer stops the audio source', async () => {
	const animation = await import('./animation.svelte');
	const stopSpy = vi.spyOn(animation.audioSource, 'stop');
	animation.setLayerEnabled('audioBars', true);
	animation.setLayerEnabled('audioZones', false);
	stopSpy.mockClear();
	animation.setLayerEnabled('audioBars', false); // last audio layer off
	expect(stopSpy).toHaveBeenCalled();
});

it('layers.kaleidoscope=false skips kaleidoscope keyframe application', async () => {
	const animation = await import('./animation.svelte');
	const { keyframes } = await import('./keyframes.svelte');
	const { kaleidoscope } = await import('./kaleidoscope.svelte');
	keyframes.ensureTrack('kaleidoscope.globalRotation');
	keyframes.setTrackEnabled('kaleidoscope.globalRotation', true);
	keyframes.upsertKeyframeAtTime('kaleidoscope.globalRotation', 0, 0);
	keyframes.upsertKeyframeAtTime('kaleidoscope.globalRotation', 1, 360);

	animation.setLayerEnabled('kaleidoscope', false);
	const before = kaleidoscope.globalRotation;
	animation.applyKeyframes(0.5);
	expect(kaleidoscope.globalRotation).toBe(before); // gated → unchanged

	animation.setLayerEnabled('kaleidoscope', true);
	animation.applyKeyframes(0.5);
	expect(kaleidoscope.globalRotation).toBeCloseTo(180, 0);
});
```

> These tests share the module-level singleton. Reset layer state at the top of each (`setLayerEnabled(...)`) rather than assuming order. Match the file's existing reset discipline (it already resets state between tests).

- [ ] **Step 2: Run to verify failure**

Run: `bun run test:unit -- run src/lib/state/animation.svelte.spec.ts`
Expected: FAIL — `animationState.layers` undefined / `setLayerEnabled is not a function`.

- [ ] **Step 3: Replace `mode` with `layers` in the state type + default**

In `src/lib/state/animation.svelte.ts`:

1. Replace the `AnimationMode` type (line 19) and the `mode` field:

```ts
export type AnimationLayer = 'simple' | 'audioBars' | 'audioZones' | 'dataSeries' | 'kaleidoscope';
export type AnimationLayers = Record<AnimationLayer, boolean>;

const AUDIO_LAYERS: AnimationLayer[] = ['audioBars', 'audioZones'];
```

In `AnimationState`, replace `mode: AnimationMode;` with `layers: AnimationLayers;`.

In the `$state<AnimationState>({...})` default, replace `mode: 'simple',` with:

```ts
	layers: { simple: true, audioBars: false, audioZones: false, dataSeries: false, kaleidoscope: true },
```

- [ ] **Step 4: Replace `setAnimationMode` with `setLayerEnabled`**

Replace the `setAnimationMode` function (lines 351-362) with:

```ts
export function setLayerEnabled(layer: AnimationLayer, on: boolean): void {
	if (animationState.layers[layer] === on) return;

	// Turning off the last active audio layer tears down the live audio source,
	// preserving the old single-mode teardown behaviour.
	const wasAudio = layer === 'audioBars' || layer === 'audioZones';
	animationState.layers = { ...animationState.layers, [layer]: on };
	if (wasAudio && !on) {
		const anyAudioLeft = AUDIO_LAYERS.some((l) => animationState.layers[l]);
		if (!anyAudioLeft) audioSource.stop();
	}

	// dataSeries is a placeholder — never feed it to the runtime.
	// kaleidoscope is gated in applyKeyframes, not a driver.
	if (layer !== 'dataSeries' && layer !== 'kaleidoscope' && animationState.isPlaying) {
		runtime.setActive(layer, on);
	}
}
```

- [ ] **Step 5: Gate kaleidoscope in `applyKeyframes`**

Update `applyKeyframes` (from Task 1) so kaleidoscope params only apply when the layer is on:

```ts
export function applyKeyframes(progress: number): void {
	const kaleidoOn = animationState.layers.kaleidoscope;
	for (const p of getAllAnimatableParams()) {
		if (!kaleidoOn && p.id.startsWith('kaleidoscope.')) continue;
		const v = keyframes.sampleParam(p.id, progress);
		if (v !== null) p.set(v);
	}
}
```

- [ ] **Step 6: Drive the active set from layers in `tick` and lifecycle**

Replace the mode-driven branches:

1. In `tick` (lines 273-282), replace:

```ts
	if (hasRunnableMode()) {
		runtime.tick(logicalElapsedMs);
		animationState.progress = progress;
	} else {
		applyMorphT(progress);
		animationState.progress = progress;
	}

	// Kaleidoscope keyframes ride the same clock regardless of driver mode.
	applyKaleidoscopeKeyframes(progress);
```
with:
```ts
	runtime.tick(logicalElapsedMs);
	animationState.progress = progress;

	// Keyframes ride the same clock regardless of which layers drive.
	applyKeyframes(progress);
```

2. In `startNewAnimation` (lines 306-308), replace the `if (animationState.mode) { runtime.setMode(animationState.mode); }` with a sync of every driver layer:

```ts
	syncActiveDrivers();
```

3. In `togglePlay` resume branch (lines 414-416), replace `if (animationState.mode) { runtime.setMode(animationState.mode); }` with `syncActiveDrivers();`.

4. Add the helper near the other private helpers:

```ts
// Mirror the runtime's active set onto the current layer flags. dataSeries is a
// placeholder (never runs); kaleidoscope is gated in applyKeyframes, not a driver.
function syncActiveDrivers(): void {
	runtime.setActive('simple', animationState.layers.simple);
	runtime.setActive('audioBars', animationState.layers.audioBars);
	runtime.setActive('audioZones', animationState.layers.audioZones);
}
```

5. In `stopInternal` (line 180), replace `runtime.setMode(null);` with:

```ts
	runtime.setActive('simple', false);
	runtime.setActive('audioBars', false);
	runtime.setActive('audioZones', false);
```

- [ ] **Step 7: Replace `mode`-based predicates and audio checks**

Several helpers branch on `animationState.mode`. Update:

1. `hasRunnableMode()` (lines 192-194) — replace its body:

```ts
function hasRunnableMode(): boolean {
	return animationState.layers.simple || animationState.layers.audioBars || animationState.layers.audioZones;
}
```

2. `hasCompleted` (line 252) — replace the audio check:

```ts
	if (animationState.layers.audioBars || animationState.layers.audioZones) return false;
```

3. `handleCompositionChanged` (line 448) — replace `if (animationState.mode) {` with:

```ts
	if (animationState.layers.audioBars || animationState.layers.audioZones || animationState.layers.simple) {
```

> The morph-reset path (`animatedIndices` / `applyMorphT(0)` in `stopInternal`) stays as the "return rings to rest" mechanism on stop. The simple **driver** now produces morph during playback; `applyMorphT` is only used to zero rings on stop. Leave `getMorphRingIndices` / `applyMorphT` in place for that.

- [ ] **Step 8: Audit for leftover `mode` references**

Run: `grep -n "\.mode\b\|setAnimationMode\|AnimationMode\|hasRunnableMode\|runtime.setMode\|applyKaleidoscopeKeyframes" src/lib/state/animation.svelte.ts`
Expected: no matches except the renamed `hasRunnableMode` definition/uses (which now read `layers`). Fix any stragglers. There must be NO `animationState.mode` or `setMode` references left.

- [ ] **Step 9: Run state tests + full check**

Run: `bun run test:unit -- run src/lib/state/animation.svelte.spec.ts`
Expected: PASS (new tests green; pre-existing tests that referenced `mode` must be updated to `layers` / `setLayerEnabled` — update them in the same step).

Run: `bun run check`
Expected: 0 errors. (`AnimationSection.svelte` and `TimelinePanel.svelte` still reference `animationState.mode` / `setAnimationMode` — they're fixed in Tasks 4-5. If `check` flags them now, that's expected; this task's gate is the state spec + the state file compiling. Proceed to Task 4 to clear them, OR temporarily keep this task green by noting these two components are updated next. Prefer: do Task 4 + 5 before re-running a clean full `check`.)

> **Sequencing note:** Tasks 3, 4, 5 together remove `mode`. A fully-green `bun run check` and `bun run test:unit -- run` is expected only after Task 5. Commit Task 3 with the state spec passing; the cross-file `check` clears at Task 5.

- [ ] **Step 10: Commit**

```bash
git add src/lib/state/animation.svelte.ts src/lib/state/animation.svelte.spec.ts
git commit -m "feat(animate): concurrent layers model replaces exclusive mode

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Window split + switches + route

Split `AnimationSection` into one window per layer, each a `SidebarCollapsible` with an on/off switch bound to `setLayerEnabled`. Add a switch to `KaleidoscopeSection`. Wire the animate route to render them in order. (Audio sliders keep their current plain-`<input>` form here; the ⏱ stopwatch wiring lands in Task 6.)

**Files:**
- Create: `src/lib/components/SimpleSection.svelte` + spec
- Create: `src/lib/components/DataSeriesSection.svelte` + spec
- Create: `src/lib/components/AudioBarsSection.svelte` + spec
- Create: `src/lib/components/AudioZonesSection.svelte` + spec
- Modify: `src/lib/components/KaleidoscopeSection.svelte` (add switch)
- Modify: `src/routes/(app)/animate/+page.svelte`
- Delete: `src/lib/components/AnimationSection.svelte` + `AnimationSection.svelte.spec.ts`
- Modify: `messages/en.json` + `messages/it.json` (new copy keys)

**Interfaces:**
- Consumes: `setLayerEnabled`, `animationState.layers` (Task 3); existing `setAudioBarsConfig`, `setAudioZonesDefaultIntensity`, `setAudioSource`, `audioSource`, `setRingMorphT`, `composition`.
- Produces: four window components + a Kaleidoscope switch, all driven by `data-testid` switches.

- [ ] **Step 1: Add copy keys (both locales)**

In `messages/en.json` add:

```json
	"animate_layer_simple": "Simple",
	"animate_layer_data_series": "Data Series",
	"animate_layer_audio_bars": "Audio Bars",
	"animate_layer_audio_zones": "Audio Zones",
	"animate_layer_toggle": "Enable layer",
	"animate_data_series_unavailable": "Mode not available yet.",
	"animate_simple_empty": "Draw a second shape in the editor to morph a ring.",
	"animate_kaleidoscope_layer_toggle": "Animate kaleidoscope"
```

In `messages/it.json` add the matching keys:

```json
	"animate_layer_simple": "Simple",
	"animate_layer_data_series": "Data Series",
	"animate_layer_audio_bars": "Audio Bars",
	"animate_layer_audio_zones": "Audio Zones",
	"animate_layer_toggle": "Attiva livello",
	"animate_data_series_unavailable": "Modalità non ancora disponibile.",
	"animate_simple_empty": "Disegna una seconda forma nell'editor per fare il morph di un anello.",
	"animate_kaleidoscope_layer_toggle": "Anima caleidoscopio"
```

- [ ] **Step 2: Write the failing SimpleSection test**

Create `src/lib/components/SimpleSection.svelte.spec.ts`:

```ts
import { render } from 'vitest-browser-svelte';
import { describe, it, expect, beforeEach } from 'vitest';
import { switchLocale } from '$lib/state/locale.svelte';
import { setLayerEnabled, animationState } from '$lib/state/animation.svelte';
import SimpleSection from './SimpleSection.svelte';

describe('SimpleSection', () => {
	beforeEach(() => {
		switchLocale('en');
		setLayerEnabled('simple', true);
	});

	it('switch toggles the simple layer', async () => {
		const { getByTestId } = render(SimpleSection);
		const toggle = getByTestId('layer-toggle-simple');
		await toggle.element().click();
		expect(animationState.layers.simple).toBe(false);
	});
});
```

> Confirm the test import path for `setLayerEnabled` / `animationState`. Task 3 exports them from `animation.svelte.ts`; the existing barrel `animation.ts` re-exports `./animation.svelte`. Use whichever path the sibling specs use (likely `$lib/state/animation`).

- [ ] **Step 3: Run to verify failure**

Run: `bun run test:unit -- run src/lib/components/SimpleSection.svelte.spec.ts`
Expected: FAIL — cannot resolve `./SimpleSection.svelte`.

- [ ] **Step 4: Implement SimpleSection**

Create `src/lib/components/SimpleSection.svelte`:

```svelte
<script lang="ts">
	import { animationState, setLayerEnabled } from '$lib/state/animation';
	import { composition, setRingMorphT } from '$lib/state/composition';
	import { Slider } from '$lib/shadcn/ui/slider/index.js';
	import { m } from '$lib/paraglide/messages';
	import SidebarCollapsible from './SidebarCollapsible.svelte';

	const morphRings = $derived(
		composition.rings
			.map((ring, index) => ({ ring, index }))
			.filter(({ ring }) => ring.secondaryTemplatePath !== null)
	);
</script>

<SidebarCollapsible>
	{#snippet trigger()}
		{m.animate_layer_simple()}
	{/snippet}

	{#snippet content()}
		<div class="space-y-3">
			<label class="flex items-center gap-2 text-xs font-medium">
				<input
					type="checkbox"
					data-testid="layer-toggle-simple"
					aria-label={m.animate_layer_toggle()}
					checked={animationState.layers.simple}
					onchange={(e) => setLayerEnabled('simple', (e.target as HTMLInputElement).checked)}
				/>
				{m.animate_layer_simple()}
			</label>

			{#if morphRings.length === 0}
				<p class="text-[11px] text-muted-foreground">{m.animate_simple_empty()}</p>
			{:else}
				{#each morphRings as { ring, index } (index)}
					<div class="flex flex-col gap-1">
						<span class="text-xs text-muted-foreground">
							{m.editor_ring_label({ index: index + 1 })} ({(ring.morphT ?? 0).toFixed(2)})
						</span>
						<Slider
							type="single"
							min={0}
							max={1}
							step={0.01}
							value={ring.morphT ?? 0}
							onValueChange={(v) => setRingMorphT(index, v)}
						/>
					</div>
				{/each}
			{/if}
		</div>
	{/snippet}
</SidebarCollapsible>
```

- [ ] **Step 5: Run SimpleSection test → pass; autofix**

Run: `bun run test:unit -- run src/lib/components/SimpleSection.svelte.spec.ts`
Expected: PASS.

Run `svelte-autofixer` on `SimpleSection.svelte` → `issues: []`.

- [ ] **Step 6: Implement DataSeriesSection (disabled placeholder) + test**

Create `src/lib/components/DataSeriesSection.svelte.spec.ts`:

```ts
import { render } from 'vitest-browser-svelte';
import { describe, it, expect, beforeEach } from 'vitest';
import { switchLocale } from '$lib/state/locale.svelte';
import DataSeriesSection from './DataSeriesSection.svelte';

describe('DataSeriesSection', () => {
	beforeEach(() => switchLocale('en'));

	it('renders a disabled switch and the unavailable hint', async () => {
		const { getByTestId, getByText } = render(DataSeriesSection);
		const toggle = getByTestId('layer-toggle-dataSeries');
		await expect.element(toggle).toBeDisabled();
		await expect.element(getByText('Mode not available yet.')).toBeInTheDocument();
	});
});
```

Create `src/lib/components/DataSeriesSection.svelte`:

```svelte
<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import SidebarCollapsible from './SidebarCollapsible.svelte';
</script>

<SidebarCollapsible>
	{#snippet trigger()}
		{m.animate_layer_data_series()}
	{/snippet}

	{#snippet content()}
		<div class="space-y-2">
			<label class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
				<input
					type="checkbox"
					data-testid="layer-toggle-dataSeries"
					aria-label={m.animate_layer_toggle()}
					checked={false}
					disabled
				/>
				{m.animate_layer_data_series()}
			</label>
			<p class="text-[11px] text-muted-foreground">{m.animate_data_series_unavailable()}</p>
		</div>
	{/snippet}
</SidebarCollapsible>
```

Run: `bun run test:unit -- run src/lib/components/DataSeriesSection.svelte.spec.ts` → PASS. Autofix → `issues: []`.

- [ ] **Step 7: Implement AudioBarsSection (extract from AnimationSection) + test**

Create `src/lib/components/AudioBarsSection.svelte` by lifting the `{#if animationState.mode === 'audioBars'}` block (AnimationSection lines 161-293) into its own window: a `SidebarCollapsible` whose header carries a `data-testid="layer-toggle-audioBars"` switch bound to `setLayerEnabled('audioBars', …)`, and whose content is the audio-source selector + input-level meter + the gain/crests/amplitude/phase/smoothing sliders + the per-ring `RingWaveConfigItem` list. Keep `showInputLevel` / `inputLevel` logic (lines 66-86) but key it off `animationState.layers.audioBars` instead of `mode`. Reuse the existing `m.animate_*` keys verbatim.

Create `src/lib/components/AudioBarsSection.svelte.spec.ts`:

```ts
import { render } from 'vitest-browser-svelte';
import { describe, it, expect, beforeEach } from 'vitest';
import { switchLocale } from '$lib/state/locale.svelte';
import { setLayerEnabled, animationState } from '$lib/state/animation';
import AudioBarsSection from './AudioBarsSection.svelte';

describe('AudioBarsSection', () => {
	beforeEach(() => {
		switchLocale('en');
		setLayerEnabled('audioBars', false);
	});

	it('switch toggles the audioBars layer on', async () => {
		const { getByTestId } = render(AudioBarsSection);
		await getByTestId('layer-toggle-audioBars').element().click();
		expect(animationState.layers.audioBars).toBe(true);
	});
});
```

Run the spec → PASS. Autofix → `issues: []`.

- [ ] **Step 8: Implement AudioZonesSection (extract) + test**

Same shape: lift the `{#if animationState.mode === 'audioZones'}` block (AnimationSection lines 295-397) into `AudioZonesSection.svelte` with a `data-testid="layer-toggle-audioZones"` switch bound to `setLayerEnabled('audioZones', …)`. Content = audio-source selector + input meter + bass/mid/treble sliders. Test mirrors Step 7 with `audioZones`. Run → PASS. Autofix.

- [ ] **Step 9: Add the Kaleidoscope layer switch + test**

In `src/lib/components/KaleidoscopeSection.svelte`, add a switch bound to the kaleidoscope **layer** (distinct from the existing `kaleidoscope.enabled` render toggle). Insert after the existing "Kaleidoscope mode" checkbox (line 38), only when `animatable` (Animate workspace, not the editor):

```svelte
	{#if animatable}
		<label class="flex items-center gap-2 text-xs">
			<input
				type="checkbox"
				data-testid="layer-toggle-kaleidoscope"
				aria-label={m.animate_kaleidoscope_layer_toggle()}
				checked={animationState.layers.kaleidoscope}
				onchange={(e) => setLayerEnabled('kaleidoscope', (e.target as HTMLInputElement).checked)}
			/>
			{m.animate_kaleidoscope_layer_toggle()}
		</label>
	{/if}
```

Add the imports to the script block: `import { animationState, setLayerEnabled } from '$lib/state/animation';`.

Append to `src/lib/components/KaleidoscopeSection.svelte.spec.ts` (ensure `switchLocale('en')` in `beforeEach`):

```ts
it('kaleidoscope layer switch toggles layers.kaleidoscope', async () => {
	const { getByTestId } = render(KaleidoscopeSection); // animatable defaults true
	const toggle = getByTestId('layer-toggle-kaleidoscope');
	const before = animationState.layers.kaleidoscope;
	await toggle.element().click();
	expect(animationState.layers.kaleidoscope).toBe(!before);
});
```

(Import `animationState` from `$lib/state/animation` at the top of the spec.) Run → PASS. Autofix `KaleidoscopeSection.svelte` → `issues: []`.

- [ ] **Step 10: Wire the animate route**

Replace `src/routes/(app)/animate/+page.svelte`:

```svelte
<script lang="ts">
	import SimpleSection from '$lib/components/SimpleSection.svelte';
	import DataSeriesSection from '$lib/components/DataSeriesSection.svelte';
	import AudioBarsSection from '$lib/components/AudioBarsSection.svelte';
	import AudioZonesSection from '$lib/components/AudioZonesSection.svelte';
	import KaleidoscopeSection from '$lib/components/KaleidoscopeSection.svelte';
</script>

<SimpleSection />
<DataSeriesSection />
<AudioBarsSection />
<AudioZonesSection />
<KaleidoscopeSection />
```

- [ ] **Step 11: Delete the old AnimationSection**

```bash
git rm src/lib/components/AnimationSection.svelte src/lib/components/AnimationSection.svelte.spec.ts
```

Run: `grep -rn "AnimationSection" src`
Expected: no matches. Fix any straggler import.

- [ ] **Step 12: Autofix all new/changed Svelte files + run check + full suite**

Run `svelte-autofixer` on each: `SimpleSection`, `DataSeriesSection`, `AudioBarsSection`, `AudioZonesSection`, `KaleidoscopeSection`, `animate/+page.svelte`. All `issues: []`.

Run: `bun run check` → expected 0 errors EXCEPT `TimelinePanel.svelte` still references `animationState.mode` (cleared in Task 5). If that's the only error, proceed; otherwise fix.

Run: `bun run test:unit -- run` (rerun once on paraglide race).

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat(animate): split AnimationSection into per-layer windows with switches

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Play always active + armed params from all registries

Make Play (and spacebar) unconditionally activatable — the timeline always runs the clock — and source the timeline's armed tracks from every registry, not just `KALEIDO_PARAMS`. Clears the last `animationState.mode` references.

**Files:**
- Modify: `src/lib/components/TimelinePanel.svelte`
- Modify: `src/lib/components/TimelinePanel.svelte.spec.ts`
- Modify: `src/lib/state/animation.svelte.ts` (drop the start-time "nothing runnable" bail)

**Interfaces:**
- Consumes: `getAllAnimatableParams` (Task 1); `animationState.layers` (Task 3).

- [ ] **Step 1: Write the failing TimelinePanel test**

Add to `src/lib/components/TimelinePanel.svelte.spec.ts` (ensure `switchLocale('en')` in `beforeEach`, and reset composition to have NO morph rings + all layers off where the existing setup allows):

```ts
it('Play button is enabled with no morph ring and no armed track', async () => {
	const { getByRole } = render(TimelinePanel);
	const play = getByRole('button', { name: /play/i });
	await expect.element(play).not.toBeDisabled();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run test:unit -- run src/lib/components/TimelinePanel.svelte.spec.ts -t "Play button is enabled"`
Expected: FAIL — button is `disabled` due to `blockPlayback`.

- [ ] **Step 3: Remove `blockPlayback` gating in TimelinePanel**

In `src/lib/components/TimelinePanel.svelte`:

1. Delete the `isAudioMode` / `hasMorphRings` / `blockPlayback` deriveds (lines 30-34) and replace the audio-vs-timed display predicate. The elapsed-vs-duration display (line 150 `{#if isAudioMode}`) keys off whether an audio layer is active:

```ts
	// Audio layers run on a live clock (elapsed) rather than a fixed duration.
	const isAudioMode = $derived(
		animationState.layers.audioBars || animationState.layers.audioZones
	);
```

2. Remove `blockPlayback` from the Play button `disabled` (line 141) — delete the `disabled={blockPlayback}` attribute entirely (Play is always enabled).

3. In `onKeydown` (line 65), replace `if (!blockPlayback) togglePlay();` with `togglePlay();`.

4. Replace the `armedParams` derived (line 76):

```ts
	import { getAllAnimatableParams } from '$lib/state/animation';
	...
	const armedParams = $derived(
		getAllAnimatableParams().filter((p) => keyframes.tracks[p.id]?.enabled)
	);
```

Remove the now-unused `KALEIDO_PARAMS` import if nothing else uses it. Remove the unused `composition` import if `hasMorphRings` was its only consumer (verify with the file).

- [ ] **Step 4: Drop the "nothing runnable" start bail in state**

In `src/lib/state/animation.svelte.ts`:

1. In `startNewAnimation` (lines 298-301), remove the early-return guard so the clock always starts:

```ts
function startNewAnimation() {
	lastRingCount = composition.rings.length;
	animationState.progress = 0;
	lastTickNowMs = null;
	logicalElapsedMs = 0;
	animationState.elapsedMs = 0;
	syncActiveDrivers();
	animationState.isPlaying = true;
	animationState.isPaused = false;
	frameRequestId = requestAnimationFrame(tick);
}
```

2. In `togglePlay` resume branch (lines 410-413), remove the matching `if (!hasRunnableMode() && !hasMorphTargets() && !hasEnabledKeyframeTracks()) { stopInternal(true); return; }` guard so resume always proceeds.

> `hasMorphTargets` / `hasEnabledKeyframeTracks` may become unused after this. Remove them if `grep` shows no remaining callers; keep `getMorphRingIndices` (still used for stop-reset).

- [ ] **Step 5: Autofix + check + tests**

Run `svelte-autofixer` on `TimelinePanel.svelte` → `issues: []`.

Run: `bun run check` → expected 0 errors now (last `mode` refs gone).

Run: `grep -rn "animationState.mode\|setAnimationMode\|setMode\b" src` → no matches.

Run: `bun run test:unit -- run` → all green (rerun once on paraglide race). Update any pre-existing TimelinePanel tests that assumed a disabled Play under blockPlayback.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/TimelinePanel.svelte src/lib/components/TimelinePanel.svelte.spec.ts src/lib/state/animation.svelte.ts
git commit -m "feat(animate): Play always activatable; timeline arms params from all registries

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Stopwatch on audio sliders + move morphT slider editor → Simple

Wrap the Audio Bars / Audio Zones sliders in `AnimatableSlider` so each carries a ⏱ and can be keyframed (its track then appears in the timeline). Remove the per-ring `morphT` slider from the editor (the Simple window already owns it from Task 4).

**Files:**
- Modify: `src/lib/components/AudioBarsSection.svelte` (wrap sliders in `AnimatableSlider`)
- Modify: `src/lib/components/AudioZonesSection.svelte` (wrap sliders in `AnimatableSlider`)
- Modify: `src/lib/components/AudioBarsSection.svelte.spec.ts` / `AudioZonesSection.svelte.spec.ts`
- Modify: `src/lib/components/RingEditor.svelte` (remove morphT slider + readout)
- Modify: `src/lib/components/RingEditor.svelte.spec.ts` (assert slider gone)

**Interfaces:**
- Consumes: `AnimatableSlider` (param prop is `AnimatableParam` from Task 1); audio registries surfaced via a small accessor.
- Produces: audio params armable from the UI; editor no longer renders the morphT slider.

- [ ] **Step 1: Expose the audio registries for the UI**

The section components need the same `AnimatableParam[]` the apply-loop walks. Export thin accessors from `animation.svelte.ts`:

```ts
export function getAudioBarsParams(): AnimatableParam[] {
	return AUDIO_BARS_PARAMS;
}
export function getAudioZonesParams(): AnimatableParam[] {
	return AUDIO_ZONES_PARAMS;
}
```

(If per-ring wave sliders should also get ⏱, expose `buildRingWaveParams(composition.rings, …)` via an accessor too — but the spec scopes per-ring wave as dynamic params consumed by the timeline/apply-loop; keep the per-ring UI sliders as-is in this task unless the param ids already match. Wrapping the global audio sliders satisfies the spec's Phase 5 acceptance test.)

- [ ] **Step 2: Write the failing AudioBarsSection ⏱ test**

Add to `src/lib/components/AudioBarsSection.svelte.spec.ts`:

```ts
it('arming an audio bars param enables its keyframe track', async () => {
	const { keyframes } = await import('$lib/state/keyframes.svelte');
	setLayerEnabled('audioBars', true);
	const { getByRole } = render(AudioBarsSection);
	// AnimatableSlider renders a ⏱ button whose accessible name is "Animate {label}".
	const stopwatch = getByRole('button', { name: /crests/i });
	await stopwatch.element().click();
	expect(keyframes.tracks['audioBars.waveCrests']?.enabled).toBe(true);
});
```

- [ ] **Step 3: Run to verify failure**

Run: `bun run test:unit -- run src/lib/components/AudioBarsSection.svelte.spec.ts -t "arming an audio bars"`
Expected: FAIL — no stopwatch button (sliders are plain `<input>`).

- [ ] **Step 4: Wrap Audio Bars sliders in AnimatableSlider**

In `AudioBarsSection.svelte`, replace the five global sliders (input-gain, wave-crests, amplitude-gain, phase-speed, smoothing) with `AnimatableSlider` instances driven by the audio bars registry:

```svelte
<script lang="ts">
	import AnimatableSlider from './AnimatableSlider.svelte';
	import { getAudioBarsParams } from '$lib/state/animation';
	...
	const barsParams = getAudioBarsParams();
</script>
...
	{#each barsParams as param (param.id)}
		<AnimatableSlider {param} />
	{/each}
```

Keep the audio-source selector, input-level meter, mic/file panels, and the per-ring `RingWaveConfigItem` list as-is. The five `m.animate_*` slider labels now come through the param `label`s (already wired in Task 1's registry).

- [ ] **Step 5: Run AudioBars test → pass; autofix**

Run: `bun run test:unit -- run src/lib/components/AudioBarsSection.svelte.spec.ts` → PASS. Autofix → `issues: []`.

- [ ] **Step 6: Wrap Audio Zones sliders + test**

Mirror Steps 2-5 for `AudioZonesSection.svelte` using `getAudioZonesParams()`; replace the bass/mid/treble sliders with `{#each zonesParams as param (param.id)}<AnimatableSlider {param} />{/each}`. Add the analogous arming test (`audioZones.bass`). Run → PASS. Autofix.

- [ ] **Step 7: Write the failing RingEditor test (slider gone)**

Add to `src/lib/components/RingEditor.svelte.spec.ts` (render a ring that HAS `secondaryTemplatePath`, since the morphT slider only showed for morph rings):

```ts
it('does not render the per-ring morphT slider (moved to Simple window)', async () => {
	// ... render RingEditor with a ring that has a secondaryTemplatePath ...
	const { queryByText } = render(RingEditor, { props: /* ring with secondary path */ });
	// The "Morph t: 0.00" readout used m.editor_morph_t — assert it's absent.
	expect(queryByText(/morph t/i)).toBeNull();
});
```

> Match the existing RingEditor spec's render harness (props shape, store setup). If the spec renders via a composition fixture, add a morph ring to that fixture for this case.

- [ ] **Step 8: Run to verify failure**

Run: `bun run test:unit -- run src/lib/components/RingEditor.svelte.spec.ts -t "morphT slider"`
Expected: FAIL — the readout/slider is present.

- [ ] **Step 9: Remove the morphT slider from RingEditor**

In `src/lib/components/RingEditor.svelte`, within the `{:else}` branch where `ring.secondaryTemplatePath` exists (lines 233-259), remove the morph-t readout `<span>` (lines 247-249) and the `<Slider …onValueChange={setRingMorphT}…>` (lines 251-258). Keep the "Remove morph target" button and the Primary/Secondary tabs + canvas. Remove the now-unused `setRingMorphT` import (line 17) and the `m.editor_morph_t` usage if nothing else references them (`grep` to confirm).

- [ ] **Step 10: Run RingEditor test → pass; autofix**

Run: `bun run test:unit -- run src/lib/components/RingEditor.svelte.spec.ts` → PASS. Autofix `RingEditor.svelte` → `issues: []`.

- [ ] **Step 11: Full gates**

Run `svelte-autofixer` on `AudioBarsSection`, `AudioZonesSection`, `RingEditor` → all `issues: []`.

Run: `bun run check` → 0 errors.

Run: `bun run test:unit -- run` → all green (rerun once on paraglide race).

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat(animate): stopwatch on audio sliders; move morphT slider editor→Simple

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (run after the plan, before execution)

**Spec coverage check** — every spec goal maps to a task:

| Spec goal | Task |
|---|---|
| 1. `mode` → concurrent layers | Task 3 |
| 2. Split `AnimationSection` into per-class windows | Task 4 |
| 3. Simple coexists with audio | Tasks 2 (active set) + 3 (layers) |
| 4. Play always activatable | Task 5 |
| 5. ⏱ on every animatable audio param via generic registry | Tasks 1 (registry) + 6 (UI) |
| 6. Move `morphT` slider editor → Simple | Tasks 4 (Simple slider) + 6 (remove from editor) |
| Generic param registry | Task 1 |
| Runtime single mode → active set | Task 2 |
| Kaleidoscope layer gate | Task 3 |
| Data Series disabled placeholder | Task 4 |
| No persistence/migration (animationState not persisted) | Default change only (Task 3) — no migration code, correct |

**Type-consistency check:** `AnimatableParam` (Task 1) is the single param shape; `KaleidoParam` aliases it; `AnimatableSlider` consumes it. `setLayerEnabled(layer, on)` / `animationState.layers` are used identically across Tasks 3-6. `setActive(type, on)` (Task 2) is called only with driver types (`simple`/`audioBars`/`audioZones`) — never `kaleidoscope`/`dataSeries`. `getAllAnimatableParams` / `getAudioBarsParams` / `getAudioZonesParams` names are stable across Tasks 1/5/6.

**Risks carried from spec:**
- Concurrent drivers writing the SAME property would collide — current set writes distinct properties (`morphT`/`wave`/`zoneDrive`); safe. Re-check if a future driver targets `morphT`.
- Per-ring wave params rebuild from live `composition.rings` every call — no cached indices.
- Removing `blockPlayback` must not break the elapsed-vs-duration display — Task 5 rebinds that display to `isAudioMode` derived from `layers`, not `blockPlayback`.

**Sequencing with architecture review:** the parked "render seam" and "preview painter" candidates touch the same preview/render path. This plan does NOT touch `preview-presenter` or the render pipeline — it stays in the animate state/UI layer — so it does not conflict. If those refactors are later picked, sequence them after this feature lands.
