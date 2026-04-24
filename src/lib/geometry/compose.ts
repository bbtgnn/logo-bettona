import paper from 'paper';
import type { Composition } from '$lib/types';
import { createRenderPipeline } from './render-pipeline';

const defaultRenderPipeline = createRenderPipeline();

/**
 * Backward-compatible facade that delegates rendering to the default pipeline.
 */
export function renderComposition(composition: Composition, scope: paper.PaperScope): void {
	defaultRenderPipeline.render({
		composition,
		scope,
		viewport: {
			width: scope.view.size.width,
			height: scope.view.size.height,
			padding: 32
		}
	});
}

/**
 * Backward-compatible no-op. Retained for older call sites.
 */
export function fitToView(scope: paper.PaperScope): void {
	scope.activate();
	scope.view.update();
}
