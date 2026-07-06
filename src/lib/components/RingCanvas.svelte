<script lang="ts">
	import paper from 'paper';
	import type { GridOptions, Path } from '$lib/types';
	import { Slider } from '$lib/shadcn/ui/slider/index.js';
	import { Switch } from '$lib/shadcn/ui/switch/index.js';
	import { snapToGrid, constrainTo45, type Grid, type Pt } from '$lib/geometry/grid-snap';
	import { toPaperPath, fromPaperPath } from '$lib/geometry/path-codec';
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

	// --- Point transform helpers (local copy, not imported from experiments) ---

	type PointTransform = (point: paper.Point) => paper.Point;

	function clampPoint(bounds: paper.Rectangle): PointTransform {
		return function (point: paper.Point): paper.Point {
			return new paper.Point(
				Math.max(bounds.left, Math.min(point.x, bounds.right)),
				Math.max(bounds.top, Math.min(point.y, bounds.bottom))
			);
		};
	}

	// --- Helpers ---

	function getAnchorSegments(cmds: Path['cmds']): { segIdx: number; cmd: string }[] {
		const result: { segIdx: number; cmd: string }[] = [];
		let segIdx = -1;
		for (const cmd of cmds) {
			if (cmd === 'M' || cmd === 'L' || cmd === 'C' || cmd === 'Q') {
				segIdx++;
				result.push({ segIdx, cmd });
			}
			// Z: no segment
		}
		return result;
	}

	// --- Smooth node detection ---

	const SMOOTH_THRESHOLD_DEG = 0.5;

	function isSmooth(seg: paper.Segment): boolean {
		if (seg.handleIn.isZero() || seg.handleOut.isZero()) return false;
		const angle = seg.handleIn.getDirectedAngle(seg.handleOut);
		// They are anti-parallel (smooth) when the directed angle is ±180°
		return Math.abs(Math.abs(angle) - 180) < SMOOTH_THRESHOLD_DEG;
	}

	// --- Canvas setup ---

	function setupCanvas(canvas: HTMLCanvasElement) {
		// isDragging lives here — per-instance, plain let (not $state, no reactivity needed)
		let isDragging = false;
		const setDragging = (v: boolean) => {
			isDragging = v;
		};

		const scope = new paper.PaperScope();
		scope.setup(canvas);

		// Skip redraw while dragging so parent path updates do not reset Paper mid-gesture.
		// `isDragging` is non-reactive; if it stays true (e.g. lost mouseup), remounting this
		// canvas (e.g. its `templatePath` prop changes / the parent re-keys it) reruns draw.
		$effect(() => {
			const opts = gridOptions; // visible/density/snap — redraw when any change
			if (!isDragging) {
				draw(scope, templatePath, onchange, setDragging, opts);
			}
		});

		return () => {
			scope.project.clear();
		};
	}

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
				const vLine = new paper.Path([
					[x, gridTop],
					[x, gridTop + gridH]
				]);
				vLine.strokeColor = gridColor;
				vLine.strokeWidth = grid.strokeWidth;
				const y = gridTop + i * gridSpec.stepY;
				const hLine = new paper.Path([
					[gridLeft, y],
					[gridLeft + gridW, y]
				]);
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

		// Build the path in original coordinate space
		const paperPath = toPaperPath(path, scope);
		paperPath.strokeColor = new paper.Color(0, 0, 0);
		paperPath.fillColor = null;
		paperPath.strokeWidth = 1;

		// Wrap in group and fit to padded view
		const group = new paper.Group([paperPath]);
		const bounds = group.bounds;
		const available = Math.min(viewBounds.width, viewBounds.height) - padding * 2;
		const scale = available / Math.max(bounds.width, bounds.height, 1);
		group.scale(scale);
		group.position = scope.view.center;

		// Clamp bounds (view-space, inset by padding)
		const clampBounds = new paper.Rectangle(
			new paper.Point(viewBounds.x + padding, viewBounds.y + padding),
			new paper.Size(viewBounds.width - padding * 2, viewBounds.height - padding * 2)
		);
		const clamp = clampPoint(clampBounds);

		const anchorSegments = getAnchorSegments(path.cmds);

		// Build smooth-node map at draw time
		const smoothMap = new Map<number, boolean>();
		for (const { segIdx, cmd } of anchorSegments) {
			if (cmd === 'C') {
				smoothMap.set(segIdx, isSmooth(paperPath.segments[segIdx]));
			}
		}

		// Handle items per segment — used by anchor drag to sync handle visuals
		type HandleItems = {
			outCircle: paper.Path.Circle | null;
			outLine: paper.Path | null;
			inCircle: paper.Path.Circle | null;
			inLine: paper.Path | null;
		};
		const handleItems = new Map<number, HandleItems>();

		// Helper: sync all handle visual positions for a segment (call after anchor or handle moves)
		function syncHandleItems(segIdx: number) {
			const items = handleItems.get(segIdx);
			if (!items) return;
			const seg = paperPath.segments[segIdx];
			const anchorVP = group.localToGlobal(seg.point);
			if (items.outCircle && items.outLine) {
				const hvp = group.localToGlobal(seg.point.add(seg.handleOut));
				items.outCircle.position = hvp;
				items.outLine.firstSegment.point = anchorVP;
				items.outLine.lastSegment.point = hvp;
			}
			if (items.inCircle && items.inLine) {
				const hvp = group.localToGlobal(seg.point.add(seg.handleIn));
				items.inCircle.position = hvp;
				items.inLine.firstSegment.point = anchorVP;
				items.inLine.lastSegment.point = hvp;
			}
		}

		// 1. Render handle lines and handle circles for any segment with non-zero handles (behind anchors)
		for (const { segIdx } of anchorSegments) {
			const seg = paperPath.segments[segIdx];
			if (!seg) continue;

			const smooth = smoothMap.get(segIdx) ?? false;
			const anchorViewPos = group.localToGlobal(seg.point);

			// Build items first so drag handlers can cross-reference each other
			let outCircle: paper.Path.Circle | null = null;
			let outLine: paper.Path | null = null;
			let inCircle: paper.Path.Circle | null = null;
			let inLine: paper.Path | null = null;

			// Out-handle
			if (!seg.handleOut.isZero()) {
				const handleOrigPos = seg.point.add(seg.handleOut);
				const handleViewPos = group.localToGlobal(handleOrigPos);

				outLine = new paper.Path([anchorViewPos, handleViewPos]);
				outLine.strokeColor = new paper.Color(handleLine.strokeColor);
				outLine.strokeWidth = handleLine.strokeWidth;

				outCircle = new paper.Path.Circle(handleViewPos, handle.radius);
				outCircle.fillColor = new paper.Color(handle.fillColor);
				outCircle.strokeColor = null;
			}

			// In-handle
			if (!seg.handleIn.isZero()) {
				const handleOrigPos = seg.point.add(seg.handleIn);
				const handleViewPos = group.localToGlobal(handleOrigPos);

				inLine = new paper.Path([anchorViewPos, handleViewPos]);
				inLine.strokeColor = new paper.Color(handleLine.strokeColor);
				inLine.strokeWidth = handleLine.strokeWidth;

				inCircle = new paper.Path.Circle(handleViewPos, handle.radius);
				inCircle.fillColor = new paper.Color(handle.fillColor);
				inCircle.strokeColor = null;
			}

			// Register into map so anchor drag can sync these items
			handleItems.set(segIdx, { outCircle, outLine, inCircle, inLine });

			// Assign drag handlers with cross-references for smooth mirroring
			if (outCircle && outLine) {
				const capturedOutCircle = outCircle;

				let outGrab = new paper.Point(0, 0);
				capturedOutCircle.onMouseDown = (ev: paper.MouseEvent) => {
					setDragging(true);
					outGrab = capturedOutCircle.position.subtract(ev.point);
				};

				capturedOutCircle.onMouseDrag = (ev: paper.MouseEvent) => {
					// 45° origin for a handle is its anchor.
					let newViewPos = resolveDrag(ev, outGrab, group.localToGlobal(seg.point));
					newViewPos = clamp(newViewPos);

					const newOrigPos = group.globalToLocal(newViewPos);
					seg.handleOut = newOrigPos.subtract(seg.point);

					if (smooth && inCircle) {
						const inLen = seg.handleIn.length;
						seg.handleIn = seg.handleOut.normalize().multiply(-inLen);
					}

					syncHandleItems(segIdx);
					onchangeCb?.(fromPaperPath(paperPath));
					scope.view.update();
				};

				capturedOutCircle.onMouseUp = () => {
					setDragging(false);
				};

				capturedOutCircle.bringToFront();
			}

			if (inCircle && inLine) {
				const capturedInCircle = inCircle;

				let inGrab = new paper.Point(0, 0);
				capturedInCircle.onMouseDown = (ev: paper.MouseEvent) => {
					setDragging(true);
					inGrab = capturedInCircle.position.subtract(ev.point);
				};

				capturedInCircle.onMouseDrag = (ev: paper.MouseEvent) => {
					let newViewPos = resolveDrag(ev, inGrab, group.localToGlobal(seg.point));
					newViewPos = clamp(newViewPos);

					const newOrigPos = group.globalToLocal(newViewPos);
					seg.handleIn = newOrigPos.subtract(seg.point);

					if (smooth && outCircle) {
						const outLen = seg.handleOut.length;
						seg.handleOut = seg.handleIn.normalize().multiply(-outLen);
					}

					syncHandleItems(segIdx);
					onchangeCb?.(fromPaperPath(paperPath));
					scope.view.update();
				};

				capturedInCircle.onMouseUp = () => {
					setDragging(false);
				};

				capturedInCircle.bringToFront();
			}
		}

		// 2. Render anchor circles on top (all segments)
		for (const { segIdx } of anchorSegments) {
			const seg = paperPath.segments[segIdx];
			if (!seg) continue;

			// Get view-space position of this anchor
			const viewPos = group.localToGlobal(seg.point);
			const circle = new paper.Path.Circle(viewPos, anchor.radius);
			circle.fillColor = new paper.Color(anchor.fillColor);
			circle.strokeColor = new paper.Color(anchor.strokeColor);
			circle.strokeWidth = anchor.strokeWidth;

			// Capture segIdx in closure
			const capturedSegIdx = segIdx;

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

				// Convert back to path's local coordinate space and update segment
				const origPos = group.globalToLocal(newViewPos);
				paperPath.segments[capturedSegIdx].point = origPos;

				// Sync handle circles and lines for this anchor (handles are relative, but view positions are stale)
				syncHandleItems(capturedSegIdx);

				// Emit updated path
				onchangeCb?.(fromPaperPath(paperPath));

				scope.view.update();
			};

			circle.onMouseUp = () => {
				setDragging(false);
			};

			circle.bringToFront();
		}

		scope.view.update();
	}
</script>

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
