type CreateFallbackBarsDeps = {
	getRingCount: () => number;
};

/**
 * Deterministic, dependency-free dev signal so the cymatic wave visibly animates
 * without a microphone. Each ring gets a smooth value in 0..1 from a sum of slow
 * sines of `performance.now()` and the ring index. This is the seam for Task D:
 * the real Web Audio source will expose the same `readBars(): number[]` contract.
 */
export function createFallbackBars(deps: CreateFallbackBarsDeps): { readBars: () => number[] } {
	return {
		readBars() {
			const count = Math.max(0, Math.floor(deps.getRingCount()));
			const t = performance.now() / 1000;
			const bars: number[] = [];
			for (let i = 0; i < count; i += 1) {
				// a + b stays within [-1, 1] (0.6 + 0.4 = 1), so the result is in 0..1.
				const a = 0.6 * Math.sin(t * 1.3 + i * 0.9);
				const b = 0.4 * Math.sin(t * 0.7 + i * 1.7 + 1.1);
				bars.push(0.5 + 0.5 * (a + b));
			}
			return bars;
		}
	};
}
