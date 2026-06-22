# Editor & Animate Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PNG export with a background toggle (PNG+SVG) and a 1x/2x/4x resolution selector, and wire the existing per-ring preview into the Audio Zones section.

**Architecture:** Feature B reuses existing `RingZoneConfigItem`/`ZonePreview` (mirrors `AudioBarsSection`) plus i18n. Feature A adds an offscreen-render PNG path and a background-toggle parameter to the presenter's export functions, wired to new `PreviewCanvas` controls.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript, paper.js, paraglide i18n, Vitest (`vitest/browser` component tests), bun.

## Global Constraints

- Package manager **bun**. Single spec: `bun run test:unit -- run <path>`. Full unit: `bun run test:unit -- run`. Types: `bun run check`.
- Tab indentation (NOT spaces).
- Every touched `.svelte` / `.svelte.ts` MUST pass the Svelte MCP `svelte-autofixer` with `issues: []` (ignore known false-positive *suggestions* only: rAF-inside-`$effect`, "stateful var assigned in `$effect`", `bind:this`→attachment).
- New message keys MUST be added to BOTH `messages/en.json` and `messages/it.json` (the `messages-parity` test enforces identical key sets). Paraglide recompiles on `bun run check`; a first run after editing `messages/*.json` can transiently fail — rerun.
- Component tests run in a real browser; Tailwind NOT loaded — assert structure/testid/ARIA/text/geometry, not Tailwind visuals. Specs asserting English UI call `switchLocale('en')` in `beforeEach`.
- Commit trailer EXACTLY: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Do NOT run `prettier --write .` or `bun run lint` (pre-existing red, not a gate).
- Spec: `docs/superpowers/specs/2026-06-22-editor-animate-features-design.md`.

---

### Task 1: Feature B — Audio Zones per-ring preview + i18n

**Files:**
- Modify: `messages/en.json`, `messages/it.json` (add 5 keys)
- Modify: `src/lib/components/RingZoneConfigItem.svelte` (i18n + root testid)
- Modify: `src/lib/components/AudioZonesSection.svelte` (wire per-ring block)
- Test: `src/lib/components/AudioZonesSection.svelte.spec.ts`

**Interfaces:**
- Consumes: `RingZoneConfigItem` props `{ ring: Ring; index: number; globalDefault: ZoneIntensity }`; `animationState.audioZones.defaultIntensity` (type `ZoneIntensity = { bass; mid; treble }`); `composition.rings`.
- Produces: `RingZoneConfigItem` root carries `data-testid="ring-zone-config-{index}"`; `AudioZonesSection` renders one per ring under the global band sliders.

- [ ] **Step 1: Add the 5 message keys (EN)**

In `messages/en.json`, after the line `"animate_customize_wave": "Customize wave for this ring",` add:

```json
	"animate_zones_per_ring": "Per-ring intensity",
	"animate_customize_zones": "Customize zones for this ring",
	"animate_zone_bass": "Bass intensity",
	"animate_zone_mid": "Mid intensity",
	"animate_zone_treble": "Treble intensity",
```

- [ ] **Step 2: Add the 5 message keys (IT)**

In `messages/it.json`, after the matching `"animate_customize_wave": ...` line add:

```json
	"animate_zones_per_ring": "Intensità per anello",
	"animate_customize_zones": "Personalizza le zone per questo anello",
	"animate_zone_bass": "Intensità bassi",
	"animate_zone_mid": "Intensità medi",
	"animate_zone_treble": "Intensità alti",
```

- [ ] **Step 3: Recompile + verify parity**

Run: `bun run check`
Expected: paraglide recompiles, 0 errors. Then `bun run test:unit -- run src/lib/messages-parity.spec.ts` → PASS (en and it key sets identical).

- [ ] **Step 4: Write the failing test (zones renders per-ring + i18n)**

Add to `src/lib/components/AudioZonesSection.svelte.spec.ts`, inside the existing `describe('AudioZonesSection', ...)` block. The composition default ships 4 rings, so assert at least one per-ring item plus the section header and a translated label.

```ts
	it('renders a per-ring zone config (with preview) for each ring', async () => {
		render(AudioZonesSection);
		await expect.element(page.getByTestId('ring-zone-config-0')).toBeInTheDocument();
		await expect.element(page.getByText('Per-ring intensity')).toBeInTheDocument();
	});

	it('shows the per-ring zone copy in Italian', async () => {
		switchLocale('it');
		render(AudioZonesSection);
		await expect.element(page.getByText('Intensità per anello')).toBeInTheDocument();
		switchLocale('en');
	});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/components/AudioZonesSection.svelte.spec.ts`
Expected: FAIL — `ring-zone-config-0` not found and "Per-ring intensity" text absent (section not wired yet).

- [ ] **Step 6: i18n `RingZoneConfigItem` + add root testid**

In `src/lib/components/RingZoneConfigItem.svelte`:

Add the messages import after the existing imports (below `import { resolveZoneIntensity } from '$lib/geometry/zones';`):

```svelte
	import { m } from '$lib/paraglide/messages';
```

Add the testid to the root element — change `<div class="rounded border bg-background">` to:

```svelte
<div class="rounded border bg-background" data-testid="ring-zone-config-{index}">
```

Replace the hardcoded `Ring {index + 1}` line with:

```svelte
					{m.editor_ring_label({ index: index + 1 })}
```

Replace the `(custom)` badge text `>(custom)</span>` with:

```svelte
						>{m.animate_custom()}</span
					>
```

Replace `>Customize zones for this ring</Label>` with:

```svelte
					>{m.animate_customize_zones()}</Label
				>
```

Replace the three intensity labels:
- `>Bass intensity</Label>` → `>{m.animate_zone_bass()}</Label>`
- `>Mid intensity</Label>` → `>{m.animate_zone_mid()}</Label>`
- `>Treble intensity</Label>` → `>{m.animate_zone_treble()}</Label>`

- [ ] **Step 7: Wire the per-ring block into `AudioZonesSection`**

In `src/lib/components/AudioZonesSection.svelte`:

Add imports — add `composition` to the composition import (or add a new import line) and import the item component. After `import AnimatableSlider from './AnimatableSlider.svelte';` add:

```svelte
	import RingZoneConfigItem from './RingZoneConfigItem.svelte';
	import { composition } from '$lib/state/composition';
```

After the global band-intensity block (the `<div class="flex flex-col gap-2">` that ends after the `{#each zonesParams ...}` loop and its closing `</div>`), add a per-ring block:

```svelte
				<div class="flex flex-col gap-1">
					<p class="text-[11px] font-medium text-muted-foreground">
						{m.animate_zones_per_ring()}
					</p>
					{#each composition.rings as ring, i (i)}
						<RingZoneConfigItem
							{ring}
							index={i}
							globalDefault={animationState.audioZones.defaultIntensity}
						/>
					{/each}
				</div>
```

- [ ] **Step 8: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/components/AudioZonesSection.svelte.spec.ts`
Expected: PASS (all tests).

- [ ] **Step 9: Run svelte-autofixer**

Run the Svelte MCP `svelte-autofixer` on `RingZoneConfigItem.svelte` and `AudioZonesSection.svelte`. Confirm `issues: []` for both.

- [ ] **Step 10: Commit**

```bash
git add messages/en.json messages/it.json src/lib/components/RingZoneConfigItem.svelte src/lib/components/AudioZonesSection.svelte src/lib/components/AudioZonesSection.svelte.spec.ts
git commit -m "feat(animate): per-ring zone preview in Audio Zones + i18n

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Feature A (presenter) — background toggle + PNG export

**Files:**
- Modify: `src/lib/components/preview-presenter.svelte.ts` (`exportSvg`, `kaleidoParams`, new `exportPng`, new download helper, return surface)
- Test: `src/lib/components/PreviewCanvas.svelte.spec.ts`

**Interfaces:**
- Consumes: `pipeline.render({ composition, scope, ignoreMorph, viewport, restFit })`; `renderTile(): HTMLCanvasElement`; `renderKaleidoscopeToCanvas(ctx, tile, tileW, tileH, params, frame)`; `ratioToCanvasSize(aspectRatio, longSide)`; `getCompositionBackgroundColor()`; module constants `CANVAS_LONG_SIDE`, `REST_FRACTION`; `kaleidoscope` state.
- Produces: presenter return surface gains `exportPng(opts: { includeBackground: boolean; scale: number }): void`; `exportSvg` signature becomes `exportSvg(opts?: { includeBackground?: boolean }): void` (defaults to `includeBackground: true`, preserving the no-arg call). Flat PNG → `composition.png`, kaleidoscope PNG → `kaleidoscope.png`.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/components/PreviewCanvas.svelte.spec.ts`, inside the existing `describe('PreviewCanvas.svelte', ...)` block. These call the presenter through the component once it exposes the controls — but to test the presenter logic directly here, drive it via the rendered buttons added in Task 3. To keep Task 2 self-contained, test the presenter's exported functions through a direct unit on the module instead:

Create a NEW test file `src/lib/components/preview-presenter.export.svelte.spec.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createPreviewPresenter } from './preview-presenter.svelte';
import { composition, setAspectRatio } from '$lib/state/composition';
import { setKaleidoscopeEnabled } from '$lib/state/kaleidoscope.svelte';

// Capture downloads: PNG sets anchor.href to a data: URL; SVG sets it to a blob: URL
// created from a Blob we capture via URL.createObjectURL.
function withCapturedDownloads(fn: (caught: { href: string; name: string }[], blobs: Blob[]) => Promise<void>) {
	const caught: { href: string; name: string }[] = [];
	const blobs: Blob[] = [];
	const origClick = HTMLAnchorElement.prototype.click;
	const origCreate = URL.createObjectURL;
	HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
		caught.push({ href: this.href, name: this.download });
	};
	URL.createObjectURL = ((b: Blob) => {
		blobs.push(b);
		return 'blob:mock';
	}) as typeof URL.createObjectURL;
	return Promise.resolve(fn(caught, blobs)).finally(() => {
		HTMLAnchorElement.prototype.click = origClick;
		URL.createObjectURL = origCreate;
	});
}

function mountPresenter() {
	const canvas = document.createElement('canvas');
	canvas.width = 600;
	canvas.height = 600;
	document.body.appendChild(canvas);
	const presenter = createPreviewPresenter();
	const cleanup = presenter.attach(canvas);
	return { presenter, canvas, cleanup };
}

async function dataUrlSize(dataUrl: string): Promise<{ w: number; h: number }> {
	const img = new Image();
	await new Promise((res, rej) => {
		img.onload = res;
		img.onerror = rej;
		img.src = dataUrl;
	});
	return { w: img.naturalWidth, h: img.naturalHeight };
}

describe('preview-presenter export', () => {
	beforeEach(() => {
		setAspectRatio('1:1');
		composition.rings = [
			{
				copies: 4,
				color: '#000000',
				templatePath: { cmds: ['M', 'L', 'L', 'L', 'Z'], crds: [0, 0, 100, 0, 100, 50, 0, 50] },
				secondaryTemplatePath: null,
				morphT: 0,
				ringHeight: 0.25
			}
		];
	});
	afterEach(() => {
		setKaleidoscopeEnabled(false);
		setAspectRatio('1:1');
	});

	it('exports a PNG named composition.png in flat mode', async () => {
		const { presenter, cleanup } = mountPresenter();
		await withCapturedDownloads(async (caught) => {
			presenter.exportPng({ includeBackground: true, scale: 1 });
			expect(caught.some((c) => c.name === 'composition.png')).toBe(true);
		});
		cleanup();
	});

	it('PNG resolution scale changes the exported pixel dimensions', async () => {
		const { presenter, cleanup } = mountPresenter();
		await withCapturedDownloads(async (caught) => {
			presenter.exportPng({ includeBackground: true, scale: 2 });
			const png = caught.find((c) => c.name === 'composition.png')!;
			const { w, h } = await dataUrlSize(png.href);
			expect(Math.max(w, h)).toBe(1200); // 600 long side × 2
		});
		cleanup();
	});

	it('flat SVG with background off omits the preview-background rect', async () => {
		const { presenter, cleanup } = mountPresenter();
		await withCapturedDownloads(async (_caught, blobs) => {
			presenter.exportSvg({ includeBackground: false });
			const text = await blobs[blobs.length - 1].text();
			expect(text).not.toContain('preview-background');
		});
		cleanup();
	});

	it('flat SVG with background on keeps the preview-background rect', async () => {
		const { presenter, cleanup } = mountPresenter();
		await withCapturedDownloads(async (_caught, blobs) => {
			presenter.exportSvg({ includeBackground: true });
			const text = await blobs[blobs.length - 1].text();
			expect(text).toContain('preview-background');
		});
		cleanup();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test:unit -- run src/lib/components/preview-presenter.export.svelte.spec.ts`
Expected: FAIL — `presenter.exportPng` is not a function; `exportSvg` ignores the arg.

- [ ] **Step 3: Add a data-URL download helper**

In `src/lib/components/preview-presenter.svelte.ts`, next to the existing `downloadSvg` function, add:

```ts
	function downloadDataUrl(dataUrl: string, filename: string) {
		const a = document.createElement('a');
		a.href = dataUrl;
		a.download = filename;
		a.click();
	}
```

- [ ] **Step 4: Make `kaleidoParams` accept a `drawBackground` override**

Replace the existing `kaleidoParams` function with:

```ts
	function kaleidoParams(overrides?: { drawBackground?: boolean }) {
		const base = { ...kaleidoscope, backgroundColor: getCompositionBackgroundColor() };
		return overrides?.drawBackground === undefined
			? base
			: { ...base, drawBackground: overrides.drawBackground };
	}
```

- [ ] **Step 5: Add `includeBackground` to `exportSvg` (flat + kaleidoscope)**

Replace `exportKaleidoscopeSvg` and `exportSvg` with:

```ts
	function exportKaleidoscopeSvg(includeBackground: boolean) {
		ensureTileScope();
		renderTile();
		tileScope!.activate();
		const tileSvg = tileScope!.project.exportSVG({ asString: true }) as string;
		const frame = canvasEl
			? { width: canvasEl.width, height: canvasEl.height }
			: { width: TILE_PX, height: TILE_PX };
		const params = kaleidoParams({
			drawBackground: includeBackground ? kaleidoscope.drawBackground : false
		});
		downloadSvg(generateKaleidoscopeSVG(tileSvg, params, frame), 'kaleidoscope.svg');
	}

	function exportSvg(opts?: { includeBackground?: boolean }) {
		const includeBackground = opts?.includeBackground ?? true;

		// In kaleidoscope mode the visible canvas IS the kaleidoscope, so Export SVG
		// exports the kaleidoscope render; otherwise it exports the flat composition.
		if (kaleidoscope.enabled) {
			exportKaleidoscopeSvg(includeBackground);
			return;
		}

		if (!scope) return;
		const layer = scope.project.activeLayer;
		const hasContent = layer.children.some((child) => child.name !== 'preview-background');
		if (!hasContent) return;

		scope.activate();
		// Background off: drop the tagged rect for the duration of the serialization, then
		// re-insert it at the back. Synchronous and no view.update() → the visible canvas
		// never repaints, so this cannot flicker.
		const bg = includeBackground
			? null
			: (layer.children.find((c) => c.name === 'preview-background') ?? null);
		if (bg) bg.remove();
		const svgData = scope.project.exportSVG({ asString: true }) as string;
		if (bg) {
			layer.addChild(bg);
			bg.sendToBack();
		}
		downloadSvg(svgData, 'composition.svg');
	}
```

- [ ] **Step 6: Add `exportPng`**

Add this function next to `exportSvg`:

```ts
	function exportPng(opts: { includeBackground: boolean; scale: number }) {
		const { includeBackground, scale } = opts;
		const { width, height } = ratioToCanvasSize(composition.aspectRatio, CANVAS_LONG_SIDE * scale);
		const off = document.createElement('canvas');
		off.width = width;
		off.height = height;

		if (kaleidoscope.enabled) {
			const ctx = off.getContext('2d');
			if (!ctx) return;
			const tile = renderTile();
			const params = kaleidoParams({
				drawBackground: includeBackground ? kaleidoscope.drawBackground : false
			});
			renderKaleidoscopeToCanvas(ctx, tile, tile.width, tile.height, params, { width, height });
			downloadDataUrl(off.toDataURL('image/png'), 'kaleidoscope.png');
			return;
		}

		// Flat: render the composition into an offscreen paper scope at the scaled size so
		// the PNG is independent of the visible canvas (no flicker, free resolution scaling).
		// The offscreen canvas starts transparent → background off yields a transparent PNG.
		const tempScope = new paper.PaperScope();
		tempScope.setup(off);
		const ignoreMorph = animationState.layers.audioBars || animationState.layers.audioZones;
		const restFit = animationState.layers.audioZones ? { fraction: REST_FRACTION } : undefined;
		pipeline!.render({
			composition,
			scope: tempScope,
			ignoreMorph,
			viewport: { width, height, padding: 32 * scale },
			restFit
		});
		if (includeBackground) {
			tempScope.activate();
			const background = new paper.Path.Rectangle(tempScope.view.bounds);
			background.fillColor = new paper.Color(getCompositionBackgroundColor());
			background.sendToBack();
		}
		tempScope.view.update();
		downloadDataUrl(off.toDataURL('image/png'), 'composition.png');
		tempScope.project.clear();
	}
```

- [ ] **Step 7: Export the new function**

In the presenter's `return { ... }` object, add `exportPng` next to `exportSvg`:

```ts
	return {
		attach,
		exportSvg,
		exportPng,
		exportAnimation,
		get exportProgress() {
			return exportProgress;
		},
		animationExportSupported: isAnimationExportSupported()
	};
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `bun run test:unit -- run src/lib/components/preview-presenter.export.svelte.spec.ts`
Expected: PASS (all 4 tests).

- [ ] **Step 9: Confirm existing PreviewCanvas tests still pass**

Run: `bun run test:unit -- run src/lib/components/PreviewCanvas.svelte.spec.ts`
Expected: PASS — `exportSvg` called with no args still behaves as before (background on), `composition.svg` / `kaleidoscope.svg` downloads unchanged.

- [ ] **Step 10: Run svelte-autofixer**

Run the Svelte MCP `svelte-autofixer` on `preview-presenter.svelte.ts`. Confirm `issues: []`.

- [ ] **Step 11: Commit**

```bash
git add src/lib/components/preview-presenter.svelte.ts src/lib/components/preview-presenter.export.svelte.spec.ts
git commit -m "feat(export): PNG export + background toggle in the preview presenter

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Feature A (UI) — PreviewCanvas controls

**Files:**
- Modify: `messages/en.json`, `messages/it.json` (3 keys)
- Modify: `src/lib/components/PreviewCanvas.svelte`
- Test: `src/lib/components/PreviewCanvas.svelte.spec.ts`

**Interfaces:**
- Consumes: `presenter.exportPng({ includeBackground, scale })` and `presenter.exportSvg({ includeBackground })` from Task 2; `exportStatus.rendering`.
- Produces: an "Export PNG" button, an "Include background" checkbox (`includeBackground`, default true), and a resolution `<select>` (values 1/2/4), all visible on both routes; both export buttons disabled while `exportStatus.rendering`.

- [ ] **Step 1: Add the 3 message keys (EN then IT)**

In `messages/en.json`, after `"preview_export_svg": ...` add:

```json
	"preview_export_png": "Export PNG",
	"preview_include_background": "Include background",
	"preview_resolution": "Resolution",
```

In `messages/it.json`, after the matching `"preview_export_svg": ...` add:

```json
	"preview_export_png": "Esporta PNG",
	"preview_include_background": "Includi sfondo",
	"preview_resolution": "Risoluzione",
```

- [ ] **Step 2: Recompile + parity**

Run: `bun run check` then `bun run test:unit -- run src/lib/messages-parity.spec.ts`
Expected: 0 errors; parity PASS.

- [ ] **Step 3: Write the failing test**

Add to `src/lib/components/PreviewCanvas.svelte.spec.ts` (inside the describe block):

```ts
	it('shows the PNG export controls on both routes', async () => {
		render(PreviewCanvas);
		await expect.element(page.getByRole('button', { name: 'Export PNG' })).toBeInTheDocument();
		await expect.element(page.getByLabelText('Include background')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Resolution')).toBeInTheDocument();
	});

	it('triggers a PNG download when Export PNG is clicked', async () => {
		const downloads: string[] = [];
		const origClick = HTMLAnchorElement.prototype.click;
		HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
			downloads.push(this.download);
		};
		try {
			render(PreviewCanvas);
			await vi.waitFor(() => expect(lastRenderedScope).toBeDefined());
			await userEvent.click(page.getByRole('button', { name: 'Export PNG' }));
			expect(downloads).toContain('composition.png');
		} finally {
			HTMLAnchorElement.prototype.click = origClick;
		}
	});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/components/PreviewCanvas.svelte.spec.ts`
Expected: FAIL — Export PNG button / Include background / Resolution controls not present.

- [ ] **Step 5: Implement the controls**

In `src/lib/components/PreviewCanvas.svelte`, add component state in the `<script>` (after the `progressPercent` derived):

```svelte
	let includeBackground = $state(true);
	let pngScale = $state(1);
	const PNG_SCALES = [1, 2, 4];
```

Update the SVG button to pass the toggle, and add the PNG button + controls. Replace the existing button row block:

```svelte
		<div class="flex gap-2">
			<Button
				variant="outline"
				onclick={() => presenter.exportSvg({ includeBackground })}
				disabled={exportStatus.rendering}
				class="flex-1"
			>
				{m.preview_export_svg()}
			</Button>
			<Button
				variant="outline"
				onclick={() => presenter.exportPng({ includeBackground, scale: pngScale })}
				disabled={exportStatus.rendering}
				class="flex-1"
			>
				{m.preview_export_png()}
			</Button>
			{#if animate}
				<Button
					variant="outline"
					onclick={presenter.exportAnimation}
					disabled={exportStatus.rendering || !presenter.animationExportSupported}
					class="flex-1"
				>
					{m.preview_export_animation()}
				</Button>
			{/if}
		</div>

		<div class="flex items-center gap-3 text-xs text-muted-foreground">
			<label class="flex items-center gap-1.5">
				<input type="checkbox" bind:checked={includeBackground} aria-label={m.preview_include_background()} />
				{m.preview_include_background()}
			</label>
			<label class="flex items-center gap-1.5">
				{m.preview_resolution()}
				<select
					aria-label={m.preview_resolution()}
					class="h-7 rounded border bg-background py-1 text-xs"
					value={pngScale}
					onchange={(e) => (pngScale = Number((e.target as HTMLSelectElement).value))}
				>
					{#each PNG_SCALES as s (s)}
						<option value={s}>{s}x</option>
					{/each}
				</select>
			</label>
		</div>
```

(The existing progress bar and unsupported-export blocks below stay unchanged.)

- [ ] **Step 6: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/components/PreviewCanvas.svelte.spec.ts`
Expected: PASS (all tests).

- [ ] **Step 7: Run svelte-autofixer**

Run the Svelte MCP `svelte-autofixer` on `PreviewCanvas.svelte`. Confirm `issues: []`.

- [ ] **Step 8: Commit**

```bash
git add messages/en.json messages/it.json src/lib/components/PreviewCanvas.svelte src/lib/components/PreviewCanvas.svelte.spec.ts
git commit -m "feat(export): Export PNG button, background toggle, and resolution selector

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Type check** — Run: `bun run check` → Expected: 0 errors.
- [ ] **Step 2: Full unit suite** — Run: `bun run test:unit -- run` → Expected: all pass (≥ 438 + the new tests).
- [ ] **Step 3: e2e** — Run: `bunx playwright test` → Expected: 6/6 (builds first, ~25-35s; the pre-existing `"file" is not a known CSS property` warning is harmless).
- [ ] **Step 4: Live verification (manual)** — controller confirms in a real browser: Export PNG downloads at 1x/2x/4x; "Include background" off → transparent PNG; toggle also affects SVG; both flat and kaleidoscope modes; Audio Zones shows a per-ring preview per ring. Document results.

## Self-Review

**Spec coverage:**
- Feature A UI (PNG button, include-background checkbox, 1x/2x/4x select, both routes) → Task 3. ✓
- Feature A presenter (`exportSvg({includeBackground})`, `exportPng({includeBackground,scale})`, flat+kaleidoscope bg handling, offscreen render, transparency, filenames) → Task 2. ✓
- Feature B (wire `RingZoneConfigItem`+`ZonePreview` into `AudioZonesSection` with `defaultIntensity`, i18n 5 keys) → Task 1. ✓
- Testing notes (SVG string assertions, PNG filename+scale, zones per-ring+i18n, parity, gates) → Tasks 1–4. ✓
- Out-of-scope (morph relocation, tileBackground semantics, batch export) → excluded. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to". Full code in every code step. ✓

**Type consistency:** `exportPng({ includeBackground: boolean; scale: number })` and `exportSvg(opts?: { includeBackground?: boolean })` consistent across Tasks 2 and 3. `RingZoneConfigItem` props `{ ring, index, globalDefault }` match `animationState.audioZones.defaultIntensity` (ZoneIntensity). Message keys identical between the EN/IT add steps. `kaleidoParams(overrides?)` used consistently in `exportSvg`/`exportPng`. ✓
