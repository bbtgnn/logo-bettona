import { beforeEach, describe, expect, it, vi } from 'vitest';
import paper from 'paper';
import type { Composition, Path } from '$lib/types';
import { createRenderPipeline, RenderPipelineError } from './render-pipeline';

let scope: paper.PaperScope;

beforeEach(() => {
	scope = new paper.PaperScope();
	scope.setup(new paper.Size(600, 600));
});

const rectPath: Path = {
	cmds: ['M', 'L', 'L', 'L', 'Z'],
	crds: [0, 0, 100, 0, 100, 50, 0, 50]
};

const shiftedRectPath: Path = {
	cmds: ['M', 'L', 'L', 'L', 'Z'],
	crds: [10, 0, 110, 0, 110, 50, 10, 50]
};

const incompatiblePath: Path = {
	cmds: ['M', 'Q', 'Z'],
	crds: [0, 0, 50, 25, 100, 0]
};

const composition: Composition = {
	baseRadius: 100,
	ringIncrement: 60,
	rings: [
		{
			copies: 4,
			color: '#ff0000',
			templatePath: rectPath,
			secondaryTemplatePath: null,
			morphT: 0,
			ringHeight: 0.4
		},
		{
			copies: 4,
			color: '#0000ff',
			templatePath: rectPath,
			secondaryTemplatePath: null,
			morphT: 0,
			ringHeight: 0.4
		}
	],
	monochromePalettes: [{ main: '#000', bg: '#fff' }],
	fullPalettes: [{ colors: ['#000', '#fff'] }]
};

describe('createRenderPipeline().render', () => {
	it('renders one path per renderable ring in deterministic order', () => {
		const pipeline = createRenderPipeline();
		const result = pipeline.render({
			composition,
			scope,
			viewport: { width: 600, height: 600, padding: 32 }
		});

		expect(scope.project.activeLayer.children.length).toBe(2);
		expect(result.renderedCount).toBe(2);
		expect(result.skippedCount).toBe(0);
		expect(result.warnings).toEqual([]);
	});

	it('keeps ring 0 as top-most renderable child', () => {
		const pipeline = createRenderPipeline();
		pipeline.render({
			composition,
			scope,
			viewport: { width: 600, height: 600, padding: 32 }
		});

		const children = scope.project.activeLayer.children;
		const topMost = children[children.length - 1] as paper.Path;
		expect(topMost.fillColor?.toCSS(true)).toBe('#ff0000');
	});

	it('returns warning and skips ring when templatePath is null', () => {
		const pipeline = createRenderPipeline();
		const result = pipeline.render({
			composition: {
				...composition,
				rings: [{ ...composition.rings[0], templatePath: null }, composition.rings[1]]
			},
			scope,
			viewport: { width: 600, height: 600, padding: 32 }
		});

		expect(scope.project.activeLayer.children.length).toBe(1);
		expect(result.renderedCount).toBe(1);
		expect(result.skippedCount).toBe(1);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toMatch(/^Ring 0 skipped: template path is not renderable$/);
		expect(result.renderDurationMs).toBeGreaterThanOrEqual(0);
	});

	it('interpolates ring template path when secondary path exists', () => {
		const pipeline = createRenderPipeline();
		const result = pipeline.render({
			composition: {
				...composition,
				rings: [
					{
						...composition.rings[0],
						templatePath: rectPath,
						secondaryTemplatePath: shiftedRectPath,
						morphT: 0.5
					}
				]
			},
			scope,
			viewport: { width: 600, height: 600, padding: 32 }
		});

		expect(result.renderedCount).toBe(1);
		expect(result.warnings).toEqual([]);
	});

	it('falls back to primary path when morph paths incompatible', () => {
		const pipeline = createRenderPipeline();
		const result = pipeline.render({
			composition: {
				...composition,
				rings: [
					{
						...composition.rings[0],
						templatePath: rectPath,
						secondaryTemplatePath: incompatiblePath,
						morphT: 0.5
					}
				]
			},
			scope,
			viewport: { width: 600, height: 600, padding: 32 }
		});

		expect(result.renderedCount).toBe(1);
		expect(result.warnings.some((warning) => warning.includes('morph fallback'))).toBe(true);
	});

	it('skips a ring and continues rendering when one ring throws', () => {
		const pipeline = createRenderPipeline();
		const throwingComposition: Composition = {
			...composition,
			rings: [
				{
					...composition.rings[0],
					copies: 0
				},
				composition.rings[1]
			]
		};

		const result = pipeline.render({
			composition: throwingComposition,
			scope,
			viewport: { width: 600, height: 600, padding: 32 }
		});

		expect(result.renderedCount).toBe(1);
		expect(result.skippedCount).toBe(1);
		expect(result.warnings.some((warning) => warning.includes('render failure'))).toBe(true);
		expect(scope.project.activeLayer.children.length).toBe(1);
	});

	it('clears previous scene when rendering twice on the same scope', () => {
		const pipeline = createRenderPipeline();
		const secondComposition: Composition = {
			...composition,
			rings: [{ ...composition.rings[0], templatePath: null }, composition.rings[1]]
		};

		const first = pipeline.render({
			composition,
			scope,
			viewport: { width: 600, height: 600, padding: 32 }
		});
		expect(first.renderedCount).toBe(2);
		expect(scope.project.activeLayer.children.length).toBe(2);

		const second = pipeline.render({
			composition: secondComposition,
			scope,
			viewport: { width: 600, height: 600, padding: 32 }
		});
		expect(second.renderedCount).toBe(1);
		expect(second.skippedCount).toBe(1);
		expect(scope.project.activeLayer.children.length).toBe(1);
	});

	it('throws RenderPipelineError for invalid viewport', () => {
		const pipeline = createRenderPipeline();
		expect(() =>
			pipeline.render({
				composition,
				scope,
				viewport: { width: 0, height: 600, padding: 32 }
			})
		).toThrow(RenderPipelineError);
	});

	it('throws RenderPipelineError when scope is missing', () => {
		const pipeline = createRenderPipeline();
		expect(() =>
			pipeline.render({
				composition,
				scope: undefined as unknown as paper.PaperScope,
				viewport: { width: 600, height: 600, padding: 32 }
			})
		).toThrow(RenderPipelineError);
	});

	it('throws RenderPipelineError when scope contract is invalid', () => {
		const pipeline = createRenderPipeline();
		expect(() =>
			pipeline.render({
				composition,
				scope: { project: {}, view: {} } as unknown as paper.PaperScope,
				viewport: { width: 600, height: 600, padding: 32 }
			})
		).toThrow(RenderPipelineError);
	});

	it('throws RenderPipelineError when composition contract is invalid', () => {
		const pipeline = createRenderPipeline();
		expect(() =>
			pipeline.render({
				composition: { ...composition, rings: null } as unknown as Composition,
				scope,
				viewport: { width: 600, height: 600, padding: 32 }
			})
		).toThrow(RenderPipelineError);
	});

	it('wraps unexpected runtime scope failures with setup context', () => {
		const pipeline = createRenderPipeline();
		const throwingScope = {
			activate: () => {
				throw new Error('boom');
			},
			project: {
				activeLayer: { children: [], scale: () => {}, position: new paper.Point(0, 0) },
				clear: () => {}
			},
			view: {
				update: () => {},
				bounds: new paper.Rectangle(0, 0, 600, 600),
				viewSize: new paper.Size(600, 600)
			}
		} as unknown as paper.PaperScope;

		expect(() =>
			pipeline.render({
				composition,
				scope: throwingScope,
				viewport: { width: 600, height: 600, padding: 32 }
			})
		).toThrow(/Render pipeline failed during setup phase: boom/);
		expect(() =>
			pipeline.render({
				composition,
				scope: throwingScope,
				viewport: { width: 600, height: 600, padding: 32 }
			})
		).toThrow(RenderPipelineError);
	});

	it('centers rendered bounds and fits them inside padded viewport', () => {
		const pipeline = createRenderPipeline();
		pipeline.render({
			composition,
			scope,
			viewport: { width: 600, height: 600, padding: 32 }
		});

		const epsilon = 0.5;
		const children = scope.project.activeLayer.children;
		let bounds = children[0].bounds.clone();
		for (let i = 1; i < children.length; i++) {
			bounds = bounds.unite(children[i].bounds);
		}

		const viewCenter = scope.view.bounds.center;
		expect(Math.abs(bounds.center.x - viewCenter.x)).toBeLessThanOrEqual(epsilon);
		expect(Math.abs(bounds.center.y - viewCenter.y)).toBeLessThanOrEqual(epsilon);

		const available = 600 - 32 * 2;
		expect(bounds.width).toBeLessThanOrEqual(available + epsilon);
		expect(bounds.height).toBeLessThanOrEqual(available + epsilon);
	});
});
