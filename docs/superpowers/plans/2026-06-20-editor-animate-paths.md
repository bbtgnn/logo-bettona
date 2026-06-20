# Editor / Animate / Paths Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **NOTE for this repo:** subagents in this environment CANNOT write files (Edit/Write/Bash-write are denied). Implement **inline** (orchestrator writes; use read-only subagents only for review/exploration).

**Goal:** Unify the colour model, add animation (video) export with progress, rebuild the timeline transport, and align the Paths nav — five scoped changes across the three workspace pages.

**Architecture:** Svelte 5 runes app. Colour roles split into `{primary, secondary, background}`; the kaleidoscope background stops being a separate field and reads the palette background. The existing unwired WebM engine (`canvas-export.ts`) is connected to a new button with a progress bar. Playback transport (play/stop/duration/fps) moves from the sidebar into the bottom timeline panel. Paths gets a left indent and a library-kind dropdown (Anim Library is a placeholder).

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, paper.js, vitest + vitest-browser-svelte, tailwindcss, bun.

## Global Constraints

- Package manager: **bun**. Unit tests: `bun run test:unit -- run <path>`. Full suite: `bun run test:unit -- run`. Types: `bun run check`.
- Every changed `.svelte` / `.svelte.ts` MUST pass the **svelte-autofixer** MCP tool (`issues: []`) before commit. Ignore the known false-positive *suggestions* (`bind:this`→attachment; "function/stateful-var called inside `$effect`").
- **Tab** indentation everywhere.
- Tailwind is not loaded in the vitest DOM → assert structure / `data-testid` / ARIA, never computed layout.
- Commit trailer on every commit: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Allowed fps set: `{25, 30, 50, 60}`, default `30`.

---

## File Structure

- `src/lib/types.ts` — `MonochromePalette` shape change.
- `src/lib/state/default.ts` — default palette values.
- `src/lib/color/apply.ts` — monochrome alternation over primary/secondary.
- `src/lib/state/composition.ts` — background getter + palette factory.
- `src/lib/state/composition-persistence.svelte.ts` — migrate old `{main,bg}` blobs.
- `src/lib/components/MonochromePaletteEditor.svelte` — three colour inputs.
- `src/lib/state/kaleidoscope.svelte.ts` — drop `backgroundColor` field + setter.
- `src/lib/components/preview-presenter.svelte.ts` — feed palette bg to render; add `exportAnimation`.
- `src/lib/components/KaleidoscopeSection.svelte` — remove the bg picker.
- `src/lib/components/PreviewCanvas.svelte` — Export animation button + progress.
- `src/lib/state/animation.svelte.ts` — `fps` field + `setAnimationFps`.
- `src/lib/components/TimelineRuler.svelte` — per-second ticks.
- `src/lib/components/TimelinePanel.svelte` — transport bar, equal height, spacebar.
- `src/lib/components/AnimationSection.svelte` — remove transport block.
- `src/lib/shadcn/ui/sidebar/constants.ts` — sidebar width 18rem.
- `src/routes/paths/+page.svelte` — header indent + library-kind dropdown.

---

## Task 1: Colour model — primary / secondary / background

**Files:**
- Modify: `src/lib/types.ts` (MonochromePalette)
- Modify: `src/lib/state/default.ts:96-101`
- Modify: `src/lib/color/apply.ts:11-19,46-51`
- Modify: `src/lib/state/composition.ts:83-89,250-253`
- Modify: `src/lib/components/MonochromePaletteEditor.svelte`
- Test: `src/lib/color/apply.spec.ts`

**Interfaces:**
- Produces: `type MonochromePalette = { primary: string; secondary: string; background: string }`; `applyMonochrome(palette, ringCount)` alternates primary(outermost)/secondary; `getCompositionBackgroundColor(): string` returns the active palette `background`.

This task is type-coupled: the shape change touches every consumer, so all edits land together and `bun run check` stays green at the end.

- [ ] **Step 1: Update the failing tests in `apply.spec.ts`**

Replace the `applyMonochrome` describe block to use the new shape and roles:

```ts
describe('applyMonochrome', () => {
	it('outermost ring (last index) gets primary color', () => {
		const result = applyMonochrome({ primary: '#000000', secondary: '#ffffff', background: '#eeeeee' }, 4);
		expect(result[3]).toBe('#000000');
	});

	it('alternates primary/secondary strictly inward from outermost', () => {
		const result = applyMonochrome({ primary: '#000000', secondary: '#ffffff', background: '#eeeeee' }, 4);
		// index 3 = primary, 2 = secondary, 1 = primary, 0 = secondary
		expect(result).toEqual(['#ffffff', '#000000', '#ffffff', '#000000']);
	});

	it('never uses background as a ring color', () => {
		const result = applyMonochrome({ primary: '#111111', secondary: '#222222', background: '#eeeeee' }, 5);
		expect(result).not.toContain('#eeeeee');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test:unit -- run src/lib/color/apply.spec.ts`
Expected: FAIL (type error / `#eeeeee` assertions).

- [ ] **Step 3: Change the type**

`src/lib/types.ts` — replace the MonochromePalette type:

```ts
export type MonochromePalette = {
	primary: string;
	secondary: string;
	background: string;
};
```

- [ ] **Step 4: Update `applyMonochrome` and its default**

`src/lib/color/apply.ts` — replace `applyMonochrome` body and the monochrome branch fallback:

```ts
export function applyMonochrome(palette: MonochromePalette, ringCount: number): string[] {
	const result: string[] = new Array(ringCount);
	for (let i = 0; i < ringCount; i++) {
		// outermost = last index = primary; alternate inward to secondary
		const distFromOuter = ringCount - 1 - i;
		result[i] = distFromOuter % 2 === 0 ? palette.primary : palette.secondary;
	}
	return result;
}
```

In `applyColors`, update the monochrome fallback:

```ts
		case 'monochrome':
			return applyMonochrome(
				monochromePalette ?? { primary: '#000000', secondary: '#ffffff', background: '#ffffff' },
				ringCount
			);
```

- [ ] **Step 5: Update the default palette**

`src/lib/state/default.ts` (around line 96-101) — replace the monochrome palette entry:

```ts
			primary: '#000000',
			secondary: '#ffffff',
			background: '#ffffff'
```

(Match the surrounding object/array shape; this is the single default monochrome palette.)

- [ ] **Step 6: Update composition helpers**

`src/lib/state/composition.ts` — `addMonochromePalette` default param and `getCompositionBackgroundColor`:

```ts
export function addMonochromePalette(
	palette: MonochromePalette = { primary: '#000000', secondary: '#ffffff', background: '#ffffff' }
) {
```

```ts
export function getCompositionBackgroundColor(): string {
	const mono = composition.monochromePalettes[colorMode.palette];
	return mono?.background ?? '#ffffff';
}
```

- [ ] **Step 7: Update `MonochromePaletteEditor.svelte`**

Replace the two swatches with three, and the two colour inputs with three (Primary / Secondary / Background). Swatch row:

```svelte
			<div class="flex gap-1 flex-1">
				<div class="h-5 w-5 rounded-sm border border-border flex-shrink-0" style="background-color: {palette.primary}" title="Primary"></div>
				<div class="h-5 w-5 rounded-sm border border-border flex-shrink-0" style="background-color: {palette.secondary}" title="Secondary"></div>
				<div class="h-5 w-5 rounded-sm border border-border flex-shrink-0" style="background-color: {palette.background}" title="Background"></div>
			</div>
```

Editor inputs (replace the `flex gap-3` block):

```svelte
			<div class="flex gap-3">
				<div class="flex flex-col gap-1">
					<Label class="text-xs">Primary</Label>
					<input type="color" value={active.primary}
						oninput={(e) => updateMonochromePalette(colorMode.palette, { primary: (e.target as HTMLInputElement).value })}
						class="h-8 w-8 cursor-pointer rounded border border-input bg-transparent p-0.5" />
				</div>
				<div class="flex flex-col gap-1">
					<Label class="text-xs">Secondary</Label>
					<input type="color" value={active.secondary}
						oninput={(e) => updateMonochromePalette(colorMode.palette, { secondary: (e.target as HTMLInputElement).value })}
						class="h-8 w-8 cursor-pointer rounded border border-input bg-transparent p-0.5" />
				</div>
				<div class="flex flex-col gap-1">
					<Label class="text-xs">Background</Label>
					<input type="color" value={active.background}
						oninput={(e) => updateMonochromePalette(colorMode.palette, { background: (e.target as HTMLInputElement).value })}
						class="h-8 w-8 cursor-pointer rounded border border-input bg-transparent p-0.5" />
				</div>
			</div>
```

- [ ] **Step 8: Find and fix any remaining `.main` / `.bg` references**

Run: `grep -rn "\.main\b\|\.bg\b\|{ main\|main:\|bg:" src/lib src/routes --include=*.ts --include=*.svelte | grep -i mono`
Also broaden: `grep -rn "main:\s*'#\|bg:\s*'#" src`
Update every monochrome-palette literal/access (notably in existing specs such as `composition.svelte.spec.ts`, `kaleidoscope.svelte.spec.ts`, `composition.aspect-ratio.spec.ts`) to the new shape.

- [ ] **Step 9: Run autofixer on the edited Svelte file**

Use the svelte-autofixer MCP tool on `MonochromePaletteEditor.svelte`. Resolve until `issues: []`.

- [ ] **Step 10: Verify types + tests green**

Run: `bun run check`
Expected: 0 errors.
Run: `bun run test:unit -- run src/lib/color/apply.spec.ts`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "refactor(color): split monochrome palette into primary/secondary/background

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Persist-layer migration of old `{main,bg}` palettes

**Files:**
- Modify: `src/lib/state/composition-persistence.svelte.ts`
- Test: `src/lib/state/composition-persistence.svelte.spec.ts`

**Interfaces:**
- Consumes: `MonochromePalette` (Task 1).
- Produces: `normalizeComposition(c: Composition): Composition` — idempotent; maps any monochrome palette still in `{main,bg}` shape to `{primary: main, secondary: bg, background: bg}`.

Old localStorage blobs predate the shape change; without migration a reload yields palettes with `undefined` primary/secondary/background. Mapping `secondary` and `background` both to the old `bg` preserves the previous look exactly (rings still alternate the same two colours; canvas bg unchanged).

- [ ] **Step 1: Write the failing test**

Add to `composition-persistence.svelte.spec.ts` (create if absent, mirroring the existing spec imports):

```ts
import { describe, it, expect } from 'vitest';
import { normalizeComposition } from './composition-persistence.svelte';
import { DEFAULT_COMPOSITION } from './default';

describe('normalizeComposition', () => {
	it('migrates a legacy {main,bg} palette to primary/secondary/background', () => {
		const legacy = {
			...DEFAULT_COMPOSITION,
			monochromePalettes: [{ main: '#123456', bg: '#abcdef' }]
		} as unknown as Parameters<typeof normalizeComposition>[0];
		const out = normalizeComposition(legacy);
		expect(out.monochromePalettes[0]).toEqual({
			primary: '#123456',
			secondary: '#abcdef',
			background: '#abcdef'
		});
	});

	it('leaves already-migrated palettes unchanged (idempotent)', () => {
		const out = normalizeComposition(DEFAULT_COMPOSITION);
		expect(out.monochromePalettes[0]).toEqual(DEFAULT_COMPOSITION.monochromePalettes[0]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/state/composition-persistence.svelte.spec.ts`
Expected: FAIL ("normalizeComposition is not a function").

- [ ] **Step 3: Implement `normalizeComposition` and apply it on read**

In `composition-persistence.svelte.ts`, add (above `createPersistedComposition`):

```ts
type LegacyMono = { main?: string; bg?: string };

/**
 * Migrates persisted monochrome palettes from the legacy `{main,bg}` shape to
 * `{primary,secondary,background}`. Idempotent: already-migrated entries pass through.
 */
export function normalizeComposition(c: Composition): Composition {
	const palettes = c.monochromePalettes?.map((p) => {
		const legacy = p as LegacyMono;
		if (legacy.main !== undefined || legacy.bg !== undefined) {
			const primary = legacy.main ?? '#000000';
			const bg = legacy.bg ?? '#ffffff';
			return { primary, secondary: bg, background: bg };
		}
		return p;
	});
	return palettes ? { ...c, monochromePalettes: palettes } : c;
}
```

Wrap both reads. Replace `if (saved) Object.assign(state, saved);` with:

```ts
				if (saved) Object.assign(state, normalizeComposition(saved));
```

And in the `subscribe` callback replace `Object.assign(state, remote);` with:

```ts
						Object.assign(state, normalizeComposition(remote));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/state/composition-persistence.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 5: Autofixer + types**

Run svelte-autofixer on `composition-persistence.svelte.ts` until `issues: []`.
Run: `bun run check` → 0 errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(color): migrate legacy {main,bg} palettes on load

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Kaleidoscope background reads the palette

**Files:**
- Modify: `src/lib/state/kaleidoscope.svelte.ts:10-31,66-72`
- Modify: `src/lib/components/preview-presenter.svelte.ts:2-7,64-94`
- Modify: `src/lib/components/KaleidoscopeSection.svelte:6-14,71-92`
- Test: `src/lib/geometry/kaleidoscope.spec.ts`, `src/lib/components/KaleidoscopeSection.svelte.spec.ts`

**Interfaces:**
- Consumes: `getCompositionBackgroundColor()` (Task 1).
- Produces: kaleidoscope render params no longer carry a stored `backgroundColor`; the presenter supplies `backgroundColor: getCompositionBackgroundColor()` at every render/export call.

Removes the manual "Sfondo caleidoscopio" picker and the `kaleidoscope.backgroundColor` field; the carpet background now uses the same palette background as the tile background, ending the dual-source split.

- [ ] **Step 1: Update specs first**

In `kaleidoscope.svelte.spec.ts` remove any assertions on `kaleidoscope.backgroundColor` / `setKaleidoscopeBackgroundColor`. In `KaleidoscopeSection.svelte.spec.ts` remove tests targeting `getByLabelText('Sfondo caleidoscopio')` (the colour input). Keep the "Sfondo tessera" checkbox test.

- [ ] **Step 2: Run to verify failures appear where expected**

Run: `bun run test:unit -- run src/lib/components/KaleidoscopeSection.svelte.spec.ts`
Expected: the removed-control tests no longer reference a missing label.

- [ ] **Step 3: Drop the field + setter from state**

`src/lib/state/kaleidoscope.svelte.ts` — remove `backgroundColor: '#ffffff',` from the `$state` object and delete `setKaleidoscopeBackgroundColor`. Keep `tileBackground`, the `drawBackground` getter, and `requestTileRefresh`.

`src/lib/geometry/kaleidoscope.ts` keeps `backgroundColor: string` in `KaleidoscopeParams` — it stays a render input, now supplied by callers.

- [ ] **Step 4: Feed palette background in the presenter**

`src/lib/components/preview-presenter.svelte.ts` — add a helper and use it everywhere kaleidoscope params are passed to render/export. After the imports, inside `createPreviewPresenter`, add:

```ts
	// Kaleidoscope render params with the carpet background sourced from the palette
	// (no longer a stored kaleidoscope field).
	function kaleidoParams() {
		return { ...kaleidoscope, backgroundColor: getCompositionBackgroundColor() };
	}
```

In `drawKaleidoscope`, change the render call to use it:

```ts
		renderKaleidoscopeToCanvas(ctx, tile, tile.width, tile.height, kaleidoParams(), {
			width: canvasEl.width,
			height: canvasEl.height
		});
```

In `exportKaleidoscopeSvg`, change the SVG generation:

```ts
		downloadSvg(generateKaleidoscopeSVG(tileSvg, kaleidoParams(), frame), 'kaleidoscope.svg');
```

- [ ] **Step 5: Remove the picker from `KaleidoscopeSection.svelte`**

Delete the import of `setKaleidoscopeBackgroundColor` and the whole `{#if !kaleidoscope.tileBackground}` block (the `Label for="k-bg"` + colour input). Remove the now-unused `Label` import if nothing else uses it (check first). Keep the "Sfondo tessera" checkbox.

- [ ] **Step 6: Autofixer**

Run svelte-autofixer on `preview-presenter.svelte.ts` and `KaleidoscopeSection.svelte` until `issues: []`.

- [ ] **Step 7: Types + tests**

Run: `bun run check` → 0 errors.
Run: `bun run test:unit -- run src/lib/components/KaleidoscopeSection.svelte.spec.ts src/lib/geometry/kaleidoscope.spec.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(kaleidoscope): source carpet background from palette, drop manual picker

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Animation fps state

**Files:**
- Modify: `src/lib/state/animation.svelte.ts:21-69,328-341`
- Test: `src/lib/state/animation.svelte.spec.ts`

**Interfaces:**
- Produces: `animationState.fps: number` (default 30); `setAnimationFps(n: number): void` clamping to `{25,30,50,60}` (invalid → 30). Consumed by Tasks 5 (export) and 8 (timeline transport).

- [ ] **Step 1: Write the failing test**

Add to `animation.svelte.spec.ts`:

```ts
import { setAnimationFps, animationState } from './animation';

describe('setAnimationFps', () => {
	it('accepts an allowed frame rate', () => {
		setAnimationFps(50);
		expect(animationState.fps).toBe(50);
	});
	it('falls back to 30 for a value outside the allowed set', () => {
		setAnimationFps(42);
		expect(animationState.fps).toBe(30);
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test:unit -- run src/lib/state/animation.svelte.spec.ts`
Expected: FAIL ("setAnimationFps is not a function").

- [ ] **Step 3: Add the field + setter**

In `AnimationState` type add `fps: number;` (next to `durationSec`). In the `$state` initializer add `fps: 30,`. Add the setter near `setAnimationDurationSec`:

```ts
const ALLOWED_FPS = [25, 30, 50, 60] as const;

export function setAnimationFps(value: number) {
	animationState.fps = (ALLOWED_FPS as readonly number[]).includes(value) ? value : 30;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun run test:unit -- run src/lib/state/animation.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 5: Autofixer + types**

Autofixer on `animation.svelte.ts` until `issues: []`. `bun run check` → 0 errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(animation): add fps state with allowed-set clamp

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Presenter `exportAnimation` + progress

**Files:**
- Modify: `src/lib/components/preview-presenter.svelte.ts`
- Test: `src/lib/components/preview-presenter.svelte.spec.ts` (create if absent)

**Interfaces:**
- Consumes: `exportCanvasAnimation`, `isAnimationExportSupported` (`$lib/export/canvas-export`); `getExportAudioStream` (`$lib/state/animation`); `exportStatus` (`$lib/state/export-status.svelte`); `animationState.fps` (Task 4).
- Produces: presenter return object gains `exportAnimation(): Promise<void>`, `get exportProgress(): number` (0..1), `animationExportSupported: boolean`.

- [ ] **Step 1: Write the failing test**

`preview-presenter.svelte.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createPreviewPresenter } from './preview-presenter.svelte';

describe('createPreviewPresenter export surface', () => {
	it('exposes exportAnimation and a numeric progress getter', () => {
		const p = createPreviewPresenter();
		expect(typeof p.exportAnimation).toBe('function');
		expect(typeof p.exportProgress).toBe('number');
		expect(typeof p.animationExportSupported).toBe('boolean');
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test:unit -- run src/lib/components/preview-presenter.svelte.spec.ts`
Expected: FAIL (properties undefined).

- [ ] **Step 3: Implement export wiring**

Add imports at the top of `preview-presenter.svelte.ts`:

```ts
import { animationState, getExportAudioStream } from '$lib/state/animation';
import { exportCanvasAnimation, isAnimationExportSupported } from '$lib/export/canvas-export';
import { exportStatus } from '$lib/state/export-status.svelte';
```

(Note `animationState` is already imported — extend that import to add `getExportAudioStream` instead of duplicating.)

Inside `createPreviewPresenter`, add state + function:

```ts
	let exportProgress = $state(0);

	async function exportAnimation() {
		if (!canvasEl || exportStatus.rendering) return;
		const audio = getExportAudioStream();
		exportStatus.rendering = true;
		exportProgress = 0;
		try {
			await exportCanvasAnimation({
				canvas: canvasEl,
				durationSec: animationState.durationSec,
				fps: animationState.fps,
				audioStream: audio?.stream ?? null,
				onProgress: (p) => (exportProgress = p)
			});
		} finally {
			audio?.dispose();
			exportStatus.rendering = false;
		}
	}
```

Extend the return statement:

```ts
	return {
		attach,
		exportSvg,
		exportAnimation,
		get exportProgress() {
			return exportProgress;
		},
		animationExportSupported: isAnimationExportSupported()
	};
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun run test:unit -- run src/lib/components/preview-presenter.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 5: Autofixer + types**

Autofixer on `preview-presenter.svelte.ts` until `issues: []`. `bun run check` → 0 errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(export): wire animation (WebM) export with progress in the presenter

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: PreviewCanvas — Export animation button + progress bar

**Files:**
- Modify: `src/lib/components/PreviewCanvas.svelte`
- Test: `src/lib/components/PreviewCanvas.svelte.spec.ts`

**Interfaces:**
- Consumes: `presenter.exportAnimation`, `presenter.exportProgress`, `presenter.animationExportSupported` (Task 5); `exportStatus` (`$lib/state/export-status.svelte`); `page` (`$app/state`) for route detection.

Export animation appears only on `/animate` (it captures a timed animation; the editor has no timeline). Export SVG stays everywhere.

- [ ] **Step 1: Write the failing test**

Add to `PreviewCanvas.svelte.spec.ts` (follow the file's existing render/setup; mock `$app/state` page to `/animate` as other specs do, or assert the button text):

```ts
it('shows the Export animation button', async () => {
	render(PreviewCanvas);
	await expect.element(page.getByRole('button', { name: 'Export animation' })).toBeInTheDocument();
});
```

(If the spec must force the animate route, set the mocked pathname to `/animate` in `beforeEach`, matching the project's existing `$app/state` mock pattern.)

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test:unit -- run src/lib/components/PreviewCanvas.svelte.spec.ts`
Expected: FAIL (button not found).

- [ ] **Step 3: Implement the buttons + progress**

Replace `PreviewCanvas.svelte` contents:

```svelte
<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { createPreviewPresenter } from './preview-presenter.svelte';
	import { exportStatus } from '$lib/state/export-status.svelte';

	const presenter = createPreviewPresenter();
	const isAnimate = $derived((page.url?.pathname ?? '').startsWith('/animate'));
	const progressPercent = $derived(Math.round(Math.max(0, Math.min(1, presenter.exportProgress)) * 100));
</script>

<div class="flex shrink-0 flex-col items-center gap-3">
	<canvas {@attach presenter.attach} width="600" height="600" class="rounded-lg border bg-white"
	></canvas>

	<div class="flex w-full max-w-[600px] flex-col gap-2">
		<div class="flex gap-2">
			<Button variant="outline" onclick={presenter.exportSvg} disabled={exportStatus.rendering} class="flex-1">
				Export SVG
			</Button>
			{#if isAnimate}
				<Button
					variant="outline"
					onclick={presenter.exportAnimation}
					disabled={exportStatus.rendering || !presenter.animationExportSupported}
					class="flex-1"
				>
					Export animation
				</Button>
			{/if}
		</div>

		{#if isAnimate && exportStatus.rendering}
			<div class="space-y-1">
				<div
					class="h-1.5 rounded bg-muted"
					role="progressbar"
					aria-label="Rendering progress"
					aria-valuemin="0"
					aria-valuemax="100"
					aria-valuenow={progressPercent}
				>
					<div class="h-full rounded bg-foreground transition-all" style:width={`${progressPercent}%`}></div>
				</div>
				<p class="text-[10px] text-muted-foreground">Rendering… {progressPercent}%</p>
			</div>
		{/if}

		{#if isAnimate && !presenter.animationExportSupported}
			<p class="text-[10px] text-muted-foreground">Animation export not supported in this browser.</p>
		{/if}
	</div>
</div>
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun run test:unit -- run src/lib/components/PreviewCanvas.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 5: Autofixer + types**

Autofixer on `PreviewCanvas.svelte` until `issues: []`. `bun run check` → 0 errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(export): Export animation button with rendering progress on animate

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Timeline ruler — per-second ticks

**Files:**
- Modify: `src/lib/components/TimelineRuler.svelte`
- Test: `src/lib/components/TimelineRuler.svelte.spec.ts`

**Interfaces:**
- Consumes: `animationState.durationSec`, `scrubTo`, `xFromTime`, `timeFromX`, `formatSeconds` (unchanged geometry).

- [ ] **Step 1: Update the test for per-second labels**

Replace the "renders start, middle and end" test:

```ts
	it('renders a label at each integer second of the duration', async () => {
		animationState.durationSec = 3;
		render(TimelineRuler);
		await expect.element(page.getByText('0s', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('1s', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('2s', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('3s', { exact: true })).toBeInTheDocument();
	});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test:unit -- run src/lib/components/TimelineRuler.svelte.spec.ts`
Expected: FAIL ("1s" not found — current ruler only labels 0/mid/end).

- [ ] **Step 3: Generate ticks per second**

In `TimelineRuler.svelte` `<script>`, replace the `TICK_FRACS`/`LABEL_FRACS` constants with a derived list of second marks:

```ts
	// One tick + label per integer second across the duration (always include the end).
	const secondMarks = $derived.by(() => {
		const dur = Math.max(0.1, animationState.durationSec);
		const marks: number[] = [];
		for (let s = 0; s <= Math.floor(dur); s++) marks.push(s);
		if (marks[marks.length - 1] !== dur) marks.push(dur);
		return marks;
	});
```

Replace the two `{#each}` blocks in the markup with one driven by fractions of the second marks:

```svelte
	{#each secondMarks as s (s)}
		{@const frac = s / Math.max(0.1, animationState.durationSec)}
		<div class="pointer-events-none absolute top-0 h-2 w-px bg-border" style="left: {xFromTime(frac, rulerEl?.clientWidth ?? 0)}px"></div>
		<span class="pointer-events-none absolute bottom-0 -translate-x-1/2 text-[10px] leading-none text-muted-foreground" style="left: {xFromTime(frac, rulerEl?.clientWidth ?? 0)}px">
			{formatSeconds(s)}
		</span>
	{/each}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun run test:unit -- run src/lib/components/TimelineRuler.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 5: Autofixer + types**

Autofixer on `TimelineRuler.svelte` until `issues: []`. `bun run check` → 0 errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(timeline): per-second ticks on the ruler

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Timeline panel transport bar + spacebar + equal height

**Files:**
- Modify: `src/lib/components/TimelinePanel.svelte`
- Test: `src/lib/components/TimelinePanel.svelte.spec.ts`

**Interfaces:**
- Consumes: `animationState`, `togglePlay`, `stopAnimation`, `setAnimationDurationSec`, `setAnimationFps` (`$lib/state/animation`); `composition` for `blockPlayback`.

Transport (Play/Stop + Duration-or-elapsed + fps) lives in the panel header, always visible. Spacebar toggles play. Both views share a fixed-height container.

- [ ] **Step 1: Write failing tests**

Add to `TimelinePanel.svelte.spec.ts`:

```ts
	it('renders the transport play button and fps selector', async () => {
		render(TimelinePanel);
		await expect.element(page.getByRole('button', { name: /Play|Pause/ })).toBeInTheDocument();
		await expect.element(page.getByLabelText('Frame rate')).toBeInTheDocument();
	});

	it('toggles play on spacebar', async () => {
		render(TimelinePanel);
		const before = animationState.isPlaying;
		window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
		expect(animationState.isPlaying).not.toBe(before);
	});
```

(Ensure `beforeEach` resets `animationState.isPlaying = false`, arms at least one keyframe track if the test needs the body, and `setAnimationMode('simple')` plus a morph ring so `blockPlayback` is false — or assert against the `audioBars` mode where play is always enabled.)

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test:unit -- run src/lib/components/TimelinePanel.svelte.spec.ts`
Expected: FAIL (transport not present).

- [ ] **Step 3: Add transport + spacebar + equal-height**

In `TimelinePanel.svelte` `<script>`, add imports and helpers:

```ts
	import { Input } from '$lib/shadcn/ui/input/index.js';
	import {
		animationState,
		refreshPreview,
		togglePlay,
		stopAnimation,
		setAnimationDurationSec,
		setAnimationFps
	} from '$lib/state/animation';
	import { composition } from '$lib/state/composition';

	const FPS_OPTIONS = [25, 30, 50, 60];

	const isAudioMode = $derived(
		animationState.mode === 'audioBars' || animationState.mode === 'audioZones'
	);
	const hasMorphRings = $derived(composition.rings.some((r) => r.secondaryTemplatePath !== null));
	const requiresMorphRings = $derived(!isAudioMode);
	const blockPlayback = $derived(requiresMorphRings && !hasMorphRings);

	function formatElapsed(ms: number): string {
		const totalSec = Math.floor(ms / 1000);
		const m = Math.floor(totalSec / 60);
		const s = totalSec % 60;
		return `${m}:${String(s).padStart(2, '0')}`;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key !== ' ' && e.code !== 'Space') return;
		const t = e.target as HTMLElement | null;
		const tag = t?.tagName;
		if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || t?.isContentEditable) return;
		e.preventDefault();
		if (!blockPlayback) togglePlay();
	}

	$effect(() => {
		window.addEventListener('keydown', onKeydown);
		return () => window.removeEventListener('keydown', onKeydown);
	});
```

(Keep `refreshPreview` if it was already imported; merge imports, don't duplicate.)

In the header `<div class="flex items-center gap-3 p-3">`, after the open/close button, add the transport controls (before the existing `{#if open}` view-switch block, or merged into it):

```svelte
		{#if open}
			<div class="flex items-center gap-2">
				<Button onclick={togglePlay} aria-pressed={animationState.isPlaying} disabled={blockPlayback} size="sm">
					{animationState.isPlaying ? 'Pause' : 'Play'}
				</Button>
				<Button onclick={() => stopAnimation(true)} variant="ghost" size="sm">Stop</Button>

				{#if isAudioMode}
					<span class="tabular-nums text-xs text-muted-foreground" aria-label="Elapsed time">
						{formatElapsed(animationState.elapsedMs)}
					</span>
				{:else}
					<label class="flex items-center gap-1 text-xs text-muted-foreground">
						Dur
						<Input
							type="number"
							min="0.1"
							step="0.1"
							aria-label="Duration seconds"
							value={animationState.durationSec}
							oninput={(e) => setAnimationDurationSec(Number((e.target as HTMLInputElement).value))}
							class="h-7 w-16 text-xs"
						/>
						s
					</label>
				{/if}

				<label class="flex items-center gap-1 text-xs text-muted-foreground">
					fps
					<select
						aria-label="Frame rate"
						class="h-7 rounded border bg-background text-xs"
						value={animationState.fps}
						onchange={(e) => setAnimationFps(Number((e.target as HTMLSelectElement).value))}
					>
						{#each FPS_OPTIONS as f (f)}
							<option value={f}>{f}</option>
						{/each}
					</select>
				</label>
			</div>
		{/if}
```

For equal height, wrap the body's `{#if armedParams.length === 0}…{:else if view === 'graph'}…{:else}…` content in a fixed-height container:

```svelte
			<div data-testid="timeline-viewport" class="min-h-[220px]">
				<!-- existing empty-state / graph / tracks branches unchanged -->
			</div>
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun run test:unit -- run src/lib/components/TimelinePanel.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 5: Autofixer + types**

Autofixer on `TimelinePanel.svelte` until `issues: []`. `bun run check` → 0 errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(timeline): transport bar (play/stop/duration/fps), spacebar, equal-height views

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Remove transport from the sidebar AnimationSection

**Files:**
- Modify: `src/lib/components/AnimationSection.svelte`
- Test: `src/lib/components/AnimationSection.svelte.spec.ts`

**Interfaces:**
- Transport now lives in the timeline (Task 8). The sidebar keeps audio-config controls only.

- [ ] **Step 1: Update the test**

Replace/remove any test asserting the duration field, Play/Pause button, progress bar, or elapsed counter in `AnimationSection`. Add a guard test:

```ts
	it('no longer renders the duration input (moved to the timeline)', async () => {
		render(AnimationSection);
		await expect.element(page.getByLabelText('Duration (s)')).not.toBeInTheDocument();
	});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test:unit -- run src/lib/components/AnimationSection.svelte.spec.ts`
Expected: FAIL (duration input still present).

- [ ] **Step 3: Remove the transport block**

In `AnimationSection.svelte`, delete the entire `{#if !hideGlobalTransport} … {/if}` block (lines ~411-463: duration field, Play/Pause, progress bar, elapsed counter). Remove the now-unused imports/derived: `setAnimationDurationSec`, `togglePlay`, `Input`, `progressPercent`, `hideGlobalTransport`, `formatElapsed`, `blockPlayback` — but ONLY those no longer referenced elsewhere in the file (the `blockPlayback` warning banner at the top still uses `blockPlayback`, `hasMorphRings`, `requiresMorphRings`; keep those). Verify each removal against remaining usages before deleting.

- [ ] **Step 4: Run to verify it passes**

Run: `bun run test:unit -- run src/lib/components/AnimationSection.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 5: Autofixer + types**

Autofixer on `AnimationSection.svelte` until `issues: []`. `bun run check` → 0 errors (no unused symbols).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(animate): move playback transport out of the sidebar into the timeline

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Sidebar width + Paths nav alignment

**Files:**
- Modify: `src/lib/shadcn/ui/sidebar/constants.ts:3`
- Modify: `src/routes/paths/+page.svelte:31`
- Test: `src/routes/paths/page.svelte.spec.ts`

**Interfaces:**
- `SIDEBAR_WIDTH = "18rem"`; the Paths header content is indented by `18rem` (`pl-72`) so its nav starts at the same x as the Editor/Animate nav.

- [ ] **Step 1: Write/extend a structural test**

Add to `paths/page.svelte.spec.ts`:

```ts
	it('indents the header to align the nav with the app pages', async () => {
		render(Page);
		const header = page.getByRole('banner').element() as HTMLElement;
		expect(header.querySelector('.pl-72')).not.toBeNull();
	});
```

(If the header is not a `<header>` with implicit `banner` role in the current markup, target it via an added `data-testid="paths-header"` set in Step 3.)

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test:unit -- run src/routes/paths/page.svelte.spec.ts`
Expected: FAIL (no `pl-72`).

- [ ] **Step 3: Apply the width + indent**

`src/lib/shadcn/ui/sidebar/constants.ts`:

```ts
export const SIDEBAR_WIDTH = "18rem";
```

`src/routes/paths/+page.svelte` — add `pl-72` to the header so the nav aligns; give it a testid:

```svelte
	<header data-testid="paths-header" class="flex items-center gap-2 border-b p-4 pl-72">
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun run test:unit -- run src/routes/paths/page.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 5: Autofixer + types**

Autofixer on `paths/+page.svelte` until `issues: []`. `bun run check` → 0 errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(paths): widen sidebar to 18rem and align Paths nav with app pages

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Paths — library-kind dropdown (Path / Anim, shell)

**Files:**
- Modify: `src/routes/paths/+page.svelte`
- Test: `src/routes/paths/page.svelte.spec.ts`

**Interfaces:**
- Local `libraryKind: 'path' | 'anim'` (default `'path'`). `'path'` → current list/preview/apply. `'anim'` → placeholder; no new state module.

- [ ] **Step 1: Write failing tests**

```ts
	it('switches to the Anim Library placeholder', async () => {
		render(Page);
		await userEvent.selectOptions(page.getByLabelText('Library'), 'anim');
		await expect.element(page.getByTestId('anim-library-placeholder')).toBeInTheDocument();
		await expect.element(page.getByTestId('paths-list')).not.toBeInTheDocument();
	});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test:unit -- run src/routes/paths/page.svelte.spec.ts`
Expected: FAIL (no dropdown / placeholder).

- [ ] **Step 3: Add the dropdown + placeholder**

In `paths/+page.svelte` `<script>`, add: `let libraryKind = $state<'path' | 'anim'>('path');`

Replace the `<span class="ml-2 text-sm font-semibold">Path Library</span>` with:

```svelte
		<select
			aria-label="Library"
			class="ml-2 h-7 rounded border bg-background text-sm font-semibold"
			value={libraryKind}
			onchange={(e) => (libraryKind = (e.target as HTMLSelectElement).value as 'path' | 'anim')}
		>
			<option value="path">Path Library</option>
			<option value="anim">Anim Library</option>
		</select>
```

Wrap the existing `<div class="flex flex-1">…</div>` (the aside list + main preview) so it only renders for `'path'`, and add the placeholder for `'anim'`:

```svelte
	{#if libraryKind === 'path'}
		<!-- existing aside + main block unchanged -->
	{:else}
		<div
			data-testid="anim-library-placeholder"
			class="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground"
		>
			Anim Library — preset di animazioni, in arrivo.
		</div>
	{/if}
```

(The `({pathLibrary.entries.length})` count next to the dropdown should also be gated to `libraryKind === 'path'`.)

- [ ] **Step 4: Run to verify it passes**

Run: `bun run test:unit -- run src/routes/paths/page.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 5: Autofixer + types**

Autofixer on `paths/+page.svelte` until `issues: []`. `bun run check` → 0 errors.

- [ ] **Step 6: Full suite + commit**

Run the whole suite to confirm nothing regressed:
Run: `bun run test:unit -- run`
Expected: all pass.

```bash
git add -A
git commit -m "feat(paths): library-kind dropdown with Anim Library placeholder

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review notes (spec coverage)

- §1 colour model → Tasks 1, 2, 3. ✓
- §2 export animation (keep both buttons + progress) → Tasks 5, 6 (fps dep in 4). ✓
- §3 timeline (transport, duration-in-timeline, play/stop, spacebar, per-second ticks, fps, equal height) → Tasks 4, 7, 8; sidebar transport removed in 9. ✓
- §4 paths nav + sidebar width → Task 10. ✓
- §5 library dropdown shell → Task 11. ✓
- Out of scope (anim presets) → not implemented, placeholder only. ✓

Type consistency: `MonochromePalette` fields (`primary/secondary/background`), `setAnimationFps`, `animationState.fps`, `presenter.exportAnimation/exportProgress/animationExportSupported`, `normalizeComposition` — names used consistently across tasks.
