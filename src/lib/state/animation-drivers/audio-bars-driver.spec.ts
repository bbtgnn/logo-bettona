import { describe, expect, it } from 'vitest';
import { createAudioBarsDriver } from './audio-bars-driver';

describe('createAudioBarsDriver', () => {
	it('returns one bounded value per ring index when analyzer data is available', () => {
		const driver = createAudioBarsDriver({
			getConfig: () => ({ smoothing: 0.5, minHz: 20, maxHz: 16000 }),
			getRingCount: () => 3,
			readBars: () => [0.2, 1.1, -0.4]
		});

		driver.init();
		const frame = driver.frame(1000);

		expect(frame).toEqual({ 0: 0.2, 1: 1, 2: 0 });
	});
});
