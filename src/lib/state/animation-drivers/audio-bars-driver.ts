import type { Ring, WaveState } from '$lib/types';
import type { AudioBarsConfig } from './types';
import { resolveWaveConfig } from '$lib/geometry/wave';

type AnimationDriver = {
	init: () => void;
	dispose: () => void;
	frame: (nowMs: number) => Record<number, number>;
};

type CreateAudioBarsDriverDeps = {
	getConfig: () => AudioBarsConfig;
	getRingCount: () => number;
	getRing: (index: number) => Ring;
	readBars: () => number[];
	applyRingWave: (index: number, wave: WaveState | null) => void;
};

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function normalizeRingCount(value: number): number {
	if (!Number.isFinite(value)) return 0;
	if (!Number.isInteger(value)) return Math.max(0, Math.floor(value));
	return Math.max(0, value);
}

export function createAudioBarsDriver(deps: CreateAudioBarsDriverDeps): AnimationDriver {
	return {
		init() {
			deps.getConfig();
		},
		dispose() {
			const ringCount = normalizeRingCount(deps.getRingCount());
			for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
				deps.applyRingWave(ringIndex, null);
			}
		},
		frame(nowMs) {
			const cfg = deps.getConfig();
			const ringCount = normalizeRingCount(deps.getRingCount());
			const bars = deps.readBars();
			const nowSec = (Number.isFinite(nowMs) ? nowMs : 0) / 1000;

			const globalDefault = {
				crests: cfg.waveCrests,
				amplitudeGain: cfg.waveAmplitudeGain,
				phaseSpeed: cfg.wavePhaseSpeed
			};

			for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
				const ring = deps.getRing(ringIndex);
				const ringCfg = resolveWaveConfig(ring, globalDefault);
				deps.applyRingWave(ringIndex, {
					amplitude: clamp01(bars[ringIndex] ?? 0) * ringCfg.amplitudeGain,
					crests: ringCfg.crests,
					phase: nowSec * ringCfg.phaseSpeed + ringIndex * 0.4
				});
			}

			return {};
		}
	};
}
