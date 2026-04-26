// Intentional TDD red-state test: expected to fail until Task 2 implements path-morph.ts.
import { describe, it, expect } from 'vitest';
import type { Path } from '$lib/types';
import { interpolatePath, validatePathCompatibility, PathMorphError } from './path-morph';

const primaryPath: Path = {
	cmds: ['M', 'L', 'L', 'Z'],
	crds: [0, 0, 10, 0, 10, 10]
};

const secondaryPath: Path = {
	cmds: ['M', 'L', 'L', 'Z'],
	crds: [10, 10, 20, 10, 20, 20]
};

describe('validatePathCompatibility', () => {
	it('ok on matching path shape', () => {
		expect(validatePathCompatibility(primaryPath, secondaryPath)).toEqual({
			ok: true
		});
	});

	it('mismatch on command sequence difference', () => {
		const mismatchPath: Path = {
			cmds: ['M', 'L', 'Q', 'Z'],
			crds: [10, 10, 20, 10, 20, 20, 30, 30]
		};

		expect(validatePathCompatibility(primaryPath, mismatchPath)).toEqual({
			ok: false,
			reason: 'Path commands must match exactly to interpolate'
		});
	});
});

describe('interpolatePath', () => {
	it('returns primary at t=0, secondary at t=1', () => {
		expect(interpolatePath(primaryPath, secondaryPath, 0)).toEqual(primaryPath);
		expect(interpolatePath(primaryPath, secondaryPath, 1)).toEqual(secondaryPath);
	});

	it('midpoint at t=0.5', () => {
		expect(interpolatePath(primaryPath, secondaryPath, 0.5)).toEqual({
			cmds: ['M', 'L', 'L', 'Z'],
			crds: [5, 5, 15, 5, 15, 15]
		});
	});

	it('clamps t outside [0,1]', () => {
		expect(interpolatePath(primaryPath, secondaryPath, -1)).toEqual(primaryPath);
		expect(interpolatePath(primaryPath, secondaryPath, 2)).toEqual(secondaryPath);
	});

	it('throws PathMorphError on incompatible paths', () => {
		const incompatiblePath: Path = {
			cmds: ['M', 'Q', 'Z'],
			crds: [10, 10, 15, 15, 20, 20]
		};

		expect(() => interpolatePath(primaryPath, incompatiblePath, 0.5)).toThrow(PathMorphError);
	});
});
