import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Composition, ColorModeState, Path } from '$lib/types';

const initialComposition: Composition = {
	baseRadius: 100,
	ringIncrement: 50,
	rings: [],
	monochromePalettes: [{ main: '#000000', bg: '#ffffff' }],
	fullPalettes: [{ colors: ['#1a1a2e', '#16213e', '#0f3460', '#e94560'] }]
};

const initialColorMode: ColorModeState = {
	mode: 'monochrome',
	palette: 0
};

vi.mock('rune-sync/localstorage', () => ({
	lsSync: vi.fn((key: string) => {
		if (key === 'composition') return structuredClone(initialComposition);
		if (key === 'color-mode') return structuredClone(initialColorMode);
		if (key === 'composition-ui') return structuredClone({ expandedRings: {} });
		return {};
	})
}));

describe('composition ring morph actions', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('creates and removes ring morph target', async () => {
		const compositionModule = await import('./composition');

		compositionModule.addRing();
		const before = compositionModule.composition.rings[0].templatePath;

		compositionModule.createRingMorphTarget(0);
		expect(compositionModule.composition.rings[0].secondaryTemplatePath).toEqual(before);

		compositionModule.removeRingMorphTarget(0);
		expect(compositionModule.composition.rings[0].secondaryTemplatePath).toBeNull();
	});

	it('clamps ring morph t', async () => {
		const compositionModule = await import('./composition');

		compositionModule.addRing();

		compositionModule.setRingMorphT(0, 4.2);
		expect(compositionModule.composition.rings[0].morphT).toBe(1);

		compositionModule.setRingMorphT(0, -1);
		expect(compositionModule.composition.rings[0].morphT).toBe(0);
	});

	it('updateRingPathVariant updates primary path when no morph target', async () => {
		const compositionModule = await import('./composition');
		compositionModule.addRing();
		const next: Path = { cmds: ['M', 'L', 'Z'], crds: [0, 0, 10, 10] };
		const result = compositionModule.updateRingPathVariant(0, 'primary', next);
		expect(result).toEqual({ ok: true });
		expect(compositionModule.composition.rings[0].templatePath).toEqual(next);
	});

	it('updateRingPathVariant updates secondary when compatible with primary', async () => {
		const compositionModule = await import('./composition');
		compositionModule.addRing();
		compositionModule.createRingMorphTarget(0);
		const primary = compositionModule.composition.rings[0].templatePath!;
		const secondary: Path = {
			cmds: [...primary.cmds],
			crds: primary.crds.map((c) => c + 1)
		};
		const result = compositionModule.updateRingPathVariant(0, 'secondary', secondary);
		expect(result).toEqual({ ok: true });
		expect(compositionModule.composition.rings[0].secondaryTemplatePath).toEqual(secondary);
		expect(compositionModule.composition.rings[0].secondaryTemplatePath).not.toBe(
			compositionModule.composition.rings[0].templatePath
		);
	});

	it('updateRingPathVariant rejects incompatible secondary without mutating', async () => {
		const compositionModule = await import('./composition');
		compositionModule.addRing();
		compositionModule.createRingMorphTarget(0);
		const before = structuredClone(compositionModule.composition.rings[0]);
		const incompatible: Path = { cmds: ['M', 'C', 'Z'], crds: [0, 0, 1, 1, 2, 2, 3, 3] };
		const result = compositionModule.updateRingPathVariant(0, 'secondary', incompatible);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected failure');
		expect(result.reason).toBe('Path commands must match exactly to interpolate');
		expect(compositionModule.composition.rings[0]).toEqual(before);
	});
});
