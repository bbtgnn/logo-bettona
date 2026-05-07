import type { DataSeriesConfig } from './types';

type AnimationDriver = {
	init: () => void;
	dispose: () => void;
	frame: (nowMs: number) => Record<number, number>;
};

type NormalizedSeriesByRing = Record<number, number[]>;

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function normalizeSeries(values: number[]): number[] {
	const filtered = values.filter((value) => Number.isFinite(value));
	if (filtered.length === 0) return [];
	if (filtered.length === 1) return [0];

	let min = filtered[0];
	let max = filtered[0];
	for (const value of filtered) {
		if (value < min) min = value;
		if (value > max) max = value;
	}

	if (max === min) {
		return filtered.map(() => 0);
	}

	const span = max - min;
	return filtered.map((value) => (value - min) / span);
}

function buildNormalizedSeriesMap(seriesByRingIndex: Record<number, number[]>): NormalizedSeriesByRing {
	const normalizedByRing: NormalizedSeriesByRing = {};

	for (const [rawRingIndex, values] of Object.entries(seriesByRingIndex)) {
		const ringIndex = Number(rawRingIndex);
		if (!Number.isInteger(ringIndex) || ringIndex < 0 || !Array.isArray(values)) continue;

		const normalized = normalizeSeries(values);
		if (normalized.length === 0) continue;
		normalizedByRing[ringIndex] = normalized;
	}

	return normalizedByRing;
}

function interpolateSeries(series: number[], progress: number): number {
	if (series.length === 1) return series[0];

	const clampedProgress = clamp01(progress);
	const scaled = clampedProgress * (series.length - 1);
	const leftIndex = Math.floor(scaled);
	const rightIndex = Math.min(series.length - 1, leftIndex + 1);
	const alpha = scaled - leftIndex;

	return series[leftIndex] * (1 - alpha) + series[rightIndex] * alpha;
}

type CreateDataSeriesDriverDeps = {
	getConfig: () => DataSeriesConfig;
};

export function createDataSeriesDriver(deps: CreateDataSeriesDriverDeps): AnimationDriver {
	let startedAtMs: number | null = null;

	return {
		init() {
			// Anchor elapsed time to the first observed frame timestamp after activation.
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

			const config = deps.getConfig();
			const normalizedSeriesByRing = buildNormalizedSeriesMap(config.seriesByRingIndex);
			const elapsedSec = Math.max(0, (nowMs - startedAtMs) / 1000);
			const speed = Number.isFinite(config.speed) ? Math.max(0, config.speed) : 1;
			const rawProgress = elapsedSec * speed;
			const progress =
				config.loop && rawProgress > 0 ? rawProgress - Math.floor(rawProgress) : clamp01(rawProgress);

			const frame: Record<number, number> = {};
			for (const [rawRingIndex, series] of Object.entries(normalizedSeriesByRing)) {
				if (series.length === 0) continue;
				frame[Number(rawRingIndex)] = interpolateSeries(series, progress);
			}
			return frame;
		}
	};
}
