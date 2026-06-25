# draggable Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the six hand-rolled pointer-capture drag implementations in the timeline UI with one `draggable` Svelte action, concentrating the capture/release/active-pointer mechanics in one place — killing the flag-vs-`hasPointerCapture` inconsistency and adding pointer-id awareness (which fixes the known multi-pointer trim bug) for free.

**Architecture:** A Svelte action `use:draggable={{ onStart?, onMove, onEnd? }}` owns the pointer lifecycle: on `pointerdown` it records the pointer id, best-effort `setPointerCapture`, and calls `onStart`; on `pointermove` it calls `onMove` only for the captured pointer; on `pointerup` it releases and calls `onEnd`. Each call site supplies the *semantic* move (read a rect, compute a time/value, mutate state) via closures; the action holds no app logic. An action (not an attachment) is used deliberately: its `update` swaps the handler closures on each render WITHOUT re-adding listeners, so the captured-drag state survives re-renders. Five of the six sites already capture on the element that acts (playhead handle, ruler, diamond, trim handles) so the action is a drop-in; the KeyframeGraphEditor captures on its container while `pointerdown` is on child points — adopting the action moves capture onto each point/handle (real pointer-capture routes moves there), which requires updating that component's spec to dispatch move/up on the point/handle element.

**Tech Stack:** SvelteKit + Svelte 5 runes + actions, TypeScript, bun, vitest (browser project for `*.svelte.spec.ts`, node for the rest).

## Global Constraints

- Package manager **bun**. Types: `bun run check` (recompiles paraglide; 0 errors / 0 warnings). Single spec: `bun run test:unit -- run <path>`. Full unit: `bun run test:unit -- run`.
- **TAB indentation** everywhere. No `prettier --write .` / `bun run lint` (pre-existing red — not a gate).
- Commit trailer EXACTLY: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Every changed `.svelte` MUST pass the Svelte MCP `svelte-autofixer` → `issues: []` (load via ToolSearch `select:mcp__svelte__svelte-autofixer`). Ignore known false-positive *suggestions* (function-call/rAF inside `$effect`, `bind:this`→attachment, the `svelte-ignore … not warned` lines already in these files).
- No new user-facing copy → no `messages/*.json` changes.
- **Test placement:** a plain `*.spec.ts` runs in the **node** env (no DOM). The action needs real DOM + `PointerEvent` + `setPointerCapture`, so its test MUST be named `draggable.svelte.spec.ts` to run in the **browser** project. Component specs already run in the browser (Tailwind inert — assert DOM/testid/role, not geometry).
- **Behaviour preservation:** each migration must keep its component's `data-testid`s and existing behaviour. The ONLY intended behavioural change is pointer-id awareness (secondary pointers ignored mid-drag) — a fix, not a regression. Where a site acted on `pointerdown` (playhead, ruler) or called `stopPropagation`, that goes into `onStart`.

---

### Task 1: The `draggable` action

**Files:**
- Create: `src/lib/actions/draggable.ts`
- Create: `src/lib/actions/draggable.svelte.spec.ts` (browser project — note the `.svelte.spec.ts` name)

**Interfaces:**
- Produces:
  - `type DraggableHandlers = { onStart?: (e: PointerEvent) => void; onMove: (e: PointerEvent) => void; onEnd?: (e: PointerEvent) => void }`
  - `const draggable: Action<Element, DraggableHandlers>` — attaches pointerdown/move/up listeners to the node; tracks one active pointer id; best-effort capture on down; calls onMove only for the active pointer; releases + onEnd on up; `update` swaps handlers, `destroy` removes listeners. Later tasks apply it via `use:draggable={{ … }}`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/actions/draggable.svelte.spec.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { draggable } from './draggable';

function mount() {
	const node = document.createElement('div');
	document.body.appendChild(node);
	return node;
}

afterEach(() => {
	document.body.innerHTML = '';
});

function down(node: Element, pointerId: number) {
	node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId }));
}
function move(node: Element, pointerId: number) {
	node.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId }));
}
function up(node: Element, pointerId: number) {
	node.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId }));
}

describe('draggable action', () => {
	it('calls onStart on pointerdown and onMove for the active pointer', () => {
		const node = mount();
		const onStart = vi.fn();
		const onMove = vi.fn();
		draggable(node, { onStart, onMove });
		down(node, 1);
		move(node, 1);
		expect(onStart).toHaveBeenCalledTimes(1);
		expect(onMove).toHaveBeenCalledTimes(1);
	});

	it('ignores pointermove before any pointerdown', () => {
		const node = mount();
		const onMove = vi.fn();
		draggable(node, { onMove });
		move(node, 1);
		expect(onMove).not.toHaveBeenCalled();
	});

	it('ignores a secondary pointer while one is active', () => {
		const node = mount();
		const onStart = vi.fn();
		const onMove = vi.fn();
		draggable(node, { onStart, onMove });
		down(node, 1);
		down(node, 2); // secondary — ignored
		move(node, 2); // not the active pointer — ignored
		move(node, 1);
		expect(onStart).toHaveBeenCalledTimes(1);
		expect(onMove).toHaveBeenCalledTimes(1);
	});

	it('calls onEnd on pointerup and stops moving afterwards', () => {
		const node = mount();
		const onMove = vi.fn();
		const onEnd = vi.fn();
		draggable(node, { onMove, onEnd });
		down(node, 1);
		up(node, 1);
		move(node, 1); // drag ended → ignored
		expect(onEnd).toHaveBeenCalledTimes(1);
		expect(onMove).not.toHaveBeenCalled();
	});

	it('destroy removes the listeners', () => {
		const node = mount();
		const onStart = vi.fn();
		const handle = draggable(node, { onStart, onMove: vi.fn() });
		handle?.destroy?.();
		down(node, 1);
		expect(onStart).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test:unit -- run src/lib/actions/draggable.svelte.spec.ts`
Expected: FAIL — cannot resolve `./draggable`.

- [ ] **Step 3: Implement the action**

Create `src/lib/actions/draggable.ts`:

```ts
import type { Action } from 'svelte/action';

export type DraggableHandlers = {
	onStart?: (e: PointerEvent) => void;
	onMove: (e: PointerEvent) => void;
	onEnd?: (e: PointerEvent) => void;
};

/**
 * Owns a drag's pointer lifecycle for one element: records the active pointer id,
 * best-effort setPointerCapture on down, routes pointermove to onMove only for that
 * pointer, releases + onEnd on up. Secondary pointers are ignored while a drag is
 * active (pointer-id awareness). The call site supplies the semantic move via the
 * handler closures; the action holds no app logic. Used as an action (not an
 * attachment) so `update` swaps the closures without re-adding listeners.
 */
export const draggable: Action<Element, DraggableHandlers> = (node, initial) => {
	let handlers = initial;
	let activePointer: number | null = null;

	function onDown(e: PointerEvent) {
		if (activePointer !== null) return; // a drag is already in progress
		activePointer = e.pointerId;
		try {
			node.setPointerCapture(e.pointerId);
		} catch {
			// Best-effort: synthetic events (and some pointer types) have no active
			// pointer to capture. The drag still works via the activePointer guard.
		}
		handlers.onStart?.(e);
	}

	function onMove(e: PointerEvent) {
		if (activePointer !== e.pointerId) return;
		handlers.onMove(e);
	}

	function onUp(e: PointerEvent) {
		if (activePointer !== e.pointerId) return;
		activePointer = null;
		if (node.hasPointerCapture(e.pointerId)) node.releasePointerCapture(e.pointerId);
		handlers.onEnd?.(e);
	}

	node.addEventListener('pointerdown', onDown as EventListener);
	node.addEventListener('pointermove', onMove as EventListener);
	node.addEventListener('pointerup', onUp as EventListener);

	return {
		update(next: DraggableHandlers) {
			handlers = next;
		},
		destroy() {
			node.removeEventListener('pointerdown', onDown as EventListener);
			node.removeEventListener('pointermove', onMove as EventListener);
			node.removeEventListener('pointerup', onUp as EventListener);
		}
	};
};
```

- [ ] **Step 4: Run it to verify it passes**

Run: `bun run test:unit -- run src/lib/actions/draggable.svelte.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Verify types**

Run: `bun run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/draggable.ts src/lib/actions/draggable.svelte.spec.ts
git commit -m "feat(actions): add draggable action (pointer capture + id-aware drag lifecycle)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: TimelineTrack adopts `draggable` (diamond + trim)

**Files:**
- Modify: `src/lib/components/TimelineTrack.svelte`
- Test: `src/lib/components/TimelineTrack.svelte.spec.ts` (existing — regression net; should pass unchanged)

**Interfaces:**
- Consumes: `draggable` (Task 1).

- [ ] **Step 1: Replace the diamond + trim handlers with `use:draggable`**

In `src/lib/components/TimelineTrack.svelte`:

Add the import:

```ts
	import { draggable } from '$lib/actions/draggable';
```

Delete the `draggingId` and `trimming` state declarations (lines 21-22) and the six handler functions `onDiamondDown`/`onDiamondMove`/`onDiamondUp`/`onTrimDown`/`onTrimMove`/`onTrimUp` (lines 50-97). The per-element actions close over the id/side, so no tracking state is needed.

On the diamond element (currently `data-testid="kf-{kf.id}"` with `onpointerdown/move/up` at lines 130-132), replace the three `onpointer*` attributes with:

```svelte
				use:draggable={{
					onStart: (e) => {
						e.stopPropagation();
						onselect?.(kf.id);
					},
					onMove: (e) => {
						if (!rowEl) return;
						const rect = rowEl.getBoundingClientRect();
						keyframes.moveKeyframe(paramId, kf.id, {
							time: timeFromX(e.clientX - rect.left, rect.width)
						});
						refreshPreview();
					}
				}}
```

On the trim-in handle (lines 158-160) replace the three `onpointer*` with:

```svelte
				use:draggable={{
					onStart: (e) => e.stopPropagation(),
					onMove: (e) => {
						if (!rowEl) return;
						const rect = rowEl.getBoundingClientRect();
						keyframes.setTrackInPoint(paramId, timeFromX(e.clientX - rect.left, rect.width));
						refreshPreview();
					}
				}}
```

On the trim-out handle (lines 173-175) replace with the same but calling `setTrackOutPoint`:

```svelte
				use:draggable={{
					onStart: (e) => e.stopPropagation(),
					onMove: (e) => {
						if (!rowEl) return;
						const rect = rowEl.getBoundingClientRect();
						keyframes.setTrackOutPoint(paramId, timeFromX(e.clientX - rect.left, rect.width));
						refreshPreview();
					}
				}}
```

(Behaviour parity: down still selects the diamond + stops propagation so the lane's double-click-to-add does not fire; move maps clientX against `rowEl`; the action releases capture on up. The removed `draggingId`/`trimming` flags were used only inside the old move guards — never for styling.)

- [ ] **Step 2: Run the autofixer**

Run `svelte-autofixer` on the full text of `TimelineTrack.svelte` until `issues: []`.

- [ ] **Step 3: Run the TimelineTrack spec + types**

Run: `bun run test:unit -- run src/lib/components/TimelineTrack.svelte.spec.ts`
Expected: PASS — including the diamond-drag test (dispatches pointer events on the `kf-…` element) and the trim drag test (dispatches on the `trim-in-…` handle). Both elements now host the action, so the same dispatch targets still reach it.
Run: `bun run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/TimelineTrack.svelte
git commit -m "refactor(timeline): TimelineTrack diamond + trim use the draggable action

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: TimelinePanel playhead adopts `draggable`

**Files:**
- Modify: `src/lib/components/TimelinePanel.svelte`
- Test: `src/lib/components/TimelinePanel.svelte.spec.ts` (existing — regression net)

**Interfaces:**
- Consumes: `draggable` (Task 1).

- [ ] **Step 1: Replace the playhead handlers with `use:draggable`**

In `src/lib/components/TimelinePanel.svelte`:

Add the import:

```ts
	import { draggable } from '$lib/actions/draggable';
```

Delete the `scrubbingPlayhead` flag (line 120) and the three functions `onPlayheadPointerDown`/`onPlayheadPointerMove`/`onPlayheadPointerUp` (lines 127-145). Keep `playheadTimeFromClientX` (lines 121-126) — it is reused by the action's handlers.

On the `playhead-handle` element (lines 361-366), replace the three `onpointer*` attributes with:

```svelte
						use:draggable={{
							onStart: (e) => {
								e.stopPropagation();
								scrubTo(playheadTimeFromClientX(e.clientX, e.shiftKey));
							},
							onMove: (e) => scrubTo(playheadTimeFromClientX(e.clientX, e.shiftKey))
						}}
```

(Behaviour parity: down scrubs immediately + stops propagation; move scrubs against the lane column via the kept `playheadTimeFromClientX`; Shift-snap is inside that helper; the action releases capture on up. `scrubbingPlayhead` was only a move guard — the action's active-pointer state replaces it.)

- [ ] **Step 2: Run the autofixer**

Run `svelte-autofixer` on the full text of `TimelinePanel.svelte` until `issues: []`.

- [ ] **Step 3: Run the TimelinePanel spec + types**

Run: `bun run test:unit -- run src/lib/components/TimelinePanel.svelte.spec.ts`
Expected: PASS — including "scrubs progress by dragging the playhead handle" (dispatches pointer events on `playhead-handle`, which now hosts the action).
Run: `bun run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/TimelinePanel.svelte
git commit -m "refactor(timeline): TimelinePanel playhead uses the draggable action

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: TimelineRuler scrub adopts `draggable`

**Files:**
- Modify: `src/lib/components/TimelineRuler.svelte`
- Test: `src/lib/components/TimelineRuler.svelte.spec.ts` (existing — only fires `pointerdown`, so it is a weak net; the manual browser pass covers move/up)

**Interfaces:**
- Consumes: `draggable` (Task 1).

- [ ] **Step 1: Replace the ruler handlers with `use:draggable`**

In `src/lib/components/TimelineRuler.svelte`:

Add the import:

```ts
	import { draggable } from '$lib/actions/draggable';
```

Delete the three functions `onPointerDown`/`onPointerMove`/`onPointerUp` (lines 47-63). Keep `scrubFromEvent` (the function above them, ending ~line 45) — the action calls it. On the ruler `<div>` (the element currently carrying `bind:this={rulerEl}` and `onpointerdown/move/up`), replace the three `onpointer*` attributes with:

```svelte
	use:draggable={{
		onStart: (e) => scrubFromEvent(e.clientX, e.shiftKey),
		onMove: (e) => scrubFromEvent(e.clientX, e.shiftKey)
	}}
```

Keep `bind:this={rulerEl}` — `scrubFromEvent` reads `rulerEl`'s rect. (Behaviour parity: down scrubs immediately; move scrubs while the action's pointer is active — replacing the old `hasPointerCapture` guard, which is the inconsistency this batch removes; the action releases on up. The ruler does NOT stopPropagation, matching the original.)

- [ ] **Step 2: Run the autofixer**

Run `svelte-autofixer` on the full text of `TimelineRuler.svelte` until `issues: []`.

- [ ] **Step 3: Run the TimelineRuler spec + types**

Run: `bun run test:unit -- run src/lib/components/TimelineRuler.svelte.spec.ts`
Expected: PASS — the `pointerdown`-driven scrub assertion still holds (down calls `scrubFromEvent` via `onStart`).
Run: `bun run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/TimelineRuler.svelte
git commit -m "refactor(timeline): TimelineRuler scrub uses the draggable action

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: KeyframeGraphEditor adopts `draggable` (point + handle) + spec topology update

**Files:**
- Modify: `src/lib/components/KeyframeGraphEditor.svelte`
- Modify: `src/lib/components/KeyframeGraphEditor.svelte.spec.ts` (dispatch move/up on the point/handle element, not the svg container)

**Interfaces:**
- Consumes: `draggable` (Task 1).

- [ ] **Step 1: Move capture onto each point/handle**

In `src/lib/components/KeyframeGraphEditor.svelte`:

Add the import:

```ts
	import { draggable } from '$lib/actions/draggable';
```

Delete the `dragKind`/`dragId` state (lines 13-14), the `capture` helper (lines 33-39), and the four functions `onPointDown`/`onHandleDown`/`onMove`/`onUp` (lines 41-83). Remove the container `onpointermove={onMove}` / `onpointerup={onUp}` attributes from the `<svg>` (lines 104-105). The rect math (mapping a pointer event to graph coords) is inlined in each `onMove`, exactly as the old `onMove` did — `svgEl`'s actual rendered size, not the W/H viewBox units.

On the point element (`data-testid="graph-pt-{kf.id}"`, currently `onpointerdown={(e) => onPointDown(e, kf.id)}` at line 148), replace the `onpointerdown` with:

```svelte
					use:draggable={{
						onStart: (e) => e.stopPropagation(),
						onMove: (e) => {
							if (!svgEl) return;
							const rect = svgEl.getBoundingClientRect();
							keyframes.moveKeyframe(paramId, kf.id, {
								time: timeFromX(e.clientX - rect.left, rect.width),
								value: valueFromY(e.clientY - rect.top, min, max, rect.height)
							});
							refreshPreview();
						}
					}}
```

On the handle element (`data-testid="graph-handle-{kf.id}"`, currently `onpointerdown={(e) => onHandleDown(e, kf.id)}` at line 137), replace the `onpointerdown` with:

```svelte
						use:draggable={{
							onStart: (e) => e.stopPropagation(),
							onMove: (e) => {
								if (!svgEl) return;
								const kf2 = kfs.find((k) => k.id === kf.id);
								if (!kf2) return;
								const rect = svgEl.getBoundingClientRect();
								const dx = Math.max(0, Math.min(1, timeFromX(e.clientX - rect.left, rect.width) - kf2.time));
								const span = max - min || 1;
								const dy = (valueFromY(e.clientY - rect.top, min, max, rect.height) - kf2.value) / span;
								keyframes.setKeyframeHandle(paramId, kf.id, 'out', { dx, dy });
								refreshPreview();
							}
						}}
```

The capture now lives on each point/handle (real pointer-capture routes the drag's moves to that element), so the container no longer needs move/up handlers.

- [ ] **Step 2: Update the spec to the new capture topology**

In `src/lib/components/KeyframeGraphEditor.svelte.spec.ts`, the point-drag test (around lines 45-57) currently dispatches `pointermove`/`pointerup` on the `svg` container. Change those two dispatches to target the **point** element (`graph-pt-${id}`), keeping `pointerId: 1` and the same clientX/clientY:

```ts
		const pt = page.getByTestId(`graph-pt-${id}`).element() as SVGElement;
		const rect = svg.getBoundingClientRect();
		pt.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
		pt.dispatchEvent(
			new PointerEvent('pointermove', {
				bubbles: true,
				pointerId: 1,
				clientX: rect.left + rect.width * 0.75,
				clientY: rect.top + rect.height * 0.25
			})
		);
		pt.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
```

(Keep the `svg` reference only for reading `rect`. The assertion on the resulting keyframe time/value is unchanged. If a handle-drag test exists, update its move/up dispatch targets to the `graph-handle-${id}` element the same way.)

- [ ] **Step 3: Run the autofixer**

Run `svelte-autofixer` on the full text of `KeyframeGraphEditor.svelte` until `issues: []`.

- [ ] **Step 4: Run the graph spec + types**

Run: `bun run test:unit -- run src/lib/components/KeyframeGraphEditor.svelte.spec.ts`
Expected: PASS — the point drag updates time + value; the curve/point/handle render tests are unaffected.
Run: `bun run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/KeyframeGraphEditor.svelte src/lib/components/KeyframeGraphEditor.svelte.spec.ts
git commit -m "refactor(timeline): KeyframeGraphEditor point + handle use the draggable action

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Final verification (after all tasks)

- [ ] **Types:** `bun run check` → 0 errors, 0 warnings.
- [ ] **Full unit:** `bun run test:unit -- run` → all green (prior count + 5 new draggable tests). If the first run flakes a single paraglide-dependent test, RERUN once.
- [ ] **e2e:** `bunx playwright test` → 6/6.
- [ ] **Manual browser pass (dev :5174)** — the net for the ruler (weak spec) and overall feel:
  - Drag the playhead handle → time scrubs; Shift snaps to frames.
  - Drag/scrub on the ruler → time scrubs.
  - Drag a keyframe diamond in a track lane → it moves in time; the trim in/out handles shorten the track.
  - In the curve graph: drag a point (time + value) and a bezier handle (easing).
  - Each gesture should end cleanly when the pointer is released outside the element, and a second pointer mid-drag should not hijack the gesture.

## Notes for the implementer

- **Action, not attachment.** `use:draggable={{…}}` re-runs `update` (swapping the handler closures) on each render without re-adding listeners, so an in-progress drag isn't torn down by an unrelated re-render. Do not convert this to `{@attach}`.
- **The action holds no app logic.** All rect-reading / time-value math / state mutation stays in the call-site `onMove` closures. The action only owns capture + active-pointer + release.
- **Per-element capture for the graph is the deliberate change.** Old code captured on the svg container; the action captures on each point/handle. Real pointer-capture routes moves to the captured element, so this is correct — the spec dispatch targets are updated to match (Task 5 Step 2). This also fixes multi-pointer cross-talk.
- **Keep every `data-testid` and the `svelte-ignore` comments** already present on the lane/handle/ruler elements.
