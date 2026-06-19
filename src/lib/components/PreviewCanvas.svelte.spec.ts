import type paper from 'paper';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { RenderInput } from '$lib/geometry/render-pipeline';
import { composition } from '$lib/state/composition';
import { setKaleidoscopeEnabled } from '$lib/state/kaleidoscope.svelte';
import { animationState, setAnimationDurationSec } from '$lib/state/animation';

let lastRenderedScope: paper.PaperScope | undefined;
let lastRenderInput: RenderInput | undefined;
let renderCallCount = 0;
let disposeCallCount = 0;

vi.mock('$lib/geometry/render-pipeline', async () => {
	const actual = await vi.importActual<typeof import('$lib/geometry/render-pipeline')>(
		'$lib/geometry/render-pipeline'
	);

	return {
		...actual,
		createRenderPipeline: () => {
			const pipeline = actual.createRenderPipeline();
			return {
				render: (input: RenderInput) => {
					renderCallCount += 1;
					lastRenderedScope = input.scope;
					lastRenderInput = input;
					return pipeline.render(input);
				},
				dispose: () => {
					disposeCallCount += 1;
					pipeline.dispose();
				}
			};
		}
	};
});

import PreviewCanvas from './PreviewCanvas.svelte';

describe('PreviewCanvas.svelte', () => {
	let originalComposition: {
		baseRadius: number;
		ringIncrement: number;
		rings: typeof composition.rings;
		monochromePalettes: typeof composition.monochromePalettes;
		fullPalettes: typeof composition.fullPalettes;
	};

	beforeEach(() => {
		lastRenderedScope = undefined;
		lastRenderInput = undefined;
		renderCallCount = 0;
		disposeCallCount = 0;
		originalComposition = {
			baseRadius: composition.baseRadius,
			ringIncrement: composition.ringIncrement,
			rings: composition.rings.map((ring) => ({
				...ring,
				templatePath: ring.templatePath
					? { cmds: [...ring.templatePath.cmds], crds: [...ring.templatePath.crds] }
					: null
			})),
			monochromePalettes: composition.monochromePalettes.map((palette) => ({ ...palette })),
			fullPalettes: composition.fullPalettes.map((palette) => ({ colors: [...palette.colors] }))
		};

		composition.baseRadius = 100;
		composition.ringIncrement = 50;
		composition.rings = [
			{
				copies: 8,
				color: '#000000',
				templatePath: {
					cmds: ['M', 'L', 'L', 'L', 'Z'],
					crds: [0, 0, 100, 0, 100, 50, 0, 50]
				},
				secondaryTemplatePath: null,
				morphT: 0,
				ringHeight: 0.25
			}
		];
	});

	afterEach(() => {
		composition.baseRadius = originalComposition.baseRadius;
		composition.ringIncrement = originalComposition.ringIncrement;
		composition.rings = originalComposition.rings;
		composition.monochromePalettes = originalComposition.monochromePalettes;
		composition.fullPalettes = originalComposition.fullPalettes;
	});

	it('delegates preview rendering through pipeline and draws content', async () => {
		expect(() => render(PreviewCanvas)).not.toThrow();

		await vi.waitFor(() => {
			expect(lastRenderedScope).toBeDefined();
			expect(lastRenderedScope?.project.activeLayer.children.length).toBeGreaterThan(0);
		});
	});

	it('re-renders through pipeline when composition changes', async () => {
		render(PreviewCanvas);

		await vi.waitFor(() => {
			expect(renderCallCount).toBeGreaterThanOrEqual(1);
		});

		const initialCount = renderCallCount;
		composition.baseRadius = composition.baseRadius + 20;

		await vi.waitFor(() => {
			expect(renderCallCount).toBeGreaterThan(initialCount);
			expect(lastRenderInput?.composition.baseRadius).toBe(composition.baseRadius);
		});
	});

	it('disposes pipeline on unmount', async () => {
		const view = render(PreviewCanvas);

		await vi.waitFor(() => {
			expect(renderCallCount).toBeGreaterThanOrEqual(1);
		});

		view.unmount();
		expect(disposeCallCount).toBe(1);
	});

	it('shows kaleidoscope export buttons when mode is enabled', async () => {
		render(PreviewCanvas);
		setKaleidoscopeEnabled(true);
		try {
			await expect
				.element(page.getByText('Esporta PNG (caleidoscopio)'))
				.toBeInTheDocument();
			await expect
				.element(page.getByText('Esporta SVG (caleidoscopio)'))
				.toBeInTheDocument();
		} finally {
			setKaleidoscopeEnabled(false);
		}
	});

	it('uses the shared animation duration for export, with no separate export-duration field', async () => {
		setAnimationDurationSec(7);
		render(PreviewCanvas);
		// the old separate export-duration input is gone
		expect(page.getByLabelText('Durata (s)', { exact: true }).query()).toBeNull();
		// the shared duration is the single source export reads
		expect(animationState.durationSec).toBe(7);
	});

});
