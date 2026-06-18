import { describe, it, expect } from 'vitest';
import {
	clampSectors,
	clampRepeat,
	wedgeAngle,
	isSectorMirrored,
	degToRad,
	carpetTileOffsets
} from './kaleidoscope';

describe('kaleidoscope geometry helpers', () => {
	it('clampSectors forces even and clamps to 4..24', () => {
		expect(clampSectors(1)).toBe(4);
		expect(clampSectors(7)).toBe(6);
		expect(clampSectors(8)).toBe(8);
		expect(clampSectors(99)).toBe(24);
	});

	it('clampRepeat clamps to integer 1..10', () => {
		expect(clampRepeat(0)).toBe(1);
		expect(clampRepeat(3.7)).toBe(3);
		expect(clampRepeat(50)).toBe(10);
	});

	it('wedgeAngle is 2π / sectors', () => {
		expect(wedgeAngle(6)).toBeCloseTo((2 * Math.PI) / 6, 10);
	});

	it('isSectorMirrored mirrors even indices', () => {
		expect(isSectorMirrored(0)).toBe(true);
		expect(isSectorMirrored(1)).toBe(false);
		expect(isSectorMirrored(2)).toBe(true);
	});

	it('degToRad converts degrees to radians', () => {
		expect(degToRad(180)).toBeCloseTo(Math.PI, 10);
	});

	it('carpetTileOffsets returns repeat² centered offsets', () => {
		const offsets = carpetTileOffsets(2, 10, 20);
		expect(offsets).toHaveLength(4);
		const sumX = offsets.reduce((a, o) => a + o.x, 0);
		const sumY = offsets.reduce((a, o) => a + o.y, 0);
		expect(sumX).toBeCloseTo(0, 10);
		expect(sumY).toBeCloseTo(0, 10);
		expect(offsets).toContainEqual({ x: -5, y: -10 });
	});
});

import { renderKaleidoscopeToCanvas } from './kaleidoscope';
import type { KaleidoscopeParams } from './kaleidoscope';

function makeRecordingCtx() {
	const calls: Record<string, number> = {};
	const rec = (name: string) => (calls[name] = (calls[name] ?? 0) + 1);
	const ctx = {
		calls,
		fillStyle: '',
		globalCompositeOperation: 'source-over',
		save: () => rec('save'),
		restore: () => rec('restore'),
		translate: () => rec('translate'),
		rotate: () => rec('rotate'),
		scale: () => rec('scale'),
		beginPath: () => rec('beginPath'),
		moveTo: () => rec('moveTo'),
		arc: () => rec('arc'),
		closePath: () => rec('closePath'),
		clip: () => rec('clip'),
		fill: () => rec('fill'),
		fillRect: () => rec('fillRect'),
		clearRect: () => rec('clearRect'),
		drawImage: () => rec('drawImage')
	};
	return ctx as unknown as CanvasRenderingContext2D & { calls: Record<string, number> };
}

const baseParams: KaleidoscopeParams = {
	sectors: 6,
	repeat: 2,
	offsetDistance: 0.1,
	scale: 1,
	tileSize: 0.5,
	tileRotation: 0,
	carpetRotation: 0,
	globalRotation: 0,
	circularMask: false,
	backgroundColor: '#000000',
	drawBackground: false
};

describe('renderKaleidoscopeToCanvas', () => {
	it('clips once per sector and draws repeat² tiles per sector', () => {
		const ctx = makeRecordingCtx() as ReturnType<typeof makeRecordingCtx>;
		const tile = {} as CanvasImageSource;
		renderKaleidoscopeToCanvas(ctx, tile, 100, 100, baseParams, 600);
		expect(ctx.calls.clip).toBe(6);
		expect(ctx.calls.drawImage).toBe(6 * 4);
		expect(ctx.calls.save).toBe(ctx.calls.restore);
	});

	it('paints background when drawBackground is true', () => {
		const ctx = makeRecordingCtx() as ReturnType<typeof makeRecordingCtx>;
		renderKaleidoscopeToCanvas(ctx, {} as CanvasImageSource, 100, 100, { ...baseParams, drawBackground: true }, 600);
		expect(ctx.calls.fillRect).toBe(1);
	});

	it('applies the circular mask when enabled', () => {
		const ctx = makeRecordingCtx() as ReturnType<typeof makeRecordingCtx>;
		renderKaleidoscopeToCanvas(ctx, {} as CanvasImageSource, 100, 100, { ...baseParams, circularMask: true }, 600);
		expect(ctx.calls.fill).toBeGreaterThanOrEqual(1);
	});
});

import { extractSvgParts, generateKaleidoscopeSVG } from './kaleidoscope';

const tileSvg =
	'<svg width="100" height="50" viewBox="0 0 100 50" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="50" fill="#0f0"/></svg>';

describe('extractSvgParts', () => {
	it('pulls inner markup and viewBox', () => {
		const { inner, viewBox } = extractSvgParts(tileSvg);
		expect(viewBox).toBe('0 0 100 50');
		expect(inner).toContain('<rect');
	});
});

describe('generateKaleidoscopeSVG', () => {
	it('emits one wedge clip use per sector and repeat² tile uses each', () => {
		const out = generateKaleidoscopeSVG(tileSvg, baseParams, 600);
		expect((out.match(/clip-path="url\(#kaleido-wedge\)"/g) ?? [])).toHaveLength(6);
		expect((out.match(/<use href="#kaleido-tile"/g) ?? [])).toHaveLength(6 * 4);
	});

	it('mirrors even sectors and includes background + mask when enabled', () => {
		const out = generateKaleidoscopeSVG(
			tileSvg,
			{ ...baseParams, drawBackground: true, circularMask: true },
			600
		);
		expect(out).toContain('scale(-1,1)');
		expect(out).toContain('<rect');
		expect(out).toContain('clip-path="url(#kaleido-outer)"');
	});

	it('parses viewBox with commas / irregular whitespace (aspect parity)', () => {
		// vbW=100 vbH=50, tileSize 0.5, size 600, maxSide 100 → drawH = 600*0.5*(50/100) = 150.
		const commaTile =
			'<svg viewBox="0,0,100,50" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="50" fill="#0f0"/></svg>';
		const spacedTile =
			'<svg viewBox="0  0   100   50" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="50" fill="#0f0"/></svg>';
		expect(generateKaleidoscopeSVG(commaTile, baseParams, 600)).toContain('height="150.0000"');
		expect(generateKaleidoscopeSVG(spacedTile, baseParams, 600)).toContain('height="150.0000"');
	});

	it('escapes the background color before interpolating into the fill attribute', () => {
		const out = generateKaleidoscopeSVG(
			tileSvg,
			{ ...baseParams, drawBackground: true, backgroundColor: '"><script>x' },
			600
		);
		expect(out).not.toContain('"><script>');
		expect(out).toContain('&quot;&gt;&lt;script&gt;x');
	});
});
