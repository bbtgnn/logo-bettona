<script lang="ts">
	import paper from 'paper';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { composition, getCompositionBackgroundColor } from '$lib/state/composition';
	import { animationState } from '$lib/state/animation';
	import { createRenderPipeline, computeRestScale } from '$lib/geometry/render-pipeline';
	import { ratioToCanvasSize } from '$lib/geometry/aspect-ratio';
	import { kaleidoscope } from '$lib/state/kaleidoscope.svelte';
	import { renderKaleidoscopeToCanvas, generateKaleidoscopeSVG } from '$lib/geometry/kaleidoscope';
	import { composeTileWithBackground } from '$lib/geometry/kaleidoscope-tile';

	let scope: paper.PaperScope;
	let canvasEl: HTMLCanvasElement;
	const renderPipeline = createRenderPipeline();

	// Offscreen square scope/canvas: renders the composition as the kaleidoscope tile.
	const TILE_PX = 600;
	let tileScope: paper.PaperScope | undefined;
	let tileCanvas: HTMLCanvasElement | undefined;
	let staticTile: HTMLCanvasElement | undefined;
	let kaleidoFrame: number | null = null;

	// Rest mark fills this fraction of the frame, leaving headroom for petals to
	// open toward the edge. Coupled with BASS_REACH (zones.ts).
	const REST_FRACTION = 0.45;
	// Longest side of the canvas in pixels; the aspect ratio sets the other side.
	const CANVAS_LONG_SIDE = 600;

	function setupCanvas(canvas: HTMLCanvasElement) {
		canvasEl = canvas;
		scope = new paper.PaperScope();
		scope.setup(canvas);

		// redraw() only writes to paper.js canvas — no $state reassignment
		$effect(() => {
			// Kaleidoscope mode owns the visible canvas via its own rAF loop; yield to it
			// so the two writers don't race (flicker) on shared canvas pixels.
			if (kaleidoscope.enabled) return;
			const comp = composition;
			// Canvas pixel size comes from the persisted aspect ratio; the render pipeline
			// applies this as the paper view size, so changing the ratio reshapes the canvas.
			const { width, height } = ratioToCanvasSize(comp.aspectRatio, CANVAS_LONG_SIDE);
			const viewport = { width, height, padding: 32 };
			// audioBars/audioZones ride the primary petal; bypass morph in the render only.
			const ignoreMorph =
				animationState.mode === 'audioBars' || animationState.mode === 'audioZones';

			if (animationState.mode === 'audioZones') {
				// Measure the rest pose (drive ignored), fix the scale with headroom,
				// then render the deformed pose at that fixed scale so opening petals
				// actually extend toward the reserved edge instead of being re-fitted away.
				const rest = renderPipeline.render({
					composition: comp,
					scope,
					ignoreMorph,
					ignoreZoneDrive: true,
					viewport
				});
				const fitScale = computeRestScale(rest.boundSide, viewport, REST_FRACTION);
				renderPipeline.render({ composition: comp, scope, ignoreMorph, viewport, fitScale });
			} else {
				renderPipeline.render({ composition: comp, scope, ignoreMorph, viewport });
			}
		});

		return () => {
			scope.project.clear();
			renderPipeline.dispose();
			// Release the offscreen tile scope created lazily for kaleidoscope mode.
			tileScope?.project.clear();
		};
	}

	function downloadSvg(svgData: string, filename: string) {
		const blob = new Blob([svgData], { type: 'image/svg+xml' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	function exportSvg() {
		// In kaleidoscope mode the visible canvas IS the kaleidoscope, so Export SVG
		// exports the kaleidoscope render; otherwise it exports the flat composition.
		if (kaleidoscope.enabled) {
			exportKaleidoscopeSvg();
			return;
		}

		if (!scope) return;
		const hasContent = scope.project.activeLayer.children.length > 0;
		if (!hasContent) return;

		scope.activate();
		const svgData = scope.project.exportSVG({ asString: true }) as string;
		downloadSvg(svgData, 'composition.svg');
	}

	function exportKaleidoscopeSvg() {
		ensureTileScope();
		renderTile();
		tileScope!.activate();
		const tileSvg = tileScope!.project.exportSVG({ asString: true }) as string;
		const size = canvasEl ? Math.min(canvasEl.width, canvasEl.height) : TILE_PX;
		downloadSvg(generateKaleidoscopeSVG(tileSvg, kaleidoscope, size), 'kaleidoscope.svg');
	}

	function ensureTileScope() {
		if (tileScope) return;
		tileCanvas = document.createElement('canvas');
		tileCanvas.width = TILE_PX;
		tileCanvas.height = TILE_PX;
		tileScope = new paper.PaperScope();
		tileScope.setup(tileCanvas);
	}

	function renderTile(): HTMLCanvasElement {
		ensureTileScope();
		const viewport = { width: TILE_PX, height: TILE_PX, padding: 32 };
		const ignoreMorph =
			animationState.mode === 'audioBars' || animationState.mode === 'audioZones';
		renderPipeline.render({ composition, scope: tileScope!, ignoreMorph, viewport });
		const bg = kaleidoscope.tileBackground ? getCompositionBackgroundColor() : null;
		return composeTileWithBackground(tileCanvas!, bg);
	}

	function refreshTile() {
		staticTile = renderTile();
	}

	function drawKaleidoscope() {
		if (!canvasEl) return;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;
		const tile = kaleidoscope.liveTile ? renderTile() : (staticTile ??= renderTile());
		const size = Math.min(canvasEl.width, canvasEl.height);
		renderKaleidoscopeToCanvas(
			ctx,
			tile,
			tile.width,
			tile.height,
			kaleidoscope,
			size,
			canvasEl.width,
			canvasEl.height
		);
	}

	$effect(() => {
		if (!kaleidoscope.enabled) {
			if (kaleidoFrame !== null) {
				cancelAnimationFrame(kaleidoFrame);
				kaleidoFrame = null;
			}
			return;
		}
		// Restart only when the tile SOURCE changes (live vs static). sectors/repeat are read
		// live inside drawKaleidoscope every frame, so they must NOT be dependencies here —
		// keyframing them would otherwise tear down and rebuild the rAF loop every frame.
		void kaleidoscope.liveTile;
		staticTile = undefined;
		const loop = () => {
			drawKaleidoscope();
			kaleidoFrame = requestAnimationFrame(loop);
		};
		kaleidoFrame = requestAnimationFrame(loop);
		return () => {
			if (kaleidoFrame !== null) {
				cancelAnimationFrame(kaleidoFrame);
				kaleidoFrame = null;
			}
		};
	});

	$effect(() => {
		// Re-snapshot the static tile on explicit refresh or when the tile background
		// toggles, so the frozen tile reflects "Sfondo tessera" without a manual refresh.
		void kaleidoscope.refreshNonce;
		void kaleidoscope.tileBackground;
		if (kaleidoscope.enabled && !kaleidoscope.liveTile) refreshTile();
	});

	$effect(() => {
		// In kaleidoscope mode the composition no longer renders to the visible canvas
		// (gated above to avoid flicker), so the canvas size and the static tile would
		// otherwise stay frozen. Keep the canvas sized to the aspect ratio and re-snapshot
		// the static tile whenever the composition or aspect changes. The tile renders to
		// the OFFSCREEN scope, so the kaleidoscope rAF loop stays the only writer of the
		// visible canvas (no flicker).
		if (!kaleidoscope.enabled) return;
		void $state.snapshot(composition); // deep-track composition edits
		const { width, height } = ratioToCanvasSize(composition.aspectRatio, CANVAS_LONG_SIDE);
		if (canvasEl && (canvasEl.width !== width || canvasEl.height !== height)) {
			canvasEl.width = width;
			canvasEl.height = height;
		}
		if (!kaleidoscope.liveTile) refreshTile();
	});
</script>

<div class="flex shrink-0 flex-col items-center gap-3">
	<canvas {@attach setupCanvas} width="600" height="600" class="rounded-lg border bg-white"
	></canvas>
	<Button variant="outline" onclick={exportSvg} class="w-full max-w-[600px]">Export SVG</Button>
</div>