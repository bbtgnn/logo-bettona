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
};

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function createAudioBarsDriver(deps: CreateAudioBarsDriverDeps): AnimationDriver {
	return {
		init() {
			deps.getConfig();
		},
		dispose() {
			// no-op in v1
		},
		frame(_nowMs) {
			const ringCount = Math.max(0, deps.getRingCount());
			const bars = deps.readBars();
			const frame: Record<number, number> = {};

			for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
				frame[ringIndex] = clamp01(bars[ringIndex] ?? 0);
			}

			return frame;
		}
	};
}
