import { describe, it, expect } from 'vitest';
import { composeRingTemplate } from './compose-ring';
import { applyWaveToPath } from './wave';
import { interpolatePath } from './path-morph';
import type { Path, Ring } from '$lib/types';

const A: Path = { cmds: ['M', 'L', 'L'], crds: [0, 0, 10, 0, 10, 10] };
const B: Path = { cmds: ['M', 'L', 'L'], crds: [0, 0, 20, 0, 20, 20] };
const INCOMPAT: Path = { cmds: ['M', 'C'], crds: [0, 0, 1, 1, 2, 2, 3, 3] };

const ring = (over: Partial<Ring>): Ring =>
	({
		id: 'r',
		copies: 8,
		color: '#000',
		templatePath: A,
		secondaryTemplatePath: null,
		morphT: 0,
		ringHeight: 0.12,
		...over
	}) as Ring;

describe('composeRingTemplate', () => {
	it('returns null path when the ring has no template', () => {
		const out = composeRingTemplate(ring({ templatePath: null }));
		expect(out.path).toBeNull();
		expect(out.morphWarning).toBeNull();
	});

	it('passes the primary template through untouched when no secondary and no wave', () => {
		const out = composeRingTemplate(ring({}));
		expect(out.path).toEqual(A);
		expect(out.morphWarning).toBeNull();
	});

	it('morph-interpolates toward the secondary at morphT', () => {
		const out = composeRingTemplate(ring({ secondaryTemplatePath: B, morphT: 0.5 }));
		expect(out.path).toEqual(interpolatePath(A, B, 0.5));
		expect(out.morphWarning).toBeNull();
	});

	it('skips morph and reports a warning when paths are incompatible', () => {
		const out = composeRingTemplate(ring({ secondaryTemplatePath: INCOMPAT, morphT: 0.5 }));
		expect(out.path).toEqual(A); // primary, unchanged
		expect(out.morphWarning).toBeTypeOf('string');
		expect(out.morphWarning!.length).toBeGreaterThan(0);
	});

	it('ignoreMorph bypasses the secondary even when compatible', () => {
		const out = composeRingTemplate(ring({ secondaryTemplatePath: B, morphT: 0.5 }), {
			ignoreMorph: true
		});
		expect(out.path).toEqual(A);
		expect(out.morphWarning).toBeNull();
	});

	it('applies the wave on top of the (morphed) template', () => {
		const wave = { amplitude: 0.3, crests: 2, phase: 0 };
		const out = composeRingTemplate(ring({ secondaryTemplatePath: B, morphT: 0.5, wave }));
		expect(out.path).toEqual(applyWaveToPath(interpolatePath(A, B, 0.5), wave));
	});

	it('does not apply the wave when amplitude is 0', () => {
		const out = composeRingTemplate(ring({ wave: { amplitude: 0, crests: 2, phase: 0 } }));
		expect(out.path).toEqual(A);
	});
});
