# Editor & Animate Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three bugs on the editor/animate surfaces: kaleidoscope canvas stretches on aspect-ratio change, path-editor curves blocked when a morph target exists, and the timeline ruler misaligned with keyframe lanes.

**Architecture:** Three independent, narrowly-scoped fixes. Bug 1 syncs the canvas inline CSS size with the aspect ratio in the kaleidoscope resize effect (`preview-presenter`). Bug 2 relaxes `updateRingPathVariant` to re-seed the secondary path on a structural primary edit (stopgap; the real fix is the later morph refactor). Bug 3 moves the per-track "+" button out of the lane flow in `TimelineTrack` so ruler and track lanes share an offset.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript, paper.js, Vitest (unit + `vitest/browser` component tests), Playwright (e2e), bun.

## Global Constraints

- Package manager is **bun**. Single spec: `bun run test:unit -- run <path>`. Full unit suite: `bun run test:unit -- run`. Types: `bun run check`.
- Tab indentation (not spaces).
- Every touched `.svelte` / `.svelte.ts` MUST pass svelte-autofixer with `issues: []` (ignore known false-positive *suggestions* only).
- Component tests run in a real browser (`vitest/browser`); Tailwind is NOT loaded in the test DOM, so assert structure/testid/ARIA/text and computed geometry — never Tailwind class visual effects.
- Component specs that assert English UI text must call `switchLocale('en')` in `beforeEach` (locale singleton leaks across specs).
- Commit trailer on every commit: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- `bun run lint` is pre-existing RED — NOT a gate. Do NOT run `prettier --write .`.
- Spec: `docs/superpowers/specs/2026-06-22-editor-animate-bugfixes-design.md`.

---

### Task 1: Bug 1 — Kaleidoscope canvas stretches on aspect-ratio change

**Files:**
- Modify: `src/lib/components/preview-presenter.svelte.ts` (kaleidoscope resize effect, ~`:218-229`)
- Test: `src/lib/components/PreviewCanvas.svelte.spec.ts`

**Interfaces:**
- Consumes: `ratioToCanvasSize(ratio, longSide)` from `$lib/geometry/aspect-ratio` (already imported); `composition.aspectRatio`; `kaleidoscope.enabled`; module constant `CANVAS_LONG_SIDE = 600`.
- Produces: no new exports. Behavioral guarantee: while `kaleidoscope.enabled`, the visible canvas's inline `style.width`/`style.height` (CSS px) track `ratioToCanvasSize(composition.aspectRatio, CANVAS_LONG_SIDE)`.

Root cause: paper.js `_setElementSize` sets the canvas inline `style.width/height` at setup on hi-DPI displays; the kaleidoscope resize effect updates only the pixel buffer, leaving the inline style at the old square size → the new buffer is squashed into the old display box.

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `describe('PreviewCanvas.svelte', ...)` block in `src/lib/components/PreviewCanvas.svelte.spec.ts`. It imports `setAspectRatio` from composition (add to the existing `$lib/state/composition` import) and uses the already-imported `setKaleidoscopeEnabled`.

```ts
it('keeps the canvas CSS box in the aspect ratio under kaleidoscope mode (no stretch)', async () => {
	setKaleidoscopeEnabled(true);
	setAspectRatio('16:9');
	try {
		render(PreviewCanvas);
		await vi.waitFor(() => {
			const canvas = document.querySelector('canvas') as HTMLCanvasElement;
			expect(canvas).toBeTruthy();
			const w = parseFloat(canvas.style.width);
			const h = parseFloat(canvas.style.height);
			expect(w).toBeGreaterThan(0);
			expect(h).toBeGreaterThan(0);
			expect(w / h).toBeCloseTo(16 / 9, 1);
		});
	} finally {
		setKaleidoscopeEnabled(false);
		setAspectRatio('1:1');
	}
});
```

Update the composition import at the top of the file:

```ts
import { composition, colorMode, setAspectRatio } from '$lib/state/composition';
```

And the kaleidoscope import already exists:

```ts
import { setKaleidoscopeEnabled } from '$lib/state/kaleidoscope.svelte';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/components/PreviewCanvas.svelte.spec.ts`
Expected: FAIL — the new test errors on `w / h` (style.width/height unset → `NaN`), other tests pass.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/components/preview-presenter.svelte.ts`, find the kaleidoscope resize effect (the `$effect` that starts with `if (!kaleidoscope.enabled) return;` and computes `ratioToCanvasSize(composition.aspectRatio, CANVAS_LONG_SIDE)`). Replace its canvas-resize block with one that also syncs the inline CSS size:

```ts
			const { width, height } = ratioToCanvasSize(composition.aspectRatio, CANVAS_LONG_SIDE);
			if (canvasEl) {
				if (canvasEl.width !== width || canvasEl.height !== height) {
					canvasEl.width = width;
					canvasEl.height = height;
				}
				// paper.js sets inline style.width/height at setup (hi-DPI path); the
				// kaleidoscope owns the visible canvas here, so keep the CSS box in sync
				// with the aspect ratio or the new buffer gets stretched into the old box.
				canvasEl.style.width = `${width}px`;
				canvasEl.style.height = `${height}px`;
			}
			if (!kaleidoscope.liveTile) refreshTile();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/components/PreviewCanvas.svelte.spec.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Run svelte-autofixer**

Run the Svelte MCP `svelte-autofixer` on `src/lib/components/preview-presenter.svelte.ts`. Confirm `issues: []` (ignore known false-positive *suggestions* per Global Constraints).

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/preview-presenter.svelte.ts src/lib/components/PreviewCanvas.svelte.spec.ts
git commit -m "fix(kaleidoscope): sync canvas CSS size with aspect ratio (no stretch)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 7: Live verification (manual)**

The regression is a DOM-sizing effect. After the unit test passes, confirm in a real browser: start the app, open the editor, enable kaleidoscope, then change the aspect ratio. The canvas display box must reshape to the new ratio with no stretch/squash. Document the result in the task report.

---

### Task 2: Bug 2 — Path-editor curves blocked when a morph target exists (stopgap)

**Files:**
- Modify: `src/lib/state/composition.ts` (`updateRingPathVariant`, `:187-228`, the `variant === 'primary'` branch)
- Test: `src/lib/state/composition.svelte.spec.ts`

**Interfaces:**
- Consumes: `validatePathCompatibility(primary, secondary)` from `$lib/geometry/path-morph` (already imported); `Ring['templatePath']` shape `{ cmds: string[]; crds: number[] }`.
- Produces: unchanged signature `updateRingPathVariant(index, variant, path): { ok: true } | { ok: false; reason: string }`. New behavior: a structurally incompatible **primary** edit now returns `{ ok: true }` and re-seeds `secondaryTemplatePath` from the new primary, instead of rejecting.

Root cause: when a secondary exists, every primary edit is validated for structural compatibility; default rings ship with a secondary, so handle drags that change a segment's command (straight↔curve) get rejected.

- [ ] **Step 1: Write the failing tests**

Add these two tests inside the existing `describe('composition ring morph actions', ...)` block in `src/lib/state/composition.svelte.spec.ts`:

```ts
it('updateRingPathVariant re-seeds the secondary on a structural primary edit', async () => {
	const compositionModule = await import('./composition');
	compositionModule.addRing();
	compositionModule.createRingMorphTarget(0); // secondary == primary
	// Structurally different from the default primary (['M','C','C']).
	const restructured: Path = { cmds: ['M', 'C', 'Z'], crds: [0, 0, 1, 1, 2, 2, 3, 3] };
	const result = compositionModule.updateRingPathVariant(0, 'primary', restructured);
	expect(result).toEqual({ ok: true });
	expect(compositionModule.composition.rings[0].templatePath).toEqual(restructured);
	// Secondary re-seeded as a clone of the new primary (kept morph-compatible).
	expect(compositionModule.composition.rings[0].secondaryTemplatePath).toEqual(restructured);
	expect(compositionModule.composition.rings[0].secondaryTemplatePath).not.toBe(
		compositionModule.composition.rings[0].templatePath
	);
});

it('updateRingPathVariant preserves a distinct secondary on a compatible primary edit', async () => {
	const compositionModule = await import('./composition');
	compositionModule.addRing();
	compositionModule.createRingMorphTarget(0);
	const primary = compositionModule.composition.rings[0].templatePath!;
	// Distinct but structurally compatible secondary.
	const distinctSecondary: Path = { cmds: [...primary.cmds], crds: primary.crds.map((c) => c + 5) };
	expect(compositionModule.updateRingPathVariant(0, 'secondary', distinctSecondary)).toEqual({
		ok: true
	});
	// Compatible primary edit (same structure, shifted coords).
	const editedPrimary: Path = { cmds: [...primary.cmds], crds: primary.crds.map((c) => c + 1) };
	const result = compositionModule.updateRingPathVariant(0, 'primary', editedPrimary);
	expect(result).toEqual({ ok: true });
	expect(compositionModule.composition.rings[0].templatePath).toEqual(editedPrimary);
	// The distinct secondary is untouched (only structural edits re-seed it).
	expect(compositionModule.composition.rings[0].secondaryTemplatePath).toEqual(distinctSecondary);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test:unit -- run src/lib/state/composition.svelte.spec.ts`
Expected: FAIL — the re-seed test fails because the current code returns `{ ok: false, reason: 'Path commands must match exactly to interpolate' }`. The preserve test passes (already current behavior) but is kept as a guard.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/state/composition.ts`, in `updateRingPathVariant`, replace the `variant === 'primary'` branch body with:

```ts
	if (variant === 'primary') {
		if (!path && ring.secondaryTemplatePath) {
			return { ok: false, reason: 'Primary path cannot be empty while a morph target exists' };
		}
		if (path && ring.secondaryTemplatePath) {
			const compatibility = validatePathCompatibility(path, ring.secondaryTemplatePath);
			if (!compatibility.ok) {
				// Stopgap: a structural primary edit re-seeds the secondary from the new
				// primary so the morph pair stays interpolatable, instead of rejecting the
				// edit. Proper fix relocates morph editing to Animate (spec Animate #2).
				const reseeded = { cmds: [...path.cmds], crds: [...path.crds] };
				composition.rings = composition.rings.map((r, i) =>
					i === index ? { ...r, templatePath: path, secondaryTemplatePath: reseeded } : r
				);
				return { ok: true };
			}
		}
		composition.rings = composition.rings.map((r, i) =>
			i === index ? { ...r, templatePath: path } : r
		);
		return { ok: true };
	}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test:unit -- run src/lib/state/composition.svelte.spec.ts`
Expected: PASS (all tests, including the pre-existing `rejects incompatible secondary` test — the secondary branch is unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/composition.ts src/lib/state/composition.svelte.spec.ts
git commit -m "fix(editor): allow structural primary path edits by re-seeding morph target

Stopgap for curve editing being blocked when a ring ships with a morph
target. Structural primary edits now re-seed the secondary instead of
being rejected; non-structural edits preserve a distinct secondary.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Bug 3 — Timeline ruler misaligned with keyframe lanes

**Files:**
- Modify: `src/lib/components/TimelineTrack.svelte` (header row, `:73-82`)
- Test: `src/lib/components/TimelinePanel.svelte.spec.ts`

**Interfaces:**
- Consumes: nothing new. The ruler element carries `data-testid="timeline-ruler"` (`TimelineRuler.svelte:70`); each track lane carries `data-testid="track-<paramId>"` (`TimelineTrack.svelte`).
- Produces: layout guarantee — the track lane (`track-<paramId>`) shares the same left edge and width as the ruler (`timeline-ruler`). The "+" button keeps `aria-label={m.timeline_add_keyframe()}` and `onclick={addAtPlayhead}` (existing tests depend on these).

Root cause: the ruler row is `[w-28 gutter][flex-1 lane]`; the track row is `[w-28 gutter][+ button][flex-1 lane]`. The extra "+" in the flex flow shifts and narrows the track lane relative to the ruler.

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `describe('TimelinePanel', ...)` block in `src/lib/components/TimelinePanel.svelte.spec.ts` (it runs in a real browser, so `getBoundingClientRect` reflects real layout):

```ts
it('aligns the track lane with the ruler lane (the "+" button no longer offsets it)', async () => {
	keyframes.ensureTrack('kaleidoscope.scale');
	keyframes.setTrackEnabled('kaleidoscope.scale', true);
	render(TimelinePanel);
	const ruler = (await page.getByTestId('timeline-ruler').element()) as HTMLElement;
	const lane = (await page.getByTestId('track-kaleidoscope.scale').element()) as HTMLElement;
	const r = ruler.getBoundingClientRect();
	const l = lane.getBoundingClientRect();
	expect(l.left).toBeCloseTo(r.left, 0);
	expect(l.width).toBeCloseTo(r.width, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/components/TimelinePanel.svelte.spec.ts`
Expected: FAIL — `l.left` is larger than `r.left` (offset by the "+" button + gap) and `l.width` is smaller.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/components/TimelineTrack.svelte`, replace the header markup (the `<div class="flex items-center gap-2">` containing the label `<span>`, the `+` `<Button>`, and the lane `<div bind:this={rowEl} ...>`) so the label and "+" share the fixed-width gutter and the lane is the only `flex-1` after it:

```svelte
<div class="flex items-center gap-2">
	<div class="flex w-28 shrink-0 items-center gap-1">
		<span class="flex-1 truncate text-xs text-muted-foreground">{label}</span>
		<Button
			variant="outline"
			size="sm"
			class="h-6 w-6 shrink-0 p-0"
			aria-label={m.timeline_add_keyframe()}
			onclick={addAtPlayhead}
		>
			+
		</Button>
	</div>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={rowEl}
		data-testid="track-{paramId}"
		class="relative h-8 flex-1 rounded-md bg-muted/40"
		ondblclick={onDblClick}
	>
```

Leave the rest of the track row (the `{#each kfs ...}` diamonds, the selected-keyframe overlay, and the closing tags) unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/components/TimelinePanel.svelte.spec.ts`
Expected: PASS (all tests, including the existing playhead and add-keyframe tests).

- [ ] **Step 5: Run the TimelineTrack spec too (guard the "+" button still works)**

Run: `bun run test:unit -- run src/lib/components/TimelineTrack.svelte.spec.ts`
Expected: PASS — the "Add keyframe" button is still found by aria-label and still adds at the playhead.

- [ ] **Step 6: Run svelte-autofixer**

Run the Svelte MCP `svelte-autofixer` on `src/lib/components/TimelineTrack.svelte`. Confirm `issues: []`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/TimelineTrack.svelte src/lib/components/TimelinePanel.svelte.spec.ts
git commit -m "fix(timeline): align track lanes with the ruler by moving '+' into the gutter

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Type check**

Run: `bun run check`
Expected: 0 errors.

- [ ] **Step 2: Full unit suite**

Run: `bun run test:unit -- run`
Expected: all pass (was 432 before; now higher with the new tests).

- [ ] **Step 3: e2e suite**

Run: `bunx playwright test`
Expected: all pass (6/6). Note: this builds first (`npm run build && npm run preview`, port 4173) — slow (~20-25s). The pre-existing CSS warning `"file" is not a known CSS property` is harmless noise.

- [ ] **Step 4: Report**

Summarize: gate results, the Task 1 live-verification outcome, and any deviations from the plan.

## Self-Review

**Spec coverage:**
- Spec Bug 1 (canvas stretch) → Task 1. ✓
- Spec Bug 2 (curve stopgap, re-seed secondary) → Task 2. ✓
- Spec Bug 3 (timeline alignment, move "+") → Task 3. ✓
- Spec testing notes (live verify bug 1; unit for 2 & 3; gates) → Task 1 Step 7, Tasks 2/3 tests, Task 4. ✓
- Out-of-scope items (PNG export, zones preview, morph refactor) → correctly excluded.

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to". All code shown in full. ✓

**Type consistency:** `updateRingPathVariant(index, variant, path)` signature and `{ ok }` result match across Task 2 and the existing spec. `Path` = `{ cmds: string[]; crds: number[] }` used consistently. testids `timeline-ruler` / `track-<paramId>` verified to exist. `setAspectRatio` exported from composition (`:246`). `ratioToCanvasSize`/`CANVAS_LONG_SIDE` already in scope in preview-presenter. ✓
