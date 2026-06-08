import type { WaveState } from '$lib/types';
import type { AudioBarsConfig } from './types';

type AnimationDriver = {
	init: () => void;
	dispose: () => void;
	frame: (nowMs: number) => Record<number, number>;
};

type CreateAudioBarsDriverDeps = {
	getConfig: () => AudioBarsConfig;
	getRingCount: () => number;
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

/**
 * In `audioBars` mode, per-band energy drives the corresponding ring's wave
 * AMPLITUDE; the phase scrolls over time (travelling wave → sense of rotation);
 * crests are constant from config. We pilot the wave only — `morphT`/breathing is
 * a separate concern, so `frame` returns `{}` (the runtime applies returned values
 * as morphT) and the wave is pushed via the injected `applyRingWave` side-effect.
 * A small per-ring phase offset makes the rings feel more organic.
 */
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
			const phaseBase = ((Number.isFinite(nowMs) ? nowMs : 0) / 1000) * cfg.wavePhaseSpeed;

			for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
				deps.applyRingWave(ringIndex, {
					amplitude: clamp01(bars[ringIndex] ?? 0) * cfg.waveAmplitudeGain,
					crests: cfg.waveCrests,
					phase: phaseBase + ringIndex * 0.4
				});
			}

			return {};
		}
	};
}
