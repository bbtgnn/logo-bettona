# Tool Restructure (Editor / Animate / Paths) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the tool into three URL-routed sections (`/editor`, `/animate`, `/paths`) sharing one persistent shell-level canvas, and consolidate the three overlapping animation surfaces into Animate.

**Architecture:** A SvelteKit route group `(app)` owns a layout that holds the sidebar shell + a persistent `PreviewCanvas` in the inset; child pages `editor` and `animate` render only their own sidebar controls via `{@render children()}`. Navigating Editor↔Animate stays inside that layout so the canvas (and the running animation) never remounts. `/paths` lives outside the group (no canvas). All app state is already in shared singletons (`composition`, `keyframes`, `animation`), so the mark is identical across routes with no extra wiring.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript, bun, vitest (`vitest-browser-svelte`, chromium project), Playwright e2e, shadcn-svelte sidebar, Tailwind, paper.js.

## Global Constraints

- Package manager **bun**. Single spec: `bun run test:unit -- run <path>`. Full suite (before every commit): `bun run test:unit -- run`. Type check: `bun run check`.
- Every `.svelte` file MUST pass the `svelte-autofixer` MCP with `issues: []` before commit. The `bind:this`→attachment SUGGESTION and "function called/declared inside `$effect`" suggestions are known false positives — ignore ONLY those; `issues: []` (no *issues*) is the gate, suggestions may remain.
- **Tailwind is NOT loaded in the vitest browser DOM** → never assert `getBoundingClientRect`/computed layout. Assert structure, `data-testid`, `className`, `textContent`, ARIA roles/labels only.
- **Shared `keyframes` singleton across the chromium project** → any spec that arms a track (`setTrackEnabled(...,true)`) MUST clean up (`afterEach` disarm or `beforeEach` wipe) or it pollutes `keyframes.svelte.spec.ts`.
- Label/text queries that could substring-match other text use `{ exact: true }`.
- **Tabs/indentation:** `.svelte`/`.ts` use TAB indentation (match surrounding files).
- Keep the suite green: today **372 unit tests** pass and `bun run check` reports **0 errors**.
- This plan covers spec slices 1–5 only. Spec slices 6–7 (Paths archive, animation presets) are a later cycle with their own brainstorm.

---

## File Structure

**Created:**
- `src/routes/+page.ts` — root redirect `/` → `/editor`.
- `src/routes/(app)/+layout.svelte` — canvas shell: sidebar (renders page children) + inset (tabs header + persistent `PreviewCanvas` + conditional timeline area).
- `src/routes/(app)/+layout.spec.ts` — shell smoke test (sidebar present, canvas present).
- `src/routes/(app)/editor/+page.svelte` — Editor controls (today's sidebar minus Animation).
- `src/routes/(app)/editor/page.svelte.spec.ts` — Editor renders its sections, not Animation.
- `src/routes/(app)/animate/+page.svelte` — Animate controls (audio + duration/play, relocated; export moves in slice 2).
- `src/routes/(app)/animate/page.svelte.spec.ts` — Animate renders its controls + timeline.
- `src/lib/components/WorkspaceNav.svelte` — the Editor/Animate/Paths tab bar with active state.
- `src/lib/components/WorkspaceNav.svelte.spec.ts` — tab links + active state.
- `src/routes/(app)/workspace-nav.e2e.ts` — Playwright nav between the three sections.

**Modified:**
- `src/routes/+page.svelte` — deleted (replaced by redirect + `(app)/editor`). (Removed in Task 2.)
- `src/lib/components/PreviewCanvas.svelte` — slice 2/3: export buttons relocated, single duration.
- `src/lib/components/TimelinePanel.svelte` — slice 2: always-open in Animate (drop `kaleidoscope.enabled` presence gate); slice 5: graph default-select.
- `src/lib/components/AnimationSection.svelte` — broken up across slices 2–4 (audio panel, duration, audio-as-layer).
- `src/lib/state/animation.svelte.ts` — slice 3 (single duration), slice 4 (audio non-exclusive).
- `src/routes/paths/+page.svelte` — slice 1: header uses `WorkspaceNav`.
- `src/routes/about/about-nav.e2e.ts` — slice 1: header testids/labels changed.

---

## SLICE 1 — Shell + tabs (pure reorganization, no behavior change)

### Task 1: WorkspaceNav tab bar

**Files:**
- Create: `src/lib/components/WorkspaceNav.svelte`
- Test: `src/lib/components/WorkspaceNav.svelte.spec.ts`

**Interfaces:**
- Consumes: SvelteKit `page` store from `$app/state` (`page.url.pathname`).
- Produces: `<WorkspaceNav />` — renders three links (`/editor`, `/animate`, `/paths`) with `data-testid` `nav-editor`, `nav-animate`, `nav-paths`; the link matching the current pathname gets `aria-current="page"`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/WorkspaceNav.svelte.spec.ts
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import WorkspaceNav from './WorkspaceNav.svelte';

describe('WorkspaceNav', () => {
	it('renders the three section tabs with hrefs', async () => {
		render(WorkspaceNav);
		await expect.element(page.getByTestId('nav-editor')).toHaveAttribute('href', '/editor');
		await expect.element(page.getByTestId('nav-animate')).toHaveAttribute('href', '/animate');
		await expect.element(page.getByTestId('nav-paths')).toHaveAttribute('href', '/paths');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/components/WorkspaceNav.svelte.spec.ts`
Expected: FAIL — cannot resolve `./WorkspaceNav.svelte`.

- [ ] **Step 3: Write minimal implementation**

```svelte
<!-- src/lib/components/WorkspaceNav.svelte -->
<script lang="ts">
	import { page } from '$app/state';

	const tabs = [
		{ href: '/editor', label: 'Editor', testid: 'nav-editor' },
		{ href: '/animate', label: 'Animate', testid: 'nav-animate' },
		{ href: '/paths', label: 'Paths', testid: 'nav-paths' }
	];
</script>

<nav class="flex items-center gap-1" data-testid="workspace-nav">
	{#each tabs as tab (tab.href)}
		<a
			href={tab.href}
			data-testid={tab.testid}
			aria-current={page.url.pathname.startsWith(tab.href) ? 'page' : undefined}
			class="rounded px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground"
		>
			{tab.label}
		</a>
	{/each}
</nav>
```

- [ ] **Step 4: Run `svelte-autofixer` on `WorkspaceNav.svelte`** until `issues: []`.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/components/WorkspaceNav.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/WorkspaceNav.svelte src/lib/components/WorkspaceNav.svelte.spec.ts
git commit -m "feat: WorkspaceNav tab bar for Editor/Animate/Paths"
```

---

### Task 2: `(app)` shell layout + Editor/Animate routes + root redirect

This is the structural heart of slice 1. It moves the current single-page UI into the route group, splitting the sidebar so Editor renders everything except Animation and Animate renders the animation controls. **No control changes — content is relocated verbatim.**

**Files:**
- Create: `src/routes/+page.ts`
- Create: `src/routes/(app)/+layout.svelte`
- Create: `src/routes/(app)/+layout.spec.ts`
- Create: `src/routes/(app)/editor/+page.svelte`
- Create: `src/routes/(app)/editor/page.svelte.spec.ts`
- Create: `src/routes/(app)/animate/+page.svelte`
- Create: `src/routes/(app)/animate/page.svelte.spec.ts`
- Delete: `src/routes/+page.svelte`

**Interfaces:**
- Consumes: `WorkspaceNav` (Task 1); existing `Sidebar`'s child sections (`SettingsSection`, `CanvasSection`, `KaleidoscopeSection`, `RingEditor`, `ColorsSection`, `AnimationSection`); `PreviewCanvas`; `TimelinePanel`; `composition`, `addRing`, `reorderRings` from `$lib/state/composition`.
- Produces: routes `/editor` and `/animate` rendering inside the `(app)` layout; the layout exposes `data-testid="sidebar-content"` (sidebar) and `data-testid="app-canvas"` (canvas wrapper).

- [ ] **Step 1: Write the failing layout smoke test**

```ts
// src/routes/(app)/+layout.spec.ts
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Layout from './+layout.svelte';

describe('(app) shell layout', () => {
	it('renders the workspace nav and the persistent canvas wrapper', async () => {
		render(Layout, { props: { children: () => {} } });
		await expect.element(page.getByTestId('workspace-nav')).toBeInTheDocument();
		await expect.element(page.getByTestId('app-canvas')).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run "src/routes/(app)/+layout.spec.ts"`
Expected: FAIL — cannot resolve `./+layout.svelte`.

- [ ] **Step 3: Create the `(app)` layout**

The layout owns the sidebar shell and the persistent canvas. The page (`{@render children()}`) renders the route's sidebar sections inside `SidebarContent`. The timeline area shows only on `/animate`.

```svelte
<!-- src/routes/(app)/+layout.svelte -->
<script lang="ts">
	import { page } from '$app/state';
	import * as SidebarUI from '$lib/shadcn/ui/sidebar/index.js';
	import WorkspaceNav from '$lib/components/WorkspaceNav.svelte';
	import PreviewCanvas from '$lib/components/PreviewCanvas.svelte';
	import TimelinePanel from '$lib/components/TimelinePanel.svelte';

	let { children } = $props();

	const isAnimate = $derived(page.url.pathname.startsWith('/animate'));
</script>

<SidebarUI.SidebarProvider>
	<SidebarUI.Sidebar>
		<SidebarUI.SidebarContent class="divide-y divide-border" data-testid="sidebar-content">
			{@render children()}
		</SidebarUI.SidebarContent>
	</SidebarUI.Sidebar>

	<SidebarUI.SidebarInset>
		<header class="flex items-center gap-2 border-b p-4">
			<SidebarUI.SidebarTrigger />
			<WorkspaceNav />
			<a
				href="/about"
				class="ml-auto text-sm text-muted-foreground hover:text-foreground"
				data-testid="header-about-link"
			>
				About
			</a>
		</header>
		<main class="flex flex-1 items-center justify-center p-8" data-testid="app-canvas">
			<PreviewCanvas />
		</main>
		{#if isAnimate}
			<TimelinePanel />
		{/if}
	</SidebarUI.SidebarInset>
</SidebarUI.SidebarProvider>
```

- [ ] **Step 4: Run `svelte-autofixer` on `(app)/+layout.svelte`** until `issues: []`.

- [ ] **Step 5: Run the layout test to verify it passes**

Run: `bun run test:unit -- run "src/routes/(app)/+layout.spec.ts"`
Expected: PASS.

- [ ] **Step 6: Write the failing Editor page test**

```ts
// src/routes/(app)/editor/page.svelte.spec.ts
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import EditorPage from './+page.svelte';

describe('Editor page', () => {
	it('renders the Rings add button but not the Animation section', async () => {
		render(EditorPage);
		await expect.element(page.getByRole('button', { name: 'Add Ring' })).toBeInTheDocument();
		await expect.element(page.getByText('Animation', { exact: true })).not.toBeInTheDocument();
	});
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `bun run test:unit -- run "src/routes/(app)/editor/page.svelte.spec.ts"`
Expected: FAIL — cannot resolve `./+page.svelte`.

- [ ] **Step 8: Create the Editor page**

Move the body of the current `Sidebar.svelte` **minus** `AnimationSection` here, including the ring drag handlers verbatim from `src/lib/components/Sidebar.svelte:13-34`. (Editor no longer needs the `SidebarUI.Sidebar`/`SidebarContent` wrappers — the layout supplies them.)

```svelte
<!-- src/routes/(app)/editor/+page.svelte -->
<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import SettingsSection from '$lib/components/SettingsSection.svelte';
	import CanvasSection from '$lib/components/CanvasSection.svelte';
	import KaleidoscopeSection from '$lib/components/KaleidoscopeSection.svelte';
	import RingEditor from '$lib/components/RingEditor.svelte';
	import ColorsSection from '$lib/components/ColorsSection.svelte';
	import SidebarCollapsible from '$lib/components/SidebarCollapsible.svelte';
	import { composition, addRing, reorderRings } from '$lib/state/composition';

	let dragFromIndex: number | null = null;

	function handleDragStart(index: number) {
		return (e: DragEvent) => {
			dragFromIndex = index;
			e.dataTransfer?.setData('text/plain', String(index));
		};
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
	}

	function handleDrop(toIndex: number) {
		return (e: DragEvent) => {
			e.preventDefault();
			if (dragFromIndex !== null && dragFromIndex !== toIndex) {
				reorderRings(dragFromIndex, toIndex);
			}
			dragFromIndex = null;
		};
	}
</script>

<SettingsSection />
<CanvasSection />
<KaleidoscopeSection />

<SidebarCollapsible>
	{#snippet trigger()}
		Rings
	{/snippet}

	{#snippet content()}
		<Button onclick={addRing} class="w-full">Add Ring</Button>

		{#if composition.rings.length === 0}
			<p class="py-8 text-center text-xs text-muted-foreground">
				No rings yet. Click "Add Ring" to start.
			</p>
		{:else}
			<div class="space-y-0.5">
				{#each composition.rings as ring, i (i)}
					<RingEditor
						{ring}
						index={i}
						ondragstart={handleDragStart(i)}
						ondragover={handleDragOver}
						ondrop={handleDrop(i)}
					/>
				{/each}
			</div>
		{/if}
	{/snippet}
</SidebarCollapsible>

<ColorsSection />
```

- [ ] **Step 9: Run `svelte-autofixer` on `editor/+page.svelte`** until `issues: []`. Then run the Editor test:

Run: `bun run test:unit -- run "src/routes/(app)/editor/page.svelte.spec.ts"`
Expected: PASS.

- [ ] **Step 10: Write the failing Animate page test**

```ts
// src/routes/(app)/animate/page.svelte.spec.ts
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AnimatePage from './+page.svelte';

describe('Animate page', () => {
	it('renders the Animation controls section', async () => {
		render(AnimatePage);
		await expect.element(page.getByText('Animation', { exact: true })).toBeInTheDocument();
	});
});
```

- [ ] **Step 11: Run it to verify it fails**

Run: `bun run test:unit -- run "src/routes/(app)/animate/page.svelte.spec.ts"`
Expected: FAIL — cannot resolve `./+page.svelte`.

- [ ] **Step 12: Create the Animate page**

In slice 1 this simply hosts the existing `AnimationSection` (relocated as-is). The timeline shows via the layout's `{#if isAnimate}` block.

```svelte
<!-- src/routes/(app)/animate/+page.svelte -->
<script lang="ts">
	import AnimationSection from '$lib/components/AnimationSection.svelte';
</script>

<AnimationSection />
```

- [ ] **Step 13: Run `svelte-autofixer` on `animate/+page.svelte`** until `issues: []`. Then run the Animate test:

Run: `bun run test:unit -- run "src/routes/(app)/animate/page.svelte.spec.ts"`
Expected: PASS.

- [ ] **Step 14: Add the root redirect and delete the old page**

```ts
// src/routes/+page.ts
import { redirect } from '@sveltejs/kit';

export function load() {
	redirect(307, '/editor');
}
```

Then delete the obsolete single page:

```bash
git rm src/routes/+page.svelte
```

(The old `Sidebar.svelte` is now unused but its child sections are still imported by the new pages. Leave `Sidebar.svelte` in place for now; it is removed in Task 3 once nothing references it.)

- [ ] **Step 15: Full suite + type check**

Run: `bun run test:unit -- run` then `bun run check`
Expected: all green, 0 type errors. (Existing `+page.svelte` specs that imported the old root page, if any, must be updated or removed — search with `grep -rl "routes/+page.svelte" src` and fix references.)

- [ ] **Step 16: Commit**

```bash
git add src/routes/+page.ts "src/routes/(app)" && git rm src/routes/+page.svelte
git commit -m "feat: split UI into (app) shell with /editor and /animate routes"
```

---

### Task 3: Point `/paths` and e2e at the new nav; retire dead `Sidebar.svelte`

**Files:**
- Modify: `src/routes/paths/+page.svelte:13-27` (header)
- Modify: `src/routes/about/about-nav.e2e.ts`
- Create: `src/routes/(app)/workspace-nav.e2e.ts`
- Delete: `src/lib/components/Sidebar.svelte`, `src/lib/components/Sidebar.svelte.spec.ts`

**Interfaces:**
- Consumes: `WorkspaceNav` (Task 1).
- Produces: `/paths` header shows the workspace tabs; e2e covers tab navigation.

- [ ] **Step 1: Add the tab nav to the Paths header**

In `src/routes/paths/+page.svelte`, import `WorkspaceNav` and render it in the header next to the title. Replace the `← Back` link block (lines 15-21) with the nav:

```svelte
<!-- in <script>: add -->
import WorkspaceNav from '$lib/components/WorkspaceNav.svelte';
```

```svelte
<!-- header inner: replace the back-link <a> with -->
<WorkspaceNav />
<span class="ml-4 text-sm font-semibold">Path Library</span>
<span class="ml-2 text-xs text-muted-foreground">({pathLibrary.entries.length})</span>
```

- [ ] **Step 2: Run `svelte-autofixer` on `paths/+page.svelte`** until `issues: []`.

- [ ] **Step 3: Update the about-nav e2e to the new header**

The old test used `header-about-link` then `about-back-link` and asserted "Shape Editor". The about link testid is preserved in the new layout, but the landing route is now `/editor` and the title text changed. Rewrite:

```ts
// src/routes/about/about-nav.e2e.ts
import { expect, test } from '@playwright/test';

test('navigates to About from the workspace and back', async ({ page }) => {
	await page.goto('/editor');

	await page.getByTestId('header-about-link').click();
	await expect(page).toHaveURL(/\/about$/);
	await expect(page.locator('h1')).toBeVisible();

	await page.getByTestId('about-back-link').click();
	await expect(page).toHaveURL(/\/(editor)?$/);
});
```

(If `about-back-link` points at `/`, the redirect lands on `/editor` — the URL regex above accepts both. If the e2e for the back link is brittle, confirm the about page's back-link `href`; leave it as `/`.)

- [ ] **Step 4: Add the workspace-nav e2e**

```ts
// src/routes/(app)/workspace-nav.e2e.ts
import { expect, test } from '@playwright/test';

test('tabs navigate between Editor, Animate and Paths', async ({ page }) => {
	await page.goto('/editor');
	await expect(page.getByTestId('nav-editor')).toHaveAttribute('aria-current', 'page');

	await page.getByTestId('nav-animate').click();
	await expect(page).toHaveURL(/\/animate$/);
	await expect(page.getByTestId('nav-animate')).toHaveAttribute('aria-current', 'page');

	await page.getByTestId('nav-paths').click();
	await expect(page).toHaveURL(/\/paths$/);
});

test('root redirects to /editor', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/editor$/);
});
```

- [ ] **Step 5: Delete the now-dead `Sidebar.svelte`**

Confirm nothing imports it: `grep -rl "components/Sidebar.svelte\b\|/Sidebar.svelte'" src` should return nothing (the new pages import the section components directly, not `Sidebar`). Then:

```bash
git rm src/lib/components/Sidebar.svelte src/lib/components/Sidebar.svelte.spec.ts
```

- [ ] **Step 6: Full unit suite + type check + e2e**

Run: `bun run test:unit -- run` then `bun run check`
Expected: green, 0 errors.
Run the e2e (dev server pattern per repo): `bun run test:e2e -- workspace-nav about-nav` (or the repo's configured e2e command). Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add src/routes/paths/+page.svelte "src/routes/(app)/workspace-nav.e2e.ts" src/routes/about/about-nav.e2e.ts
git rm src/lib/components/Sidebar.svelte src/lib/components/Sidebar.svelte.spec.ts
git commit -m "feat: route paths header + e2e through WorkspaceNav; drop dead Sidebar"
```

**SLICE 1 DONE:** three routes, persistent canvas, no behavior change. Review checkpoint.

---

## SLICE 2 — Consolidate Animate (one workspace, timeline always visible)

### Task 4: Always-visible timeline in Animate + export moved into Animate left column

**Files:**
- Modify: `src/lib/components/TimelinePanel.svelte:13` (`open` default) and its `kaleidoscope.enabled` presence gate.
- Modify: `src/lib/components/PreviewCanvas.svelte` (extract the export controls block).
- Create: `src/lib/components/ExportControls.svelte` (the export UI lifted out of `PreviewCanvas`).
- Create: `src/lib/components/ExportControls.svelte.spec.ts`
- Modify: `src/routes/(app)/animate/+page.svelte` (render `ExportControls`).
- Modify: `src/routes/(app)/animate/page.svelte.spec.ts`

**Interfaces:**
- Consumes: existing export functions in `PreviewCanvas.svelte` (`exportSvg`, `exportAnimation`, `exportKaleidoscopePng`, `exportKaleidoscopeSvg`) and their state (`exportStatus`, `exportProgress`, `exportDurationSec`, `exportAudio`).
- Produces: `<ExportControls />` usable in the Animate sidebar; `TimelinePanel` open by default and present regardless of `kaleidoscope.enabled`.

> **Decision for this task:** the export logic currently lives inside `PreviewCanvas.svelte` because it needs the paper.js scope/canvas element. Lifting the *buttons* out while leaving the export *functions* coupled to the canvas requires either (a) exposing the export actions from a shared module, or (b) keeping export inside `PreviewCanvas` but hiding it unless on `/animate`. **Choose (b) for this slice** — it is the smaller, lower-risk change and keeps the paper.js coupling intact. Revisit (a) only if Animate needs the export buttons in the left column visually (cosmetic, deferrable).

- [ ] **Step 1: Write the failing test — timeline open by default**

```ts
// add to src/routes/(app)/animate/page.svelte.spec.ts
it('shows the timeline expanded by default (not collapsed behind a chevron)', async () => {
	render(AnimatePage);
	// The ruler is only in the DOM when the panel is open.
	await expect.element(page.getByTestId('timeline-ruler')).toBeInTheDocument();
});
```

(Confirm the ruler's `data-testid` in `TimelineRuler.svelte`; if it differs, query the actual testid. If none exists, add `data-testid="timeline-ruler"` to the ruler root as part of this step.)

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test:unit -- run "src/routes/(app)/animate/page.svelte.spec.ts"`
Expected: FAIL — ruler not in document (panel starts closed / `AnimatePage` doesn't mount the panel).

- [ ] **Step 3: Mount the timeline in the Animate page and open it by default**

The timeline currently renders from the `(app)` layout's `{#if isAnimate}` block. Move it into `animate/+page.svelte` so the Animate page owns its full workspace, and remove the `{#if isAnimate} <TimelinePanel/> {/if}` from the layout.

```svelte
<!-- src/routes/(app)/animate/+page.svelte -->
<script lang="ts">
	import AnimationSection from '$lib/components/AnimationSection.svelte';
</script>

<AnimationSection />
```

The `TimelinePanel` belongs under the canvas (inset), not in the sidebar — so keep it in the layout but make it conditional-free for `/animate` (the `{#if isAnimate}` stays). The behavior change here is internal to `TimelinePanel`: make it **open by default** and drop the `kaleidoscope.enabled` presence gate. In `TimelinePanel.svelte`:

```svelte
<!-- line 13: was  let open = $state(false); -->
let open = $state(true);
```

Find the `kaleidoscope.enabled` guard that wraps the panel markup (it gates the whole panel) and remove that conditional so the panel always renders. Keep the `kaleidoscope` import only if still used elsewhere in the file; if it becomes unused, delete the import to satisfy `bun run check`.

- [ ] **Step 4: Run `svelte-autofixer` on `TimelinePanel.svelte` and `(app)/+layout.svelte`** until `issues: []`.

- [ ] **Step 5: Run the Animate test to verify it passes**

Run: `bun run test:unit -- run "src/routes/(app)/animate/page.svelte.spec.ts"`
Expected: PASS.

- [ ] **Step 6: Check the kaleidoscope-gate change did not break existing TimelinePanel specs**

Run: `bun run test:unit -- run src/lib/components/TimelinePanel.svelte.spec.ts`
Expected: if a spec asserted the panel is absent when `kaleidoscope.enabled` is false, update it to reflect the panel is now always present (the gate moved to the route: the panel only mounts on `/animate`). Adjust assertions, keep `afterEach` track-disarm cleanup intact.

- [ ] **Step 7: Full suite + type check**

Run: `bun run test:unit -- run` then `bun run check`
Expected: green, 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/components/TimelinePanel.svelte "src/routes/(app)" 
git commit -m "feat: timeline always visible in Animate (drop kaleidoscope.enabled gate)"
```

---

## SLICE 3 — Single duration (play + export share one value)

### Task 5: Unify `exportDurationSec` into `animationState.durationSec`

**Files:**
- Modify: `src/lib/components/PreviewCanvas.svelte:28` (remove local `exportDurationSec`), and its export call + the duration `<Input>` (lines ~111-113, ~267-277).
- Modify: `src/lib/components/AnimationSection.svelte` (duration field stays the single source).
- Test: `src/lib/components/PreviewCanvas.svelte.spec.ts`

**Interfaces:**
- Consumes: `animationState.durationSec`, `setAnimationDurationSec` from `$lib/state/animation`.
- Produces: export uses `animationState.durationSec`; no separate export-duration control remains.

- [ ] **Step 1: Write the failing test**

```ts
// add to src/lib/components/PreviewCanvas.svelte.spec.ts
import { animationState, setAnimationDurationSec } from '$lib/state/animation';

it('uses the shared animation duration for export, with no separate export-duration field', async () => {
	setAnimationDurationSec(7);
	render(PreviewCanvas);
	// the old separate export-duration input is gone
	await expect.element(page.getByLabelText('Durata (s)', { exact: true })).not.toBeInTheDocument();
	// shared duration is what export will read
	expect(animationState.durationSec).toBe(7);
});
```

(Match the existing render/setup pattern in `PreviewCanvas.svelte.spec.ts`. If `Durata (s)` exists in more than one place, scope the query to the export region's testid.)

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test:unit -- run src/lib/components/PreviewCanvas.svelte.spec.ts`
Expected: FAIL — the export-duration input still present.

- [ ] **Step 3: Replace `exportDurationSec` with the shared duration**

In `PreviewCanvas.svelte`:
- Remove `let exportDurationSec = $state(5);` (line 28).
- In `exportAnimation()`, change `durationSec: exportDurationSec` to `durationSec: animationState.durationSec`.
- Delete the export-duration `<Label for="export-duration">Durata (s)</Label>` + its `<Input>` block (the `id="export-duration"` field) and its `oninput` handler.
- Ensure `animationState` is imported (it already is, line 6).

- [ ] **Step 4: Run `svelte-autofixer` on `PreviewCanvas.svelte`** until `issues: []`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun run test:unit -- run src/lib/components/PreviewCanvas.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 6: Full suite + type check**

Run: `bun run test:unit -- run` then `bun run check`
Expected: green, 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/PreviewCanvas.svelte src/lib/components/PreviewCanvas.svelte.spec.ts
git commit -m "feat: single animation duration for both playback and export"
```

---

## SLICE 4 — Audio as an always-on layer (decouple from exclusive mode)

> **Most delicate slice.** Today `animationState.mode` is a single exclusive selector (`simple` | `audioBars` | `audioZones` | `dataSeries` | null). The runtime already layers kaleidoscope keyframes on top every tick (`animation.svelte.ts:260-261`). The goal: audio-reactivity must be available **together** with the kaleidoscope timeline, not as an either/or. `simple` (morph) and `dataSeries` remain alternative non-audio drivers.

### Task 6: Confirm and lock current layering behavior with a test (no production change)

Establish the safety net before changing UI/state.

**Files:**
- Test: `src/lib/state/animation.svelte.spec.ts`

- [ ] **Step 1: Write a characterization test asserting keyframes apply regardless of mode**

```ts
// add to src/lib/state/animation.svelte.spec.ts
import { keyframes } from '$lib/state/keyframes.svelte';
import { KALEIDO_GLOBAL_ROTATION } from '$lib/state/keyframes.svelte';
// ^ adjust the rotation-param import/const name to the registry's actual export

it('applies kaleidoscope keyframes on tick even when mode is audioBars', () => {
	// arm a rotation track with two keyframes 0->1
	keyframes.setTrackEnabled(KALEIDO_GLOBAL_ROTATION, true);
	keyframes.addKeyframe(KALEIDO_GLOBAL_ROTATION, { time: 0, value: 0 });
	keyframes.addKeyframe(KALEIDO_GLOBAL_ROTATION, { time: 1, value: 100 });

	animationState.mode = 'audioBars';
	applyKaleidoscopeKeyframes(0.5);

	const sampled = keyframes.sampleParam(KALEIDO_GLOBAL_ROTATION, 0.5);
	expect(sampled).not.toBeNull();

	// cleanup — shared singleton
	keyframes.setTrackEnabled(KALEIDO_GLOBAL_ROTATION, false);
});
```

(Adjust `addKeyframe`/`sampleParam` signatures to the real `keyframes.svelte.ts` API — read it first. The point is to lock: keyframes sample non-null while `mode` is an audio mode. Keep singleton cleanup.)

- [ ] **Step 2: Run it — it should PASS already** (characterization)

Run: `bun run test:unit -- run src/lib/state/animation.svelte.spec.ts`
Expected: PASS (documents existing behavior; guards the refactor).

- [ ] **Step 3: Commit**

```bash
git add src/lib/state/animation.svelte.spec.ts
git commit -m "test: lock kaleidoscope keyframes layering on top of audio mode"
```

---

### Task 7: Reframe the Animate audio UI so audio is a toggle, not an exclusive choice vs. the timeline

The UI change: the audio panel presents audio-reactivity as an always-available layer (on/off + source + per-band), separate from selecting `simple`/`dataSeries`. The timeline is independent and always present. The exclusive `mode` dropdown's audio entries become an "Audio reactivity" toggle; `simple`/`dataSeries`/none remain a separate "Motion source" choice for non-audio driving.

**Files:**
- Modify: `src/lib/components/AnimationSection.svelte` (split the single `mode` dropdown into: Audio reactivity on/off [+ source + band knobs] AND a Motion source selector for `simple`/`dataSeries`/none).
- Modify: `src/lib/state/animation.svelte.ts` if a representation change is needed (see decision below).
- Test: `src/lib/components/AnimationSection.svelte.spec.ts`

**Interfaces:**
- Consumes: `animationState.mode`, `setAnimationMode`, audio config setters.
- Produces: an Animate audio section where turning audio on does not blank the timeline, and vice versa.

> **State-shape decision:** Minimize churn. Keep `animationState.mode` as the driver selector but change the *UI* so that choosing an audio mode is presented as "Audio reactivity ON" and the timeline remains visible/active alongside (it already does at runtime). Do NOT introduce a parallel boolean unless a test proves the single `mode` cannot express "audio + timeline together". Since keyframes already ride the clock independent of `mode` (Task 6 proves it), **no `animationState` change is required** — this is a UI clarity task. If during implementation you find audio and a non-audio driver genuinely need to coexist (e.g. `simple` morph + `audioBars`), stop and escalate: that is a runtime change beyond this slice's scope.

- [ ] **Step 1: Write the failing test**

```ts
// add to src/lib/components/AnimationSection.svelte.spec.ts
it('labels audio reactivity as its own control, not an entry in a single mode dropdown', async () => {
	render(AnimationSection);
	// New: an explicit audio-reactivity control exists
	await expect.element(page.getByTestId('audio-reactivity-toggle')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test:unit -- run src/lib/components/AnimationSection.svelte.spec.ts`
Expected: FAIL — no `audio-reactivity-toggle`.

- [ ] **Step 3: Implement the UI split**

In `AnimationSection.svelte`, replace the single `select#animation-mode` with two controls:

1. **Audio reactivity** — a toggle (`data-testid="audio-reactivity-toggle"`) that switches `mode` between an audio mode (`audioBars` by default, or `audioZones`) and a non-audio state. When ON, show the existing audio source + band/gain controls (the existing `audioBars`/`audioZones` blocks).
2. **Motion source** — a small selector for `simple` / `dataSeries` / none, used when audio is OFF.

Wire the toggle through `setAnimationMode(...)` with the existing values; do not add new `mode` enum values. Keep all existing audio sub-controls verbatim. Copy text in Italian to match the file's existing strings.

- [ ] **Step 4: Run `svelte-autofixer` on `AnimationSection.svelte`** until `issues: []`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun run test:unit -- run src/lib/components/AnimationSection.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 6: Full suite + type check**

Run: `bun run test:unit -- run` then `bun run check`
Expected: green, 0 errors. Update any existing `AnimationSection` spec that selected `#animation-mode` to the new controls.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/AnimationSection.svelte src/lib/components/AnimationSection.svelte.spec.ts
git commit -m "feat: present audio reactivity as an always-on layer, not an exclusive mode"
```

---

## SLICE 5 — Graph Editor polish in Animate

### Task 8: Graph Editor default-selects a parameter that already has keyframes

**Files:**
- Modify: `src/lib/components/TimelinePanel.svelte` (the `graphParamId` / `graphParam` derivation around lines 15, 58-60).
- Test: `src/lib/components/TimelinePanel.svelte.spec.ts`

**Interfaces:**
- Consumes: `keyframes.tracks`, `KALEIDO_PARAMS`, `armedParams`.
- Produces: when opening the Graph view, `graphParam` defaults to the first armed param that has at least one keyframe (falls back to first armed param, then null).

- [ ] **Step 1: Write the failing test**

```ts
// add to src/lib/components/TimelinePanel.svelte.spec.ts — with the file's existing
// arm/cleanup helpers and afterEach disarm.
it('graph view defaults to a param that already has keyframes', async () => {
	// arm two params; only the second has keyframes (use the file's existing setup helpers)
	// ... arm paramA (no keyframes), arm paramB (+ one keyframe) ...
	render(TimelinePanel);
	// switch to graph view via its tab
	await page.getByRole('tab', { name: 'Graph Editor' }).click();
	// the graph shows paramB's curve, not the empty paramA
	await expect.element(page.getByTestId('graph-curve')).toBeInTheDocument();
});
```

(Use the real arming helpers and testids already in `TimelinePanel.svelte.spec.ts`; confirm the graph tab's accessible name and the curve/empty testids in `KeyframeGraphEditor.svelte`. Keep `afterEach` track-disarm.)

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test:unit -- run src/lib/components/TimelinePanel.svelte.spec.ts`
Expected: FAIL — graph defaults to the first armed param (empty), curve absent.

- [ ] **Step 3: Update the graph default selection**

In `TimelinePanel.svelte`, change the `graphParam` derivation so the fallback prefers an armed param with keyframes:

```ts
const graphParam = $derived(
	armedParams.find((p) => p.id === graphParamId) ??
		armedParams.find((p) => (keyframes.tracks[p.id]?.keyframes.length ?? 0) > 0) ??
		armedParams[0] ??
		null
);
```

- [ ] **Step 4: Run `svelte-autofixer` on `TimelinePanel.svelte`** until `issues: []`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun run test:unit -- run src/lib/components/TimelinePanel.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 6: Full suite + type check**

Run: `bun run test:unit -- run` then `bun run check`
Expected: green, 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/TimelinePanel.svelte src/lib/components/TimelinePanel.svelte.spec.ts
git commit -m "feat: graph editor defaults to a param that has keyframes"
```

**SLICE 5 DONE — plan complete.** Final whole-branch review recommended before merge.

---

## Self-Review notes

- **Spec coverage:** Slice 1 (shell+tabs) → Tasks 1-3. Slice 2 (consolidate Animate) → Task 4. Slice 3 (single duration) → Task 5. Slice 4 (audio as layer) → Tasks 6-7. Slice 5 (graph polish) → Task 8. All five spec slices map to tasks.
- **Spec open questions addressed:** (a) Slice-4 state shape → Task 7 decision block (no `mode` enum change unless proven necessary; escalate if audio+morph must coexist). (b) Canvas hidden on `/paths` → achieved structurally: canvas lives in `(app)` layout, `/paths` is outside the group, so it never mounts the canvas. (c) `kaleidoscope.enabled` gate → retired for the panel in Task 4 (panel presence now gated by the `/animate` route).
- **Deferred (not in this plan):** spec slices 6-7 (Paths archive, animation presets) — later cycle, own brainstorm.
- **Verify-before-coding reminders for the implementer:** confirm real testids in `TimelineRuler.svelte`, `KeyframeGraphEditor.svelte`, and the actual `keyframes.svelte.ts` API (`addKeyframe`/`sampleParam`/track shape) and the rotation param const name before writing the Task 6/8 tests; the snippets above use the documented names but the source is the source of truth.
