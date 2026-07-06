# Move Kaleidoscope panel to Composition — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Kaleidoscope its single home in Composition (static look, behind a Poster/Caleidoscopio switch), leaving only its audio controls in Animate.

**Architecture:** Pure view move. The Poster/Caleidoscopio switch maps onto the existing `kaleidoscope.enabled` flag (Poster = `false`, Caleidoscopio = `true`); no new state or render logic. The one over-loaded `KaleidoscopeSection.svelte` splits into three focused view components — a static-look panel (Composition), an audio-remainder section (Animate), and a segmented mode switch (Composition) — then is deleted.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript, bun, vitest (vitest-browser-svelte), Paraglide i18n, Tailwind, shadcn/svelte.

## Global Constraints

- Package manager is **bun**; run scripts as `bun run <script>`.
- **Move the view, do not rewrite the logic.** No changes to `$lib/state/*`, `preview-presenter.svelte.ts`, the render pipeline, or export.
- Kaleidoscope state is the global module `$lib/state/kaleidoscope.svelte` — panels are views onto it; saved config must stay identical (do not reset or migrate state).
- Audio animation on the kaleidoscope scene must keep working — its two toggles (`layers.kaleidoscope` gate + `liveTile`) keep a home in Animate.
- DOM/interaction tests MUST be named `*.svelte.spec.ts` (vitest browser project); plain `*.spec.ts` runs in node.
- New `m.*` keys resolve only after Paraglide compiles: run `bun run paraglide` (or `bun run check`, which compiles first) before typecheck/tests.
- Per CLAUDE.md: run the Svelte MCP `svelte-autofixer` on every new/edited `.svelte` file until it returns no issues, before committing.
- Existing `editor_*` message-key naming (now used outside Editor) is **out of scope** — do not rename.
- Poster mode adds **no** poster-specific controls this PR (a hint line only).

---

### Task 1: Add i18n keys for the switch and audio section

**Files:**
- Modify: `messages/en.json` (after line 175, `"composition_print_format"`)
- Modify: `messages/it.json` (after line 175, `"composition_print_format"`)

**Interfaces:**
- Consumes: nothing.
- Produces: message keys `m.composition_layout`, `m.composition_layout_poster`, `m.composition_layout_kaleidoscope`, `m.composition_poster_hint`, `m.animate_kaleidoscope_audio` (all `() => string`).

- [ ] **Step 1: Add the English keys**

In `messages/en.json`, immediately after the `"composition_print_format": "Print format",` line, add:

```json
	"composition_layout": "Layout",
	"composition_layout_poster": "Poster",
	"composition_layout_kaleidoscope": "Kaleidoscope",
	"composition_poster_hint": "Single mark, no controls yet",
	"animate_kaleidoscope_audio": "Kaleidoscope (audio)",
```

- [ ] **Step 2: Add the Italian keys**

In `messages/it.json`, immediately after the `"composition_print_format": "Formato di stampa",` line, add:

```json
	"composition_layout": "Layout",
	"composition_layout_poster": "Poster",
	"composition_layout_kaleidoscope": "Caleidoscopio",
	"composition_poster_hint": "Marchio singolo, nessun controllo",
	"animate_kaleidoscope_audio": "Caleidoscopio (audio)",
```

- [ ] **Step 3: Compile the messages**

Run: `bun run paraglide`
Expected: completes without error; `src/lib/paraglide/messages/` regenerates with the new keys.

- [ ] **Step 4: Verify keys resolve**

Run: `bun run check`
Expected: 0 errors, 0 warnings (compiles messages first, then typechecks — proves keys exist).

- [ ] **Step 5: Commit**

```bash
git add messages/en.json messages/it.json
git commit -m "i18n: add layout-switch and kaleidoscope-audio message keys"
```

---

### Task 2: `KaleidoscopePanel.svelte` — static look for Composition

**Files:**
- Create: `src/lib/components/KaleidoscopePanel.svelte`
- Test: `src/lib/components/KaleidoscopePanel.svelte.spec.ts`

**Interfaces:**
- Consumes: `kaleidoscope`, `setCircularMask` from `$lib/state/kaleidoscope.svelte`; `KALEIDO_PARAMS` from `$lib/state/kaleidoscope-params`; `AnimatableSlider`, `SidebarCollapsible`; `m.editor_kaleidoscope`, `m.editor_kaleido_circular_mask`.
- Produces: default component `KaleidoscopePanel` (no props). Renders the eight static sliders + circular-mask checkbox. Renders **no** enabled checkbox, **no** stopwatches, **no** audio rows.

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/KaleidoscopePanel.svelte.spec.ts`:

```ts
import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import KaleidoscopePanel from './KaleidoscopePanel.svelte';
import { kaleidoscope, setCircularMask } from '$lib/state/kaleidoscope.svelte';
import { switchLocale } from '$lib/state/locale.svelte';

describe('KaleidoscopePanel', () => {
	beforeEach(() => switchLocale('en'));

	it('wires a static slider to its setter', async () => {
		render(KaleidoscopePanel);
		await userEvent.fill(page.getByLabelText('Sectors', { exact: true }), '12');
		expect(kaleidoscope.sectors).toBe(12);
	});

	it('toggles the circular mask', async () => {
		setCircularMask(true);
		render(KaleidoscopePanel);
		await userEvent.click(page.getByLabelText('Circular mask'));
		expect(kaleidoscope.circularMask).toBe(false);
	});

	it('shows no enabled checkbox, stopwatches, or audio rows', async () => {
		render(KaleidoscopePanel);
		expect(page.getByLabelText('Kaleidoscope mode').query()).toBeNull();
		expect(page.getByLabelText('Animate Sectors').query()).toBeNull();
		expect(page.getByLabelText('Live tile').query()).toBeNull();
		expect(page.getByTestId('layer-toggle-kaleidoscope').query()).toBeNull();
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test:unit -- --run src/lib/components/KaleidoscopePanel.svelte.spec.ts`
Expected: FAIL — cannot resolve `./KaleidoscopePanel.svelte`.

- [ ] **Step 3: Write the component**

Create `src/lib/components/KaleidoscopePanel.svelte`:

```svelte
<script lang="ts">
	import SidebarCollapsible from './SidebarCollapsible.svelte';
	import AnimatableSlider from './AnimatableSlider.svelte';
	import { kaleidoscope, setCircularMask } from '$lib/state/kaleidoscope.svelte';
	import { KALEIDO_PARAMS } from '$lib/state/kaleidoscope-params';
	import { m } from '$lib/paraglide/messages';

	const checked = (e: Event) => (e.target as HTMLInputElement).checked;
</script>

<SidebarCollapsible>
	{#snippet trigger()}
		{m.editor_kaleidoscope()}
	{/snippet}

	{#snippet content()}
		<div class="flex flex-col gap-3">
			{#each KALEIDO_PARAMS as param (param.id)}
				<AnimatableSlider {param} animatable={false} />
			{/each}

			<label class="flex items-center gap-2 text-xs">
				<input
					type="checkbox"
					aria-label={m.editor_kaleido_circular_mask()}
					checked={kaleidoscope.circularMask}
					onchange={(e) => setCircularMask(checked(e))}
				/>
				{m.editor_kaleido_circular_mask()}
			</label>
		</div>
	{/snippet}
</SidebarCollapsible>
```

- [ ] **Step 4: Run the autofixer**

Use Svelte MCP `svelte-autofixer` on `src/lib/components/KaleidoscopePanel.svelte`. Re-run until it reports no issues; apply any fixes.

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun run test:unit -- --run src/lib/components/KaleidoscopePanel.svelte.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/KaleidoscopePanel.svelte src/lib/components/KaleidoscopePanel.svelte.spec.ts
git commit -m "feat(composition): static Kaleidoscope look panel"
```

---

### Task 3: `LayoutModeSwitch.svelte` — Poster/Caleidoscopio segmented control

**Files:**
- Create: `src/lib/components/LayoutModeSwitch.svelte`
- Test: `src/lib/components/LayoutModeSwitch.svelte.spec.ts`

**Interfaces:**
- Consumes: `kaleidoscope`, `setKaleidoscopeEnabled` from `$lib/state/kaleidoscope.svelte`; `Button` from `$lib/shadcn/ui/button/index.js`; `m.composition_layout`, `m.composition_layout_poster`, `m.composition_layout_kaleidoscope`, `m.composition_poster_hint`.
- Produces: default component `LayoutModeSwitch` (no props). Two buttons named "Poster" and "Kaleidoscope"; the active one reflects `kaleidoscope.enabled` (Poster active when `false`). Clicking sets `kaleidoscope.enabled` via `setKaleidoscopeEnabled`. Poster hint shows only when Poster is active.

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/LayoutModeSwitch.svelte.spec.ts`:

```ts
import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import LayoutModeSwitch from './LayoutModeSwitch.svelte';
import { kaleidoscope, setKaleidoscopeEnabled } from '$lib/state/kaleidoscope.svelte';
import { switchLocale } from '$lib/state/locale.svelte';

describe('LayoutModeSwitch', () => {
	beforeEach(() => {
		switchLocale('en');
		setKaleidoscopeEnabled(false);
	});

	it('selecting Kaleidoscope enables the kaleidoscope', async () => {
		render(LayoutModeSwitch);
		await userEvent.click(page.getByRole('button', { name: 'Kaleidoscope' }));
		expect(kaleidoscope.enabled).toBe(true);
	});

	it('selecting Poster disables the kaleidoscope', async () => {
		setKaleidoscopeEnabled(true);
		render(LayoutModeSwitch);
		await userEvent.click(page.getByRole('button', { name: 'Poster' }));
		expect(kaleidoscope.enabled).toBe(false);
	});

	it('marks the active mode with aria-pressed', async () => {
		render(LayoutModeSwitch);
		await expect
			.element(page.getByRole('button', { name: 'Poster' }))
			.toHaveAttribute('aria-pressed', 'true');
		await expect
			.element(page.getByRole('button', { name: 'Kaleidoscope' }))
			.toHaveAttribute('aria-pressed', 'false');
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test:unit -- --run src/lib/components/LayoutModeSwitch.svelte.spec.ts`
Expected: FAIL — cannot resolve `./LayoutModeSwitch.svelte`.

- [ ] **Step 3: Write the component**

Create `src/lib/components/LayoutModeSwitch.svelte`:

```svelte
<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { kaleidoscope, setKaleidoscopeEnabled } from '$lib/state/kaleidoscope.svelte';
	import { m } from '$lib/paraglide/messages';
</script>

<div class="flex flex-col gap-2 p-2">
	<span class="text-xs font-medium">{m.composition_layout()}</span>
	<div class="flex gap-1" role="group" aria-label={m.composition_layout()}>
		<Button
			variant={kaleidoscope.enabled ? 'outline' : 'default'}
			class="flex-1"
			aria-pressed={!kaleidoscope.enabled}
			onclick={() => setKaleidoscopeEnabled(false)}
		>
			{m.composition_layout_poster()}
		</Button>
		<Button
			variant={kaleidoscope.enabled ? 'default' : 'outline'}
			class="flex-1"
			aria-pressed={kaleidoscope.enabled}
			onclick={() => setKaleidoscopeEnabled(true)}
		>
			{m.composition_layout_kaleidoscope()}
		</Button>
	</div>
	{#if !kaleidoscope.enabled}
		<p class="text-[10px] text-muted-foreground">{m.composition_poster_hint()}</p>
	{/if}
</div>
```

- [ ] **Step 4: Run the autofixer**

Use Svelte MCP `svelte-autofixer` on `src/lib/components/LayoutModeSwitch.svelte`. Re-run until no issues; apply any fixes.

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun run test:unit -- --run src/lib/components/LayoutModeSwitch.svelte.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/LayoutModeSwitch.svelte src/lib/components/LayoutModeSwitch.svelte.spec.ts
git commit -m "feat(composition): Poster/Kaleidoscope layout switch"
```

---

### Task 4: `KaleidoscopeAudioSection.svelte` — audio remainder for Animate

**Files:**
- Create: `src/lib/components/KaleidoscopeAudioSection.svelte`
- Test: `src/lib/components/KaleidoscopeAudioSection.svelte.spec.ts`

**Interfaces:**
- Consumes: `kaleidoscope`, `setLiveTile` from `$lib/state/kaleidoscope.svelte`; `animationState`, `setLayerEnabled` from `$lib/state/animation`; `SidebarCollapsible`; `m.animate_kaleidoscope_audio`, `m.animate_kaleidoscope_layer_toggle`, `m.editor_kaleido_live_tile` (aria), `m.editor_kaleido_live_tile_audio` (label).
- Produces: default component `KaleidoscopeAudioSection` (no props). Renders the layer gate (`data-testid="layer-toggle-kaleidoscope"`) and the live-tile checkbox. Renders **no** sliders and **no** circular mask.

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/KaleidoscopeAudioSection.svelte.spec.ts`:

```ts
import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import KaleidoscopeAudioSection from './KaleidoscopeAudioSection.svelte';
import { kaleidoscope, setLiveTile } from '$lib/state/kaleidoscope.svelte';
import { animationState, setLayerEnabled } from '$lib/state/animation';
import { switchLocale } from '$lib/state/locale.svelte';

describe('KaleidoscopeAudioSection', () => {
	beforeEach(() => {
		switchLocale('en');
		setLayerEnabled('kaleidoscope', true);
		setLiveTile(false);
	});

	it('toggles the kaleidoscope layer gate', async () => {
		render(KaleidoscopeAudioSection);
		await userEvent.click(page.getByTestId('layer-toggle-kaleidoscope'));
		expect(animationState.layers.kaleidoscope).toBe(false);
	});

	it('toggles the live tile', async () => {
		render(KaleidoscopeAudioSection);
		await userEvent.click(page.getByLabelText('Live tile'));
		expect(kaleidoscope.liveTile).toBe(true);
	});

	it('shows no static look controls', async () => {
		render(KaleidoscopeAudioSection);
		expect(page.getByLabelText('Sectors', { exact: true }).query()).toBeNull();
		expect(page.getByLabelText('Circular mask').query()).toBeNull();
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test:unit -- --run src/lib/components/KaleidoscopeAudioSection.svelte.spec.ts`
Expected: FAIL — cannot resolve `./KaleidoscopeAudioSection.svelte`.

- [ ] **Step 3: Write the component**

Create `src/lib/components/KaleidoscopeAudioSection.svelte`:

```svelte
<script lang="ts">
	import SidebarCollapsible from './SidebarCollapsible.svelte';
	import { kaleidoscope, setLiveTile } from '$lib/state/kaleidoscope.svelte';
	import { animationState, setLayerEnabled } from '$lib/state/animation';
	import { m } from '$lib/paraglide/messages';

	const checked = (e: Event) => (e.target as HTMLInputElement).checked;
</script>

<SidebarCollapsible>
	{#snippet trigger()}
		{m.animate_kaleidoscope_audio()}
	{/snippet}

	{#snippet content()}
		<div class="flex flex-col gap-3">
			<label class="flex items-center gap-2 text-xs">
				<input
					type="checkbox"
					data-testid="layer-toggle-kaleidoscope"
					aria-label={m.animate_kaleidoscope_layer_toggle()}
					checked={animationState.layers.kaleidoscope}
					onchange={(e) => setLayerEnabled('kaleidoscope', checked(e))}
				/>
				{m.animate_kaleidoscope_layer_toggle()}
			</label>

			<label class="flex items-center gap-2 text-xs">
				<input
					type="checkbox"
					aria-label={m.editor_kaleido_live_tile()}
					checked={kaleidoscope.liveTile}
					onchange={(e) => setLiveTile(checked(e))}
				/>
				{m.editor_kaleido_live_tile_audio()}
			</label>
		</div>
	{/snippet}
</SidebarCollapsible>
```

- [ ] **Step 4: Run the autofixer**

Use Svelte MCP `svelte-autofixer` on `src/lib/components/KaleidoscopeAudioSection.svelte`. Re-run until no issues; apply any fixes.

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun run test:unit -- --run src/lib/components/KaleidoscopeAudioSection.svelte.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/KaleidoscopeAudioSection.svelte src/lib/components/KaleidoscopeAudioSection.svelte.spec.ts
git commit -m "feat(animate): slim Kaleidoscope audio section"
```

---

### Task 5: Wire the switch + panel into the Composition page

**Files:**
- Modify: `src/routes/(app)/composition/+page.svelte`
- Test: `src/routes/(app)/composition/page.svelte.spec.ts`

**Interfaces:**
- Consumes: `LayoutModeSwitch`, `KaleidoscopePanel` (Tasks 2–3); `kaleidoscope` from `$lib/state/kaleidoscope.svelte`.
- Produces: Composition page renders `CanvasSection` + `LayoutModeSwitch`; `KaleidoscopePanel` renders only when `kaleidoscope.enabled`.

- [ ] **Step 1: Extend the failing test**

Add to `src/routes/(app)/composition/page.svelte.spec.ts` (inside the `describe('Composition page', …)` block). Also add `setKaleidoscopeEnabled` to the imports from `$lib/state/kaleidoscope.svelte` at the top:

```ts
	it('renders the layout switch and gates the kaleidoscope panel on mode', async () => {
		setKaleidoscopeEnabled(false);
		render(CompositionPage);

		await expect.element(page.getByRole('button', { name: 'Poster' })).toBeInTheDocument();
		expect(page.getByLabelText('Sectors', { exact: true }).query()).toBeNull();

		await userEvent.click(page.getByRole('button', { name: 'Kaleidoscope' }));
		await expect.element(page.getByLabelText('Sectors', { exact: true })).toBeInTheDocument();
	});
```

Add `userEvent` to the existing `vitest/browser` import and add the state import:

```ts
import { page, userEvent } from 'vitest/browser';
import { setKaleidoscopeEnabled } from '$lib/state/kaleidoscope.svelte';
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test:unit -- --run "src/routes/(app)/composition/page.svelte.spec.ts"`
Expected: FAIL — Poster button not found (page not yet wired).

- [ ] **Step 3: Wire the page**

Replace `src/routes/(app)/composition/+page.svelte` with:

```svelte
<script lang="ts">
	import CanvasSection from '$lib/components/CanvasSection.svelte';
	import LayoutModeSwitch from '$lib/components/LayoutModeSwitch.svelte';
	import KaleidoscopePanel from '$lib/components/KaleidoscopePanel.svelte';
	import { kaleidoscope } from '$lib/state/kaleidoscope.svelte';
	import { m } from '$lib/paraglide/messages';
</script>

<svelte:head><title>{m.composition_page_title()}</title></svelte:head>

<CanvasSection />

<LayoutModeSwitch />

{#if kaleidoscope.enabled}
	<KaleidoscopePanel />
{/if}
```

- [ ] **Step 4: Run the autofixer**

Use Svelte MCP `svelte-autofixer` on `src/routes/(app)/composition/+page.svelte`. Re-run until no issues; apply any fixes.

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun run test:unit -- --run "src/routes/(app)/composition/page.svelte.spec.ts"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "src/routes/(app)/composition/+page.svelte" "src/routes/(app)/composition/page.svelte.spec.ts"
git commit -m "feat(composition): mount layout switch + static Kaleidoscope panel"
```

---

### Task 6: Swap the Kaleidoscope section in the Animate page

**Files:**
- Modify: `src/routes/(app)/animate/+page.svelte`
- Test: `src/routes/(app)/animate/page.svelte.spec.ts`

**Interfaces:**
- Consumes: `KaleidoscopeAudioSection` (Task 4).
- Produces: Animate page renders `KaleidoscopeAudioSection` in place of the old `KaleidoscopeSection`; the audio layer toggle stays present, the static sliders are gone.

- [ ] **Step 1: Update the failing test**

In `src/routes/(app)/animate/page.svelte.spec.ts`, replace the second test (`shows the kaleidoscope section with stopwatches (animatable)`) with:

```ts
	it('shows the kaleidoscope audio section but no static sliders', async () => {
		render(AnimatePage);
		await expect
			.element(page.getByTestId('layer-toggle-kaleidoscope'))
			.toBeInTheDocument();
		expect(page.getByLabelText('Animate Global rotation').query()).toBeNull();
		expect(page.getByLabelText('Sectors', { exact: true }).query()).toBeNull();
	});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test:unit -- --run "src/routes/(app)/animate/page.svelte.spec.ts"`
Expected: FAIL — the static slider `Animate Global rotation` is still present (old section rendered).

- [ ] **Step 3: Swap the section**

In `src/routes/(app)/animate/+page.svelte`, change the import and the markup:

Replace the import line
```svelte
	import KaleidoscopeSection from '$lib/components/KaleidoscopeSection.svelte';
```
with
```svelte
	import KaleidoscopeAudioSection from '$lib/components/KaleidoscopeAudioSection.svelte';
```

Replace the markup line
```svelte
<KaleidoscopeSection />
```
with
```svelte
<KaleidoscopeAudioSection />
```

- [ ] **Step 4: Run the autofixer**

Use Svelte MCP `svelte-autofixer` on `src/routes/(app)/animate/+page.svelte`. Re-run until no issues; apply any fixes.

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun run test:unit -- --run "src/routes/(app)/animate/page.svelte.spec.ts"`
Expected: PASS (both tests).

- [ ] **Step 6: Commit**

```bash
git add "src/routes/(app)/animate/+page.svelte" "src/routes/(app)/animate/page.svelte.spec.ts"
git commit -m "feat(animate): use slim Kaleidoscope audio section"
```

---

### Task 7: Remove the Kaleidoscope panel from the Editor page

**Files:**
- Modify: `src/routes/(app)/editor/+page.svelte`
- Test: `src/routes/(app)/editor/page.svelte.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: Editor page no longer imports or renders `KaleidoscopeSection`; Editor keeps Settings, Rings, Colors.

- [ ] **Step 1: Add the failing test**

The spec already imports `EditorPage` from `./+page.svelte` and `page` from `vitest/browser`. Add this test inside the top-level `describe('Editor page', …)` block:

```ts
	it('no longer shows the kaleidoscope panel', async () => {
		render(EditorPage);
		expect(page.getByText('Kaleidoscope', { exact: true }).query()).toBeNull();
		expect(page.getByLabelText('Sectors', { exact: true }).query()).toBeNull();
	});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test:unit -- --run "src/routes/(app)/editor/page.svelte.spec.ts"`
Expected: FAIL — `Kaleidoscope` text still present (section still rendered).

- [ ] **Step 3: Remove the section**

In `src/routes/(app)/editor/+page.svelte`:

Delete the import line
```svelte
	import KaleidoscopeSection from '$lib/components/KaleidoscopeSection.svelte';
```

Delete the markup line
```svelte
<KaleidoscopeSection animatable={false} />
```

- [ ] **Step 4: Run the autofixer**

Use Svelte MCP `svelte-autofixer` on `src/routes/(app)/editor/+page.svelte`. Re-run until no issues; apply any fixes.

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun run test:unit -- --run "src/routes/(app)/editor/page.svelte.spec.ts"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "src/routes/(app)/editor/+page.svelte" "src/routes/(app)/editor/page.svelte.spec.ts"
git commit -m "feat(editor): drop the Kaleidoscope panel"
```

---

### Task 8: Delete the old `KaleidoscopeSection` and run the full check

**Files:**
- Delete: `src/lib/components/KaleidoscopeSection.svelte`
- Delete: `src/lib/components/KaleidoscopeSection.svelte.spec.ts`

**Interfaces:**
- Consumes: nothing — this task only removes the now-orphaned component after Tasks 5–7 dropped every reference.
- Produces: no `KaleidoscopeSection` in the tree.

- [ ] **Step 1: Confirm there are no remaining references**

Run: `grep -rn "KaleidoscopeSection" src`
Expected: **no output** (all references removed in Tasks 5–7). If anything prints, fix that reference before deleting.

- [ ] **Step 2: Delete the files**

```bash
git rm src/lib/components/KaleidoscopeSection.svelte src/lib/components/KaleidoscopeSection.svelte.spec.ts
```

- [ ] **Step 3: Typecheck**

Run: `bun run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Full unit suite**

Run: `bun run test:unit -- --run`
Expected: all green. (Note: `KaleidoscopeSection.svelte.spec` under full parallel run has historically shown a flaky "Failed to import" that is unrelated and now removed anyway — the new specs run isolated cleanly.)

- [ ] **Step 5: Nav e2e sanity**

Run: `bunx playwright test workspace-nav`
Expected: green (nav untouched, cheap confirmation).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove the superseded KaleidoscopeSection"
```

---

## Final handoff

After Task 8, run `git status` and list every touched file, then **stop** — the user handles the final commit / PR. Do not push or open a PR.

Expected touched set:
- `messages/en.json`, `messages/it.json`
- `src/lib/components/KaleidoscopePanel.svelte` (+ spec)
- `src/lib/components/LayoutModeSwitch.svelte` (+ spec)
- `src/lib/components/KaleidoscopeAudioSection.svelte` (+ spec)
- `src/routes/(app)/composition/+page.svelte` (+ spec)
- `src/routes/(app)/animate/+page.svelte` (+ spec)
- `src/routes/(app)/editor/+page.svelte` (+ spec)
- deleted: `src/lib/components/KaleidoscopeSection.svelte` (+ spec)
