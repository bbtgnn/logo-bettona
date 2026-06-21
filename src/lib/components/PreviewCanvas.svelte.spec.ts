import type paper from 'paper';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { RenderInput } from '$lib/geometry/render-pipeline';
import { composition, colorMode } from '$lib/state/composition';
import { animationState, setAnimationDurationSec } from '$lib/state/animation';
import { setKaleidoscopeEnabled } from '$lib/state/kaleidoscope.svelte';
import { switchLocale } from '$lib/state/locale.svelte';

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
		switchLocale('en');
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

	it('off the animate surface, exposes only Export SVG', async () => {
		render(PreviewCanvas);
		await expect.element(page.getByRole('button', { name: 'Export SVG' })).toBeInTheDocument();
		expect(page.getByRole('button', { name: 'Export animation' }).query()).toBeNull();
		expect(page.getByText('Includi audio').query()).toBeNull();
		expect(page.getByText('Esporta PNG (caleidoscopio)').query()).toBeNull();
		expect(page.getByText('Esporta SVG (caleidoscopio)').query()).toBeNull();
	});

	it('on the animate surface, shows the Export animation button next to Export SVG', async () => {
		render(PreviewCanvas, { animate: true });
		await expect.element(page.getByRole('button', { name: 'Export SVG' })).toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Export animation' }))
			.toBeInTheDocument();
	});

	it('Export SVG downloads the kaleidoscope SVG when kaleidoscope mode is on', async () => {
		const downloads: string[] = [];
		const origClick = HTMLAnchorElement.prototype.click;
		HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
			downloads.push(this.download);
		};
		setKaleidoscopeEnabled(true);
		try {
			render(PreviewCanvas);
			await userEvent.click(page.getByRole('button', { name: 'Export SVG' }));
			expect(downloads).toContain('kaleidoscope.svg');
			expect(downloads).not.toContain('composition.svg');
		} finally {
			HTMLAnchorElement.prototype.click = origClick;
			setKaleidoscopeEnabled(false);
		}
	});

	it('export reads the shared animation duration (no separate export-duration field)', async () => {
		setAnimationDurationSec(7);
		render(PreviewCanvas);
		expect(page.getByLabelText('Durata (s)', { exact: true }).query()).toBeNull();
		expect(animationState.durationSec).toBe(7);
	});

	it('paints a palette-colored background rect behind the rings in flat mode', async () => {
		composition.monochromePalettes = [
			{ primary: '#000000', secondary: '#ffffff', background: '#112233' }
		];
		colorMode.palette = 0;

		render(PreviewCanvas);

		await vi.waitFor(() => {
			expect(lastRenderedScope).toBeDefined();
			const children = lastRenderedScope!.project.activeLayer.children;
			const bg = children.find((c) => c.name === 'preview-background');
			expect(bg).toBeDefined();
			// back-most item
			expect(children.indexOf(bg!)).toBe(0);
			expect((bg as paper.Path).fillColor?.toCSS(true)).toBe('#112233');
		});
	});

	it('updates the background rect color when the palette background changes', async () => {
		composition.monochromePalettes = [
			{ primary: '#000000', secondary: '#ffffff', background: '#112233' }
		];
		colorMode.palette = 0;

		render(PreviewCanvas);

		await vi.waitFor(() => {
			const bg = lastRenderedScope!.project.activeLayer.children.find(
				(c) => c.name === 'preview-background'
			);
			expect((bg as paper.Path)?.fillColor?.toCSS(true)).toBe('#112233');
		});

		composition.monochromePalettes = [
			{ primary: '#000000', secondary: '#ffffff', background: '#445566' }
		];

		await vi.waitFor(() => {
			const bg = lastRenderedScope!.project.activeLayer.children.find(
				(c) => c.name === 'preview-background'
			);
			expect((bg as paper.Path)?.fillColor?.toCSS(true)).toBe('#445566');
		});
	});

	it('flat Export SVG produces no download when there are no rings', async () => {
		composition.rings = [];
		const downloads: string[] = [];
		const origClick = HTMLAnchorElement.prototype.click;
		HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
			downloads.push(this.download);
		};
		try {
			render(PreviewCanvas);
			await vi.waitFor(() => expect(lastRenderedScope).toBeDefined());
			await userEvent.click(page.getByRole('button', { name: 'Export SVG' }));
			expect(downloads).not.toContain('composition.svg');
		} finally {
			HTMLAnchorElement.prototype.click = origClick;
		}
	});
});
