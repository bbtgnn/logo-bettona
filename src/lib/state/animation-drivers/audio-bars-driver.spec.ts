import { describe, expect, it } from 'vitest';
import type { Ring, WaveConfig, WaveState } from '$lib/types';
import type { AudioBarsConfig } from './types';
import { createAudioBarsDriver } from './audio-bars-driver';

const config: AudioBarsConfig = {
	smoothing: 0.5,
	minHz: 20,
	maxHz: 16000,
	waveCrests: 3,
	waveAmplitudeGain: 0.3,
	wavePhaseSpeed: 2.2,
	inputGain: 1
};

type WaveCall = { index: number; wave: WaveState | null };

function makeRing(waveConfig?: WaveConfig | null): Ring {
	return {
		id: 'test-ring',
		color: '#000000',
		templatePath: null,
		secondaryTemplatePath: null,
		morphT: 0,
		ringHeight: 0.4,
		waveConfig
	};
}

function makeDriver(overrides: {
	ringCount?: number;
	bars?: number[];
	calls: WaveCall[];
	rings?: Ring[];
}) {
	const rings = overrides.rings ?? [];
	return createAudioBarsDriver({
		getConfig: () => config,
		getRingCount: () => overrides.ringCount ?? 2,
		getRing: (i) => rings[i] ?? makeRing(),
		readBars: () => overrides.bars ?? [0.5, 1.1],
		applyRingWave: (index, wave) => overrides.calls.push({ index, wave })
	});
}

describe('createAudioBarsDriver', () => {
	it('applies a wave per ring with amplitude from bands and phase from time', () => {
		const calls: WaveCall[] = [];
		const driver = makeDriver({ ringCount: 2, bars: [0.5, 1.1], calls });

		driver.init();
		const result = driver.frame(1000); // 1s → phaseBase = 1 * 2.2 = 2.2

		expect(result).toEqual({}); // morphT untouched in this mode
		expect(calls).toHaveLength(2);

		// ring 0: amplitude = clamp01(0.5) * 0.3 = 0.15, phase = 2.2 + 0*0.4
		expect(calls[0].index).toBe(0);
		expect(calls[0].wave?.amplitude).toBeCloseTo(0.15, 6);
		expect(calls[0].wave?.crests).toBe(3);
		expect(calls[0].wave?.phase).toBeCloseTo(2.2, 6);

		// ring 1: amplitude = clamp01(1.1) * 0.3 = 0.3, phase = 2.2 + 1*0.4 = 2.6
		expect(calls[1].index).toBe(1);
		expect(calls[1].wave?.amplitude).toBeCloseTo(0.3, 6);
		expect(calls[1].wave?.phase).toBeCloseTo(2.6, 6);
	});

	it('treats missing/non-finite band values as 0 amplitude', () => {
		const calls: WaveCall[] = [];
		const driver = makeDriver({ ringCount: 2, bars: [], calls });

		driver.frame(0);

		expect(calls[0].wave?.amplitude).toBe(0);
		expect(calls[1].wave?.amplitude).toBe(0);
	});

	it('sanitizes a non-integer ring count before iterating', () => {
		const calls: WaveCall[] = [];
		const driver = makeDriver({ ringCount: 2.8, bars: [0.2, 0.4, 0.6], calls });

		driver.frame(0);

		expect(calls.map((c) => c.index)).toEqual([0, 1]);
	});

	it('clears the wave on every ring when disposed', () => {
		const calls: WaveCall[] = [];
		const driver = makeDriver({ ringCount: 3, calls });

		driver.dispose();

		expect(calls).toEqual([
			{ index: 0, wave: null },
			{ index: 1, wave: null },
			{ index: 2, wave: null }
		]);
	});

	it('uses per-ring waveConfig when set, falls back to global for rings without override', () => {
		const calls: WaveCall[] = [];
		const ringOverride: WaveConfig = { crests: 6, amplitudeGain: 0.8, phaseSpeed: 0.5 };
		const driver = makeDriver({
			ringCount: 2,
			bars: [0.5, 1.0],
			calls,
			rings: [makeRing(ringOverride), makeRing()] // ring 0 override; ring 1 inherits global
		});

		driver.frame(2000); // nowMs=2000

		// ring 0: override — crests=6, amplitudeGain=0.8, phaseSpeed=0.5
		expect(calls[0].wave?.crests).toBe(6);
		expect(calls[0].wave?.amplitude).toBeCloseTo(0.5 * 0.8, 6); // 0.4
		expect(calls[0].wave?.phase).toBeCloseTo((2000 / 1000) * 0.5 + 0 * 0.4, 6); // 1.0

		// ring 1: inherits global config (crests=3, amplitudeGain=0.3, phaseSpeed=2.2)
		expect(calls[1].wave?.crests).toBe(3);
		expect(calls[1].wave?.amplitude).toBeCloseTo(1.0 * 0.3, 6); // 0.3
		expect(calls[1].wave?.phase).toBeCloseTo((2000 / 1000) * 2.2 + 1 * 0.4, 6); // 4.8
	});
});
