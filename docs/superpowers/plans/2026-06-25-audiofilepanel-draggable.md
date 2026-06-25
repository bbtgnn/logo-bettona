# AudioFilePanel → draggable seam Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AudioFilePanel the 6th adapter of the existing `draggable` action instead of hand-rolling its own pointer lifecycle, fixing a latent multi-pointer bug.

**Architecture:** The waveform canvas currently owns its full pointer lifecycle (`handlePointerDown/Move/Up` + unguarded `setPointerCapture`). The `draggable` action (`src/lib/actions/draggable.ts`) already encapsulates this exact lifecycle — pointer-id guard, best-effort capture, listener wiring — and is used by 5 other components. We move AudioFilePanel onto it via `use:draggable`, keeping only the panel-specific pixel→time math (handle hit-testing, seek) in the `onStart`/`onMove`/`onEnd` closures. The pixel math stays local because no other adapter needs it (one adapter would not justify a canvas-specific seam).

**Tech Stack:** Svelte 5 (runes), TypeScript, bun, vitest (vitest-browser-svelte in real HeadlessChrome), Svelte actions.

## Global Constraints

- Tab indentation.
- `bun run check` must end at **0 errors / 0 warnings**.
- DOM/PointerEvent specs MUST be named `*.svelte.spec.ts` (routes to chromium); plain `*.spec.ts` runs in node.
- `expect.requireAssertions: true` — every test must assert.
- Run `mcp__svelte__svelte-autofixer` on the modified `.svelte` file until `issues: []` (ignore known false-positive rAF/`$effect` *suggestions*).
- Commit trailer EXACTLY: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Do NOT run `prettier --write .` or `bun run lint` (pre-existing red, not a gate).
- No new i18n keys needed.
- Pure behavior-preserving refactor + one deliberate behavior change: a secondary pointer mid-drag is now ignored (was: corrupted the region).

## File Structure

- `src/lib/components/AudioFilePanel.svelte` — MODIFY. Remove the three manual pointer handlers + manual `setPointerCapture`; add `use:draggable` on the canvas with `onStart`/`onMove`/`onEnd` closures. Keep `canvasXToTime`, `HANDLE_HIT_PX`, `dragMode`.
- `src/lib/components/AudioFilePanel.svelte.spec.ts` — MODIFY. Add a `canvas pointer interaction` describe block: seek, end-handle drag (regression net), secondary-pointer guard (red→green).
- `src/lib/actions/draggable.ts` — UNCHANGED (reused as-is).

---

### Task 1: Characterize canvas drag behavior (regression net) + assert the multi-pointer fix

**Files:**
- Modify: `src/lib/components/AudioFilePanel.svelte.spec.ts`
- Test: same file

**Interfaces:**
- Consumes: the existing `animApi` hoisted mock (already mocks `$lib/state/animation` with `audioSource.{getDuration,getRegion,getFileName,getPeaks,seek,setRegion,...}`).
- Produces: nothing for later tasks (Task 2 consumes these tests as its gate).

**Context for the implementer (verified empirically):**
- Specs run in real HeadlessChrome; the canvas (`h-16 w-full`) gets a real layout, so `canvas.getBoundingClientRect().width > 0` after a tick. Wait for it with `vi.waitFor`.
- Hit-testing is in canvas-pixel space but both `x` and the handle positions scale by `canvasEl.width`, so dispatching `clientX = rect.left` hits the start handle (canvas-x ≈ 0) and `clientX = rect.right` hits the end handle (canvas-x ≈ width) regardless of the actual pixel width.
- With `region = {start:0, end:0}`, both handles sit at x≈0, so a middle click is a `seek`, not a handle drag.
- Current code, two pointers: `setRegion` is called once after pointer 1's move and AGAIN after pointer 2's move (count 1 → 2). The fix makes pointer 2 a no-op (count stays 1). Current code also throws an unhandled `NotFoundError` from the unguarded `setPointerCapture` on the 2nd pointer; the fix removes it.

- [ ] **Step 1: Add pointer-event helpers and the describe block**

Append this block inside `src/lib/components/AudioFilePanel.svelte.spec.ts`, after the last existing `it(...)` but still inside the top-level `describe('AudioFilePanel', () => { ... })` (i.e. before its closing `});`):

```ts
	// ── canvas pointer interaction ─────────────────────────────────────────────
	function pd(node: Element, clientX: number, pointerId: number) {
		node.dispatchEvent(
			new PointerEvent('pointerdown', { bubbles: true, pointerId, clientX })
		);
	}
	function pm(node: Element, clientX: number, pointerId: number) {
		node.dispatchEvent(
			new PointerEvent('pointermove', { bubbles: true, pointerId, clientX })
		);
	}

	async function renderLoadedCanvas(region: { start: number; end: number }) {
		animApi.audioSource.getFileName.mockReturnValue('bettona.mp3');
		animApi.audioSource.getDuration.mockReturnValue(10);
		animApi.audioSource.getRegion.mockReturnValue(region);
		render(AudioFilePanel);
		const canvas = document.querySelector('canvas') as HTMLCanvasElement;
		expect(canvas).toBeTruthy();
		await vi.waitFor(() => expect(canvas.getBoundingClientRect().width).toBeGreaterThan(0));
		return canvas;
	}

	it('seek: middle click (not near a handle) seeks', async () => {
		const canvas = await renderLoadedCanvas({ start: 0, end: 0 });
		const r = canvas.getBoundingClientRect();
		pd(canvas, r.left + r.width / 2, 1);
		expect(animApi.audioSource.seek).toHaveBeenCalled();
	});

	it('drag: pressing the end handle and moving updates the region end', async () => {
		const canvas = await renderLoadedCanvas({ start: 0, end: 10 });
		const r = canvas.getBoundingClientRect();
		pd(canvas, r.right, 1); // grab end handle
		pm(canvas, r.left + r.width / 2, 1); // drag to middle ≈ t=5
		expect(animApi.audioSource.setRegion).toHaveBeenCalled();
		const [start, end] = animApi.audioSource.setRegion.mock.calls.at(-1)!;
		expect(start).toBe(0); // start preserved
		expect(end).toBeCloseTo(5, 1); // dragged toward middle
	});

	it('guard: a secondary pointer mid-drag is ignored', async () => {
		const canvas = await renderLoadedCanvas({ start: 0, end: 10 });
		const r = canvas.getBoundingClientRect();
		pd(canvas, r.right, 1); // pointer 1 grabs end handle
		pm(canvas, r.left + r.width / 2, 1);
		const afterPointer1 = animApi.audioSource.setRegion.mock.calls.length;
		pd(canvas, r.left, 2); // pointer 2 tries the start handle
		pm(canvas, r.left + r.width / 2, 2);
		const afterPointer2 = animApi.audioSource.setRegion.mock.calls.length;
		expect(afterPointer2).toBe(afterPointer1); // pointer 2 changed nothing
	});
```

- [ ] **Step 2: Run the new tests against current (unmodified) component**

Run: `bunx vitest run src/lib/components/AudioFilePanel.svelte.spec.ts`
Expected:
- `seek: middle click ...` → PASS
- `drag: pressing the end handle ...` → PASS
- `guard: a secondary pointer mid-drag is ignored` → FAIL (`afterPointer2` is 2, expected 1), plus an unhandled `NotFoundError: ... setPointerCapture ... No active pointer`.

This is the correct red: the two characterization tests prove current behavior; the guard test is red because the hand-rolled handler has no pointer-id guard.

- [ ] **Step 3: Commit the tests**

```bash
git add src/lib/components/AudioFilePanel.svelte.spec.ts
git commit -m "$(cat <<'EOF'
test(audio): characterize waveform drag + assert multi-pointer guard

Locks current seek/region-drag behavior and adds a failing test for the
secondary-pointer corruption that switching to the draggable action fixes.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Move AudioFilePanel onto the `draggable` action

**Files:**
- Modify: `src/lib/components/AudioFilePanel.svelte`
- Test: `src/lib/components/AudioFilePanel.svelte.spec.ts` (from Task 1)

**Interfaces:**
- Consumes: `draggable` from `$lib/actions/draggable` — `Action<Element, { onStart?: (e: PointerEvent) => void; onMove: (e: PointerEvent) => void; onEnd?: (e: PointerEvent) => void }>`. It records the active pointer id, best-effort `setPointerCapture` on down, routes `pointermove` to `onMove` only for that pointer, releases + `onEnd` on up, and ignores secondary pointers while a drag is active.
- Produces: nothing for later tasks.

- [ ] **Step 1: Import the action**

In the `<script>` block of `src/lib/components/AudioFilePanel.svelte`, add the import alongside the existing imports (after the `import { m } ...` line):

```ts
	import { draggable } from '$lib/actions/draggable';
```

- [ ] **Step 2: Replace the three manual handlers with draggable closures**

Replace this block (currently lines ~122–156):

```ts
	function handlePointerDown(e: PointerEvent) {
		const duration = audioSource.getDuration();
		if (duration === 0 || !canvasEl) return;
		const rect = canvasEl.getBoundingClientRect();
		const x = ((e.clientX - rect.left) / rect.width) * canvasEl.width;
		const region = audioSource.getRegion();
		const startX = (region.start / duration) * canvasEl.width;
		const endX = (region.end / duration) * canvasEl.width;
		if (Math.abs(x - startX) <= HANDLE_HIT_PX) {
			dragMode = 'start';
		} else if (Math.abs(x - endX) <= HANDLE_HIT_PX) {
			dragMode = 'end';
		} else {
			dragMode = 'seek';
			audioSource.seek(canvasXToTime(e.clientX));
		}
		canvasEl.setPointerCapture(e.pointerId);
	}

	function handlePointerMove(e: PointerEvent) {
		if (!dragMode) return;
		const t = canvasXToTime(e.clientX);
		const region = audioSource.getRegion();
		if (dragMode === 'start') {
			audioSource.setRegion(t, region.end);
		} else if (dragMode === 'end') {
			audioSource.setRegion(region.start, t);
		} else {
			audioSource.seek(t);
		}
	}

	function handlePointerUp() {
		dragMode = null;
	}
```

with this block (note: no manual `setPointerCapture` — the action owns capture and the pointer-id guard):

```ts
	function onDragStart(e: PointerEvent) {
		const duration = audioSource.getDuration();
		if (duration === 0 || !canvasEl) return;
		const rect = canvasEl.getBoundingClientRect();
		const x = ((e.clientX - rect.left) / rect.width) * canvasEl.width;
		const region = audioSource.getRegion();
		const startX = (region.start / duration) * canvasEl.width;
		const endX = (region.end / duration) * canvasEl.width;
		if (Math.abs(x - startX) <= HANDLE_HIT_PX) {
			dragMode = 'start';
		} else if (Math.abs(x - endX) <= HANDLE_HIT_PX) {
			dragMode = 'end';
		} else {
			dragMode = 'seek';
			audioSource.seek(canvasXToTime(e.clientX));
		}
	}

	function onDragMove(e: PointerEvent) {
		if (!dragMode) return;
		const t = canvasXToTime(e.clientX);
		const region = audioSource.getRegion();
		if (dragMode === 'start') {
			audioSource.setRegion(t, region.end);
		} else if (dragMode === 'end') {
			audioSource.setRegion(region.start, t);
		} else {
			audioSource.seek(t);
		}
	}

	function onDragEnd() {
		dragMode = null;
	}
```

- [ ] **Step 3: Swap the canvas event attributes for `use:draggable`**

In the markup, change the canvas element from:

```svelte
		<canvas
			bind:this={canvasEl}
			class="h-16 w-full cursor-crosshair rounded border border-border bg-muted/30"
			onpointerdown={handlePointerDown}
			onpointermove={handlePointerMove}
			onpointerup={handlePointerUp}
		></canvas>
```

to:

```svelte
		<canvas
			bind:this={canvasEl}
			class="h-16 w-full cursor-crosshair rounded border border-border bg-muted/30"
			use:draggable={{ onStart: onDragStart, onMove: onDragMove, onEnd: onDragEnd }}
		></canvas>
```

- [ ] **Step 4: Run the autofixer on the modified component**

Load via ToolSearch `select:mcp__svelte__svelte-autofixer`, run it on `src/lib/components/AudioFilePanel.svelte`, and repeat edits until `issues: []`. Ignore known false-positive *suggestions* about rAF / state-assignment inside `$effect` (the input-level meter legitimately uses an rAF loop).

- [ ] **Step 5: Run the AudioFilePanel spec — all green, no unhandled errors**

Run: `bunx vitest run src/lib/components/AudioFilePanel.svelte.spec.ts`
Expected: all tests PASS (including `guard: a secondary pointer mid-drag is ignored`), and NO `Unhandled Errors` section (the unguarded `setPointerCapture` throw is gone).

- [ ] **Step 6: Type-check**

Run: `bun run check`
Expected: `0 errors, 0 warnings`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/AudioFilePanel.svelte
git commit -m "$(cat <<'EOF'
refactor(audio): AudioFilePanel uses the draggable action

Drops the hand-rolled pointer lifecycle and unguarded setPointerCapture for
the shared draggable action (6th adapter). Fixes a secondary pointer mid-drag
corrupting the region. Pixel->time hit-testing stays local to the panel.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Full regression pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full unit suite**

Run: `bun run test:unit -- run`
Expected: all tests pass (505 + 3 new = 508), no unhandled errors.

- [ ] **Step 2: Run e2e**

Run: `bunx playwright test`
Expected: 6/6 pass (~32s; the pre-existing harmless `"file" is not a known CSS property` warning is fine).

- [ ] **Step 3: Push**

```bash
git push origin feat/kaleidoscope
```

---

## Self-Review

**Spec coverage:**
- Reuse `draggable` as-is, no new variant → Task 2 (one adapter wouldn't justify a canvas seam; honored by keeping pixel math local). ✓
- Regression net before the swap → Task 1 (seek + end-handle drag, pass before & after). ✓
- Multi-pointer bug fix → Task 1 guard test (red) → Task 2 (green). ✓
- Remove manual `setPointerCapture` plumbing → Task 2 Step 2. ✓
- Inline execution → handled by executing-plans. ✓

**Placeholder scan:** none — all code blocks are complete and copy-paste ready.

**Type consistency:** `onDragStart`/`onDragMove`/`onDragEnd` match the `DraggableHandlers` shape (`onStart?`, `onMove`, `onEnd?`); `onDragMove` takes the `PointerEvent` it needs, `onDragEnd` takes none (allowed — `onEnd?` is optional and arg-compatible). `dragMode`, `HANDLE_HIT_PX`, `canvasXToTime` are retained unchanged. ✓
