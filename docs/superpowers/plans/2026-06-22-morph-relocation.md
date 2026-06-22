# Morph Relocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the morph-target mechanic out of the Editor into the Animate Simple window, leaving the Editor to draw only the primary shape.

**Architecture:** No state-layer changes (`composition.ts` morph functions stay; the primary re-seed becomes permanent). Extract the morph UI into a new focused `RingMorphConfigItem` component hosted by `SimpleSection`; strip the morph UI from `RingEditor`; give `LibraryPickerSheet` a `slots` prop so the Editor offers primary-only and the morph editor offers secondary/both.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript, paper.js, paraglide i18n, Vitest (`vitest/browser`), Playwright, bun.

## Global Constraints

- Package manager **bun**. Single spec: `bun run test:unit -- run <path>`. Full unit: `bun run test:unit -- run`. Types: `bun run check`. e2e: `bunx playwright test`.
- Tab indentation (NOT spaces).
- Every touched `.svelte` MUST pass the Svelte MCP `svelte-autofixer` with `issues: []` (ignore known false-positive *suggestions* only: rAF-in-`$effect`, "stateful var assigned in `$effect`", `bind:this`→attachment).
- New message keys (if any) go in BOTH `messages/en.json` and `messages/it.json` (messages-parity test). `bun run check` recompiles paraglide; a first run after editing messages can transiently fail — rerun.
- Component tests run in a real browser; Tailwind NOT loaded — assert role/label/testid/text. Specs asserting English UI call `switchLocale('en')` in `beforeEach`.
- e2e runs in ENGLISH.
- Commit trailer EXACTLY: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Do NOT run `prettier --write .` or `bun run lint`.
- Spec: `docs/superpowers/specs/2026-06-22-morph-relocation-design.md`.

---

### Task 1: `LibraryPickerSheet` — selectable slots

**Files:**
- Modify: `src/lib/components/LibraryPickerSheet.svelte`
- Test: `src/lib/components/LibraryPickerSheet.svelte.spec.ts` (Create)

**Interfaces:**
- Consumes: `pathLibrary` from `$lib/state/path-library`; `ApplySlot = 'template' | 'secondary' | 'both'`.
- Produces: `LibraryPickerSheet` gains prop `slots?: ApplySlot[]` (default `['template', 'secondary', 'both']`). When `slots.length === 1`, the slot fieldset is not rendered and confirm applies `slots[0]`. Otherwise only the radios in `slots` render.

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/LibraryPickerSheet.svelte.spec.ts`:

```ts
import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import LibraryPickerSheet from './LibraryPickerSheet.svelte';
import { pathLibrary, saveEntry } from '$lib/state/path-library';
import { switchLocale } from '$lib/state/locale.svelte';
import type { PathLibraryEntry } from '$lib/types';
import type { ApplySlot } from '$lib/state/path-library';

const PATH = { cmds: ['M', 'L', 'Z'] as ('M' | 'L' | 'Z')[], crds: [0, 0, 10, 0] };

describe('LibraryPickerSheet', () => {
	beforeEach(() => {
		switchLocale('en');
		pathLibrary.entries = [];
		saveEntry(PATH, null);
	});

	it('with a single slot, hides the slot chooser and applies that slot', async () => {
		let applied: { entry: PathLibraryEntry; slot: ApplySlot } | null = null;
		render(LibraryPickerSheet, {
			open: true,
			slots: ['template'],
			onapply: (entry: PathLibraryEntry, slot: ApplySlot) => (applied = { entry, slot })
		});
		await userEvent.click(page.getByTestId(`library-picker-entry-${pathLibrary.entries[0].id}`));
		expect(page.getByText('Slot').query()).toBeNull(); // no fieldset legend
		await userEvent.click(page.getByTestId('library-picker-confirm'));
		expect(applied).not.toBeNull();
		expect(applied!.slot).toBe('template');
	});

	it('by default shows all three slot options', async () => {
		render(LibraryPickerSheet, { open: true, onapply: () => {} });
		await userEvent.click(page.getByTestId(`library-picker-entry-${pathLibrary.entries[0].id}`));
		await expect.element(page.getByText('Slot')).toBeInTheDocument();
		await expect.element(page.getByText('Primary')).toBeInTheDocument();
		await expect.element(page.getByText('Secondary')).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/components/LibraryPickerSheet.svelte.spec.ts`
Expected: FAIL — `slots` prop ignored; the slot fieldset renders even with `slots: ['template']`.

- [ ] **Step 3: Implement the `slots` prop**

In `src/lib/components/LibraryPickerSheet.svelte`, update the props block and slot state:

```svelte
	let {
		open = $bindable(false),
		onapply,
		slots = ['template', 'secondary', 'both']
	}: {
		open?: boolean;
		onapply: (entry: PathLibraryEntry, slot: ApplySlot) => void;
		slots?: ApplySlot[];
	} = $props();

	let selected = $state<PathLibraryEntry | null>(null);
	let slotRaw = $state<ApplySlot>(slots[0] ?? 'template');
	let hoveredId = $state<string | null>(null);
```

Update the reset effect to reset to the first allowed slot:

```svelte
	$effect(() => {
		if (!open) {
			selected = null;
			slotRaw = slots[0] ?? 'template';
		}
	});
```

Replace the `<fieldset>...</fieldset>` block with one that renders only when more than one
slot is offered, and only the included radios:

```svelte
					{#if slots.length > 1}
						<fieldset class="space-y-2">
							<legend class="text-xs font-medium">{m.common_slot()}</legend>
							{#if slots.includes('template')}
								<label class="flex items-center gap-2 text-sm">
									<input
										type="radio"
										name="apply-slot"
										value="template"
										checked={slot === 'template'}
										onchange={() => (slotRaw = 'template')}
									/>
									{m.slot_primary()}
								</label>
							{/if}
							{#if slots.includes('secondary')}
								<label class="flex items-center gap-2 text-sm">
									<input
										type="radio"
										name="apply-slot"
										value="secondary"
										checked={slot === 'secondary'}
										onchange={() => (slotRaw = 'secondary')}
									/>
									{m.slot_secondary()}
								</label>
							{/if}
							{#if slots.includes('both')}
								<label
									class="flex items-center gap-2 text-sm"
									class:opacity-50={!selected.secondaryPath}
								>
									<input
										type="radio"
										name="apply-slot"
										value="both"
										disabled={!selected.secondaryPath}
										checked={slot === 'both'}
										onchange={() => (slotRaw = 'both')}
									/>
									{m.slot_both()}
								</label>
							{/if}
						</fieldset>
					{/if}
```

(The `slot` derived and `confirm()` are unchanged — `confirm()` already calls
`onapply(selected, slot)`, and with a single slot `slotRaw` stays at `slots[0]`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/components/LibraryPickerSheet.svelte.spec.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Run svelte-autofixer**

Run the Svelte MCP `svelte-autofixer` on `LibraryPickerSheet.svelte`. Confirm `issues: []`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/LibraryPickerSheet.svelte src/lib/components/LibraryPickerSheet.svelte.spec.ts
git commit -m "feat(library): selectable slots prop on LibraryPickerSheet

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `RingMorphConfigItem` — per-ring morph editor (NEW)

**Files:**
- Create: `src/lib/components/RingMorphConfigItem.svelte`
- Test: `src/lib/components/RingMorphConfigItem.svelte.spec.ts` (Create)

**Interfaces:**
- Consumes: composition `createRingMorphTarget(index)`, `removeRingMorphTarget(index)`, `updateRingPathVariant(index, variant, path)`, `setRingMorphT(index, t)`; `RingCanvas` (props `templatePath`, `onchange`, `label`); `LibraryPickerSheet` with `slots={['secondary', 'both']}`; `importSvg(file, scope)`; `m` messages.
- Produces: a component with props `{ ring: Ring; index: number }`; root `data-testid="ring-morph-config-{index}"`. When `ring.secondaryTemplatePath == null` shows a Create button; otherwise shows the secondary path editor, import, library, morphT slider, and Remove.

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/RingMorphConfigItem.svelte.spec.ts`:

```ts
import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RingMorphConfigItem from './RingMorphConfigItem.svelte';
import { composition } from '$lib/state/composition';
import { switchLocale } from '$lib/state/locale.svelte';
import type { Ring } from '$lib/types';

const PATH = { cmds: ['M', 'L', 'Z'] as ('M' | 'L' | 'Z')[], crds: [0, 0, 10, 0] };

function ring(secondary: boolean): Ring {
	return {
		copies: 4,
		color: '#000',
		templatePath: { cmds: [...PATH.cmds], crds: [...PATH.crds] },
		secondaryTemplatePath: secondary ? { cmds: [...PATH.cmds], crds: [...PATH.crds] } : null,
		morphT: 0,
		ringHeight: 0.25
	};
}

describe('RingMorphConfigItem', () => {
	beforeEach(() => {
		switchLocale('en');
		composition.rings = [ring(false)];
	});

	it('shows Create morph target when the ring has no secondary', async () => {
		render(RingMorphConfigItem, { ring: composition.rings[0], index: 0 });
		await expect.element(page.getByRole('button', { name: 'Create morph target' })).toBeInTheDocument();
	});

	it('creating a morph target adds a secondary path to the ring', async () => {
		render(RingMorphConfigItem, { ring: composition.rings[0], index: 0 });
		await userEvent.click(page.getByRole('button', { name: 'Create morph target' }));
		expect(composition.rings[0].secondaryTemplatePath).not.toBeNull();
	});

	it('with a secondary, shows the morphT slider and Remove, and removing clears it', async () => {
		composition.rings = [ring(true)];
		render(RingMorphConfigItem, { ring: composition.rings[0], index: 0 });
		await expect.element(page.getByRole('button', { name: 'Remove morph target' })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Load from library' })).toBeInTheDocument();
		await userEvent.click(page.getByRole('button', { name: 'Remove morph target' }));
		expect(composition.rings[0].secondaryTemplatePath).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/components/RingMorphConfigItem.svelte.spec.ts`
Expected: FAIL — the component file does not exist (import error).

- [ ] **Step 3: Create the component**

Create `src/lib/components/RingMorphConfigItem.svelte`:

```svelte
<script lang="ts">
	import paper from 'paper';
	import * as Collapsible from '$lib/shadcn/ui/collapsible/index.js';
	import { Slider } from '$lib/shadcn/ui/slider/index.js';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import { Input } from '$lib/shadcn/ui/input/index.js';
	import { CaretDown, CaretRight } from 'phosphor-svelte';
	import {
		createRingMorphTarget,
		removeRingMorphTarget,
		updateRingPathVariant,
		setRingMorphT
	} from '$lib/state/composition';
	import { importSvg } from '$lib/geometry/svg-import';
	import { saveEntry } from '$lib/state/path-library';
	import { m } from '$lib/paraglide/messages';
	import LibraryPickerSheet from './LibraryPickerSheet.svelte';
	import RingCanvas from './RingCanvas.svelte';
	import type { Ring, PathLibraryEntry } from '$lib/types';
	import type { ApplySlot } from '$lib/state/path-library';

	let { ring, index }: { ring: Ring; index: number } = $props();

	let open = $state(false);
	let importError = $state<string | null>(null);
	let ringPathError = $state<string | null>(null);
	let libraryOpen = $state(false);
	let libraryApplyError = $state<string | null>(null);

	function clonePath(p: { cmds: string[]; crds: number[] }) {
		return { cmds: [...p.cmds], crds: [...p.crds] } as NonNullable<Ring['templatePath']>;
	}

	function handleApplyFromLibrary(entry: PathLibraryEntry, slot: ApplySlot) {
		libraryApplyError = null;
		if (slot === 'secondary') {
			const r = updateRingPathVariant(index, 'secondary', clonePath(entry.path));
			if (!r.ok) libraryApplyError = r.reason;
			return;
		}
		if (slot === 'both') {
			if (entry.secondaryPath) {
				const r = updateRingPathVariant(index, 'secondary', clonePath(entry.secondaryPath));
				if (!r.ok) libraryApplyError = r.reason;
			} else if (ring.secondaryTemplatePath) {
				removeRingMorphTarget(index);
			}
		}
	}

	const importScope = new paper.PaperScope();
	importScope.setup(new paper.Size(1, 1));

	async function handleFileChange(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		importError = null;
		const path = await importSvg(file, importScope);
		if (!path) {
			importError = m.editor_svg_invalid();
			return;
		}
		ringPathError = null;
		const result = updateRingPathVariant(index, 'secondary', path);
		if (!result.ok) ringPathError = result.reason;
	}

	function applyPathFromEditor(newPath: NonNullable<Ring['templatePath']>) {
		ringPathError = null;
		const result = updateRingPathVariant(index, 'secondary', newPath);
		if (!result.ok) ringPathError = result.reason;
	}
</script>

<div class="rounded border bg-background" data-testid="ring-morph-config-{index}">
	<Collapsible.Collapsible bind:open>
		<div class="flex items-center gap-1 px-2 py-1.5">
			<Collapsible.CollapsibleTrigger
				class="flex flex-1 items-center gap-1 text-left text-sm font-medium hover:text-foreground"
			>
				{#if open}
					<CaretDown size={14} />
				{:else}
					<CaretRight size={14} />
				{/if}
				{m.editor_ring_label({ index: index + 1 })}
			</Collapsible.CollapsibleTrigger>
		</div>

		<Collapsible.CollapsibleContent class="space-y-3 px-3 pb-3">
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
				<RingCanvas
					templatePath={ring.secondaryTemplatePath}
					onchange={applyPathFromEditor}
					label={m.editor_path_editor_secondary()}
				/>

				{#if ringPathError}
					<p class="text-xs text-destructive">{ringPathError}</p>
				{/if}

				<div class="flex flex-col gap-1">
					<span class="text-xs text-muted-foreground">
						{m.editor_ring_label({ index: index + 1 })} ({(ring.morphT ?? 0).toFixed(2)})
					</span>
					<Slider
						type="single"
						min={0}
						max={1}
						step={0.01}
						value={ring.morphT ?? 0}
						onValueChange={(v) => setRingMorphT(index, v)}
					/>
				</div>

				<div class="flex flex-wrap items-center gap-2">
					<Button variant="outline" size="sm" onclick={() => (libraryOpen = true)}>
						{m.editor_load_from_library()}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={() => {
							ringPathError = null;
							removeRingMorphTarget(index);
						}}
					>
						{m.editor_remove_morph()}
					</Button>
				</div>

				{#if libraryApplyError}
					<p class="text-xs text-destructive">{libraryApplyError}</p>
				{/if}

				<LibraryPickerSheet
					bind:open={libraryOpen}
					slots={['secondary', 'both']}
					onapply={handleApplyFromLibrary}
				/>

				<div class="flex flex-col gap-1">
					<Label for="morph-svg-upload-{index}" class="text-xs">{m.editor_import_svg()}</Label>
					<input
						id="morph-svg-upload-{index}"
						type="file"
						accept=".svg,image/svg+xml"
						onchange={handleFileChange}
						class="cursor-pointer text-xs file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
					/>
					{#if importError}
						<p class="text-xs text-destructive">{importError}</p>
					{/if}
				</div>
			{/if}
		</Collapsible.CollapsibleContent>
	</Collapsible.Collapsible>
</div>
```

(Note: `saveEntry`/`Input` imports above are unused — REMOVE them from the import block;
they're listed only to mark that save-to-library stays in the Editor, not here. The final
imports are: `paper`, Collapsible, `Slider`, `Button`, `Label`, `CaretDown`/`CaretRight`,
the four composition functions, `importSvg`, `m`, `LibraryPickerSheet`, `RingCanvas`, and
the `Ring`/`PathLibraryEntry`/`ApplySlot` types. The `Label` is used by the import row.)

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/components/RingMorphConfigItem.svelte.spec.ts`
Expected: PASS (3 tests). The collapsible content renders in the test DOM (shadcn Collapsible mounts content; if the content is gated by open-state in this version and the test can't see it, open it first with `await userEvent.click(page.getByRole('button', { name: /Ring 1/ }))` before asserting — apply this only if the buttons aren't found).

- [ ] **Step 5: Run svelte-autofixer**

Run the Svelte MCP `svelte-autofixer` on `RingMorphConfigItem.svelte`. Confirm `issues: []`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/RingMorphConfigItem.svelte src/lib/components/RingMorphConfigItem.svelte.spec.ts
git commit -m "feat(animate): RingMorphConfigItem — per-ring morph editor

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `SimpleSection` hosts the morph editors

**Files:**
- Modify: `src/lib/components/SimpleSection.svelte`
- Modify: `messages/en.json`, `messages/it.json` (reword one key)
- Test: `src/lib/components/SimpleSection.svelte.spec.ts`

**Interfaces:**
- Consumes: `RingMorphConfigItem` (Task 2); `composition.rings`.
- Produces: `SimpleSection` renders one `RingMorphConfigItem` per ring; empty hint when no rings.

- [ ] **Step 1: Reword `animate_simple_empty` (EN + IT)**

In `messages/en.json` set:

```json
	"animate_simple_empty": "Add a ring in the Editor, then create a morph target here.",
```

In `messages/it.json` set:

```json
	"animate_simple_empty": "Aggiungi un anello nell'Editor, poi crea qui una forma morph.",
```

- [ ] **Step 2: Recompile + parity**

Run: `bun run check` then `bun run test:unit -- run src/lib/messages-parity.spec.ts`
Expected: 0 errors; parity PASS.

- [ ] **Step 3: Write the failing test**

Add to `src/lib/components/SimpleSection.svelte.spec.ts` (inside the existing describe, and add the `composition` import at the top: `import { composition } from '$lib/state/composition';`):

```ts
	it('renders a morph editor per ring', async () => {
		composition.rings = [
			{ copies: 4, color: '#000', templatePath: { cmds: ['M', 'L', 'Z'], crds: [0, 0, 10, 0] }, secondaryTemplatePath: null, morphT: 0, ringHeight: 0.25 },
			{ copies: 4, color: '#000', templatePath: { cmds: ['M', 'L', 'Z'], crds: [0, 0, 10, 0] }, secondaryTemplatePath: null, morphT: 0, ringHeight: 0.25 }
		];
		render(SimpleSection);
		await expect.element(page.getByTestId('ring-morph-config-0')).toBeInTheDocument();
		await expect.element(page.getByTestId('ring-morph-config-1')).toBeInTheDocument();
	});

	it('shows the empty hint when there are no rings', async () => {
		composition.rings = [];
		render(SimpleSection);
		await expect
			.element(page.getByText('Add a ring in the Editor, then create a morph target here.'))
			.toBeInTheDocument();
	});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/components/SimpleSection.svelte.spec.ts`
Expected: FAIL — `ring-morph-config-0` not found (section still renders the old morphT-only list).

- [ ] **Step 5: Rewrite `SimpleSection.svelte`**

Replace the full file with:

```svelte
<script lang="ts">
	import { animationState, setLayerEnabled } from '$lib/state/animation';
	import { composition } from '$lib/state/composition';
	import { m } from '$lib/paraglide/messages';
	import SidebarCollapsible from './SidebarCollapsible.svelte';
	import RingMorphConfigItem from './RingMorphConfigItem.svelte';
</script>

<SidebarCollapsible>
	{#snippet trigger()}
		{m.animate_layer_simple()}
	{/snippet}

	{#snippet content()}
		<div class="space-y-3">
			<label class="flex items-center gap-2 text-xs font-medium">
				<input
					type="checkbox"
					data-testid="layer-toggle-simple"
					aria-label={m.animate_layer_toggle()}
					checked={animationState.layers.simple}
					onchange={(e) => setLayerEnabled('simple', (e.target as HTMLInputElement).checked)}
				/>
				{m.animate_layer_simple()}
			</label>

			{#if composition.rings.length === 0}
				<p class="text-[11px] text-muted-foreground">{m.animate_simple_empty()}</p>
			{:else}
				{#each composition.rings as ring, i (i)}
					<RingMorphConfigItem {ring} index={i} />
				{/each}
			{/if}
		</div>
	{/snippet}
</SidebarCollapsible>
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/components/SimpleSection.svelte.spec.ts`
Expected: PASS (existing toggle test + 2 new).

- [ ] **Step 7: Run svelte-autofixer**

Run the Svelte MCP `svelte-autofixer` on `SimpleSection.svelte`. Confirm `issues: []`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/components/SimpleSection.svelte src/lib/components/SimpleSection.svelte.spec.ts messages/en.json messages/it.json
git commit -m "feat(animate): SimpleSection hosts per-ring morph editors

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Strip morph UI from `RingEditor`

**Files:**
- Modify: `src/lib/components/RingEditor.svelte`
- Test: `src/lib/components/RingEditor.svelte.spec.ts`

**Interfaces:**
- Consumes: `LibraryPickerSheet` with `slots={['template']}` (Task 1).
- Produces: `RingEditor` shows only primary-shape controls; no variant toggle, no Create/Remove morph, no secondary editor; the path editor always edits `ring.templatePath`.

- [ ] **Step 1: Rewrite the failing test**

Replace the single test in `src/lib/components/RingEditor.svelte.spec.ts` (the `describe` body's `it(...)`) with:

```ts
	it('shows only the primary path editor, no morph controls', async () => {
		render(RingEditor, { ring: morphRing(), index: 0 });
		// Morph controls are gone from the editor.
		expect(page.getByRole('button', { name: 'Create morph target' }).query()).toBeNull();
		expect(page.getByRole('button', { name: 'Remove morph target' }).query()).toBeNull();
		expect(page.getByRole('button', { name: 'Secondary' }).query()).toBeNull();
		// The primary drawing + sizing controls stay.
		await expect.element(page.getByText('Path editor', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('Copies')).toBeInTheDocument();
	});
```

(The `setLayerEnabled` calls in `beforeEach` can stay; they're now inert for this
component but harmless.)

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/components/RingEditor.svelte.spec.ts`
Expected: FAIL — "Remove morph target" / "Secondary" still present.

- [ ] **Step 3: Strip the morph UI from the script**

In `src/lib/components/RingEditor.svelte`, in the `<script>`:

- Remove the import names no longer used: `createRingMorphTarget`, `removeRingMorphTarget` from the `$lib/state/composition` import (keep `updateRing`, `removeRing`, `setRingExpanded`, `isRingExpanded`, `colorMode`, `updateRingPathVariant`).
- Remove the `animationState` import (`import { animationState } from '$lib/state/animation';`) and the `morphInactive` derived.
- Remove the `editVariant` state declaration and the `$effect` that resets `editVariant` to `'primary'`.
- Simplify `handleApplyFromLibrary` to apply primary only:

```ts
	function handleApplyFromLibrary(entry: PathLibraryEntry, slot: ApplySlot) {
		libraryApplyError = null;
		if (slot === 'template') {
			const r1 = updateRingPathVariant(index, 'primary', clonePath(entry.path));
			if (!r1.ok) libraryApplyError = r1.reason;
		}
	}
```

- In `handleFileChange`, change `updateRingPathVariant(index, editVariant, path)` to
  `updateRingPathVariant(index, 'primary', path)`.
- In `applyPathFromEditor`, change `updateRingPathVariant(index, editVariant, newPath)` to
  `updateRingPathVariant(index, 'primary', newPath)`.

- [ ] **Step 4: Strip the morph UI from the markup**

In the `<Collapsible.CollapsibleContent>`:

- Remove the entire `{#if ring.secondaryTemplatePath && !morphInactive}` block (the
  Primary/Secondary variant buttons).
- Replace the `{#key editVariant}...{/key}` wrapped `RingCanvas` with a plain primary editor:

```svelte
			<RingCanvas
				templatePath={ring.templatePath}
				onchange={applyPathFromEditor}
				label={m.editor_path_editor()}
			/>
```

- Remove the entire `{#if !morphInactive} ... Create/Remove morph target ... {/if}` block.
- Change the `LibraryPickerSheet` usage to primary-only:

```svelte
			<LibraryPickerSheet bind:open={libraryOpen} slots={['template']} onapply={handleApplyFromLibrary} />
```

Leave Save to library, Import SVG, Copies, Ring height, and Color blocks unchanged.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/components/RingEditor.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 6: Run svelte-autofixer**

Run the Svelte MCP `svelte-autofixer` on `RingEditor.svelte`. Confirm `issues: []`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/RingEditor.svelte src/lib/components/RingEditor.svelte.spec.ts
git commit -m "feat(editor): strip morph UI — Editor draws the primary shape only

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Move the demo e2e morph flow to the Animate Simple window

**Files:**
- Modify: `src/routes/demo/playwright/page.svelte.e2e.ts` (the "creates and removes ring morph target controls" test)

**Interfaces:** none (e2e only). Runs in English. The Editor route is `/` (redirects to `/editor`); the Animate route is `/animate`; the Simple section header text is "Simple"; ring rows are labeled `Ring N`.

- [ ] **Step 1: Rewrite the test**

Replace the `test('creates and removes ring morph target controls', ...)` body in
`src/routes/demo/playwright/page.svelte.e2e.ts` with:

```ts
test('creates and removes ring morph target controls', async ({ page }) => {
	// Add a fresh ring in the Editor.
	await page.goto('/');
	await page.getByRole('button', { name: 'Add Ring' }).click();

	// Morph now lives in the Animate → Simple window.
	await page.goto('/animate');
	await page.getByRole('button', { name: 'Simple' }).click();

	// Open the last ring's morph editor and create a morph target.
	await page
		.getByRole('button', { name: /^Ring \d+$/ })
		.last()
		.click();
	await page.getByRole('button', { name: 'Create morph target' }).last().click();
	await expect(page.getByRole('button', { name: 'Remove morph target' }).last()).toBeVisible();

	// Removing reverts the control.
	await page.getByRole('button', { name: 'Remove morph target' }).last().click();
	await expect(page.getByRole('button', { name: 'Create morph target' }).last()).toBeVisible();
});
```

- [ ] **Step 2: Run the e2e suite**

Run: `bunx playwright test`
Expected: 6/6 PASS (builds first, ~25-35s). If the Simple section is collapsed by default
and the ring buttons aren't visible, the `getByRole('button', { name: 'Simple' }).click()`
expands it; if the section is open by default that click toggles it shut — in that case
remove the Simple-header click. Adjust based on the actual run and keep the test green.

- [ ] **Step 3: Commit**

```bash
git add src/routes/demo/playwright/page.svelte.e2e.ts
git commit -m "test(e2e): exercise morph create/remove in the Animate Simple window

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Type check** — Run: `bun run check` → Expected: 0 errors.
- [ ] **Step 2: Full unit suite** — Run: `bun run test:unit -- run` → Expected: all pass.
- [ ] **Step 3: e2e** — Run: `bunx playwright test` → Expected: 6/6.
- [ ] **Step 4: Live verification (manual)** — controller confirms in a real browser: the Editor shows no morph controls and primary curves drag-edit freely (including on a ring that has a morph target); the Animate → Simple window creates/draws/imports/library-loads/blends/removes a morph per ring; the Simple animation still runs.

## Self-Review

**Spec coverage:**
- State layer unchanged → no task (correct; verified composition.ts untouched). ✓
- Editor strip (toggle, `{#key}`, create/remove, morphInactive, editVariant, file→primary, library→primary) → Task 4. ✓
- `LibraryPickerSheet` `slots` prop → Task 1. ✓
- `RingMorphConfigItem` (create/secondary editor/import/library secondary+both/morphT/remove, testid) → Task 2. ✓
- `SimpleSection` hosts per-ring morph editors + reworded empty hint → Task 3. ✓
- i18n reuse + reword `animate_simple_empty` → Task 3. ✓
- Tests (RingEditor morph-gone, RingMorphConfigItem, SimpleSection, LibraryPickerSheet, demo e2e) → Tasks 1–5. ✓
- Gates → Task 6. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to". Full code shown. The Task 2 note flags the unused-import cleanup explicitly. ✓

**Type consistency:** `RingMorphConfigItem` props `{ ring, index }` match Task 3's usage. `LibraryPickerSheet` `slots?: ApplySlot[]` used in Tasks 2 (`['secondary','both']`) and 4 (`['template']`). `updateRingPathVariant(index, variant, path)` / `createRingMorphTarget` / `removeRingMorphTarget` / `setRingMorphT` signatures consistent with composition.ts. ✓
