# Timeline UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the kaleidoscope timeline (aesthetics + usability) in a clean/minimal direction — conditional visibility, fixed header interaction, time-aware ruler, continuous playhead, decluttered contextual controls, clearer keyframe selection.

**Architecture:** The timeline lives at the bottom of `src/routes/+page.svelte`. `TimelinePanel.svelte` orchestrates `TimelineRuler.svelte` + `TimelineTrack.svelte` (or the `KeyframeGraphEditor.svelte`). This plan lifts keyframe **selection** up to the panel, moves interpolation/delete controls into a single contextual bar, gates the whole panel behind `kaleidoscope.enabled`, and turns the playhead into a single overlay spanning ruler + lanes.

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, TailwindCSS, shadcn/svelte (`Button`), vitest (vitest-browser-svelte for `.svelte.spec.ts` chromium project; node for pure `.spec.ts`), bun.

## Global Constraints

- Package manager **bun**. Run a single browser spec: `bun run test:unit -- run <path>`. Run full suite (REQUIRED before each commit): `bun run test:unit -- run`. Type check: `bun run check`.
- Tab indentation in `.svelte` and `.ts`.
- Every `.svelte` file edited MUST pass the `svelte-autofixer` MCP with `issues: []`. Known false-positive class to ignore: "function called/declared inside `$effect`" on canvas/rAF/ensure-track effects.
- Shared `keyframes` singleton across the chromium browser-test project: any spec that arms a track (`setTrackEnabled(..., true)`) MUST disarm it in `afterEach`, or wipe `keyframes.tracks` in `beforeEach`, otherwise it pollutes `keyframes.svelte.spec.ts` (`hasEnabledTracks`).
- Query by label/role with `{ exact: true }` where substring collisions are possible.
- Headless canvas screenshots are NOT trustworthy; the timeline is DOM, so DOM assertions are fine, but defer the final aesthetic sign-off to the designer's live check.
- Time model: `animationState.progress` is normalized `0..1`; `animationState.durationSec` (default `3`) maps it to seconds. `timeline-geometry.ts` does normalized `time ↔ x`.
- Existing exports relied on by specs: `keyframes` API + `KALEIDO_GLOBAL_ROTATION` from `$lib/state/keyframes.svelte`; `animationState`, `applyKaleidoscopeKeyframes` from `$lib/state/animation`; `kaleidoscope`, `setGlobalRotation` from `$lib/state/kaleidoscope.svelte`.

---

### Task 1: Gate the panel behind kaleidoscope mode (Spec A)

**Files:**
- Modify: `src/lib/components/TimelinePanel.svelte`
- Test: `src/lib/components/TimelinePanel.svelte.spec.ts`

**Interfaces:**
- Consumes: `kaleidoscope` from `$lib/state/kaleidoscope.svelte` (`{ enabled: boolean }`); `setKaleidoscopeEnabled(v: boolean)`.
- Produces: `TimelinePanel` renders its `<section data-testid="timeline-panel">` only when `kaleidoscope.enabled === true`.

- [ ] **Step 1: Write the failing tests**

Add to `TimelinePanel.svelte.spec.ts`. Import `kaleidoscope` and reset it in `beforeEach`:

```ts
import { kaleidoscope } from '$lib/state/kaleidoscope.svelte';
// inside the existing describe's beforeEach, after clearing tracks:
kaleidoscope.enabled = true;
```

New tests:

```ts
it('renders nothing when kaleidoscope mode is off', async () => {
	kaleidoscope.enabled = false;
	render(TimelinePanel);
	expect(page.getByTestId('timeline-panel').query()).toBeNull();
});

it('renders the panel when kaleidoscope mode is on', async () => {
	kaleidoscope.enabled = true;
	render(TimelinePanel);
	await expect.element(page.getByTestId('timeline-panel')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests to verify the off-mode one fails**

Run: `bun run test:unit -- run src/lib/components/TimelinePanel.svelte.spec.ts`
Expected: "renders nothing when kaleidoscope mode is off" FAILS (panel currently always renders).

- [ ] **Step 3: Gate the panel**

In `TimelinePanel.svelte`, add the import and wrap the whole `<section>` in an `{#if}`:

```svelte
<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { keyframes } from '$lib/state/keyframes.svelte';
	import { kaleidoscope } from '$lib/state/kaleidoscope.svelte';
	import { KALEIDO_PARAMS } from '$lib/state/kaleidoscope-params';
	// ...existing imports unchanged
```

Wrap the markup:

```svelte
{#if kaleidoscope.enabled}
	<section data-testid="timeline-panel" class="w-full border-t bg-background">
		<!-- ...existing contents unchanged... -->
	</section>
{/if}
```

- [ ] **Step 4: Verify autofixer**

Run the `svelte-autofixer` MCP on `TimelinePanel.svelte`. Expected: `issues: []`.

- [ ] **Step 5: Run the full suite**

Run: `bun run test:unit -- run`
Expected: all passing. Then `bun run check` → 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/TimelinePanel.svelte src/lib/components/TimelinePanel.svelte.spec.ts
git commit -m "feat: timeline panel only renders when kaleidoscope mode is on"
```

---

### Task 2: Header — disclosure arrow + view tabs (Spec B, fixes the close-bug)

**Files:**
- Modify: `src/lib/components/TimelinePanel.svelte`
- Test: `src/lib/components/TimelinePanel.svelte.spec.ts`

**Interfaces:**
- Consumes: existing `armedParams` derived; `Button`.
- Produces: panel state `open: boolean` (toggled ONLY by the chevron) and `view: 'tracks' | 'graph'` (toggled by the two tab buttons; never closes the panel). Replaces the old `graphMode: boolean`.

- [ ] **Step 1: Write the failing tests**

Replace the old `'toggles the graph editor mode'` test and add the bug-fix test. New tests (keep `kaleidoscope.enabled = true` from Task 1's beforeEach):

```ts
it('chevron toggles the panel open and closed', async () => {
	render(TimelinePanel);
	expect(page.getByTestId('timeline-body').query()).toBeNull();
	await userEvent.click(page.getByRole('button', { name: 'Mostra/nascondi timeline' }));
	await expect.element(page.getByTestId('timeline-body')).toBeInTheDocument();
	await userEvent.click(page.getByRole('button', { name: 'Mostra/nascondi timeline' }));
	expect(page.getByTestId('timeline-body').query()).toBeNull();
});

it('switches to graph view then back to tracks WITHOUT closing the panel', async () => {
	keyframes.ensureTrack('kaleidoscope.scale');
	keyframes.setTrackEnabled('kaleidoscope.scale', true);
	render(TimelinePanel);
	await userEvent.click(page.getByRole('button', { name: 'Mostra/nascondi timeline' }));
	await userEvent.click(page.getByRole('button', { name: 'Graph Editor' }));
	await expect.element(page.getByTestId('timeline-graph')).toBeInTheDocument();
	// The bug: pressing Timeline used to close the panel. It must return to tracks instead.
	await userEvent.click(page.getByRole('button', { name: 'Timeline', exact: true }));
	await expect.element(page.getByTestId('timeline-tracks')).toBeInTheDocument();
	await expect.element(page.getByTestId('timeline-body')).toBeInTheDocument();
});
```

Also update the existing `'starts collapsed and expands on toggle'`, `'shows the empty-state hint'`, and `'renders a track row'` tests: their `userEvent.click(page.getByRole('button', { name: 'Timeline' }))` that OPENS the panel must now click the chevron `{ name: 'Mostra/nascondi timeline' }` instead. Delete the old `'toggles the graph editor mode (with a param armed)'` test (replaced above).

Remember the cleanup: this spec's `beforeEach` already wipes `keyframes.tracks`; that satisfies the singleton-cleanup constraint.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test:unit -- run src/lib/components/TimelinePanel.svelte.spec.ts`
Expected: new tests FAIL (no chevron button / view tabs yet).

- [ ] **Step 3: Rewrite the header + body switching**

In `TimelinePanel.svelte` script, replace the flags:

```ts
let open = $state(false);
let view = $state<'tracks' | 'graph'>('tracks');
let graphParamId = $state<string | null>(null);
```

Replace the header block:

```svelte
<div class="flex items-center gap-2 p-2">
	<button
		type="button"
		aria-label="Mostra/nascondi timeline"
		class="flex items-center gap-1 text-sm font-medium text-foreground"
		onclick={() => (open = !open)}
	>
		<span class="inline-block transition-transform {open ? 'rotate-90' : ''}">▸</span>
		Timeline
	</button>
	{#if open}
		<div class="flex items-center gap-1">
			<Button
				variant={view === 'tracks' ? 'default' : 'ghost'}
				size="sm"
				onclick={() => (view = 'tracks')}
			>
				Timeline
			</Button>
			<Button
				variant={view === 'graph' ? 'default' : 'ghost'}
				size="sm"
				onclick={() => (view = 'graph')}
			>
				Graph Editor
			</Button>
		</div>
	{/if}
</div>
```

In the body, switch on `view` instead of `graphMode` (empty-state still wins when nothing is armed):

```svelte
{#if open}
	<div data-testid="timeline-body" class="flex flex-col gap-1 p-2">
		{#if armedParams.length === 0}
			<p data-testid="timeline-empty" class="p-2 text-xs text-muted-foreground">
				Arma un cronometro ⏱ nella sidebar per animare un parametro.
			</p>
		{:else if view === 'graph'}
			<!-- ...existing timeline-graph block unchanged... -->
		{:else}
			<!-- ...existing timeline-tracks block unchanged... -->
		{/if}
	</div>
{/if}
```

Note: there are now TWO accessible "Timeline" controls — the chevron (aria-label `Mostra/nascondi timeline`) and the tab button (text `Timeline`). Tests disambiguate via `exact: true` on the tab and the aria-label on the chevron.

- [ ] **Step 4: Verify autofixer**

Run `svelte-autofixer` MCP on `TimelinePanel.svelte` until `issues: []`.

- [ ] **Step 5: Run the full suite + check**

Run: `bun run test:unit -- run` → all passing. `bun run check` → 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/TimelinePanel.svelte src/lib/components/TimelinePanel.svelte.spec.ts
git commit -m "feat: timeline header chevron toggles panel, tabs switch view (fixes close-on-tab bug)"
```

---

### Task 3: Ruler ticks + time labels (Spec C)

**Files:**
- Modify: `src/lib/animation/timeline-geometry.ts`
- Modify: `src/lib/components/TimelineRuler.svelte`
- Test (node): `src/lib/animation/timeline-geometry.spec.ts`
- Test (browser): `src/lib/components/TimelineRuler.svelte.spec.ts`

**Interfaces:**
- Produces: `formatSeconds(sec: number): string` in `timeline-geometry.ts` — rounds to one decimal, trims trailing `.0`, appends `s` (e.g. `3 → "3s"`, `1.5 → "1.5s"`, `0 → "0s"`).
- Consumes: `animationState.durationSec` for label values; `xFromTime` for positions.

- [ ] **Step 1: Write the failing node test**

Add to `src/lib/animation/timeline-geometry.spec.ts`:

```ts
import { formatSeconds } from './timeline-geometry';

describe('formatSeconds', () => {
	it('drops the decimal for whole seconds', () => {
		expect(formatSeconds(3)).toBe('3s');
		expect(formatSeconds(0)).toBe('0s');
	});
	it('keeps one decimal for fractional seconds', () => {
		expect(formatSeconds(1.5)).toBe('1.5s');
	});
	it('rounds to one decimal', () => {
		expect(formatSeconds(1.234)).toBe('1.2s');
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test:unit -- run src/lib/animation/timeline-geometry.spec.ts`
Expected: FAIL with `formatSeconds is not a function`.

- [ ] **Step 3: Implement `formatSeconds`**

Append to `src/lib/animation/timeline-geometry.ts`:

```ts
export function formatSeconds(sec: number): string {
	const r = Math.round(sec * 10) / 10;
	return (Number.isInteger(r) ? String(r) : r.toFixed(1)) + 's';
}
```

- [ ] **Step 4: Run the node test to verify it passes**

Run: `bun run test:unit -- run src/lib/animation/timeline-geometry.spec.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing browser test**

Add to `TimelineRuler.svelte.spec.ts` (the existing `beforeEach` already resets `progress` and the track; set a known duration too):

```ts
import { formatSeconds } from '$lib/animation/timeline-geometry';
// inside beforeEach: animationState.durationSec = 3;

it('renders start, middle and end time labels for the duration', async () => {
	animationState.durationSec = 4;
	render(TimelineRuler);
	await expect.element(page.getByText('0s', { exact: true })).toBeInTheDocument();
	await expect.element(page.getByText('2s', { exact: true })).toBeInTheDocument();
	await expect.element(page.getByText('4s', { exact: true })).toBeInTheDocument();
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `bun run test:unit -- run src/lib/components/TimelineRuler.svelte.spec.ts`
Expected: the new label test FAILS.

- [ ] **Step 7: Add ticks + labels to the ruler**

In `TimelineRuler.svelte`, import state + helper and render ticks/labels. The ruler keeps its scrub handlers and (for now) its own `playhead` — Task 4 removes the playhead from here. Add to the script:

```ts
import { animationState, applyKaleidoscopeKeyframes } from '$lib/state/animation';
import { timeFromX, xFromTime, formatSeconds } from '$lib/animation/timeline-geometry';

// Minor ticks at quarter fractions; labelled ticks at start/middle/end.
const TICK_FRACS = [0, 0.25, 0.5, 0.75, 1];
const LABEL_FRACS = [0, 0.5, 1];
```

Inside the ruler `<div>` (which is `relative`), add tick marks and labels positioned with `xFromTime`. Use `rulerEl?.clientWidth ?? 0` for the width like the playhead does:

```svelte
{#each TICK_FRACS as f (f)}
	<div
		class="pointer-events-none absolute top-0 h-2 w-px bg-border"
		style="left: {xFromTime(f, rulerEl?.clientWidth ?? 0)}px"
	></div>
{/each}
{#each LABEL_FRACS as f (f)}
	<span
		class="pointer-events-none absolute bottom-0 -translate-x-1/2 text-[10px] leading-none text-muted-foreground"
		style="left: {xFromTime(f, rulerEl?.clientWidth ?? 0)}px"
	>
		{formatSeconds(f * animationState.durationSec)}
	</span>
{/each}
```

Bump the ruler height to fit labels: change `h-6` to `h-7` on the ruler `<div>`. Keep `data-testid="timeline-ruler"`, the scrub handlers, and the existing playhead element unchanged in this task.

Note: the first/last labels sit at `left: 0` / `left: width` with `-translate-x-1/2`, so they slightly overflow the ends — acceptable for now; the minimal pass (Task 7) can inset them if the designer wants.

- [ ] **Step 8: Run both specs to verify they pass**

Run: `bun run test:unit -- run src/lib/components/TimelineRuler.svelte.spec.ts src/lib/animation/timeline-geometry.spec.ts`
Expected: PASS.

- [ ] **Step 9: Verify autofixer**

Run `svelte-autofixer` MCP on `TimelineRuler.svelte` until `issues: []`.

- [ ] **Step 10: Full suite + check + commit**

```bash
bun run test:unit -- run   # all passing
bun run check              # 0 errors
git add src/lib/animation/timeline-geometry.ts src/lib/animation/timeline-geometry.spec.ts src/lib/components/TimelineRuler.svelte src/lib/components/TimelineRuler.svelte.spec.ts
git commit -m "feat: timeline ruler shows tick marks and time labels"
```

---

### Task 4: Continuous playhead across ruler + lanes (Spec D)

**Files:**
- Modify: `src/lib/components/TimelineRuler.svelte` (remove its own playhead)
- Modify: `src/lib/components/TimelinePanel.svelte` (single overlay playhead over the lane area; gutter alignment)
- Test: `src/lib/components/TimelinePanel.svelte.spec.ts`
- Test: `src/lib/components/TimelineRuler.svelte.spec.ts` (drop the ruler-playhead assertion)

**Interfaces:**
- Consumes: `xFromTime`, `animationState.progress`. The lane column is a `relative flex-1` element measured at runtime (`offsetLeft` relative to the stage, `clientWidth` for lane width).
- Produces: one element `data-testid="playhead"` inside `TimelinePanel`'s tracks stage, positioned at `laneColEl.offsetLeft + xFromTime(progress, laneColEl.clientWidth)`, spanning the full stage height.

The track rows already use a `w-28` label gutter + `flex-1` lane. Give the ruler the same gutter so the ruler's scrub area lines up with the lanes, and position one overlay over the lane column.

- [ ] **Step 1: Write the failing panel test**

Add to `TimelinePanel.svelte.spec.ts`:

```ts
import { animationState } from '$lib/state/animation';
// in beforeEach: animationState.progress = 0;

it('renders a single continuous playhead positioned by progress', async () => {
	keyframes.ensureTrack('kaleidoscope.scale');
	keyframes.setTrackEnabled('kaleidoscope.scale', true);
	animationState.progress = 0.5;
	render(TimelinePanel);
	await userEvent.click(page.getByRole('button', { name: 'Mostra/nascondi timeline' }));
	const heads = page.getByTestId('playhead');
	await expect.element(heads).toBeInTheDocument();
	expect(heads.all()).toHaveLength(1); // exactly one playhead, not one-per-row
	const el = heads.element() as HTMLElement;
	expect(parseFloat(el.style.left)).toBeGreaterThan(0);
});
```

Add `afterEach` to this spec if not present, to satisfy the singleton constraint:

```ts
afterEach(() => {
	for (const id of Object.keys(keyframes.tracks)) keyframes.setTrackEnabled(id, false);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test:unit -- run src/lib/components/TimelinePanel.svelte.spec.ts`
Expected: FAIL — currently the only `playhead` is inside the ruler (and the panel doesn't expose its own), and there may be a length mismatch.

- [ ] **Step 3: Remove the playhead from the ruler**

In `TimelineRuler.svelte`, delete the playhead `<div data-testid="playhead">`. Keep ticks, labels, scrub handlers, `data-testid="timeline-ruler"`. The ruler no longer draws a playhead.

- [ ] **Step 4: Restructure the tracks view with a measured stage + overlay**

In `TimelinePanel.svelte`, replace the `timeline-tracks` block with a stage that gives the ruler a matching gutter and overlays a single playhead. Add to the script:

```ts
import { xFromTime } from '$lib/animation/timeline-geometry';
import { animationState } from '$lib/state/animation';

let stageEl = $state<HTMLDivElement>();
let laneColEl = $state<HTMLDivElement>();

const playheadLeft = $derived(
	(laneColEl?.offsetLeft ?? 0) + xFromTime(animationState.progress, laneColEl?.clientWidth ?? 0)
);
```

Markup:

```svelte
<div data-testid="timeline-tracks" bind:this={stageEl} class="relative flex flex-col gap-1">
	<div class="flex items-center gap-2">
		<span class="w-28 shrink-0"></span>
		<div bind:this={laneColEl} class="flex-1">
			<TimelineRuler />
		</div>
	</div>
	{#each armedParams as p (p.id)}
		<TimelineTrack paramId={p.id} label={p.label} />
	{/each}
	<div
		data-testid="playhead"
		class="pointer-events-none absolute top-0 bottom-0 w-px bg-primary"
		style="left: {playheadLeft}px"
	></div>
</div>
```

Each `TimelineTrack` keeps its `w-28` label + `flex-1` lane, so its lane aligns with `laneColEl`. `offsetLeft` is measured against the `relative` stage, so the overlay needs no hardcoded gutter width.

- [ ] **Step 5: Drop the ruler-playhead assertion**

In `TimelineRuler.svelte.spec.ts`, delete the `'positions the playhead proportionally to progress'` test (the playhead is now panel-level and covered by the panel spec). Keep the two scrub tests.

- [ ] **Step 6: Run both specs to verify they pass**

Run: `bun run test:unit -- run src/lib/components/TimelinePanel.svelte.spec.ts src/lib/components/TimelineRuler.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 7: Verify autofixer**

Run `svelte-autofixer` MCP on both `TimelinePanel.svelte` and `TimelineRuler.svelte` until `issues: []`. (Ignore only the known "function inside $effect" false positives — none expected here.)

- [ ] **Step 8: Full suite + check + commit**

```bash
bun run test:unit -- run   # all passing
bun run check              # 0 errors
git add src/lib/components/TimelinePanel.svelte src/lib/components/TimelineRuler.svelte src/lib/components/TimelinePanel.svelte.spec.ts src/lib/components/TimelineRuler.svelte.spec.ts
git commit -m "feat: single continuous timeline playhead across ruler and lanes"
```

---

### Task 5: Lift selection + contextual controls bar (Spec E)

**Files:**
- Modify: `src/lib/components/TimelineTrack.svelte` (selection becomes prop-driven; remove interp select + delete button; `+ Keyframe` becomes a compact icon)
- Modify: `src/lib/components/TimelinePanel.svelte` (owns selection; renders the contextual bar)
- Test: `src/lib/components/TimelineTrack.svelte.spec.ts` (drop the interp/delete tests here)
- Test: `src/lib/components/TimelinePanel.svelte.spec.ts` (add interp/delete-via-contextual-bar tests)

**Interfaces:**
- `TimelineTrack` new props:
  ```ts
  let {
  	paramId,
  	label,
  	selectedId = null,
  	onselect
  }: {
  	paramId: string;
  	label: string;
  	selectedId?: string | null;
  	onselect?: (keyframeId: string | null) => void;
  } = $props();
  ```
  The track calls `onselect(id)` when a diamond is clicked or a keyframe is added (select-on-add), and renders a diamond as selected when `selectedId === kf.id`. It NO LONGER renders the interpolation `<select>` or the `Elimina keyframe` button.
- `TimelinePanel` owns:
  ```ts
  let selection = $state<{ paramId: string; keyframeId: string } | null>(null);
  ```
  and renders the contextual bar (interp `<select>` aria-label `Interpolazione keyframe` + `Elimina keyframe` button) when `selection` resolves to an existing keyframe.

- [ ] **Step 1: Write the failing panel tests**

Add to `TimelinePanel.svelte.spec.ts`:

```ts
import { animationState } from '$lib/state/animation';

it('shows no contextual bar until a keyframe is selected', async () => {
	keyframes.ensureTrack('kaleidoscope.scale');
	keyframes.setTrackEnabled('kaleidoscope.scale', true);
	render(TimelinePanel);
	await userEvent.click(page.getByRole('button', { name: 'Mostra/nascondi timeline' }));
	expect(page.getByLabelText('Interpolazione keyframe').query()).toBeNull();
});

it('selecting a keyframe reveals the contextual bar and edits interp', async () => {
	keyframes.ensureTrack('kaleidoscope.scale');
	keyframes.setTrackEnabled('kaleidoscope.scale', true);
	const id = keyframes.addKeyframe('kaleidoscope.scale', { time: 0.5, value: 1 });
	render(TimelinePanel);
	await userEvent.click(page.getByRole('button', { name: 'Mostra/nascondi timeline' }));
	await userEvent.click(page.getByTestId(`kf-${id}`));
	await userEvent.selectOptions(page.getByLabelText('Interpolazione keyframe'), 'hold');
	expect(keyframes.tracks['kaleidoscope.scale'].keyframes[0].interp).toBe('hold');
});

it('deletes the selected keyframe from the contextual bar', async () => {
	keyframes.ensureTrack('kaleidoscope.scale');
	keyframes.setTrackEnabled('kaleidoscope.scale', true);
	const id = keyframes.addKeyframe('kaleidoscope.scale', { time: 0.5, value: 1 });
	render(TimelinePanel);
	await userEvent.click(page.getByRole('button', { name: 'Mostra/nascondi timeline' }));
	await userEvent.click(page.getByTestId(`kf-${id}`));
	await userEvent.click(page.getByRole('button', { name: 'Elimina keyframe' }));
	expect(keyframes.tracks['kaleidoscope.scale'].keyframes).toHaveLength(0);
	expect(page.getByLabelText('Interpolazione keyframe').query()).toBeNull();
});
```

(The Task-4 `afterEach` disarm already covers cleanup.)

- [ ] **Step 2: Run them to verify they fail**

Run: `bun run test:unit -- run src/lib/components/TimelinePanel.svelte.spec.ts`
Expected: the three new tests FAIL (no contextual bar in the panel yet).

- [ ] **Step 3: Make `TimelineTrack` selection-driven and strip its controls**

Rewrite `TimelineTrack.svelte`:

```svelte
<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { keyframes } from '$lib/state/keyframes.svelte';
	import { animationState, applyKaleidoscopeKeyframes } from '$lib/state/animation';
	import { timeFromX, xFromTime } from '$lib/animation/timeline-geometry';

	let {
		paramId,
		label,
		selectedId = null,
		onselect
	}: {
		paramId: string;
		label: string;
		selectedId?: string | null;
		onselect?: (keyframeId: string | null) => void;
	} = $props();

	function reapplyIfPaused() {
		if (!animationState.isPlaying) applyKaleidoscopeKeyframes(animationState.progress);
	}

	let rowEl = $state<HTMLDivElement>();
	let draggingId: string | null = null;

	const kfs = $derived(keyframes.tracks[paramId]?.keyframes ?? []);

	function rowWidth(): number {
		return rowEl?.clientWidth ?? 0;
	}

	function onDblClick(e: MouseEvent) {
		if (!rowEl) return;
		const rect = rowEl.getBoundingClientRect();
		const time = timeFromX(e.clientX - rect.left, rect.width);
		const id = keyframes.addKeyframe(paramId, { time, value: 0 });
		onselect?.(id);
		reapplyIfPaused();
	}

	function addAtPlayhead() {
		const id = keyframes.addKeyframe(paramId, { time: animationState.progress, value: 0 });
		onselect?.(id);
		reapplyIfPaused();
	}

	function onDiamondDown(e: PointerEvent, id: string) {
		e.stopPropagation();
		onselect?.(id);
		draggingId = id;
		try {
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		} catch {
			// No active pointer (e.g. a synthetic event) — capture is best-effort.
		}
	}

	function onDiamondMove(e: PointerEvent) {
		if (!draggingId || !rowEl) return;
		const rect = rowEl.getBoundingClientRect();
		keyframes.moveKeyframe(paramId, draggingId, {
			time: timeFromX(e.clientX - rect.left, rect.width)
		});
		reapplyIfPaused();
	}

	function onDiamondUp(e: PointerEvent) {
		draggingId = null;
		const el = e.currentTarget as HTMLElement;
		if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
	}
</script>

<div class="flex items-center gap-2">
	<span class="w-28 shrink-0 truncate text-xs">{label}</span>
	<Button variant="outline" size="sm" aria-label="Aggiungi keyframe" onclick={addAtPlayhead}>
		+
	</Button>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={rowEl}
		data-testid="track-{paramId}"
		class="relative h-7 flex-1 rounded bg-muted/60"
		ondblclick={onDblClick}
	>
		{#each kfs as kf (kf.id)}
			<button
				type="button"
				data-testid="kf-{kf.id}"
				aria-label="Keyframe"
				class="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border {kf.id ===
				selectedId
					? 'bg-primary'
					: 'bg-foreground'}"
				style="left: {xFromTime(kf.time, rowWidth())}px"
				onpointerdown={(e) => onDiamondDown(e, kf.id)}
				onpointermove={onDiamondMove}
				onpointerup={onDiamondUp}
			></button>
		{/each}
	</div>
</div>
```

(The blue-ring + time label come in Task 6 — keep the current selected style here.)

- [ ] **Step 4: Add selection + contextual bar to `TimelinePanel`**

In `TimelinePanel.svelte` script, add selection state and helpers:

```ts
import { animationState, applyKaleidoscopeKeyframes } from '$lib/state/animation';
import type { Interp } from '$lib/animation/keyframes';

let selection = $state<{ paramId: string; keyframeId: string } | null>(null);

const selectedKf = $derived(
	selection
		? (keyframes.tracks[selection.paramId]?.keyframes.find((k) => k.id === selection!.keyframeId) ??
			null)
		: null
);

function reapplyIfPaused() {
	if (!animationState.isPlaying) applyKaleidoscopeKeyframes(animationState.progress);
}

function selectKeyframe(paramId: string, keyframeId: string | null) {
	selection = keyframeId ? { paramId, keyframeId } : null;
}

function setSelectedInterp(value: string) {
	if (!selection) return;
	keyframes.setKeyframeInterp(selection.paramId, selection.keyframeId, value as Interp);
	reapplyIfPaused();
}

function deleteSelected() {
	if (!selection) return;
	keyframes.deleteKeyframe(selection.paramId, selection.keyframeId);
	selection = null;
	reapplyIfPaused();
}
```

Pass selection into each track in the `timeline-tracks` `#each`:

```svelte
{#each armedParams as p (p.id)}
	<TimelineTrack
		paramId={p.id}
		label={p.label}
		selectedId={selection?.paramId === p.id ? selection.keyframeId : null}
		onselect={(id) => selectKeyframe(p.id, id)}
	/>
{/each}
```

Render the contextual bar at the end of the `timeline-tracks` stage (after the playhead overlay), only when a keyframe is selected:

```svelte
{#if selectedKf}
	<div data-testid="timeline-inspector" class="flex items-center gap-2 pt-1">
		<select
			aria-label="Interpolazione keyframe"
			class="h-7 rounded border bg-background text-xs"
			value={selectedKf.interp}
			onchange={(e) => setSelectedInterp((e.target as HTMLSelectElement).value)}
		>
			<option value="linear">Lineare</option>
			<option value="bezier">Bezier</option>
			<option value="hold">Hold</option>
		</select>
		<Button variant="ghost" size="sm" onclick={deleteSelected}>Elimina keyframe</Button>
	</div>
{/if}
```

- [ ] **Step 5: Update the `TimelineTrack` spec**

In `TimelineTrack.svelte.spec.ts`:
- Delete `'selects a diamond then deletes it'` and `'sets interpolation of the selected keyframe'` (moved to the panel spec).
- Delete `'enables the interpolation dropdown after adding via the button'` (the dropdown no longer lives in the track).
- Update the `'+ Keyframe'` button test to the new accessible name: `page.getByRole('button', { name: 'Aggiungi keyframe' })` instead of `'+ Keyframe'`.
- Add a selection-callback test:

```ts
it('calls onselect with the keyframe id when a diamond is clicked', async () => {
	const id = keyframes.addKeyframe(ROT, { time: 0.5, value: 10 });
	let picked: string | null = null;
	render(TimelineTrack, {
		paramId: ROT,
		label: 'Rotazione',
		onselect: (kid: string | null) => (picked = kid)
	});
	await userEvent.click(page.getByTestId(`kf-${id}`));
	expect(picked).toBe(id);
});
```

Keep `'renders a diamond per keyframe'`, the dblclick-add test, the `'+ Keyframe'` (now `Aggiungi keyframe`) add-at-playhead test, and the paused-preview refresh test (it dblclicks the row — unaffected).

- [ ] **Step 6: Run both specs to verify they pass**

Run: `bun run test:unit -- run src/lib/components/TimelineTrack.svelte.spec.ts src/lib/components/TimelinePanel.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 7: Verify autofixer**

Run `svelte-autofixer` MCP on `TimelineTrack.svelte` and `TimelinePanel.svelte` until `issues: []`.

- [ ] **Step 8: Full suite + check + commit**

```bash
bun run test:unit -- run   # all passing
bun run check              # 0 errors
git add src/lib/components/TimelineTrack.svelte src/lib/components/TimelinePanel.svelte src/lib/components/TimelineTrack.svelte.spec.ts src/lib/components/TimelinePanel.svelte.spec.ts
git commit -m "feat: lift keyframe selection to timeline panel with a single contextual bar"
```

---

### Task 6: Clearer keyframe selection — blue ring + time/guide (Spec F)

**Files:**
- Modify: `src/lib/components/TimelineTrack.svelte`
- Test: `src/lib/components/TimelineTrack.svelte.spec.ts`

**Interfaces:**
- Consumes: `selectedId` prop (Task 5); `animationState.durationSec`; `formatSeconds`, `xFromTime`.
- Produces: selected diamond carries `ring-2` + `ring-sky-400`; a guide line + time label (`data-testid="kf-time"` text like `1.5s`) renders for the selected keyframe.

- [ ] **Step 1: Write the failing tests**

Add to `TimelineTrack.svelte.spec.ts`:

```ts
import { animationState } from '$lib/state/animation';

it('marks the selected diamond with a blue ring', async () => {
	const id = keyframes.addKeyframe(ROT, { time: 0.5, value: 10 });
	render(TimelineTrack, { paramId: ROT, label: 'Rotazione', selectedId: id });
	const diamond = page.getByTestId(`kf-${id}`).element() as HTMLElement;
	expect(diamond.className).toContain('ring-sky-400');
});

it('shows the selected keyframe time in seconds', async () => {
	animationState.durationSec = 4;
	const id = keyframes.addKeyframe(ROT, { time: 0.5, value: 10 }); // 0.5 * 4 = 2s
	render(TimelineTrack, { paramId: ROT, label: 'Rotazione', selectedId: id });
	await expect.element(page.getByTestId('kf-time')).toHaveTextContent('2s');
});
```

Reset `animationState.durationSec` in the spec's `reset()` (set it back to `3`) so the new value doesn't leak into other tests.

- [ ] **Step 2: Run them to verify they fail**

Run: `bun run test:unit -- run src/lib/components/TimelineTrack.svelte.spec.ts`
Expected: both new tests FAIL.

- [ ] **Step 3: Add the ring + guide + time label**

In `TimelineTrack.svelte`, import the formatter and `animationState` (already imported). Update the diamond class to add the blue ring when selected, and render a guide line + time label for the selected keyframe inside the lane.

Update the import line:

```ts
import { timeFromX, xFromTime, formatSeconds } from '$lib/animation/timeline-geometry';
```

Add a derived for the selected keyframe in this track:

```ts
const selectedKf = $derived(kfs.find((k) => k.id === selectedId) ?? null);
```

Change the diamond class so the selected state uses a blue ring (keep the fill so it stays visible):

```svelte
class="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border bg-foreground {kf.id ===
selectedId
	? 'ring-2 ring-sky-400'
	: ''}"
```

Inside the lane `<div>` (after the `{#each}`), add the guide line + time label for the selected keyframe:

```svelte
{#if selectedKf}
	<div
		class="pointer-events-none absolute top-0 bottom-0 w-px bg-sky-400/60"
		style="left: {xFromTime(selectedKf.time, rowWidth())}px"
	></div>
	<span
		data-testid="kf-time"
		class="pointer-events-none absolute -top-4 -translate-x-1/2 rounded bg-sky-400 px-1 text-[10px] leading-tight text-white"
		style="left: {xFromTime(selectedKf.time, rowWidth())}px"
	>
		{formatSeconds(selectedKf.time * animationState.durationSec)}
	</span>
{/if}
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `bun run test:unit -- run src/lib/components/TimelineTrack.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 5: Verify autofixer**

Run `svelte-autofixer` MCP on `TimelineTrack.svelte` until `issues: []`.

- [ ] **Step 6: Full suite + check + commit**

```bash
bun run test:unit -- run   # all passing
bun run check              # 0 errors
git add src/lib/components/TimelineTrack.svelte src/lib/components/TimelineTrack.svelte.spec.ts
git commit -m "feat: selected keyframe gets a blue ring, guide line and time label"
```

---

### Task 7: Minimal spacing/color pass + live designer check (Spec G)

**Files:**
- Modify: `src/lib/components/TimelinePanel.svelte`, `src/lib/components/TimelineRuler.svelte`, `src/lib/components/TimelineTrack.svelte` (CSS classes only)

**Interfaces:** none new. Behavior and testids unchanged — this is a visual-only pass, so existing tests must keep passing without edits.

- [ ] **Step 1: Apply the minimal pass (no behavior/testid changes)**

Tune classes for the clean/minimal look. Suggested starting point (adjust live with the designer):
- Panel body: increase padding to `p-3`, row gap to `gap-2`.
- Track lanes: taller and softer — `h-8`, `rounded-md`, lane fill `bg-muted/40`.
- Name column: keep `w-28`, make it `text-xs text-muted-foreground`.
- Header: `gap-3`, the chevron+label as a clear affordance; tab group with a subtle container (`rounded-md bg-muted/40 p-0.5`).
- Ruler: keep `h-7`; tick color `bg-border`, labels `text-muted-foreground`.

Keep ALL `data-testid`, `aria-label`, and option values exactly as they are. Do not change any handler.

- [ ] **Step 2: Verify autofixer on all three**

Run `svelte-autofixer` MCP on `TimelinePanel.svelte`, `TimelineRuler.svelte`, `TimelineTrack.svelte` until each returns `issues: []`.

- [ ] **Step 3: Full suite + check (no test edits expected)**

Run: `bun run test:unit -- run` → all passing (visual-only changes).
Run: `bun run check` → 0 errors.

- [ ] **Step 4: Live designer check**

Run `bun run dev`. Ask the designer to verify in the browser:
- Timeline appears only when kaleidoscope mode is ON; disappears when OFF.
- Chevron opens/closes the panel; switching Timeline ↔ Graph Editor never closes it.
- Ruler shows time labels; one continuous playhead spans ruler + lanes and tracks the clock.
- Selecting a keyframe shows the blue ring + time label + the contextual bar (interp + delete); the row itself stays clean.
- Overall clean/minimal feel.

Iterate the look live with the designer; re-run autofixer + full suite after any code change.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/TimelinePanel.svelte src/lib/components/TimelineRuler.svelte src/lib/components/TimelineTrack.svelte
git commit -m "style: minimal spacing and color pass on the timeline"
```

---

## Self-Review

**Spec coverage:**
- A (conditional visibility) → Task 1. ✅
- B (chevron + view tabs, close-bug fix) → Task 2. ✅
- C (ruler ticks + time labels) → Task 3. ✅
- D (continuous playhead) → Task 4. ✅
- E (per-row controls → contextual bar, lifted selection) → Task 5. ✅
- F (blue ring + position readout) → Task 6. ✅
- G (minimal spacing/color + live check) → Task 7. ✅
- Out-of-scope items (zoom, snap, durationSec edit, multi-select, track reorder) → not implemented. ✅

**Type consistency:** `selection: { paramId; keyframeId } | null` and `TimelineTrack` prop `selectedId: string | null` + `onselect: (keyframeId: string | null) => void` are used identically in Tasks 5 and 6. `formatSeconds(sec: number): string` defined in Task 3, reused in Tasks 3 and 6. `view: 'tracks' | 'graph'` introduced in Task 2 and used by the body switch thereafter. `Interp` imported from `$lib/animation/keyframes`.

**Placeholder scan:** No TBD/TODO; every code step shows concrete code; every test step shows the assertion; commands include expected results.

**Notes carried for the implementer:**
- The two "Timeline" accessible controls (chevron aria-label vs tab text) require `{ exact: true }` / aria-label disambiguation in tests — already specified.
- Always run the FULL `bun run test:unit -- run` before committing (singleton cross-spec pollution only surfaces there).
