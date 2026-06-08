import type { AudioBarsConfig } from './types';

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

/**
 * Reduces a frequency-magnitude spectrum (analyser.getByteFrequencyData output) to
 * `ringCount` log-spaced bands between minHz and maxHz, each normalized to 0..1 and
 * scaled by inputGain. Log spacing reads voice/ambience better than linear. Pure —
 * no Web Audio references — so it is unit-testable on its own.
 */
export function reduceToBands(
	freq: Uint8Array,
	ringCount: number,
	minHz: number,
	maxHz: number,
	sampleRate: number,
	fftSize: number,
	inputGain: number
): number[] {
	if (ringCount <= 0) return [];

	const binHz = sampleRate / fftSize;
	const safeMin = Math.max(1, minHz);
	const safeMax = Math.max(safeMin + 1, maxHz);
	const ratio = safeMax / safeMin;

	const bands: number[] = [];
	for (let b = 0; b < ringCount; b += 1) {
		const loHz = safeMin * Math.pow(ratio, b / ringCount);
		const hiHz = safeMin * Math.pow(ratio, (b + 1) / ringCount);

		let loBin = Math.floor(loHz / binHz);
		let hiBin = Math.ceil(hiHz / binHz);
		loBin = Math.max(0, Math.min(loBin, freq.length - 1));
		hiBin = Math.max(loBin + 1, Math.min(hiBin, freq.length));

		let sum = 0;
		let count = 0;
		for (let i = loBin; i < hiBin; i += 1) {
			sum += freq[i];
			count += 1;
		}
		const avg = count > 0 ? sum / count : 0;
		bands.push(clamp01((avg / 255) * inputGain));
	}
	return bands;
}
