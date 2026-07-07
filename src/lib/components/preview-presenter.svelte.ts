import paper from 'paper';
import {
	composition,
	getCompositionBackgroundColor,
	getEffectiveCanvasProportion
} from '$lib/state/composition';
import { animationState, getExportAudioStream } from '$lib/state/animation';
import { createRenderPipeline } from '$lib/geometry/render-pipeline';
import { proportionToCanvasSize } from '$lib/geometry/aspect-ratio';
import { kaleidoscope } from '$lib/state/kaleidoscope.svelte';
import { renderKaleidoscopeToCanvas, generateKaleidoscopeSVG } from '$lib/geometry/kaleidoscope';
import { composeTileWithBackground } from '$lib/geometry/kaleidoscope-tile';
import { exportCanvasAnimation, isAnimationExportSupported } from '$lib/export/canvas-export';
import { exportStatus } from '$lib/state/export-status.svelte';

// Offscreen square tile rendered as the kaleidoscope source.
const TILE_PX = 600;
// Rest mark fills this fraction of the frame, leaving headroom for petals to open
// toward the edge. Coupled with ZONE_BASS_REACH (bend.ts), the polar-space zone push.
const REST_FRACTION = 0.45;
// Longest side of the canvas in pixels; the aspect ratio sets the other side.
const CANVAS_LONG_SIDE = 600;

/**
 * Owns the visible preview canvas: the paper.js composition render, the offscreen
 * kaleidoscope tile, the rAF kaleidoscope loop, and SVG export. The canvas has exactly
 * one writer at a time — the composition $effect yields while kaleidoscope mode runs its
 * own loop — and that arbitration, the tile-snapshot lifecycle, and the rAF lifecycle all
 * live here instead of being spread across the component's effects.
 *
 * `attach` is a Svelte attachment: pass it to `{@attach}` on the <canvas>. It wires the
 * reactive effects and returns the teardown. `exportSvg` is bound to the export button.
 */
export function createPreviewPresenter() {
	let scope: paper.PaperScope | undefined;
	let canvasEl: HTMLCanvasElement | undefined;
	let pipeline: ReturnType<typeof createRenderPipeline> | undefined;

	let tileScope: paper.PaperScope | undefined;
	let tileCanvas: HTMLCanvasElement | undefined;
	let staticTile: HTMLCanvasElement | undefined;
	let kaleidoFrame: number | null = null;
	let exportProgress = $state(0);

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
		const ignoreMorph = animationState.layers.audioBars || animationState.layers.audioZones;
		// audioZones holds a stable rest-derived scale; pass it here too so the kaleidoscope
		// tile matches the visible canvas instead of re-fitting the deformed pose.
		const restFit = animationState.layers.audioZones ? { fraction: REST_FRACTION } : undefined;
		pipeline!.render({ composition, scope: tileScope!, ignoreMorph, viewport, restFit });
		// The tile stays transparent; the kaleidoscope paints the background itself.
		return composeTileWithBackground(tileCanvas!, null);
	}

	function refreshTile() {
		staticTile = renderTile();
	}

	// Kaleidoscope render params with the carpet background sourced from the palette
	// (no longer a stored kaleidoscope field). The drawBackground getter is evaluated
	// into the spread, so the render layer reads a plain boolean.
	function kaleidoParams(overrides?: { drawBackground?: boolean }) {
		const base = { ...kaleidoscope, backgroundColor: getCompositionBackgroundColor() };
		return overrides?.drawBackground === undefined
			? base
			: { ...base, drawBackground: overrides.drawBackground };
	}

	function drawKaleidoscope() {
		if (!canvasEl) return;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;
		const tile = kaleidoscope.liveTile ? renderTile() : (staticTile ??= renderTile());
		renderKaleidoscopeToCanvas(ctx, tile, tile.width, tile.height, kaleidoParams(), {
			width: canvasEl.width,
			height: canvasEl.height
		});
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

	function downloadDataUrl(dataUrl: string, filename: string) {
		const a = document.createElement('a');
		a.href = dataUrl;
		a.download = filename;
		a.click();
	}

	function exportKaleidoscopeSvg(includeBackground: boolean) {
		ensureTileScope();
		renderTile();
		tileScope!.activate();
		const tileSvg = tileScope!.project.exportSVG({ asString: true }) as string;
		const frame = canvasEl
			? { width: canvasEl.width, height: canvasEl.height }
			: { width: TILE_PX, height: TILE_PX };
		const params = kaleidoParams({
			drawBackground: includeBackground ? kaleidoscope.drawBackground : false
		});
		downloadSvg(generateKaleidoscopeSVG(tileSvg, params, frame), 'kaleidoscope.svg');
	}

	// Records the live canvas to a WebM video for the configured duration/fps, taps the
	// audio source when one is live, and surfaces 0..1 progress while exportStatus.rendering
	// gates other controls.
	async function exportAnimation() {
		if (!canvasEl || exportStatus.rendering) return;
		const audio = getExportAudioStream();
		exportStatus.rendering = true;
		exportProgress = 0;
		try {
			await exportCanvasAnimation({
				canvas: canvasEl,
				durationSec: animationState.durationSec,
				fps: animationState.fps,
				audioStream: audio?.stream ?? null,
				onProgress: (p) => (exportProgress = p)
			});
		} finally {
			audio?.dispose();
			exportStatus.rendering = false;
		}
	}

	function exportSvg(opts?: { includeBackground?: boolean }) {
		const includeBackground = opts?.includeBackground ?? true;

		// In kaleidoscope mode the visible canvas IS the kaleidoscope, so Export SVG
		// exports the kaleidoscope render; otherwise it exports the flat composition.
		if (kaleidoscope.enabled) {
			exportKaleidoscopeSvg(includeBackground);
			return;
		}

		if (!scope) return;
		const layer = scope.project.activeLayer;
		const hasContent = layer.children.some((child) => child.name !== 'preview-background');
		if (!hasContent) return;

		scope.activate();
		// Background off: drop the tagged rect for the duration of the serialization, then
		// re-insert it at the back. Synchronous and no view.update() → the visible canvas
		// never repaints, so this cannot flicker.
		const bg = includeBackground
			? null
			: (layer.children.find((c) => c.name === 'preview-background') ?? null);
		if (bg) bg.remove();
		const svgData = scope.project.exportSVG({ asString: true }) as string;
		if (bg) {
			layer.addChild(bg);
			bg.sendToBack();
		}
		downloadSvg(svgData, 'composition.svg');
	}

	function exportPng(opts: { includeBackground: boolean; scale: number }) {
		const { includeBackground, scale } = opts;
		const p = getEffectiveCanvasProportion();
		const { width, height } = proportionToCanvasSize(p.width, p.height, CANVAS_LONG_SIDE * scale);
		const off = document.createElement('canvas');
		off.width = width;
		off.height = height;

		if (kaleidoscope.enabled) {
			const ctx = off.getContext('2d');
			if (!ctx) return;
			const tile = renderTile();
			const params = kaleidoParams({
				drawBackground: includeBackground ? kaleidoscope.drawBackground : false
			});
			renderKaleidoscopeToCanvas(ctx, tile, tile.width, tile.height, params, { width, height });
			downloadDataUrl(off.toDataURL('image/png'), 'kaleidoscope.png');
			return;
		}

		// Flat: render the composition into an offscreen paper scope at the scaled size so
		// the PNG is independent of the visible canvas (no flicker, free resolution scaling).
		// The offscreen canvas starts transparent → background off yields a transparent PNG.
		const tempScope = new paper.PaperScope();
		tempScope.setup(off);
		const ignoreMorph = animationState.layers.audioBars || animationState.layers.audioZones;
		const restFit = animationState.layers.audioZones ? { fraction: REST_FRACTION } : undefined;
		pipeline!.render({
			composition,
			scope: tempScope,
			ignoreMorph,
			viewport: { width, height, padding: 32 * scale },
			restFit
		});
		if (includeBackground) {
			tempScope.activate();
			const background = new paper.Path.Rectangle(tempScope.view.bounds);
			background.fillColor = new paper.Color(getCompositionBackgroundColor());
			background.sendToBack();
		}
		tempScope.view.update();
		downloadDataUrl(off.toDataURL('image/png'), 'composition.png');
		tempScope.project.clear();
	}

	function attach(canvas: HTMLCanvasElement) {
		canvasEl = canvas;
		scope = new paper.PaperScope();
		scope.setup(canvas);
		pipeline = createRenderPipeline();

		// Paint the flat composition to the visible canvas while NOT in kaleidoscope mode.
		// Kaleidoscope mode owns the canvas via its rAF loop below, so this yields to it to
		// keep the two writers from racing (flicker) on shared canvas pixels.
		$effect(() => {
			if (kaleidoscope.enabled) return;
			const comp = composition;
			// Canvas pixel size comes from the persisted aspect ratio; the render pipeline
			// applies this as the paper view size, so changing the ratio reshapes the canvas.
			const p = getEffectiveCanvasProportion();
			const { width, height } = proportionToCanvasSize(p.width, p.height, CANVAS_LONG_SIDE);
			const viewport = { width, height, padding: 32 };
			// An active audio layer rides the primary petal; bypass morph in the render only.
			const ignoreMorph = animationState.layers.audioBars || animationState.layers.audioZones;
			// audioZones reserves edge headroom by holding a rest-derived scale; the pipeline
			// owns that two-pass now, so the caller just declares it.
			const restFit = animationState.layers.audioZones ? { fraction: REST_FRACTION } : undefined;
			pipeline!.render({ composition: comp, scope: scope!, ignoreMorph, viewport, restFit });

			// Paint the palette background behind the rings. pipeline.render() cleared the
			// scope, so re-add it every render; sendToBack keeps it under the marks. The flat
			// SVG export reads this same scene and the WebM export captures this canvas, so all
			// three surfaces inherit the background from here. Tagged so exportSvg can tell the
			// background apart from real content.
			scope!.activate();
			const background = new paper.Path.Rectangle(scope!.view.bounds);
			background.fillColor = new paper.Color(getCompositionBackgroundColor());
			background.name = 'preview-background';
			background.sendToBack();
			scope!.view.update();
		});

		// Kaleidoscope rAF loop: the sole writer of the visible canvas while enabled.
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

		// While in kaleidoscope mode the composition no longer paints the visible canvas
		// (gated above), so this keeps the canvas sized to the aspect ratio and re-snapshots
		// the static tile whenever the composition or aspect changes. The tile renders to the
		// OFFSCREEN scope, so the rAF loop stays the only writer of the visible canvas (no flicker).
		$effect(() => {
			if (!kaleidoscope.enabled) return;
			void $state.snapshot(composition); // deep-track composition edits
			const p = getEffectiveCanvasProportion();
			const { width, height } = proportionToCanvasSize(p.width, p.height, CANVAS_LONG_SIDE);
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
		});

		return () => {
			scope?.project.clear();
			pipeline?.dispose();
			// Release the offscreen tile scope created lazily for kaleidoscope mode.
			tileScope?.project.clear();
			if (kaleidoFrame !== null) {
				cancelAnimationFrame(kaleidoFrame);
				kaleidoFrame = null;
			}
		};
	}

	return {
		attach,
		exportSvg,
		exportPng,
		exportAnimation,
		get exportProgress() {
			return exportProgress;
		},
		animationExportSupported: isAnimationExportSupported()
	};
}
