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
	/**
	 * When true, the cymatic wave rides each ring's PRIMARY template (path A) and the
	 * stored `morphT` is bypassed for this render — without mutating it, so the other
	 * modes that depend on morphT are untouched. Used by audioBars mode so the rest
	 * shape is the petal the user actually authored, not a residual morph blend.
	 */
	ignoreMorph?: boolean;
	/**
	 * When set (finite, > 0), apply this fixed scale + recenter in the finalize phase
	 * instead of the bounds-derived `fitToView`. Lets audioZones hold a stable scale so
	 * opening petals extend toward the canvas edge instead of being re-fitted away.
	 */
	fitScale?: number;
	/** When true, skip zone deformation so the rest pose can be measured. */
	ignoreZoneDrive?: boolean;
};

export type RenderResult = {
	renderedCount: number;
	skippedCount: number;
	warnings: string[];
	renderDurationMs: number;
	/** Max side of the united layer bounds BEFORE fitting; 0 when empty. */
	boundSide: number;
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

/**
 * Fixed render scale for a rest pose: places the mark at `restFraction` of the
 * available square, leaving headroom for petals to open. Returns 1 (no scaling)
 * for a degenerate bound or viewport.
 */
export function computeRestScale(
	boundSide: number,
	viewport: { width: number; height: number; padding?: number },
	restFraction: number
): number {
	const padding = viewport.padding ?? 32;
	const available = Math.min(viewport.width, viewport.height) - padding * 2;
	if (!Number.isFinite(boundSide) || boundSide <= 0 || available <= 0) return 1;
	return (available * restFraction) / boundSide;
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

	function unionBounds(scope: paper.PaperScope): paper.Rectangle | null {
		const items = scope.project.activeLayer.children;
		if (items.length === 0) return null;
		let bounds = items[0].bounds.clone();
		for (let i = 1; i < items.length; i++) bounds = bounds.unite(items[i].bounds);
		return bounds;
	}

	function fitToView(scope: paper.PaperScope, viewport: RenderViewport, bounds: paper.Rectangle): void {
		if (bounds.width === 0 || bounds.height === 0) return;

		const padding = viewport.padding ?? 32;
		const available = Math.min(viewport.width, viewport.height) - padding * 2;
		if (available <= 0) return;

		const scale = available / Math.max(bounds.width, bounds.height);
		scope.project.activeLayer.scale(scale, bounds.center);
		scope.project.activeLayer.position = scope.view.bounds.center;
	}

	function applyFixedScale(scope: paper.PaperScope, fitScale: number, bounds: paper.Rectangle): void {
		scope.project.activeLayer.scale(fitScale, bounds.center);
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
				if (!input.ignoreMorph && ring.templatePath && ring.secondaryTemplatePath) {
					const compatibility = validatePathCompatibility(
						ring.templatePath,
						ring.secondaryTemplatePath
					);
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

				// Zone deformation (audioZones mode) is applied inside buildRingPath in final
				// polar space, driven by ring.zoneDrive. Strip the drive when measuring the
				// rest pose so the fixed scale is taken from the undeformed shape.
				if (input.ignoreZoneDrive && effectiveRing.zoneDrive) {
					effectiveRing = { ...effectiveRing, zoneDrive: null };
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

		let boundSide = 0;
		try {
			const bounds = unionBounds(scope);
			boundSide = bounds ? Math.max(bounds.width, bounds.height) : 0;
			if (bounds) {
				if (input.fitScale && Number.isFinite(input.fitScale) && input.fitScale > 0) {
					applyFixedScale(scope, input.fitScale, bounds);
				} else {
					fitToView(scope, viewport, bounds);
				}
			}
			scope.view.update();
		} catch (error) {
			throw toPipelineError(error, 'Render pipeline failed during finalize phase');
		}

		return {
			renderedCount,
			skippedCount,
			warnings,
			renderDurationMs: performance.now() - startedAt,
			boundSide
		};
	}

	function dispose(): void {
		// Task 2 boundary: disposal lifecycle is intentionally deferred.
	}

	return { render, dispose };
}