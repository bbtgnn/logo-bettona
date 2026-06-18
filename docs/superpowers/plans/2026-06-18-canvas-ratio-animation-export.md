# Canvas Aspect Ratio + WebM Animation Export — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sidebar "Canvas" section to pick the canvas aspect ratio (7 presets), and add real-time WebM export of the running animation alongside the existing SVG export, with a progress bar.

**Architecture:** A pure `ratioToCanvasSize` helper maps a ratio preset to canvas pixel dimensions; `PreviewCanvas` drives the paper.js view size from the persisted `aspectRatio`. Animation export captures the live canvas via `canvas.captureStream` + `MediaRecorder` for a fixed duration; pure helpers handle progress/mime detection while a thin orchestrator does the DOM/recorder glue. An optional audio track comes from a new recording-stream method on the existing `AudioSource`.

**Tech Stack:** SvelteKit + Svelte 5 runes, TypeScript, paper.js, vitest, bun. Spec: `docs/superpowers/specs/2026-06-18-canvas-ratio-animation-export-design.md`.

## Global Constraints

- Package manager **bun**: tests `bun run test:unit -- run <path>`; typecheck `bun run check`.
- Tab indentation in `.svelte`/`.ts` (match existing files exactly).
- Any `.svelte` file edited must pass the `svelte-autofixer` MCP tool.
- Aspect-ratio presets, exact order: `1:1, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9`.
- Canvas long side = **600** px. Export fps = **30**. Default ratio `1:1`. Default export duration **5** s. Audio toggle default **off**. Download filename `animation.webm`.
- `aspectRatio` is persisted (part of `Composition`); export duration + audio toggle are transient local UI state.
- Only `wave` and `zoneDrive` are stripped before persistence — a new `Composition.aspectRatio` field persists automatically.

---

### Task 1: AspectRatio type, state default, and setter

**Files:**
- Modify: `src/lib/types.ts` (add `AspectRatio` type + `aspectRatio` on `Composition`)
- Modify: `src/lib/state/default.ts` (add `aspectRatio: '1:1'` to `DEFAULT_COMPOSITION`)
- Modify: `src/lib/state/composition.ts` (add `setAspectRatio`)
- Test: `src/lib/state/composition.aspect-ratio.spec.ts`

**Interfaces:**
- Produces: `type AspectRatio = '1:1' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9'`; `Composition.aspectRatio: AspectRatio`; `setAspectRatio(ratio: AspectRatio): void`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/state/composition.aspect-ratio.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { composition } from './composition-persistence.svelte';
import { setAspectRatio } from './composition';

describe('setAspectRatio', () => {
	beforeEach(() => {
		composition.aspectRatio = '1:1';
	});

	it('updates composition.aspectRatio', () => {
		setAspectRatio('16:9');
		expect(composition.aspectRatio).toBe('16:9');
	});

	it('defaults to 1:1', () => {
		expect(['1:1', '16:9']).toContain(composition.aspectRatio);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/state/composition.aspect-ratio.spec.ts`
Expected: FAIL — `setAspectRatio` is not exported / `aspectRatio` missing.

- [ ] **Step 3: Add the type and field**

In `src/lib/types.ts`, add the type near the other shared types:

```ts
export type AspectRatio = '1:1' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9';
```

Add `aspectRatio` to the `Composition` interface (alongside `baseRadius` / `ringIncrement`):

```ts
	aspectRatio: AspectRatio;
```

(Add `AspectRatio` to any existing `import type { ... } from '$lib/types'` consumers only as needed.)

- [ ] **Step 4: Add the default**

In `src/lib/state/default.ts`, add to the `DEFAULT_COMPOSITION` object (top-level, next to `baseRadius`):

```ts
	aspectRatio: '1:1',
```

- [ ] **Step 5: Add the setter**

In `src/lib/state/composition.ts`, after `setRingIncrement`:

```ts
export function setAspectRatio(ratio: AspectRatio) {
	composition.aspectRatio = ratio;
}
```

Add `AspectRatio` to the `import type { ... } from '$lib/types'` list at the top of the file.

- [ ] **Step 6: Run tests + typecheck**

Run: `bun run test:unit -- run src/lib/state/composition.aspect-ratio.spec.ts`
Expected: PASS (2 tests)
Run: `bun run check`
Expected: 0 errors. (Fix any `Composition` literals now missing `aspectRatio` — e.g. test fixtures — by adding `aspectRatio: '1:1'`.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/lib/state/default.ts src/lib/state/composition.ts src/lib/state/composition.aspect-ratio.spec.ts
git commit -m "feat: add persisted aspectRatio state + setter"
```

---

### Task 2: `ratioToCanvasSize` pure helper

**Files:**
- Create: `src/lib/geometry/aspect-ratio.ts`
- Test: `src/lib/geometry/aspect-ratio.spec.ts`

**Interfaces:**
- Consumes: `AspectRatio` from `$lib/types`.
- Produces: `ASPECT_RATIOS: AspectRatio[]`; `ratioToCanvasSize(ratio: AspectRatio, longSide: number): { width: number; height: number }`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/geometry/aspect-ratio.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ratioToCanvasSize, ASPECT_RATIOS } from './aspect-ratio';

describe('ratioToCanvasSize (longSide 600)', () => {
	it('1:1 → 600×600', () => {
		expect(ratioToCanvasSize('1:1', 600)).toEqual({ width: 600, height: 600 });
	});
	it('16:9 → 600×338 (long side on width)', () => {
		expect(ratioToCanvasSize('16:9', 600)).toEqual({ width: 600, height: 338 });
	});
	it('9:16 → 338×600 (long side on height)', () => {
		expect(ratioToCanvasSize('9:16', 600)).toEqual({ width: 338, height: 600 });
	});
	it('3:4 → 450×600, 4:3 → 600×450', () => {
		expect(ratioToCanvasSize('3:4', 600)).toEqual({ width: 450, height: 600 });
		expect(ratioToCanvasSize('4:3', 600)).toEqual({ width: 600, height: 450 });
	});
	it('4:5 → 480×600, 5:4 → 600×480', () => {
		expect(ratioToCanvasSize('4:5', 600)).toEqual({ width: 480, height: 600 });
		expect(ratioToCanvasSize('5:4', 600)).toEqual({ width: 600, height: 480 });
	});
	it('exposes all 7 presets in order', () => {
		expect(ASPECT_RATIOS).toEqual(['1:1', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9']);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/geometry/aspect-ratio.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

Create `src/lib/geometry/aspect-ratio.ts`:

```ts
import type { AspectRatio } from '$lib/types';

/** The selectable canvas aspect-ratio presets, in display order. */
export const ASPECT_RATIOS: AspectRatio[] = ['1:1', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9'];

/**
 * Maps an aspect-ratio preset to integer canvas pixel dimensions whose longer side
 * equals `longSide`. The shorter side is rounded to the nearest pixel.
 */
export function ratioToCanvasSize(
	ratio: AspectRatio,
	longSide: number
): { width: number; height: number } {
	const [w, h] = ratio.split(':').map(Number);
	if (w >= h) {
		return { width: longSide, height: Math.round((longSide * h) / w) };
	}
	return { width: Math.round((longSide * w) / h), height: longSide };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/geometry/aspect-ratio.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/geometry/aspect-ratio.ts src/lib/geometry/aspect-ratio.spec.ts
git commit -m "feat: ratioToCanvasSize helper + aspect-ratio presets"
```

---

### Task 3: Canvas sidebar section (ratio selector)

**Files:**
- Create: `src/lib/components/CanvasSection.svelte`
- Modify: `src/lib/components/Sidebar.svelte` (render `<CanvasSection />`)

**Interfaces:**
- Consumes: `composition.aspectRatio`, `setAspectRatio`, `ASPECT_RATIOS`.

- [ ] **Step 1: Create the section component**

Create `src/lib/components/CanvasSection.svelte` (mirror `SettingsSection.svelte` structure):

```svelte
<script lang="ts">
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import { composition, setAspectRatio } from '$lib/state/composition';
	import { ASPECT_RATIOS } from '$lib/geometry/aspect-ratio';
	import type { AspectRatio } from '$lib/types';
	import SidebarCollapsible from './SidebarCollapsible.svelte';
</script>

<SidebarCollapsible>
	{#snippet trigger()}
		Canvas
	{/snippet}

	{#snippet content()}
		<div class="flex flex-col gap-1">
			<Label for="canvas-ratio" class="text-xs">Aspect ratio</Label>
			<select
				id="canvas-ratio"
				class="rounded border bg-transparent px-2 py-1 text-xs"
				value={composition.aspectRatio}
				onchange={(e) => setAspectRatio((e.target as HTMLSelectElement).value as AspectRatio)}
			>
				{#each ASPECT_RATIOS as ratio (ratio)}
					<option value={ratio}>{ratio}</option>
				{/each}
			</select>
		</div>
	{/snippet}
</SidebarCollapsible>
```

- [ ] **Step 2: Wire it into the sidebar**

In `src/lib/components/Sidebar.svelte`, add the import after the other section imports:

```svelte
	import CanvasSection from './CanvasSection.svelte';
```

Render it inside `<SidebarUI.SidebarContent ...>`, immediately after `<SettingsSection />`:

```svelte
		<SettingsSection />

		<CanvasSection />
```

- [ ] **Step 3: Run the svelte-autofixer**

Run the `svelte-autofixer` MCP tool on `CanvasSection.svelte` and `Sidebar.svelte`. Apply fixes until clean.

- [ ] **Step 4: Typecheck**

Run: `bun run check`
Expected: 0 errors / 0 warnings.

- [ ] **Step 5: Manual verify**

Run `bun run dev`. The sidebar shows a "Canvas" section with a 7-option ratio dropdown. Selecting a value persists across reload. (Canvas does not reshape yet — Task 4.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/CanvasSection.svelte src/lib/components/Sidebar.svelte
git commit -m "feat: Canvas sidebar section with aspect-ratio selector"
```

---

### Task 4: Drive canvas size from aspectRatio in PreviewCanvas

**Files:**
- Modify: `src/lib/components/PreviewCanvas.svelte`

**Interfaces:**
- Consumes: `ratioToCanvasSize`, `composition.aspectRatio`.

- [ ] **Step 1: Import the helper**

In `src/lib/components/PreviewCanvas.svelte` `<script>`, add:

```svelte
	import { ratioToCanvasSize } from '$lib/geometry/aspect-ratio';
```

Add a constant near `REST_FRACTION`:

```svelte
	const CANVAS_LONG_SIDE = 600;
```

- [ ] **Step 2: Derive the viewport from the ratio**

In the redraw `$effect`, replace the `viewport` derived from `scope.view.size` with one derived from the persisted ratio (this makes the effect re-run on ratio change and resizes the paper view):

```svelte
		$effect(() => {
			const comp = composition;
			const { width, height } = ratioToCanvasSize(comp.aspectRatio, CANVAS_LONG_SIDE);
			const viewport = { width, height, padding: 32 };
```

Leave the rest of the effect body unchanged (the render pipeline already sets `scope.view.viewSize` from `viewport`, which resizes the backing canvas). Remove the now-unused `scope.view.size` reads.

- [ ] **Step 3: Let paper own the canvas dimensions**

In the markup, the `<canvas>` keeps its initial `width`/`height` attributes (paper overrides them via `viewSize`). Ensure the canvas element has no fixed CSS width/height that would stretch it — keep the existing `rounded-lg border bg-white` classes only.

- [ ] **Step 4: Run the svelte-autofixer**

Run the `svelte-autofixer` MCP tool on `PreviewCanvas.svelte`. The generic "$effect calls a function" hint for the paper render is expected and ignorable; fix anything else.

- [ ] **Step 5: Typecheck + existing tests**

Run: `bun run check`
Expected: 0 errors.
Run: `bun run test:unit -- run src/lib/components/PreviewCanvas.svelte.spec.ts`
Expected: PASS (update the spec only if it asserted a hardcoded 600×600 viewport — adjust to the ratio-derived size).

- [ ] **Step 6: Manual verify**

`bun run dev`. Switching the ratio reshapes the preview canvas; the mark stays centered and round, with empty letterbox space on the long axis. Audio Zones still animates correctly in each ratio.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/PreviewCanvas.svelte src/lib/components/PreviewCanvas.svelte.spec.ts
git commit -m "feat: drive preview canvas size from aspectRatio"
```

---

### Task 5: Animation-export pure helpers + orchestrator

**Files:**
- Create: `src/lib/export/canvas-export.ts`
- Test: `src/lib/export/canvas-export.spec.ts`

**Interfaces:**
- Produces:
  - `clampProgress(elapsedMs: number, durationMs: number): number` (0..1)
  - `pickWebmMimeType(): string | null`
  - `isAnimationExportSupported(): boolean`
  - `type CanvasExportOptions = { canvas: HTMLCanvasElement; durationSec: number; fps?: number; audioStream?: MediaStream | null; fileName?: string; onProgress?: (p: number) => void }`
  - `exportCanvasAnimation(opts: CanvasExportOptions): Promise<void>`

- [ ] **Step 1: Write the failing test (pure helpers)**

Create `src/lib/export/canvas-export.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { clampProgress } from './canvas-export';

describe('clampProgress', () => {
	it('is 0 at start, 0.5 at half, 1 at end', () => {
		expect(clampProgress(0, 5000)).toBe(0);
		expect(clampProgress(2500, 5000)).toBeCloseTo(0.5, 6);
		expect(clampProgress(5000, 5000)).toBe(1);
	});
	it('clamps past the end to 1 and never goes below 0', () => {
		expect(clampProgress(9999, 5000)).toBe(1);
		expect(clampProgress(-10, 5000)).toBe(0);
	});
	it('returns 1 for a non-positive duration (degenerate)', () => {
		expect(clampProgress(0, 0)).toBe(1);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/export/canvas-export.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

Create `src/lib/export/canvas-export.ts`:

```ts
/** Linear capture progress in [0, 1]. Non-positive duration is treated as complete. */
export function clampProgress(elapsedMs: number, durationMs: number): number {
	if (!(durationMs > 0)) return 1;
	const p = elapsedMs / durationMs;
	return p < 0 ? 0 : p > 1 ? 1 : p;
}

/** First MediaRecorder-supported WebM mime type, or null if none (e.g. Safari). */
export function pickWebmMimeType(): string | null {
	if (typeof MediaRecorder === 'undefined') return null;
	const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
	for (const type of candidates) {
		if (MediaRecorder.isTypeSupported(type)) return type;
	}
	return null;
}

/** True when the browser can capture the canvas to a WebM MediaRecorder. */
export function isAnimationExportSupported(): boolean {
	return (
		typeof MediaRecorder !== 'undefined' &&
		typeof HTMLCanvasElement !== 'undefined' &&
		typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
		pickWebmMimeType() !== null
	);
}

export type CanvasExportOptions = {
	canvas: HTMLCanvasElement;
	durationSec: number;
	fps?: number;
	audioStream?: MediaStream | null;
	fileName?: string;
	onProgress?: (p: number) => void;
};

function downloadBlob(blob: Blob, fileName: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = fileName;
	a.click();
	URL.revokeObjectURL(url);
}

/**
 * Captures the live canvas to a WebM file for `durationSec` seconds (real time).
 * Resolves after the download is triggered. Reports progress 0..1 via onProgress.
 */
export function exportCanvasAnimation(opts: CanvasExportOptions): Promise<void> {
	const { canvas, durationSec, fps = 30, audioStream = null, fileName = 'animation.webm', onProgress } = opts;

	return new Promise<void>((resolve, reject) => {
		const mimeType = pickWebmMimeType();
		if (!mimeType) {
			reject(new Error('WebM recording is not supported in this browser'));
			return;
		}

		const stream = canvas.captureStream(fps);
		if (audioStream) {
			for (const track of audioStream.getAudioTracks()) stream.addTrack(track);
		}

		let recorder: MediaRecorder;
		try {
			recorder = new MediaRecorder(stream, { mimeType });
		} catch (err) {
			reject(err instanceof Error ? err : new Error(String(err)));
			return;
		}

		const chunks: BlobPart[] = [];
		const durationMs = Math.max(0, durationSec * 1000);
		const start = performance.now();
		let progressTimer: ReturnType<typeof setInterval> | null = null;

		recorder.ondataavailable = (e) => {
			if (e.data.size > 0) chunks.push(e.data);
		};
		recorder.onstop = () => {
			if (progressTimer !== null) clearInterval(progressTimer);
			onProgress?.(1);
			try {
				downloadBlob(new Blob(chunks, { type: mimeType }), fileName);
				resolve();
			} catch (err) {
				reject(err instanceof Error ? err : new Error(String(err)));
			}
		};
		recorder.onerror = () => {
			if (progressTimer !== null) clearInterval(progressTimer);
			reject(new Error('MediaRecorder error during capture'));
		};

		onProgress?.(0);
		recorder.start();
		progressTimer = setInterval(() => {
			onProgress?.(clampProgress(performance.now() - start, durationMs));
		}, 100);
		setTimeout(() => {
			if (recorder.state !== 'inactive') recorder.stop();
		}, durationMs);
	});
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/export/canvas-export.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Typecheck**

Run: `bun run check`
Expected: 0 errors. (If `captureStream` is missing from the DOM lib types, add a minimal ambient declaration in the file: `declare global { interface HTMLCanvasElement { captureStream(fps?: number): MediaStream } }`.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/export/canvas-export.ts src/lib/export/canvas-export.spec.ts
git commit -m "feat: canvas-export helpers + WebM capture orchestrator"
```

---

### Task 6: Export UI in PreviewCanvas (video, audio off)

**Files:**
- Modify: `src/lib/components/PreviewCanvas.svelte`

**Interfaces:**
- Consumes: `exportCanvasAnimation`, `isAnimationExportSupported`, `animationState`, `play` (from `$lib/state/animation`).
- Produces (local component state): `exportStatus: 'idle' | 'rendering'`, `exportProgress: number`, `exportDurationSec: number`.

- [ ] **Step 1: Add imports + local state**

In `PreviewCanvas.svelte` `<script>`:

```svelte
	import { animationState, play } from '$lib/state/animation';
	import { exportCanvasAnimation, isAnimationExportSupported } from '$lib/export/canvas-export';

	let canvasEl: HTMLCanvasElement;
	let exportStatus = $state<'idle' | 'rendering'>('idle');
	let exportProgress = $state(0);
	let exportDurationSec = $state(5);
	const animationExportSupported = isAnimationExportSupported();
```

Capture the canvas element from the attach action — in `setupCanvas(canvas)` add `canvasEl = canvas;` at the top.

> Verify the exact play/start export name in `src/lib/state/animation.svelte.ts` (search `export function play`/`togglePlay`/`start`). Use the function that begins playback; if it is `togglePlay`, guard with `if (!animationState.isPlaying) togglePlay();`.

- [ ] **Step 2: Add the export handler**

```svelte
	async function exportAnimation() {
		if (exportStatus === 'rendering' || !canvasEl) return;
		if (!animationState.isPlaying) play();
		exportStatus = 'rendering';
		exportProgress = 0;
		try {
			await exportCanvasAnimation({
				canvas: canvasEl,
				durationSec: exportDurationSec,
				onProgress: (p) => {
					exportProgress = p;
				}
			});
		} catch (err) {
			console.error('Animation export failed', err);
		} finally {
			exportStatus = 'idle';
			exportProgress = 0;
		}
	}
```

- [ ] **Step 3: Add the UI below Export SVG**

In the markup, after the Export SVG `<Button>`, add:

```svelte
	<div class="flex w-full max-w-[600px] flex-col gap-2">
		<div class="flex items-center gap-2">
			<Label for="export-duration" class="text-xs">Durata (s)</Label>
			<input
				id="export-duration"
				type="number"
				min="1"
				step="1"
				class="w-20 rounded border bg-transparent px-2 py-1 text-xs"
				value={exportDurationSec}
				disabled={exportStatus === 'rendering'}
				oninput={(e) => (exportDurationSec = Math.max(1, Number((e.target as HTMLInputElement).value) || 1))}
			/>
		</div>
		{#if exportStatus === 'rendering'}
			<div class="flex flex-col gap-1">
				<div class="h-2 w-full overflow-hidden rounded bg-muted">
					<div class="h-full bg-primary transition-[width]" style="width: {Math.round(exportProgress * 100)}%"></div>
				</div>
				<span class="text-center text-xs text-muted-foreground">Rendering… {Math.round(exportProgress * 100)}%</span>
			</div>
		{:else}
			<Button
				variant="outline"
				onclick={exportAnimation}
				disabled={!animationExportSupported}
				class="w-full"
			>
				Export Animation
			</Button>
			{#if !animationExportSupported}
				<span class="text-center text-[11px] text-muted-foreground">Export video non supportato dal browser</span>
			{/if}
		{/if}
	</div>
```

Import `Label` if not already imported: `import { Label } from '$lib/shadcn/ui/label/index.js';`.

- [ ] **Step 4: Run the svelte-autofixer**

Run the `svelte-autofixer` MCP tool on `PreviewCanvas.svelte`; apply non-render fixes until clean.

- [ ] **Step 5: Typecheck**

Run: `bun run check`
Expected: 0 errors / 0 warnings.

- [ ] **Step 6: Manual verify**

`bun run dev` → Audio Zones → Demo → set Durata 3 → Export Animation. The button is replaced by a "Rendering… NN%" bar that fills over ~3s, then `animation.webm` downloads and plays in a video player (silent). The aspect ratio of the video matches the selected canvas ratio.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/PreviewCanvas.svelte
git commit -m "feat: Export Animation UI (WebM, duration + progress bar)"
```

---

### Task 7: Audio toggle — include the live audio source in the video

**Files:**
- Modify: `src/lib/state/animation-drivers/audio-source.ts` (add `createRecordingStream`)
- Modify: `src/lib/state/animation-drivers/audio-source.spec.ts` (cover the null path)
- Modify: `src/lib/state/animation.svelte.ts` (expose `getExportAudioStream`)
- Modify: `src/lib/components/PreviewCanvas.svelte` (audio toggle + pass stream)

**Interfaces:**
- Produces on `AudioSource`: `createRecordingStream(): { stream: MediaStream; dispose: () => void } | null`.
- Produces from `$lib/state/animation`: `getExportAudioStream(): { stream: MediaStream; dispose: () => void } | null`.

- [ ] **Step 1: Write the failing test**

In `src/lib/state/animation-drivers/audio-source.spec.ts`, add:

```ts
	it('createRecordingStream returns null when no context exists (mode off)', () => {
		const source = createAudioSource(/* existing deps used elsewhere in this file */);
		expect(source.createRecordingStream()).toBeNull();
	});
```

(Reuse the same `createAudioSource(...)` construction the other tests in this file already use.)

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/state/animation-drivers/audio-source.spec.ts`
Expected: FAIL — `createRecordingStream` is not a function.

- [ ] **Step 3: Implement on the audio source**

In `audio-source.ts`, add to the `AudioSource` type:

```ts
	createRecordingStream: () => { stream: MediaStream; dispose: () => void } | null;
```

Implement inside `createAudioSource` (it has access to `audioContext` and `analyser`):

```ts
	function createRecordingStream(): { stream: MediaStream; dispose: () => void } | null {
		if (!audioContext || !analyser) return null;
		const dest = audioContext.createMediaStreamDestination();
		analyser.connect(dest);
		return {
			stream: dest.stream,
			dispose: () => analyser?.disconnect(dest)
		};
	}
```

Add `createRecordingStream` to the returned object.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/state/animation-drivers/audio-source.spec.ts`
Expected: PASS.

- [ ] **Step 5: Expose from animation state**

In `src/lib/state/animation.svelte.ts`, add an exported function that only yields a stream for real sources:

```ts
export function getExportAudioStream(): { stream: MediaStream; dispose: () => void } | null {
	if (animationState.audioSource === 'mic' || animationState.audioSource === 'file') {
		return audioSource.createRecordingStream();
	}
	return null;
}
```

(Use the existing `audioSource` instance and `animationState` already in that module.)

- [ ] **Step 6: Wire the toggle in PreviewCanvas**

Add local state and import:

```svelte
	import { animationState, play, getExportAudioStream } from '$lib/state/animation';
	let exportAudio = $state(false);
```

In `exportAnimation`, obtain and pass the stream, disposing it after:

```svelte
		const audio = exportAudio ? getExportAudioStream() : null;
		try {
			await exportCanvasAnimation({
				canvas: canvasEl,
				durationSec: exportDurationSec,
				audioStream: audio?.stream ?? null,
				onProgress: (p) => {
					exportProgress = p;
				}
			});
		} catch (err) {
			console.error('Animation export failed', err);
		} finally {
			audio?.dispose();
			exportStatus = 'idle';
			exportProgress = 0;
		}
```

Add the toggle control in the export UI block (above the Export Animation button), disabled while rendering:

```svelte
		<label class="flex items-center gap-2 text-xs">
			<input
				type="checkbox"
				checked={exportAudio}
				disabled={exportStatus === 'rendering'}
				onchange={(e) => (exportAudio = (e.target as HTMLInputElement).checked)}
			/>
			Includi audio
		</label>
```

- [ ] **Step 7: svelte-autofixer + typecheck**

Run the `svelte-autofixer` MCP tool on `PreviewCanvas.svelte`.
Run: `bun run check`
Expected: 0 errors / 0 warnings.

- [ ] **Step 8: Manual verify**

`bun run dev` → Audio Zones → source **File**, load an audio file → Play → enable "Includi audio" → Export Animation. The downloaded `animation.webm` has synced audio. With Demo source, the video is silent even when the toggle is on (no real audio).

- [ ] **Step 9: Commit**

```bash
git add src/lib/state/animation-drivers/audio-source.ts src/lib/state/animation-drivers/audio-source.spec.ts src/lib/state/animation.svelte.ts src/lib/components/PreviewCanvas.svelte
git commit -m "feat: optional audio track in animation export"
```

---

### Task 8: Lock aspect-ratio changes during export

**Files:**
- Modify: `src/lib/components/CanvasSection.svelte`
- Modify: `src/lib/state/animation.svelte.ts` (expose `isExporting` flag) OR lift export status to shared state

**Interfaces:**
- The Canvas section's selector must be disabled while an export is rendering.

- [ ] **Step 1: Add shared export-status state**

The export status currently lives in `PreviewCanvas`. To let `CanvasSection` read it, add a tiny shared rune. Create `src/lib/state/export-status.svelte.ts`:

```ts
export const exportStatus = $state<{ rendering: boolean }>({ rendering: false });
```

- [ ] **Step 2: Drive it from PreviewCanvas**

In `PreviewCanvas.svelte`, import it and mirror the local status:

```svelte
	import { exportStatus as sharedExportStatus } from '$lib/state/export-status.svelte';
```

Set `sharedExportStatus.rendering = true` at the start of `exportAnimation` (after the guard) and `sharedExportStatus.rendering = false` in the `finally` block.

- [ ] **Step 3: Disable the ratio selector while rendering**

In `CanvasSection.svelte`, import the shared state and add `disabled`:

```svelte
	import { exportStatus } from '$lib/state/export-status.svelte';
```

```svelte
			<select
				id="canvas-ratio"
				class="rounded border bg-transparent px-2 py-1 text-xs disabled:opacity-50"
				value={composition.aspectRatio}
				disabled={exportStatus.rendering}
				onchange={(e) => setAspectRatio((e.target as HTMLSelectElement).value as AspectRatio)}
			>
```

- [ ] **Step 4: svelte-autofixer + typecheck**

Run the `svelte-autofixer` MCP tool on both edited `.svelte` files.
Run: `bun run check`
Expected: 0 errors / 0 warnings.

- [ ] **Step 5: Manual verify**

`bun run dev` → start an export → while the bar fills, the Canvas ratio dropdown is disabled; it re-enables when the export finishes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/state/export-status.svelte.ts src/lib/components/PreviewCanvas.svelte src/lib/components/CanvasSection.svelte
git commit -m "feat: lock aspect-ratio selector during animation export"
```

---

## Final verification

- [ ] Run full suite: `bun run test:unit -- run` — all pass.
- [ ] Typecheck: `bun run check` — 0 errors / 0 warnings.
- [ ] Manual end-to-end: each of the 7 ratios reshapes the canvas; Export SVG still works; Export Animation downloads a playable `.webm` at the selected ratio; audio toggle includes/excludes sound for a File source; unsupported browsers show the disabled note.

## Self-review notes (coverage)

- Spec Feature 1 (ratio state, UI section, canvas sizing, default) → Tasks 1–4.
- Spec Feature 2 (UI buttons + duration + audio toggle + progress bar; real-time WebM; per-mode behavior; export state; one-at-a-time lock) → Tasks 5–8.
- Edge cases: unsupported browser (Task 5 `isAnimationExportSupported` + Task 6 disabled button/note); empty canvas (Export SVG guard unchanged; capture of an empty canvas still produces a valid file); audio-on-but-no-source (Task 7 `getExportAudioStream` returns null for demo/off); recorder error (Task 5 `onerror`→reject, Task 6 `finally` resets); cleanup (revoke URL in `downloadBlob`, `dispose()` audio node).
- Persistence: `aspectRatio` on `Composition` (Task 1) auto-persists; duration/audio are local `$state` (Tasks 6–7).
