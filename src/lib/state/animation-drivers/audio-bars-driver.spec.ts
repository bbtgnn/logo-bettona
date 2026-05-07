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

	it('sanitizes invalid ring count values before generating frame output', () => {
		const nonIntegerCountDriver = createAudioBarsDriver({
			getConfig: () => ({ smoothing: 0.5, minHz: 20, maxHz: 16000 }),
			getRingCount: () => 2.8,
			readBars: () => [0.2, 1.1, 0.6]
		});
		const infiniteCountDriver = createAudioBarsDriver({
			getConfig: () => ({ smoothing: 0.5, minHz: 20, maxHz: 16000 }),
			getRingCount: () => Number.POSITIVE_INFINITY,
			readBars: () => [0.2, 1.1, 0.6]
		});

		nonIntegerCountDriver.init();
		infiniteCountDriver.init();

		expect(nonIntegerCountDriver.frame(1000)).toEqual({ 0: 0.2, 1: 1 });
		expect(infiniteCountDriver.frame(1000)).toEqual({});
	});

	it('adapts output topology when ring count changes between frames', () => {
		let ringCount = 2;
		const driver = createAudioBarsDriver({
			getConfig: () => ({ smoothing: 0.5, minHz: 20, maxHz: 16000 }),
			getRingCount: () => ringCount,
			readBars: () => [0.1, 0.6, 0.9]
		});

		driver.init();
		expect(driver.frame(0)).toEqual({ 0: 0.1, 1: 0.6 });

		ringCount = 3;
		expect(driver.frame(16)).toEqual({ 0: 0.1, 1: 0.6, 2: 0.9 });

		ringCount = 1;
		expect(driver.frame(32)).toEqual({ 0: 0.1 });
	});
});
