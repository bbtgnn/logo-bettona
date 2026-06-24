import paper from 'paper';
import { computeFitToView } from '$lib/geometry/fit-to-view';

/**
 * Svelte attachment owning a preview's paper.js scope lifecycle. Creates the
 * scope, sets it up on the canvas, and registers a single $effect that activates
 * the scope and runs `draw(scope)` — the effect re-tracks whatever reactive state
 * `draw` reads, so the preview redraws when its inputs change. On teardown it runs
 * the caller's optional `dispose` (e.g. pipeline.dispose / cancelAnimationFrame)
 * then clears the project and removes the view — the guaranteed, leak-free cleanup
 * every preview needs in one place.
 *
 * The render BODY stays in `draw`: some previews call pipeline.render, others
 * buildRingPath directly — legitimately different, so the adapter owns only the
 * scope seam, not what gets drawn.
 */
export function paperCanvas(
	draw: (scope: paper.PaperScope) => void,
	opts?: { dispose?: () => void }
): (canvas: HTMLCanvasElement) => () => void {
	return (canvas) => {
		const scope = new paper.PaperScope();
		scope.setup(canvas);
		$effect(() => {
			scope.activate();
			draw(scope);
		});
		return () => {
			opts?.dispose?.();
			scope.project.clear();
			scope.view.remove();
		};
	};
}

/**
 * Fits the active layer into the view, leaving `padding` px on every side. No-op
 * when there is nothing to fit. Replaces the fitToView copied verbatim in the
 * buildRingPath-based previews (Wave, Zone).
 */
export function fitPreviewToView(scope: paper.PaperScope, padding = 14): void {
	const items = scope.project.activeLayer.children;
	if (items.length === 0) return;
	let bounds = items[0].bounds.clone();
	for (let i = 1; i < items.length; i++) bounds = bounds.unite(items[i].bounds);
	const scale = computeFitToView(bounds, scope.view.size, padding);
	if (scale === null) return;
	scope.project.activeLayer.scale(scale, bounds.center);
	scope.project.activeLayer.position = scope.view.center;
}
