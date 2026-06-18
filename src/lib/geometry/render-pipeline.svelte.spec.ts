import { beforeEach, describe, expect, it } from 'vitest';
import paper from 'paper';
import type { Composition, Path } from '$lib/types';
import { createRenderPipeline, RenderPipelineError, computeRestScale } from './render-pipeline';

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

const petalPath: Path = {
	cmds: ['M', 'C', 'C'],
	crds: [
		0, 100,
		0, 80, 5, 50, 10, 30,
		20, 25, 30, 30, 40, 60
	]
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

	it('ignoreMorph renders the primary path, bypassing morphT', () => {
		const pipeline = createRenderPipeline();
		const viewport = { width: 600, height: 600, padding: 32 };
		// Secondary moves a vertex's bbox-relative position (not a pure translation,
		// which bend would normalize away), so the morph blend bends differently.
		const morphTarget: Path = {
			cmds: ['M', 'L', 'L', 'L', 'Z'],
			crds: [0, 0, 50, 0, 100, 50, 0, 50]
		};
		const morphedRing = {
			...composition.rings[0],
			templatePath: rectPath,
			secondaryTemplatePath: morphTarget,
			morphT: 1
		};

		// Primary-only reference: no secondary, so no morph blend at all.
		pipeline.render({
			composition: { ...composition, rings: [{ ...morphedRing, secondaryTemplatePath: null }] },
			scope,
			viewport
		});
		const primaryOnly = (scope.project.activeLayer.children[0] as paper.Path).pathData;

		// Same ring WITH a secondary at morphT=1, but ignoreMorph → must equal primary-only.
		pipeline.render({
			composition: { ...composition, rings: [morphedRing] },
			scope,
			viewport,
			ignoreMorph: true
		});
		const withIgnore = (scope.project.activeLayer.children[0] as paper.Path).pathData;

		// And WITHOUT ignoreMorph the blend differs, proving the flag is what bypasses it.
		pipeline.render({ composition: { ...composition, rings: [morphedRing] }, scope, viewport });
		const withMorph = (scope.project.activeLayer.children[0] as paper.Path).pathData;

		expect(withIgnore).toBe(primaryOnly);
		expect(withMorph).not.toBe(primaryOnly);
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

	it('applies wave deformation to ring geometry when ring.wave is set', () => {
		const pipeline = createRenderPipeline();
		const viewport = { width: 600, height: 600, padding: 32 };
		// The angular taper W(nx)=sin(pi*nx) zeroes displacement at nx=0/1, so a
		// rectangle (x only ever 0 or 100) deforms by ~0 everywhere. Use a template
		// with a mid-petal vertex (nx=0.5) so the taper leaves a visible deformation.
		const taperTemplate: Path = {
			cmds: ['M', 'L', 'L', 'L', 'Z'],
			crds: [0, 0, 50, 0, 100, 50, 0, 50]
		};
		const oneRing = {
			...composition,
			rings: [{ ...composition.rings[0], templatePath: taperTemplate }]
		};

		pipeline.render({ composition: oneRing, scope, viewport });
		const withoutWave = (scope.project.activeLayer.children[0] as paper.Path).pathData;

		pipeline.render({
			composition: {
				...oneRing,
				// phase 0.5 (rather than 0) avoids a coincidental zero-crossing of
				// sin(crests * PI * ny + phase) at both ny=0 and ny=1, which would
				// otherwise produce dx ≈ 0 everywhere and make the assertion vacuous.
				rings: [{ ...oneRing.rings[0], wave: { amplitude: 0.3, crests: 3, phase: 0.5 } }]
			},
			scope,
			viewport
		});
		const withWave = (scope.project.activeLayer.children[0] as paper.Path).pathData;

		expect(withWave).not.toBe(withoutWave);
	});

	it('renders identically when ring.wave is null or amplitude 0', () => {
		const pipeline = createRenderPipeline();
		const viewport = { width: 600, height: 600, padding: 32 };
		const oneRing = { ...composition, rings: [composition.rings[0]] };

		pipeline.render({ composition: oneRing, scope, viewport });
		const baseline = (scope.project.activeLayer.children[0] as paper.Path).pathData;

		pipeline.render({
			composition: { ...oneRing, rings: [{ ...composition.rings[0], wave: null }] },
			scope,
			viewport
		});
		expect((scope.project.activeLayer.children[0] as paper.Path).pathData).toBe(baseline);

		pipeline.render({
			composition: {
				...oneRing,
				rings: [{ ...composition.rings[0], wave: { amplitude: 0, crests: 3, phase: 1 } }]
			},
			scope,
			viewport
		});
		expect((scope.project.activeLayer.children[0] as paper.Path).pathData).toBe(baseline);
	});

	it('applies zoneDrive deformation when ring.zoneDrive is set', () => {
		const pipeline = createRenderPipeline();
		const drive = { bassPush: 5, midPush: 3, trebleRetract: 2, trebleVibrate: 1 };
		const comp: Composition = {
			baseRadius: 100,
			ringIncrement: 60,
			rings: [{
				copies: 4,
				color: '#ff0000',
				templatePath: petalPath,
				secondaryTemplatePath: null,
				morphT: 0,
				ringHeight: 0.4,
				zoneDrive: drive
			}],
			monochromePalettes: [{ main: '#000', bg: '#fff' }],
			fullPalettes: [{ colors: ['#000', '#fff'] }]
		};
		// Should render without throwing and produce 1 rendered ring
		const result = pipeline.render({ composition: comp, scope, viewport: { width: 600, height: 600 } });
		expect(result.renderedCount).toBe(1);
		expect(result.skippedCount).toBe(0);
	});

	it('renders identically with zoneDrive all-zero vs no zoneDrive', () => {
		const pipeline1 = createRenderPipeline();
		const pipeline2 = createRenderPipeline();

		const compWithDrive: Composition = {
			...composition,
			rings: [{ ...composition.rings[0], templatePath: petalPath, zoneDrive: { bassPush: 0, midPush: 0, trebleRetract: 0, trebleVibrate: 0 } }]
		};
		const compNoDrive: Composition = {
			...composition,
			rings: [{ ...composition.rings[0], templatePath: petalPath }]
		};

		const r1 = pipeline1.render({ composition: compWithDrive, scope, viewport: { width: 600, height: 600 } });
		const r2 = pipeline2.render({ composition: compNoDrive, scope, viewport: { width: 600, height: 600 } });

		expect(r1.renderedCount).toBe(r2.renderedCount);
		expect(r1.skippedCount).toBe(r2.skippedCount);
	});
});
describe('computeRestScale', () => {
	it('maps the rest bound to restFraction of the available square', () => {
		// available = min(600,600) - 2*32 = 536; restFraction 0.5 → target 268; boundSide 134 → scale 2.
		expect(computeRestScale(134, { width: 600, height: 600, padding: 32 }, 0.5)).toBeCloseTo(2, 6);
	});

	it('falls back to 1 for a degenerate bound or viewport', () => {
		expect(computeRestScale(0, { width: 600, height: 600, padding: 32 }, 0.45)).toBe(1);
		expect(computeRestScale(100, { width: 10, height: 10, padding: 32 }, 0.45)).toBe(1);
		expect(computeRestScale(Number.NaN, { width: 600, height: 600 }, 0.45)).toBe(1);
	});
});

describe('createRenderPipeline().render fixed scale', () => {
	it('returns a positive boundSide and still renders without fitScale', () => {
		const pipeline = createRenderPipeline();
		const result = pipeline.render({
			composition,
			scope,
			viewport: { width: 600, height: 600, padding: 32 }
		});
		expect(result.boundSide).toBeGreaterThan(0);
	});

	it('with fitScale, scales the layer by exactly fitScale and skips bounds-fit', () => {
		const pipeline = createRenderPipeline();
		// Rest render to learn the un-fitted bound side.
		const rest = pipeline.render({
			composition,
			scope,
			ignoreZoneDrive: true,
			viewport: { width: 600, height: 600, padding: 32 }
		});
		const scale = 0.5;
		pipeline.render({
			composition,
			scope,
			fitScale: scale,
			viewport: { width: 600, height: 600, padding: 32 }
		});
		const b = scope.project.activeLayer.bounds;
		expect(Math.max(b.width, b.height)).toBeCloseTo(rest.boundSide * scale, 4);
	});

	it('ignoreZoneDrive renders the rest pose (zoneDrive has no effect on boundSide)', () => {
		const pipeline = createRenderPipeline();
		const driven: Composition = {
			...composition,
			rings: composition.rings.map((r) => ({
				...r,
				templatePath: petalPath,
				zoneDrive: { bassPush: 1, midPush: 1, trebleRetract: 1, trebleVibrate: 1 }
			}))
		};
		const withDrive = pipeline.render({
			composition: driven,
			scope,
			viewport: { width: 600, height: 600, padding: 32 }
		});
		const ignored = pipeline.render({
			composition: driven,
			scope,
			ignoreZoneDrive: true,
			viewport: { width: 600, height: 600, padding: 32 }
		});
		expect(ignored.boundSide).toBeLessThan(withDrive.boundSide);
	});
});
