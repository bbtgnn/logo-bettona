# Composition Static Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-home static PNG/SVG export into a dedicated Composition-sidebar panel, complete the print-format control (paper size → canvas shape + DPI export size), and add a composition background-color picker.

**Architecture:** The static export math already exists on `createPreviewPresenter()` and is reused unchanged. The presenter becomes a shared **module singleton** (`previewPresenter`) imported by both `PreviewCanvas` (canvas + animation export, main pane) and a new `ExportSection` (static export, Composition sidebar) — one presenter, one live canvas, two consumers. Print format lives in a sibling `lsSync` store and drives the composition's effective proportion; background color edits the active mono palette.

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, paper.js, rune-sync (lsSync), Paraglide (messages/{en,it}.json), shadcn-svelte, Vitest (browser via `*.svelte.spec.ts`, node via `*.spec.ts`), Tailwind.

## Global Constraints

- Package manager: **bun**, but scripts run via `npm run <script>` (see package.json).
- **Static export only** — no audio/animation dependency in PNG/SVG output. The presenter already sets `ignoreMorph`; do not add audio taps to static paths.
- **Reuse, do not duplicate** the presenter export math.
- DOM/interaction tests MUST be `*.svelte.spec.ts` (browser runner); pure logic tests are `*.spec.ts` (node runner).
- After editing `messages/{en,it}.json` you MUST run `npm run paraglide` before `m.<key>()` compiles.
- Type a paper scope as `paper.PaperScope` via `import paper from 'paper'`.
- Run the Svelte MCP `svelte-autofixer` on every `.svelte` file authored, until clean.
- Per-task checks: `npm run check` (svelte-check) and `npm run test:unit -- --run <files>`; full `npm run lint` before hand-off.
- Print format state is a sibling `lsSync` store (not a new field on the persisted `Composition`), matching the existing `colorMode` / `uiState` pattern.

---

### Task 1: Print-format table, helpers, and proportion sizing

**Files:**
- Create: `src/lib/geometry/print-format.ts`
- Create: `src/lib/geometry/print-format.spec.ts`
- Modify: `src/lib/geometry/aspect-ratio.ts`
- Modify: `src/lib/geometry/aspect-ratio.spec.ts` (create if absent)

**Interfaces:**
- Produces:
  - `type PrintFormatId = 'a5' | 'a4' | 'a3' | 'letter'`
  - `type Orientation = 'portrait' | 'landscape'`
  - `type PrintFormat = { id: PrintFormatId; label: string; widthMm: number; heightMm: number }`
  - `const PRINT_FORMATS: PrintFormat[]`
  - `orientedDimensionsMm(id: PrintFormatId, orientation: Orientation): { widthMm: number; heightMm: number }`
  - `printFormatPixelSize(id: PrintFormatId, orientation: Orientation, dpi: number): { width: number; height: number }`
  - `proportionToCanvasSize(w: number, h: number, longSide: number): { width: number; height: number }` (in aspect-ratio.ts)

- [ ] **Step 1: Write the failing test** — `src/lib/geometry/print-format.spec.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
	PRINT_FORMATS,
	orientedDimensionsMm,
	printFormatPixelSize
} from './print-format';

describe('print-format', () => {
	it('lists A5, A4, A3, Letter with portrait mm dimensions', () => {
		const ids = PRINT_FORMATS.map((f) => f.id);
		expect(ids).toEqual(['a5', 'a4', 'a3', 'letter']);
		const a4 = PRINT_FORMATS.find((f) => f.id === 'a4')!;
		expect(a4.widthMm).toBe(210);
		expect(a4.heightMm).toBe(297);
	});

	it('portrait keeps width < height; landscape swaps', () => {
		expect(orientedDimensionsMm('a4', 'portrait')).toEqual({ widthMm: 210, heightMm: 297 });
		expect(orientedDimensionsMm('a4', 'landscape')).toEqual({ widthMm: 297, heightMm: 210 });
	});

	it('A4 @ 300 DPI portrait is 2480 x 3508 px', () => {
		expect(printFormatPixelSize('a4', 'portrait', 300)).toEqual({ width: 2480, height: 3508 });
	});

	it('Letter has its own non-A proportion', () => {
		const letter = PRINT_FORMATS.find((f) => f.id === 'letter')!;
		expect(letter.widthMm).toBeCloseTo(215.9, 1);
		expect(letter.heightMm).toBeCloseTo(279.4, 1);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- --run src/lib/geometry/print-format.spec.ts`
Expected: FAIL — cannot resolve `./print-format`.

- [ ] **Step 3: Write minimal implementation** — `src/lib/geometry/print-format.ts`

```ts
/** ISO 216 + US Letter paper presets. Millimetre dimensions are portrait (width < height). */
export type PrintFormatId = 'a5' | 'a4' | 'a3' | 'letter';
export type Orientation = 'portrait' | 'landscape';
export type PrintFormat = { id: PrintFormatId; label: string; widthMm: number; heightMm: number };

export const PRINT_FORMATS: PrintFormat[] = [
	{ id: 'a5', label: 'A5', widthMm: 148, heightMm: 210 },
	{ id: 'a4', label: 'A4', widthMm: 210, heightMm: 297 },
	{ id: 'a3', label: 'A3', widthMm: 297, heightMm: 420 },
	{ id: 'letter', label: 'Letter', widthMm: 215.9, heightMm: 279.4 }
];

const BY_ID: Record<PrintFormatId, PrintFormat> = Object.fromEntries(
	PRINT_FORMATS.map((f) => [f.id, f])
) as Record<PrintFormatId, PrintFormat>;

/** Oriented paper dimensions in mm; landscape swaps width and height. */
export function orientedDimensionsMm(
	id: PrintFormatId,
	orientation: Orientation
): { widthMm: number; heightMm: number } {
	const f = BY_ID[id];
	return orientation === 'landscape'
		? { widthMm: f.heightMm, heightMm: f.widthMm }
		: { widthMm: f.widthMm, heightMm: f.heightMm };
}

/** Integer pixel size for the oriented paper at the given DPI: px = mm * dpi / 25.4. */
export function printFormatPixelSize(
	id: PrintFormatId,
	orientation: Orientation,
	dpi: number
): { width: number; height: number } {
	const { widthMm, heightMm } = orientedDimensionsMm(id, orientation);
	return {
		width: Math.round((widthMm * dpi) / 25.4),
		height: Math.round((heightMm * dpi) / 25.4)
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- --run src/lib/geometry/print-format.spec.ts`
Expected: PASS.

- [ ] **Step 5: Add `proportionToCanvasSize` and refactor `ratioToCanvasSize`** — edit `src/lib/geometry/aspect-ratio.ts`

Replace the body of `ratioToCanvasSize` and add the new helper:

```ts
/** Canvas pixel dimensions for an arbitrary width:height proportion, longer side = `longSide`. */
export function proportionToCanvasSize(
	w: number,
	h: number,
	longSide: number
): { width: number; height: number } {
	if (w >= h) {
		return { width: longSide, height: Math.round((longSide * h) / w) };
	}
	return { width: Math.round((longSide * w) / h), height: longSide };
}

export function ratioToCanvasSize(
	ratio: AspectRatio,
	longSide: number
): { width: number; height: number } {
	const [w, h] = ratio.split(':').map(Number);
	return proportionToCanvasSize(w, h, longSide);
}
```

- [ ] **Step 6: Add proportion test** — append to `src/lib/geometry/aspect-ratio.spec.ts` (create the file with this content if it does not exist)

```ts
import { describe, it, expect } from 'vitest';
import { proportionToCanvasSize, ratioToCanvasSize } from './aspect-ratio';

describe('proportionToCanvasSize', () => {
	it('caps the longer side and rounds the shorter one', () => {
		expect(proportionToCanvasSize(210, 297, 3508)).toEqual({ width: 2480, height: 3508 });
		expect(proportionToCanvasSize(16, 9, 1600)).toEqual({ width: 1600, height: 900 });
	});

	it('ratioToCanvasSize delegates to it', () => {
		expect(ratioToCanvasSize('1:1', 600)).toEqual({ width: 600, height: 600 });
	});
});
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm run test:unit -- --run src/lib/geometry/print-format.spec.ts src/lib/geometry/aspect-ratio.spec.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/geometry/print-format.ts src/lib/geometry/print-format.spec.ts src/lib/geometry/aspect-ratio.ts src/lib/geometry/aspect-ratio.spec.ts
git commit -m "feat: print-format table + proportion canvas sizing"
```

---

### Task 2: Canvas-format state, setters, effective proportion, background setter

**Files:**
- Modify: `src/lib/state/composition.ts`
- Create: `src/lib/state/composition.print-format.spec.ts`

**Interfaces:**
- Consumes: `PrintFormatId`, `Orientation`, `orientedDimensionsMm` (Task 1); `colorMode`, `composition`, `getCompositionBackgroundColor` (existing).
- Produces:
  - `const canvasFormat` — `lsSync<{ printFormat: PrintFormatId | null; orientation: Orientation }>`
  - `setPrintFormat(id: PrintFormatId | null): void`
  - `setPrintOrientation(orientation: Orientation): void`
  - `getEffectiveCanvasProportion(): { width: number; height: number }`
  - `setPaletteBackground(color: string): void`

- [ ] **Step 1: Write the failing test** — `src/lib/state/composition.print-format.spec.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
	canvasFormat,
	setPrintFormat,
	setPrintOrientation,
	getEffectiveCanvasProportion,
	setPaletteBackground,
	getCompositionBackgroundColor,
	colorMode
} from './composition';
import { composition } from './composition-persistence.svelte';

describe('canvas format + background state', () => {
	beforeEach(() => {
		setPrintFormat(null);
		setPrintOrientation('portrait');
		composition.aspectRatio = '1:1';
		composition.monochromePalettes = [
			{ primary: '#000000', secondary: '#ffffff', background: '#ffffff' }
		];
		colorMode.mode = 'monochrome';
		colorMode.palette = 0;
	});

	it('with no print format, proportion follows the aspect ratio', () => {
		composition.aspectRatio = '16:9';
		expect(getEffectiveCanvasProportion()).toEqual({ width: 16, height: 9 });
	});

	it('a print format overrides the proportion with oriented paper mm', () => {
		setPrintFormat('a4');
		expect(getEffectiveCanvasProportion()).toEqual({ width: 210, height: 297 });
		setPrintOrientation('landscape');
		expect(getEffectiveCanvasProportion()).toEqual({ width: 297, height: 210 });
	});

	it('setPaletteBackground updates the active mono palette background', () => {
		setPaletteBackground('#112233');
		expect(getCompositionBackgroundColor()).toBe('#112233');
		expect(composition.monochromePalettes[0].background).toBe('#112233');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- --run src/lib/state/composition.print-format.spec.ts`
Expected: FAIL — `canvasFormat` / `setPrintFormat` not exported.

- [ ] **Step 3: Write minimal implementation** — edit `src/lib/state/composition.ts`

Add the import at the top (merge with the existing `$lib/types` import if you prefer, but the print-format types come from geometry):

```ts
import type { PrintFormatId, Orientation } from '$lib/geometry/print-format';
import { orientedDimensionsMm } from '$lib/geometry/print-format';
```

Add near the other `lsSync` stores (below `uiState`):

```ts
export const canvasFormat = lsSync<{ printFormat: PrintFormatId | null; orientation: Orientation }>(
	'canvas-format',
	{ printFormat: null, orientation: 'portrait' }
);

export function setPrintFormat(id: PrintFormatId | null) {
	canvasFormat.printFormat = id;
}

export function setPrintOrientation(orientation: Orientation) {
	canvasFormat.orientation = orientation;
}

/**
 * The width:height proportion the canvas is rendered at. A print format overrides
 * the screen aspect ratio with the oriented paper dimensions (in mm, used purely as
 * a proportion); otherwise the aspect-ratio preset is parsed.
 */
export function getEffectiveCanvasProportion(): { width: number; height: number } {
	if (canvasFormat.printFormat) {
		const { widthMm, heightMm } = orientedDimensionsMm(
			canvasFormat.printFormat,
			canvasFormat.orientation
		);
		return { width: widthMm, height: heightMm };
	}
	const [w, h] = composition.aspectRatio.split(':').map(Number);
	return { width: w, height: h };
}

/** Writes the active mono palette's background (replaces the array for reactivity). */
export function setPaletteBackground(color: string) {
	const i = colorMode.palette;
	composition.monochromePalettes = composition.monochromePalettes.map((p, idx) =>
		idx === i ? { ...p, background: color } : p
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- --run src/lib/state/composition.print-format.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/composition.ts src/lib/state/composition.print-format.spec.ts
git commit -m "feat: canvas print-format state + effective proportion + bg setter"
```

---

### Task 3: Presenter reads effective proportion; wire the Canvas-panel print-format control

Selecting a paper format reshapes the live canvas and disables the aspect select.

**Files:**
- Modify: `src/lib/components/preview-presenter.svelte.ts`
- Modify: `src/lib/components/CanvasSection.svelte`
- Modify: `messages/en.json`, `messages/it.json`
- Modify: `src/routes/(app)/composition/page.svelte.spec.ts`

**Interfaces:**
- Consumes: `getEffectiveCanvasProportion`, `setPrintFormat`, `setPrintOrientation`, `canvasFormat` (Task 2); `proportionToCanvasSize` (Task 1); `PRINT_FORMATS` (Task 1).

- [ ] **Step 1: Presenter — size the canvas from the effective proportion**

In `src/lib/components/preview-presenter.svelte.ts`:

Update the imports:

```ts
import { ratioToCanvasSize, proportionToCanvasSize } from '$lib/geometry/aspect-ratio';
import {
	composition,
	getCompositionBackgroundColor,
	getEffectiveCanvasProportion
} from '$lib/state/composition';
```

Replace the three `ratioToCanvasSize(composition.aspectRatio, X)` / `ratioToCanvasSize(comp.aspectRatio, X)` call sites with the effective proportion. Flat effect (was line ~230):

```ts
const p = getEffectiveCanvasProportion();
const { width, height } = proportionToCanvasSize(p.width, p.height, CANVAS_LONG_SIDE);
```

Kaleidoscope sizing effect (was line ~287):

```ts
const p = getEffectiveCanvasProportion();
const { width, height } = proportionToCanvasSize(p.width, p.height, CANVAS_LONG_SIDE);
```

`exportPng` (was line ~174) — keep behavior identical for now (Task 7 generalizes size):

```ts
const p = getEffectiveCanvasProportion();
const { width, height } = proportionToCanvasSize(p.width, p.height, CANVAS_LONG_SIDE * scale);
```

Leave `ratioToCanvasSize` imported only if still used elsewhere; otherwise drop it from the import to satisfy lint.

- [ ] **Step 2: Add messages** — edit `messages/en.json` and `messages/it.json`

`messages/en.json` (add keys):

```json
"composition_print_format_digital": "Digital",
"composition_orientation": "Orientation",
"composition_orientation_portrait": "Portrait",
"composition_orientation_landscape": "Landscape"
```

`messages/it.json`:

```json
"composition_print_format_digital": "Digitale",
"composition_orientation": "Orientamento",
"composition_orientation_portrait": "Verticale",
"composition_orientation_landscape": "Orizzontale"
```

Run: `npm run paraglide`
Expected: message modules regenerate under `src/lib/paraglide/messages/`.

- [ ] **Step 3: Write the failing component test** — edit `src/routes/(app)/composition/page.svelte.spec.ts`

Add inside the `describe('Composition page', …)` block:

```ts
it('disables the aspect select when a print format is chosen and shows orientation', async () => {
	const { setPrintFormat } = await import('$lib/state/composition');
	setPrintFormat(null);
	render(CompositionPage);

	const aspect = page.getByLabelText('Aspect ratio');
	await expect.element(aspect).toBeInTheDocument();
	expect((aspect.element() as HTMLSelectElement).disabled).toBe(false);

	await userEvent.selectOptions(page.getByLabelText('Print format'), 'a4');
	expect((aspect.element() as HTMLSelectElement).disabled).toBe(true);
	await expect.element(page.getByLabelText('Orientation')).toBeInTheDocument();

	setPrintFormat(null);
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm run test:unit -- --run "src/routes/(app)/composition/page.svelte.spec.ts"`
Expected: FAIL — Print format select still shows the disabled "coming soon" stub; no Orientation control.

- [ ] **Step 5: Implement the control** — replace the stub block in `src/lib/components/CanvasSection.svelte`

Update the script imports:

```svelte
<script lang="ts">
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import {
		composition,
		setAspectRatio,
		canvasFormat,
		setPrintFormat,
		setPrintOrientation
	} from '$lib/state/composition';
	import { ASPECT_RATIOS } from '$lib/geometry/aspect-ratio';
	import { PRINT_FORMATS, type PrintFormatId, type Orientation } from '$lib/geometry/print-format';
	import type { AspectRatio } from '$lib/types';
	import { exportStatus } from '$lib/state/export-status.svelte';
	import { m } from '$lib/paraglide/messages';
	import SidebarCollapsible from './SidebarCollapsible.svelte';
</script>
```

Set `disabled` on the aspect select to also cover an active print format:

```svelte
disabled={exportStatus.rendering || canvasFormat.printFormat !== null}
```

Replace the reserved-space stub `<div>…</div>` with:

```svelte
<div class="flex flex-col gap-1">
	<Label for="canvas-print-format" class="text-xs">{m.composition_print_format()}</Label>
	<select
		id="canvas-print-format"
		class="h-9 w-full rounded-md border border-input bg-background py-1 text-xs disabled:opacity-50"
		value={canvasFormat.printFormat ?? ''}
		disabled={exportStatus.rendering}
		onchange={(e) => {
			const v = (e.target as HTMLSelectElement).value;
			setPrintFormat(v === '' ? null : (v as PrintFormatId));
		}}
	>
		<option value="">{m.composition_print_format_digital()}</option>
		{#each PRINT_FORMATS as format (format.id)}
			<option value={format.id}>{format.label}</option>
		{/each}
	</select>
</div>

{#if canvasFormat.printFormat !== null}
	<div class="flex flex-col gap-1">
		<Label for="canvas-orientation" class="text-xs">{m.composition_orientation()}</Label>
		<select
			id="canvas-orientation"
			class="h-9 w-full rounded-md border border-input bg-background py-1 text-xs disabled:opacity-50"
			value={canvasFormat.orientation}
			disabled={exportStatus.rendering}
			onchange={(e) =>
				setPrintOrientation((e.target as HTMLSelectElement).value as Orientation)}
		>
			<option value="portrait">{m.composition_orientation_portrait()}</option>
			<option value="landscape">{m.composition_orientation_landscape()}</option>
		</select>
	</div>
{/if}
```

Run the Svelte MCP `svelte-autofixer` on `CanvasSection.svelte` until clean.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test:unit -- --run "src/routes/(app)/composition/page.svelte.spec.ts" src/lib/components/preview-presenter.export.svelte.spec.ts`
Expected: PASS. (Export spec still green — proportion path is equivalent for aspect ratios.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/preview-presenter.svelte.ts src/lib/components/CanvasSection.svelte messages/en.json messages/it.json src/lib/paraglide "src/routes/(app)/composition/page.svelte.spec.ts"
git commit -m "feat: wire print-format + orientation control; canvas follows paper shape"
```

---

### Task 4: Share the presenter as a module singleton; slim `PreviewCanvas`

**Files:**
- Modify: `src/lib/components/preview-presenter.svelte.ts`
- Modify: `src/lib/components/PreviewCanvas.svelte`
- Modify: `src/lib/components/PreviewCanvas.svelte.spec.ts`

**Interfaces:**
- Produces: `const previewPresenter = createPreviewPresenter()` exported from `preview-presenter.svelte.ts` (shared instance). `ExportSection` (Task 5) imports it.

- [ ] **Step 1: Export the shared instance** — append to `src/lib/components/preview-presenter.svelte.ts`

At the end of the file, after `createPreviewPresenter`:

```ts
/**
 * The single presenter instance bound to the app's one visible canvas. PreviewCanvas
 * (main pane) attaches it; ExportSection (Composition sidebar) drives static export
 * off the same instance so the export logic is shared, not duplicated.
 */
export const previewPresenter = createPreviewPresenter();
```

- [ ] **Step 2: `PreviewCanvas` consumes the singleton and drops static-export UI** — rewrite `src/lib/components/PreviewCanvas.svelte`

```svelte
<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { previewPresenter } from './preview-presenter.svelte';
	import { exportStatus } from '$lib/state/export-status.svelte';
	import { m } from '$lib/paraglide/messages';

	// `animate` is set by the (app) layout only on the /animate route. Animation export
	// captures a timed animation, so it belongs to the animate surface. Static PNG/SVG
	// export now lives in the Composition sidebar (ExportSection).
	let { animate = false }: { animate?: boolean } = $props();

	const presenter = previewPresenter;
	const progressPercent = $derived(
		Math.round(Math.max(0, Math.min(1, presenter.exportProgress)) * 100)
	);
</script>

<div class="flex shrink-0 flex-col items-center gap-3">
	<canvas {@attach presenter.attach} width="600" height="600" class="rounded-lg border"
	></canvas>

	{#if animate}
		<div class="flex w-full max-w-[600px] flex-col gap-2">
			<Button
				variant="outline"
				onclick={presenter.exportAnimation}
				disabled={exportStatus.rendering || !presenter.animationExportSupported}
				class="w-full"
			>
				{m.preview_export_animation()}
			</Button>

			{#if exportStatus.rendering}
				<div class="space-y-1">
					<div
						class="h-1.5 rounded bg-muted"
						role="progressbar"
						aria-label={m.preview_rendering_progress()}
						aria-valuemin="0"
						aria-valuemax="100"
						aria-valuenow={progressPercent}
					>
						<div
							class="h-full rounded bg-foreground transition-all"
							style:width={`${progressPercent}%`}
						></div>
					</div>
					<p class="text-[10px] text-muted-foreground">
						{m.preview_rendering({ pct: progressPercent })}
					</p>
				</div>
			{/if}

			{#if !presenter.animationExportSupported}
				<p class="text-[10px] text-muted-foreground">
					{m.preview_export_unsupported()}
				</p>
			{/if}
		</div>
	{/if}
</div>
```

Run the Svelte MCP `svelte-autofixer` on `PreviewCanvas.svelte` until clean.

- [ ] **Step 3: Update `PreviewCanvas.svelte.spec.ts`** — remove the static-export assertions now owned by ExportSection.

Delete these `it(...)` blocks entirely (they move to Task 5's ExportSection spec):
- `'off the animate surface, exposes only Export SVG'`
- `'Export SVG downloads the kaleidoscope SVG when kaleidoscope mode is on'`
- `'shows the PNG export controls on both routes'`
- `'triggers a PNG download when Export PNG is clicked'`
- `'flat Export SVG produces no download when there are no rings'`

Replace the `'on the animate surface, …'` test with an animation-only assertion:

```ts
it('shows the Export animation button only on the animate surface', async () => {
	const { rerender } = render(PreviewCanvas);
	expect(page.getByRole('button', { name: 'Export animation' }).query()).toBeNull();

	await rerender({ animate: true });
	await expect
		.element(page.getByRole('button', { name: 'Export animation' }))
		.toBeInTheDocument();
});
```

Keep the pipeline-render, dispose, and background-rect tests unchanged. Remove the now-unused `userEvent` / `setKaleidoscopeEnabled` imports only if no remaining test uses them (the background/kaleidoscope-CSS tests still use `setKaleidoscopeEnabled`, so keep it).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- --run src/lib/components/PreviewCanvas.svelte.spec.ts src/lib/components/preview-presenter.export.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/preview-presenter.svelte.ts src/lib/components/PreviewCanvas.svelte src/lib/components/PreviewCanvas.svelte.spec.ts
git commit -m "refactor: share preview presenter singleton; slim PreviewCanvas to animation export"
```

---

### Task 5: `ExportSection` panel — SVG/PNG + include-background + scale resolution

Static export moves into the Composition sidebar. DPI/print size and the color picker land in Tasks 6–7.

**Files:**
- Create: `src/lib/components/ExportSection.svelte`
- Create: `src/lib/components/ExportSection.svelte.spec.ts`
- Modify: `src/routes/(app)/composition/+page.svelte`
- Modify: `messages/en.json`, `messages/it.json`

**Interfaces:**
- Consumes: `previewPresenter` (Task 4) — `exportSvg({ includeBackground })`, `exportPng({ includeBackground, scale })`, `exportProgress`; `exportStatus`; `canvasFormat` (Task 2).

- [ ] **Step 1: Add messages** — edit `messages/en.json` and `messages/it.json`

`messages/en.json`:

```json
"composition_export": "Export"
```

`messages/it.json`:

```json
"composition_export": "Esporta"
```

Run: `npm run paraglide`

- [ ] **Step 2: Write the failing component test** — `src/lib/components/ExportSection.svelte.spec.ts`

```ts
import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { switchLocale } from '$lib/state/locale.svelte';
import { previewPresenter } from './preview-presenter.svelte';
import ExportSection from './ExportSection.svelte';

describe('ExportSection', () => {
	beforeEach(async () => {
		switchLocale('en');
		await page.viewport(1280, 800);
	});

	it('renders SVG/PNG buttons, the include-background toggle and resolution', async () => {
		render(ExportSection);
		await expect.element(page.getByRole('button', { name: 'Export SVG' })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Export PNG' })).toBeInTheDocument();
		await expect.element(page.getByLabelText('Include background')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Resolution')).toBeInTheDocument();
	});

	it('Export SVG calls the shared presenter with the include-background flag', async () => {
		const spy = vi.spyOn(previewPresenter, 'exportSvg').mockImplementation(() => {});
		try {
			render(ExportSection);
			await userEvent.click(page.getByRole('button', { name: 'Export SVG' }));
			expect(spy).toHaveBeenCalledWith({ includeBackground: true });
		} finally {
			spy.mockRestore();
		}
	});

	it('Export PNG passes the selected scale', async () => {
		const spy = vi.spyOn(previewPresenter, 'exportPng').mockImplementation(() => {});
		try {
			render(ExportSection);
			await userEvent.selectOptions(page.getByLabelText('Resolution'), '2');
			await userEvent.click(page.getByRole('button', { name: 'Export PNG' }));
			expect(spy).toHaveBeenCalledWith(expect.objectContaining({ includeBackground: true, scale: 2 }));
		} finally {
			spy.mockRestore();
		}
	});
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:unit -- --run src/lib/components/ExportSection.svelte.spec.ts`
Expected: FAIL — cannot resolve `./ExportSection.svelte`.

- [ ] **Step 4: Implement `ExportSection.svelte`**

```svelte
<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { previewPresenter } from './preview-presenter.svelte';
	import { exportStatus } from '$lib/state/export-status.svelte';
	import { m } from '$lib/paraglide/messages';
	import SidebarCollapsible from './SidebarCollapsible.svelte';

	const presenter = previewPresenter;
	let includeBackground = $state(true);
	let pngScale = $state(1);
	const PNG_SCALES = [1, 2, 4];
</script>

<SidebarCollapsible>
	{#snippet trigger()}
		{m.composition_export()}
	{/snippet}

	{#snippet content()}
		<div class="flex flex-col gap-3">
			<label class="flex items-center gap-1.5 text-xs">
				<input
					type="checkbox"
					bind:checked={includeBackground}
					aria-label={m.preview_include_background()}
				/>
				{m.preview_include_background()}
			</label>

			<label class="flex items-center gap-2 text-xs">
				{m.preview_resolution()}
				<select
					aria-label={m.preview_resolution()}
					class="h-8 rounded border bg-background px-1 text-xs"
					value={pngScale}
					onchange={(e) => (pngScale = Number((e.target as HTMLSelectElement).value))}
				>
					{#each PNG_SCALES as s (s)}
						<option value={s}>{s}x</option>
					{/each}
				</select>
			</label>

			<div class="flex gap-2">
				<Button
					variant="outline"
					class="flex-1"
					disabled={exportStatus.rendering}
					onclick={() => presenter.exportSvg({ includeBackground })}
				>
					{m.preview_export_svg()}
				</Button>
				<Button
					variant="outline"
					class="flex-1"
					disabled={exportStatus.rendering}
					onclick={() => presenter.exportPng({ includeBackground, scale: pngScale })}
				>
					{m.preview_export_png()}
				</Button>
			</div>
		</div>
	{/snippet}
</SidebarCollapsible>
```

Run the Svelte MCP `svelte-autofixer` on `ExportSection.svelte` until clean.

- [ ] **Step 5: Render it in the Composition sidebar** — edit `src/routes/(app)/composition/+page.svelte`

Add the import and render it below the layout switch / kaleidoscope panel:

```svelte
<script lang="ts">
	import CanvasSection from '$lib/components/CanvasSection.svelte';
	import LayoutModeSwitch from '$lib/components/LayoutModeSwitch.svelte';
	import KaleidoscopePanel from '$lib/components/KaleidoscopePanel.svelte';
	import ExportSection from '$lib/components/ExportSection.svelte';
	import { kaleidoscope } from '$lib/state/kaleidoscope.svelte';
	import { m } from '$lib/paraglide/messages';
</script>

<svelte:head><title>{m.composition_page_title()}</title></svelte:head>

<CanvasSection />

<LayoutModeSwitch />

{#if kaleidoscope.enabled}
	<KaleidoscopePanel />
{/if}

<ExportSection />
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test:unit -- --run src/lib/components/ExportSection.svelte.spec.ts "src/routes/(app)/composition/page.svelte.spec.ts"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/ExportSection.svelte src/lib/components/ExportSection.svelte.spec.ts "src/routes/(app)/composition/+page.svelte" messages/en.json messages/it.json src/lib/paraglide
git commit -m "feat: ExportSection panel in the Composition sidebar"
```

---

### Task 6: Background-color picker edits the composition

**Files:**
- Modify: `src/lib/components/ExportSection.svelte`
- Modify: `src/lib/components/ExportSection.svelte.spec.ts`
- Modify: `messages/en.json`, `messages/it.json`

**Interfaces:**
- Consumes: `getCompositionBackgroundColor`, `setPaletteBackground`, `colorMode` (Task 2).

- [ ] **Step 1: Add messages** — edit `messages/en.json` / `messages/it.json`

en: `"composition_background_color": "Background color"`
it: `"composition_background_color": "Colore sfondo"`

Run: `npm run paraglide`

- [ ] **Step 2: Write the failing test** — add to `src/lib/components/ExportSection.svelte.spec.ts`

```ts
it('the background-color picker writes the composition palette background', async () => {
	const { setPaletteBackground, getCompositionBackgroundColor, colorMode } = await import(
		'$lib/state/composition'
	);
	colorMode.mode = 'monochrome';
	setPaletteBackground('#ffffff');

	render(ExportSection);
	const picker = page.getByLabelText('Background color');
	await expect.element(picker).toBeInTheDocument();

	(picker.element() as HTMLInputElement).value = '#123456';
	(picker.element() as HTMLInputElement).dispatchEvent(new Event('input', { bubbles: true }));

	expect(getCompositionBackgroundColor()).toBe('#123456');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:unit -- --run src/lib/components/ExportSection.svelte.spec.ts`
Expected: FAIL — no "Background color" control.

- [ ] **Step 4: Implement** — edit `src/lib/components/ExportSection.svelte`

Add to the script imports:

```svelte
	import {
		getCompositionBackgroundColor,
		setPaletteBackground,
		colorMode
	} from '$lib/state/composition';
```

Add, directly under the include-background `<label>` in the content snippet:

```svelte
<label class="flex items-center gap-2 text-xs">
	{m.composition_background_color()}
	<input
		type="color"
		aria-label={m.composition_background_color()}
		class="h-7 w-10 rounded border bg-background disabled:opacity-50"
		value={getCompositionBackgroundColor()}
		disabled={colorMode.mode !== 'monochrome'}
		oninput={(e) => setPaletteBackground((e.target as HTMLInputElement).value)}
	/>
</label>
```

Run the Svelte MCP `svelte-autofixer` on `ExportSection.svelte` until clean.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:unit -- --run src/lib/components/ExportSection.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/ExportSection.svelte src/lib/components/ExportSection.svelte.spec.ts messages/en.json messages/it.json src/lib/paraglide
git commit -m "feat: composition background-color picker in ExportSection"
```

---

### Task 7: PNG honors paper size at DPI; resolution control adapts

Under a print format the resolution control offers DPI presets and exports at the true paper pixel size; Digital keeps the scale multiplier. A live pixel readout is shown.

**Files:**
- Modify: `src/lib/components/preview-presenter.svelte.ts`
- Modify: `src/lib/components/ExportSection.svelte`
- Modify: `src/lib/components/ExportSection.svelte.spec.ts`
- Modify: `src/lib/components/preview-presenter.export.svelte.spec.ts`

**Interfaces:**
- Consumes: `printFormatPixelSize` (Task 1), `canvasFormat`, `getEffectiveCanvasProportion` (Task 2), `proportionToCanvasSize` (Task 1).
- Produces (presenter): `exportPng(opts: { includeBackground: boolean; scale?: number; size?: { width: number; height: number } }): void`

- [ ] **Step 1: Generalize `exportPng` to accept an explicit size** — edit `src/lib/components/preview-presenter.svelte.ts`

Replace the head of `exportPng`:

```ts
function exportPng(opts: {
	includeBackground: boolean;
	scale?: number;
	size?: { width: number; height: number };
}) {
	const { includeBackground } = opts;
	const p = getEffectiveCanvasProportion();
	const { width, height } =
		opts.size ?? proportionToCanvasSize(p.width, p.height, CANVAS_LONG_SIDE * (opts.scale ?? 1));
	// Padding scales with the output so framing is consistent across resolutions.
	const scale = Math.max(width, height) / CANVAS_LONG_SIDE;
	const off = document.createElement('canvas');
	off.width = width;
	off.height = height;
```

Then, in the two `pipeline!.render({... padding: 32 * scale ...})` / kaleidoscope branches inside `exportPng`, keep using this local `scale` for padding (`padding: 32 * scale`). The kaleidoscope branch already uses `width`/`height`; leave it. Remove the old `const { width, height } = ratioToCanvasSize(...)` and `const { includeBackground, scale } = opts;` destructure that this replaces.

- [ ] **Step 2: Add the presenter size test** — add to `src/lib/components/preview-presenter.export.svelte.spec.ts`

```ts
it('exportPng honors an explicit size', async () => {
	const { presenter, cleanup } = mountPresenter();
	try {
		await withCapturedDownloads(async (caught) => {
			presenter.exportPng({ includeBackground: true, size: { width: 800, height: 1000 } });
			const png = caught.find((c) => c.name === 'composition.png');
			expect(png).toBeDefined();
			const { w, h } = await dataUrlSize(png!.href);
			expect(w).toBe(800);
			expect(h).toBe(1000);
		});
	} finally {
		cleanup();
	}
});
```

- [ ] **Step 3: Run presenter test to verify it passes**

Run: `npm run test:unit -- --run src/lib/components/preview-presenter.export.svelte.spec.ts`
Expected: PASS (existing scale tests still green — `size` is optional).

- [ ] **Step 4: Write the failing ExportSection test** — add to `src/lib/components/ExportSection.svelte.spec.ts`

```ts
it('under a print format, shows DPI + computed pixels and exports at paper size', async () => {
	const { setPrintFormat, setPrintOrientation } = await import('$lib/state/composition');
	const spy = vi.spyOn(previewPresenter, 'exportPng').mockImplementation(() => {});
	setPrintFormat('a4');
	setPrintOrientation('portrait');
	try {
		render(ExportSection);
		// DPI presets replace the scale multiplier.
		await userEvent.selectOptions(page.getByLabelText('Resolution'), '300');
		await expect.element(page.getByText('2480 × 3508 px')).toBeInTheDocument();

		await userEvent.click(page.getByRole('button', { name: 'Export PNG' }));
		expect(spy).toHaveBeenCalledWith(
			expect.objectContaining({ size: { width: 2480, height: 3508 } })
		);
	} finally {
		spy.mockRestore();
		setPrintFormat(null);
	}
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npm run test:unit -- --run src/lib/components/ExportSection.svelte.spec.ts`
Expected: FAIL — no DPI presets / pixel readout / size arg.

- [ ] **Step 6: Implement adaptive resolution** — edit `src/lib/components/ExportSection.svelte`

Update the script:

```svelte
	import { previewPresenter } from './preview-presenter.svelte';
	import {
		getCompositionBackgroundColor,
		setPaletteBackground,
		colorMode,
		canvasFormat,
		getEffectiveCanvasProportion
	} from '$lib/state/composition';
	import { printFormatPixelSize } from '$lib/geometry/print-format';
	import { proportionToCanvasSize } from '$lib/geometry/aspect-ratio';
```

Add state + derived helpers:

```svelte
	const PNG_SCALES = [1, 2, 4];
	const DPI_PRESETS = [150, 300, 600];
	const BASE_LONG_SIDE = 600;
	let pngScale = $state(1);
	let dpi = $state(300);

	const pngSize = $derived.by(() => {
		if (canvasFormat.printFormat) {
			return printFormatPixelSize(canvasFormat.printFormat, canvasFormat.orientation, dpi);
		}
		const p = getEffectiveCanvasProportion();
		return proportionToCanvasSize(p.width, p.height, BASE_LONG_SIDE * pngScale);
	});

	function exportPng() {
		if (canvasFormat.printFormat) {
			presenter.exportPng({ includeBackground, size: pngSize });
		} else {
			presenter.exportPng({ includeBackground, scale: pngScale });
		}
	}
```

Replace the resolution `<label>` with a mode-adaptive one plus a readout:

```svelte
<label class="flex items-center gap-2 text-xs">
	{m.preview_resolution()}
	{#if canvasFormat.printFormat}
		<select
			aria-label={m.preview_resolution()}
			class="h-8 rounded border bg-background px-1 text-xs"
			value={dpi}
			onchange={(e) => (dpi = Number((e.target as HTMLSelectElement).value))}
		>
			{#each DPI_PRESETS as d (d)}
				<option value={d}>{d} DPI</option>
			{/each}
		</select>
	{:else}
		<select
			aria-label={m.preview_resolution()}
			class="h-8 rounded border bg-background px-1 text-xs"
			value={pngScale}
			onchange={(e) => (pngScale = Number((e.target as HTMLSelectElement).value))}
		>
			{#each PNG_SCALES as s (s)}
				<option value={s}>{s}x</option>
			{/each}
		</select>
	{/if}
</label>
<p class="text-[10px] text-muted-foreground">{pngSize.width} × {pngSize.height} px</p>
```

Point the PNG button at the new handler:

```svelte
<Button
	variant="outline"
	class="flex-1"
	disabled={exportStatus.rendering}
	onclick={exportPng}
>
	{m.preview_export_png()}
</Button>
```

Run the Svelte MCP `svelte-autofixer` on `ExportSection.svelte` until clean.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm run test:unit -- --run src/lib/components/ExportSection.svelte.spec.ts src/lib/components/preview-presenter.export.svelte.spec.ts`
Expected: PASS. (The earlier "passes the selected scale" test still holds — Digital path uses `scale`.)

- [ ] **Step 8: Full check + lint**

Run: `npm run check && npm run lint && npm run test:unit -- --run`
Expected: no errors; all unit tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/lib/components/preview-presenter.svelte.ts src/lib/components/ExportSection.svelte src/lib/components/ExportSection.svelte.spec.ts src/lib/components/preview-presenter.export.svelte.spec.ts
git commit -m "feat: PNG export at paper size/DPI with adaptive resolution control"
```

---

## Final hand-off

- List every touched file (created/modified) grouped by task.
- Report `npm run check`, `npm run lint`, `npm run test:unit -- --run` output.
- **Do NOT make the final commit / open the PR** — the user handles that ("al commit penso io"). Stop after the touched-files list.

## Self-Review notes (traceability)

- Spec D1 (print format → shape + DPI size) → Tasks 1, 2, 3, 7.
- Spec D2 (bg color edits composition) → Tasks 2, 6.
- Spec D3 (export in sidebar, shared presenter, remove from main pane) → Tasks 4, 5. (Implementation uses a **module singleton** instead of `setContext` — same "one presenter, two consumers" outcome, simpler to test; noted as an intentional refinement of the spec.)
- Static-only constraint → preserved: static paths keep `ignoreMorph`, no audio taps (Tasks 3, 7).
- Full-palette edge case (bg picker disabled) → Task 6.
- Empty-composition / kaleidoscope export guards → unchanged presenter code, covered by existing `preview-presenter.export.svelte.spec.ts`.
