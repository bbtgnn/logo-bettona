import paper from 'paper';
import type { Composition } from '$lib/types';
import { buildRingPath } from './bend';
import { interpolatePath, validatePathCompatibility } from './path-morph';
import { applyWaveToPath } from './wave';

type RenderViewport = {
	width: number;
	height: number;
	padding?: number;
};

export type RenderInput = {
	composition: Composition;
	scope: paper.PaperScope;
	viewport: RenderViewport;
};

export type RenderResult = {
	renderedCount: number;
	skippedCount: number;
	warnings: string[];
	renderDurationMs: number;
};

export class RenderPipelineError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'RenderPipelineError';
	}
}

function toPipelineError(error: unknown, context: string): RenderPipelineError {
	if (error instanceof RenderPipelineError) return error;
	const details = error instanceof Error ? error.message : String(error);
	return new RenderPipelineError(`${context}: ${details}`);
}

export function createRenderPipeline(): {
	render: (input: RenderInput) => RenderResult;
	dispose: () => void;
} {
	function assertViewport(viewport: RenderViewport): void {
		if (viewport.width <= 0 || viewport.height <= 0) {
			throw new RenderPipelineError('Viewport width and height must be greater than zero');
		}
	}

	function assertScope(scope: unknown): asserts scope is paper.PaperScope {
		if (
			!scope ||
			typeof scope !== 'object' ||
			typeof (scope as { activate?: unknown }).activate !== 'function' ||
			typeof (scope as { project?: unknown }).project !== 'object' ||
			!(scope as { project: { activeLayer?: unknown } }).project?.activeLayer ||
			typeof (scope as { project: { clear?: unknown } }).project.clear !== 'function' ||
			typeof (scope as { view?: unknown }).view !== 'object' ||
			typeof (scope as { view: { update?: unknown } }).view?.update !== 'function'
		) {
			throw new RenderPipelineError('Render input scope is missing or invalid');
		}
	}

	function assertComposition(composition: unknown): asserts composition is Composition {
		if (
			!composition ||
			typeof composition !== 'object' ||
			!Array.isArray((composition as { rings?: unknown }).rings) ||
			typeof (composition as { baseRadius?: unknown }).baseRadius !== 'number' ||
			typeof (composition as { ringIncrement?: unknown }).ringIncrement !== 'number'
		) {
			throw new RenderPipelineError('Render input composition is missing or invalid');
		}
	}

	function fitToView(scope: paper.PaperScope, viewport: RenderViewport): void {
		const allItems = scope.project.activeLayer.children;
		if (allItems.length === 0) return;

		let bounds = allItems[0].bounds.clone();
		for (let i = 1; i < allItems.length; i++) {
			bounds = bounds.unite(allItems[i].bounds);
		}

		if (bounds.width === 0 || bounds.height === 0) return;

		const padding = viewport.padding ?? 32;
		const available = Math.min(viewport.width, viewport.height) - padding * 2;
		if (available <= 0) return;

		const scale = available / Math.max(bounds.width, bounds.height);
		scope.project.activeLayer.scale(scale, bounds.center);
		scope.project.activeLayer.position = scope.view.bounds.center;
	}

	function render(input: RenderInput): RenderResult {
		const startedAt = performance.now();
		try {
			assertScope(input.scope);
			assertViewport(input.viewport);
			assertComposition(input.composition);
		} catch (error) {
			throw toPipelineError(error, 'Render pipeline failed during input validation');
		}

		const { composition, scope, viewport } = input;
		const warnings: string[] = [];
		let renderedCount = 0;
		let skippedCount = 0;

		try {
			scope.activate();
			scope.view.viewSize = new paper.Size(viewport.width, viewport.height);
			scope.project.clear();
		} catch (error) {
			throw toPipelineError(error, 'Render pipeline failed during setup phase');
		}

		for (let i = composition.rings.length - 1; i >= 0; i--) {
			try {
				const ring = composition.rings[i];
				if (ring.copies <= 0) {
					throw new Error('ring copies must be greater than zero');
				}

				let effectiveRing = ring;
				if (ring.templatePath && ring.secondaryTemplatePath) {
					const compatibility = validatePathCompatibility(ring.templatePath, ring.secondaryTemplatePath);
					if (compatibility.ok) {
						effectiveRing = {
							...ring,
							templatePath: interpolatePath(
								ring.templatePath,
								ring.secondaryTemplatePath,
								ring.morphT ?? 0
							)
						};
					} else {
						warnings.push(`Ring ${i} morph fallback: ${compatibility.reason}`);
					}
				}

				// Apply the cymatic wave to the (already morph-interpolated) template
				// BEFORE bend mirrors/tiles it, so the ripple is coherent on every copy.
				if (effectiveRing.wave && effectiveRing.wave.amplitude > 0 && effectiveRing.templatePath) {
					effectiveRing = {
						...effectiveRing,
						templatePath: applyWaveToPath(effectiveRing.templatePath, effectiveRing.wave)
					};
				}

				const radius = composition.baseRadius + composition.ringIncrement * i;
				const ringPath = buildRingPath(effectiveRing, radius, scope);

				if (!ringPath) {
					skippedCount += 1;
					warnings.push(`Ring ${i} skipped: template path is not renderable`);
					continue;
				}

				ringPath.fillColor = new paper.Color(effectiveRing.color);
				ringPath.strokeColor = null;
				renderedCount += 1;
			} catch (error) {
				skippedCount += 1;
				const details = error instanceof Error ? error.message : String(error);
				warnings.push(`Ring ${i} skipped: render failure (${details})`);
			}
		}

		try {
			fitToView(scope, viewport);
			scope.view.update();
		} catch (error) {
			throw toPipelineError(error, 'Render pipeline failed during finalize phase');
		}

		return { renderedCount, skippedCount, warnings, renderDurationMs: performance.now() - startedAt };
	}

	function dispose(): void {
		// Task 2 boundary: disposal lifecycle is intentionally deferred.
	}

	return { render, dispose };
}
