# Per-Ring Static Rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a static per-ring rotation offset (authored, persistent) that rigidly turns one ring's whole assembly so rings can be staggered.

**Architecture:** Store `rotation` on `Ring` as a fraction of one sector (`0..1`). In `buildRingPath`, add `rotation * fullCopyAngle` as a constant angular offset to every tiled copy — `buildOneCopy` already rotates anchors+handles about the origin, so the whole ring turns rigidly. Mirror/half-arc/seam logic untouched (wave taper depends on it). UI is a Label+Slider in `RingEditor`, mirroring the existing "Ring height" control.

**Tech Stack:** TypeScript, SvelteKit (Svelte 5 runes), paper.js, vitest, bun, shadcn/svelte.

---

## File Structure

- `src/lib/types.ts` — add optional `rotation?: number` to `Ring`.
- `src/lib/geometry/bend.ts` — apply the rotation offset in the tile loop of `buildRingPath`.
- `src/lib/components/RingEditor.svelte` — add the Rotation slider after Ring height.
- `src/lib/geometry/bend.svelte.spec.ts` — add one rotation test (set-equality driver + invariant guard).

Unchanged on purpose (backward-compat / authored-config proofs):
- `src/lib/state/composition.ts` (`DEFAULT_RING`) and `src/lib/state/default.ts` (`DEFAULT_COMPOSITION`).
- `src/lib/state/composition-persistence.svelte.ts` (`stripTransients` strips only `wave` + `zoneDrive`).

---

## Task 1: Type + geometry (TDD)

**Files:**
- Modify: `src/lib/types.ts:22-33` (the `Ring` type)
- Modify: `src/lib/geometry/bend.ts:81-88` (tile loop in `buildRingPath`)
- Test: `src/lib/geometry/bend.svelte.spec.ts` (add one `it` block inside the existing `describe('buildRingPath', ...)`)

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `describe('buildRingPath', () => { ... })` block in `src/lib/geometry/bend.svelte.spec.ts`, after the `produces 4-fold rotational symmetry` test:

```ts
it('rotation=0.5 rigidly turns the whole ring by half a sector', () => {
	const radius = 100;
	const copies = 4;
	const ring0 = baseRing({ copies });
	const ringHalf = baseRing({ copies, rotation: 0.5 });

	const path0 = buildRingPath(ring0, radius, scope);
	const pathHalf = buildRingPath(ringHalf, radius, scope);
	expect(path0).not.toBeNull();
	expect(pathHalf).not.toBeNull();

	const origin = new paper.Point(0, 0);

	// Invariant guard: rigid rotation about origin preserves the (symmetric)
	// bounding-box centre and the total arc length.
	expect(path0!.bounds.center.x).toBeCloseTo(0, 3);
	expect(path0!.bounds.center.y).toBeCloseTo(0, 3);
	expect(pathHalf!.bounds.center.x).toBeCloseTo(0, 3);
	expect(pathHalf!.bounds.center.y).toBeCloseTo(0, 3);
	expect(pathHalf!.length).toBeCloseTo(path0!.length, 3);

	// Discriminating check (order-independent): every rotation=0.5 anchor equals
	// some rotation=0 anchor rotated by 180/copies degrees ( = PI/copies rad )
	// about the origin. Half a sector is never a rotational symmetry of the ring,
	// so this fails when rotation is ignored and passes once it is applied.
	const deg = 180 / copies; // 45° for copies=4
	const anchors0 = path0!.segments.map((s) => s.point);
	const anchorsHalf = pathHalf!.segments.map((s) => s.point);
	expect(anchorsHalf.length).toBe(anchors0.length);

	for (const ph of anchorsHalf) {
		const matched = anchors0.some((p0) => {
			const r = p0.rotate(deg, origin);
			return Math.abs(r.x - ph.x) < 1e-6 && Math.abs(r.y - ph.y) < 1e-6;
		});
		expect(matched).toBe(true);
	}
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `bun x vitest run src/lib/geometry/bend.svelte.spec.ts`
Expected: FAIL. Either a TypeScript error that `rotation` is not in `Ring`, and/or the set-equality `expect(matched).toBe(true)` failing because the unrotated ring's anchors do not match the half-sector-rotated set.

- [ ] **Step 3: Add the type field**

In `src/lib/types.ts`, add the field to the `Ring` type immediately after `ringHeight: number;`:

```ts
	ringHeight: number;
	rotation?: number; // 0..1, fraction of one full sector. absent/undefined = 0 = today's behavior
```

- [ ] **Step 4: Apply the rotation offset in the geometry**

In `src/lib/geometry/bend.ts`, the tile loop currently reads:

```ts
	// Tile all copies
	const fullCopyAngle = (2 * Math.PI) / ring.copies;
	const allSegments: paper.Segment[] = [];

	for (let k = 0; k < ring.copies; k++) {
		const copySegs = buildOneCopy(k * fullCopyAngle);
		allSegments.push(...copySegs);
	}
```

Change it to add the per-ring offset (fraction of a sector → radians via `fullCopyAngle`), identical for every copy `k`:

```ts
	// Tile all copies
	const fullCopyAngle = (2 * Math.PI) / ring.copies;
	const ringRotation = (ring.rotation ?? 0) * fullCopyAngle;
	const allSegments: paper.Segment[] = [];

	for (let k = 0; k < ring.copies; k++) {
		const copySegs = buildOneCopy(k * fullCopyAngle + ringRotation);
		allSegments.push(...copySegs);
	}
```

Do NOT change `buildHalfArc`, `buildOneCopy`'s internal rotation math, the mirror, or the seam handling.

- [ ] **Step 5: Run the test, verify it passes**

Run: `bun x vitest run src/lib/geometry/bend.svelte.spec.ts`
Expected: PASS (all tests in the file, including the new one and the existing symmetry/range tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/geometry/bend.ts src/lib/geometry/bend.svelte.spec.ts
git commit -m "feat: add per-ring static rotation to kaleidoscope geometry

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Rotation slider in RingEditor

**Files:**
- Modify: `src/lib/components/RingEditor.svelte:321-334` (insert directly after the "Ring height" block, before the `{#if colorMode.mode === 'manual'}` block)

No unit test (UI control wired to existing `updateRing`); verified manually in Task 3.

- [ ] **Step 1: Add the Rotation control**

In `src/lib/components/RingEditor.svelte`, the existing Ring height block is:

```svelte
			<div class="flex flex-col gap-2">
				<Label class="text-xs"
					>Ring height <span class="text-muted-foreground">{ring.ringHeight.toFixed(2)}</span
					></Label
				>
				<Slider
					type="single"
					min={0}
					max={1}
					step={0.01}
					value={ring.ringHeight}
					onValueChange={(v) => updateRing(index, { ringHeight: v })}
				/>
			</div>
```

Insert this new block immediately after that closing `</div>` (and before `{#if colorMode.mode === 'manual'}`). The label shows degrees for readability and guards against a transient `copies=0` with `|| 1`:

```svelte
			<div class="flex flex-col gap-2">
				<Label class="text-xs"
					>Rotation <span class="text-muted-foreground"
						>{(((ring.rotation ?? 0) * 360) / (ring.copies || 1)).toFixed(0)}°</span
					></Label
				>
				<Slider
					type="single"
					min={0}
					max={1}
					step={0.01}
					value={ring.rotation ?? 0}
					onValueChange={(v) => updateRing(index, { rotation: v })}
				/>
			</div>
```

- [ ] **Step 2: Run the Svelte autofixer**

Per project CLAUDE.md, run the `svelte-autofixer` MCP tool on the edited `RingEditor.svelte` content. Keep applying its suggestions and re-running until it returns no issues.

- [ ] **Step 3: Typecheck**

Run: `bun run check`
Expected: no new errors related to `RingEditor.svelte` or `rotation`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/RingEditor.svelte
git commit -m "feat: add per-ring rotation slider to RingEditor

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Verify end-to-end and backward-compat

**Files:** none modified. Verification only.

- [ ] **Step 1: Confirm defaults + persistence untouched**

Run: `git diff --name-only main -- src/lib/state/composition.ts src/lib/state/default.ts src/lib/state/composition-persistence.svelte.ts`
Expected: empty output (none of these files changed). This proves `DEFAULT_RING`/`DEFAULT_COMPOSITION` are byte-identical and `stripTransients` was not touched, so `rotation` persists as authored config and the default mark is unchanged.

- [ ] **Step 2: Full unit test run**

Run: `bun run test:unit -- --run`
Expected: PASS, no regressions.

- [ ] **Step 3: Manual verification**

Run: `bun dev`. With the default composition:
- Expand Ring 2 and drag the Rotation slider to ~`0.5` (label shows ~`22°` at `copies: 8`). Confirm ONLY that ring turns — staggering against the others — while the petal shape and audio-reactive behavior are unchanged.
- Set it back to `0`. Confirm the mark is visually identical to before.

Report what you see.

---

## Notes / Constraints

- Do NOT touch `wave.ts`, `zones.ts`, the audio drivers, or morph interpolation.
- A ring with `rotation` absent or `0` MUST render identical to today (covered by leaving defaults untouched and the `?? 0` fallback).
- Do NOT implement global (composition-level) rotation or tiling — separate later tasks.
