# Animate Simple Morph Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In Animate → Simple, show each ring's primary shape as a read-only reference and add a live, reactive morph preview with an on-demand "Try" animation.

**Architecture:** A new isolated `RingMorphPreview.svelte` renders one ring's morph result via `createRenderPipeline` (like `RingPreview`) but re-renders reactively when its inputs change, and owns a local rAF "Try" loop that animates `morphT` 0→1 without touching global state. `RingMorphConfigItem.svelte` mounts it at the top (morph result + Try when a target exists; primary-only otherwise) plus a second read-only instance as the primary reference.

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, paper.js, vitest browser tests, paraglide i18n, bun.

## Global Constraints

- Package manager is **bun**. Single spec: `bun run test:unit -- run <path>`; full unit: `bun run test:unit -- run`; types: `bun run check` (recompiles paraglide); e2e: `bunx playwright test`.
- New i18n keys MUST be added to BOTH `messages/en.json` and `messages/it.json` (a messages-parity test enforces equal key sets).
- Every `.svelte` MUST pass the Svelte MCP `svelte-autofixer` with `issues: []`. Known pre-existing false-positive *suggestions* (rAF/function-call inside `$effect`, `bind:this` replaceable by attachment) are ignorable.
- Component tests run in a REAL browser (vitest/browser) with Tailwind NOT loaded — assert DOM structure / testid / role / text, never Tailwind visuals or pixel geometry.
- `switchLocale('en')` in `beforeEach` for specs asserting English text.
- Tab indentation. Commit trailer EXACTLY: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Do NOT run `prettier --write .` or `bun run lint`.
- Preview render approach must mirror `RingPreview.svelte`: one ring `{ copies, color:'#000000', templatePath, secondaryTemplatePath, morphT, ringHeight: 0.12 }`, `monochromePalettes:[{primary:'#000000',secondary:'#ffffff',background:'#ffffff'}]`, `fullPalettes:[]`, `aspectRatio:'1:1'`, viewport padding 20.

---

## File Structure

- `messages/en.json`, `messages/it.json` — 3 new keys.
- `src/lib/components/RingMorphPreview.svelte` (new) — reactive single-ring morph preview + Try loop.
- `src/lib/components/RingMorphPreview.svelte.spec.ts` (new) — its tests.
- `src/lib/components/RingMorphConfigItem.svelte` (modify) — mount preview + primary reference.
- `src/lib/components/RingMorphConfigItem.svelte.spec.ts` (modify) — assert preview + reference.

---

### Task 1: i18n keys

**Files:**
- Modify: `messages/en.json`, `messages/it.json`

**Interfaces:**
- Produces: `m.animate_morph_try()`, `m.animate_morph_stop()`, `m.animate_morph_primary_label()`.

- [ ] **Step 1: Add the keys to en.json**

In `messages/en.json`, after `"animate_simple_empty": ...,` (the Simple-section block) add:

```json
	"animate_morph_try": "Try",
	"animate_morph_stop": "Stop",
	"animate_morph_primary_label": "Primary (reference)",
```

If `animate_simple_empty` is not present, place the three keys immediately after `"animate_layer_simple"`.

- [ ] **Step 2: Add the same keys to it.json**

In `messages/it.json`, at the matching location add:

```json
	"animate_morph_try": "Prova",
	"animate_morph_stop": "Stop",
	"animate_morph_primary_label": "Primaria (riferimento)",
```

- [ ] **Step 3: Recompile + parity**

Run: `bun run check` then `bun run test:unit -- run src/lib/messages-parity.spec.ts`
Expected: 0 errors; parity PASS. (If parity flakes on the first run right after editing messages, RERUN once — paraglide recompile race.)

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/it.json
git commit -m "i18n(animate): morph try/stop + primary reference labels

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: RingMorphPreview component

**Files:**
- Create: `src/lib/components/RingMorphPreview.svelte`
- Test: `src/lib/components/RingMorphPreview.svelte.spec.ts`

**Interfaces:**
- Consumes: `createRenderPipeline` from `$lib/geometry/render-pipeline`; `Path`, `Composition` from `$lib/types`; `m.animate_morph_try`, `m.animate_morph_stop` (Task 1).
- Produces: `RingMorphPreview` with props `{ path: Path | null; secondaryPath?: Path | null; morphT?: number; copies?: number; baseRadius: number; ringIncrement: number; size?: number; showTry?: boolean }`. Testids: `ring-morph-preview-canvas`, `ring-morph-preview-placeholder`, `ring-morph-preview-try`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/components/RingMorphPreview.svelte.spec.ts`:

```ts
import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { switchLocale } from '$lib/state/locale.svelte';
import type { Path } from '$lib/types';

const PATH: Path = {
	cmds: ['M', 'C', 'C'],
	crds: [20, 117, 59, 117, 32, 82, 61, 62, 83, 47, 101, 66, 180, 67]
};

let shouldThrow = false;
const disposeSpy = vi.fn();

vi.mock('$lib/geometry/render-pipeline', () => ({
	createRenderPipeline: () => ({
		render: () => {
			if (shouldThrow) throw new Error('boom');
		},
		dispose: disposeSpy
	})
}));

import RingMorphPreview from './RingMorphPreview.svelte';

describe('RingMorphPreview', () => {
	beforeEach(() => {
		switchLocale('en');
		shouldThrow = false;
	});

	it('renders the preview canvas for a valid primary path', async () => {
		const { container } = render(RingMorphPreview, {
			path: PATH,
			secondaryPath: PATH,
			morphT: 0.5,
			baseRadius: 5,
			ringIncrement: 2
		});
		await vi.waitFor(() => {
			expect(container.querySelector('[data-testid="ring-morph-preview-canvas"]')).not.toBeNull();
		});
		expect(container.querySelector('[data-testid="ring-morph-preview-placeholder"]')).toBeNull();
	});

	it('shows the placeholder when the render pipeline throws', async () => {
		shouldThrow = true;
		const { container } = render(RingMorphPreview, {
			path: PATH,
			baseRadius: 5,
			ringIncrement: 2
		});
		await vi.waitFor(() => {
			expect(
				container.querySelector('[data-testid="ring-morph-preview-placeholder"]')
			).not.toBeNull();
		});
	});

	it('hides the Try button unless showTry is set', async () => {
		render(RingMorphPreview, { path: PATH, baseRadius: 5, ringIncrement: 2 });
		expect(page.getByTestId('ring-morph-preview-try').query()).toBeNull();
	});

	it('toggles the Try button between Try and Stop', async () => {
		render(RingMorphPreview, {
			path: PATH,
			secondaryPath: PATH,
			baseRadius: 5,
			ringIncrement: 2,
			showTry: true
		});
		const btn = page.getByTestId('ring-morph-preview-try');
		await expect.element(btn).toHaveTextContent('Try');
		await userEvent.click(btn);
		await expect.element(btn).toHaveTextContent('Stop');
		await userEvent.click(btn);
		await expect.element(btn).toHaveTextContent('Try');
	});

	it('cancels the animation loop on unmount (no orphan rAF)', async () => {
		const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');
		const { unmount } = render(RingMorphPreview, {
			path: PATH,
			secondaryPath: PATH,
			baseRadius: 5,
			ringIncrement: 2,
			showTry: true
		});
		await userEvent.click(page.getByTestId('ring-morph-preview-try'));
		unmount();
		expect(cancelSpy).toHaveBeenCalled();
		cancelSpy.mockRestore();
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test:unit -- run src/lib/components/RingMorphPreview.svelte.spec.ts`
Expected: FAIL — module `./RingMorphPreview.svelte` does not exist.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/RingMorphPreview.svelte`:

```svelte
<script lang="ts">
	import paper from 'paper';
	import { onMount } from 'svelte';
	import type { Composition, Path } from '$lib/types';
	import { createRenderPipeline } from '$lib/geometry/render-pipeline';
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

	let canvas = $state<HTMLCanvasElement | null>(null);
	let hasError = $state(false);
	let playing = $state(false);
	let playT = $state(0);

	let scope: paper.PaperScope | undefined;
	let pipeline: ReturnType<typeof createRenderPipeline> | undefined;
	let rafId: number | null = null;

	// While the Try loop runs it overrides the slider pose; otherwise the preview
	// mirrors the live morphT prop.
	const effectiveMorphT = $derived(playing ? playT : morphT);

	function renderPreview() {
		if (!scope || !pipeline || !path) {
			hasError = !path;
			return;
		}
		const comp: Composition = {
			baseRadius,
			ringIncrement,
			aspectRatio: '1:1',
			rings: [
				{
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

	onMount(() => {
		if (!canvas) {
			hasError = true;
			return;
		}
		scope = new paper.PaperScope();
		scope.setup(canvas);
		pipeline = createRenderPipeline();
		renderPreview();
		return () => {
			if (rafId !== null) cancelAnimationFrame(rafId);
			pipeline?.dispose();
			scope?.project.clear();
			scope?.view.remove();
		};
	});

	// Re-render whenever the inputs (or the Try-driven pose) change. Guarded so an
	// early run before onMount setup is a no-op (onMount does the first render).
	$effect(() => {
		void path;
		void secondaryPath;
		void copies;
		void size;
		void effectiveMorphT;
		renderPreview();
	});

	function stopTry() {
		playing = false;
		if (rafId !== null) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
	}

	function startTry() {
		playing = true;
		const periodMs = 1500; // one 0→1 sweep; loops, matching the Simple driver
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
		bind:this={canvas}
		width={size}
		height={size}
		aria-hidden="true"
		data-testid="ring-morph-preview-canvas"
	></canvas>
{/if}

{#if showTry}
	<Button
		variant="outline"
		size="sm"
		onclick={toggleTry}
		data-testid="ring-morph-preview-try"
	>
		{playing ? m.animate_morph_stop() : m.animate_morph_try()}
	</Button>
{/if}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test:unit -- run src/lib/components/RingMorphPreview.svelte.spec.ts`
Expected: PASS (5 tests).

Note on the placeholder test: when `shouldThrow` is true, `onMount`'s `renderPreview()` sets `hasError = true`, which removes the `<canvas>` from the DOM on the next tick — the `vi.waitFor` accommodates this.

- [ ] **Step 5: Run svelte-autofixer**

Run the Svelte MCP `svelte-autofixer` on `RingMorphPreview.svelte` (desired_svelte_version 5). Confirm `issues: []`. The rAF-inside-effect / function-call-in-`$effect` suggestions are the known false positives — ignore them.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/RingMorphPreview.svelte src/lib/components/RingMorphPreview.svelte.spec.ts
git commit -m "feat(animate): RingMorphPreview — reactive morph preview with Try loop

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Wire preview + primary reference into RingMorphConfigItem

**Files:**
- Modify: `src/lib/components/RingMorphConfigItem.svelte`
- Test: `src/lib/components/RingMorphConfigItem.svelte.spec.ts`

**Interfaces:**
- Consumes: `RingMorphPreview` (Task 2); `composition.baseRadius`, `composition.ringIncrement` from `$lib/state/composition`; `m.animate_morph_primary_label` (Task 1).

- [ ] **Step 1: Write the failing tests**

Add these tests inside the existing `describe('RingMorphConfigItem', …)` block in `src/lib/components/RingMorphConfigItem.svelte.spec.ts` (the file already imports `page`, `userEvent`, `render`, `composition`, `switchLocale`, and has `ring(secondary)`):

```ts
	it('shows a primary-only preview above Create morph when there is no target', async () => {
		render(RingMorphConfigItem, { ring: composition.rings[0], index: 0 });
		await userEvent.click(page.getByRole('button', { name: /Ring 1/ }));
		expect(page.getByTestId('ring-morph-preview-canvas').query()).not.toBeNull();
		await expect
			.element(page.getByRole('button', { name: 'Create morph target' }))
			.toBeInTheDocument();
		// No Try button before a target exists.
		expect(page.getByTestId('ring-morph-preview-try').query()).toBeNull();
	});

	it('shows the morph preview, primary reference and Try once a target exists', async () => {
		composition.rings = [ring(true)];
		render(RingMorphConfigItem, { ring: composition.rings[0], index: 0 });
		await userEvent.click(page.getByRole('button', { name: /Ring 1/ }));
		expect(page.getByTestId('ring-morph-preview-try').query()).not.toBeNull();
		await expect.element(page.getByText('Primary (reference)')).toBeInTheDocument();
	});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test:unit -- run src/lib/components/RingMorphConfigItem.svelte.spec.ts`
Expected: FAIL — no `ring-morph-preview-*` testids / no "Primary (reference)" text yet.

- [ ] **Step 3: Implement the wiring**

In `src/lib/components/RingMorphConfigItem.svelte`:

(a) Add imports near the other imports (after the existing `import RingCanvas from './RingCanvas.svelte';` line):

```svelte
	import RingMorphPreview from './RingMorphPreview.svelte';
	import { composition } from '$lib/state/composition';
```

Note: `createRingMorphTarget`, `removeRingMorphTarget`, `updateRingPathVariant`, `setRingMorphT` are already imported from `$lib/state/composition`; extend that existing import with `composition` rather than adding a duplicate line if the import is a single block. Concretely, change the existing import block:

```svelte
	import {
		createRingMorphTarget,
		removeRingMorphTarget,
		updateRingPathVariant,
		setRingMorphT
	} from '$lib/state/composition';
```

to:

```svelte
	import {
		composition,
		createRingMorphTarget,
		removeRingMorphTarget,
		updateRingPathVariant,
		setRingMorphT
	} from '$lib/state/composition';
```

and add only the component import line:

```svelte
	import RingMorphPreview from './RingMorphPreview.svelte';
```

(b) Replace the no-target branch (the block currently starting `{#if !ring.secondaryTemplatePath}` … the lone Create-morph `<Button>` … `{:else}`) so the no-target state shows a primary-only preview above the button. Change:

```svelte
			{#if !ring.secondaryTemplatePath}
				<Button
					variant="outline"
					size="sm"
					onclick={() => {
						ringPathError = null;
						createRingMorphTarget(index);
					}}
				>
					{m.editor_create_morph()}
				</Button>
			{:else}
```

to:

```svelte
			{#if !ring.secondaryTemplatePath}
				<RingMorphPreview
					path={ring.templatePath}
					copies={ring.copies}
					baseRadius={composition.baseRadius}
					ringIncrement={composition.ringIncrement}
					size={200}
				/>
				<Button
					variant="outline"
					size="sm"
					onclick={() => {
						ringPathError = null;
						createRingMorphTarget(index);
					}}
				>
					{m.editor_create_morph()}
				</Button>
			{:else}
```

(c) In the `{:else}` (target-exists) branch, insert the morph preview + primary reference immediately after the `{:else}` and BEFORE the existing target `<RingCanvas …>`. Change:

```svelte
			{:else}
				<RingCanvas
					templatePath={ring.secondaryTemplatePath}
					onchange={applyPathFromEditor}
					label={m.editor_path_editor_secondary()}
				/>
```

to:

```svelte
			{:else}
				<RingMorphPreview
					path={ring.templatePath}
					secondaryPath={ring.secondaryTemplatePath}
					morphT={ring.morphT ?? 0}
					copies={ring.copies}
					baseRadius={composition.baseRadius}
					ringIncrement={composition.ringIncrement}
					size={200}
					showTry
				/>

				<div class="flex flex-col gap-1">
					<span class="text-xs text-muted-foreground">{m.animate_morph_primary_label()}</span>
					<RingMorphPreview
						path={ring.templatePath}
						copies={ring.copies}
						baseRadius={composition.baseRadius}
						ringIncrement={composition.ringIncrement}
						size={120}
					/>
				</div>

				<RingCanvas
					templatePath={ring.secondaryTemplatePath}
					onchange={applyPathFromEditor}
					label={m.editor_path_editor_secondary()}
				/>
```

Leave the rest of the target branch (morphT slider, library/remove buttons, SVG import) unchanged.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test:unit -- run src/lib/components/RingMorphConfigItem.svelte.spec.ts`
Expected: PASS (existing tests + 2 new). If a test that asserts a single preview canvas collides because the target state now renders two `RingMorphPreview` canvases, scope its lookup — but the new tests above use `.query() not toBeNull` / the Try testid and the primary-label text, which are unambiguous.

- [ ] **Step 5: Run svelte-autofixer**

Run the Svelte MCP `svelte-autofixer` on `RingMorphConfigItem.svelte` (desired_svelte_version 5). Confirm `issues: []`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/RingMorphConfigItem.svelte src/lib/components/RingMorphConfigItem.svelte.spec.ts
git commit -m "feat(animate): Simple morph panel shows primary reference + live preview

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Type check**

Run: `bun run check`
Expected: `0 ERRORS 0 WARNINGS`.

- [ ] **Step 2: Full unit suite**

Run: `bun run test:unit -- run`
Expected: all pass. (If the first run flakes on a paraglide recompile race, RERUN once.)

- [ ] **Step 3: e2e suite**

Run: `bunx playwright test`
Expected: 6 passed. (If the build fails on a stale paraglide output — `_index.js` referencing a missing message file — run `rm -rf src/lib/paraglide && bun run paraglide`, then re-run.)

- [ ] **Step 4: Report**

No commit. Report the three gate results. Then offer a live browser pass (dev server on :5174) to see the new preview + Try button.

---

## Self-Review

- **Spec coverage:** Goal 1 (primary read-only reference) → Task 3 (b)(c) second `RingMorphPreview` + label. Goal 2 (create/edit target) → unchanged path kept in Task 3. Goal 3 (live preview + Try) → Task 2 component + Task 3 top instance with `showTry`. Non-goals respected: primary not editable (reference is a non-interactive preview); global animation untouched (Try loop is local rAF); `RingPreview` and its consumers untouched (new component). i18n parity → Task 1. Testing section → Tasks 2 & 3 specs.
- **Placeholder scan:** none — every code step shows full code.
- **Type consistency:** `RingMorphPreview` prop names/types identical across Tasks 2 and 3 (`path`, `secondaryPath`, `morphT`, `copies`, `baseRadius`, `ringIncrement`, `size`, `showTry`). Testids consistent (`ring-morph-preview-canvas/-placeholder/-try`). i18n accessors (`animate_morph_try/stop/primary_label`) match Task 1 keys.
