import { describe, it, expect } from 'vitest';
import {
	buildAudioBarsParams,
	buildAudioZonesParams,
	buildRingWaveParams,
	buildRingMorphParams
} from './animatable-params';
import type { AudioBarsConfig } from './animation-drivers/types';
import type { Ring, WaveConfig } from '$lib/types';

const barsLabels = {
	inputGain: 'Gain',
	waveCrests: 'Crests',
	waveAmplitudeGain: 'Amplitude',
	wavePhaseSpeed: 'Phase',
	smoothing: 'Smoothing'
};

function makeBarsConfig(): AudioBarsConfig {
	return {
		smoothing: 0.5,
		minHz: 20,
		maxHz: 20000,
		waveCrests: 3,
		waveAmplitudeGain: 0.3,
		wavePhaseSpeed: 2.2,
		inputGain: 1
	};
}

describe('buildAudioBarsParams', () => {
	it('exposes one param per animatable bars field with stable ids', () => {
		const cfg = makeBarsConfig();
		const params = buildAudioBarsParams({
			getConfig: () => cfg,
			setConfig: () => {},
			labels: barsLabels
		});
		expect(params.map((p) => p.id)).toEqual([
			'audioBars.inputGain',
			'audioBars.waveCrests',
			'audioBars.waveAmplitudeGain',
			'audioBars.wavePhaseSpeed',
			'audioBars.smoothing'
		]);
	});

	it('get reads live config; set routes through setConfig', () => {
		let cfg = makeBarsConfig();
		const params = buildAudioBarsParams({
			getConfig: () => cfg,
			setConfig: (patch) => (cfg = { ...cfg, ...patch }),
			labels: barsLabels
		});
		const crests = params.find((p) => p.id === 'audioBars.waveCrests')!;
		expect(crests.get()).toBe(3);
		crests.set(5);
		expect(cfg.waveCrests).toBe(5);
	});
});

describe('buildAudioZonesParams', () => {
	it('exposes bass/mid/treble params routing through setIntensity', () => {
		let intensity = { bass: 0.5, mid: 0.5, treble: 0.5 };
		const params = buildAudioZonesParams({
			getIntensity: () => intensity,
			setIntensity: (patch) => (intensity = { ...intensity, ...patch }),
			labels: { bass: 'Bass', mid: 'Mid', treble: 'Treble' }
		});
		expect(params.map((p) => p.id)).toEqual([
			'audioZones.bass',
			'audioZones.mid',
			'audioZones.treble'
		]);
		params.find((p) => p.id === 'audioZones.mid')!.set(0.9);
		expect(intensity.mid).toBe(0.9);
	});
});

describe('buildRingWaveParams', () => {
	const globalDefault: WaveConfig = { crests: 3, amplitudeGain: 0.3, phaseSpeed: 2.2 };

	function ringWithOverride(): Ring {
		return {
			id: 'r-wave-test',
			waveConfig: { crests: 2, amplitudeGain: 0.4, phaseSpeed: 1 }
		} as Ring;
	}

	it('builds per-ring descriptors only for rings with a wave override', () => {
		const rings = [ringWithOverride(), { id: 'r-empty' } as Ring];
		const params = buildRingWaveParams(rings, {
			updateRing: () => {},
			globalDefault: () => globalDefault,
			ringLabel: (i) => `Ring ${i + 1}`
		});
		// ring 0 has override → 3 params; ring 1 has none → 0 params
		expect(params.map((p) => p.id)).toEqual([
			'ring.r-wave-test.wave.crests',
			'ring.r-wave-test.wave.amplitudeGain',
			'ring.r-wave-test.wave.phaseSpeed'
		]);
	});

	it('set patches the ring waveConfig via updateRing, preserving siblings', () => {
		const r = ringWithOverride();
		const calls: Array<[number, Partial<Ring>]> = [];
		const params = buildRingWaveParams([r], {
			updateRing: (i, patch) => calls.push([i, patch]),
			globalDefault: () => globalDefault,
			ringLabel: (i) => `Ring ${i + 1}`
		});
		params.find((p) => p.id === 'ring.r-wave-test.wave.crests')!.set(6);
		expect(calls).toEqual([[0, { waveConfig: { crests: 6, amplitudeGain: 0.4, phaseSpeed: 1 } }]]);
	});
});

describe('buildRingMorphParams', () => {
	function ringWithMorph(): Ring {
		return { id: 'r-morph-test', secondaryTemplatePath: { cmds: [], crds: [] }, morphT: 0.3 } as unknown as Ring;
	}

	it('builds a param only for rings with a morph target', () => {
		const rings = [ringWithMorph(), { id: 'r-empty' } as Ring];
		const params = buildRingMorphParams(rings, {
			setMorphT: () => {},
			ringLabel: (i) => `Ring ${i + 1}`
		});
		expect(params.map((p) => p.id)).toEqual(['ring.r-morph-test.morphT']);
		expect(params[0].min).toBe(0);
		expect(params[0].max).toBe(1);
		expect(params[0].step).toBe(0.01);
	});

	it('get reads live morphT; set routes through setMorphT with the ring index', () => {
		const rings = [{ id: 'r-empty' } as Ring, ringWithMorph()];
		const calls: Array<[number, number]> = [];
		const params = buildRingMorphParams(rings, {
			setMorphT: (i, v) => calls.push([i, v]),
			ringLabel: (i) => `Ring ${i + 1}`
		});
		expect(params[0].id).toBe('ring.r-morph-test.morphT');
		expect(params[0].get()).toBe(0.3);
		params[0].set(0.8);
		expect(calls).toEqual([[1, 0.8]]);
	});
});

const ring = (over: Partial<Ring>): Ring =>
	({
		id: 'r-abc',
		copies: 8,
		color: '#000',
		templatePath: { cmds: ['M'], crds: [0, 0] },
		secondaryTemplatePath: null,
		morphT: 0,
		ringHeight: 0.1,
		...over
	}) as Ring;

describe('per-ring param ids carry the ring id, not the index', () => {
	it('morph param id is ring.<id>.morphT', () => {
		const rings = [ring({ id: 'r-abc', secondaryTemplatePath: { cmds: ['M'], crds: [0, 0] } })];
		const params = buildRingMorphParams(rings, {
			setMorphT: () => {},
			ringLabel: () => 'Ring 1'
		});
		expect(params.map((p) => p.id)).toEqual(['ring.r-abc.morphT']);
	});

	it('wave param ids are ring.<id>.wave.*', () => {
		const rings = [
			ring({ id: 'r-xyz', waveConfig: { crests: 2, amplitudeGain: 0.5, phaseSpeed: 1 } })
		];
		const params = buildRingWaveParams(rings, {
			updateRing: () => {},
			globalDefault: () => ({ crests: 1, amplitudeGain: 0, phaseSpeed: 0 }),
			ringLabel: () => 'Ring 1'
		});
		expect(params.map((p) => p.id)).toEqual([
			'ring.r-xyz.wave.crests',
			'ring.r-xyz.wave.amplitudeGain',
			'ring.r-xyz.wave.phaseSpeed'
		]);
	});

	it('id is stable when the ring moves to a new index', () => {
		const moved = [ring({ id: 'pad' }), ring({ id: 'r-abc', secondaryTemplatePath: { cmds: ['M'], crds: [0, 0] } })];
		const params = buildRingMorphParams(moved, { setMorphT: () => {}, ringLabel: () => 'x' });
		expect(params.map((p) => p.id)).toEqual(['ring.r-abc.morphT']);
	});
});
