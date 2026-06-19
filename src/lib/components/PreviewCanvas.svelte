<script lang="ts">
	import paper from 'paper';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import { composition, getCompositionBackgroundColor } from '$lib/state/composition';
	import { animationState, togglePlay, getExportAudioStream } from '$lib/state/animation';
	import { createRenderPipeline, computeRestScale } from '$lib/geometry/render-pipeline';
	import { ratioToCanvasSize } from '$lib/geometry/aspect-ratio';
	import { exportCanvasAnimation, isAnimationExportSupported } from '$lib/export/canvas-export';
	import { exportStatus as sharedExportStatus } from '$lib/state/export-status.svelte';
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

	let exportStatus = $state<'idle' | 'rendering'>('idle');
	let exportProgress = $state(0);
	let exportDurationSec = $state(5);
	let exportAudio = $state(false);
	const animationExportSupported = isAnimationExportSupported();

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

	function exportSvg() {
		if (!scope) return;

		const hasContent = scope.project.activeLayer.children.length > 0;
		if (!hasContent) return;

		scope.activate();
		const svgData = scope.project.exportSVG({ asString: true }) as string;
		const blob = new Blob([svgData], { type: 'image/svg+xml' });
		const url = URL.createObjectURL(blob);

		const a = document.createElement('a');
		a.href = url;
		a.download = 'composition.svg';
		a.click();
		URL.revokeObjectURL(url);
	}

	async function exportAnimation() {
		if (exportStatus === 'rendering' || !canvasEl || !scope) return;
		// Same empty-canvas no-op guard as Export SVG: nothing to record.
		if (scope.project.activeLayer.children.length === 0) return;
		if (!animationState.isPlaying) togglePlay();
		const audio = exportAudio ? getExportAudioStream() : null;
		exportStatus = 'rendering';
		sharedExportStatus.rendering = true;
		exportProgress = 0;
		try {
			await exportCanvasAnimation({
				canvas: canvasEl,
				durationSec: exportDurationSec,
				audioStream: audio?.stream ?? null,
				onProgress: (p) => {
					exportProgress = p;
				}
			});
		} catch (err) {
			console.error('Animation export failed', err);
		} finally {
			audio?.dispose();
			exportStatus = 'idle';
			sharedExportStatus.rendering = false;
			exportProgress = 0;
		}
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

	function exportKaleidoscopePng() {
		if (!canvasEl) return;
		canvasEl.toBlob((blob) => {
			if (!blob) return;
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'kaleidoscope.png';
			a.click();
			URL.revokeObjectURL(url);
		}, 'image/png');
	}

	function exportKaleidoscopeSvg() {
		ensureTileScope();
		renderTile();
		tileScope!.activate();
		const tileSvg = tileScope!.project.exportSVG({ asString: true }) as string;
		const size = canvasEl ? Math.min(canvasEl.width, canvasEl.height) : TILE_PX;
		const svg = generateKaleidoscopeSVG(tileSvg, kaleidoscope, size);
		const blob = new Blob([svg], { type: 'image/svg+xml' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'kaleidoscope.svg';
		a.click();
		URL.revokeObjectURL(url);
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

	{#if kaleidoscope.enabled}
		<Button variant="outline" onclick={exportKaleidoscopePng} class="w-full max-w-[600px]">
			Esporta PNG (caleidoscopio)
		</Button>
		<Button variant="outline" onclick={exportKaleidoscopeSvg} class="w-full max-w-[600px]">
			Esporta SVG (caleidoscopio)
		</Button>
	{/if}

	<div class="flex w-full max-w-[600px] flex-col gap-2">
		<div class="flex items-center gap-2">
			<Label for="export-duration" class="text-xs">Durata (s)</Label>
			<input
				id="export-duration"
				type="number"
				min="1"
				step="1"
				class="h-9 w-20 rounded-md border border-input bg-background px-3 text-xs"
				value={exportDurationSec}
				disabled={exportStatus === 'rendering'}
				oninput={(e) =>
					(exportDurationSec = Math.max(1, Number((e.target as HTMLInputElement).value) || 1))}
			/>
		</div>
		<label class="flex items-center gap-2 text-xs">
			<input
				type="checkbox"
				checked={exportAudio}
				disabled={exportStatus === 'rendering'}
				onchange={(e) => (exportAudio = (e.target as HTMLInputElement).checked)}
			/>
			Includi audio
		</label>
		{#if exportStatus === 'rendering'}
			<div class="flex flex-col gap-1">
				<div class="h-2 w-full overflow-hidden rounded bg-muted">
					<div class="h-full bg-primary transition-[width]" style="width: {Math.round(exportProgress * 100)}%"></div>
				</div>
				<span class="text-center text-xs text-muted-foreground">Rendering… {Math.round(exportProgress * 100)}%</span>
			</div>
		{:else}
			<Button variant="outline" onclick={exportAnimation} disabled={!animationExportSupported} class="w-full">
				Export Animation
			</Button>
			{#if !animationExportSupported}
				<span class="text-center text-[11px] text-muted-foreground">Export video non supportato dal browser</span>
			{/if}
		{/if}
	</div>
</div>