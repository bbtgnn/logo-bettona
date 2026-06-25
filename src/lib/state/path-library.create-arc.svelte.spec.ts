import { describe, it, expect, beforeEach } from 'vitest';
import { pathLibrary, createCurveFromArc } from '$lib/state/path-library';

describe('createCurveFromArc', () => {
	beforeEach(() => {
		pathLibrary.entries = [];
	});

	it('creates a non-builtin user entry seeded from an arc', () => {
		const e = createCurveFromArc();
		expect(e.builtin).toBeFalsy();
		expect(e.secondaryPath).toBeNull();
		expect(e.path.cmds.length).toBeGreaterThan(0);
		expect(e.path.crds.length % 2).toBe(0);
		expect(pathLibrary.entries).toContainEqual(e);
	});

	it('numbers new curves by custom-entry count', () => {
		const a = createCurveFromArc();
		const b = createCurveFromArc();
		expect(a.name).toBe('Nuova curva 1');
		expect(b.name).toBe('Nuova curva 2');
		expect(a.id).not.toBe(b.id);
	});

	it('each entry carries an independent copy of the seed path', () => {
		const a = createCurveFromArc();
		const b = createCurveFromArc();
		expect(a.path).not.toBe(b.path);
		expect(a.path).toEqual(b.path);
	});
});
