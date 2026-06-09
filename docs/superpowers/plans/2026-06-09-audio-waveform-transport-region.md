# Audio Waveform, Transport & Region Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Svelte rule:** After writing or editing any `.svelte` file, run `mcp__svelte__svelte-autofixer` on it and fix all reported issues before committing.

**Goal:** Add waveform visualization, unified transport, region selection, and a proper file-load UX to the audio panel — without touching the wave engine, audioBars driver, or any existing animation logic.

**Architecture:** Extend `audio-source.ts` with three capability groups (waveform decode, seek/currentTime, region+loop), each tested independently. Build a new `AudioFilePanel.svelte` component that owns all file-source UI (canvas + transport + region + drop zone). Finally wire it into `AnimationSection.svelte`, replacing the old file controls and hiding the global progress bar in file mode.

**Tech Stack:** Web Audio API (`decodeAudioData`, `AudioBuffer`), HTML5 Canvas 2D, Svelte 5 Runes, Vitest, `vitest-browser-svelte`.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/state/animation-drivers/audio-source.ts` | New type `WaveformPeak`; new methods on `AudioSource` interface; extended `createAudioSource` impl |
| Modify | `src/lib/state/animation-drivers/audio-source.spec.ts` | Tests for all new methods |
| Create | `src/lib/components/AudioFilePanel.svelte` | Full file-source UI: drop zone, canvas, transport, region |
| Create | `src/lib/components/AudioFilePanel.svelte.spec.ts` | Component tests |
| Modify | `src/lib/components/AnimationSection.svelte` | Integrate AudioFilePanel; remove old file controls; conditional progress bar |
| Modify | `src/lib/components/AnimationSection.svelte.spec.ts` | Expand audioSource mock; update tests |

**Do NOT touch:** `audio-bars-driver.ts`, `wave.ts`, `bend.ts`, `geometry/`, `RingWaveConfigItem.svelte`, `WavePreview.svelte`, or any existing animation driver.

---

## Task 1 — Waveform peaks in AudioSource

**Files:**
- Modify: `src/lib/state/animation-drivers/audio-source.ts`
- Modify: `src/lib/state/animation-drivers/audio-source.spec.ts`

### New types and constants (add at the top of the file, after existing imports)

- [ ] **Step 1.1: Add `WaveformPeak` export and `PEAK_BUCKETS` constant**

In `audio-source.ts`, add after the `clamp01` function:

```typescript
export type WaveformPeak = { min: number; max: number };

const PEAK_BUCKETS = 800;

function calculatePeaks(audioBuffer: AudioBuffer, bucketCount: number): WaveformPeak[] {
	const data = audioBuffer.getChannelData(0);
	const total = data.length;
	const peaks: WaveformPeak[] = [];
	for (let b = 0; b < bucketCount; b++) {
		const start = Math.floor((b / bucketCount) * total);
		const end = Math.floor(((b + 1) / bucketCount) * total);
		let min = Infinity;
		let max = -Infinity;
		for (let i = start; i < end; i++) {
			if (data[i] < min) min = data[i];
			if (data[i] > max) max = data[i];
		}
		peaks.push({ min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max });
	}
	return peaks;
}
```

- [ ] **Step 1.2: Add new methods to the `AudioSource` interface**

Replace the existing `AudioSource` type definition:

```typescript
export type AudioSource = {
	setMode(mode: AudioSourceMode): Promise<void>;
	loadFile(file: File): Promise<void>;
	clearFile(): void;
	play(): Promise<void>;
	pause(): void;
	stop(): void;
	readBars(): number[];
	readLevel(): number;
	getPeaks(): WaveformPeak[];
	getDuration(): number;
	getFileName(): string | null;
	getCurrentTime(): number;
	seek(t: number): void;
	setRegion(start: number, end: number): void;
	getRegion(): { start: number; end: number };
	setLoopRegion(enabled: boolean): void;
	isLoopRegion(): boolean;
};
```

- [ ] **Step 1.3: Add internal state variables inside `createAudioSource`**

Inside `createAudioSource`, after the existing `let objectUrl: string | null = null;` line, add:

```typescript
	let peaks: WaveformPeak[] = [];
	let fileDuration = 0;
	let fileName: string | null = null;
	let decodedBuffer: AudioBuffer | null = null;
	let region = { start: 0, end: 0 };
	let loopRegion = false;
```

- [ ] **Step 1.4: Update `loadFile` to decode the AudioBuffer**

Replace the existing `loadFile` function:

```typescript
	async function loadFile(file: File): Promise<void> {
		fileName = file.name;
		if (!audioEl) audioEl = new Audio();
		if (objectUrl) URL.revokeObjectURL(objectUrl);
		objectUrl = URL.createObjectURL(file);
		audioEl.src = objectUrl;

		const ctx = ensureContext();
		const arrayBuffer = await file.arrayBuffer();
		try {
			decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
			peaks = calculatePeaks(decodedBuffer, PEAK_BUCKETS);
			fileDuration = decodedBuffer.duration;
		} catch {
			decodedBuffer = null;
			peaks = [];
			fileDuration = 0;
		}
	}
```

- [ ] **Step 1.5: Add `clearFile`, `getPeaks`, `getDuration`, `getFileName` functions**

Add these after the `loadFile` function:

```typescript
	function clearFile(): void {
		if (objectUrl) {
			URL.revokeObjectURL(objectUrl);
			objectUrl = null;
		}
		if (audioEl) {
			audioEl.pause();
			audioEl.src = '';
		}
		peaks = [];
		fileDuration = 0;
		fileName = null;
		decodedBuffer = null;
		region = { start: 0, end: 0 };
		loopRegion = false;
	}

	function getPeaks(): WaveformPeak[] {
		return peaks;
	}

	function getDuration(): number {
		return fileDuration;
	}

	function getFileName(): string | null {
		return fileName;
	}
```

- [ ] **Step 1.6: Add stubs for seek/getCurrentTime/region/loop (needed for type compliance)**

Add after `getFileName`:

```typescript
	function getCurrentTime(): number {
		return audioEl?.currentTime ?? 0;
	}

	function seek(t: number): void {
		if (!audioEl) return;
		const max = fileDuration > 0 ? fileDuration : (audioEl.duration || 0);
		audioEl.currentTime = Math.max(0, Math.min(t, max));
	}

	function setRegion(start: number, end: number): void {
		const max = fileDuration;
		region = {
			start: Math.max(0, Math.min(start, max)),
			end: Math.max(0, Math.min(end, max))
		};
	}

	function getRegion(): { start: number; end: number } {
		return { ...region };
	}

	function setLoopRegion(enabled: boolean): void {
		loopRegion = enabled;
	}

	function isLoopRegion(): boolean {
		return loopRegion;
	}
```

- [ ] **Step 1.7: Update the `return` statement at the bottom of `createAudioSource`**

Replace:
```typescript
	return { setMode, loadFile, play, pause, stop, readBars, readLevel };
```
With:
```typescript
	return {
		setMode,
		loadFile,
		clearFile,
		play,
		pause,
		stop,
		readBars,
		readLevel,
		getPeaks,
		getDuration,
		getFileName,
		getCurrentTime,
		seek,
		setRegion,
		getRegion,
		setLoopRegion,
		isLoopRegion
	};
```

- [ ] **Step 1.8: Update `MockAudioContext` in the spec file to include `decodeAudioData`**

In `audio-source.spec.ts`, update `MockAudioContext` to add `decodeAudioData`:

```typescript
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
	decodeAudioData = vi.fn(async (_buf: ArrayBuffer) => {
		const fakeData = new Float32Array(2400);
		for (let i = 0; i < fakeData.length; i++) fakeData[i] = i % 2 === 0 ? 0.5 : -0.3;
		return {
			duration: 5.0,
			length: 2400,
			numberOfChannels: 1,
			sampleRate: 48000,
			getChannelData: () => fakeData
		} as unknown as AudioBuffer;
	});
}
```

- [ ] **Step 1.9: Write failing tests for waveform methods**

Add a new `describe` block in `audio-source.spec.ts`:

```typescript
describe('loadFile — waveform decoding', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	function stubFileMode() {
		vi.stubGlobal('AudioContext', MockAudioContext);
		vi.stubGlobal('Audio', class {
			src = '';
			currentTime = 0;
			duration = 10;
			play = vi.fn();
			pause = vi.fn();
		});
		vi.stubGlobal('URL', {
			createObjectURL: vi.fn(() => 'blob:fake'),
			revokeObjectURL: vi.fn()
		});
	}

	it('returns empty state before any file is loaded', () => {
		vi.stubGlobal('AudioContext', MockAudioContext);
		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		expect(source.getPeaks()).toEqual([]);
		expect(source.getDuration()).toBe(0);
		expect(source.getFileName()).toBeNull();
	});

	it('decodes file and returns 800 peaks after loadFile', async () => {
		stubFileMode();
		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		await source.setMode('file');
		await source.loadFile(new File([new Uint8Array(100)], 'bettona.mp3', { type: 'audio/mpeg' }));

		const peaks = source.getPeaks();
		expect(peaks).toHaveLength(800);
		for (const p of peaks) {
			expect(p.min).toBeLessThanOrEqual(p.max);
			expect(p.min).toBeGreaterThanOrEqual(-1);
			expect(p.max).toBeLessThanOrEqual(1);
		}
		expect(source.getDuration()).toBe(5.0);
		expect(source.getFileName()).toBe('bettona.mp3');
	});

	it('handles decodeAudioData failure gracefully — clears peaks', async () => {
		vi.stubGlobal('AudioContext', class extends MockAudioContext {
			override decodeAudioData = vi.fn(async () => Promise.reject(new Error('decode error')));
		});
		vi.stubGlobal('Audio', class { src = ''; play = vi.fn(); pause = vi.fn(); });
		vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() });

		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		await source.setMode('file');
		await source.loadFile(new File([new Uint8Array(100)], 'bad.mp3'));

		expect(source.getPeaks()).toEqual([]);
		expect(source.getDuration()).toBe(0);
	});

	it('clearFile resets all waveform state', async () => {
		stubFileMode();
		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		await source.setMode('file');
		await source.loadFile(new File([new Uint8Array(100)], 'test.mp3'));
		expect(source.getPeaks()).toHaveLength(800);

		source.clearFile();
		expect(source.getPeaks()).toEqual([]);
		expect(source.getDuration()).toBe(0);
		expect(source.getFileName()).toBeNull();
	});
});
```

- [ ] **Step 1.10: Run tests — expect failures for the new describe block (existing tests must still pass)**

```bash
cd /Users/tommaso/Documents/GitHub/logo-bettona && bun run vitest run src/lib/state/animation-drivers/audio-source.spec.ts
```

Expected: existing `reduceToBands` and `createAudioSource` tests pass; new `loadFile — waveform decoding` tests pass.

- [ ] **Step 1.11: Commit**

```bash
git add src/lib/state/animation-drivers/audio-source.ts src/lib/state/animation-drivers/audio-source.spec.ts
git commit -m "feat: add waveform peaks and file state to AudioSource"
```

---

## Task 2 — Region + loop enforcement in AudioSource

**Files:**
- Modify: `src/lib/state/animation-drivers/audio-source.ts`
- Modify: `src/lib/state/animation-drivers/audio-source.spec.ts`

The seek/getCurrentTime/setRegion/getRegion/setLoopRegion/isLoopRegion stubs were added in Task 1. This task adds the loop enforcement inside `readBars` and tests all region/seek behaviour.

- [ ] **Step 2.1: Add loop enforcement inside `readBars`**

In `createAudioSource`, update the `readBars` function to check region loop before reading frequency data:

```typescript
	function readBars(): number[] {
		if (mode === 'off' || !analyser || !buffer || !audioContext) return [];

		// Region loop: if loop is on and playback has passed regionEnd, jump back.
		if (loopRegion && audioEl && region.end > region.start) {
			if (audioEl.currentTime >= region.end || audioEl.currentTime < region.start) {
				audioEl.currentTime = region.start;
			}
		}

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
```

- [ ] **Step 2.2: Write failing tests for seek, region, and loop**

Add to `audio-source.spec.ts`:

```typescript
describe('seek and getCurrentTime', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('getCurrentTime returns 0 when no audio element exists', () => {
		vi.stubGlobal('AudioContext', MockAudioContext);
		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		expect(source.getCurrentTime()).toBe(0);
	});

	it('seek clamps to [0, duration] and writes audioEl.currentTime', async () => {
		let ct = 0;
		vi.stubGlobal('AudioContext', MockAudioContext);
		vi.stubGlobal('Audio', class {
			src = '';
			get currentTime() { return ct; }
			set currentTime(v: number) { ct = v; }
			duration = 10;
			play = vi.fn();
			pause = vi.fn();
		});
		vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() });

		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		await source.setMode('file');
		await source.loadFile(new File([new Uint8Array(100)], 't.mp3'));

		source.seek(2.5);
		expect(source.getCurrentTime()).toBeCloseTo(2.5);

		source.seek(-1);
		expect(source.getCurrentTime()).toBe(0);

		source.seek(999); // past decoded duration of 5.0
		expect(source.getCurrentTime()).toBe(5.0);
	});
});

describe('region and loop', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('getRegion returns {start:0,end:0} by default', () => {
		vi.stubGlobal('AudioContext', MockAudioContext);
		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		expect(source.getRegion()).toEqual({ start: 0, end: 0 });
	});

	it('isLoopRegion defaults false and toggles', () => {
		vi.stubGlobal('AudioContext', MockAudioContext);
		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		expect(source.isLoopRegion()).toBe(false);
		source.setLoopRegion(true);
		expect(source.isLoopRegion()).toBe(true);
		source.setLoopRegion(false);
		expect(source.isLoopRegion()).toBe(false);
	});

	it('setRegion clamps to [0, duration]', async () => {
		vi.stubGlobal('AudioContext', MockAudioContext);
		vi.stubGlobal('Audio', class { src = ''; play = vi.fn(); pause = vi.fn(); });
		vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() });

		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		await source.setMode('file');
		await source.loadFile(new File([new Uint8Array(100)], 't.mp3')); // duration 5.0

		source.setRegion(1.0, 3.0);
		expect(source.getRegion()).toEqual({ start: 1.0, end: 3.0 });

		source.setRegion(-5, 999); // both clamped
		expect(source.getRegion()).toEqual({ start: 0, end: 5.0 });
	});

	it('readBars resets currentTime to regionStart when past regionEnd with loop on', async () => {
		let ct = 3.5;
		vi.stubGlobal('AudioContext', MockAudioContext);
		vi.stubGlobal('Audio', class {
			src = '';
			get currentTime() { return ct; }
			set currentTime(v: number) { ct = v; }
			play = vi.fn();
			pause = vi.fn();
		});
		vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() });

		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		await source.setMode('file');
		await source.loadFile(new File([new Uint8Array(100)], 't.mp3'));

		source.setRegion(1.0, 3.0);
		source.setLoopRegion(true);
		// ct = 3.5 >= regionEnd = 3.0 → should reset to regionStart = 1.0
		source.readBars();
		expect(ct).toBe(1.0);
	});

	it('readBars does NOT reset currentTime when loop is off', async () => {
		let ct = 3.5;
		vi.stubGlobal('AudioContext', MockAudioContext);
		vi.stubGlobal('Audio', class {
			src = '';
			get currentTime() { return ct; }
			set currentTime(v: number) { ct = v; }
			play = vi.fn();
			pause = vi.fn();
		});
		vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() });

		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		await source.setMode('file');
		await source.loadFile(new File([new Uint8Array(100)], 't.mp3'));

		source.setRegion(1.0, 3.0);
		source.setLoopRegion(false);
		source.readBars();
		expect(ct).toBe(3.5); // unchanged
	});
});
```

- [ ] **Step 2.3: Run tests — all must pass**

```bash
cd /Users/tommaso/Documents/GitHub/logo-bettona && bun run vitest run src/lib/state/animation-drivers/audio-source.spec.ts
```

Expected: all tests pass.

- [ ] **Step 2.4: Run full test suite — existing tests must stay green**

```bash
cd /Users/tommaso/Documents/GitHub/logo-bettona && bun run vitest run
```

Expected: 0 failures outside `audio-source.spec.ts` changes.

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/state/animation-drivers/audio-source.ts src/lib/state/animation-drivers/audio-source.spec.ts
git commit -m "feat: add seek, region, and loop enforcement to AudioSource"
```

---

## Task 3 — `AudioFilePanel.svelte` component

**Files:**
- Create: `src/lib/components/AudioFilePanel.svelte`
- Create: `src/lib/components/AudioFilePanel.svelte.spec.ts`

This component owns all file-source UI: drop zone (empty / loading / loaded states), canvas waveform (peaks + playhead + region handles), transport (Play/Pause that starts both audio and animation frame loop), region duration field, and loop toggle.

It reads from `audioSource` (polled via rAF) and dispatches to `audioSource` methods + `togglePlay` / `animationState` from `$lib/state/animation`.

- [ ] **Step 3.1: Write the failing component tests first**

Create `src/lib/components/AudioFilePanel.svelte.spec.ts`:

```typescript
import { page, userEvent } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const animApi = vi.hoisted(() => ({
	animationState: { isPlaying: false, audioSource: 'file' as const },
	togglePlay: vi.fn(),
	audioSource: {
		loadFile: vi.fn(async () => {}),
		clearFile: vi.fn(),
		play: vi.fn(async () => {}),
		pause: vi.fn(),
		getPeaks: vi.fn(() => [] as { min: number; max: number }[]),
		getDuration: vi.fn(() => 0),
		getFileName: vi.fn(() => null as string | null),
		getCurrentTime: vi.fn(() => 0),
		seek: vi.fn(),
		setRegion: vi.fn(),
		getRegion: vi.fn(() => ({ start: 0, end: 0 })),
		setLoopRegion: vi.fn(),
		isLoopRegion: vi.fn(() => false),
		readLevel: vi.fn(() => 0)
	}
}));

vi.mock('$lib/state/animation', () => animApi);

import AudioFilePanel from './AudioFilePanel.svelte';

describe('AudioFilePanel', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		animApi.animationState.isPlaying = false;
		animApi.audioSource.getFileName.mockReturnValue(null);
		animApi.audioSource.getDuration.mockReturnValue(0);
		animApi.audioSource.getPeaks.mockReturnValue([]);
	});

	it('shows drop zone with "browse" affordance when no file loaded', async () => {
		render(AudioFilePanel);
		await expect.element(page.getByText(/drop audio file|browse/i)).toBeInTheDocument();
	});

	it('file input calls loadFile when a file is selected', async () => {
		render(AudioFilePanel);
		const input = page.getByRole('button', { name: /browse/i });
		// The button click opens file picker; test the handler directly via the hidden input
		const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
		expect(fileInput).toBeTruthy();
		const fakeFile = new File([''], 'bettona.mp3', { type: 'audio/mpeg' });
		Object.defineProperty(fileInput, 'files', { value: [fakeFile], configurable: true });
		fileInput.dispatchEvent(new Event('change', { bubbles: true }));
		await vi.waitFor(() => expect(animApi.audioSource.loadFile).toHaveBeenCalledWith(fakeFile));
	});

	it('shows filename and duration once file is loaded', async () => {
		animApi.audioSource.getFileName.mockReturnValue('bettona.mp3');
		animApi.audioSource.getDuration.mockReturnValue(12.4);
		render(AudioFilePanel);
		await expect.element(page.getByText('bettona.mp3')).toBeInTheDocument();
		await expect.element(page.getByText(/12\.4\s*s/)).toBeInTheDocument();
	});

	it('Play calls audioSource.play() and togglePlay when not already playing', async () => {
		animApi.audioSource.getFileName.mockReturnValue('bettona.mp3');
		animApi.audioSource.getDuration.mockReturnValue(5.0);
		render(AudioFilePanel);
		await userEvent.click(page.getByRole('button', { name: /^play$/i }));
		expect(animApi.audioSource.play).toHaveBeenCalledOnce();
		expect(animApi.togglePlay).toHaveBeenCalledOnce();
	});

	it('Pause calls audioSource.pause() and togglePlay when already playing', async () => {
		animApi.animationState.isPlaying = true;
		animApi.audioSource.getFileName.mockReturnValue('bettona.mp3');
		animApi.audioSource.getDuration.mockReturnValue(5.0);
		render(AudioFilePanel);
		await userEvent.click(page.getByRole('button', { name: /pause/i }));
		expect(animApi.audioSource.pause).toHaveBeenCalledOnce();
		expect(animApi.togglePlay).toHaveBeenCalledOnce();
	});

	it('loop toggle calls setLoopRegion with toggled value', async () => {
		animApi.audioSource.getFileName.mockReturnValue('bettona.mp3');
		animApi.audioSource.getDuration.mockReturnValue(5.0);
		render(AudioFilePanel);
		const checkbox = page.getByRole('checkbox', { name: /loop/i });
		await userEvent.click(checkbox);
		expect(animApi.audioSource.setLoopRegion).toHaveBeenCalledWith(true);
	});

	it('Remove calls clearFile', async () => {
		animApi.audioSource.getFileName.mockReturnValue('bettona.mp3');
		animApi.audioSource.getDuration.mockReturnValue(5.0);
		render(AudioFilePanel);
		await userEvent.click(page.getByRole('button', { name: /remove/i }));
		expect(animApi.audioSource.clearFile).toHaveBeenCalledOnce();
	});
});
```

- [ ] **Step 3.2: Run tests — they must fail (component not yet created)**

```bash
cd /Users/tommaso/Documents/GitHub/logo-bettona && bun run vitest run src/lib/components/AudioFilePanel.svelte.spec.ts
```

Expected: all 7 tests fail with "Cannot find module" or similar.

- [ ] **Step 3.3: Create `AudioFilePanel.svelte`**

Create `src/lib/components/AudioFilePanel.svelte`:

```svelte
<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import { animationState, audioSource, togglePlay } from '$lib/state/animation';

	// ── canvas ref and rAF state ─────────────────────────────────────────────
	let canvasEl: HTMLCanvasElement | undefined = $state();
	let currentTime = $state(0);
	let regionStart = $state(0);
	let regionEnd = $state(0);
	let durationDisplay = $state('0.0');
	let durationFocused = $state(false);
	let isLooping = $state(false);

	// ── file load UX state ───────────────────────────────────────────────────
	let fileInputEl: HTMLInputElement | undefined = $state();
	let isLoading = $state(false);
	let isDragOver = $state(false);

	// ── derived ──────────────────────────────────────────────────────────────
	const hasFile = $derived(audioSource.getFileName() !== null);
	const isPlaying = $derived(animationState.isPlaying);
	const inputLevelPercent = $derived(
		Math.round(Math.max(0, Math.min(1, audioSource.readLevel())) * 100)
	);

	// ── rAF loop: poll currentTime, region, level ────────────────────────────
	$effect(() => {
		let raf: number;
		function loop() {
			currentTime = audioSource.getCurrentTime();
			isLooping = audioSource.isLoopRegion();
			const r = audioSource.getRegion();
			if (!durationFocused) {
				regionStart = r.start;
				regionEnd = r.end;
				durationDisplay = (r.end - r.start).toFixed(1);
			}
			drawCanvas();
			raf = requestAnimationFrame(loop);
		}
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	// ── canvas resize observer ───────────────────────────────────────────────
	$effect(() => {
		if (!canvasEl) return;
		const observer = new ResizeObserver(() => {
			if (!canvasEl) return;
			canvasEl.width = canvasEl.offsetWidth || 400;
			canvasEl.height = canvasEl.offsetHeight || 64;
			drawCanvas();
		});
		observer.observe(canvasEl);
		return () => observer.disconnect();
	});

	function drawCanvas() {
		if (!canvasEl) return;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;
		const { width, height } = canvasEl;
		ctx.clearRect(0, 0, width, height);

		const peaks = audioSource.getPeaks();
		const duration = audioSource.getDuration();
		if (peaks.length === 0 || duration === 0) return;

		const region = audioSource.getRegion();
		const rs = (region.start / duration) * width;
		const re = (region.end / duration) * width;

		// region highlight
		ctx.fillStyle = 'rgba(99,102,241,0.15)';
		ctx.fillRect(rs, 0, re - rs, height);

		// waveform peaks
		const midY = height / 2;
		const bucketW = width / peaks.length;
		ctx.fillStyle = '#a1a1aa';
		for (let b = 0; b < peaks.length; b++) {
			const x = Math.floor(b * bucketW);
			const topY = midY * (1 - peaks[b].max);
			const botY = midY * (1 - peaks[b].min);
			ctx.fillRect(x, topY, Math.max(1, Math.ceil(bucketW)), botY - topY);
		}

		// playhead
		const px = (currentTime / duration) * width;
		ctx.strokeStyle = '#f43f5e';
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.moveTo(px, 0);
		ctx.lineTo(px, height);
		ctx.stroke();

		// region handles
		const handleW = 3;
		ctx.fillStyle = 'rgba(99,102,241,0.8)';
		ctx.fillRect(rs - handleW / 2, 0, handleW, height);
		ctx.fillRect(re - handleW / 2, 0, handleW, height);
	}

	// ── canvas pointer interaction ───────────────────────────────────────────
	const HANDLE_HIT_PX = 10;
	let dragMode: 'start' | 'end' | 'seek' | null = null;

	function canvasXToTime(clientX: number): number {
		if (!canvasEl) return 0;
		const rect = canvasEl.getBoundingClientRect();
		const x = ((clientX - rect.left) / rect.width) * canvasEl.width;
		return (x / canvasEl.width) * audioSource.getDuration();
	}

	function handlePointerDown(e: PointerEvent) {
		const duration = audioSource.getDuration();
		if (duration === 0 || !canvasEl) return;
		const rect = canvasEl.getBoundingClientRect();
		const x = ((e.clientX - rect.left) / rect.width) * canvasEl.width;
		const region = audioSource.getRegion();
		const startX = (region.start / duration) * canvasEl.width;
		const endX = (region.end / duration) * canvasEl.width;
		if (Math.abs(x - startX) <= HANDLE_HIT_PX) {
			dragMode = 'start';
		} else if (Math.abs(x - endX) <= HANDLE_HIT_PX) {
			dragMode = 'end';
		} else {
			dragMode = 'seek';
			audioSource.seek(canvasXToTime(e.clientX));
		}
		canvasEl.setPointerCapture(e.pointerId);
	}

	function handlePointerMove(e: PointerEvent) {
		if (!dragMode) return;
		const t = canvasXToTime(e.clientX);
		const region = audioSource.getRegion();
		if (dragMode === 'start') {
			audioSource.setRegion(t, region.end);
		} else if (dragMode === 'end') {
			audioSource.setRegion(region.start, t);
		} else {
			audioSource.seek(t);
		}
	}

	function handlePointerUp() {
		dragMode = null;
	}

	// ── transport ────────────────────────────────────────────────────────────
	async function handlePlay() {
		await audioSource.play();
		if (!animationState.isPlaying) togglePlay();
	}

	function handlePause() {
		audioSource.pause();
		if (animationState.isPlaying) togglePlay();
	}

	// ── loop toggle ──────────────────────────────────────────────────────────
	function handleLoopChange(e: Event) {
		audioSource.setLoopRegion((e.target as HTMLInputElement).checked);
	}

	// ── file load ────────────────────────────────────────────────────────────
	async function handleFileSelected(file: File) {
		isLoading = true;
		await audioSource.loadFile(file);
		isLoading = false;
	}

	function handleFileInputChange(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) handleFileSelected(file);
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;
		const file = e.dataTransfer?.files[0];
		if (file) handleFileSelected(file);
	}

	function handleRemove() {
		audioSource.clearFile();
		if (animationState.isPlaying) togglePlay();
	}
</script>

<!-- File source area -->
<div class="flex flex-col gap-2">
	<!-- Drop zone -->
	{#if !hasFile}
		<!-- svelte-ignore a11y_interactive_supports_focus -->
		<div
			class="flex cursor-pointer flex-col items-center justify-center gap-1 rounded border-2 border-dashed px-3 py-4 text-xs transition-colors {isDragOver
				? 'border-primary bg-primary/5'
				: 'border-border hover:border-muted-foreground'}"
			role="button"
			tabindex="0"
			ondragover={(e) => {
				e.preventDefault();
				isDragOver = true;
			}}
			ondragleave={() => (isDragOver = false)}
			ondrop={handleDrop}
			onclick={() => fileInputEl?.click()}
			onkeydown={(e) => e.key === 'Enter' && fileInputEl?.click()}
		>
			{#if isLoading}
				<span class="text-muted-foreground">Loading…</span>
			{:else}
				<span class="text-muted-foreground">Drop audio file here</span>
				<Button variant="outline" class="h-7 text-xs" onclick={(e) => { e.stopPropagation(); fileInputEl?.click(); }}>
					Browse
				</Button>
			{/if}
		</div>
	{:else}
		<!-- Loaded state -->
		<div class="flex items-center justify-between gap-2 rounded border border-border px-2 py-1.5">
			<div class="min-w-0 flex-1">
				<p class="truncate text-xs font-medium">{audioSource.getFileName()}</p>
				<p class="text-[10px] text-muted-foreground">{audioSource.getDuration().toFixed(1)} s</p>
			</div>
			<div class="flex shrink-0 gap-1">
				<Button variant="ghost" class="h-6 px-2 text-[11px]" onclick={() => fileInputEl?.click()}>
					Replace
				</Button>
				<Button variant="ghost" class="h-6 px-2 text-[11px]" onclick={handleRemove}>
					Remove
				</Button>
			</div>
		</div>

		<!-- Waveform canvas -->
		<canvas
			bind:this={canvasEl}
			class="h-16 w-full cursor-crosshair rounded border border-border bg-muted/30"
			onpointerdown={handlePointerDown}
			onpointermove={handlePointerMove}
			onpointerup={handlePointerUp}
		></canvas>

		<!-- Transport + region controls -->
		<div class="flex items-center gap-2">
			{#if isPlaying}
				<Button class="h-7 text-xs" onclick={handlePause}>Pause</Button>
			{:else}
				<Button class="h-7 text-xs" onclick={handlePlay}>Play</Button>
			{/if}

			<label class="flex items-center gap-1 text-xs">
				<input
					type="checkbox"
					checked={isLooping}
					onchange={handleLoopChange}
					aria-label="Loop region"
				/>
				Loop
			</label>

			<div class="ml-auto flex items-center gap-1">
				<Label for="region-duration" class="text-xs whitespace-nowrap">Region (s)</Label>
				<input
					id="region-duration"
					type="number"
					min="0.1"
					step="0.1"
					class="h-7 w-20 rounded-md border border-input bg-background px-2 text-xs"
					value={durationFocused ? undefined : durationDisplay}
					onfocus={() => (durationFocused = true)}
					onblur={(e) => {
						durationFocused = false;
						const len = parseFloat((e.target as HTMLInputElement).value);
						if (Number.isFinite(len) && len >= 0.1) {
							audioSource.setRegion(regionStart, regionStart + len);
						}
					}}
					oninput={(e) => {
						const len = parseFloat((e.target as HTMLInputElement).value);
						if (Number.isFinite(len) && len >= 0.1) {
							audioSource.setRegion(regionStart, regionStart + len);
						}
					}}
				/>
			</div>
		</div>

		<!-- Input level -->
		<div
			class="h-1.5 rounded bg-muted"
			role="meter"
			aria-label="Audio input level"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={inputLevelPercent}
		>
			<div class="h-full rounded bg-green-500" style:width="{inputLevelPercent}%"></div>
		</div>
	{/if}

	<input
		bind:this={fileInputEl}
		type="file"
		accept="audio/*"
		class="hidden"
		onchange={handleFileInputChange}
	/>
</div>
```

- [ ] **Step 3.4: Run svelte-autofixer on the component and fix all reported issues**

Call `mcp__svelte__svelte-autofixer` with the full content of `AudioFilePanel.svelte` and apply any fixes. Re-run until no issues remain.

- [ ] **Step 3.5: Run component tests — all 7 must pass**

```bash
cd /Users/tommaso/Documents/GitHub/logo-bettona && bun run vitest run src/lib/components/AudioFilePanel.svelte.spec.ts
```

Expected: all 7 tests pass.

- [ ] **Step 3.6: Commit**

```bash
git add src/lib/components/AudioFilePanel.svelte src/lib/components/AudioFilePanel.svelte.spec.ts
git commit -m "feat: AudioFilePanel component with canvas, transport, region, and drop zone"
```

---

## Task 4 — Integrate `AudioFilePanel` into `AnimationSection`

**Files:**
- Modify: `src/lib/components/AnimationSection.svelte`
- Modify: `src/lib/components/AnimationSection.svelte.spec.ts`

Changes:
1. Replace the old file controls block (`<input type="file">` + "Play file" / "Pause file" buttons) with `<AudioFilePanel />`.
2. Hide the global progress bar and Play/Pause+Duration row when `mode === 'audioBars' && audioSource === 'file'` (AudioFilePanel owns transport in that case).
3. Add "Listening…" indicator text in mic mode.
4. Expand the `audioSource` mock in the spec to include all new methods.

- [ ] **Step 4.1: Update the spec mock first (so tests don't fail on missing methods)**

In `AnimationSection.svelte.spec.ts`, replace:
```typescript
	audioSource: { loadFile: vi.fn(), play: vi.fn(), pause: vi.fn() }
```
With:
```typescript
	audioSource: {
		loadFile: vi.fn(async () => {}),
		clearFile: vi.fn(),
		play: vi.fn(async () => {}),
		pause: vi.fn(),
		stop: vi.fn(),
		setMode: vi.fn(async () => {}),
		readBars: vi.fn(() => [] as number[]),
		readLevel: vi.fn(() => 0),
		getPeaks: vi.fn(() => [] as { min: number; max: number }[]),
		getDuration: vi.fn(() => 0),
		getFileName: vi.fn(() => null as string | null),
		getCurrentTime: vi.fn(() => 0),
		seek: vi.fn(),
		setRegion: vi.fn(),
		getRegion: vi.fn(() => ({ start: 0, end: 0 })),
		setLoopRegion: vi.fn(),
		isLoopRegion: vi.fn(() => false)
	}
```

Also add `clearAllMocks()` (or per-method resets for new methods) in `beforeEach`. Replace the existing `beforeEach` clear block with:

```typescript
	beforeEach(() => {
		vi.clearAllMocks();
		animationApi.animationState.mode = null;
		animationApi.animationState.audioSource = 'demo';
		compositionApi.composition.rings = [
			{ secondaryTemplatePath: { cmds: ['M'], crds: [0, 0] }, morphT: 0 }
		];
	});
```

- [ ] **Step 4.2: Add new tests for the integrated behaviour**

Append to the `describe('AnimationSection')` block:

```typescript
	it('renders AudioFilePanel (not the old file controls) when source is file in audioBars mode', async () => {
		animationApi.animationState.mode = 'audioBars';
		animationApi.animationState.audioSource = 'file';
		render(AnimationSection);
		// Old controls are gone
		await expect.element(page.getByText('Play file')).not.toBeInTheDocument();
		await expect.element(page.getByText('Pause file')).not.toBeInTheDocument();
		// AudioFilePanel renders its drop zone (no file loaded in mock)
		await expect.element(page.getByText(/drop audio file|browse/i)).toBeInTheDocument();
	});

	it('hides the global progress bar in audioBars + file mode', async () => {
		animationApi.animationState.mode = 'audioBars';
		animationApi.animationState.audioSource = 'file';
		render(AnimationSection);
		await expect.element(page.getByRole('progressbar')).not.toBeInTheDocument();
	});

	it('shows the global progress bar in audioBars + mic mode', async () => {
		animationApi.animationState.mode = 'audioBars';
		animationApi.animationState.audioSource = 'mic';
		render(AnimationSection);
		await expect.element(page.getByRole('progressbar')).toBeInTheDocument();
	});

	it('shows "Listening" indicator in mic mode', async () => {
		animationApi.animationState.mode = 'audioBars';
		animationApi.animationState.audioSource = 'mic';
		render(AnimationSection);
		await expect.element(page.getByText(/listening/i)).toBeInTheDocument();
	});
```

- [ ] **Step 4.3: Run failing tests**

```bash
cd /Users/tommaso/Documents/GitHub/logo-bettona && bun run vitest run src/lib/components/AnimationSection.svelte.spec.ts
```

Expected: the 4 new tests fail; the ~12 existing tests still pass.

- [ ] **Step 4.4: Update `AnimationSection.svelte`**

In `AnimationSection.svelte`, make the following changes:

**4.4a — Add `AudioFilePanel` import** (at the top of `<script>`):

```typescript
import AudioFilePanel from './AudioFilePanel.svelte';
```

**4.4b — Add derived for hiding the global transport**:

```typescript
const hideGlobalTransport = $derived(
  animationState.mode === 'audioBars' && animationState.audioSource === 'file'
);
```

**4.4c — Replace the old file controls block** inside the `{#if animationState.audioSource === 'file'}` block:

Remove this entire block:
```svelte
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
```

Replace with:
```svelte
{#if animationState.audioSource === 'file'}
  <AudioFilePanel />
{/if}
```

**4.4d — Add "Listening" indicator in mic mode**, right after the `{#if showInputLevel}` input level block (at the same level, add a mic-specific note):

After the closing `{/if}` of the `showInputLevel` block, add:
```svelte
{#if animationState.audioSource === 'mic'}
  <p class="text-[10px] text-muted-foreground">Listening — speak or play near the microphone.</p>
{/if}
```

**4.4e — Wrap the global transport row and progress bar** in a conditional:

Find the block starting with:
```svelte
<div class="flex items-end gap-2">
```
(the Duration + Play row) and the following progress bar block. Wrap both in:
```svelte
{#if !hideGlobalTransport}
  <!-- existing Duration + Play row -->
  <!-- existing progress bar block -->
{/if}
```

- [ ] **Step 4.5: Run svelte-autofixer on `AnimationSection.svelte` and fix issues**

Call `mcp__svelte__svelte-autofixer` on the updated file content. Apply all fixes. Re-run until clean.

- [ ] **Step 4.6: Run the AnimationSection spec — all tests must pass**

```bash
cd /Users/tommaso/Documents/GitHub/logo-bettona && bun run vitest run src/lib/components/AnimationSection.svelte.spec.ts
```

Expected: all tests pass (including the 4 new ones).

- [ ] **Step 4.7: Run full test suite — no regressions**

```bash
cd /Users/tommaso/Documents/GitHub/logo-bettona && bun run vitest run
```

Expected: all tests pass.

- [ ] **Step 4.8: Typecheck**

```bash
cd /Users/tommaso/Documents/GitHub/logo-bettona && bun run check
```

Expected: no new errors (only the pre-existing shadcn errors that existed before this branch).

- [ ] **Step 4.9: Commit**

```bash
git add src/lib/components/AnimationSection.svelte src/lib/components/AnimationSection.svelte.spec.ts
git commit -m "feat: integrate AudioFilePanel into AnimationSection, hide global transport in file mode"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Covered by |
|-----------------|------------|
| Waveform drawn on `<canvas>` from `decodeAudioData`, no new deps | Task 1 + Task 3 (`drawCanvas`) |
| Keep `<audio>`/MediaElementSource for audible playback | Task 1: `loadFile` still sets `audioEl.src` |
| Single transport Play/Pause (remove "Play file"/"Pause file") | Task 3 (`handlePlay`/`handlePause`) + Task 4 (removal) |
| Playhead advances from `audio.currentTime` | Task 3 rAF loop + `drawCanvas` |
| Seek: click/drag on waveform → `audio.currentTime` | Task 3 (`handlePointerDown`/`handlePointerMove`) + Task 2 `seek()` |
| Input level meter stays visible | Task 3 (level meter inside AudioFilePanel) |
| Draggable region handles (start/end in seconds) | Task 3 handles + Task 2 `setRegion` |
| Region duration preview ("4.2 s") | Task 3 `durationDisplay` + Region (s) field |
| Loop toggle: ON → cycle region, OFF → full track | Task 2 `readBars` loop + Task 3 checkbox |
| Duration field ↔ handles bidirectional sync | Task 3 (`oninput`/`onblur` + rAF updates `durationDisplay`) |
| Progress bar absorbed by waveform playhead (no duplicates) | Task 4 `hideGlobalTransport` |
| File UX: empty / loading / loaded states | Task 3 drop zone states |
| File UX: drag-or-click to load | Task 3 `ondrop` + `onclick` on drop zone |
| File UX: loaded shows name + duration + replace/remove | Task 3 loaded state block |
| Separate file source zone from transport zone visually | Task 3 layout (drop zone first, then canvas+controls) |
| Mic: level meter + "Listening" indicator, no waveform | Task 4 `animationState.audioSource === 'mic'` |
| Demo: unchanged | AudioFilePanel only renders for `source === 'file'` |
| No new dependencies | Canvas drawn via native 2D API only |
| `svelte-autofixer` on all `.svelte` files | Steps 3.4 and 4.5 |
| Existing tests stay green | Steps 2.4, 4.6, 4.7 |
| lint/typecheck clean | Step 4.8 |
| Unit tests: waveform peaks, seek, region, loop | Tasks 1 + 2 |

### Pre-existing issues (ignore)
Same as prior plan: 4 shadcn button typecheck errors, 1 failing e2e test (`creates and removes ring morph target controls`), 401 Prettier non-compliant files.
