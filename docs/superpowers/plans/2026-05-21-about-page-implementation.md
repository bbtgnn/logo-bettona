# About Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone `/about` page reachable from the main app header, with a hero section (title + tagline + animated ring built from a hardcoded preset) and a two-column grid describing what the project is and how to use it.

**Architecture:** New SvelteKit route at `src/routes/about/+page.svelte` rendered outside the sidebar shell. A new `AboutHeroRing.svelte` component owns its own Paper.js scope, hardcodes a local `Composition` constant, drives it through the existing `createRenderPipeline()`, and animates `morphT` via a local `requestAnimationFrame` loop so the hero is fully isolated from the user's editor state.

**Tech Stack:** Svelte 5 (runes), SvelteKit (static adapter, prerender), Tailwind CSS, shadcn/svelte tokens, Paper.js, vitest-browser-svelte, Playwright.

**Spec reference:** `docs/superpowers/specs/2026-05-21-about-page-design.md`

---

## File Structure

Create:

- `src/routes/about/+page.svelte` — About page. Minimal `← Back` header, hero (title, tagline, `<AboutHeroRing />`), 2-column grid with two cards.
- `src/lib/components/AboutHeroRing.svelte` — Self-contained animated ring. Owns its Paper.js scope, defines a hardcoded `Composition` constant, runs an internal animation loop. No props.
- `src/lib/components/AboutHeroRing.svelte.spec.ts` — Component test: mounts without throwing, contains a `<canvas>`.
- `src/routes/about/page.svelte.spec.ts` — Component test: renders Back link, hero title, tagline, both card headings, and an `AboutHeroRing` (canvas).
- `e2e/about-nav.spec.ts` — Playwright: from `/` click `About` header link, assert hero title visible on `/about`, click `← Back`, assert main editor shell is visible.

Modify:

- `src/routes/+page.svelte` — Add a right-aligned `About` link to the existing header row.

No other files change. The global `composition` / `animationState` stores are not touched.

---

## Task 1: Scaffold `/about` route with placeholder content

**Files:**

- Create: `src/routes/about/+page.svelte`

- [ ] **Step 1: Create the placeholder route**

Create `src/routes/about/+page.svelte` with this exact content:

```svelte
<svelte:head><title>About — logo-bettona</title></svelte:head>

<div class="min-h-screen w-full bg-background text-foreground">
	<header class="border-b">
		<div class="mx-auto flex max-w-[1100px] items-center px-6 py-3">
			<a href="/" class="text-sm text-muted-foreground hover:text-foreground" data-testid="about-back-link">
				← Back
			</a>
		</div>
	</header>

	<main class="mx-auto max-w-[1100px] px-6 py-16">
		<h1 class="text-4xl font-semibold">About (placeholder)</h1>
	</main>
</div>
```

- [ ] **Step 2: Start the dev server and visit `/about`**

Run: `bun run dev`
Open: http://localhost:5173/about
Expected: Page renders with `← Back` link in a header bar and an `About (placeholder)` heading. Clicking `← Back` returns to `/`. Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/routes/about/+page.svelte
git commit -m "feat(about): scaffold /about route with placeholder content"
```

---

## Task 2: Add `About` link to main app header

**Files:**

- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Add the link to the header**

Open `src/routes/+page.svelte`. Replace the existing `<header>` block (currently lines 11-14) with:

```svelte
<header class="flex items-center gap-2 p-4 border-b">
	<SidebarUI.SidebarTrigger />
	<span class="font-semibold text-sm">Shape Editor</span>
	<a
		href="/about"
		class="ml-auto text-sm text-muted-foreground hover:text-foreground"
		data-testid="header-about-link"
	>
		About
	</a>
</header>
```

- [ ] **Step 2: Run dev server and verify link**

Run: `bun run dev`
Open: http://localhost:5173/
Expected: Header now shows `About` on the far right. Click it. Expected: navigates to `/about`. Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat(about): add About link to main app header"
```

---

## Task 3: Add Playwright nav smoke test

**Files:**

- Create: `e2e/about-nav.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `e2e/about-nav.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('navigates between editor and About via header links', async ({ page }) => {
	await page.goto('/');

	await page.getByTestId('header-about-link').click();
	await expect(page).toHaveURL(/\/about$/);
	await expect(page.locator('h1')).toBeVisible();

	await page.getByTestId('about-back-link').click();
	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByText('Shape Editor')).toBeVisible();
});
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `bun run test:e2e -- e2e/about-nav.spec.ts`
Expected: PASS — placeholder About page already exposes both required testids and the editor shell shows `Shape Editor` text.

- [ ] **Step 3: Commit**

```bash
git add e2e/about-nav.spec.ts
git commit -m "test(about): add e2e nav smoke between editor and /about"
```

---

## Task 4: Build static `AboutHeroRing` component (no animation yet)

**Files:**

- Create: `src/lib/components/AboutHeroRing.svelte`

- [ ] **Step 1: Create the component with a hardcoded preset and static render**

Create `src/lib/components/AboutHeroRing.svelte`:

```svelte
<script lang="ts">
	import paper from 'paper';
	import type { Composition } from '$lib/types';
	import { createRenderPipeline } from '$lib/geometry/render-pipeline';

	const HERO_COMPOSITION: Composition = {
		baseRadius: 5,
		ringIncrement: 2,
		rings: [
			{
				copies: 8,
				color: '#000000',
				templatePath: {
					cmds: ['M', 'C', 'C'],
					crds: [
						20, 134.83, 52, 134.72, 39.43, 95.94, 68.68, 75.99, 90.43, 61.16, 146, 62.76, 180,
						65.6
					]
				},
				secondaryTemplatePath: {
					cmds: ['M', 'C', 'C'],
					crds: [
						22, 78.31, 54, 78.2, 126.43, 157.42, 155.68, 137.47, 177.43, 122.64, 146, 53.24, 180,
						56.08
					]
				},
				morphT: 0,
				ringHeight: 0.2
			},
			{
				copies: 8,
				color: '#000000',
				templatePath: {
					cmds: ['M', 'C', 'C'],
					crds: [
						22, 62.79, 61, 62.68, 64.43, 157.9, 93.68, 137.95, 115.43, 123.12, 116, 85.72, 180,
						87.56
					]
				},
				secondaryTemplatePath: {
					cmds: ['M', 'C', 'C'],
					crds: [
						20, 134.99, 59, 134.88, 39.43, 81.1, 68.68, 61.15, 90.43, 46.32, 116, 131.92, 180,
						84.76
					]
				},
				morphT: 0,
				ringHeight: 0.12
			}
		],
		monochromePalettes: [{ main: '#000000', bg: '#ffffff' }],
		fullPalettes: [{ colors: ['#000000', '#ffffff'] }]
	};

	function setupCanvas(canvas: HTMLCanvasElement) {
		const scope = new paper.PaperScope();
		scope.setup(canvas);
		const pipeline = createRenderPipeline();

		pipeline.render({
			composition: HERO_COMPOSITION,
			scope,
			viewport: {
				width: scope.view.size.width,
				height: scope.view.size.height,
				padding: 24
			}
		});

		return () => {
			scope.project.clear();
			pipeline.dispose();
		};
	}
</script>

<div
	class="flex items-center justify-center"
	aria-hidden="true"
	data-testid="about-hero-ring"
>
	<canvas
		{@attach setupCanvas}
		width="320"
		height="320"
		class="rounded-lg"
	></canvas>
</div>
```

- [ ] **Step 2: Wire the component into the About page**

Open `src/routes/about/+page.svelte` and replace the entire file contents with:

```svelte
<script lang="ts">
	import AboutHeroRing from '$lib/components/AboutHeroRing.svelte';
</script>

<svelte:head><title>About — logo-bettona</title></svelte:head>

<div class="min-h-screen w-full bg-background text-foreground">
	<header class="border-b">
		<div class="mx-auto flex max-w-[1100px] items-center px-6 py-3">
			<a href="/" class="text-sm text-muted-foreground hover:text-foreground" data-testid="about-back-link">
				← Back
			</a>
		</div>
	</header>

	<main class="mx-auto max-w-[1100px] px-6 py-16">
		<section class="flex flex-col items-center gap-6 text-center">
			<h1 class="text-5xl font-semibold tracking-tight">logo-bettona</h1>
			<p class="max-w-xl text-muted-foreground">
				Strumento per generare loghi a forma di anello.
			</p>
			<AboutHeroRing />
		</section>
	</main>
</div>
```

- [ ] **Step 3: Run dev server and verify static ring renders**

Run: `bun run dev`
Open: http://localhost:5173/about
Expected: Title `logo-bettona`, tagline below, and a static ring composition rendered in a 320x320 canvas under the tagline. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/AboutHeroRing.svelte src/routes/about/+page.svelte
git commit -m "feat(about): render hero section with static hardcoded ring preset"
```

---

## Task 5: Animate the hero ring with a local `morphT` loop

**Files:**

- Modify: `src/lib/components/AboutHeroRing.svelte`

- [ ] **Step 1: Replace `setupCanvas` with an animated version**

Open `src/lib/components/AboutHeroRing.svelte`. Replace the existing `setupCanvas` function with:

```ts
const ANIMATION_DURATION_MS = 4000;

function setupCanvas(canvas: HTMLCanvasElement) {
	const scope = new paper.PaperScope();
	scope.setup(canvas);
	const pipeline = createRenderPipeline();

	const rings = HERO_COMPOSITION.rings.map((ring) => ({ ...ring }));
	const localComposition: Composition = { ...HERO_COMPOSITION, rings };

	let rafId: number | null = null;
	let startMs: number | null = null;

	function frame(nowMs: number) {
		if (startMs === null) startMs = nowMs;
		const elapsed = nowMs - startMs;
		const cycles = elapsed / ANIMATION_DURATION_MS;
		const cyclePos = cycles % 2;
		const t = cyclePos <= 1 ? cyclePos : 2 - cyclePos;

		for (let i = 0; i < rings.length; i++) {
			rings[i] = { ...rings[i], morphT: t };
		}
		localComposition.rings = rings;

		pipeline.render({
			composition: localComposition,
			scope,
			viewport: {
				width: scope.view.size.width,
				height: scope.view.size.height,
				padding: 24
			}
		});

		rafId = requestAnimationFrame(frame);
	}

	rafId = requestAnimationFrame(frame);

	return () => {
		if (rafId !== null) cancelAnimationFrame(rafId);
		scope.project.clear();
		pipeline.dispose();
	};
}
```

- [ ] **Step 2: Run dev server and verify animation**

Run: `bun run dev`
Open: http://localhost:5173/about
Expected: The hero ring continuously morphs between its primary and secondary shapes (triangle wave, ~4 seconds per cycle, alternating). Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/AboutHeroRing.svelte
git commit -m "feat(about): animate hero ring morph with local rAF loop"
```

---

## Task 6: Add component test for `AboutHeroRing`

**Files:**

- Create: `src/lib/components/AboutHeroRing.svelte.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/AboutHeroRing.svelte.spec.ts`:

```ts
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AboutHeroRing from './AboutHeroRing.svelte';

describe('AboutHeroRing', () => {
	it('mounts and renders a canvas', async () => {
		render(AboutHeroRing);

		const wrapper = page.getByTestId('about-hero-ring');
		await expect.element(wrapper).toBeInTheDocument();

		const wrapperElement = await wrapper.element();
		const canvas = wrapperElement.querySelector('canvas');
		expect(canvas, 'Expected a <canvas> inside the hero ring wrapper').not.toBeNull();
	});
});
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `bun run test:unit -- --run src/lib/components/AboutHeroRing.svelte.spec.ts`
Expected: PASS — `AboutHeroRing` mounts and exposes a canvas under the `about-hero-ring` wrapper.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/AboutHeroRing.svelte.spec.ts
git commit -m "test(about): assert AboutHeroRing mounts with a canvas"
```

---

## Task 7: Add the 2-column "What it is / How to use" grid

**Files:**

- Modify: `src/routes/about/+page.svelte`

- [ ] **Step 1: Add the grid section below the hero**

Open `src/routes/about/+page.svelte`. Replace the entire `<main>` block with:

```svelte
<main class="mx-auto max-w-[1100px] px-6 py-16">
	<section class="flex flex-col items-center gap-6 text-center">
		<h1 class="text-5xl font-semibold tracking-tight">logo-bettona</h1>
		<p class="max-w-xl text-muted-foreground">
			Strumento per generare loghi a forma di anello.
		</p>
		<AboutHeroRing />
	</section>

	<section class="mt-20 grid grid-cols-1 gap-8 md:grid-cols-2">
		<article class="rounded-lg border p-6">
			<h2 class="text-xl font-semibold">Cos'è</h2>
			<p class="mt-3 text-sm text-muted-foreground">
				Editor interattivo per creare loghi circolari. Configura colori, anima percorsi,
				esporta. Pensato per designer che vogliono iterare velocemente su identità visive
				radiali.
			</p>
		</article>

		<article class="rounded-lg border p-6">
			<h2 class="text-xl font-semibold">Come si usa</h2>
			<ul class="mt-3 space-y-3 text-sm text-muted-foreground">
				<li>
					<span class="font-medium text-foreground">Colors</span> — Imposta palette
					monocromatica o piena. Definisce colori anello e sfondo.
				</li>
				<li>
					<span class="font-medium text-foreground">Animation</span> — Anima percorsi
					anello. Scegli driver (es. anime.js) e parametri.
				</li>
				<li>
					<span class="font-medium text-foreground">Settings</span> — Geometria anello:
					raggio, spessore, segmenti.
				</li>
			</ul>
		</article>
	</section>
</main>
```

- [ ] **Step 2: Run dev server and verify grid layout**

Run: `bun run dev`
Open: http://localhost:5173/about
Expected: Below the animated hero, two side-by-side cards titled `Cos'è` and `Come si usa`. On a narrow viewport (resize browser below ~768px), cards stack vertically. Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/routes/about/+page.svelte
git commit -m "feat(about): add 2-column grid with project description and usage"
```

---

## Task 8: Add component test for About page structure

**Files:**

- Create: `src/routes/about/page.svelte.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/routes/about/page.svelte.spec.ts`:

```ts
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AboutPage from './+page.svelte';

describe('About page', () => {
	it('renders Back link, hero title, tagline, hero ring, and both cards', async () => {
		render(AboutPage);

		await expect.element(page.getByTestId('about-back-link')).toBeInTheDocument();
		await expect.element(page.getByRole('heading', { level: 1, name: 'logo-bettona' })).toBeInTheDocument();
		await expect.element(page.getByText('Strumento per generare loghi a forma di anello.')).toBeInTheDocument();
		await expect.element(page.getByTestId('about-hero-ring')).toBeInTheDocument();
		await expect.element(page.getByRole('heading', { level: 2, name: "Cos'è" })).toBeInTheDocument();
		await expect.element(page.getByRole('heading', { level: 2, name: 'Come si usa' })).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `bun run test:unit -- --run src/routes/about/page.svelte.spec.ts`
Expected: PASS — every element asserted above is present in the rendered About page.

- [ ] **Step 3: Commit**

```bash
git add src/routes/about/page.svelte.spec.ts
git commit -m "test(about): assert About page structure renders all required parts"
```

---

## Task 9: Final verification

- [ ] **Step 1: Run the full unit test suite**

Run: `bun run test:unit -- --run`
Expected: All tests pass, including the new `AboutHeroRing` and About page tests, with no regressions in existing component tests.

- [ ] **Step 2: Run the Playwright e2e suite**

Run: `bun run test:e2e`
Expected: All e2e tests pass, including the new `about-nav.spec.ts`.

- [ ] **Step 3: Run lint and type checks**

Run: `bun run lint && bun run check`
Expected: No lint errors. No type errors.

- [ ] **Step 4: Manual smoke**

Run: `bun run dev`
Open: http://localhost:5173/
- Confirm `About` link appears in the top-right of the header.
- Click it; confirm navigation to `/about`.
- Confirm the hero title, tagline, and animated ring are visible; the ring morphs continuously.
- Confirm two cards appear below in a 2-column grid on desktop and stacked on mobile.
- Click `← Back`; confirm return to the main editor with the sidebar visible.

Stop the dev server.

- [ ] **Step 5: Done — no further commit needed**

All work was committed task-by-task. The branch is ready for review.

---

## Notes for the implementer

- The hero ring uses its own local `Composition` constant inside `AboutHeroRing.svelte`. Do not import or read the global `composition` / `colorMode` / `animationState` stores from this component. Keeping it isolated is the whole point of Task 4–5.
- The render pipeline (`createRenderPipeline`) accepts any `Composition` object; passing `HERO_COMPOSITION` is fine and matches the type. See `src/lib/geometry/render-pipeline.ts` for the input contract.
- The animation in Task 5 is intentionally simple: a triangle wave over `morphT` driven by `requestAnimationFrame`. It does not use `$lib/state/animation` (that module is hardwired to the global composition store).
- `aria-hidden="true"` on the hero ring wrapper is correct — the ring is decorative; the page's textual content carries the meaning.
- Tailwind classes (`bg-background`, `text-foreground`, `text-muted-foreground`, `border`, `rounded-lg`) are existing shadcn tokens already in use by `PreviewCanvas.svelte` and `Sidebar.svelte`. No new tokens are introduced.
