<script lang="ts">
	import paper from 'paper';
	import type { Path } from '$lib/types';

	const EDITOR_STYLE = {
		anchor: { radius: 5, fillColor: 'white', strokeColor: 'black', strokeWidth: 1 },
		handle: { radius: 3, fillColor: '#3b82f6' }, // blue accent
		handleLine: { strokeColor: '#94a3b8', strokeWidth: 1 }, // muted
		padding: 20,
		paddingRect: { strokeColor: '#e2e8f0', strokeWidth: 1 } // very light
	};

	let {
		templatePath,
		onchange,
		label = 'Path editor'
	}: { templatePath: Path | null; onchange?: (path: Path) => void; label?: string } = $props();

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

	function emitSeg(
		from: paper.Segment,
		to: paper.Segment,
		cmds: Path['cmds'],
		crds: number[]
	): void {
		if (!from.handleOut.isZero() || !to.handleIn.isZero()) {
			const cp1 = from.point.add(from.handleOut);
			const cp2 = to.point.add(to.handleIn);
			cmds.push('C');
			crds.push(cp1.x, cp1.y, cp2.x, cp2.y, to.point.x, to.point.y);
		} else {
			cmds.push('L');
			crds.push(to.point.x, to.point.y);
		}
	}

	function paperPathToPath(pp: paper.Path): Path {
		const cmds: Path['cmds'] = [];
		const crds: number[] = [];
		const segs = pp.segments;
		if (segs.length === 0) return { cmds, crds };

		cmds.push('M');
		crds.push(segs[0].point.x, segs[0].point.y);

		for (let i = 1; i < segs.length; i++) {
			emitSeg(segs[i - 1], segs[i], cmds, crds);
		}
		if (pp.closed) {
			emitSeg(segs[segs.length - 1], segs[0], cmds, crds);
			cmds.push('Z');
		}
		return { cmds, crds };
	}

	function buildPaperPath(p: Path, s: paper.PaperScope): paper.Path {
		s.activate();
		const result = new paper.Path();
		let ci = 0;

		for (const cmd of p.cmds) {
			switch (cmd) {
				case 'M':
					result.moveTo(new paper.Point(p.crds[ci], p.crds[ci + 1]));
					ci += 2;
					break;
				case 'L':
					result.lineTo(new paper.Point(p.crds[ci], p.crds[ci + 1]));
					ci += 2;
					break;
				case 'Q':
					result.quadraticCurveTo(
						new paper.Point(p.crds[ci], p.crds[ci + 1]),
						new paper.Point(p.crds[ci + 2], p.crds[ci + 3])
					);
					ci += 4;
					break;
				case 'C':
					result.cubicCurveTo(
						new paper.Point(p.crds[ci], p.crds[ci + 1]),
						new paper.Point(p.crds[ci + 2], p.crds[ci + 3]),
						new paper.Point(p.crds[ci + 4], p.crds[ci + 5])
					);
					ci += 6;
					break;
				case 'Z':
					result.closePath();
					break;
			}
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
		// `isDragging` is non-reactive; if it stays true (e.g. lost mouseup), switching primary/secondary
		// remounts this canvas via `{#key editVariant}` in RingEditor so draw runs again.
		$effect(() => {
			if (!isDragging) {
				draw(scope, templatePath, onchange, setDragging);
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
		setDragging: (v: boolean) => void
	) {
		scope.activate();
		scope.project.clear();

		const { padding, paddingRect, anchor, handle, handleLine } = EDITOR_STYLE;
		const viewBounds = scope.view.bounds;

		// Padding rectangle
		const padRect = new paper.Path.Rectangle({
			point: [viewBounds.x + padding, viewBounds.y + padding],
			size: [viewBounds.width - padding * 2, viewBounds.height - padding * 2],
			strokeColor: new paper.Color(paddingRect.strokeColor),
			strokeWidth: paddingRect.strokeWidth,
			fillColor: null
		});
		padRect.sendToBack();

		if (!path || path.cmds.length === 0) {
			scope.view.update();
			return;
		}

		// Build the path in original coordinate space
		const paperPath = buildPaperPath(path, scope);
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

				capturedOutCircle.onMouseDown = () => {
					setDragging(true);
				};

				capturedOutCircle.onMouseDrag = (ev: paper.MouseEvent) => {
					let newViewPos = capturedOutCircle.position.add(ev.delta);
					newViewPos = clamp(newViewPos);

					const newOrigPos = group.globalToLocal(newViewPos);
					seg.handleOut = newOrigPos.subtract(seg.point);

					if (smooth && inCircle) {
						const inLen = seg.handleIn.length;
						seg.handleIn = seg.handleOut.normalize().multiply(-inLen);
					}

					syncHandleItems(segIdx);
					onchangeCb?.(paperPathToPath(paperPath));
					scope.view.update();
				};

				capturedOutCircle.onMouseUp = () => {
					setDragging(false);
				};

				capturedOutCircle.bringToFront();
			}

			if (inCircle && inLine) {
				const capturedInCircle = inCircle;

				capturedInCircle.onMouseDown = () => {
					setDragging(true);
				};

				capturedInCircle.onMouseDrag = (ev: paper.MouseEvent) => {
					let newViewPos = capturedInCircle.position.add(ev.delta);
					newViewPos = clamp(newViewPos);

					const newOrigPos = group.globalToLocal(newViewPos);
					seg.handleIn = newOrigPos.subtract(seg.point);

					if (smooth && outCircle) {
						const outLen = seg.handleOut.length;
						seg.handleOut = seg.handleIn.normalize().multiply(-outLen);
					}

					syncHandleItems(segIdx);
					onchangeCb?.(paperPathToPath(paperPath));
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

			circle.onMouseDown = () => {
				setDragging(true);
			};

			circle.onMouseDrag = (ev: paper.MouseEvent) => {
				// Compute new view-space position, clamped within padded bounds
				let newViewPos = circle.position.add(ev.delta);
				newViewPos = clamp(newViewPos);
				circle.position = newViewPos;

				// Convert back to path's local coordinate space and update segment
				const origPos = group.globalToLocal(newViewPos);
				paperPath.segments[capturedSegIdx].point = origPos;

				// Sync handle circles and lines for this anchor (handles are relative, but view positions are stale)
				syncHandleItems(capturedSegIdx);

				// Emit updated path
				onchangeCb?.(paperPathToPath(paperPath));

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

<div class="w-full aspect-square bg-muted/50 rounded border flex items-center justify-center overflow-hidden relative">
	<span class="absolute left-2 top-2 rounded bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">
		{label}
	</span>
	{#if !templatePath}
		<span class="text-xs text-muted-foreground absolute">Upload an SVG to preview</span>
	{/if}
	<canvas {@attach setupCanvas} width="200" height="200"></canvas>
</div>
