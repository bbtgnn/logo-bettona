# Real Audio Source + UI Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Feed the existing cymatic wave from real audio (microphone + audio file) and add live-tuning UI, reusing the unchanged `readBars(): number[]` driver contract; the dev fallback stays as a "Demo" source.

**Architecture:** A new `audio-source.ts` owns one `AudioContext` + one `AnalyserNode` and exposes the same `readBars` contract as the fallback, plus a pure `reduceToBands` spectrum→bands function. `animation.svelte.ts` routes the driver's `readBars` to demo/mic/file/off based on ephemeral `animationState.audioSource`, and adds config + source mutators. `AnimationSection.svelte` gains a source selector, file controls, and 5 native-range sliders. The `audioBars` driver and Tasks A–C (`wave.ts`, `render-pipeline.ts`, `bend.ts`) are untouched.

**Tech Stack:** SvelteKit, TypeScript, paper.js, native Web Audio (no new deps), vitest (server=node, client=chromium), shadcn (Button/Input/Label), bun.

**Spec:** `docs/superpowers/specs/2026-06-08-audio-source-and-ui-design.md`

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/lib/state/animation-drivers/audio-source.ts` | Pure `reduceToBands` + `createAudioSource` (Web Audio) | Create |
| `src/lib/state/animation-drivers/audio-source.spec.ts` | Band-reduction + source lifecycle tests (server project) | Create |
| `src/lib/state/animation-drivers/types.ts` | `AudioBarsConfig.inputGain` | Modify |
| `src/lib/state/animation.svelte.ts` | `inputGain` default, audioSource singleton, source-aware `readBars`, mutators, lifecycle | Modify |
| `src/lib/components/AnimationSection.svelte` | Source selector, file controls, 5 sliders, play-gate fix | Modify |
| `src/lib/components/AnimationSection.svelte.spec.ts` | UI tests for audioBars controls (client project) | Modify |

**Test routing:** plain `*.spec.ts` → **server** (node) — `audio-source.spec.ts` uses `vi.stubGlobal` to mock Web Audio, no real audio. `*.svelte.spec.ts` → **client** (chromium). Run a single file with `npx vitest run <path>`.

**Pre-existing conditions (do not "fix"):** `npm run check` reports 2 unrelated errors in `animation.svelte.spec.ts:270` and `runtime.spec.ts:34`; the repo has pre-existing repo-wide Prettier non-compliance. Only keep *your* touched files lint/format clean.

---

## Task 1: Pure `reduceToBands`

**Files:**
- Create: `src/lib/state/animation-drivers/audio-source.ts`
- Test: `src/lib/state/animation-drivers/audio-source.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/state/animation-drivers/audio-source.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { reduceToBands } from './audio-source';

describe('reduceToBands', () => {
	it('returns an empty array for a non-positive ring count', () => {
		const freq = new Uint8Array(1024).fill(128);
		expect(reduceToBands(freq, 0, 20, 20000, 48000, 2048, 1)).toEqual([]);
	});

	it('returns one value per ring, all within 0..1', () => {
		const freq = new Uint8Array(1024).fill(128);
		const bands = reduceToBands(freq, 4, 20, 20000, 48000, 2048, 1);

		expect(bands).toHaveLength(4);
		for (const value of bands) {
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThanOrEqual(1);
		}
		// 128/255 ≈ 0.502 with gain 1
		expect(bands[0]).toBeCloseTo(128 / 255, 2);
	});

	it('clamps at 1 when inputGain pushes a band over', () => {
		const freq = new Uint8Array(1024).fill(128);
		const bands = reduceToBands(freq, 2, 20, 20000, 48000, 2048, 4);
		expect(bands[0]).toBe(1);
	});

	it('puts energy in the matching log band (high bins → high band)', () => {
		const freq = new Uint8Array(1024).fill(0);
		for (let i = 800; i < 1024; i += 1) freq[i] = 200; // high-frequency bins
		const bands = reduceToBands(freq, 4, 20, 20000, 48000, 2048, 1);
		expect(bands[3]).toBeGreaterThan(bands[0]);
		expect(bands[0]).toBe(0);
	});
});
```

- [ ] **Step 2: Run, verify it FAILS**

Run: `npx vitest run src/lib/state/animation-drivers/audio-source.spec.ts`
Expected: FAIL (`reduceToBands` / module not found).

- [ ] **Step 3: Implement `reduceToBands`**

Create `src/lib/state/animation-drivers/audio-source.ts`:

```ts
import type { AudioBarsConfig } from './types';

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

/**
 * Reduces a frequency-magnitude spectrum (analyser.getByteFrequencyData output) to
 * `ringCount` log-spaced bands between minHz and maxHz, each normalized to 0..1 and
 * scaled by inputGain. Log spacing reads voice/ambience better than linear. Pure —
 * no Web Audio references — so it is unit-testable on its own.
 */
export function reduceToBands(
	freq: Uint8Array,
	ringCount: number,
	minHz: number,
	maxHz: number,
	sampleRate: number,
	fftSize: number,
	inputGain: number
): number[] {
	if (ringCount <= 0) return [];

	const binHz = sampleRate / fftSize;
	const safeMin = Math.max(1, minHz);
	const safeMax = Math.max(safeMin + 1, maxHz);
	const ratio = safeMax / safeMin;

	const bands: number[] = [];
	for (let b = 0; b < ringCount; b += 1) {
		const loHz = safeMin * Math.pow(ratio, b / ringCount);
		const hiHz = safeMin * Math.pow(ratio, (b + 1) / ringCount);

		let loBin = Math.floor(loHz / binHz);
		let hiBin = Math.ceil(hiHz / binHz);
		loBin = Math.max(0, Math.min(loBin, freq.length - 1));
		hiBin = Math.max(loBin + 1, Math.min(hiBin, freq.length));

		let sum = 0;
		let count = 0;
		for (let i = loBin; i < hiBin; i += 1) {
			sum += freq[i];
			count += 1;
		}
		const avg = count > 0 ? sum / count : 0;
		bands.push(clamp01((avg / 255) * inputGain));
	}
	return bands;
}
```

(The `AudioBarsConfig` import is used by `createAudioSource` in Task 2; it is harmless now. If your linter flags it as unused before Task 2, add the `createAudioSource` from Task 2 in the same session — Tasks 1 and 2 share this file.)

- [ ] **Step 4: Run, verify it PASSES**

Run: `npx vitest run src/lib/state/animation-drivers/audio-source.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/animation-drivers/audio-source.ts src/lib/state/animation-drivers/audio-source.spec.ts
git commit -m "feat: add pure reduceToBands spectrum reducer"
```

---

## Task 2: `createAudioSource` (Web Audio)

**Files:**
- Modify: `src/lib/state/animation-drivers/audio-source.ts` (append `createAudioSource`)
- Test: `src/lib/state/animation-drivers/audio-source.spec.ts` (append mocked lifecycle tests)

- [ ] **Step 1: Append the failing tests**

Append to `src/lib/state/animation-drivers/audio-source.spec.ts` (add `vi`, `afterEach` to the existing `vitest` import line so it reads `import { afterEach, describe, expect, it, vi } from 'vitest';`, and add `createAudioSource` to the `./audio-source` import):

```ts
const config = {
	smoothing: 0.5,
	minHz: 20,
	maxHz: 20000,
	waveCrests: 3,
	waveAmplitudeGain: 0.3,
	wavePhaseSpeed: 2.2,
	inputGain: 1
};

class MockAnalyser {
	fftSize = 2048;
	smoothingTimeConstant = 0;
	frequencyBinCount = 1024;
	connect = vi.fn();
	disconnect = vi.fn();
	getByteFrequencyData(arr: Uint8Array) {
		arr.fill(100);
	}
}

class MockSourceNode {
	connect = vi.fn();
	disconnect = vi.fn();
}

class MockAudioContext {
	sampleRate = 48000;
	destination = {};
	state = 'suspended';
	analyser = new MockAnalyser();
	resume = vi.fn(async () => {
		this.state = 'running';
	});
	createAnalyser = vi.fn(() => this.analyser);
	createMediaStreamSource = vi.fn(() => new MockSourceNode());
	createMediaElementSource = vi.fn(() => new MockSourceNode());
}

describe('createAudioSource', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('returns [] before any source is started', () => {
		vi.stubGlobal('AudioContext', MockAudioContext);
		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		expect(source.readBars()).toEqual([]);
	});

	it('reads ringCount values in 0..1 once the mic source is active', async () => {
		vi.stubGlobal('AudioContext', MockAudioContext);
		vi.stubGlobal('navigator', {
			mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) }
		});

		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		await source.setMode('mic');

		const bars = source.readBars();
		expect(bars).toHaveLength(4);
		for (const value of bars) {
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThanOrEqual(1);
		}
	});

	it('does not crash when microphone permission is denied', async () => {
		vi.stubGlobal('AudioContext', MockAudioContext);
		vi.stubGlobal('navigator', {
			mediaDevices: { getUserMedia: vi.fn(async () => Promise.reject(new Error('denied'))) }
		});

		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		await expect(source.setMode('mic')).rejects.toThrow();
		expect(source.readBars()).toEqual([]); // soft degradation
	});
});
```

- [ ] **Step 2: Run, verify the new tests FAIL**

Run: `npx vitest run src/lib/state/animation-drivers/audio-source.spec.ts`
Expected: the 3 new `createAudioSource` tests FAIL (`createAudioSource` not exported); the 4 `reduceToBands` tests still pass.

- [ ] **Step 3: Append the implementation**

Append to `src/lib/state/animation-drivers/audio-source.ts`:

```ts
export type AudioSourceMode = 'mic' | 'file' | 'off';

export type AudioSource = {
	setMode(mode: AudioSourceMode): Promise<void>;
	loadFile(file: File): Promise<void>;
	play(): Promise<void>;
	pause(): void;
	stop(): void;
	readBars(): number[];
};

type CreateAudioSourceDeps = {
	getRingCount: () => number;
	getConfig: () => AudioBarsConfig;
};

/**
 * Owns one AudioContext + one AnalyserNode and feeds the same `readBars(): number[]`
 * contract as the dev fallback. The mic is never routed to `destination` (feedback);
 * the file IS routed to `destination` so it stays audible while tuning. The context is
 * created lazily and `resume()`d from a user gesture by the caller. All Web Audio access
 * is guarded so a missing API / denied permission degrades to `readBars() === []`.
 */
export function createAudioSource(deps: CreateAudioSourceDeps): AudioSource {
	let audioContext: AudioContext | null = null;
	let analyser: AnalyserNode | null = null;
	let buffer: Uint8Array | null = null;

	let mode: AudioSourceMode = 'off';
	let micStream: MediaStream | null = null;
	let micNode: MediaStreamAudioSourceNode | null = null;

	let audioEl: HTMLAudioElement | null = null;
	let fileNode: MediaElementAudioSourceNode | null = null;
	let objectUrl: string | null = null;

	function ensureContext(): AudioContext {
		if (!audioContext) {
			const Ctor = globalThis.AudioContext;
			if (!Ctor) throw new Error('Web Audio API is not available');
			audioContext = new Ctor();
			analyser = audioContext.createAnalyser();
			analyser.fftSize = 2048;
			buffer = new Uint8Array(analyser.frequencyBinCount);
		}
		return audioContext;
	}

	function detachSources(): void {
		if (micNode) {
			micNode.disconnect();
			micNode = null;
		}
		if (micStream) {
			for (const track of micStream.getTracks()) track.stop();
			micStream = null;
		}
		if (fileNode) {
			fileNode.disconnect();
			fileNode = null;
		}
	}

	async function setMode(next: AudioSourceMode): Promise<void> {
		if (next === 'off') {
			detachSources();
			mode = 'off';
			return;
		}

		const ctx = ensureContext();
		await ctx.resume();
		detachSources();

		if (next === 'mic') {
			const mediaDevices = globalThis.navigator?.mediaDevices;
			if (!mediaDevices?.getUserMedia) throw new Error('getUserMedia is not available');
			micStream = await mediaDevices.getUserMedia({ audio: true });
			micNode = ctx.createMediaStreamSource(micStream);
			micNode.connect(analyser as AnalyserNode); // NOT connected to destination
		} else {
			// file
			if (!audioEl) audioEl = new Audio();
			if (!fileNode) fileNode = ctx.createMediaElementSource(audioEl);
			fileNode.connect(analyser as AnalyserNode);
			(analyser as AnalyserNode).connect(ctx.destination); // audible while tuning
		}
		mode = next;
	}

	async function loadFile(file: File): Promise<void> {
		if (!audioEl) audioEl = new Audio();
		if (objectUrl) URL.revokeObjectURL(objectUrl);
		objectUrl = URL.createObjectURL(file);
		audioEl.src = objectUrl;
	}

	async function play(): Promise<void> {
		if (audioContext) await audioContext.resume();
		if (audioEl) await audioEl.play();
	}

	function pause(): void {
		audioEl?.pause();
	}

	function stop(): void {
		detachSources();
		audioEl?.pause();
		mode = 'off';
	}

	function readBars(): number[] {
		if (mode === 'off' || !analyser || !buffer || !audioContext) return [];
		const cfg = deps.getConfig();
		analyser.smoothingTimeConstant = cfg.smoothing;
		analyser.getByteFrequencyData(buffer);
		return reduceToBands(
			buffer,
			deps.getRingCount(),
			cfg.minHz,
			cfg.maxHz,
			audioContext.sampleRate,
			analyser.fftSize,
			cfg.inputGain
		);
	}

	return { setMode, loadFile, play, pause, stop, readBars };
}
```

- [ ] **Step 4: Run, verify it PASSES**

Run: `npx vitest run src/lib/state/animation-drivers/audio-source.spec.ts`
Expected: PASS (7 tests total).

Run: `npx eslint src/lib/state/animation-drivers/audio-source.ts src/lib/state/animation-drivers/audio-source.spec.ts`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/animation-drivers/audio-source.ts src/lib/state/animation-drivers/audio-source.spec.ts
git commit -m "feat: add Web Audio source (mic/file/off) with same readBars contract"
```

---

## Task 3: Add `inputGain` to `AudioBarsConfig`

**Files:**
- Modify: `src/lib/state/animation-drivers/types.ts`
- Modify: `src/lib/state/animation.svelte.ts` (`defaultAudioBarsConfig`, lines 27-34)

- [ ] **Step 1: Extend the config type**

In `src/lib/state/animation-drivers/types.ts`, the `AudioBarsConfig` type currently is:

```ts
export type AudioBarsConfig = {
	smoothing: number;
	minHz: number;
	maxHz: number;
	waveCrests: number; // integer >= 1, periods along the petal
	waveAmplitudeGain: number; // band energy (0..1) → wave amplitude
	wavePhaseSpeed: number; // rad/sec, travel speed of the wave
};
```

Add `inputGain` as the last field:

```ts
export type AudioBarsConfig = {
	smoothing: number;
	minHz: number;
	maxHz: number;
	waveCrests: number; // integer >= 1, periods along the petal
	waveAmplitudeGain: number; // band energy (0..1) → wave amplitude
	wavePhaseSpeed: number; // rad/sec, travel speed of the wave
	inputGain: number; // multiplies raw band magnitudes before clamp (boost quiet recordings)
};
```

- [ ] **Step 2: Add the default**

In `src/lib/state/animation.svelte.ts`, `defaultAudioBarsConfig` (lines 27-34) currently ends:

```ts
	waveCrests: 3,
	waveAmplitudeGain: 0.3,
	wavePhaseSpeed: 2.2
};
```

Add `inputGain: 1`:

```ts
	waveCrests: 3,
	waveAmplitudeGain: 0.3,
	wavePhaseSpeed: 2.2,
	inputGain: 1
};
```

- [ ] **Step 3: Verify**

Run: `npx eslint src/lib/state/animation-drivers/types.ts src/lib/state/animation.svelte.ts`
Expected: clean.

Run: `npx vitest run src/lib/state/animation-drivers/audio-bars-driver.spec.ts`
Expected: PASS (the driver test's inline config already includes the wave fields; `inputGain` is unused by the driver, so this stays green).

- [ ] **Step 4: Commit**

```bash
git add src/lib/state/animation-drivers/types.ts src/lib/state/animation.svelte.ts
git commit -m "feat: add inputGain to AudioBarsConfig"
```

---

## Task 4: Wire the real source into `animation.svelte.ts`

**Files:**
- Modify: `src/lib/state/animation.svelte.ts` (imports, AnimationState, animationState init, singleton, driver `readBars`, mutators, lifecycle)

This task is glue between already-tested units (the source from Tasks 1–2, the driver from the prior feature) and the UI (Task 5). Its behavior is verified at the boundaries: the source contract is unit-tested in Task 2, and the new mutators are exercised by the component test in Task 5. Verification here is typecheck + lint + the existing `animation.svelte.spec.ts` staying green (it covers mode switching and dispose).

- [ ] **Step 1: Add the import**

In `src/lib/state/animation.svelte.ts`, after the `createFallbackBars` import (line 6), add:

```ts
import { createAudioSource } from './animation-drivers/audio-source';
```

- [ ] **Step 2: Extend `AnimationState`**

Add the `audioSource` field to the `AnimationState` type (currently lines 15-25). After `audioBars: AudioBarsConfig;` add:

```ts
	audioSource: 'demo' | 'mic' | 'file' | 'off';
```

- [ ] **Step 3: Initialize it**

In the `animationState = $state<AnimationState>({ ... })` initializer (lines 42-52), after `audioBars: defaultAudioBarsConfig,` add:

```ts
		audioSource: 'demo',
```

- [ ] **Step 4: Construct the audio source singleton**

After the `fallbackBars` singleton (lines 64-66), add:

```ts
const audioSource = createAudioSource({
	getRingCount: () => composition.rings.length,
	getConfig: () => animationState.audioBars
});
```

- [ ] **Step 5: Route the driver's `readBars`**

Replace the audioBars driver registration body (lines 77-85). Change only the `readBars` line:

```ts
		readBars: () => fallbackBars.readBars(),
```

to:

```ts
		readBars: () => {
			switch (animationState.audioSource) {
				case 'demo':
					return fallbackBars.readBars();
				case 'mic':
				case 'file':
					return audioSource.readBars();
				default:
					return []; // 'off' → logo at rest
			}
		},
```

- [ ] **Step 6: Stop the source when leaving audioBars**

Replace `setAnimationMode` (lines 244-249):

```ts
export function setAnimationMode(mode: AnimationMode): void {
	animationState.mode = mode;
	if (animationState.isPlaying) {
		runtime.setMode(mode);
	}
}
```

with:

```ts
export function setAnimationMode(mode: AnimationMode): void {
	if (animationState.mode === 'audioBars' && mode !== 'audioBars') {
		audioSource.stop();
	}
	animationState.mode = mode;
	if (animationState.isPlaying) {
		runtime.setMode(mode);
	}
}
```

And in `stopInternal` (lines 121-132), add `audioSource.stop();` as the first statement inside the function (before `cleanupCurrentAnimation();`):

```ts
function stopInternal(resetProgress = true) {
	audioSource.stop();
	cleanupCurrentAnimation();
	runtime.setMode(null);
```

- [ ] **Step 7: Add the mutators and re-export the source**

After `setDataSeriesConfig` (lines 251-253), add:

```ts
export function setAudioBarsConfig(next: Partial<AudioBarsConfig>): void {
	animationState.audioBars = { ...animationState.audioBars, ...next };
}

export async function setAudioSource(mode: AnimationState['audioSource']): Promise<void> {
	animationState.audioSource = mode;
	try {
		if (mode === 'mic' || mode === 'file') {
			await audioSource.setMode(mode);
		} else {
			audioSource.setMode('off');
		}
	} catch {
		// Permission denied / unsupported: fall back to the demo source so the logo keeps moving.
		animationState.audioSource = 'demo';
		audioSource.setMode('off');
	}
}

export { audioSource };
```

- [ ] **Step 8: Verify**

Run: `npx eslint src/lib/state/animation.svelte.ts`
Expected: clean.

Run: `npx vitest run src/lib/state/animation.svelte.spec.ts`
Expected: PASS (existing tests unaffected).

Run: `npm run check`
Expected: only the 2 pre-existing errors (animation.svelte.spec.ts:270, runtime.spec.ts:34); no new errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib/state/animation.svelte.ts
git commit -m "feat: route audioBars readBars to demo/mic/file source"
```

---

## Task 5: UI controls in `AnimationSection.svelte`

**Files:**
- Modify: `src/lib/components/AnimationSection.svelte`
- Test: `src/lib/components/AnimationSection.svelte.spec.ts`

- [ ] **Step 1: Extend the test mock and add failing tests**

In `src/lib/components/AnimationSection.svelte.spec.ts`, the hoisted `animationApi` (around lines 14-28) must gain the new state fields, mutators, and the `audioSource` object. Update the `vi.hoisted` block so `animationApi` includes (add to `animationState`: `audioBars` and `audioSource`; add the new functions):

```ts
const animationApi = vi.hoisted(() => ({
	animationState: {
		mode: null as 'simple' | 'audioBars' | 'dataSeries' | null,
		isPlaying: false,
		isPaused: false,
		progress: 0.25,
		durationSec: 3,
		loop: false,
		alternate: false,
		audioSource: 'demo' as 'demo' | 'mic' | 'file' | 'off',
		audioBars: {
			smoothing: 0.5,
			minHz: 20,
			maxHz: 20000,
			waveCrests: 3,
			waveAmplitudeGain: 0.3,
			wavePhaseSpeed: 2.2,
			inputGain: 1
		}
	},
	togglePlay: vi.fn(),
	setAnimationMode: vi.fn(),
	setAnimationDurationSec: vi.fn(),
	setAnimationLoop: vi.fn(),
	setAnimationAlternate: vi.fn(),
	handleCompositionChanged: vi.fn(),
	setAudioBarsConfig: vi.fn(),
	setAudioSource: vi.fn(),
	audioSource: { loadFile: vi.fn(), play: vi.fn(), pause: vi.fn() }
}));
```

In the `beforeEach` clear block (around lines 41-53), add `mockClear()` for the new fns and reset the new state, so it includes:

```ts
		animationApi.setAudioBarsConfig.mockClear();
		animationApi.setAudioSource.mockClear();
		animationApi.audioSource.loadFile.mockClear();
		animationApi.audioSource.play.mockClear();
		animationApi.audioSource.pause.mockClear();
		animationApi.animationState.audioSource = 'demo';
```

Then add these tests inside the `describe('AnimationSection', ...)` block (before its closing `});`):

```ts
	it('shows the audio source selector and five sliders in audioBars mode', async () => {
		animationApi.animationState.mode = 'audioBars';
		render(AnimationSection);

		await expect.element(page.getByLabelText('Audio source')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Wave crests')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Amplitude gain')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Phase speed')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Smoothing')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Input gain')).toBeInTheDocument();
	});

	it('does not show the audio controls outside audioBars mode', async () => {
		animationApi.animationState.mode = 'simple';
		render(AnimationSection);
		await expect.element(page.getByLabelText('Audio source')).not.toBeInTheDocument();
	});

	it('wires the source selector and a slider to their actions', async () => {
		animationApi.animationState.mode = 'audioBars';
		render(AnimationSection);

		await userEvent.selectOptions(page.getByLabelText('Audio source'), 'mic');
		expect(animationApi.setAudioSource).toHaveBeenLastCalledWith('mic');

		await userEvent.fill(page.getByLabelText('Phase speed'), '4');
		expect(animationApi.setAudioBarsConfig).toHaveBeenLastCalledWith({ wavePhaseSpeed: 4 });
	});

	it('enables Play in audioBars mode even with no secondary paths', async () => {
		animationApi.animationState.mode = 'audioBars';
		compositionApi.composition.rings = [
			{ secondaryTemplatePath: null, morphT: 0 },
			{ secondaryTemplatePath: null, morphT: 0.2 }
		];
		render(AnimationSection);

		await expect
			.element(page.getByText('Animation won’t run until at least one ring has a secondary path.'))
			.not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Play' })).toBeEnabled();
	});
```

- [ ] **Step 2: Run, verify the new tests FAIL**

Run: `npx vitest run src/lib/components/AnimationSection.svelte.spec.ts`
Expected: the new tests FAIL (controls absent / Play disabled in audioBars); existing tests still pass.

- [ ] **Step 3: Implement the component changes**

In `src/lib/components/AnimationSection.svelte`:

(a) Update the imports from `$lib/state/animation` (lines 6-12) to add the new functions and `audioSource`:

```ts
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
```

(b) Change the morph-rings gate. The warning block (lines 36-42) and the Play button `disabled` (line 83) must exempt audioBars. Add a derived flag after `hasMorphRings` (lines 19-21):

```ts
	const requiresMorphRings = $derived(animationState.mode !== 'audioBars');
	const blockPlayback = $derived(requiresMorphRings && !hasMorphRings);
```

Change the warning `{#if !hasMorphRings}` (line 36) to `{#if blockPlayback}`, and the Play button `disabled={!hasMorphRings}` (line 83) to `disabled={blockPlayback}`.

(c) Add the audioBars control panel. Immediately after the closing `</div>` of the mode selector block (the `<div class="flex flex-col gap-1">` that ends at line 69), insert this block:

```svelte
			{#if animationState.mode === 'audioBars'}
				<div class="flex flex-col gap-2 rounded border border-border p-2">
					<div class="flex flex-col gap-1">
						<Label for="audio-source" class="text-xs">Audio source</Label>
						<select
							id="audio-source"
							class="h-9 rounded-md border border-input bg-background px-3 text-xs"
							value={animationState.audioSource}
							onchange={(e) =>
								setAudioSource(
									(e.target as HTMLSelectElement).value as 'demo' | 'mic' | 'file' | 'off'
								)}
						>
							<option value="demo">Demo</option>
							<option value="mic">Microphone</option>
							<option value="file">File</option>
						</select>
					</div>

					{#if animationState.audioSource === 'file'}
						<div class="flex flex-col gap-1">
							<Label for="audio-file" class="text-xs">Audio file</Label>
							<input
								id="audio-file"
								type="file"
								accept="audio/*"
								class="text-xs"
								onchange={(e) => {
									const file = (e.target as HTMLInputElement).files?.[0];
									if (file) audioSource.loadFile(file);
								}}
							/>
							<div class="flex gap-2">
								<Button onclick={() => audioSource.play()}>Play file</Button>
								<Button onclick={() => audioSource.pause()}>Pause file</Button>
							</div>
						</div>
					{/if}

					<div class="flex flex-col gap-1">
						<Label for="wave-crests" class="text-xs">Wave crests</Label>
						<input
							id="wave-crests"
							type="range"
							min="1"
							max="8"
							step="1"
							value={animationState.audioBars.waveCrests}
							oninput={(e) =>
								setAudioBarsConfig({ waveCrests: Number((e.target as HTMLInputElement).value) })}
						/>
					</div>

					<div class="flex flex-col gap-1">
						<Label for="amplitude-gain" class="text-xs">Amplitude gain</Label>
						<input
							id="amplitude-gain"
							type="range"
							min="0"
							max="1"
							step="0.01"
							value={animationState.audioBars.waveAmplitudeGain}
							oninput={(e) =>
								setAudioBarsConfig({
									waveAmplitudeGain: Number((e.target as HTMLInputElement).value)
								})}
						/>
					</div>

					<div class="flex flex-col gap-1">
						<Label for="phase-speed" class="text-xs">Phase speed</Label>
						<input
							id="phase-speed"
							type="range"
							min="0"
							max="6"
							step="0.1"
							value={animationState.audioBars.wavePhaseSpeed}
							oninput={(e) =>
								setAudioBarsConfig({ wavePhaseSpeed: Number((e.target as HTMLInputElement).value) })}
						/>
					</div>

					<div class="flex flex-col gap-1">
						<Label for="smoothing" class="text-xs">Smoothing</Label>
						<input
							id="smoothing"
							type="range"
							min="0"
							max="0.95"
							step="0.05"
							value={animationState.audioBars.smoothing}
							oninput={(e) =>
								setAudioBarsConfig({ smoothing: Number((e.target as HTMLInputElement).value) })}
						/>
					</div>

					<div class="flex flex-col gap-1">
						<Label for="input-gain" class="text-xs">Input gain</Label>
						<input
							id="input-gain"
							type="range"
							min="0.5"
							max="4"
							step="0.1"
							value={animationState.audioBars.inputGain}
							oninput={(e) =>
								setAudioBarsConfig({ inputGain: Number((e.target as HTMLInputElement).value) })}
						/>
					</div>
				</div>
			{/if}
```

- [ ] **Step 4: Run, verify it PASSES**

Run: `npx vitest run src/lib/components/AnimationSection.svelte.spec.ts`
Expected: PASS (existing + 4 new tests).

- [ ] **Step 5: Lint/format the component**

Run: `npx eslint src/lib/components/AnimationSection.svelte && npx prettier --check src/lib/components/AnimationSection.svelte`
Expected: clean. If Prettier flags it, run `npx prettier --write src/lib/components/AnimationSection.svelte` and re-run the test.

(The orchestrator will additionally run the `svelte-autofixer` MCP tool on this component during review per `CLAUDE.md`; apply any fixes it returns and re-run the test until both are clean.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/AnimationSection.svelte src/lib/components/AnimationSection.svelte.spec.ts
git commit -m "feat: add audioBars source selector and tuning sliders"
```

---

## Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full unit suite**

Run: `npm run test:unit -- --run`
Expected: all suites green, including new `audio-source` tests and the extended `AnimationSection` tests.

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: only the 2 pre-existing errors (animation.svelte.spec.ts:270, runtime.spec.ts:34).

- [ ] **Step 3: Lint of touched files**

Run: `npx eslint src/lib/state/animation-drivers/audio-source.ts src/lib/state/animation-drivers/audio-source.spec.ts src/lib/state/animation-drivers/types.ts src/lib/state/animation.svelte.ts src/lib/components/AnimationSection.svelte src/lib/components/AnimationSection.svelte.spec.ts`
Expected: clean.

- [ ] **Step 4: Manual visual/audio check (recommended)**

`npm run dev`, set mode to Audio Bars. With **Demo** the petals ripple immediately. Switch to **Microphone** (approve permission) and speak → ripple follows the sound; deny → reverts to Demo, no crash. Switch to **File**, pick a Bettona recording, press Play file → it is audible and the petals ripple; a bell transient produces a visible wave that grows and decays. Move each slider and confirm the behavior changes live. Switch mode away → mic released.

---

## Self-Review notes (resolved)

- **Spec coverage:** `reduceToBands` → T1; `createAudioSource` (mic/file/off, gesture resume, mic-not-to-destination, file-to-destination, degradation) → T2; `inputGain` config → T3; source-aware `readBars` routing + mutators + lifecycle + ephemeral `audioSource` state → T4; UI selector/file/5 sliders/play-gate fix → T5; verification → T6.
- **Type consistency:** `AudioBarsConfig` (with `inputGain`) used identically in `audio-source.ts` (T1/T2), `types.ts` (T3), defaults + `setAudioBarsConfig` (T3/T4), and the test mock (T5). `AudioSourceMode = 'mic'|'file'|'off'` (source) vs `animationState.audioSource = 'demo'|'mic'|'file'|'off'` (UI/state) are intentionally different: the coordinator maps `'demo'`→fallback and calls `audioSource.setMode('off')` for non-live sources. `setAudioSource` / `setAudioBarsConfig` names match between T4 (definition), the wiring, and T5 (mock + assertions).
- **Glue coverage caveat:** Task 4's singleton/rAF wiring has no isolated unit test by design; it is covered by Task 2 (source contract) and Task 5 (mutator invocation). Documented in Task 4.
```
