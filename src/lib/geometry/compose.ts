import paper from 'paper';
import type { Composition } from '$lib/types';
import { buildRingPath } from './bend';

/**
 * Renders the full composition into the given PaperScope.
 * Clears the project first, then draws rings in reverse index order
 * (highest index first → index 0 rendered last / on top).
 */
export function renderComposition(composition: Composition, scope: paper.PaperScope): void {
	scope.activate();
	scope.project.clear();

	const { baseRadius, ringIncrement, rings } = composition;

	// Build and add paths in reverse index order: highest index first, index 0 last.
	// In paper.js, last item added to the layer is drawn on top — so index 0 renders on top.
	for (let i = rings.length - 1; i >= 0; i--) {
		const radius = baseRadius + ringIncrement * i;
		const path = buildRingPath(rings[i], radius, scope);
		if (!path) continue;

		path.fillColor = new paper.Color(rings[i].color);
		path.strokeColor = null;
	}

	scope.view.update();
}

/**
 * Scales the entire composition to fit within the given canvas size,
 * centered at the view center.
 */
export function fitToView(scope: paper.PaperScope): void {
	scope.activate();

	const allItems = scope.project.activeLayer.children;
	if (allItems.length === 0) return;

	// Compute bounding box of all items
	let bounds = allItems[0].bounds.clone();
	for (let i = 1; i < allItems.length; i++) {
		bounds = bounds.unite(allItems[i].bounds);
	}

	if (bounds.width === 0 || bounds.height === 0) return;

	const padding = 32;
	const viewBounds = scope.view.bounds;
	const available = Math.min(viewBounds.width, viewBounds.height) - padding * 2;
	const scale = available / Math.max(bounds.width, bounds.height);

	scope.project.activeLayer.scale(scale, bounds.center);
	scope.project.activeLayer.position = scope.view.center;

	scope.view.update();
}
