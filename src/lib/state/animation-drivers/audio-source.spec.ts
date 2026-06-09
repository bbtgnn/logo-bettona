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
	getByteTimeDomainData(arr: Uint8Array) {
		arr.fill(192); // deviation 64 from the 128 silence centre → level 0.5
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
	decodeAudioData = vi.fn(async (_buf: ArrayBuffer) => {
		const fakeData = new Float32Array(2400);
		for (let i = 0; i < fakeData.length; i++) fakeData[i] = i % 2 === 0 ? 0.5 : -0.3;
		return {
			duration: 5.0,
			length: 2400,
			numberOfChannels: 1,
			sampleRate: 48000,
			getChannelData: () => fakeData
		} as unknown as AudioBuffer;
	});
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

	it('returns 0 input level before any source is started, peak once active', async () => {
		vi.stubGlobal('AudioContext', MockAudioContext);
		vi.stubGlobal('navigator', {
			mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) }
		});

		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		expect(source.readLevel()).toBe(0); // off → dead meter

		await source.setMode('mic');
		// Mock waveform sits at 192: |192-128|/128 = 0.5.
		expect(source.readLevel()).toBeCloseTo(0.5, 6);
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

describe('loadFile — waveform decoding', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	function stubFileMode() {
		vi.stubGlobal('AudioContext', MockAudioContext);
		vi.stubGlobal('Audio', class {
			src = '';
			currentTime = 0;
			duration = 10;
			play = vi.fn();
			pause = vi.fn();
		});
		vi.stubGlobal('URL', {
			createObjectURL: vi.fn(() => 'blob:fake'),
			revokeObjectURL: vi.fn()
		});
	}

	it('returns empty state before any file is loaded', () => {
		vi.stubGlobal('AudioContext', MockAudioContext);
		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		expect(source.getPeaks()).toEqual([]);
		expect(source.getDuration()).toBe(0);
		expect(source.getFileName()).toBeNull();
	});

	it('decodes file and returns 800 peaks after loadFile', async () => {
		stubFileMode();
		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		await source.setMode('file');
		await source.loadFile(new File([new Uint8Array(100)], 'bettona.mp3', { type: 'audio/mpeg' }));

		const peaks = source.getPeaks();
		expect(peaks).toHaveLength(800);
		for (const p of peaks) {
			expect(p.min).toBeLessThanOrEqual(p.max);
			expect(p.min).toBeGreaterThanOrEqual(-1);
			expect(p.max).toBeLessThanOrEqual(1);
		}
		expect(source.getDuration()).toBe(5.0);
		expect(source.getFileName()).toBe('bettona.mp3');
	});

	it('handles decodeAudioData failure gracefully — clears peaks', async () => {
		vi.stubGlobal('AudioContext', class extends MockAudioContext {
			override decodeAudioData = vi.fn(async () => Promise.reject(new Error('decode error')));
		});
		vi.stubGlobal('Audio', class { src = ''; play = vi.fn(); pause = vi.fn(); });
		vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() });

		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		await source.setMode('file');
		await source.loadFile(new File([new Uint8Array(100)], 'bad.mp3'));

		expect(source.getPeaks()).toEqual([]);
		expect(source.getDuration()).toBe(0);
		expect(source.getFileName()).toBeNull();
	});

	it('clearFile resets all waveform state', async () => {
		stubFileMode();
		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		await source.setMode('file');
		await source.loadFile(new File([new Uint8Array(100)], 'test.mp3'));
		expect(source.getPeaks()).toHaveLength(800);

		source.clearFile();
		expect(source.getPeaks()).toEqual([]);
		expect(source.getDuration()).toBe(0);
		expect(source.getFileName()).toBeNull();
	});
});

describe('setRegion edge cases', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('setRegion swaps start and end when start > end', async () => {
		vi.stubGlobal('AudioContext', MockAudioContext);
		vi.stubGlobal('Audio', class { src = ''; play = vi.fn(); pause = vi.fn(); });
		vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() });

		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		await source.setMode('file');
		await source.loadFile(new File([new Uint8Array(100)], 't.mp3'));

		source.setRegion(4.0, 1.0); // inverted
		const r = source.getRegion();
		expect(r.start).toBeLessThanOrEqual(r.end);
		expect(r.start).toBeCloseTo(1.0);
		expect(r.end).toBeCloseTo(4.0);
	});
});

describe('seek and getCurrentTime', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('getCurrentTime returns 0 when no audio element exists', () => {
		vi.stubGlobal('AudioContext', MockAudioContext);
		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		expect(source.getCurrentTime()).toBe(0);
	});

	it('seek clamps to [0, duration] and writes audioEl.currentTime', async () => {
		let ct = 0;
		vi.stubGlobal('AudioContext', MockAudioContext);
		vi.stubGlobal('Audio', class {
			src = '';
			get currentTime() { return ct; }
			set currentTime(v: number) { ct = v; }
			duration = 10;
			play = vi.fn();
			pause = vi.fn();
		});
		vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() });

		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		await source.setMode('file');
		await source.loadFile(new File([new Uint8Array(100)], 't.mp3'));

		source.seek(2.5);
		expect(source.getCurrentTime()).toBeCloseTo(2.5);

		source.seek(-1);
		expect(source.getCurrentTime()).toBe(0);

		source.seek(999); // past decoded duration of 5.0
		expect(source.getCurrentTime()).toBe(5.0);
	});
});

describe('region and loop', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('getRegion returns {start:0,end:0} by default', () => {
		vi.stubGlobal('AudioContext', MockAudioContext);
		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		expect(source.getRegion()).toEqual({ start: 0, end: 0 });
	});

	it('isLoopRegion defaults false and toggles', () => {
		vi.stubGlobal('AudioContext', MockAudioContext);
		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		expect(source.isLoopRegion()).toBe(false);
		source.setLoopRegion(true);
		expect(source.isLoopRegion()).toBe(true);
		source.setLoopRegion(false);
		expect(source.isLoopRegion()).toBe(false);
	});

	it('setRegion clamps to [0, duration]', async () => {
		vi.stubGlobal('AudioContext', MockAudioContext);
		vi.stubGlobal('Audio', class { src = ''; play = vi.fn(); pause = vi.fn(); });
		vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() });

		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		await source.setMode('file');
		await source.loadFile(new File([new Uint8Array(100)], 't.mp3')); // duration 5.0

		source.setRegion(1.0, 3.0);
		expect(source.getRegion()).toEqual({ start: 1.0, end: 3.0 });

		source.setRegion(-5, 999); // both clamped
		expect(source.getRegion()).toEqual({ start: 0, end: 5.0 });
	});

	it('readBars resets currentTime to regionStart when past regionEnd with loop on', async () => {
		let ct = 3.5;
		vi.stubGlobal('AudioContext', MockAudioContext);
		vi.stubGlobal('Audio', class {
			src = '';
			get currentTime() { return ct; }
			set currentTime(v: number) { ct = v; }
			play = vi.fn();
			pause = vi.fn();
		});
		vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() });

		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		await source.setMode('file');
		await source.loadFile(new File([new Uint8Array(100)], 't.mp3'));

		source.setRegion(1.0, 3.0);
		source.setLoopRegion(true);
		// ct = 3.5 >= regionEnd = 3.0 → should reset to regionStart = 1.0
		source.readBars();
		expect(ct).toBe(1.0);
	});

	it('readBars does NOT reset currentTime when loop is off', async () => {
		let ct = 3.5;
		vi.stubGlobal('AudioContext', MockAudioContext);
		vi.stubGlobal('Audio', class {
			src = '';
			get currentTime() { return ct; }
			set currentTime(v: number) { ct = v; }
			play = vi.fn();
			pause = vi.fn();
		});
		vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() });

		const source = createAudioSource({ getRingCount: () => 4, getConfig: () => config });
		await source.setMode('file');
		await source.loadFile(new File([new Uint8Array(100)], 't.mp3'));

		source.setRegion(1.0, 3.0);
		source.setLoopRegion(false);
		source.readBars();
		expect(ct).toBe(3.5); // unchanged
	});
});
