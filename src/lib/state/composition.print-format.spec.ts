import { describe, it, expect, beforeEach } from 'vitest';
import {
	canvasFormat,
	setPrintFormat,
	setPrintOrientation,
	getEffectiveCanvasProportion,
	setPaletteBackground,
	getCompositionBackgroundColor,
	colorMode
} from './composition';
import { composition } from './composition-persistence.svelte';

describe('canvas format + background state', () => {
	beforeEach(() => {
		setPrintFormat(null);
		setPrintOrientation('portrait');
		composition.aspectRatio = '1:1';
		composition.monochromePalettes = [
			{ primary: '#000000', secondary: '#ffffff', background: '#ffffff' }
		];
		colorMode.mode = 'monochrome';
		colorMode.palette = 0;
	});

	it('with no print format, proportion follows the aspect ratio', () => {
		composition.aspectRatio = '16:9';
		expect(getEffectiveCanvasProportion()).toEqual({ width: 16, height: 9 });
	});

	it('a print format overrides the proportion with oriented paper mm', () => {
		setPrintFormat('a4');
		expect(getEffectiveCanvasProportion()).toEqual({ width: 210, height: 297 });
		setPrintOrientation('landscape');
		expect(getEffectiveCanvasProportion()).toEqual({ width: 297, height: 210 });
	});

	it('setPaletteBackground updates the active mono palette background', () => {
		setPaletteBackground('#112233');
		expect(getCompositionBackgroundColor()).toBe('#112233');
		expect(composition.monochromePalettes[0].background).toBe('#112233');
	});
});
