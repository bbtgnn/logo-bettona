# Stable Ring Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every `Ring` a stable `id` so animation tracks and per-ring param ids hang off identity instead of array position — fixing keyframe orphaning/misattribution on ring delete (and making the existing `reorderRings` safe for free).

**Architecture:** Add a required `id: string` to `Ring`, minted once at creation (`crypto.randomUUID`) and backfilled on load for any legacy saved ring. Per-ring param ids and morph track keys switch from `ring.<index>.*` to `ring.<id>.*`. Transient, act-now setters (`updateRing(index)`, `setRingMorphT(index)`) stay index-addressed — only persisted track keys move to id. Deleting a ring now deletes its tracks. Old index-keyed keyframe data is abandoned via a fresh localStorage key (no migration — user confirmed all saved data is test material).

**Tech Stack:** SvelteKit + Svelte 5 runes, TypeScript, paper.js, rune-sync (localStorage), vitest (unit + vitest-browser-svelte for components).

## Global Constraints

- Package manager: **bun**. Types: `bun run check` (recompiles paraglide; must be 0 errors / 0 warnings). Single unit spec: `bun run test:unit -- run <path>`. Full unit: `bun run test:unit -- run`.
- **Tab indentation** everywhere. No `prettier --write .` / `bun run lint` (pre-existing red — not a gate).
- Commit trailer EXACTLY: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Every changed `.svelte` / `.svelte.ts` MUST pass the Svelte MCP `svelte-autofixer` → `issues: []` (load via ToolSearch `select:mcp__svelte__svelte-autofixer`). Ignore known false-positive *suggestions* (rAF/function-call inside `$effect`, `bind:this`→attachment).
- No new user-facing copy in this plan → no `messages/en.json` / `messages/it.json` changes.
- Ring identity is the persisted key for tracks; array index stays valid only for transient, same-tick operations. See `CONTEXT.md` (**Ring id**).
- Component tests run in a REAL browser (Tailwind inert) — assert DOM structure / testid / role / text, not Tailwind geometry.

---

### Task 1: Add `Ring.id`, mint at creation, backfill on load

**Files:**
- Create: `src/lib/state/ring-id.ts`
- Create: `src/lib/state/ring-id.spec.ts`
- Modify: `src/lib/types.ts:30-41` (add `id` to `Ring`)
- Modify: `src/lib/state/composition.ts:21-35` (`DEFAULT_RING` → omit id), `:125-128` (`addRing` mints id)
- Modify: `src/lib/state/default.ts:7-95` (literal ids on 4 default rings)
- Modify: `src/lib/state/composition-persistence.svelte.ts:31-42` (`ensureRingIds` inside `normalizeComposition`)
- Test: `src/lib/state/composition.svelte.spec.ts` (addRing produces unique ids)

**Interfaces:**
- Produces: `newRingId(): string` (from `ring-id.ts`); `ensureRingIds(c: Composition): Composition` (from `composition-persistence.svelte.ts`); `Ring.id: string` (required field). Later tasks read `composition.rings[i].id`.

- [ ] **Step 1: Write the failing test for the id minter**

Create `src/lib/state/ring-id.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { newRingId } from './ring-id';

describe('newRingId', () => {
	it('returns a non-empty string', () => {
		expect(newRingId().length).toBeGreaterThan(0);
	});

	it('returns a different id on each call', () => {
		const ids = new Set(Array.from({ length: 50 }, () => newRingId()));
		expect(ids.size).toBe(50);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test:unit -- run src/lib/state/ring-id.spec.ts`
Expected: FAIL — cannot resolve `./ring-id`.

- [ ] **Step 3: Implement the minter**

Create `src/lib/state/ring-id.ts` (mirrors the existing `newId()` in `keyframes.svelte.ts:24-28`):

```ts
// Stable identity for a Ring, minted once at creation. crypto.randomUUID where
// available, with a non-crypto fallback for older runtimes / SSR-less contexts.
export function newRingId(): string {
	const c = (globalThis as { crypto?: Crypto }).crypto;
	if (c && 'randomUUID' in c) return c.randomUUID();
	return `ring-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `bun run test:unit -- run src/lib/state/ring-id.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Add `id` to the `Ring` type**

In `src/lib/types.ts`, add `id` as the first field of `Ring` (line 30-41 block):

```ts
export type Ring = {
	id: string;
	copies: number;
	color: string;
	templatePath: Path | null;
	secondaryTemplatePath: Path | null;
	morphT: number;
	ringHeight: number;
	wave?: WaveState | null; // absent/null → no wave → renders identical to today
	waveConfig?: WaveConfig | null; // null/absent = inherit global AudioBarsConfig default
	zoneConfig?: ZoneIntensity | null; // persisted; null = inherit global default
	zoneDrive?: ZoneDrive | null; // transient; stripped from persistence
};
```

- [ ] **Step 6: Make `DEFAULT_RING` id-less and have `addRing` mint the id**

In `src/lib/state/composition.ts`:

Change the `DEFAULT_RING` declaration (line 21) so it omits `id` (the constant is a template; identity is per-instance):

```ts
const DEFAULT_RING: Omit<Ring, 'id'> = {
```

Add the import near the other state imports (top of file):

```ts
import { newRingId } from './ring-id';
```

Change `addRing` (line 125-128) to mint an id:

```ts
export function addRing() {
	composition.rings = [...composition.rings, { ...DEFAULT_RING, id: newRingId() }];
	applyColorMode();
}
```

- [ ] **Step 7: Give the four default rings literal ids**

In `src/lib/state/default.ts`, add `id` as the first property of each of the 4 ring object literals in `rings: [...]`. Use stable literals (unique within the composition):

```ts
		rings: [
			{
				id: 'ring-default-0',
				copies: 8,
				color: '#ffffff',
				// ...unchanged
			},
			{
				id: 'ring-default-1',
				copies: 8,
				color: '#000000',
				// ...unchanged
			},
			{
				id: 'ring-default-2',
				copies: 8,
				color: '#ffffff',
				// ...unchanged
			},
			{
				id: 'ring-default-3',
				copies: 8,
				color: '#000000',
				// ...unchanged
			}
		],
```

(Only the `id:` line is added to each ring; every other field stays byte-identical.)

- [ ] **Step 8: Write the failing test for `ensureRingIds` backfill**

Add to `src/lib/state/composition.svelte.spec.ts` (a new `describe` block — match the file's existing import style for `composition-persistence.svelte`):

```ts
import { ensureRingIds } from './composition-persistence.svelte';
import type { Composition, Ring } from '$lib/types';

describe('ensureRingIds', () => {
	const base = (rings: Partial<Ring>[]): Composition =>
		({ rings } as unknown as Composition);

	it('mints an id for rings missing one', () => {
		const out = ensureRingIds(base([{ copies: 8 }, { copies: 4 }]));
		expect(out.rings[0].id.length).toBeGreaterThan(0);
		expect(out.rings[1].id.length).toBeGreaterThan(0);
		expect(out.rings[0].id).not.toBe(out.rings[1].id);
	});

	it('preserves an existing id', () => {
		const out = ensureRingIds(base([{ id: 'keep-me', copies: 8 }]));
		expect(out.rings[0].id).toBe('keep-me');
	});
});
```

- [ ] **Step 9: Run it to verify it fails**

Run: `bun run test:unit -- run src/lib/state/composition.svelte.spec.ts`
Expected: FAIL — `ensureRingIds` is not exported.

- [ ] **Step 10: Implement `ensureRingIds` and call it in `normalizeComposition`**

In `src/lib/state/composition-persistence.svelte.ts`:

Add the import at the top:

```ts
import { newRingId } from './ring-id';
```

Add the exported helper (place it just above `normalizeComposition`):

```ts
/**
 * Backfills a stable `id` on any ring that lacks one (legacy saved data predates
 * the field). Existing ids pass through untouched. Runs on every load and cross-tab
 * sync so the in-memory composition always has fully-identified rings.
 */
export function ensureRingIds(c: Composition): Composition {
	if (c.rings?.every((r) => typeof (r as { id?: string }).id === 'string' && r.id.length > 0)) {
		return c;
	}
	return {
		...c,
		rings: c.rings.map((r) =>
			typeof (r as { id?: string }).id === 'string' && r.id.length > 0
				? r
				: { ...r, id: newRingId() }
		)
	};
}
```

Wrap the return of `normalizeComposition` (line 31-42) so the backfill runs on the read + subscribe paths:

```ts
export function normalizeComposition(c: Composition): Composition {
	const palettes = c.monochromePalettes?.map((p) => {
		const legacy = p as LegacyMono;
		if (legacy.main !== undefined || legacy.bg !== undefined) {
			const primary = legacy.main ?? '#000000';
			const bg = legacy.bg ?? '#ffffff';
			return { primary, secondary: bg, background: bg };
		}
		return p;
	});
	const withPalettes = palettes ? { ...c, monochromePalettes: palettes } : c;
	return ensureRingIds(withPalettes);
}
```

- [ ] **Step 11: Run the new tests to verify they pass**

Run: `bun run test:unit -- run src/lib/state/ring-id.spec.ts src/lib/state/composition.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 12: Verify the whole type graph compiles**

Run: `bun run check`
Expected: 0 errors, 0 warnings. (If a test helper anywhere constructs a `Ring` literal without `id`, that surfaces here — fix those literals by adding an `id` in the same step.)

- [ ] **Step 13: Commit**

```bash
git add src/lib/state/ring-id.ts src/lib/state/ring-id.spec.ts src/lib/types.ts src/lib/state/composition.ts src/lib/state/default.ts src/lib/state/composition-persistence.svelte.ts src/lib/state/composition.svelte.spec.ts
git commit -m "feat(rings): add stable Ring.id minted at creation + backfilled on load

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Key per-ring param ids by `ring.id`

**Files:**
- Modify: `src/lib/state/animatable-params.ts:124-196` (`buildRingWaveParams`, `buildRingMorphParams`)
- Test: `src/lib/state/animatable-params.spec.ts`

**Interfaces:**
- Consumes: `Ring.id` (Task 1).
- Produces: param ids of shape `ring.<id>.wave.crests`, `ring.<id>.wave.amplitudeGain`, `ring.<id>.wave.phaseSpeed`, `ring.<id>.morphT`. The get/set closures stay index-addressed (they act on the live array at call time).

- [ ] **Step 1: Write the failing test**

Add to `src/lib/state/animatable-params.spec.ts` (match the file's existing helpers for building a `Ring` — add an `id` to any inline ring literal the file already uses):

```ts
import { buildRingMorphParams, buildRingWaveParams } from './animatable-params';
import type { Ring } from '$lib/types';

const ring = (over: Partial<Ring>): Ring =>
	({
		id: 'r-abc',
		copies: 8,
		color: '#000',
		templatePath: { cmds: ['M'], crds: [0, 0] },
		secondaryTemplatePath: null,
		morphT: 0,
		ringHeight: 0.1,
		...over
	}) as Ring;

describe('per-ring param ids carry the ring id, not the index', () => {
	it('morph param id is ring.<id>.morphT', () => {
		const rings = [ring({ id: 'r-abc', secondaryTemplatePath: { cmds: ['M'], crds: [0, 0] } })];
		const params = buildRingMorphParams(rings, {
			setMorphT: () => {},
			ringLabel: () => 'Ring 1'
		});
		expect(params.map((p) => p.id)).toEqual(['ring.r-abc.morphT']);
	});

	it('wave param ids are ring.<id>.wave.*', () => {
		const rings = [
			ring({ id: 'r-xyz', waveConfig: { crests: 2, amplitudeGain: 0.5, phaseSpeed: 1 } })
		];
		const params = buildRingWaveParams(rings, {
			updateRing: () => {},
			globalDefault: () => ({ crests: 1, amplitudeGain: 0, phaseSpeed: 0 }),
			ringLabel: () => 'Ring 1'
		});
		expect(params.map((p) => p.id)).toEqual([
			'ring.r-xyz.wave.crests',
			'ring.r-xyz.wave.amplitudeGain',
			'ring.r-xyz.wave.phaseSpeed'
		]);
	});

	it('id is stable when the ring moves to a new index', () => {
		const moved = [ring({ id: 'pad' }), ring({ id: 'r-abc', secondaryTemplatePath: { cmds: ['M'], crds: [0, 0] } })];
		const params = buildRingMorphParams(moved, { setMorphT: () => {}, ringLabel: () => 'x' });
		expect(params.map((p) => p.id)).toEqual(['ring.r-abc.morphT']);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test:unit -- run src/lib/state/animatable-params.spec.ts`
Expected: FAIL — ids come back as `ring.0.morphT` / `ring.0.wave.crests`.

- [ ] **Step 3: Switch the id strings to `ring.id`**

In `src/lib/state/animatable-params.ts`, in `buildRingWaveParams` change the three id template strings (lines 141, 150, 159) from `ring.${index}.wave.*` to `ring.${ring.id}.wave.*`:

```ts
				id: `ring.${ring.id}.wave.crests`,
```
```ts
				id: `ring.${ring.id}.wave.amplitudeGain`,
```
```ts
				id: `ring.${ring.id}.wave.phaseSpeed`,
```

In `buildRingMorphParams` change line 186 from `ring.${index}.morphT` to `ring.${ring.id}.morphT`:

```ts
			id: `ring.${ring.id}.morphT`,
```

Leave every `get` / `set` / `resolved` / `updateRing(index, …)` / `setMorphT(index, …)` exactly as-is — they operate on the live array by position and are rebuilt each frame, so the captured `index` is always current.

- [ ] **Step 4: Run it to verify it passes**

Run: `bun run test:unit -- run src/lib/state/animatable-params.spec.ts`
Expected: PASS.

- [ ] **Step 5: Verify types**

Run: `bun run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Commit**

```bash
git add src/lib/state/animatable-params.ts src/lib/state/animatable-params.spec.ts
git commit -m "feat(rings): key per-ring wave/morph param ids by ring.id

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Key morph track create/delete by `ring.id`

**Files:**
- Modify: `src/lib/state/animation.svelte.ts:516-529` (`createRingMorph`, `removeRingMorph`)
- Test: `src/lib/state/animation.svelte.spec.ts:450-485`

**Interfaces:**
- Consumes: `Ring.id` (Task 1), `composition.rings` (existing import).
- Produces: morph tracks stored under `ring.<id>.morphT`.

- [ ] **Step 1: Update the failing tests to expect id-keyed tracks**

In `src/lib/state/animation.svelte.spec.ts`, rewrite the two tests in the `ring morph create/remove` block (lines 455-484) to resolve the id from composition instead of hardcoding `ring.0.morphT`:

```ts
	it('createRingMorph seeds an armed bezier 0→1 morphT track', async () => {
		const animation = await import('./animation');
		const { keyframes } = await import('./keyframes.svelte');
		const { composition } = await import('./composition-persistence.svelte');
		const id = `ring.${composition.rings[0].id}.morphT`;
		keyframes.deleteTrack(id);

		animation.createRingMorph(0);

		const track = keyframes.tracks[id];
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
		const { composition } = await import('./composition-persistence.svelte');
		const id = `ring.${composition.rings[0].id}.morphT`;
		animation.createRingMorph(0);
		expect(keyframes.tracks[id]).toBeDefined();

		animation.removeRingMorph(0);
		expect(keyframes.tracks[id]).toBeUndefined();
	});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `bun run test:unit -- run src/lib/state/animation.svelte.spec.ts -t "ring morph create/remove"`
Expected: FAIL — production still writes `ring.0.morphT`, test now reads `ring.<uuid>.morphT`.

- [ ] **Step 3: Resolve the id from the ring in both functions**

In `src/lib/state/animation.svelte.ts`, change `createRingMorph` (line 516) and `removeRingMorph` (line 526):

```ts
export function createRingMorph(index: number): void {
	createRingMorphTarget(index);
	const ring = composition.rings[index];
	if (!ring) return;
	const id = `ring.${ring.id}.morphT`;
	keyframes.ensureTrack(id);
	keyframes.setTrackEnabled(id, true);
	keyframes.addKeyframe(id, { time: 0, value: 0, interp: 'bezier' });
	keyframes.addKeyframe(id, { time: 1, value: 1, interp: 'bezier' });
	refreshPreview();
}

export function removeRingMorph(index: number): void {
	const ring = composition.rings[index];
	removeRingMorphTarget(index);
	if (ring) keyframes.deleteTrack(`ring.${ring.id}.morphT`);
	refreshPreview();
}
```

(Note: in `removeRingMorph` we read `ring` *before* `removeRingMorphTarget`, which only clears the secondary path — it does not remove the ring — so `ring` and its `id` remain valid either way; reading first keeps it robust.)

- [ ] **Step 4: Run them to verify they pass**

Run: `bun run test:unit -- run src/lib/state/animation.svelte.spec.ts -t "ring morph create/remove"`
Expected: PASS.

- [ ] **Step 5: Run the full animation spec (no regressions)**

Run: `bun run test:unit -- run src/lib/state/animation.svelte.spec.ts`
Expected: PASS (all blocks).

- [ ] **Step 6: Commit**

```bash
git add src/lib/state/animation.svelte.ts src/lib/state/animation.svelte.spec.ts
git commit -m "feat(rings): key morphT track create/delete by ring.id

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Deleting a ring deletes its tracks

**Files:**
- Modify: `src/lib/state/keyframes.svelte.ts:41-65` (add `deleteTracksForRing`)
- Modify: `src/lib/state/animation.svelte.ts` (add orchestrated `removeRing` wrapper + import composition's under alias)
- Modify: `src/lib/components/RingEditor.svelte:9-16` (import `removeRing` from animation, not composition)
- Test: `src/lib/state/keyframes.svelte.spec.ts`, `src/lib/state/animation.svelte.spec.ts`

**Interfaces:**
- Consumes: `Ring.id` (Task 1).
- Produces: `keyframes.deleteTracksForRing(ringId: string): void`; `removeRing(index: number): void` exported from `src/lib/state/animation` (orchestrated: composition delete + track cleanup + preview refresh).

- [ ] **Step 1: Write the failing test for `deleteTracksForRing`**

Add to `src/lib/state/keyframes.svelte.spec.ts`:

```ts
	it('deleteTracksForRing removes every track for that ring id only', () => {
		keyframes.ensureTrack('ring.aaa.morphT');
		keyframes.ensureTrack('ring.aaa.wave.crests');
		keyframes.ensureTrack('ring.bbb.morphT');
		keyframes.ensureTrack('kaleidoscope.globalRotation');

		keyframes.deleteTracksForRing('aaa');

		expect(keyframes.tracks['ring.aaa.morphT']).toBeUndefined();
		expect(keyframes.tracks['ring.aaa.wave.crests']).toBeUndefined();
		expect(keyframes.tracks['ring.bbb.morphT']).toBeDefined();
		expect(keyframes.tracks['kaleidoscope.globalRotation']).toBeDefined();
	});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test:unit -- run src/lib/state/keyframes.svelte.spec.ts`
Expected: FAIL — `deleteTracksForRing` is not a function.

- [ ] **Step 3: Implement `deleteTracksForRing`**

In `src/lib/state/keyframes.svelte.ts`, add the method to the `keyframes` object next to `deleteTrack` (after line 65):

```ts
		deleteTracksForRing(ringId: string) {
			const prefix = `ring.${ringId}.`;
			for (const key of Object.keys(state.tracks)) {
				if (key.startsWith(prefix)) delete state.tracks[key];
			}
		},
```

- [ ] **Step 4: Run it to verify it passes**

Run: `bun run test:unit -- run src/lib/state/keyframes.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing test for orchestrated `removeRing`**

Add a new block to `src/lib/state/animation.svelte.spec.ts`:

```ts
describe('removeRing also deletes the ring tracks', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('drops the removed ring tracks and leaves siblings intact', async () => {
		const animation = await import('./animation');
		const { keyframes } = await import('./keyframes.svelte');
		const { composition } = await import('./composition-persistence.svelte');

		const victim = composition.rings[0].id;
		const survivor = composition.rings[1].id;
		keyframes.ensureTrack(`ring.${victim}.morphT`);
		keyframes.ensureTrack(`ring.${survivor}.morphT`);

		animation.removeRing(0);

		expect(keyframes.tracks[`ring.${victim}.morphT`]).toBeUndefined();
		expect(keyframes.tracks[`ring.${survivor}.morphT`]).toBeDefined();
		expect(composition.rings.some((r) => r.id === victim)).toBe(false);
	});
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `bun run test:unit -- run src/lib/state/animation.svelte.spec.ts -t "removeRing also deletes"`
Expected: FAIL — `animation.removeRing` is not exported.

- [ ] **Step 7: Add the orchestrated `removeRing` to animation.svelte.ts**

In `src/lib/state/animation.svelte.ts`, import composition's `removeRing` under an alias. Find the existing import block from `./composition` (the one bringing in `createRingMorphTarget`, `removeRingMorphTarget`, `setRingMorphT`, etc.) and add:

```ts
	removeRing as removeRingFromComposition,
```

Then add the wrapper next to `removeRingMorph` (after line 529):

```ts
/**
 * Delete a ring AND its keyframe tracks. composition.ts stays pure geometry; the
 * "tracks die with the ring" policy lives here, where keyframe state is reachable.
 * Tracks key off the stable ring id, so siblings (whose indices shift) are untouched.
 */
export function removeRing(index: number): void {
	const ring = composition.rings[index];
	removeRingFromComposition(index);
	if (ring) keyframes.deleteTracksForRing(ring.id);
	refreshPreview();
}
```

- [ ] **Step 8: Repoint RingEditor to the orchestrated `removeRing`**

In `src/lib/components/RingEditor.svelte`, the import block (lines 9-16) currently pulls `removeRing` from `$lib/state/composition`. Remove `removeRing` from that import and add it to the existing `$lib/state/animation` import (the one that already brings in `createRingMorph` / `removeRingMorph` — confirm by searching the file's `<script>` imports). The call site `onclick={() => removeRing(index)}` at line 144 stays unchanged.

If RingEditor does not yet import from `$lib/state/animation`, add:

```ts
	import { removeRing } from '$lib/state/animation';
```

and delete `removeRing` from the `$lib/state/composition` import list.

- [ ] **Step 9: Run the autofixer on the changed component**

Load the tool via ToolSearch `select:mcp__svelte__svelte-autofixer`, then run it on the full text of `src/lib/components/RingEditor.svelte`. Apply fixes until `issues: []` (ignore the known false-positive *suggestions* noted in Global Constraints).

- [ ] **Step 10: Run the affected specs + types**

Run: `bun run test:unit -- run src/lib/state/keyframes.svelte.spec.ts src/lib/state/animation.svelte.spec.ts`
Expected: PASS.
Run: `bun run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 11: Commit**

```bash
git add src/lib/state/keyframes.svelte.ts src/lib/state/keyframes.svelte.spec.ts src/lib/state/animation.svelte.ts src/lib/state/animation.svelte.spec.ts src/lib/components/RingEditor.svelte
git commit -m "feat(rings): delete a ring's keyframe tracks when the ring is removed

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Abandon legacy index-keyed keyframe data (fresh persist key)

**Files:**
- Modify: `src/lib/state/keyframes.svelte.ts:17` (`PERSIST_KEY`)

**Interfaces:**
- Consumes: nothing new.
- Produces: keyframes now persist under `'bettona-keyframes'`; old `'kaleidoscope-keyframes'` (index-keyed `ring.N.*`) data is no longer read. User confirmed all saved data is test material — intentional one-time reset, no migration.

- [ ] **Step 1: Change the persist key**

In `src/lib/state/keyframes.svelte.ts`, line 17, rename the constant value (the variable name stays `PERSIST_KEY`):

```ts
const PERSIST_KEY = 'bettona-keyframes';
```

Add a one-line comment above it explaining the reset:

```ts
// Renamed from the legacy 'kaleidoscope-keyframes' key: tracks now key off stable
// ring ids (ring.<id>.*), so the old index-keyed (ring.N.*) data is abandoned by
// design rather than migrated.
const PERSIST_KEY = 'bettona-keyframes';
```

- [ ] **Step 2: Verify types + the keyframes persistence behaviour still green**

Run: `bun run check`
Expected: 0 errors, 0 warnings.
Run: `bun run test:unit -- run src/lib/state/keyframes.svelte.spec.ts`
Expected: PASS (this task changes only the storage key string; in-memory behaviour is unchanged, so the existing suite covers it).

- [ ] **Step 3: Commit**

```bash
git add src/lib/state/keyframes.svelte.ts
git commit -m "chore(keyframes): move to bettona-keyframes key, abandon legacy index-keyed data

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Key `{#each composition.rings}` blocks by `ring.id`

**Files:**
- Modify: `src/lib/components/SimpleSection.svelte:18`
- Modify: `src/lib/components/AudioBarsSection.svelte:112`
- Modify: `src/lib/components/AudioZonesSection.svelte:110`
- Modify: `src/routes/(app)/editor/+page.svelte:53`
- Modify: `src/lib/components/ApplyToRingSheet.svelte:69`

**Interfaces:**
- Consumes: `Ring.id` (Task 1). No new exports.

- [ ] **Step 1: Switch each ring loop key from index to id**

In each file, change the `{#each}` key expression from `(i)` to `(ring.id)` (use the loop's actual item name). Concretely:

`SimpleSection.svelte:18`, `AudioBarsSection.svelte:112`, `AudioZonesSection.svelte:110`, `editor/+page.svelte:53` — each reads:

```svelte
{#each composition.rings as ring, i (i)}
```

becomes:

```svelte
{#each composition.rings as ring, i (ring.id)}
```

`ApplyToRingSheet.svelte:69` reads `{#each rings as _ring, i (i)}` — the item is named `_ring`; rename it to `ring` and key by `ring.id`:

```svelte
{#each rings as ring, i (ring.id)}
```

(If `_ring` is unused elsewhere in that block, renaming to `ring` is safe; if the block references `_ring`, update those references too. The leading underscore only signified "unused".)

- [ ] **Step 2: Run the autofixer on each changed `.svelte`**

For each of the 5 files, run the Svelte MCP `svelte-autofixer` on the full file text; apply fixes until `issues: []` (ignore known false-positive suggestions).

- [ ] **Step 3: Verify types + the related component specs**

Run: `bun run check`
Expected: 0 errors, 0 warnings.
Run: `bun run test:unit -- run src/lib/components/AudioBarsSection.svelte.spec.ts src/lib/components/AudioZonesSection.svelte.spec.ts src/lib/components/ApplyToRingSheet.svelte.spec.ts src/lib/components/SimpleSection.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/SimpleSection.svelte src/lib/components/AudioBarsSection.svelte src/lib/components/AudioZonesSection.svelte "src/routes/(app)/editor/+page.svelte" src/lib/components/ApplyToRingSheet.svelte
git commit -m "fix(rings): key ring {#each} blocks by ring.id so component state follows the ring

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Final verification (after all tasks)

- [ ] **Full unit suite**

Run: `bun run test:unit -- run`
Expected: all green (≥ 482 prior tests + the new ones). If the first run flakes a single paraglide-dependent test, RERUN once (known race).

- [ ] **Types**

Run: `bun run check`
Expected: 0 errors, 0 warnings.

- [ ] **e2e smoke**

Run: `bunx playwright test`
Expected: 6/6 (pre-existing harmless `"file" is not a known CSS property` warning is fine).

- [ ] **Manual browser pass (dev :5174)**

`bun run dev`, then in the editor: create a morph on a middle ring, delete the ring above it, confirm the morph animation stays on the right ring and no orphan/ghost track remains; reorder is not yet wired to UI so no manual reorder check needed.

---

## Notes for the implementer

- **Why index stays on setters:** `updateRing(index)`, `setRingMorphT(index)`, `setRingWave(index)`, `setRingZoneDrive(index)` act on the live array in the same tick — index is correct there. Only *persisted* keys (param ids, track keys) move to `ring.id`. Don't "finish the job" by converting setters to id; that's a larger, unrequested change and out of scope.
- **`reorderRings` is intentionally untouched** — it has no UI caller yet, and id-keyed tracks make it safe for free. No code needed.
- **Test helper fallout:** any spec that builds a `Ring` literal will now fail `bun run check` without an `id`. Add `id: '<something>'` to those literals in the same task that surfaces them (Task 1 Step 12 is the first place this bites).
