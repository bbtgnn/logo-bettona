import { describe, it, expect } from 'vitest';
import { pathToSvgD } from './path-to-svg';
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
