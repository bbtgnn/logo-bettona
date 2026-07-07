# Curve-to-Ring Apply Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Tracciati curve selection to rings — seed a single default ring on startup, and let the user apply a chosen curve to an existing ring (replacing its primary shape) or to a brand-new ring, via a target picker with per-target previews.

**Architecture:** Reuse existing, already-built-but-unwired pieces: `addRingWithPath` and `updateRingPathVariant` (state actions in `composition.ts`), `ApplyToRingSheet` (rewritten from a slot-picker into a target-picker), and `RingPreview` (per-target preview). The apply flow only ever writes the ring's **primary** curve (`templatePath`); morph / secondary curves are an Animate concern, out of scope.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript, Paper.js (via `RingPreview`), Paraglide i18n (`m.*`), Vitest (browser via `vitest-browser-svelte`), shadcn/svelte Sheet.

## Global Constraints

- **Primary only, in Tracciati.** A curve applied from Tracciati always replaces the ring's `templatePath`. No secondary / slot UI exists in this section. Morph and the secondary curve are Animate concerns (future PR).
- **Do not touch runtime/transient state.** Never write `wave`, `zoneDrive`, or morph fields from this flow. Only `templatePath` (via the sanctioned actions).
- **Do not touch the temporary seams.** `RingMorphConfigItem`, `createRingMorphTarget`, kaleidoscope — untouched.
- **Reuse, don't reinvent.** `addRingWithPath`, `updateRingPathVariant`, `RingPreview` already exist. `LibraryPickerSheet` (Editor's reverse flow) stays as-is.
- **Both locales.** Every new i18n key MUST be added to both `messages/en.json` and `messages/it.json`, then compiled with `npm run paraglide`.
- **Package manager:** `bun` is configured, but the npm scripts work; use `npm run <script>` as shown (matches existing plans).

---

### Task 1: Seed a single default ring

**Files:**
- Modify: `src/lib/state/default.ts` (export a shared default-curve constant; seed one ring)
- Modify: `src/lib/state/composition.ts:63-77` (reuse the shared constant in `DEFAULT_RING`)
- Test: `src/lib/state/default.spec.ts` (create)

**Interfaces:**
- Produces: `DEFAULT_RING_PATH: Path` exported from `src/lib/state/default.ts`; `DEFAULT_COMPOSITION.rings` now has length 1.

**Context:** Today `DEFAULT_COMPOSITION.rings = []` (empty). The default arc curve is currently a bare literal inside `DEFAULT_RING` in `composition.ts`. We extract that arc into one shared constant so the seed ring and `DEFAULT_RING` cannot diverge. `default.ts` currently imports only the `Composition` type; adding a `Path` import and a constant introduces no cycle (`composition.ts` may import from `default.ts` — `default.ts` has no dependency on `composition.ts`).

- [ ] **Step 1: Write the failing test**

Create `src/lib/state/default.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_COMPOSITION, DEFAULT_RING_PATH } from './default';

describe('DEFAULT_COMPOSITION', () => {
	it('seeds exactly one ring on the default curve', () => {
		expect(DEFAULT_COMPOSITION.rings).toHaveLength(1);
	});

	it('seeds the ring with the default arc as its primary curve, no morph', () => {
		const ring = DEFAULT_COMPOSITION.rings[0];
		expect(ring.templatePath).toEqual(DEFAULT_RING_PATH);
		expect(ring.secondaryTemplatePath).toBeNull();
		expect(ring.morphT).toBe(0);
		expect(ring.copies).toBe(8);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- --run src/lib/state/default.spec.ts`
Expected: FAIL — `DEFAULT_RING_PATH` is not exported / `rings` has length 0.

- [ ] **Step 3: Edit `src/lib/state/default.ts`**

Replace the whole file with:

```ts
import type { Composition, Path } from '$lib/types';

/**
 * The default arc curve. Shared by the seeded default ring below and by
 * DEFAULT_RING in composition.ts, so the two can never diverge.
 */
export const DEFAULT_RING_PATH: Path = {
	cmds: ['M', 'C', 'C'],
	crds: [
		20, 117.61326806392421, 59, 117.50800490602947, 32.43817613081838, 82.72961144836285,
		61.688995215311024, 62.77907643368346, 83.43200751345759, 47.9492445945898, 101,
		66.54953384995142, 180, 67.38673193607579
	]
};

export const DEFAULT_COMPOSITION: Composition = {
	baseRadius: 5,
	ringIncrement: 2,
	aspectRatio: '1:1',
	rings: [
		{
			id: 'ring-default',
			copies: 8,
			color: '#000000',
			templatePath: DEFAULT_RING_PATH,
			secondaryTemplatePath: null,
			morphT: 0,
			ringHeight: 0.12
		}
	],
	monochromePalettes: [
		{
			primary: '#000000',
			secondary: '#ffffff',
			background: '#ffffff'
		}
	],
	fullPalettes: [
		{
			colors: ['#1a1a2e', '#16213e', '#0f3460', '#e94560']
		},
		{
			colors: ['#2d6a4f', '#40916c', '#74c69d', '#d8f3dc']
		},
		{
			colors: ['#f72585', '#7209b7', '#3a0ca3', '#4361ee', '#4cc9f0']
		},
		{
			colors: ['#000000', '#ffffff']
		}
	]
};
```

- [ ] **Step 4: Reuse the constant in `composition.ts`**

In `src/lib/state/composition.ts`, add `DEFAULT_RING_PATH` to the import from `./default` (there is no existing import from `./default`; add one near the other state imports around line 17):

```ts
import { DEFAULT_RING_PATH } from './default';
```

Then change the `DEFAULT_RING` literal (currently at `src/lib/state/composition.ts:63-77`) so its `templatePath` uses the shared constant:

```ts
const DEFAULT_RING: Omit<Ring, 'id'> = {
	copies: 8,
	color: '#000000',
	templatePath: DEFAULT_RING_PATH,
	secondaryTemplatePath: null,
	morphT: 0,
	ringHeight: 0.12
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:unit -- --run src/lib/state/default.spec.ts`
Expected: PASS (both tests).

- [ ] **Step 6: Typecheck**

Run: `npm run check`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/state/default.ts src/lib/state/default.spec.ts src/lib/state/composition.ts
git commit -m "feat: seed a single default ring on the default curve"
```

---

### Task 2: Rewrite ApplyToRingSheet as a target picker

**Files:**
- Modify: `src/lib/state/path-library.ts:37` (add `ApplyTarget` type)
- Modify: `src/lib/components/ApplyToRingSheet.svelte` (rewrite: target radio-list + per-target `RingPreview`, drop slot UI)
- Modify: `messages/en.json`, `messages/it.json` (update `apply_title`/`apply_desc`, add `apply_target_new`, remove orphan `apply_ring_label`)
- Test: `src/lib/components/ApplyToRingSheet.svelte.spec.ts` (rewrite)

**Interfaces:**
- Consumes: `DEFAULT_COMPOSITION` seed (Task 1) is unrelated here; this task consumes `RingPreview` props (`path`, `copies`, `baseRadius`, `ringIncrement`, `size`) and the `composition` singleton (`baseRadius`, `ringIncrement`).
- Produces: `ApplyTarget = { kind: 'existing'; index: number } | { kind: 'new' }` exported from `src/lib/state/path-library.ts`; `ApplyToRingSheet` prop `onapply: (target: ApplyTarget) => void`.

**Context:** The current sheet has a ring `<select>` + slot radios (`template`/`secondary`/`both`) and calls `onapply(ringIndex, slot)`. We replace it with a radio-list of targets: one row per existing ring plus a final "new ring" row, each showing a `RingPreview` of the chosen curve at that target's real settings. The slot concept is removed entirely from this component. `ApplySlot` and `applyEntryToRing` stay in `path-library.ts` (still used by `LibraryPickerSheet`).

- [ ] **Step 1: Add the `ApplyTarget` type**

In `src/lib/state/path-library.ts`, right after the `ApplySlot` type (line 37), add:

```ts
export type ApplyTarget = { kind: 'existing'; index: number } | { kind: 'new' };
```

- [ ] **Step 2: Add / update i18n keys**

In `messages/en.json`, change these two entries and add one; remove `apply_ring_label`:

```json
	"apply_title": "Apply curve",
	"apply_desc": "Choose the ring to update, or create a new ring.",
	"apply_target_new": "New ring",
```

(Delete the `"apply_ring_label": "Ring",` line — it becomes orphan.)

In `messages/it.json`, mirror it:

```json
	"apply_title": "Applica curva",
	"apply_desc": "Scegli l'anello da aggiornare o crea un nuovo anello.",
	"apply_target_new": "Nuovo anello",
```

(Delete the `"apply_ring_label": "Anello",` line.)

Keep `common_slot`, `slot_primary`, `slot_secondary`, `slot_both` — `LibraryPickerSheet` still uses them.

- [ ] **Step 3: Compile messages**

Run: `npm run paraglide`
Expected: regenerates `src/lib/paraglide/messages`; `m.apply_target_new` now exists, `m.apply_ring_label` no longer exists.

- [ ] **Step 4: Write the failing test**

Replace the entire contents of `src/lib/components/ApplyToRingSheet.svelte.spec.ts` with:

```ts
import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Path, PathLibraryEntry, Ring } from '$lib/types';
import { switchLocale } from '$lib/state/locale.svelte';
import { newRingId } from '$lib/state/ring-id';

// Keep RingPreview cheap and deterministic: stub the Paper.js pipeline so the
// per-target previews render a <canvas> without real geometry work.
vi.mock('$lib/geometry/render-pipeline', () => ({
	createRenderPipeline: () => ({ render: () => {}, dispose: () => {} })
}));

import ApplyToRingSheet from './ApplyToRingSheet.svelte';

const PATH: Path = { cmds: ['M', 'L', 'Z'], crds: [0, 0, 10, 0] };

function entry(): PathLibraryEntry {
	return {
		id: 'e1',
		name: 'Forma',
		createdAt: 1,
		path: { cmds: [...PATH.cmds], crds: [...PATH.crds] },
		secondaryPath: null
	};
}

function ring(): Ring {
	return {
		id: newRingId(),
		copies: 8,
		color: '#000',
		templatePath: { cmds: [...PATH.cmds], crds: [...PATH.crds] },
		secondaryTemplatePath: null,
		morphT: 0,
		ringHeight: 0.25
	};
}

describe('ApplyToRingSheet', () => {
	beforeEach(() => switchLocale('en'));

	it('lists one target per ring plus a new-ring target', async () => {
		render(ApplyToRingSheet, {
			props: { open: true, entry: entry(), rings: [ring(), ring()], onapply: vi.fn() }
		});
		await expect.element(page.getByTestId('apply-target-existing-0')).toBeInTheDocument();
		await expect.element(page.getByTestId('apply-target-existing-1')).toBeInTheDocument();
		await expect.element(page.getByTestId('apply-target-new')).toBeInTheDocument();
	});

	it('confirm on an existing ring calls onapply with that index', async () => {
		const onapply = vi.fn();
		render(ApplyToRingSheet, {
			props: { open: true, entry: entry(), rings: [ring(), ring()], onapply }
		});
		await userEvent.click(page.getByTestId('apply-target-existing-1'));
		await userEvent.click(page.getByTestId('apply-confirm'));
		expect(onapply).toHaveBeenCalledWith({ kind: 'existing', index: 1 });
	});

	it('confirm on the new-ring target calls onapply with kind new', async () => {
		const onapply = vi.fn();
		render(ApplyToRingSheet, {
			props: { open: true, entry: entry(), rings: [ring()], onapply }
		});
		await userEvent.click(page.getByTestId('apply-target-new'));
		await userEvent.click(page.getByTestId('apply-confirm'));
		expect(onapply).toHaveBeenCalledWith({ kind: 'new' });
	});

	it('does not apply when the selected ring index is out of range after rings shrink', async () => {
		const onapply = vi.fn();
		const { rerender } = render(ApplyToRingSheet, {
			props: { open: true, entry: entry(), rings: [ring(), ring(), ring()], onapply }
		});
		await userEvent.click(page.getByTestId('apply-target-existing-2'));
		await rerender({ open: true, entry: entry(), rings: [ring()], onapply });
		await userEvent.click(page.getByTestId('apply-confirm'));
		expect(onapply).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npm run test:unit -- --run src/lib/components/ApplyToRingSheet.svelte.spec.ts`
Expected: FAIL — old testids (`apply-ring-select`) gone / new testids not found.

- [ ] **Step 6: Rewrite the component**

Replace the entire contents of `src/lib/components/ApplyToRingSheet.svelte` with:

```svelte
<script lang="ts">
	import * as Sheet from '$lib/shadcn/ui/sheet/index.js';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import PathThumbnail from './PathThumbnail.svelte';
	import RingPreview from './RingPreview.svelte';
	import type { PathLibraryEntry, Ring } from '$lib/types';
	import type { ApplyTarget } from '$lib/state/path-library';
	import { composition } from '$lib/state/composition';
	import { m } from '$lib/paraglide/messages';
	import { untrack } from 'svelte';

	// Copies a brand-new ring gets; mirrors addRingWithPath in composition.ts.
	const NEW_RING_COPIES = 8;

	let {
		open = $bindable(false),
		entry,
		rings,
		onapply
	}: {
		open?: boolean;
		entry: PathLibraryEntry | null;
		rings: Ring[];
		onapply: (target: ApplyTarget) => void;
	} = $props();

	// Selected target: an existing ring index, or the 'new' sentinel.
	let selected = $state<number | 'new'>(untrack(() => (rings.length > 0 ? 0 : 'new')));

	// Reset to the default target when the sheet closes so it opens fresh.
	$effect(() => {
		if (!open) {
			selected = rings.length > 0 ? 0 : 'new';
		}
	});

	function confirm() {
		if (!entry) return;
		if (selected === 'new') {
			onapply({ kind: 'new' });
			open = false;
			return;
		}
		// Guard: rings can shrink under the sheet; a stale index would dereference
		// an undefined ring downstream.
		if (selected < 0 || selected >= rings.length) return;
		onapply({ kind: 'existing', index: selected });
		open = false;
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content side="right" class="w-[420px] sm:w-[480px]">
		<Sheet.Header>
			<Sheet.Title>{m.apply_title()}</Sheet.Title>
			<Sheet.Description>{m.apply_desc()}</Sheet.Description>
		</Sheet.Header>

		{#if entry}
			<div class="mt-4 space-y-4">
				<div class="flex items-center gap-3 rounded border p-2">
					<PathThumbnail path={entry.path} secondaryPath={entry.secondaryPath} size={64} />
					<div class="text-sm font-medium">{entry.name}</div>
				</div>

				<div class="flex flex-col gap-2" role="radiogroup">
					{#each rings as ring, i (ring.id)}
						<label
							class="flex items-center gap-3 rounded border p-2 text-sm hover:bg-muted"
							data-testid="apply-target-existing-{i}"
						>
							<input
								type="radio"
								name="apply-target"
								value={i}
								checked={selected === i}
								onchange={() => (selected = i)}
							/>
							<span class="flex-1">{m.editor_ring_label({ index: i + 1 })}</span>
							<RingPreview
								path={entry.path}
								copies={ring.copies}
								baseRadius={composition.baseRadius}
								ringIncrement={composition.ringIncrement}
								size={72}
							/>
						</label>
					{/each}

					<label
						class="flex items-center gap-3 rounded border border-dashed p-2 text-sm hover:bg-muted"
						data-testid="apply-target-new"
					>
						<input
							type="radio"
							name="apply-target"
							value="new"
							checked={selected === 'new'}
							onchange={() => (selected = 'new')}
						/>
						<span class="flex-1">{m.apply_target_new()}</span>
						<RingPreview
							path={entry.path}
							copies={NEW_RING_COPIES}
							baseRadius={composition.baseRadius}
							ringIncrement={composition.ringIncrement}
							size={72}
						/>
					</label>
				</div>

				<div class="flex justify-end gap-2">
					<Button variant="outline" size="sm" onclick={() => (open = false)}>
						{m.common_back()}
					</Button>
					<Button size="sm" onclick={confirm} data-testid="apply-confirm">
						{m.common_apply()}
					</Button>
				</div>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
```

Note: the `data-testid` sits on the `<label>`, and clicking a label toggles its nested radio, so `userEvent.click(getByTestId('apply-target-existing-1'))` selects that target.

- [ ] **Step 7: Run the Svelte autofixer**

Use the `mcp__svelte__svelte-autofixer` tool on `ApplyToRingSheet.svelte`. Apply fixes until it returns no issues.

- [ ] **Step 8: Run test to verify it passes**

Run: `npm run test:unit -- --run src/lib/components/ApplyToRingSheet.svelte.spec.ts`
Expected: PASS (all four tests).

- [ ] **Step 9: Typecheck + lint**

Run: `npm run check && npm run lint`
Expected: no errors (in particular, no dead `apply_ring_label` reference).

- [ ] **Step 10: Commit**

```bash
git add src/lib/state/path-library.ts src/lib/components/ApplyToRingSheet.svelte src/lib/components/ApplyToRingSheet.svelte.spec.ts messages/en.json messages/it.json src/lib/paraglide
git commit -m "feat: turn ApplyToRingSheet into a ring target picker"
```

---

### Task 3: Wire the apply flow into Tracciati

**Files:**
- Modify: `messages/en.json`, `messages/it.json` (add `tracciati_apply`)
- Modify: `src/routes/paths/+page.svelte` (add "Use this curve" button + `ApplyToRingSheet` + handler)
- Test: `src/routes/paths/page.svelte.spec.ts` (add cases)

**Interfaces:**
- Consumes: `ApplyToRingSheet` with `onapply: (target: ApplyTarget) => void` (Task 2); `addRingWithPath(path)` and `updateRingPathVariant(index, 'primary', path)` from `$lib/state/composition`.
- Produces: user-facing entry point `data-testid="tracciati-apply"`.

**Context:** The page already resolves a `selected` curve (a `PathLibraryEntry`) and shows its `RingPreview` in `tracciati-preview`. We add a button under that preview to open the sheet, and a handler that dispatches to the right state action. After apply the sheet closes and the user stays on `/paths` (no navigation).

- [ ] **Step 1: Add i18n key**

In `messages/en.json` add:

```json
	"tracciati_apply": "Use this curve",
```

In `messages/it.json` add:

```json
	"tracciati_apply": "Usa questa curva",
```

- [ ] **Step 2: Compile messages**

Run: `npm run paraglide`
Expected: `m.tracciati_apply` now exists.

- [ ] **Step 3: Write the failing tests**

Append these cases to `src/routes/paths/page.svelte.spec.ts` inside the existing `describe('Tracciati v2 page', ...)` block (after the last `it`). Also add the imports at the top of the file.

Add to the imports block:

```ts
import { userEvent } from 'vitest/browser';
import { composition, addRingWithPath } from '$lib/state/composition';
import { newRingId } from '$lib/state/ring-id';
```

Add these tests:

```ts
	it('opens the apply sheet from the "Use this curve" button', async () => {
		render(PathsPage);
		await page.getByTestId('tracciati-apply').click();
		await expect.element(page.getByTestId('apply-confirm')).toBeInTheDocument();
	});

	it('applying to a new ring appends a ring carrying the selected curve', async () => {
		composition.rings = [];
		render(PathsPage);
		// selected falls back to builtins[0]; capture its path before applying.
		await page.getByTestId('base-curve-builtin-0').click();
		const curve = pathLibrary.entries.find((e) => e.id === 'builtin-0')!;
		await page.getByTestId('tracciati-apply').click();
		await page.getByTestId('apply-target-new').click();
		await page.getByTestId('apply-confirm').click();
		expect(composition.rings).toHaveLength(1);
		expect(composition.rings[0].templatePath).toEqual(curve.path);
	});

	it('applying to an existing ring replaces its primary curve, keeping copies', async () => {
		composition.rings = [
			{
				id: newRingId(),
				copies: 12,
				color: '#000',
				templatePath: { cmds: ['M', 'L'], crds: [0, 0, 1, 1] },
				secondaryTemplatePath: null,
				morphT: 0,
				ringHeight: 0.1
			}
		];
		render(PathsPage);
		await page.getByTestId('base-curve-builtin-0').click();
		const curve = pathLibrary.entries.find((e) => e.id === 'builtin-0')!;
		await page.getByTestId('tracciati-apply').click();
		await page.getByTestId('apply-target-existing-0').click();
		await page.getByTestId('apply-confirm').click();
		expect(composition.rings).toHaveLength(1);
		expect(composition.rings[0].templatePath).toEqual(curve.path);
		expect(composition.rings[0].copies).toBe(12);
	});
```

Note: `beforeEach` already sets `pathLibrary.entries = []`; `seedBuiltinCurves()` re-seeds `builtin-0..9` on render. Confirm the builtin id prefix is `builtin-` by checking `base-curve-builtin-0` already used in the existing passing test — it is.

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm run test:unit -- --run src/routes/paths/page.svelte.spec.ts`
Expected: FAIL — `tracciati-apply` not found.

- [ ] **Step 5: Wire the page**

In `src/routes/paths/+page.svelte`:

(a) Add to the imports block (after the existing `composition` import around line 13):

```ts
	import { composition, updateRingPathVariant, addRingWithPath } from '$lib/state/composition';
	import ApplyToRingSheet from '$lib/components/ApplyToRingSheet.svelte';
	import type { ApplyTarget } from '$lib/state/path-library';
```

Remove the now-duplicated standalone `import { composition } from '$lib/state/composition';` line (line 13) — fold it into the combined import above.

(b) Add state + handler in the `<script>` (after the `selected` derived, around line 34):

```ts
	let applyOpen = $state(false);

	function clonePath(p: { cmds: string[]; crds: number[] }) {
		return { cmds: [...p.cmds], crds: [...p.crds] };
	}

	function handleApply(target: ApplyTarget) {
		if (!selected) return;
		const path = clonePath(selected.path);
		if (target.kind === 'new') {
			addRingWithPath(path);
		} else {
			updateRingPathVariant(target.index, 'primary', path);
		}
	}
```

(c) In the main pane, add the button and sheet under the `RingPreview`. Change the `tracciati-preview` block (currently lines 126-138) to:

```svelte
				{#if selected}
					<div class="flex flex-col items-center gap-4" data-testid="tracciati-preview">
						{#key selected.id}
							<RingPreview
								path={selected.path}
								secondaryPath={selected.secondaryPath}
								baseRadius={composition.baseRadius}
								ringIncrement={composition.ringIncrement}
								size={360}
							/>
						{/key}
						<Button data-testid="tracciati-apply" onclick={() => (applyOpen = true)}>
							{m.tracciati_apply()}
						</Button>
					</div>
					<ApplyToRingSheet
						bind:open={applyOpen}
						entry={selected}
						rings={composition.rings}
						onapply={handleApply}
					/>
				{/if}
```

(`Button` is already imported in this file.)

- [ ] **Step 6: Run the Svelte autofixer**

Use the `mcp__svelte__svelte-autofixer` tool on `+page.svelte`. Apply fixes until it returns no issues.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm run test:unit -- --run src/routes/paths/page.svelte.spec.ts`
Expected: PASS (existing 4 + new 3).

- [ ] **Step 8: Full check + lint**

Run: `npm run check && npm run lint`
Expected: no errors.

- [ ] **Step 9: Visual check (risky-step gate)**

Run: `npm run dev`, open `/paths`. Verify: a default ring already exists; selecting a curve then "Use this curve" opens the sheet; each target row shows a preview at its own copies; applying to "New ring" adds a ring; applying to an existing ring swaps its shape. Stop the dev server when done.

- [ ] **Step 10: Commit**

```bash
git add src/routes/paths/+page.svelte src/routes/paths/page.svelte.spec.ts messages/en.json messages/it.json src/lib/paraglide
git commit -m "feat: apply a Tracciati curve to a ring from the paths page"
```

---

### Task 4: Full suite + surface touched files

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit suite**

Run: `npm run test:unit -- --run`
Expected: all pass. If `page.svelte.spec.ts` cases interfere via the shared `composition` singleton, ensure each new test sets `composition.rings` explicitly (already done in Task 3).

- [ ] **Step 2: Typecheck + lint (whole project)**

Run: `npm run check && npm run lint`
Expected: clean.

- [ ] **Step 3: List touched files and stop**

Run: `git diff --stat main...HEAD` (or `git log --oneline main..HEAD`) and present the touched-files list to the designer. Do **not** create the final merge/PR commit — the designer handles that.

---

## Self-Review

**Spec coverage:**
- Seed one default ring on the default arc → Task 1. ✓
- Entry point "Use this curve" under the preview → Task 3 step 5c. ✓
- Target picker: existing rings + "new ring", per-target real-settings preview → Task 2 (component) + `RingPreview copies={ring.copies}` / `NEW_RING_COPIES`. ✓
- Apply to existing = replace primary (`updateRingPathVariant(...,'primary',...)`); apply to new = `addRingWithPath` → Task 3 handler. ✓
- Primary-only, no slot/secondary UI in Tracciati → Task 2 removes slot UI; handler only writes primary. ✓
- Stay in Tracciati after apply, no navigation/toast → Task 3 handler does nothing after the action; sheet self-closes. ✓
- Don't touch morph seam / kaleidoscope / transient state → no such files modified. ✓
- Both locales + paraglide compile → Task 2 step 2-3, Task 3 step 1-2. ✓
- Reuse `RingPreview`, `addRingWithPath`, `updateRingPathVariant`; leave `LibraryPickerSheet` → honored. ✓

**Placeholder scan:** no TBD/TODO; every code step has full code. ✓

**Type consistency:** `ApplyTarget = { kind: 'existing'; index: number } | { kind: 'new' }` defined in Task 2 (path-library.ts), consumed identically in Task 2 (component prop) and Task 3 (`handleApply`). `onapply` signature `(target: ApplyTarget) => void` consistent across component, spec, and page. `RingPreview` props (`path`, `copies`, `baseRadius`, `ringIncrement`, `size`) match its actual definition. `DEFAULT_RING_PATH` exported in Task 1, imported in Task 1 (composition.ts) — no later task renames it. ✓
