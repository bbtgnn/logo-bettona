# Path Library Hover Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hover preview to Path Library cards (both `/paths` page and the load-from-library picker sheet) that renders a realistic ring (path repeated N copies around a circle) via the existing render pipeline, using composition params from the current editor state.

**Architecture:** A new `RingPreview.svelte` component owns its own Paper.js scope, builds an ad-hoc `Composition` from props, calls `createRenderPipeline().render(...)` once on mount, and disposes on unmount. Each consumer wraps its grid cards in `onmouseenter`/`onmouseleave` handlers managing a `hoveredId` `$state`, and conditionally renders `<RingPreview>` inside an absolutely positioned popover when its card is hovered.

**Tech Stack:** Svelte 5 (runes, `$props`, `$state`, `onMount`), SvelteKit, TypeScript, Paper.js, existing `createRenderPipeline` (`src/lib/geometry/render-pipeline.ts`), Tailwind, vitest browser project, Playwright.

**Spec reference:** `docs/superpowers/specs/2026-05-22-path-library-hover-preview-design.md`

---

## File Structure

Create:

- `src/lib/components/RingPreview.svelte` — Self-contained ring renderer with hardcoded defaults for `copies`, `morphT`, `ringHeight`, color. Owns its Paper.js scope and lifecycle.
- `src/lib/components/RingPreview.svelte.spec.ts` — Unit tests: renders canvas on success, renders `?` placeholder on pipeline failure, disposes pipeline on unmount.
- `src/routes/paths/hover-preview.e2e.ts` — Playwright: hover a card on `/paths`, assert popover visible with canvas inside, mouseleave hides it.

Modify:

- `src/routes/paths/+page.svelte` — Add `hoveredId` state, wrap each `<li>` with hover handlers, render the popover conditionally. Import `composition` and `RingPreview`.
- `src/lib/components/LibraryPickerSheet.svelte` — Same treatment on the picker grid (the `!selected` branch). Smaller `size`. Imports for `composition` and `RingPreview`.

No other files change. The render pipeline, `pathLibrary` state, types, and shadcn components are all already in place.

---

## Task 1: Scaffold `RingPreview` component (no rendering yet)

**Files:**

- Create: `src/lib/components/RingPreview.svelte`

- [ ] **Step 1: Create the file with a minimal canvas + props block**

Create `src/lib/components/RingPreview.svelte`:

```svelte
<script lang="ts">
	import type { Path } from '$lib/types';

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

	let canvas = $state<HTMLCanvasElement | null>(null);
	let hasError = $state(false);
</script>

{#if hasError}
	<div
		style:width="{size}px"
		style:height="{size}px"
		class="flex items-center justify-center border border-dashed text-muted-foreground text-sm"
		data-testid="ring-preview-placeholder"
	>
		?
	</div>
{:else}
	<canvas
		bind:this={canvas}
		width={size}
		height={size}
		aria-hidden="true"
		data-testid="ring-preview-canvas"
	></canvas>
{/if}
```

- [ ] **Step 2: Run the svelte-autofixer**

Use the `svelte-autofixer` MCP tool on the file until it returns no issues.

- [ ] **Step 3: Type-check**

Run: `bun run check`
Expected: no new errors (pre-existing animation errors are unrelated).

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/RingPreview.svelte
git commit -m "feat(components): scaffold RingPreview with canvas + placeholder"
```

---

## Task 2: Wire Paper.js scope + render pipeline onMount

**Files:**

- Modify: `src/lib/components/RingPreview.svelte`

- [ ] **Step 1: Add Paper.js + pipeline lifecycle**

Replace the `<script>` block of `src/lib/components/RingPreview.svelte` with:

```svelte
<script lang="ts">
	import paper from 'paper';
	import { onMount } from 'svelte';
	import type { Composition, Path } from '$lib/types';
	import { createRenderPipeline } from '$lib/geometry/render-pipeline';

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

	let canvas = $state<HTMLCanvasElement | null>(null);
	let hasError = $state(false);

	onMount(() => {
		if (!canvas) {
			hasError = true;
			return;
		}

		const scope = new paper.PaperScope();
		scope.setup(canvas);

		const composition: Composition = {
			baseRadius,
			ringIncrement,
			rings: [
				{
					copies,
					color: '#000000',
					templatePath: path,
					secondaryTemplatePath: secondaryPath ?? null,
					morphT,
					ringHeight: 0.12
				}
			],
			monochromePalettes: [{ main: '#000000', bg: '#ffffff' }],
			fullPalettes: []
		};

		const pipeline = createRenderPipeline();

		try {
			pipeline.render({
				composition,
				scope,
				viewport: { width: size, height: size, padding: 20 }
			});
		} catch {
			hasError = true;
		}

		return () => {
			pipeline.dispose();
			scope.project.clear();
			scope.view.remove();
		};
	});
</script>
```

The markup block (the `{#if hasError}...{/if}` template) does not change.

- [ ] **Step 2: Run svelte-autofixer**

Use the `svelte-autofixer` MCP tool until clean.

- [ ] **Step 3: Type-check**

Run: `bun run check`
Expected: no new errors.

- [ ] **Step 4: Manual smoke test**

Run: `bun run dev`
Open: http://localhost:5173/paths (with at least one entry saved — if the library is empty, save one from the Ring Editor first).

The page should still render normally (no preview wiring yet — that's Task 4 and 5). Stop the dev server. The point of this smoke test is just to confirm the new module imports do not break the page load.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/RingPreview.svelte
git commit -m "feat(components): RingPreview renders ring via paper.js + pipeline"
```

---

## Task 3: Unit tests for `RingPreview`

**Files:**

- Create: `src/lib/components/RingPreview.svelte.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/components/RingPreview.svelte.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Path } from '$lib/types';

const validPath: Path = {
	cmds: ['M', 'C', 'C'],
	crds: [
		20, 117, 59, 117, 32, 82,
		61, 62, 83, 47, 101, 66,
		180, 67
	]
};
const badPath: Path = { cmds: ['M', 'L'], crds: [0, 0, 1] };

describe('RingPreview', () => {
	it('renders a <canvas> when given a valid path', async () => {
		const RingPreview = (await import('./RingPreview.svelte')).default;
		const { container } = render(RingPreview, {
			path: validPath,
			baseRadius: 5,
			ringIncrement: 2
		});

		// onMount runs synchronously after first paint in the browser project;
		// wait a microtask for the bind:this to settle.
		await new Promise((r) => setTimeout(r, 0));

		expect(container.querySelector('[data-testid="ring-preview-canvas"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="ring-preview-placeholder"]')).toBeNull();
	});

	it('shows the placeholder when the render pipeline rejects the path', async () => {
		vi.resetModules();
		vi.doMock('$lib/geometry/render-pipeline', () => ({
			createRenderPipeline: () => ({
				render: () => {
					throw new Error('boom');
				},
				dispose: () => {}
			})
		}));

		const RingPreview = (await import('./RingPreview.svelte')).default;
		const { container } = render(RingPreview, {
			path: badPath,
			baseRadius: 5,
			ringIncrement: 2
		});

		await new Promise((r) => setTimeout(r, 0));

		expect(container.querySelector('[data-testid="ring-preview-placeholder"]')).not.toBeNull();
		expect(container.textContent).toContain('?');

		vi.doUnmock('$lib/geometry/render-pipeline');
	});

	it('calls pipeline.dispose() when the component is unmounted', async () => {
		const dispose = vi.fn();
		vi.resetModules();
		vi.doMock('$lib/geometry/render-pipeline', () => ({
			createRenderPipeline: () => ({
				render: () => {},
				dispose
			})
		}));

		const RingPreview = (await import('./RingPreview.svelte')).default;
		const result = render(RingPreview, {
			path: validPath,
			baseRadius: 5,
			ringIncrement: 2
		});

		await new Promise((r) => setTimeout(r, 0));
		result.unmount();

		expect(dispose).toHaveBeenCalled();

		vi.doUnmock('$lib/geometry/render-pipeline');
	});
});
```

NOTE: If the project's other component specs import `render` from a different package (check `src/lib/components/PathThumbnail.svelte.spec.ts`), use that import path instead. Adjust the import line.

- [ ] **Step 2: Run the tests in the browser project**

Run: `bun run test:unit -- --run --project client src/lib/components/RingPreview.svelte.spec.ts`
Expected: 3/3 pass. The component already exists from Tasks 1–2, so they should pass on first run (this task is verification-by-tests, not strict TDD-red-first — the implementation predates the tests).

If a test fails:
- Canvas test: if `onMount` hasn't run by the assertion, increase the await delay (`setTimeout(r, 10)`).
- Mock tests: confirm `vi.doMock` works in the browser project; if not, refactor to use `vi.mock` at the top of the file with conditional implementations. Don't ship a broken test.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/RingPreview.svelte.spec.ts
git commit -m "test(components): cover RingPreview canvas, placeholder, dispose"
```

---

## Task 4: Wire hover preview into `/paths` page

**Files:**

- Modify: `src/routes/paths/+page.svelte`

- [ ] **Step 1: Update the page to add hover state and preview popover**

Replace the contents of `src/routes/paths/+page.svelte` with:

```svelte
<script lang="ts">
	import { pathLibrary } from '$lib/state/path-library';
	import { composition } from '$lib/state/composition';
	import PathThumbnail from '$lib/components/PathThumbnail.svelte';
	import RingPreview from '$lib/components/RingPreview.svelte';

	let hoveredId = $state<string | null>(null);
</script>

<svelte:head><title>Path Library — logo-bettona</title></svelte:head>

<div class="min-h-screen w-full bg-background text-foreground">
	<header class="border-b">
		<div class="mx-auto flex max-w-[1100px] items-center px-6 py-3">
			<a
				href="/"
				class="text-sm text-muted-foreground hover:text-foreground"
				data-testid="paths-back-link"
			>
				← Back
			</a>
			<span class="ml-4 text-sm font-semibold">Path Library</span>
			<span class="ml-2 text-xs text-muted-foreground">
				({pathLibrary.entries.length})
			</span>
		</div>
	</header>

	<main class="mx-auto max-w-[1100px] px-6 py-8">
		{#if pathLibrary.entries.length === 0}
			<p class="text-sm text-muted-foreground" data-testid="paths-empty-state">
				Nessun path salvato. Salva dal Ring Editor.
			</p>
		{:else}
			<ul
				class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
				data-testid="paths-grid"
			>
				{#each pathLibrary.entries as entry (entry.id)}
					<li
						class="relative flex flex-col items-center gap-2 rounded border p-3"
						onmouseenter={() => (hoveredId = entry.id)}
						onmouseleave={() => (hoveredId = null)}
					>
						<PathThumbnail
							path={entry.path}
							secondaryPath={entry.secondaryPath}
							size={120}
						/>
						<div class="flex w-full items-center justify-between text-xs">
							<span class="font-medium">{entry.name}</span>
							{#if entry.secondaryPath}
								<span class="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">
									secondary
								</span>
							{/if}
						</div>
						<span class="self-start text-[10px] text-muted-foreground">
							{new Date(entry.createdAt).toLocaleDateString()}
						</span>
						{#if hoveredId === entry.id}
							<div
								class="absolute left-full top-0 z-10 ml-2 rounded border bg-popover p-2 shadow-lg"
								data-testid="path-preview-popover"
							>
								<RingPreview
									path={entry.path}
									secondaryPath={entry.secondaryPath}
									baseRadius={composition.baseRadius}
									ringIncrement={composition.ringIncrement}
									size={280}
								/>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</main>
</div>
```

- [ ] **Step 2: Run svelte-autofixer**

Use the `svelte-autofixer` MCP tool on the file until clean.

- [ ] **Step 3: Type-check**

Run: `bun run check`
Expected: no new errors.

- [ ] **Step 4: Manual smoke test**

Run: `bun run dev`
Open: http://localhost:5173/paths (with at least one entry).

Hover over a card. Expect a popover to appear to the right of the card with a 280×280 canvas rendering the ring (path repeated 8 times around a circle). Move the mouse off the card — popover disappears. If there are entries close to the right edge of the viewport, the popover may overflow horizontally; that is expected for v1.

Stop the dev server.

- [ ] **Step 5: Run unit tests**

Run: `bun run test:unit -- --run`
Expected: full suite green.

- [ ] **Step 6: Commit**

```bash
git add src/routes/paths/+page.svelte
git commit -m "feat(paths): show ring preview on card hover"
```

---

## Task 5: Wire hover preview into `LibraryPickerSheet`

**Files:**

- Modify: `src/lib/components/LibraryPickerSheet.svelte`

- [ ] **Step 1: Add hover preview to the picker grid**

In `src/lib/components/LibraryPickerSheet.svelte`:

1. Add imports under the existing imports at the top of the `<script>`:

```ts
import { composition } from '$lib/state/composition';
import RingPreview from './RingPreview.svelte';
```

2. Add reactive state next to the existing `selected` / `slotRaw` state:

```ts
let hoveredId = $state<string | null>(null);
```

3. Replace the picker grid `<li>` block (inside the `{:else if !selected}` branch). Find the current `<li>` containing the entry `<button>` and replace the `<li>` (only — keep `{#each}` and the surrounding `<ul>` intact) with:

```svelte
<li
	class="relative"
	onmouseenter={() => (hoveredId = entry.id)}
	onmouseleave={() => (hoveredId = null)}
>
	<button
		type="button"
		class="flex w-full flex-col items-center gap-1 rounded border p-2 hover:bg-muted"
		onclick={() => (selected = entry)}
		data-testid="library-picker-entry-{entry.id}"
	>
		<PathThumbnail
			path={entry.path}
			secondaryPath={entry.secondaryPath}
			size={80}
		/>
		<span class="text-xs">{entry.name}</span>
	</button>
	{#if hoveredId === entry.id}
		<div
			class="absolute left-full top-0 z-20 ml-2 rounded border bg-popover p-2 shadow-lg"
			data-testid="path-preview-popover"
		>
			<RingPreview
				path={entry.path}
				secondaryPath={entry.secondaryPath}
				baseRadius={composition.baseRadius}
				ringIncrement={composition.ringIncrement}
				size={220}
			/>
		</div>
	{/if}
</li>
```

The `z-20` here (vs. `z-10` on the page) keeps the popover above the sheet content. The size is smaller (220) to fit the narrower sheet width (sheet content is `420px`/`480px` wide).

- [ ] **Step 2: Run svelte-autofixer**

Use the `svelte-autofixer` MCP tool until clean.

- [ ] **Step 3: Type-check**

Run: `bun run check`
Expected: no new errors.

- [ ] **Step 4: Manual smoke test**

Run: `bun run dev`
Open: http://localhost:5173/

- Expand a ring, click "Carica da libreria". Sheet opens with the picker grid (if the library is non-empty).
- Hover over a picker entry. Popover appears to the right with a 220px ring preview.
- Move mouse off — popover disappears.
- Click an entry to select it. Slot picker view appears — no hover preview here (intentional; the selected detail view already focuses on one entry).

Stop the dev server.

- [ ] **Step 5: Run unit tests**

Run: `bun run test:unit -- --run`
Expected: full suite green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/LibraryPickerSheet.svelte
git commit -m "feat(library-picker): show ring preview on picker entry hover"
```

---

## Task 6: End-to-end Playwright flow

**Files:**

- Create: `src/routes/paths/hover-preview.e2e.ts`

- [ ] **Step 1: Write the e2e spec**

Create `src/routes/paths/hover-preview.e2e.ts`:

```ts
import { test, expect } from '@playwright/test';

test('hovering a library card shows a ring preview popover', async ({ page }) => {
	// Clear localStorage so we control library contents.
	await page.goto('/');
	await page.evaluate(() => localStorage.clear());
	await page.reload();

	// Save the first ring's path to the library so /paths has one card.
	const ringTrigger = page.getByRole('button', { name: /Ring 1/ });
	if (!(await ringTrigger.isVisible())) {
		await page.locator('header button').first().click();
	}
	await ringTrigger.click();
	await page.getByTestId('ring-save-to-library-0').click();
	await expect(page.getByTestId('ring-save-status-0')).toContainText(/Salvato come 'Path 1'/);

	// Navigate to /paths.
	await page.getByTestId('header-paths-link').click();
	await expect(page).toHaveURL(/\/paths$/);

	const firstCard = page.getByTestId('paths-grid').locator('li').first();
	await expect(firstCard).toBeVisible();

	// Popover should not be visible before hover.
	await expect(firstCard.getByTestId('path-preview-popover')).toBeHidden();

	// Hover the card → popover with a canvas appears.
	await firstCard.hover();
	const popover = firstCard.getByTestId('path-preview-popover');
	await expect(popover).toBeVisible({ timeout: 2000 });
	await expect(popover.getByTestId('ring-preview-canvas')).toBeVisible();

	// Move mouse away → popover hides.
	await page.mouse.move(0, 0);
	await expect(popover).toBeHidden({ timeout: 2000 });
});
```

- [ ] **Step 2: Run the e2e suite**

Run: `bun run test:e2e -- hover-preview`
Expected: 1 passed.

If the test fails:
- If the popover never appears, check that the hover handlers were attached to the `<li>` (not the inner `<button>`) and that `hoveredId` updates.
- If the popover stays visible after `page.mouse.move(0, 0)`, try moving the mouse to a known empty area first (e.g., `(10, 10)` inside the header) — `(0, 0)` can land outside the viewport on some configurations.

- [ ] **Step 3: Commit**

```bash
git add src/routes/paths/hover-preview.e2e.ts
git commit -m "test(paths): e2e flow for ring preview hover popover"
```

---

## Task 7: Full suite green + cleanup

- [ ] **Step 1: Run unit tests**

Run: `bun run test:unit -- --run`
Expected: full suite passes.

- [ ] **Step 2: Run type-check**

Run: `bun run check`
Expected: no new errors (pre-existing animation errors unrelated).

- [ ] **Step 3: Run prettier on new/modified files**

Run:
```bash
bunx prettier --write src/lib/components/RingPreview.svelte src/lib/components/RingPreview.svelte.spec.ts src/routes/paths/+page.svelte src/lib/components/LibraryPickerSheet.svelte src/routes/paths/hover-preview.e2e.ts
```
Expected: at most a few formatting tweaks, all in the above files.

- [ ] **Step 4: Run the e2e suite**

Run: `bun run test:e2e`
Expected: full suite passes (existing `path-manager.e2e.ts` + new `hover-preview.e2e.ts`).

- [ ] **Step 5: If anything fails, fix the underlying cause and re-run the affected command. Commit each fix as a focused commit (e.g. `style: format hover preview files`).**
