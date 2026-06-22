import { describe, it, expect } from 'vitest';
import {
	buildAudioBarsParams,
	buildAudioZonesParams,
	buildRingWaveParams
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
			waveConfig: { crests: 2, amplitudeGain: 0.4, phaseSpeed: 1 }
		} as Ring;
	}

	it('builds per-ring descriptors only for rings with a wave override', () => {
		const rings = [ringWithOverride(), {} as Ring];
		const params = buildRingWaveParams(rings, {
			updateRing: () => {},
			globalDefault: () => globalDefault,
			ringLabel: (i) => `Ring ${i + 1}`
		});
		// ring 0 has override → 3 params; ring 1 has none → 0 params
		expect(params.map((p) => p.id)).toEqual([
			'ring.0.wave.crests',
			'ring.0.wave.amplitudeGain',
			'ring.0.wave.phaseSpeed'
		]);
	});

	it('set patches the ring waveConfig via updateRing, preserving siblings', () => {
		const ring = ringWithOverride();
		const calls: Array<[number, Partial<Ring>]> = [];
		const params = buildRingWaveParams([ring], {
			updateRing: (i, patch) => calls.push([i, patch]),
			globalDefault: () => globalDefault,
			ringLabel: (i) => `Ring ${i + 1}`
		});
		params.find((p) => p.id === 'ring.0.wave.crests')!.set(6);
		expect(calls).toEqual([[0, { waveConfig: { crests: 6, amplitudeGain: 0.4, phaseSpeed: 1 } }]]);
	});
});
