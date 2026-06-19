# Paths Two-Column Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/paths` as a two-column archive — saved shapes as a vertical card list (left), a large `RingPreview` of the selected entry (center), and an Apply button that writes the shape onto a chosen ring + slot.

**Architecture:** `/paths` stays its own route (outside the `(app)` live-canvas shell) but adopts the shadcn `Sidebar` chrome + `WorkspaceNav` tabs so it matches Editor/Animate visually. The page owns selection state; a new `ApplyToRingSheet` (shadcn `Sheet`, mirroring `LibraryPickerSheet`) picks ring + slot and calls back into `applyEntryToRing`.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript, bun, vitest (`vitest-browser-svelte`, chromium project), Playwright e2e, shadcn-svelte (Sidebar, Sheet), paper.js (RingPreview/PathThumbnail).

## Global Constraints

- Package manager **bun**. Single spec: `bun run test:unit -- run <path>`. Full suite (before every commit): `bun run test:unit -- run`. Type check: `bun run check`.
- Every `.svelte` file MUST pass `svelte-autofixer` MCP with `issues: []` before commit. Known false-positive *suggestions* (`bind:this`→attachment, "function/stateful-var inside $effect") may remain; `issues: []` (no *issues*) is the gate.
- **Tailwind is NOT loaded in the vitest browser DOM** → assert structure, `data-testid`, `className`, `textContent`, ARIA only. Never assert `getBoundingClientRect`/computed layout.
- Route spec files must NOT be `+`-prefixed and must end `.svelte.spec.ts` to run in the browser vitest project (`vite.config.ts` browser include `src/**/*.svelte.{test,spec}.{js,ts}`).
- **`pathLibrary` is a persisted singleton** (`lsSync('path-library', { entries: [] })`): any spec that seeds entries MUST reset `pathLibrary.entries = []` in `beforeEach`/`afterEach` to avoid cross-test leakage.
- TAB indentation in `.svelte`/`.ts`.
- Keep the suite green (currently 380 unit tests, `bun run check` 0 errors).
- Reuse existing helpers verbatim — do NOT reimplement: `applyEntryToRing(ring, entry, slot)` and `type ApplySlot = 'template' | 'secondary' | 'both'` from `$lib/state/path-library`; `RingPreview` (props `path`, `secondaryPath?`, `baseRadius`, `ringIncrement`, `size?`); `PathThumbnail` (props `path`, `secondaryPath`, `size`); `WorkspaceNav`. `applyEntryToRing` semantics: `template`→writes `ring.templatePath`; `secondary`→writes `ring.secondaryTemplatePath` from the entry's PRIMARY path; `both`→writes both (needs `entry.secondaryPath`). Only `both` requires `entry.secondaryPath`.

---

## File Structure

**Created:**
- `src/lib/components/ApplyToRingSheet.svelte` — Sheet to pick ring + slot for a known entry.
- `src/lib/components/ApplyToRingSheet.svelte.spec.ts` — ring list, slot disabling, confirm callback.
- `src/routes/paths/page.svelte.spec.ts` — Paths page: cards list, selection→preview, empty state, apply gating.

**Modified:**
- `src/routes/paths/+page.svelte` — rewritten into the two-column archive.
- `src/routes/paths/path-manager.e2e.ts` — `paths-grid`→`paths-list`/`paths-card-{id}`.

**Deleted:**
- `src/routes/paths/hover-preview.e2e.ts` — the hover popover is removed; the centered preview replaces it.

---

## SLICE 1 — Two-column Paths (cards + centered preview)

### Task 1: Rewrite `/paths` as the two-column archive

**Files:**
- Modify (rewrite): `src/routes/paths/+page.svelte`
- Create: `src/routes/paths/page.svelte.spec.ts`
- Modify: `src/routes/paths/path-manager.e2e.ts`
- Delete: `src/routes/paths/hover-preview.e2e.ts`

**Interfaces:**
- Consumes: `pathLibrary` (`$lib/state/path-library`), `composition` (`$lib/state/composition`), `WorkspaceNav`, `PathThumbnail`, `RingPreview`, shadcn `Sidebar*`.
- Produces: `/paths` with `data-testid` `paths-list` (cards container), `paths-card-{id}` (each card, `aria-current="true"` when selected), `paths-empty-state` (empty), `paths-preview` (centered preview wrapper). Apply button (`paths-apply`) is added in Task 2 — Task 1 leaves a placeholder-free preview column without the button.

- [ ] **Step 1: Write the failing unit test**

```ts
// src/routes/paths/page.svelte.spec.ts
import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PathsPage from './+page.svelte';
import { pathLibrary } from '$lib/state/path-library';
import type { PathLibraryEntry } from '$lib/types';

const PATH = { cmds: ['M', 'L', 'L', 'L', 'Z'], crds: [0, 0, 100, 0, 100, 50, 0, 50] };

function entry(id: string, name: string, withSecondary = false): PathLibraryEntry {
	return {
		id,
		name,
		createdAt: 1,
		path: { cmds: [...PATH.cmds], crds: [...PATH.crds] },
		secondaryPath: withSecondary ? { cmds: [...PATH.cmds], crds: [...PATH.crds] } : null
	};
}

describe('Paths page', () => {
	beforeEach(() => {
		pathLibrary.entries = [entry('a', 'Forma A'), entry('b', 'Forma B')];
	});
	afterEach(() => {
		pathLibrary.entries = [];
	});

	it('renders a card per saved entry in a vertical list', async () => {
		render(PathsPage);
		await expect.element(page.getByTestId('paths-list')).toBeInTheDocument();
		await expect.element(page.getByTestId('paths-card-a')).toBeInTheDocument();
		await expect.element(page.getByTestId('paths-card-b')).toBeInTheDocument();
	});

	it('selects the first entry by default and marks the selected card', async () => {
		render(PathsPage);
		await expect.element(page.getByTestId('paths-card-a')).toHaveAttribute('aria-current', 'true');
	});

	it('selecting another card moves the selection', async () => {
		render(PathsPage);
		await userEvent.click(page.getByTestId('paths-card-b'));
		await expect.element(page.getByTestId('paths-card-b')).toHaveAttribute('aria-current', 'true');
		expect(page.getByTestId('paths-card-a').element().getAttribute('aria-current')).not.toBe('true');
	});

	it('shows the empty state when the library has no entries', async () => {
		pathLibrary.entries = [];
		render(PathsPage);
		await expect.element(page.getByTestId('paths-empty-state')).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test:unit -- run src/routes/paths/page.svelte.spec.ts`
Expected: FAIL — no `paths-list` / `paths-card-*` (page is still the old grid).

- [ ] **Step 3: Rewrite the Paths page**

```svelte
<!-- src/routes/paths/+page.svelte -->
<script lang="ts">
	import * as SidebarUI from '$lib/shadcn/ui/sidebar/index.js';
	import WorkspaceNav from '$lib/components/WorkspaceNav.svelte';
	import PathThumbnail from '$lib/components/PathThumbnail.svelte';
	import RingPreview from '$lib/components/RingPreview.svelte';
	import { pathLibrary } from '$lib/state/path-library';
	import { composition } from '$lib/state/composition';

	let selectedId = $state<string | null>(pathLibrary.entries[0]?.id ?? null);

	// Resolve against live state: fall back to the first entry if the pick is stale
	// (e.g. the library hydrated after mount, or the selected entry was removed).
	const selected = $derived(
		pathLibrary.entries.find((e) => e.id === selectedId) ?? pathLibrary.entries[0] ?? null
	);
</script>

<svelte:head><title>Path Library — logo-bettona</title></svelte:head>

<SidebarUI.SidebarProvider>
	<SidebarUI.Sidebar>
		<SidebarUI.SidebarContent class="p-2" data-testid="paths-list">
			{#if pathLibrary.entries.length === 0}
				<p class="p-3 text-xs text-muted-foreground" data-testid="paths-empty-state">
					Nessun path salvato. Salva dal Ring Editor.
				</p>
			{:else}
				<div class="flex flex-col gap-1">
					{#each pathLibrary.entries as item (item.id)}
						<button
							type="button"
							data-testid="paths-card-{item.id}"
							aria-current={selected?.id === item.id ? 'true' : undefined}
							class="flex items-center gap-2 rounded-md border p-2 text-left hover:bg-muted aria-[current=true]:border-primary aria-[current=true]:bg-muted"
							onclick={() => (selectedId = item.id)}
						>
							<PathThumbnail path={item.path} secondaryPath={item.secondaryPath} size={48} />
							<div class="flex min-w-0 flex-1 flex-col">
								<span class="truncate text-xs font-medium">{item.name}</span>
								<span class="text-[10px] text-muted-foreground">
									{new Date(item.createdAt).toLocaleDateString()}
								</span>
							</div>
							{#if item.secondaryPath}
								<span class="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">secondary</span>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		</SidebarUI.SidebarContent>
	</SidebarUI.Sidebar>

	<SidebarUI.SidebarInset>
		<header class="flex items-center gap-2 border-b p-4">
			<SidebarUI.SidebarTrigger />
			<WorkspaceNav />
		</header>
		<main class="flex flex-1 flex-col items-center justify-center gap-4 p-8">
			{#if selected}
				<div data-testid="paths-preview">
					<RingPreview
						path={selected.path}
						secondaryPath={selected.secondaryPath}
						baseRadius={composition.baseRadius}
						ringIncrement={composition.ringIncrement}
						size={360}
					/>
				</div>
				<p class="text-sm font-medium">{selected.name}</p>
			{:else}
				<p class="text-sm text-muted-foreground">Nessuna forma da mostrare.</p>
			{/if}
		</main>
	</SidebarUI.SidebarInset>
</SidebarUI.SidebarProvider>
```

- [ ] **Step 4: Run `svelte-autofixer` on `paths/+page.svelte`** until `issues: []` (the `bind:this` suggestion from RingPreview, if surfaced, is the known false positive — ignore it).

- [ ] **Step 5: Run the unit test to verify it passes**

Run: `bun run test:unit -- run src/routes/paths/page.svelte.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Delete the hover-popover e2e**

```bash
git rm src/routes/paths/hover-preview.e2e.ts
```

- [ ] **Step 7: Update `path-manager.e2e.ts` to the new list**

In `src/routes/paths/path-manager.e2e.ts`, replace the grid assertion. The old line asserted one `<li>` in `paths-grid`; the list now uses `paths-card-{id}` buttons. Replace:

```ts
	await page.getByTestId('nav-paths').click();
	await expect(page).toHaveURL(/\/paths$/);
	await expect(page.getByTestId('paths-grid').locator('li')).toHaveCount(1);
```

with:

```ts
	await page.getByTestId('nav-paths').click();
	await expect(page).toHaveURL(/\/paths$/);
	await expect(page.getByTestId('paths-list').getByRole('button')).toHaveCount(1);
```

(The rest of the test — saving, navigating back via `nav-editor`, loading via the ring editor's `LibraryPickerSheet` — is unchanged and still valid.)

- [ ] **Step 8: Full suite + type check**

Run: `bun run test:unit -- run` then `bun run check`
Expected: green, 0 type errors.

- [ ] **Step 9: Commit**

```bash
git add src/routes/paths/+page.svelte src/routes/paths/page.svelte.spec.ts src/routes/paths/path-manager.e2e.ts
git rm src/routes/paths/hover-preview.e2e.ts
git commit -m "feat: Paths as a two-column archive (cards + centered preview)"
```

---

## SLICE 2 — Apply to ring (ring + slot picker)

### Task 2: ApplyToRingSheet + Apply button

**Files:**
- Create: `src/lib/components/ApplyToRingSheet.svelte`
- Create: `src/lib/components/ApplyToRingSheet.svelte.spec.ts`
- Modify: `src/routes/paths/+page.svelte` (Apply button + wiring)
- Modify: `src/routes/paths/page.svelte.spec.ts` (apply-gating tests)
- Modify: `src/routes/paths/path-manager.e2e.ts` (exercise apply-from-Paths)

**Interfaces:**
- Consumes: `applyEntryToRing`, `ApplySlot` (`$lib/state/path-library`); `Ring`, `PathLibraryEntry` (`$lib/types`); `PathThumbnail`; shadcn `Sheet`, `Button`.
- Produces: `<ApplyToRingSheet open={bindable} entry={PathLibraryEntry|null} rings={Ring[]} onapply={(ringIndex:number, slot:ApplySlot)=>void} />` with testids `apply-ring-select`, `apply-confirm`. Slot radios named `apply-slot` (`template`/`secondary`/`both`; `both` disabled + auto-corrected to `template` when `entry.secondaryPath` is null).

- [ ] **Step 1: Write the failing ApplyToRingSheet test**

```ts
// src/lib/components/ApplyToRingSheet.svelte.spec.ts
import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ApplyToRingSheet from './ApplyToRingSheet.svelte';
import type { PathLibraryEntry, Ring } from '$lib/types';
import type { ApplySlot } from '$lib/state/path-library';

const PATH = { cmds: ['M', 'L', 'Z'], crds: [0, 0, 10, 0] };

function entry(withSecondary: boolean): PathLibraryEntry {
	return {
		id: 'e1',
		name: 'Forma',
		createdAt: 1,
		path: { ...PATH },
		secondaryPath: withSecondary ? { ...PATH } : null
	};
}

function ring(): Ring {
	return {
		copies: 8,
		color: '#000',
		templatePath: { ...PATH },
		secondaryTemplatePath: null,
		morphT: 0,
		ringHeight: 0.25
	};
}

describe('ApplyToRingSheet', () => {
	it('lists one option per ring', async () => {
		render(ApplyToRingSheet, {
			props: { open: true, entry: entry(false), rings: [ring(), ring(), ring()], onapply: vi.fn() }
		});
		const select = page.getByTestId('apply-ring-select');
		await expect.element(select).toBeInTheDocument();
		expect(select.element().querySelectorAll('option')).toHaveLength(3);
	});

	it('disables the "both" slot when the entry has no secondary path', async () => {
		render(ApplyToRingSheet, {
			props: { open: true, entry: entry(false), rings: [ring()], onapply: vi.fn() }
		});
		const both = page.getByRole('radio', { name: 'Entrambe' });
		await expect.element(both).toBeDisabled();
	});

	it('confirm calls onapply with the chosen ring index and slot', async () => {
		const onapply = vi.fn();
		render(ApplyToRingSheet, {
			props: { open: true, entry: entry(true), rings: [ring(), ring()], onapply }
		});
		await userEvent.selectOptions(page.getByTestId('apply-ring-select'), '1');
		await userEvent.click(page.getByRole('radio', { name: 'Secondaria' }));
		await userEvent.click(page.getByTestId('apply-confirm'));
		expect(onapply).toHaveBeenCalledWith(1, 'secondary');
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test:unit -- run src/lib/components/ApplyToRingSheet.svelte.spec.ts`
Expected: FAIL — cannot resolve `./ApplyToRingSheet.svelte`.

- [ ] **Step 3: Create `ApplyToRingSheet.svelte`**

```svelte
<!-- src/lib/components/ApplyToRingSheet.svelte -->
<script lang="ts">
	import * as Sheet from '$lib/shadcn/ui/sheet/index.js';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import PathThumbnail from './PathThumbnail.svelte';
	import type { PathLibraryEntry, Ring } from '$lib/types';
	import type { ApplySlot } from '$lib/state/path-library';

	let {
		open = $bindable(false),
		entry,
		rings,
		onapply
	}: {
		open?: boolean;
		entry: PathLibraryEntry | null;
		rings: Ring[];
		onapply: (ringIndex: number, slot: ApplySlot) => void;
	} = $props();

	let ringIndex = $state(0);
	let slotRaw = $state<ApplySlot>('template');

	// Mirror LibraryPickerSheet: only 'both' needs a secondary path; auto-correct it.
	const slot = $derived<ApplySlot>(
		slotRaw === 'both' && entry && !entry.secondaryPath ? 'template' : slotRaw
	);

	// Reset to defaults when the sheet closes so it opens fresh next time.
	$effect(() => {
		if (!open) {
			ringIndex = 0;
			slotRaw = 'template';
		}
	});

	function confirm() {
		if (!entry || rings.length === 0) return;
		onapply(ringIndex, slot);
		open = false;
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content side="right" class="w-[420px] sm:w-[480px]">
		<Sheet.Header>
			<Sheet.Title>Applica al marchio</Sheet.Title>
			<Sheet.Description>Scegli l'anello e lo slot su cui applicare la forma.</Sheet.Description>
		</Sheet.Header>

		{#if entry}
			<div class="mt-4 space-y-4">
				<div class="flex items-center gap-3 rounded border p-2">
					<PathThumbnail path={entry.path} secondaryPath={entry.secondaryPath} size={64} />
					<div class="text-sm font-medium">{entry.name}</div>
				</div>

				<div class="flex flex-col gap-1">
					<label for="apply-ring" class="text-xs font-medium">Anello</label>
					<select
						id="apply-ring"
						data-testid="apply-ring-select"
						class="h-9 rounded-md border border-input bg-background px-3 text-xs"
						value={ringIndex}
						onchange={(e) => (ringIndex = Number((e.target as HTMLSelectElement).value))}
					>
						{#each rings as _ring, i (i)}
							<option value={i}>Anello {i + 1}</option>
						{/each}
					</select>
				</div>

				<fieldset class="space-y-2">
					<legend class="text-xs font-medium">Slot</legend>
					<label class="flex items-center gap-2 text-sm">
						<input
							type="radio"
							name="apply-slot"
							value="template"
							checked={slot === 'template'}
							onchange={() => (slotRaw = 'template')}
						/>
						Principale
					</label>
					<label class="flex items-center gap-2 text-sm">
						<input
							type="radio"
							name="apply-slot"
							value="secondary"
							checked={slot === 'secondary'}
							onchange={() => (slotRaw = 'secondary')}
						/>
						Secondaria
					</label>
					<label class="flex items-center gap-2 text-sm" class:opacity-50={!entry.secondaryPath}>
						<input
							type="radio"
							name="apply-slot"
							value="both"
							disabled={!entry.secondaryPath}
							checked={slot === 'both'}
							onchange={() => (slotRaw = 'both')}
						/>
						Entrambe
					</label>
				</fieldset>

				<div class="flex justify-end">
					<Button size="sm" onclick={confirm} data-testid="apply-confirm">Applica</Button>
				</div>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
```

- [ ] **Step 4: Run `svelte-autofixer` on `ApplyToRingSheet.svelte`** until `issues: []`.

- [ ] **Step 5: Run the sheet test to verify it passes**

Run: `bun run test:unit -- run src/lib/components/ApplyToRingSheet.svelte.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Write the failing apply-gating tests for the page**

Append to `src/routes/paths/page.svelte.spec.ts` (inside the `describe`), and import `composition`:

```ts
// add to imports at top of the file:
// import { composition } from '$lib/state/composition';

	it('enables Apply when an entry is selected and the mark has rings', async () => {
		composition.rings = [
			{ copies: 8, color: '#000', templatePath: { cmds: ['M'], crds: [0, 0] }, secondaryTemplatePath: null, morphT: 0, ringHeight: 0.25 }
		];
		render(PathsPage);
		await expect.element(page.getByTestId('paths-apply')).toBeEnabled();
	});

	it('disables Apply when the mark has no rings', async () => {
		composition.rings = [];
		render(PathsPage);
		await expect.element(page.getByTestId('paths-apply')).toBeDisabled();
	});
```

Add a `composition.rings` reset to `afterEach`:

```ts
	afterEach(() => {
		pathLibrary.entries = [];
		composition.rings = [];
	});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `bun run test:unit -- run src/routes/paths/page.svelte.spec.ts`
Expected: FAIL — no `paths-apply` button yet.

- [ ] **Step 8: Wire the Apply button + sheet into the page**

In `src/routes/paths/+page.svelte`, add to the `<script>`:

```svelte
	import ApplyToRingSheet from '$lib/components/ApplyToRingSheet.svelte';
	import { applyEntryToRing } from '$lib/state/path-library';
	import type { ApplySlot } from '$lib/state/path-library';
	import { Button } from '$lib/shadcn/ui/button/index.js';
```

Add state + handler after `selected`:

```svelte
	let applyOpen = $state(false);
	const canApply = $derived(selected !== null && composition.rings.length > 0);

	function applyToRing(ringIndex: number, slot: ApplySlot) {
		if (!selected) return;
		applyEntryToRing(composition.rings[ringIndex], selected, slot);
	}
```

In the `<main>`, after the `{selected.name}` paragraph (still inside `{#if selected}`), add the button + sheet:

```svelte
				<Button
					size="sm"
					data-testid="paths-apply"
					disabled={!canApply}
					onclick={() => (applyOpen = true)}
				>
					Applica al marchio
				</Button>
				{#if composition.rings.length === 0}
					<p class="text-[11px] text-muted-foreground">Aggiungi un anello in Editor per applicare.</p>
				{/if}
```

And before the closing `</SidebarUI.SidebarProvider>` (or anywhere top-level in the markup), mount the sheet:

```svelte
<ApplyToRingSheet bind:open={applyOpen} entry={selected} rings={composition.rings} onapply={applyToRing} />
```

- [ ] **Step 9: Run `svelte-autofixer` on `paths/+page.svelte`** until `issues: []`.

- [ ] **Step 10: Run the page test to verify it passes**

Run: `bun run test:unit -- run src/routes/paths/page.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 11: Extend `path-manager.e2e.ts` to apply from Paths**

After the block that navigates to `/paths` and asserts one card (from Task 1), add an apply-from-Paths flow before the existing "go back to the editor" step:

```ts
	// Apply the saved shape from Paths onto ring 1's primary slot.
	await page.getByTestId('paths-card', { exact: false }).first?.();
	await page.getByTestId('paths-apply').click();
	await page.getByTestId('apply-confirm').click();
```

If `getByTestId('paths-card', ...)` partial matching is awkward in this repo's Playwright setup, select the first card via `page.getByTestId('paths-list').getByRole('button').first()` then click; the concrete card id is dynamic. Keep the assertion minimal: after `apply-confirm`, the sheet closes — assert the apply sheet title is hidden:

```ts
	await page.getByTestId('paths-list').getByRole('button').first().click();
	await page.getByTestId('paths-apply').click();
	await page.getByTestId('apply-confirm').click();
	await expect(page.getByRole('heading', { name: 'Applica al marchio' })).toBeHidden({ timeout: 2000 });
```

- [ ] **Step 12: Full suite + type check**

Run: `bun run test:unit -- run` then `bun run check`
Expected: green, 0 type errors.

- [ ] **Step 13: Commit**

```bash
git add src/lib/components/ApplyToRingSheet.svelte src/lib/components/ApplyToRingSheet.svelte.spec.ts src/routes/paths/+page.svelte src/routes/paths/page.svelte.spec.ts src/routes/paths/path-manager.e2e.ts
git commit -m "feat: apply a saved shape to a chosen ring + slot from Paths"
```

---

## Self-Review notes

- **Spec coverage:** Two-column layout + cards list + centered preview + empty state + removed hover popover → Task 1. Apply button + ring/slot picker via `applyEntryToRing` → Task 2. e2e updates (grid→list, delete hover-preview, apply flow) covered in Tasks 1 & 2. All spec sections map to tasks.
- **Reuse:** `applyEntryToRing`, `ApplySlot`, `RingPreview`, `PathThumbnail`, `WorkspaceNav`, shadcn `Sheet`/`Sidebar` reused; `ApplyToRingSheet` mirrors `LibraryPickerSheet`'s slot logic (only `both` gated on `secondaryPath`).
- **Type consistency:** `onapply(ringIndex: number, slot: ApplySlot)` is the sheet's callback in both the component and its test; the page's `applyToRing(ringIndex, slot)` matches and calls `applyEntryToRing(composition.rings[ringIndex], selected, slot)`. `selected` is `PathLibraryEntry | null`; the sheet accepts `entry: PathLibraryEntry | null` and guards on it.
- **Singleton hygiene:** both new specs reset `pathLibrary.entries` (and the page spec resets `composition.rings`) in `afterEach`.
- **Implementer note:** confirm the exact `Ring` object shape against `$lib/types` before writing the test fixtures (fields used: `copies`, `color`, `templatePath`, `secondaryTemplatePath`, `morphT`, `ringHeight`); the snippets above use the shape seen in `PreviewCanvas.svelte.spec.ts`.
