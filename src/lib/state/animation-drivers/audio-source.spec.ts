import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAudioSource, reduceToBands } from './audio-source';

describe('reduceToBands', () => {
	it('returns an empty array for a non-positive ring count', () => {
		const freq = new Uint8Array(1024).fill(128);
		expect(reduceToBands(freq, 0, 20, 20000, 48000, 2048, 1)).toEqual([]);
	});

	it('returns one value per ring, all within 0..1', () => {
		const freq = new Uint8Array(1024).fill(128);
		const bands = reduceToBands(freq, 4, 20, 20000, 48000, 2048, 1);

		expect(bands).toHaveLength(4);
		for (const value of bands) {
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThanOrEqual(1);
		}
		// 128/255 ≈ 0.502 with gain 1
		expect(bands[0]).toBeCloseTo(128 / 255, 2);
	});

	it('clamps at 1 when inputGain pushes a band over', () => {
		const freq = new Uint8Array(1024).fill(128);
		const bands = reduceToBands(freq, 2, 20, 20000, 48000, 2048, 4);
		expect(bands[0]).toBe(1);
	});

	it('puts energy in the matching log band (high bins → high band)', () => {
		const freq = new Uint8Array(1024).fill(0);
		for (let i = 800; i < 1024; i += 1) freq[i] = 200; // high-frequency bins
		const bands = reduceToBands(freq, 4, 20, 20000, 48000, 2048, 1);
		expect(bands[3]).toBeGreaterThan(bands[0]);
		expect(bands[0]).toBe(0);
	});
});

const config = {
	smoothing: 0.5,
	minHz: 20,
	maxHz: 20000,
	waveCrests: 3,
	waveAmplitudeGain: 0.3,
	wavePhaseSpeed: 2.2,
	inputGain: 1
};

class MockAnalyser {
	fftSize = 2048;
	smoothingTimeConstant = 0;
	frequencyBinCount = 1024;
	connect = vi.fn();
	disconnect = vi.fn();
	getByteFrequencyData(arr: Uint8Array) {
		arr.fill(100);
	}
}

class MockSourceNode {
	connect = vi.fn();
	disconnect = vi.fn();
}

class MockAudioContext {
	sampleRate = 48000;
	destination = {};
	state = 'suspended';
	analyser = new MockAnalyser();
	resume = vi.fn(async () => {
		this.state = 'running';
	});
	createAnalyser = vi.fn(() => this.analyser);
	createMediaStreamSource = vi.fn(() => new MockSourceNode());
	createMediaElementSource = vi.fn(() => new MockSourceNode());
}

describe('createAudioSource', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('returns [] before any source is started', () => {
		vi.stubGlobal('AudioContext', MockAudioContext);
		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		expect(source.readBars()).toEqual([]);
	});

	it('reads ringCount values in 0..1 once the mic source is active', async () => {
		vi.stubGlobal('AudioContext', MockAudioContext);
		vi.stubGlobal('navigator', {
			mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) }
		});

		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		await source.setMode('mic');

		const bars = source.readBars();
		expect(bars).toHaveLength(4);
		for (const value of bars) {
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThanOrEqual(1);
		}
	});

	it('does not crash when microphone permission is denied', async () => {
		vi.stubGlobal('AudioContext', MockAudioContext);
		vi.stubGlobal('navigator', {
			mediaDevices: { getUserMedia: vi.fn(async () => Promise.reject(new Error('denied'))) }
		});

		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		await expect(source.setMode('mic')).rejects.toThrow();
		expect(source.readBars()).toEqual([]); // soft degradation
	});

	it('does not leave the analyser routed to destination after File → Mic (no feedback)', async () => {
		const contexts: MockAudioContext[] = [];
		// A function constructor that records each instance. Returning an object from
		// a constructor makes `new` yield that object — avoids aliasing `this`.
		function RecordingContext() {
			const ctx = new MockAudioContext();
			contexts.push(ctx);
			return ctx;
		}
		vi.stubGlobal('AudioContext', RecordingContext);
		vi.stubGlobal('navigator', {
			mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) }
		});
		vi.stubGlobal(
			'Audio',
			class {
				src = '';
				play = vi.fn();
				pause = vi.fn();
			}
		);

		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });

		await source.setMode('file');
		const ctx = contexts[0];
		const analyser = ctx.analyser;
		// File mode connects the analyser to destination so the file is audible.
		expect(analyser.connect).toHaveBeenCalledWith(ctx.destination);

		await source.setMode('mic');
		// Switching to mic must tear that link down and must NOT reconnect the
		// analyser to destination — otherwise the live mic feeds back to the speakers.
		expect(analyser.disconnect).toHaveBeenCalled();
		expect(analyser.connect).toHaveBeenCalledTimes(1); // only the earlier file connection
	});
});
