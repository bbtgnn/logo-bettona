# Timeline Trim (In/Out) + Keyframable morphT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-track temporal trimming (In/Out points with draggable timeline handles) and promote each ring's `morphT` to a real keyframable parameter, auto-seeded with a bezier `0→1` track, retiring the procedural `simple` driver.

**Architecture:** Pure math (`$lib/animation/keyframes.ts`, `$lib/state/animatable-params.ts`) stays free of reactive state and is unit-tested in node. Reactive stores (`$lib/state/*.svelte.ts`) own mutation and persistence. The animation orchestration layer (`animation.svelte.ts`) owns the "a morph *is* keyframes" policy via wrapper functions, keeping `composition.ts` pure geometry. Timeline UI reads the stores and drives setters.

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, vitest (node + `@vitest/browser-playwright` chromium), Tailwind, paraglide i18n, bun.

## Global Constraints

- **Package manager:** bun. Single spec: `bun run test:unit -- run <path>`. Full unit: `bun run test:unit -- run`. Types: `bun run check`. e2e: `bunx playwright test`.
- **Paraglide recompile race:** the first unit run right after editing `messages/*.json` can flake one test — rerun once. `src/lib/paraglide/` is gitignored. If the playwright build breaks on a stale message, `rm -rf src/lib/paraglide && bun run paraglide`.
- **i18n parity:** every new key goes in BOTH `messages/en.json` and `messages/it.json` (a messages-parity test enforces equal key sets).
- **Svelte gate:** every changed `.svelte` / `.svelte.ts` MUST pass the Svelte MCP `svelte-autofixer` (load via ToolSearch `select:mcp__svelte__svelte-autofixer`) until `issues: []`. Ignore known false-positive *suggestions*: function-call/rAF inside `$effect`, `bind:this`→attachment.
- **Component tests run in a REAL browser** (vitest/browser): Tailwind is NOT loaded, so flex/width geometry is inert. Assert DOM structure / `data-testid` / role / text / handler calls — never Tailwind pixel visuals.
- **Indentation:** tabs. Commit trailer EXACTLY `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Do NOT run `prettier --write .` or `bun run lint` (pre-existing red, not a gate).
- **Normalized time:** all keyframe/track times and In/Out points are normalized `0..1`. `clamp01` lives in `keyframes.ts`.

## File Structure

- `src/lib/animation/keyframes.ts` — pure math. Add `inPoint`/`outPoint` to `Track`; guard `sampleTrack`. (Task 1)
- `src/lib/state/keyframes.svelte.ts` — store. Add `setTrackInPoint`, `setTrackOutPoint`, `deleteTrack`. (Task 2)
- `src/lib/components/TimelineTrack.svelte` — add In/Out handles + dim overlays. (Task 3)
- `src/lib/state/animatable-params.ts` — add `buildRingMorphParams`. (Task 4)
- `src/lib/state/animation.svelte.ts` — register morph params; add `createRingMorph`/`removeRingMorph`; remove the `simple` driver/layer. (Tasks 5, 6)
- `src/lib/state/animation-drivers/simple-driver.ts` + `.spec.ts` — DELETE. `types.ts` — drop `'simple'`. (Task 6)
- `src/lib/components/RingMorphConfigItem.svelte` — call `createRingMorph`/`removeRingMorph`. `SimpleSection.svelte` — drop toggle, rename to "Morph". (Task 7)

---

### Task 1: Trim — pure math (`Track` fields + `sampleTrack` guard)

**Files:**
- Modify: `src/lib/animation/keyframes.ts:11-15` (Track type), `:81-95` (sampleTrack)
- Test: `src/lib/animation/keyframes.spec.ts`

**Interfaces:**
- Produces: `Track` now has optional `inPoint?: number` and `outPoint?: number`. `sampleTrack(track: Track, t: number): number | null` returns `null` when `t` is strictly outside `[inPoint, outPoint]`.

- [ ] **Step 1: Write the failing tests**

Append inside the `describe('keyframes pure', …)` block in `src/lib/animation/keyframes.spec.ts` (the `track` helper there accepts a `Track`, so build trimmed tracks by spreading):

```ts
	it('returns null before inPoint (strict)', () => {
		const t: Track = { ...track([kf(0, 0), kf(1, 1)]), inPoint: 0.25 };
		expect(sampleTrack(t, 0.1)).toBeNull();
	});

	it('returns null after outPoint (strict)', () => {
		const t: Track = { ...track([kf(0, 0), kf(1, 1)]), outPoint: 0.75 };
		expect(sampleTrack(t, 0.9)).toBeNull();
	});

	it('samples normally exactly at inPoint and outPoint', () => {
		const t: Track = { ...track([kf(0, 0), kf(1, 1)]), inPoint: 0.25, outPoint: 0.75 };
		expect(sampleTrack(t, 0.25)).toBeCloseTo(0.25);
		expect(sampleTrack(t, 0.75)).toBeCloseTo(0.75);
		expect(sampleTrack(t, 0.5)).toBeCloseTo(0.5);
	});

	it('with no in/out bounds keeps full-range behavior', () => {
		const t = track([kf(0, 0), kf(1, 1)]);
		expect(sampleTrack(t, 0)).toBeCloseTo(0);
		expect(sampleTrack(t, 1)).toBeCloseTo(1);
	});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test:unit -- run src/lib/animation/keyframes.spec.ts`
Expected: the three trim tests FAIL (null not returned / values differ); the no-bounds test passes.

- [ ] **Step 3: Add the Track fields**

In `src/lib/animation/keyframes.ts`, extend the `Track` type:

```ts
export type Track = {
	paramId: string;
	enabled: boolean;
	keyframes: Keyframe[];
	inPoint?: number;
	outPoint?: number;
};
```

- [ ] **Step 4: Add the guard to `sampleTrack`**

In `src/lib/animation/keyframes.ts`, make `sampleTrack` start with the trim guard, before the empty/length checks:

```ts
export function sampleTrack(track: Track, t: number): number | null {
	if (track.inPoint != null && t < track.inPoint) return null;
	if (track.outPoint != null && t > track.outPoint) return null;
	const kfs = sortKeyframes(track.keyframes);
	if (kfs.length === 0) return null;
	// …rest unchanged…
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun run test:unit -- run src/lib/animation/keyframes.spec.ts`
Expected: PASS (all, including the new four). Rerun once if a paraglide flake appears.

- [ ] **Step 6: Commit**

```bash
git add src/lib/animation/keyframes.ts src/lib/animation/keyframes.spec.ts
git commit -m "feat(animate): Track inPoint/outPoint with strict sampleTrack guard

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Trim — store setters + `deleteTrack`

**Files:**
- Modify: `src/lib/state/keyframes.svelte.ts:41-103` (the `keyframes` object)
- Test: `src/lib/state/keyframes.svelte.spec.ts`

**Interfaces:**
- Consumes: `Track` from Task 1 (`inPoint`/`outPoint`), the private `track(paramId)` helper, `clamp01`.
- Produces on the `keyframes` store:
  - `setTrackInPoint(paramId: string, v: number): void`
  - `setTrackOutPoint(paramId: string, v: number): void`
  - `deleteTrack(paramId: string): void`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/state/keyframes.svelte.spec.ts` (match the existing import of `keyframes` from `./keyframes.svelte`; use unique paramIds to avoid cross-test bleed):

```ts
	it('setTrackInPoint clamps to 0..1', () => {
		keyframes.setTrackInPoint('t.in.clamp', 1.5);
		expect(keyframes.tracks['t.in.clamp'].inPoint).toBe(1);
		keyframes.setTrackInPoint('t.in.clamp', -0.5);
		expect(keyframes.tracks['t.in.clamp'].inPoint).toBe(0);
	});

	it('setTrackInPoint cannot exceed an existing outPoint', () => {
		keyframes.setTrackOutPoint('t.recip.a', 0.4);
		keyframes.setTrackInPoint('t.recip.a', 0.9);
		expect(keyframes.tracks['t.recip.a'].inPoint).toBe(0.4);
	});

	it('setTrackOutPoint cannot drop below an existing inPoint', () => {
		keyframes.setTrackInPoint('t.recip.b', 0.6);
		keyframes.setTrackOutPoint('t.recip.b', 0.2);
		expect(keyframes.tracks['t.recip.b'].outPoint).toBe(0.6);
	});

	it('deleteTrack removes the track entry', () => {
		keyframes.ensureTrack('t.del');
		expect(keyframes.tracks['t.del']).toBeDefined();
		keyframes.deleteTrack('t.del');
		expect(keyframes.tracks['t.del']).toBeUndefined();
	});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test:unit -- run src/lib/state/keyframes.svelte.spec.ts`
Expected: FAIL — `setTrackInPoint`/`setTrackOutPoint`/`deleteTrack` are not functions.

- [ ] **Step 3: Add the methods**

In `src/lib/state/keyframes.svelte.ts`, add these to the `keyframes` object (e.g. right after `setTrackEnabled`):

```ts
	setTrackInPoint(paramId: string, v: number) {
		const t = track(paramId);
		let next = clamp01(v);
		if (t.outPoint != null) next = Math.min(next, t.outPoint);
		t.inPoint = next;
	},
	setTrackOutPoint(paramId: string, v: number) {
		const t = track(paramId);
		let next = clamp01(v);
		if (t.inPoint != null) next = Math.max(next, t.inPoint);
		t.outPoint = next;
	},
	deleteTrack(paramId: string) {
		delete state.tracks[paramId];
	},
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test:unit -- run src/lib/state/keyframes.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 5: Svelte gate**

Load `mcp__svelte__svelte-autofixer` (ToolSearch `select:mcp__svelte__svelte-autofixer`) and run it on `src/lib/state/keyframes.svelte.ts` until `issues: []` (ignore the known false-positive suggestions listed in Global Constraints).

- [ ] **Step 6: Commit**

```bash
git add src/lib/state/keyframes.svelte.ts src/lib/state/keyframes.svelte.spec.ts
git commit -m "feat(animate): keyframes store setTrackInPoint/OutPoint + deleteTrack

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Trim — timeline In/Out handles

**Files:**
- Modify: `src/lib/components/TimelineTrack.svelte`
- Modify: `messages/en.json`, `messages/it.json`
- Test: `src/lib/components/TimelineTrack.svelte.spec.ts`

**Interfaces:**
- Consumes: `keyframes.setTrackInPoint`/`setTrackOutPoint` (Task 2), `keyframes.tracks[paramId]` (`inPoint`/`outPoint`), `timeFromX`/`xFromTime` (`timeline-geometry`), `refreshPreview` (`animation`).
- Produces: handles with `data-testid="trim-in-{paramId}"` / `trim-out-{paramId}`.

- [ ] **Step 1: Add i18n keys**

In BOTH `messages/en.json` and `messages/it.json`, add (alphabetical position near other `timeline_*` keys):

`en.json`:
```json
	"timeline_trim_in": "Trim start",
	"timeline_trim_out": "Trim end",
```
`it.json`:
```json
	"timeline_trim_in": "Inizio taglio",
	"timeline_trim_out": "Fine taglio",
```

Run `bun run paraglide` so `m.timeline_trim_in` / `m.timeline_trim_out` are generated.

- [ ] **Step 2: Write the failing test**

Append to `src/lib/components/TimelineTrack.svelte.spec.ts` (mirror the existing render setup in that file — it renders `TimelineTrack` with a `paramId`/`label` and seeds `keyframes`). Add:

```ts
	it('renders In and Out trim handles for the track', async () => {
		keyframes.ensureTrack('trim.param');
		keyframes.setTrackEnabled('trim.param', true);
		const { getByTestId } = render(TimelineTrack, { paramId: 'trim.param', label: 'Trim' });
		expect(getByTestId('trim-in-trim.param')).toBeInTheDocument();
		expect(getByTestId('trim-out-trim.param')).toBeInTheDocument();
	});

	it('dragging the In handle calls setTrackInPoint', async () => {
		const spy = vi.spyOn(keyframes, 'setTrackInPoint');
		keyframes.ensureTrack('trim.drag');
		keyframes.setTrackEnabled('trim.drag', true);
		const { getByTestId } = render(TimelineTrack, { paramId: 'trim.drag', label: 'Trim' });
		const handle = getByTestId('trim-in-trim.drag');
		handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 10 }));
		handle.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 40 }));
		handle.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
		expect(spy).toHaveBeenCalled();
	});
```

Ensure `vi` and `keyframes` are imported in the spec (check the file head; add `import { keyframes } from '$lib/state/keyframes.svelte';` and `import { vi } from 'vitest';` if missing).

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun run test:unit -- run src/lib/components/TimelineTrack.svelte.spec.ts`
Expected: FAIL — `trim-in-*` / `trim-out-*` not found.

- [ ] **Step 4: Implement the handles**

In `src/lib/components/TimelineTrack.svelte`:

1. Import the store setters — the file already imports `keyframes`. Add derived bounds and a trim-drag flag in `<script>`:

```ts
	const trk = $derived(keyframes.tracks[paramId]);
	const inPoint = $derived(trk?.inPoint ?? 0);
	const outPoint = $derived(trk?.outPoint ?? 1);
	let trimming: 'in' | 'out' | null = null;

	function onTrimDown(e: PointerEvent, which: 'in' | 'out') {
		e.stopPropagation();
		trimming = which;
		try {
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		} catch {
			// best-effort capture
		}
	}
	function onTrimMove(e: PointerEvent) {
		if (!trimming || !rowEl) return;
		const rect = rowEl.getBoundingClientRect();
		const t = timeFromX(e.clientX - rect.left, rect.width);
		if (trimming === 'in') keyframes.setTrackInPoint(paramId, t);
		else keyframes.setTrackOutPoint(paramId, t);
		refreshPreview();
	}
	function onTrimUp(e: PointerEvent) {
		trimming = null;
		const el = e.currentTarget as HTMLElement;
		if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
	}
```

2. Inside the lane `<div bind:this={rowEl} …>` (after the `{#each kfs …}` block, before `{#if selectedKf}`), add the dim overlays and handles:

```svelte
		{#if inPoint > 0}
			<div
				class="pointer-events-none absolute top-0 bottom-0 left-0 rounded-l-md bg-background/60"
				style="width: {xFromTime(inPoint, rowWidth())}px"
			></div>
		{/if}
		{#if outPoint < 1}
			<div
				class="pointer-events-none absolute top-0 right-0 bottom-0 rounded-r-md bg-background/60"
				style="width: {rowWidth() - xFromTime(outPoint, rowWidth())}px"
			></div>
		{/if}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			data-testid="trim-in-{paramId}"
			role="slider"
			tabindex="-1"
			aria-label={m.timeline_trim_in()}
			aria-valuenow={inPoint}
			class="absolute top-0 bottom-0 w-1.5 -translate-x-1/2 cursor-ew-resize bg-amber-400/70"
			style="left: {xFromTime(inPoint, rowWidth())}px"
			onpointerdown={(e) => onTrimDown(e, 'in')}
			onpointermove={onTrimMove}
			onpointerup={onTrimUp}
		></div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			data-testid="trim-out-{paramId}"
			role="slider"
			tabindex="-1"
			aria-label={m.timeline_trim_out()}
			aria-valuenow={outPoint}
			class="absolute top-0 bottom-0 w-1.5 -translate-x-1/2 cursor-ew-resize bg-amber-400/70"
			style="left: {xFromTime(outPoint, rowWidth())}px"
			onpointerdown={(e) => onTrimDown(e, 'out')}
			onpointermove={onTrimMove}
			onpointerup={onTrimUp}
		></div>
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun run test:unit -- run src/lib/components/TimelineTrack.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 6: Svelte gate**

Run `svelte-autofixer` on `src/lib/components/TimelineTrack.svelte` until `issues: []` (ignore the known false-positive suggestions).

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/TimelineTrack.svelte src/lib/components/TimelineTrack.svelte.spec.ts messages/en.json messages/it.json
git commit -m "feat(animate): draggable In/Out trim handles on timeline tracks

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: morphT param builder (`buildRingMorphParams`)

**Files:**
- Modify: `src/lib/state/animatable-params.ts`
- Test: `src/lib/state/animatable-params.spec.ts`

**Interfaces:**
- Consumes: `Ring` type, `AnimatableParam` type.
- Produces:
  ```ts
  export function buildRingMorphParams(
  	rings: Ring[],
  	deps: { setMorphT: (index: number, v: number) => void; ringLabel: (index: number) => string }
  ): AnimatableParam[]
  ```
  Emits `{ id: "ring.${i}.morphT", label: "${ringLabel(i)} · morph", min: 0, max: 1, step: 0.01, get, set }` only for rings with `secondaryTemplatePath != null`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/state/animatable-params.spec.ts` (add `buildRingMorphParams` to the import from `./animatable-params`):

```ts
describe('buildRingMorphParams', () => {
	function ringWithMorph(): Ring {
		return { secondaryTemplatePath: { cmds: [], crds: [] }, morphT: 0.3 } as Ring;
	}

	it('builds a param only for rings with a morph target', () => {
		const rings = [ringWithMorph(), {} as Ring];
		const params = buildRingMorphParams(rings, {
			setMorphT: () => {},
			ringLabel: (i) => `Ring ${i + 1}`
		});
		expect(params.map((p) => p.id)).toEqual(['ring.0.morphT']);
		expect(params[0].min).toBe(0);
		expect(params[0].max).toBe(1);
		expect(params[0].step).toBe(0.01);
	});

	it('get reads live morphT; set routes through setMorphT with the ring index', () => {
		const rings = [{} as Ring, ringWithMorph()];
		const calls: Array<[number, number]> = [];
		const params = buildRingMorphParams(rings, {
			setMorphT: (i, v) => calls.push([i, v]),
			ringLabel: (i) => `Ring ${i + 1}`
		});
		expect(params[0].id).toBe('ring.1.morphT');
		expect(params[0].get()).toBe(0.3);
		params[0].set(0.8);
		expect(calls).toEqual([[1, 0.8]]);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test:unit -- run src/lib/state/animatable-params.spec.ts`
Expected: FAIL — `buildRingMorphParams` is not exported.

- [ ] **Step 3: Implement the builder**

Append to `src/lib/state/animatable-params.ts`:

```ts
// Per-ring morph is DYNAMIC like wave overrides: a ring contributes a morphT param
// only while it has a morph target (`secondaryTemplatePath`). Built from the live rings
// array every call — ids carry the live index, never cached across add/remove.
export function buildRingMorphParams(
	rings: Ring[],
	deps: {
		setMorphT: (index: number, v: number) => void;
		ringLabel: (index: number) => string;
	}
): AnimatableParam[] {
	const params: AnimatableParam[] = [];
	rings.forEach((ring, index) => {
		if (ring.secondaryTemplatePath == null) return;
		params.push({
			id: `ring.${index}.morphT`,
			label: `${deps.ringLabel(index)} · morph`,
			min: 0,
			max: 1,
			step: 0.01,
			get: () => rings[index].morphT ?? 0,
			set: (v) => deps.setMorphT(index, v)
		});
	});
	return params;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test:unit -- run src/lib/state/animatable-params.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/animatable-params.ts src/lib/state/animatable-params.spec.ts
git commit -m "feat(animate): buildRingMorphParams — morphT as a dynamic per-ring param

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Register morphT params + `createRingMorph` / `removeRingMorph`

**Files:**
- Modify: `src/lib/state/animation.svelte.ts`
- Test: `src/lib/state/animation.svelte.spec.ts`

**Interfaces:**
- Consumes: `buildRingMorphParams` (Task 4), `keyframes.ensureTrack`/`setTrackEnabled`/`addKeyframe`/`deleteTrack` (Tasks 2 + existing), `createRingMorphTarget`/`removeRingMorphTarget`/`setRingMorphT` (`composition`).
- Produces:
  - `getAllAnimatableParams()` now also returns `ring.${i}.morphT` params for morph rings.
  - `createRingMorph(index: number): void` — creates the target and seeds a bezier `0→1` morphT track.
  - `removeRingMorph(index: number): void` — removes the target and deletes the morphT track.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/state/animation.svelte.spec.ts` (this suite imports `./animation` dynamically; mirror that style). The composition module is mocked in this spec — confirm `createRingMorphTarget`/`removeRingMorphTarget` are exposed by the existing mock; if not, extend the mock factory to include them as `vi.fn()`:

```ts
	it('createRingMorph seeds an armed bezier 0→1 morphT track', async () => {
		const animation = await import('./animation');
		const { keyframes } = await import('./keyframes.svelte');
		keyframes.deleteTrack('ring.0.morphT');

		animation.createRingMorph(0);

		const track = keyframes.tracks['ring.0.morphT'];
		expect(track?.enabled).toBe(true);
		const sorted = [...track.keyframes].sort((a, b) => a.time - b.time);
		expect(sorted.map((k) => [k.time, k.value])).toEqual([
			[0, 0],
			[1, 1]
		]);
		expect(sorted[0].interp).toBe('bezier');
	});

	it('removeRingMorph deletes the morphT track', async () => {
		const animation = await import('./animation');
		const { keyframes } = await import('./keyframes.svelte');
		animation.createRingMorph(0);
		expect(keyframes.tracks['ring.0.morphT']).toBeDefined();

		animation.removeRingMorph(0);
		expect(keyframes.tracks['ring.0.morphT']).toBeUndefined();
	});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test:unit -- run src/lib/state/animation.svelte.spec.ts`
Expected: FAIL — `createRingMorph`/`removeRingMorph` are not exported.

- [ ] **Step 3: Wire the morph params into the registry**

In `src/lib/state/animation.svelte.ts`:

1. Add `buildRingMorphParams` to the existing import from `./animatable-params`:

```ts
import {
	buildAudioBarsParams,
	buildAudioZonesParams,
	buildRingWaveParams,
	buildRingMorphParams,
	type AnimatableParam
} from './animatable-params';
```

2. Ensure `createRingMorphTarget` and `removeRingMorphTarget` are imported from `./composition` (the file already imports `setRingMorphT`, `updateRing`, etc. from there — add the two morph-target functions to that import list).

3. Add `keyframes` import is already present (`import { keyframes } from './keyframes.svelte';`).

4. In `getAllAnimatableParams()`, append the morph params to the returned array (after the `buildRingWaveParams(...)` spread):

```ts
		...buildRingMorphParams(composition.rings, {
			setMorphT: setRingMorphT,
			ringLabel: (i) => m.editor_ring_label({ index: i + 1 })
		})
```

- [ ] **Step 4: Add the create/remove wrappers**

Add to `src/lib/state/animation.svelte.ts` (near the other exported functions):

```ts
/**
 * Create a ring morph target and seed its default animation: an armed morphT track
 * easing from 0 to 1 across the timeline (bezier ease-out/ease-in via addKeyframe's
 * default handles). This is the "a morph IS keyframes" policy — composition.ts stays
 * pure geometry; the keyframe seeding lives here.
 */
export function createRingMorph(index: number): void {
	createRingMorphTarget(index);
	const id = `ring.${index}.morphT`;
	keyframes.ensureTrack(id);
	keyframes.setTrackEnabled(id, true);
	keyframes.addKeyframe(id, { time: 0, value: 0, interp: 'bezier' });
	keyframes.addKeyframe(id, { time: 1, value: 1, interp: 'bezier' });
	refreshPreview();
}

export function removeRingMorph(index: number): void {
	removeRingMorphTarget(index);
	keyframes.deleteTrack(`ring.${index}.morphT`);
	refreshPreview();
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun run test:unit -- run src/lib/state/animation.svelte.spec.ts`
Expected: PASS for the two new tests. (Other tests in this file still assert `simple` behavior — they are updated in Task 6. If they fail now, that's expected and addressed next.)

- [ ] **Step 6: Svelte gate**

Run `svelte-autofixer` on `src/lib/state/animation.svelte.ts` until `issues: []`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/state/animation.svelte.ts src/lib/state/animation.svelte.spec.ts
git commit -m "feat(animate): register morphT params + createRingMorph/removeRingMorph

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Remove the `simple` driver and layer

**Files:**
- Delete: `src/lib/state/animation-drivers/simple-driver.ts`, `src/lib/state/animation-drivers/simple-driver.spec.ts`
- Modify: `src/lib/state/animation-drivers/types.ts:1` (drop `'simple'`)
- Modify: `src/lib/state/animation.svelte.ts` (remove driver registration, layer, sync branches)
- Modify: `src/lib/state/animation.svelte.spec.ts` (remove/adjust obsolete `simple` assertions)

**Interfaces:**
- Consumes: nothing new.
- Produces: `AnimationLayer = 'audioBars' | 'audioZones' | 'dataSeries' | 'kaleidoscope'`; `AnimationDriverType = 'audioBars' | 'audioZones' | 'dataSeries'`; `animationState.layers` no longer has a `simple` key.

- [ ] **Step 1: Delete the simple-driver files**

```bash
git rm src/lib/state/animation-drivers/simple-driver.ts src/lib/state/animation-drivers/simple-driver.spec.ts
```

- [ ] **Step 2: Drop `'simple'` from the driver-type union**

In `src/lib/state/animation-drivers/types.ts`:

```ts
export type AnimationDriverType = 'audioBars' | 'audioZones' | 'dataSeries';
```

- [ ] **Step 3: Strip `simple` from `animation.svelte.ts`**

Make these edits in `src/lib/state/animation.svelte.ts`:

1. Remove the import `import { createSimpleDriver } from './animation-drivers/simple-driver';`.
2. Remove the whole `runtime.registerDriver('simple', createSimpleDriver({ … }));` block (lines around 108-115).
3. `AnimationLayer` type → `export type AnimationLayer = 'audioBars' | 'audioZones' | 'dataSeries' | 'kaleidoscope';`
4. `animationState.layers` default → `layers: { audioBars: false, audioZones: false, dataSeries: false, kaleidoscope: true },`
5. In `syncActiveDrivers()`, delete the line `runtime.setActive('simple', animationState.layers.simple);`.
6. In `stopInternal()`, delete the line `runtime.setActive('simple', false);`.
7. In `handleCompositionChanged()`, remove `animationState.layers.simple ||` from the layer-check condition (keep `audioBars`/`audioZones`).

Leave the `runtime` instance and its `applyRingT` dep untouched — the audio drivers still register on it and return `{}`, so `applyRingT` is simply never called. `applyMorphT(0)` / `getMorphRingIndices` / `animatedIndices` bookkeeping stays.

- [ ] **Step 4: Update the obsolete `simple` tests**

In `src/lib/state/animation.svelte.spec.ts`, the `simple` driver no longer auto-drives `morphT`. Edit:

- The "defaults to simple + kaleidoscope layers on" test → rename to "defaults to kaleidoscope layer on, others off" and drop the `layers.simple` assertion (assert `kaleidoscope` true; `audioBars`/`audioZones`/`dataSeries` false).
- The "setLayerEnabled toggles a layer independently" test → replace the `'simple'` toggles with `'audioBars'` toggles (the independence behavior is the same).
- Any test asserting `setRingMorphT` was called from the clock (e.g. "simple non-loop reaches 1", the `0.2` morph-ramp test) → DELETE these tests. Driving `morphT` from the bare clock is exactly the behavior being removed; the morph ramp is now keyframe-driven and covered by Task 5. Keep tests that assert clock/progress/`elapsedMs`/completion semantics that don't reference `morphT` or `layers.simple`; where such a test merely touches `layers.simple`, drop that line or switch to `kaleidoscope`.

After editing, grep to confirm none remain:

```bash
grep -rn "simple" src/lib/state/animation.svelte.spec.ts
```
Expected: no matches.

- [ ] **Step 5: Run the affected suites + type check**

Run:
```bash
bun run test:unit -- run src/lib/state/animation.svelte.spec.ts
bun run check
```
Expected: unit PASS; `bun run check` 0 errors / 0 warnings. Rerun unit once if a paraglide flake appears.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(animate): remove simple driver/layer — morphT is keyframe-driven now

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Rewire `RingMorphConfigItem` + rename section to "Morph"

**Files:**
- Modify: `src/lib/components/RingMorphConfigItem.svelte`
- Modify: `src/lib/components/SimpleSection.svelte`
- Modify: `messages/en.json`, `messages/it.json`
- Test: `src/lib/components/SimpleSection.svelte.spec.ts`

**Interfaces:**
- Consumes: `createRingMorph`/`removeRingMorph` (Task 5), new message `m.animate_layer_morph`.

- [ ] **Step 1: Add the "Morph" section i18n key; remove the dead one**

In BOTH `messages/en.json` and `messages/it.json`:
- Add `"animate_layer_morph"`: `en` → `"Morph"`, `it` → `"Morph"`.
- Remove the now-unused `"animate_layer_simple"` key from both files (only `SimpleSection.svelte` referenced it, edited below).

Run `bun run paraglide`.

- [ ] **Step 2: Rewrite the `SimpleSection.svelte.spec.ts` expectations**

Replace the current toggle-based test in `src/lib/components/SimpleSection.svelte.spec.ts` with:

```ts
	it('has no simple layer toggle', () => {
		const { queryByTestId } = render(SimpleSection);
		expect(queryByTestId('layer-toggle-simple')).toBeNull();
	});

	it('renders the Morph heading', () => {
		const { getAllByText } = render(SimpleSection);
		expect(getAllByText('Morph').length).toBeGreaterThan(0);
	});
```

Remove the old test that imported `setLayerEnabled` / asserted `animationState.layers.simple`, and drop those imports from the spec head.

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun run test:unit -- run src/lib/components/SimpleSection.svelte.spec.ts`
Expected: FAIL — the toggle still renders / heading text mismatch.

- [ ] **Step 4: Edit `SimpleSection.svelte`**

In `src/lib/components/SimpleSection.svelte`:
- Remove the `setLayerEnabled` and `animationState` imports if they become unused (keep `composition`, `m`, `SidebarCollapsible`, `RingMorphConfigItem`).
- Replace both `{m.animate_layer_simple()}` usages in the trigger with `{m.animate_layer_morph()}`.
- Delete the entire `<label …><input data-testid="layer-toggle-simple" … /> … </label>` block (the toggle).

Resulting `content` snippet body:

```svelte
		{#snippet content()}
			<div class="space-y-3">
				{#if composition.rings.length === 0}
					<p class="text-[11px] text-muted-foreground">{m.animate_simple_empty()}</p>
				{:else}
					{#each composition.rings as ring, i (i)}
						<RingMorphConfigItem {ring} index={i} />
					{/each}
				{/if}
			</div>
		{/snippet}
```

And the trigger snippet uses `{m.animate_layer_morph()}`.

- [ ] **Step 5: Rewire `RingMorphConfigItem.svelte`**

In `src/lib/components/RingMorphConfigItem.svelte`:
- Change the import: drop `createRingMorphTarget` and `removeRingMorphTarget` from the `./composition` import; add `import { createRingMorph, removeRingMorph } from '$lib/state/animation';`. Keep `composition`, `updateRingPathVariant`, `setRingMorphT` from `./composition`.
- Line ~47 (library "both" slot, no secondary): `removeRingMorphTarget(index)` → `removeRingMorph(index)`.
- Line ~109 (create button): `createRingMorphTarget(index)` → `createRingMorph(index)`.
- Line ~159 (remove button): `removeRingMorphTarget(index)` → `removeRingMorph(index)`.

- [ ] **Step 6: Run the tests to verify they pass**

Run:
```bash
bun run test:unit -- run src/lib/components/SimpleSection.svelte.spec.ts
bun run test:unit -- run src/lib/components/RingMorphConfigItem.svelte.spec.ts
```
Expected: PASS. (If `RingMorphConfigItem` has no spec, skip its run.)

- [ ] **Step 7: Svelte gate**

Run `svelte-autofixer` on `src/lib/components/SimpleSection.svelte` and `src/lib/components/RingMorphConfigItem.svelte` until `issues: []` each.

- [ ] **Step 8: Full verification**

Run:
```bash
bun run check
bun run test:unit -- run
bunx playwright test
```
Expected: `check` 0/0; full unit green; e2e 6/6. Rerun unit once on a paraglide flake.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(animate): morph section (was Simple) drives keyframe-backed morphT

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- §1.1 Track fields + sampleTrack guard → Task 1. ✓
- §1.2 setTrackInPoint/OutPoint → Task 2. ✓
- §1.3 timeline handles + dim overlays → Task 3. ✓
- §2.1 buildRingMorphParams → Task 4. ✓
- §2.2 registry wiring → Task 5. ✓
- §2.3 auto-seed bezier + deleteTrack + rewire → Tasks 2 (deleteTrack), 5 (wrappers), 7 (rewire). ✓
- §2.4 remove simple driver → Task 6. ✓
- §2.5 rename section "Morph" → Task 7. ✓
- Testing section → each task carries its tests; Task 7 Step 8 runs all gates. ✓
- Known limits (index-keyed params, no snap, filename retained) → carried as code comments / left intentionally; no task needed. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Type consistency:** `setTrackInPoint`/`setTrackOutPoint`/`deleteTrack` (Task 2) used identically in Tasks 3, 5. `buildRingMorphParams` signature (Task 4) matches its call in Task 5. `createRingMorph`/`removeRingMorph` (Task 5) match the calls in Task 7. `AnimationLayer`/`AnimationDriverType` reductions (Task 6) are consistent. ✓
