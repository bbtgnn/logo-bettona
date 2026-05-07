type AnimationDriver = {
	init: () => void;
	dispose: () => void;
	frame: (nowMs: number) => Record<number, number>;
};

type CreateSimpleDriverDeps = {
	getRingCount: () => number;
	getDurationSec: () => number;
};

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function normalizeRingCount(value: number): number {
	if (!Number.isFinite(value)) return 0;
	if (!Number.isInteger(value)) return Math.max(0, Math.floor(value));
	return Math.max(0, value);
}

function normalizeDurationMs(valueSec: number): number {
	if (!Number.isFinite(valueSec)) return 100;
	return Math.max(100, valueSec * 1000);
}

export function createSimpleDriver(deps: CreateSimpleDriverDeps): AnimationDriver {
	let startedAtMs: number | null = null;

	return {
		init() {
			startedAtMs = null;
		},
		dispose() {
			startedAtMs = null;
		},
		frame(nowMs) {
			if (!Number.isFinite(nowMs)) return {};
			if (startedAtMs === null) {
				startedAtMs = nowMs;
			}

			const elapsedMs = Math.max(0, nowMs - startedAtMs);
			const durationMs = normalizeDurationMs(deps.getDurationSec());
			const progress = clamp01((elapsedMs / durationMs) % 1);
			const ringCount = normalizeRingCount(deps.getRingCount());
			const frame: Record<number, number> = {};

			for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
				frame[ringIndex] = progress;
			}

			return frame;
		}
	};
}
