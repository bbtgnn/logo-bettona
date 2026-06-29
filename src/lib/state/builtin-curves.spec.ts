import { describe, it, expect } from 'vitest';
import { BUILTIN_CURVES } from '$lib/state/builtin-curves';

describe('BUILTIN_CURVES', () => {
	it('exposes exactly 10 curves', () => {
		expect(BUILTIN_CURVES).toHaveLength(10);
	});

	it('all are builtin, single-path, with stable sequential ids', () => {
		BUILTIN_CURVES.forEach((c, i) => {
			expect(c.builtin).toBe(true);
			expect(c.secondaryPath).toBeNull();
			expect(c.id).toBe(`builtin-${i}`);
			expect(c.createdAt).toBe(0);
			expect(c.path.cmds.length).toBeGreaterThan(0);
			expect(c.path.crds.length % 2).toBe(0);
			expect(c.name.trim().length).toBeGreaterThan(0);
		});
	});

	it('has unique ids', () => {
		const ids = new Set(BUILTIN_CURVES.map((c) => c.id));
		expect(ids.size).toBe(10);
	});
});
