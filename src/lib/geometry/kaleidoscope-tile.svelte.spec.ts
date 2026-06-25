import { describe, it, expect } from 'vitest';
import { composeTileWithBackground } from './kaleidoscope-tile';

function solidAlphaCanvas(): HTMLCanvasElement {
	const c = document.createElement('canvas');
	c.width = 4;
	c.height = 4;
	// leave fully transparent
	return c;
}

describe('composeTileWithBackground', () => {
	it('returns the source unchanged when background is null', () => {
		const src = solidAlphaCanvas();
		expect(composeTileWithBackground(src, null)).toBe(src);
	});

	it('paints an opaque background behind the source', () => {
		const src = solidAlphaCanvas();
		const out = composeTileWithBackground(src, '#ff0000');
		expect(out).not.toBe(src);
		const data = out.getContext('2d')!.getImageData(0, 0, 1, 1).data;
		expect(data[0]).toBe(255); // red
		expect(data[3]).toBe(255); // opaque
	});
});
