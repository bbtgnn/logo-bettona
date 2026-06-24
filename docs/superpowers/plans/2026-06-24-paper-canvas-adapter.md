# paperCanvas Lifecycle Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Concentrate the duplicated paper.js scope lifecycle (create → setup → activate → reactive redraw → guaranteed teardown) behind one `paperCanvas` attachment, adopted by the four preview components, and dedup their fit-to-view math — fixing the leaky/inconsistent teardown and the RingMorphPreview double-render-on-mount.

**Architecture:** A Svelte 5 attachment factory `paperCanvas(draw, opts?)` owns the scope lifecycle: `new PaperScope()` + `setup(canvas)`, a single `$effect` that activates the scope and calls the caller's `draw(scope)` (auto-tracking whatever reactive state draw reads → redraw on change), and a teardown that runs an optional caller `dispose` then `scope.project.clear()` + `scope.view.remove()`. The render BODY stays per-component (some use `pipeline.render`, some `buildRingPath` directly — legitimately different). A separate pure `computeFitToView` + thin `fitPreviewToView(scope, padding)` dedup the fit math copied verbatim in WavePreview and ZonePreview. The preview-presenter (its own main+tile scopes, exports, kaleidoscope rAF) and the interactive RingCanvas are OUT of scope. Per-component error/empty markup is kept as-is (preserves UX + the `data-testid`s the specs assert).

**Tech Stack:** SvelteKit + Svelte 5 runes + attachments, TypeScript, paper.js, bun, vitest (+ vitest-browser-svelte for components).

## Global Constraints

- Package manager **bun**. Types: `bun run check` (recompiles paraglide; must be 0 errors / 0 warnings). Single unit spec: `bun run test:unit -- run <path>`. Full unit: `bun run test:unit -- run`.
- **TAB indentation** everywhere. No `prettier --write .` / `bun run lint` (pre-existing red — not a gate).
- Commit trailer EXACTLY: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Every changed `.svelte` / `.svelte.ts` MUST pass the Svelte MCP `svelte-autofixer` → `issues: []` (load via ToolSearch `select:mcp__svelte__svelte-autofixer`). Ignore known false-positive *suggestions* (function-call/rAF inside `$effect`, `bind:this`→attachment, "svelte-ignore … not warned").
- No new user-facing copy → no `messages/*.json` changes.
- **Behavior + markup preservation:** every component keeps its existing `data-testid`s, its error/empty fallback markup and UX, the explicit canvas CSS size where present, and any rAF loop (WavePreview phase, RingMorphPreview Try). Only the scope-lifecycle plumbing changes.
- **Adapter teardown must call `scope.project.clear()` AND `scope.view.remove()`** (today some previews omit `view.remove()` — that is the leak being fixed) plus any caller-provided `dispose` (e.g. `pipeline.dispose()`, `cancelAnimationFrame`).
- Component tests run in a REAL browser (vitest-browser-svelte); Tailwind inert — assert DOM/testid/role/text, not geometry.

---

### Task 1: Pure `computeFitToView`

**Files:**
- Create: `src/lib/geometry/fit-to-view.ts`
- Create: `src/lib/geometry/fit-to-view.spec.ts`

**Interfaces:**
- Produces: `computeFitToView(bounds: { width: number; height: number }, viewSize: { width: number; height: number }, padding: number): number | null` — the uniform scale to fit `bounds` into `viewSize` minus padding, or `null` when nothing should scale (degenerate bounds or no available space). Task 2's `fitPreviewToView` consumes it.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/geometry/fit-to-view.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeFitToView } from './fit-to-view';

const view = { width: 200, height: 200 };

describe('computeFitToView', () => {
	it('returns the scale that fits the larger bound into the padded view', () => {
		// available = min(200,200) - 14*2 = 172; larger bound = 100 → 1.72
		expect(computeFitToView({ width: 100, height: 50 }, view, 14)).toBeCloseTo(1.72, 5);
	});

	it('uses the larger of width/height as the divisor', () => {
		expect(computeFitToView({ width: 40, height: 80 }, view, 0)).toBeCloseTo(200 / 80, 5);
	});

	it('returns null for a degenerate bound (zero width or height)', () => {
		expect(computeFitToView({ width: 0, height: 50 }, view, 14)).toBeNull();
		expect(computeFitToView({ width: 50, height: 0 }, view, 14)).toBeNull();
	});

	it('returns null when padding leaves no available space', () => {
		expect(computeFitToView({ width: 50, height: 50 }, { width: 20, height: 20 }, 14)).toBeNull();
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test:unit -- run src/lib/geometry/fit-to-view.spec.ts`
Expected: FAIL — cannot resolve `./fit-to-view`.

- [ ] **Step 3: Implement**

Create `src/lib/geometry/fit-to-view.ts`:

```ts
/**
 * Uniform scale to fit `bounds` into `viewSize` minus `padding` on every side.
 * Returns null when there is nothing to fit — a degenerate bound (zero width or
 * height) or a view with no available space after padding. Pure: the caller
 * applies the scale to a paper layer (see fitPreviewToView).
 */
export function computeFitToView(
	bounds: { width: number; height: number },
	viewSize: { width: number; height: number },
	padding: number
): number | null {
	if (bounds.width === 0 || bounds.height === 0) return null;
	const available = Math.min(viewSize.width, viewSize.height) - padding * 2;
	if (available <= 0) return null;
	return available / Math.max(bounds.width, bounds.height);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `bun run test:unit -- run src/lib/geometry/fit-to-view.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Verify types**

Run: `bun run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Commit**

```bash
git add src/lib/geometry/fit-to-view.ts src/lib/geometry/fit-to-view.spec.ts
git commit -m "feat(geometry): add pure computeFitToView (fit-scale math)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `paperCanvas` adapter + `fitPreviewToView`, adopted in RingPreview

**Files:**
- Create: `src/lib/components/paper-canvas.svelte.ts`
- Modify: `src/lib/components/RingPreview.svelte` (onMount/bind:this → `{@attach paperCanvas(...)}`)
- Test: `src/lib/components/RingPreview.svelte.spec.ts` (existing — the regression net; should pass unchanged)

**Interfaces:**
- Consumes: `computeFitToView` (Task 1).
- Produces:
  - `paperCanvas(draw: (scope: paper.PaperScope) => void, opts?: { dispose?: () => void }): (canvas: HTMLCanvasElement) => () => void` — a Svelte attachment. Creates + sets up a `PaperScope`, registers a `$effect` that calls `scope.activate()` then `draw(scope)` (redraws when draw's reactive deps change), and on teardown runs `opts.dispose?.()` then `scope.project.clear()` + `scope.view.remove()`.
  - `fitPreviewToView(scope: paper.PaperScope, padding?: number): void` — unions the active layer bounds, computes the scale via `computeFitToView`, and applies scale + recenters; no-op when nothing to fit. Default padding 14.

- [ ] **Step 1: Create the adapter module**

Create `src/lib/components/paper-canvas.svelte.ts`:

```ts
import paper from 'paper';
import { computeFitToView } from '$lib/geometry/fit-to-view';

/**
 * Svelte attachment owning a preview's paper.js scope lifecycle. Creates the
 * scope, sets it up on the canvas, and registers a single $effect that activates
 * the scope and runs `draw(scope)` — the effect re-tracks whatever reactive state
 * `draw` reads, so the preview redraws when its inputs change. On teardown it runs
 * the caller's optional `dispose` (e.g. pipeline.dispose / cancelAnimationFrame)
 * then clears the project and removes the view — the guaranteed, leak-free cleanup
 * every preview needs in one place.
 *
 * The render BODY stays in `draw`: some previews call pipeline.render, others
 * buildRingPath directly — legitimately different, so the adapter owns only the
 * scope seam, not what gets drawn.
 */
export function paperCanvas(
	draw: (scope: paper.PaperScope) => void,
	opts?: { dispose?: () => void }
): (canvas: HTMLCanvasElement) => () => void {
	return (canvas) => {
		const scope = new paper.PaperScope();
		scope.setup(canvas);
		$effect(() => {
			scope.activate();
			draw(scope);
		});
		return () => {
			opts?.dispose?.();
			scope.project.clear();
			scope.view.remove();
		};
	};
}

/**
 * Fits the active layer into the view, leaving `padding` px on every side. No-op
 * when there is nothing to fit. Replaces the fitToView copied verbatim in the
 * buildRingPath-based previews (Wave, Zone).
 */
export function fitPreviewToView(scope: paper.PaperScope, padding = 14): void {
	const items = scope.project.activeLayer.children;
	if (items.length === 0) return;
	let bounds = items[0].bounds.clone();
	for (let i = 1; i < items.length; i++) bounds = bounds.unite(items[i].bounds);
	const scale = computeFitToView(bounds, scope.view.size, padding);
	if (scale === null) return;
	scope.project.activeLayer.scale(scale, bounds.center);
	scope.project.activeLayer.position = scope.view.center;
}
```

- [ ] **Step 2: Run the autofixer on the new module**

Load `mcp__svelte__svelte-autofixer` via ToolSearch and run it on the full text of `paper-canvas.svelte.ts` (filename `paper-canvas.svelte.ts`). Apply fixes until `issues: []` (ignore the known false-positive suggestion about a function call inside `$effect`).

- [ ] **Step 3: Adopt in RingPreview**

Rewrite `src/lib/components/RingPreview.svelte` so the scope lifecycle goes through the attachment. Replace the `<script>` body's `onMount` + `bind:this` machinery, keeping the composition build, the `hasError` state, and the markup/testids. The new script:

```svelte
<script lang="ts">
	import type { Composition, Path } from '$lib/types';
	import { createRenderPipeline } from '$lib/geometry/render-pipeline';
	import { paperCanvas } from './paper-canvas.svelte';

	let {
		path,
		secondaryPath = null,
		copies = 8,
		baseRadius,
		ringIncrement,
		morphT = 0,
		size = 280
	}: {
		path: Path;
		secondaryPath?: Path | null;
		copies?: number;
		baseRadius: number;
		ringIncrement: number;
		morphT?: number;
		size?: number;
	} = $props();

	let hasError = $state(false);
	const pipeline = createRenderPipeline();

	function draw(scope: import('paper').PaperScope) {
		const composition: Composition = {
			baseRadius,
			ringIncrement,
			aspectRatio: '1:1',
			rings: [
				{
					id: 'ring-preview-ring',
					copies,
					color: '#000000',
					templatePath: path,
					secondaryTemplatePath: secondaryPath ?? null,
					morphT,
					ringHeight: 0.12
				}
			],
			monochromePalettes: [{ primary: '#000000', secondary: '#ffffff', background: '#ffffff' }],
			fullPalettes: []
		};
		try {
			scope.project.clear();
			pipeline.render({ composition, scope, viewport: { width: size, height: size, padding: 20 } });
			hasError = false;
		} catch {
			hasError = true;
		}
	}
</script>

{#if hasError}
	<div
		style:width="{size}px"
		style:height="{size}px"
		class="flex items-center justify-center border border-dashed text-sm text-muted-foreground"
		data-testid="ring-preview-placeholder"
	>
		?
	</div>
{:else}
	<canvas
		{@attach paperCanvas(draw, { dispose: () => pipeline.dispose() })}
		width={size}
		height={size}
		aria-hidden="true"
		data-testid="ring-preview-canvas"
	></canvas>
{/if}
```

(Behavior parity: the canvas mounts with `hasError` false → the attachment's `$effect` runs `draw` once → renders. On a pipeline throw, `hasError` flips true, the canvas unmounts → attachment teardown runs `pipeline.dispose()` + scope cleanup, and the placeholder shows. On component unmount with a valid path, teardown runs `pipeline.dispose()` — satisfying the spec's dispose assertion.)

- [ ] **Step 4: Run the autofixer on RingPreview**

Run `svelte-autofixer` on the full text of `RingPreview.svelte` until `issues: []`.

- [ ] **Step 5: Run the RingPreview spec + types**

Run: `bun run test:unit -- run src/lib/components/RingPreview.svelte.spec.ts`
Expected: PASS — canvas testid present for a valid path; placeholder + "?" when the pipeline rejects; `pipeline.dispose` called on unmount.
Run: `bun run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/paper-canvas.svelte.ts src/lib/components/RingPreview.svelte
git commit -m "feat(preview): paperCanvas attachment owns scope lifecycle; RingPreview adopts it

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: RingMorphPreview adopts `paperCanvas`

**Files:**
- Modify: `src/lib/components/RingMorphPreview.svelte`
- Test: `src/lib/components/RingMorphPreview.svelte.spec.ts` (existing — regression net)

**Interfaces:**
- Consumes: `paperCanvas` (Task 2).

- [ ] **Step 1: Adopt the attachment, remove the double-render-on-mount**

Rewrite `src/lib/components/RingMorphPreview.svelte`'s scope machinery to use `paperCanvas`. Remove the module-level `scope`/`onMount`/the separate redraw `$effect` (the adapter's `$effect` is the single redraw now — this eliminates the double render on mount). Keep: the `pipeline`, `hasError`, the Try-loop state (`playing`, `playT`, `rafId`), `effectiveMorphT`, the Try button + handlers, and ALL markup/testids/CSS sizes. New script:

```svelte
<script lang="ts">
	import type { Composition, Path } from '$lib/types';
	import { createRenderPipeline } from '$lib/geometry/render-pipeline';
	import { paperCanvas } from './paper-canvas.svelte';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { m } from '$lib/paraglide/messages';

	let {
		path,
		secondaryPath = null,
		morphT = 0,
		copies = 8,
		baseRadius,
		ringIncrement,
		size = 280,
		showTry = false
	}: {
		path: Path | null;
		secondaryPath?: Path | null;
		morphT?: number;
		copies?: number;
		baseRadius: number;
		ringIncrement: number;
		size?: number;
		showTry?: boolean;
	} = $props();

	let hasError = $state(false);
	let playing = $state(false);
	let playT = $state(0);
	let rafId: number | null = null;

	const pipeline = createRenderPipeline();

	// While the Try loop runs it overrides the slider pose; otherwise the preview
	// mirrors the live morphT prop.
	const effectiveMorphT = $derived(playing ? playT : morphT);

	function draw(scope: import('paper').PaperScope) {
		if (!path) {
			hasError = true;
			return;
		}
		const comp: Composition = {
			baseRadius,
			ringIncrement,
			aspectRatio: '1:1',
			rings: [
				{
					id: 'ring-morph-preview-ring',
					copies,
					color: '#000000',
					templatePath: path,
					secondaryTemplatePath: secondaryPath ?? null,
					morphT: effectiveMorphT,
					ringHeight: 0.12
				}
			],
			monochromePalettes: [{ primary: '#000000', secondary: '#ffffff', background: '#ffffff' }],
			fullPalettes: []
		};
		try {
			scope.project.clear();
			pipeline.render({ composition: comp, scope, viewport: { width: size, height: size, padding: 20 } });
			hasError = false;
		} catch {
			hasError = true;
		}
	}

	function stopTry() {
		playing = false;
		if (rafId !== null) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
	}

	function startTry() {
		playing = true;
		const periodMs = 1500; // one 0→1 sweep; loops, matching the default morph keyframes
		let startTs: number | null = null;
		const tick = (ts: number) => {
			if (startTs === null) startTs = ts;
			playT = ((ts - startTs) / periodMs) % 1;
			rafId = requestAnimationFrame(tick);
		};
		rafId = requestAnimationFrame(tick);
	}

	function toggleTry() {
		if (playing) stopTry();
		else startTry();
	}
</script>

{#if hasError}
	<div
		style:width="{size}px"
		style:height="{size}px"
		class="flex items-center justify-center border border-dashed text-sm text-muted-foreground"
		data-testid="ring-morph-preview-placeholder"
	>
		?
	</div>
{:else}
	<canvas
		{@attach paperCanvas(draw, { dispose: () => {
			if (rafId !== null) cancelAnimationFrame(rafId);
			pipeline.dispose();
		} })}
		width={size}
		height={size}
		style:width="{size}px"
		style:height="{size}px"
		aria-hidden="true"
		data-testid="ring-morph-preview-canvas"
	></canvas>
{/if}

{#if showTry}
	<Button variant="outline" size="sm" onclick={toggleTry} data-testid="ring-morph-preview-try">
		{playing ? m.animate_morph_stop() : m.animate_morph_try()}
	</Button>
{/if}
```

(`draw` reads `path`, `secondaryPath`, `copies`, `size`, `effectiveMorphT` — so the adapter's `$effect` re-runs `draw` whenever any change, including the Try loop's `playT`. The old explicit `void path; …` effect is gone; the single adapter effect replaces it, removing the onMount+effect double render.)

- [ ] **Step 2: Run the autofixer on RingMorphPreview**

Run `svelte-autofixer` on the full text until `issues: []`. If it objects to the inline arrow in `{@attach paperCanvas(draw, { dispose: () => { … } })}`, hoist the dispose to a named function `function disposePreview() { … }` and pass `{ dispose: disposePreview }`.

- [ ] **Step 3: Run the RingMorphPreview spec + types**

Run: `bun run test:unit -- run src/lib/components/RingMorphPreview.svelte.spec.ts`
Expected: PASS — canvas/placeholder testids; canvas explicit CSS size (`160px` in that test); Try button present only when `showTry`; clicking Try then unmount calls `cancelAnimationFrame`; placeholder when the (mocked) pipeline throws.
Run: `bun run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/RingMorphPreview.svelte
git commit -m "refactor(preview): RingMorphPreview adopts paperCanvas, drops double render on mount

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: WavePreview + ZonePreview adopt `paperCanvas` + `fitPreviewToView`

**Files:**
- Modify: `src/lib/components/WavePreview.svelte`
- Modify: `src/lib/components/ZonePreview.svelte`
- (No component spec exists for either — verified via `bun run check`, autofixer, and the manual browser pass.)

**Interfaces:**
- Consumes: `paperCanvas`, `fitPreviewToView` (Task 2).

- [ ] **Step 1: WavePreview — route the scope through paperCanvas, use fitPreviewToView**

In `src/lib/components/WavePreview.svelte`:
- Remove the local `fitToView` function (lines 47-59) and the `import paper from 'paper'` if it becomes unused after the change (it is still used for `new paper.Color(...)` in the draw body — keep the `paper` import).
- Add: `import { paperCanvas, fitPreviewToView } from './paper-canvas.svelte';`
- Replace the `setupCanvas` function (which created the scope + its own `$effect` + a `scope.project.clear()`-only teardown) with a `draw(scope)` function containing the redraw body, and attach via `{@attach paperCanvas(draw)}`. The body keeps the `reach`/`rest` builds and calls `fitPreviewToView(scope)` instead of the deleted local `fitToView(scope)`. The leading `scope.activate()` is now done by the adapter; the body should still `scope.project.clear()` at the start and `scope.view.update()` at the end:

```ts
	function draw(scope: paper.PaperScope) {
		scope.project.clear();
		if (template) {
			const baseRing: Ring = {
				id: 'wave-preview-ring',
				copies: Math.max(1, Math.floor(copies)),
				color: '#000000',
				templatePath: template,
				secondaryTemplatePath: null,
				morphT: 0,
				ringHeight
			};

			const reach = buildRingPath(
				{
					...baseRing,
					templatePath: composeRingTemplate({ ...baseRing, wave: { amplitude, crests, phase } }).path
				},
				PREVIEW_RADIUS,
				scope
			);
			if (reach) {
				reach.fillColor = new paper.Color(0, 0, 0, 0.18);
				reach.strokeColor = null;
			}

			const rest = buildRingPath(baseRing, PREVIEW_RADIUS, scope);
			if (rest) {
				rest.fillColor = null;
				rest.strokeColor = new paper.Color(0, 0, 0);
				rest.strokeWidth = 1;
				rest.strokeScaling = false;
			}

			fitPreviewToView(scope);
		}
		scope.view.update();
	}
```

Then change the canvas attachment from `{@attach setupCanvas}` to `{@attach paperCanvas(draw)}`. Keep the `phase` rAF `$effect`, the `template`/props, the overlay markup, and the "Add a ring path to preview" empty-state exactly as they are.

- [ ] **Step 2: ZonePreview — same adoption**

In `src/lib/components/ZonePreview.svelte`:
- Remove the local `fitToView` (lines 20-32). Add `import { paperCanvas, fitPreviewToView } from './paper-canvas.svelte';` (keep `import paper` for `new paper.Color`).
- Replace `setupCanvas` with a `draw(scope)` holding the existing redraw body, calling `fitPreviewToView(scope)` instead of the local `fitToView(scope)`, keeping `scope.project.clear()` at the start and `scope.view.update()` at the end. Attach via `{@attach paperCanvas(draw)}`. Keep the overlay markup + "Add a ring path to preview zones" empty-state unchanged.

```ts
	function draw(scope: paper.PaperScope) {
		scope.project.clear();
		if (template) {
			const baseRing: Ring = {
				id: 'zone-preview-ring',
				copies: Math.max(1, Math.floor(copies)),
				color: '#000000',
				templatePath: template,
				secondaryTemplatePath: null,
				morphT: 0,
				ringHeight
			};

			const maxDrive = {
				bassPush: intensity.bass,
				midPush: intensity.mid,
				trebleRetract: intensity.treble,
				trebleVibrate: intensity.treble
			};

			const reach = buildRingPath({ ...baseRing, zoneDrive: maxDrive }, PREVIEW_RADIUS, scope);
			if (reach) {
				reach.fillColor = new paper.Color(0, 0, 0, 0.18);
				reach.strokeColor = null;
			}

			const rest = buildRingPath(baseRing, PREVIEW_RADIUS, scope);
			if (rest) {
				rest.fillColor = null;
				rest.strokeColor = new paper.Color(0, 0, 0);
				rest.strokeWidth = 1;
				rest.strokeScaling = false;
			}

			fitPreviewToView(scope);
		}
		scope.view.update();
	}
```

- [ ] **Step 3: Run the autofixer on both files**

Run `svelte-autofixer` on the full text of `WavePreview.svelte` and `ZonePreview.svelte`; apply fixes until each returns `issues: []`.

- [ ] **Step 4: Verify types + full unit suite**

Run: `bun run check`
Expected: 0 errors, 0 warnings.
Run: `bun run test:unit -- run`
Expected: all green (no spec covers Wave/Zone directly; this confirms nothing else regressed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/WavePreview.svelte src/lib/components/ZonePreview.svelte
git commit -m "refactor(preview): Wave/Zone previews adopt paperCanvas + shared fitPreviewToView

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Final verification (after all tasks)

- [ ] **Types:** `bun run check` → 0 errors, 0 warnings.
- [ ] **Full unit:** `bun run test:unit -- run` → all green (prior count + 4 new fit-to-view tests; the RingPreview/RingMorphPreview specs still pass through the adapter). If the first run flakes a single paraglide-dependent test, RERUN once.
- [ ] **e2e:** `bunx playwright test` → 6/6.
- [ ] **Manual browser pass (dev :5174)** — the important net for Wave/Zone (no specs):
  - Editor: a ring morph preview renders, and the Try button animates the morph (RingMorphPreview rAF + adapter redraw).
  - audioBars section: the Wave preview shows the rest outline + translucent reach, with the phase animating (WavePreview rAF).
  - audioZones section: the Zone preview shows the rest outline + translucent zone reach, responding to the intensity sliders.
  - Open/close the sections repeatedly (mount/unmount the previews) and confirm no console errors and no visible leak/slowdown — the adapter teardown (clear + view.remove) should keep scopes from piling up.

## Notes for the implementer

- **The adapter owns the scope seam, not the render.** `draw(scope)` does whatever the preview needs (pipeline.render OR buildRingPath builds + fit). Do not try to unify the two render styles — that is each preview's real content.
- **`draw` must be a stable function** (a `function draw(...)` declaration, not an inline arrow rebuilt each render) so `{@attach paperCanvas(draw)}` is a stable attachment and the scope is created once; redraws happen through the adapter's internal `$effect` re-tracking the reactive state `draw` reads. This mirrors the existing `{@attach setupCanvas}` pattern.
- **Teardown is the bug fix.** The adapter always runs `scope.project.clear()` + `scope.view.remove()` (+ caller `dispose`); Wave/Zone previously cleared but never removed the view. Keep the adapter's teardown intact.
- **Out of scope:** `preview-presenter.svelte.ts` (its own main/tile scopes, exports, kaleidoscope rAF) and `RingCanvas.svelte` (interactive editor) are NOT touched. AboutHeroRing is not adopted in this batch.
- Per-component error/empty markup and every `data-testid` stay exactly as they are — the two preview specs assert them.
