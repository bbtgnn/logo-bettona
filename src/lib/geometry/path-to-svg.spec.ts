import { describe, it, expect } from 'vitest';
import { pathToSvgD, pathBoundingBox } from './path-to-svg';
import type { Path } from '$lib/types';

describe('pathToSvgD', () => {
	it('emits M and L segments', () => {
		const path: Path = { cmds: ['M', 'L'], crds: [0, 0, 10, 20] };
		expect(pathToSvgD(path)).toBe('M 0 0 L 10 20');
	});

	it('emits a cubic C segment', () => {
		const path: Path = { cmds: ['M', 'C'], crds: [0, 0, 1, 2, 3, 4, 5, 6] };
		expect(pathToSvgD(path)).toBe('M 0 0 C 1 2 3 4 5 6');
	});

	it('emits a quadratic Q segment', () => {
		const path: Path = { cmds: ['M', 'Q'], crds: [0, 0, 1, 2, 3, 4] };
		expect(pathToSvgD(path)).toBe('M 0 0 Q 1 2 3 4');
	});

	it('emits a Z close segment', () => {
		const path: Path = { cmds: ['M', 'L', 'Z'], crds: [0, 0, 10, 10] };
		expect(pathToSvgD(path)).toBe('M 0 0 L 10 10 Z');
	});

	it('throws when crds arity does not match cmds', () => {
		const path: Path = { cmds: ['M', 'L'], crds: [0, 0, 10] }; // L expects 2 coords
		expect(() => pathToSvgD(path)).toThrow();
	});
});

describe('pathBoundingBox', () => {
	it('returns 0-sized box for a single move', () => {
		const path: Path = { cmds: ['M'], crds: [5, 7] };
		expect(pathBoundingBox(path)).toEqual({ x: 5, y: 7, w: 0, h: 0 });
	});

	it('scans coordinate pairs for min/max', () => {
		const path: Path = { cmds: ['M', 'L', 'L'], crds: [0, 0, 10, -3, 4, 8] };
		expect(pathBoundingBox(path)).toEqual({ x: 0, y: -3, w: 10, h: 11 });
	});

	it('includes Bezier handle coordinates', () => {
		const path: Path = { cmds: ['M', 'C'], crds: [0, 0, 5, 100, -2, 50, 10, 10] };
		expect(pathBoundingBox(path)).toEqual({ x: -2, y: 0, w: 12, h: 100 });
	});

	it('throws when crds length is odd', () => {
		const path: Path = { cmds: ['M'], crds: [1, 2, 3] };
		expect(() => pathBoundingBox(path)).toThrow();
	});
});
