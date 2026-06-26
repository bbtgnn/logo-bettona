# Curve Editor Grid Controls & 45° Drag — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the curve editor's grid controls below the canvas as "Grid options" (Visible / Snap toggles + Density slider), persist them per custom curve, and re-task Shift from snap to a 45°-axis movement constraint.

**Architecture:** Extract pure snap/constrain geometry into `grid-snap.ts`. Make `RingCanvas` a controlled component for grid options (`gridOptions` prop + `ongridoptionschange`). Custom curves persist options on their `PathLibraryEntry`; the Editor section passes ephemeral local state.

**Tech Stack:** SvelteKit + Svelte 5 runes, TypeScript, paper.js, shadcn/svelte (Switch, Slider), paraglide i18n (en/it), Vitest (node + browser).

## Global Constraints

- Package manager: **bun**. Run `bun run check`, `bun run test:unit`.
- Test routing: pure logic → `*.spec.ts` (node); DOM/PointerEvent → `*.svelte.spec.ts` (browser).
- shadcn components live under `src/lib/shadcn/ui/`; import via `$lib/shadcn/ui/<name>/index.js`.
- Svelte components: run the Svelte MCP `svelte-autofixer` until clean before finishing a task.
- i18n: every UI string via `m.<key>()` from `$lib/paraglide/messages`; keys added to **both** `messages/en.json` and `messages/it.json`.
- Defaults (verbatim): Visible **true**, Snap **false**, density **8**. Density slider range **2–16**, step 1.
- `GridOptions = { visible: boolean; snap: boolean; density: number }`.
- Snap + Shift **combine**: apply 45° constraint first, then grid snap.
- Builtin curves are never mutated (all path-library writers guard `!builtin`).

---

### Task 1: Pure grid geometry module

**Files:**
- Create: `src/lib/geometry/grid-snap.ts`
- Test: `src/lib/geometry/grid-snap.spec.ts`

**Interfaces:**
- Produces:
  - `type Pt = { x: number; y: number }`
  - `type Grid = { left: number; top: number; stepX: number; stepY: number }`
  - `snapToGrid(p: Pt, g: Grid): Pt`
  - `constrainTo45(origin: Pt, p: Pt): Pt`

- [ ] **Step 1: Write the failing test**

`src/lib/geometry/grid-snap.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { snapToGrid, constrainTo45 } from './grid-snap';

const G = { left: 0, top: 0, stepX: 10, stepY: 10 };

describe('snapToGrid', () => {
	it('rounds to the nearest intersection', () => {
		expect(snapToGrid({ x: 13, y: 7 }, G)).toEqual({ x: 10, y: 10 });
		expect(snapToGrid({ x: 4, y: 4 }, G)).toEqual({ x: 0, y: 0 });
	});
	it('respects a grid offset and non-unit step', () => {
		expect(snapToGrid({ x: 26, y: 26 }, { left: 0, top: 0, stepX: 8, stepY: 8 })).toEqual({ x: 24, y: 24 });
		expect(snapToGrid({ x: 11, y: 11 }, { left: 5, top: 5, stepX: 10, stepY: 10 })).toEqual({ x: 15, y: 15 });
	});
});

describe('constrainTo45', () => {
	const o = { x: 0, y: 0 };
	it('snaps a near-horizontal vector to the horizontal axis', () => {
		const r = constrainTo45(o, { x: 10, y: 3 });
		expect(r.y).toBeCloseTo(0, 6);
		expect(r.x).toBeCloseTo(Math.hypot(10, 3), 6);
	});
	it('snaps a near-vertical vector to the vertical axis', () => {
		const r = constrainTo45(o, { x: 3, y: 10 });
		expect(r.x).toBeCloseTo(0, 6);
		expect(r.y).toBeCloseTo(Math.hypot(3, 10), 6);
	});
	it('keeps a 45° vector on the diagonal', () => {
		const r = constrainTo45(o, { x: 10, y: 10 });
		expect(r.x).toBeCloseTo(10, 6);
		expect(r.y).toBeCloseTo(10, 6);
	});
	it('handles the 135° diagonal', () => {
		const r = constrainTo45(o, { x: -10, y: 10 });
		expect(r.x).toBeCloseTo(-10, 6);
		expect(r.y).toBeCloseTo(10, 6);
	});
	it('preserves the vector length', () => {
		const r = constrainTo45(o, { x: 7, y: 2 });
		expect(Math.hypot(r.x, r.y)).toBeCloseTo(Math.hypot(7, 2), 6);
	});
	it('returns the origin for a zero-length vector', () => {
		expect(constrainTo45(o, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- --run grid-snap`
Expected: FAIL — cannot resolve `./grid-snap`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/geometry/grid-snap.ts`:
```ts
export type Pt = { x: number; y: number };
export type Grid = { left: number; top: number; stepX: number; stepY: number };

/** Nearest grid intersection to `p`. */
export function snapToGrid(p: Pt, g: Grid): Pt {
	return {
		x: g.left + Math.round((p.x - g.left) / g.stepX) * g.stepX,
		y: g.top + Math.round((p.y - g.top) / g.stepY) * g.stepY
	};
}

/** Constrain the vector (p - origin) to the nearest multiple of 45°, preserving its length. */
export function constrainTo45(origin: Pt, p: Pt): Pt {
	const dx = p.x - origin.x;
	const dy = p.y - origin.y;
	const len = Math.hypot(dx, dy);
	if (len === 0) return { x: origin.x, y: origin.y };
	const step = Math.PI / 4;
	const angle = Math.round(Math.atan2(dy, dx) / step) * step;
	return { x: origin.x + Math.cos(angle) * len, y: origin.y + Math.sin(angle) * len };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- --run grid-snap`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/geometry/grid-snap.ts src/lib/geometry/grid-snap.spec.ts
git commit -m "feat(tracciati): pure grid snap + 45° constrain helpers"
```

---

### Task 2: GridOptions type + per-entry persistence

**Files:**
- Modify: `src/lib/types.ts:72-80` (add `gridOptions?` to `PathLibraryEntry`; add `GridOptions` + `DEFAULT_GRID_OPTIONS`)
- Modify: `src/lib/state/path-library.ts` (add `updateEntryGridOptions`)
- Test: `src/lib/state/path-library.grid-options.svelte.spec.ts`

**Interfaces:**
- Consumes: `pathLibrary` store, `PathLibraryEntry` (from path-library / types).
- Produces:
  - `type GridOptions = { visible: boolean; snap: boolean; density: number }`
  - `const DEFAULT_GRID_OPTIONS: GridOptions` (`{ visible: true, snap: false, density: 8 }`)
  - `updateEntryGridOptions(id: string, opts: GridOptions): void`

- [ ] **Step 1: Write the failing test**

`src/lib/state/path-library.grid-options.svelte.spec.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { pathLibrary, updateEntryGridOptions } from '$lib/state/path-library';
import { DEFAULT_GRID_OPTIONS } from '$lib/types';

beforeEach(() => {
	pathLibrary.entries = [
		{ id: 'u1', name: 'Mia', createdAt: 1, path: { cmds: ['M'], crds: [0, 0] }, secondaryPath: null },
		{ id: 'builtin-0', name: 'B', createdAt: 0, path: { cmds: ['M'], crds: [0, 0] }, secondaryPath: null, builtin: true }
	];
});

describe('updateEntryGridOptions', () => {
	it('persists options on a user entry as a fresh object', () => {
		const opts = { visible: false, snap: true, density: 12 };
		updateEntryGridOptions('u1', opts);
		const e = pathLibrary.entries.find((x) => x.id === 'u1')!;
		expect(e.gridOptions).toEqual(opts);
		expect(e.gridOptions).not.toBe(opts);
	});
	it('never mutates a builtin entry', () => {
		updateEntryGridOptions('builtin-0', { visible: false, snap: true, density: 2 });
		const e = pathLibrary.entries.find((x) => x.id === 'builtin-0')!;
		expect(e.gridOptions).toBeUndefined();
	});
	it('is a no-op for unknown id', () => {
		expect(() => updateEntryGridOptions('nope', DEFAULT_GRID_OPTIONS)).not.toThrow();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- --run grid-options`
Expected: FAIL — `updateEntryGridOptions` / `DEFAULT_GRID_OPTIONS` not exported.

- [ ] **Step 3a: Add types**

In `src/lib/types.ts`, after the `PathLibraryEntry` type (around line 80) add the `gridOptions` field and the new exports:
```ts
export type PathLibraryEntry = {
	id: string;
	name: string;
	createdAt: number;
	path: Path;
	secondaryPath: Path | null;
	// Built-in default curves are author-provided and cannot be deleted by the user.
	builtin?: boolean;
	// Per-curve grid editor options; absent ⇒ DEFAULT_GRID_OPTIONS.
	gridOptions?: GridOptions;
};

export type GridOptions = { visible: boolean; snap: boolean; density: number };

export const DEFAULT_GRID_OPTIONS: GridOptions = { visible: true, snap: false, density: 8 };
```

- [ ] **Step 3b: Add the writer**

In `src/lib/state/path-library.ts`, add the import and the function (mirror `updateEntryPath`). Update the existing type import line to include `GridOptions`:
```ts
import type { GridOptions, Path, PathLibrary, PathLibraryEntry, Ring } from '$lib/types';
```
Append near `updateEntryPath`:
```ts
/** Replaces the grid options of a user entry. Builtins and unknown ids: no-op. */
export function updateEntryGridOptions(id: string, opts: GridOptions): void {
	pathLibrary.entries = pathLibrary.entries.map((e) =>
		e.id === id && !e.builtin ? { ...e, gridOptions: { ...opts } } : e
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- --run grid-options`
Expected: PASS (3 tests).

- [ ] **Step 5: Run check + commit**

Run: `bun run check`
Expected: 0 errors.
```bash
git add src/lib/types.ts src/lib/state/path-library.ts src/lib/state/path-library.grid-options.svelte.spec.ts
git commit -m "feat(tracciati): GridOptions type + updateEntryGridOptions persistence"
```

---

### Task 3: RingCanvas controlled rework (controls below, Switch toggles, 45° drag)

**Files:**
- Add component: `src/lib/shadcn/ui/switch/` (via shadcn CLI)
- Modify: `messages/en.json`, `messages/it.json` (i18n keys)
- Modify: `src/lib/components/RingCanvas.svelte` (controlled props, UI below canvas, drag mechanics)
- Modify (temp wiring so the project compiles): `src/lib/components/CustomCurveItem.svelte:141`, `src/lib/components/RingEditor.svelte:152`, `src/lib/components/RingMorphConfigItem.svelte:105`
- Test: `src/lib/components/RingCanvas.svelte.spec.ts`

**Interfaces:**
- Consumes: `snapToGrid`, `constrainTo45`, `Grid`, `Pt` (Task 1); `GridOptions`, `DEFAULT_GRID_OPTIONS` (Task 2); shadcn `Switch`, `Slider`.
- Produces: `RingCanvas` props `{ templatePath: Path | null; onchange?: (path: Path) => void; gridOptions: GridOptions; ongridoptionschange?: (opts: GridOptions) => void }`. Testids: `grid-visible-toggle`, `grid-snap-toggle`, `grid-density-slider`.

- [ ] **Step 1: Install the shadcn Switch component**

Run: `bunx shadcn-svelte@latest add switch`
Expected: creates `src/lib/shadcn/ui/switch/{switch.svelte,index.ts}`.
Verify: `ls src/lib/shadcn/ui/switch/` lists `index.ts` and `switch.svelte`. If the CLI prompts for a path, accept the existing `src/lib/shadcn/ui` alias. Confirm the export name with `grep -n "as Switch" src/lib/shadcn/ui/switch/index.ts` (shadcn-svelte exports `Root as Switch`).

- [ ] **Step 2: Add i18n keys**

In `messages/en.json`, replace the line `"tracciati_grid_snap_hint": "Hold SHIFT to snap to grid"` and ensure these keys exist (keep `tracciati_grid_density`):
```json
	"tracciati_grid_density": "Grid density",
	"tracciati_grid_options": "Grid options",
	"tracciati_grid_visible": "Visible",
	"tracciati_grid_snap": "Snap",
	"tracciati_grid_constrain_hint": "Hold SHIFT to constrain to 45°"
```
In `messages/it.json`, replace `"tracciati_grid_snap_hint": "Premi SHIFT per allineare alla griglia"` with:
```json
	"tracciati_grid_density": "Densità griglia",
	"tracciati_grid_options": "Opzioni griglia",
	"tracciati_grid_visible": "Visibile",
	"tracciati_grid_snap": "Aggancia",
	"tracciati_grid_constrain_hint": "Premi SHIFT per vincolare a 45°"
```
(Delete the old `tracciati_grid_snap_hint` key from both files.)

- [ ] **Step 3: Rework `RingCanvas.svelte`**

Replace the `<script>` top (imports + props + remove old `gridDivisions`/`GRID_MIN/MAX` internal state — keep them as constants for the slider) with:
```svelte
<script lang="ts">
	import paper from 'paper';
	import type { GridOptions, Path } from '$lib/types';
	import { Slider } from '$lib/shadcn/ui/slider/index.js';
	import { Switch } from '$lib/shadcn/ui/switch/index.js';
	import { snapToGrid, constrainTo45, type Grid, type Pt } from '$lib/geometry/grid-snap';
	import { m } from '$lib/paraglide/messages';

	const EDITOR_STYLE = {
		anchor: { radius: 6, fillColor: 'white', strokeColor: 'black', strokeWidth: 1.5 },
		handle: { radius: 4, fillColor: '#3b82f6' },
		handleLine: { strokeColor: '#94a3b8', strokeWidth: 1 },
		grid: { strokeColor: '#cbd5e1', strokeWidth: 1 },
		padding: 16,
		paddingRect: { strokeColor: '#94a3b8', strokeWidth: 1 }
	};

	const GRID_MIN = 2;
	const GRID_MAX = 16;

	let {
		templatePath,
		onchange,
		gridOptions,
		ongridoptionschange
	}: {
		templatePath: Path | null;
		onchange?: (path: Path) => void;
		gridOptions: GridOptions;
		ongridoptionschange?: (opts: GridOptions) => void;
	} = $props();
</script>
```

Keep all the existing pure helper functions unchanged: `clampPoint`, `PointTransform`, `getAnchorSegments`, `emitSeg`, `paperPathToPath`, `buildPaperPath`, `isSmooth`, `SMOOTH_THRESHOLD_DEG`.

In `setupCanvas`, make the effect depend on `gridOptions` and pass it to `draw`:
```ts
		$effect(() => {
			const opts = gridOptions; // visible/density/snap — redraw when any change
			if (!isDragging) {
				draw(scope, templatePath, onchange, setDragging, opts);
			}
		});
```

Change the `draw` signature and its grid/snap section. Replace the `draw` parameter list and the block from `const { padding, ... } = EDITOR_STYLE;` down to the end of the `if (!path ...) return;` guard with:
```ts
	function draw(
		scope: paper.PaperScope,
		path: Path | null,
		onchangeCb: ((path: Path) => void) | undefined,
		setDragging: (v: boolean) => void,
		opts: GridOptions
	) {
		scope.activate();
		scope.project.clear();

		const { padding, paddingRect, anchor, handle, handleLine, grid } = EDITOR_STYLE;
		const viewBounds = scope.view.bounds;

		const padRect = new paper.Path.Rectangle({
			point: [viewBounds.x + padding, viewBounds.y + padding],
			size: [viewBounds.width - padding * 2, viewBounds.height - padding * 2],
			strokeColor: new paper.Color(paddingRect.strokeColor),
			strokeWidth: paddingRect.strokeWidth,
			fillColor: null
		});
		padRect.sendToBack();

		// Grid geometry — used both for the (optional) visible grid and for snapping.
		const gridLeft = viewBounds.x + padding;
		const gridTop = viewBounds.y + padding;
		const gridW = viewBounds.width - padding * 2;
		const gridH = viewBounds.height - padding * 2;
		const gridSpec: Grid = {
			left: gridLeft,
			top: gridTop,
			stepX: gridW / opts.density,
			stepY: gridH / opts.density
		};

		if (opts.visible) {
			const gridColor = new paper.Color(grid.strokeColor);
			for (let i = 1; i < opts.density; i++) {
				const x = gridLeft + i * gridSpec.stepX;
				const vLine = new paper.Path([[x, gridTop], [x, gridTop + gridH]]);
				vLine.strokeColor = gridColor;
				vLine.strokeWidth = grid.strokeWidth;
				const y = gridTop + i * gridSpec.stepY;
				const hLine = new paper.Path([[gridLeft, y], [gridLeft + gridW, y]]);
				hLine.strokeColor = gridColor;
				hLine.strokeWidth = grid.strokeWidth;
			}
		}

		// paper's MouseEvent type omits `.event`; the DOM event is there at runtime.
		function shiftHeld(ev: paper.MouseEvent): boolean {
			return !!(ev as unknown as { event: MouseEvent }).event?.shiftKey;
		}
		const toPaper = (p: Pt) => new paper.Point(p.x, p.y);

		// Resolve a drag target. `grab` keeps the cursor↔element offset so the point does
		// not jump on grab. Shift constrains to 45° from `origin`; the Snap toggle snaps the
		// result to the grid. Both compose: constrain first, then snap.
		function resolveDrag(
			ev: paper.MouseEvent,
			grab: paper.Point,
			origin: paper.Point
		): paper.Point {
			let t: paper.Point = ev.point.add(grab);
			if (shiftHeld(ev)) t = toPaper(constrainTo45(origin, t));
			if (opts.snap) t = toPaper(snapToGrid(t, gridSpec));
			return t;
		}

		if (!path || path.cmds.length === 0) {
			scope.view.update();
			return;
		}
```

Now update the three drag handlers to use `resolveDrag` with a grab offset captured on mouse-down.

Out-handle (`capturedOutCircle`): replace its `onMouseDown` and the first two lines of `onMouseDrag`:
```ts
				let outGrab = new paper.Point(0, 0);
				capturedOutCircle.onMouseDown = (ev: paper.MouseEvent) => {
					setDragging(true);
					outGrab = capturedOutCircle.position.subtract(ev.point);
				};

				capturedOutCircle.onMouseDrag = (ev: paper.MouseEvent) => {
					// 45° origin for a handle is its anchor.
					let newViewPos = resolveDrag(ev, outGrab, group.localToGlobal(seg.point));
					newViewPos = clamp(newViewPos);
```
(Leave the rest of the out-handle `onMouseDrag` body unchanged.)

In-handle (`capturedInCircle`): mirror it:
```ts
				let inGrab = new paper.Point(0, 0);
				capturedInCircle.onMouseDown = (ev: paper.MouseEvent) => {
					setDragging(true);
					inGrab = capturedInCircle.position.subtract(ev.point);
				};

				capturedInCircle.onMouseDrag = (ev: paper.MouseEvent) => {
					let newViewPos = resolveDrag(ev, inGrab, group.localToGlobal(seg.point));
					newViewPos = clamp(newViewPos);
```
(Rest of the in-handle body unchanged.)

Anchor circle: capture the grab offset and the start position (45° origin for an anchor is where it started):
```ts
				let anchorGrab = new paper.Point(0, 0);
				let anchorStart = circle.position.clone();
				circle.onMouseDown = (ev: paper.MouseEvent) => {
					setDragging(true);
					anchorGrab = circle.position.subtract(ev.point);
					anchorStart = circle.position.clone();
				};

				circle.onMouseDrag = (ev: paper.MouseEvent) => {
					let newViewPos = resolveDrag(ev, anchorGrab, anchorStart);
					newViewPos = clamp(newViewPos);
					circle.position = newViewPos;
```
(Rest of the anchor `onMouseDrag` body unchanged — `group.globalToLocal`, segment update, `syncHandleItems`, emit, `scope.view.update()`.)

- [ ] **Step 4: Replace the template** (the markup after `</script>`):
```svelte
<div class="flex flex-col gap-2">
	<div
		class="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded border bg-muted/50"
	>
		{#if !templatePath}
			<span class="absolute text-xs text-muted-foreground">Upload an SVG to preview</span>
		{/if}
		<canvas {@attach setupCanvas} width="320" height="320"></canvas>
	</div>

	<div class="flex flex-col gap-1.5">
		<span class="text-[10px] font-medium text-muted-foreground">{m.tracciati_grid_options()}</span>
		<label class="flex items-center justify-between text-xs">
			<span>{m.tracciati_grid_visible()}</span>
			<Switch
				checked={gridOptions.visible}
				onCheckedChange={(v) => ongridoptionschange?.({ ...gridOptions, visible: v })}
				aria-label={m.tracciati_grid_visible()}
				data-testid="grid-visible-toggle"
			/>
		</label>
		<label class="flex items-center justify-between text-xs">
			<span>{m.tracciati_grid_snap()}</span>
			<Switch
				checked={gridOptions.snap}
				onCheckedChange={(v) => ongridoptionschange?.({ ...gridOptions, snap: v })}
				aria-label={m.tracciati_grid_snap()}
				data-testid="grid-snap-toggle"
			/>
		</label>
		<label class="flex items-center gap-2 text-xs">
			<span class="shrink-0">{m.tracciati_grid_density()}</span>
			<Slider
				type="single"
				min={GRID_MIN}
				max={GRID_MAX}
				step={1}
				value={gridOptions.density}
				onValueChange={(v) => ongridoptionschange?.({ ...gridOptions, density: v })}
				aria-label={m.tracciati_grid_density()}
				data-testid="grid-density-slider"
				class="w-full"
			/>
		</label>
		<span class="text-[10px] leading-tight text-muted-foreground">
			{m.tracciati_grid_constrain_hint()}
		</span>
	</div>
</div>
```

- [ ] **Step 5: Temp-wire callers so the project compiles**

`RingEditor.svelte` and `RingMorphConfigItem.svelte` get **final** ephemeral local state. Add near the top of each `<script>` (after existing imports):
```ts
	import { DEFAULT_GRID_OPTIONS, type GridOptions } from '$lib/types';
	let gridOptions = $state<GridOptions>({ ...DEFAULT_GRID_OPTIONS });
```
Then update each `<RingCanvas ... />` call:
- `RingEditor.svelte:152`:
```svelte
			<RingCanvas
				templatePath={ring.templatePath}
				onchange={applyPathFromEditor}
				{gridOptions}
				ongridoptionschange={(o) => (gridOptions = o)}
			/>
```
- `RingMorphConfigItem.svelte:105`:
```svelte
			<RingCanvas
				templatePath={ring.secondaryTemplatePath}
				onchange={applyPathFromEditor}
				{gridOptions}
				ongridoptionschange={(o) => (gridOptions = o)}
			/>
```
`CustomCurveItem.svelte:141` gets temporary inert wiring (real persistence in Task 4):
```svelte
			<RingCanvas templatePath={entry.path} onchange={handlePathChange} gridOptions={DEFAULT_GRID_OPTIONS} />
```
Add to `CustomCurveItem.svelte` imports: `import { DEFAULT_GRID_OPTIONS } from '$lib/types';`

- [ ] **Step 6: Run svelte-autofixer**

Use the Svelte MCP `svelte-autofixer` on `RingCanvas.svelte` (and `switch.svelte` if it reports issues). Re-run until clean. Ignore the known "function called inside $effect" suggestion for `draw` (imperative paper render, assigns no `$state`).

- [ ] **Step 7: Write the RingCanvas component test**

`src/lib/components/RingCanvas.svelte.spec.ts`:
```ts
import { page } from 'vitest/browser';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RingCanvas from './RingCanvas.svelte';
import { DEFAULT_GRID_OPTIONS } from '$lib/types';
import type { Path } from '$lib/types';

const PATH: Path = { cmds: ['M', 'L'], crds: [20, 100, 180, 100] };

describe('RingCanvas grid controls', () => {
	it('renders the visible/snap toggles and density slider', async () => {
		render(RingCanvas, { templatePath: PATH, gridOptions: DEFAULT_GRID_OPTIONS });
		await expect.element(page.getByTestId('grid-visible-toggle')).toBeInTheDocument();
		await expect.element(page.getByTestId('grid-snap-toggle')).toBeInTheDocument();
		await expect.element(page.getByTestId('grid-density-slider')).toBeInTheDocument();
	});

	it('emits a gridOptions change when the Snap toggle is clicked', async () => {
		const ongridoptionschange = vi.fn();
		render(RingCanvas, { templatePath: PATH, gridOptions: DEFAULT_GRID_OPTIONS, ongridoptionschange });
		await page.getByTestId('grid-snap-toggle').click();
		expect(ongridoptionschange).toHaveBeenCalledWith({ visible: true, snap: true, density: 8 });
	});
});
```

- [ ] **Step 8: Run check + tests**

Run: `bun run check`
Expected: 0 errors.
Run: `bun run test:unit -- --run RingCanvas RingEditor`
Expected: PASS (RingCanvas 2 tests; RingEditor stays green via `grid-density-slider`).

- [ ] **Step 9: Commit**

```bash
git add src/lib/shadcn/ui/switch messages/en.json messages/it.json src/lib/components/RingCanvas.svelte src/lib/components/RingCanvas.svelte.spec.ts src/lib/components/RingEditor.svelte src/lib/components/RingMorphConfigItem.svelte src/lib/components/CustomCurveItem.svelte
git commit -m "feat(tracciati): grid options below canvas (Visible/Snap/Density) + Shift=45° constrain"
```

---

### Task 4: Persist grid options per custom curve

**Files:**
- Modify: `src/lib/components/CustomCurveItem.svelte` (real persistence wiring)
- Test: `src/lib/components/CustomCurveItem.svelte.spec.ts` (add a persistence test)

**Interfaces:**
- Consumes: `updateEntryGridOptions` (Task 2), `DEFAULT_GRID_OPTIONS` (Task 2), `RingCanvas` props (Task 3).

- [ ] **Step 1: Write the failing test**

Append to `src/lib/components/CustomCurveItem.svelte.spec.ts` (inside the `describe('CustomCurveItem', ...)` block):
```ts
	it('persists a grid option toggle onto the entry', async () => {
		render(CustomCurveItem, { entry: ENTRY, selected: true, onselect: vi.fn() });
		await page.getByTestId('grid-snap-toggle').click();
		const e = pathLibrary.entries.find((x) => x.id === 'u1')!;
		expect(e.gridOptions).toEqual({ visible: true, snap: true, density: 8 });
	});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- --run CustomCurveItem`
Expected: FAIL — `e.gridOptions` is `undefined` (RingCanvas still wired to the constant `DEFAULT_GRID_OPTIONS` with no change handler).

- [ ] **Step 3: Wire real persistence**

In `src/lib/components/CustomCurveItem.svelte`:
- Add to imports: `import { DEFAULT_GRID_OPTIONS } from '$lib/types';` (keep) and add `updateEntryGridOptions` to the existing `$lib/state/path-library` import.
- Replace the temp RingCanvas call with:
```svelte
			<RingCanvas
				templatePath={entry.path}
				onchange={handlePathChange}
				gridOptions={entry.gridOptions ?? DEFAULT_GRID_OPTIONS}
				ongridoptionschange={(o) => updateEntryGridOptions(entry.id, o)}
			/>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- --run CustomCurveItem`
Expected: PASS (5 tests).

- [ ] **Step 5: Run svelte-autofixer**

Use the Svelte MCP `svelte-autofixer` on `CustomCurveItem.svelte` until clean.

- [ ] **Step 6: Full gate + commit**

Run: `bun run check`
Expected: 0 errors.
Run: `bun run test:unit`
Expected: all green.
```bash
git add src/lib/components/CustomCurveItem.svelte src/lib/components/CustomCurveItem.svelte.spec.ts
git commit -m "feat(tracciati): persist grid options per custom curve"
```

---

## Self-Review

**Spec coverage:**
- Move controls below canvas → Task 3 Step 4. ✓
- Visible/Snap toggles (Switch) + Density slider → Task 3 (install + template). ✓
- Shift = 45° constrain, Snap = toggle, combine → Task 1 (`constrainTo45`), Task 3 (`resolveDrag`). ✓
- Per-curve persistence + defaults → Task 2 (type/writer/defaults), Task 4 (wiring). ✓
- Editor/morph ephemeral wiring → Task 3 Step 5. ✓
- i18n keys add + remove orphan `tracciati_grid_snap_hint` → Task 3 Step 2. ✓
- Tests: grid-snap (node), path-library (node), RingCanvas + CustomCurveItem (browser), RingEditor stays green → Tasks 1,2,3,4. ✓
- Out of scope (Ring object persistence, redesign) → not implemented. ✓

**Placeholder scan:** none — every code step has concrete code.

**Type consistency:** `GridOptions`/`DEFAULT_GRID_OPTIONS` (Task 2) used identically in Tasks 3–4. `Grid`/`Pt`/`snapToGrid`/`constrainTo45` (Task 1) match `resolveDrag` usage (Task 3). `ongridoptionschange` / `gridOptions` prop names consistent across RingCanvas and all three callers. Testids (`grid-visible-toggle`, `grid-snap-toggle`, `grid-density-slider`) consistent between component and specs.

**Note for implementer:** confirm the shadcn-svelte Switch emits `onCheckedChange(checked: boolean)` and accepts `checked` (Task 3 Step 1). If the installed version differs, adjust the two `<Switch>` bindings and the RingCanvas spec accordingly.
