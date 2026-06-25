import type { AudioBarsConfig } from './types';

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export type WaveformPeak = { min: number; max: number };

const PEAK_BUCKETS = 800;

function calculatePeaks(audioBuffer: AudioBuffer, bucketCount: number): WaveformPeak[] {
	const data = audioBuffer.getChannelData(0);
	const total = data.length;
	const peaks: WaveformPeak[] = [];
	for (let b = 0; b < bucketCount; b++) {
		const start = Math.floor((b / bucketCount) * total);
		const end = Math.floor(((b + 1) / bucketCount) * total);
		let min = Infinity;
		let max = -Infinity;
		for (let i = start; i < end; i++) {
			if (data[i] < min) min = data[i];
			if (data[i] > max) max = data[i];
		}
		peaks.push({ min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max });
	}
	return peaks;
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

/**
 * Reduces a frequency-magnitude spectrum to three perceptual bands (bass/mid/treble),
 * each normalized to 0..1 and scaled by inputGain. Fixed Hz splits: bass 20-300,
 * mid 300-2000, treble 2000-20000. Pure — no Web Audio references — unit-testable.
 */
export function reduceToZones(
	freq: Uint8Array,
	sampleRate: number,
	fftSize: number,
	inputGain: number
): { bass: number; mid: number; treble: number } {
	const binHz = sampleRate / fftSize;

	function bandAvg(loHz: number, hiHz: number): number {
		const loBin = Math.max(0, Math.floor(loHz / binHz));
		const hiBin = Math.min(freq.length, Math.ceil(hiHz / binHz));
		if (loBin >= hiBin) return 0;
		let sum = 0;
		for (let i = loBin; i < hiBin; i++) sum += freq[i];
		return clamp01(((sum / (hiBin - loBin)) / 255) * inputGain);
	}

	return {
		bass: bandAvg(20, 300),
		mid: bandAvg(300, 2000),
		treble: bandAvg(2000, 20000)
	};
}

export type AudioSourceMode = 'mic' | 'file' | 'off';

export type AudioSource = {
	setMode(mode: AudioSourceMode): Promise<void>;
	loadFile(file: File): Promise<void>;
	clearFile(): void;
	play(): Promise<void>;
	pause(): void;
	stop(): void;
	readBars(): number[];
	/**
	 * Raw input level 0..1 (peak amplitude of the time-domain waveform). Independent
	 * of the band reduction, smoothing and inputGain that feed `readBars`, so a moving
	 * meter while the flower is still pinpoints the fault as mapping/gain, and a dead
	 * meter pinpoints the source/graph.
	 */
	readLevel(): number;
	readZones(): { bass: number; mid: number; treble: number };
	getPeaks(): WaveformPeak[];
	getDuration(): number;
	getFileName(): string | null;
	getCurrentTime(): number;
	seek(t: number): void;
	setRegion(start: number, end: number): void;
	getRegion(): { start: number; end: number };
	setLoopRegion(enabled: boolean): void;
	isLoopRegion(): boolean;
	/**
	 * Taps the live analyser into a fresh MediaStreamAudioDestinationNode and returns its
	 * stream, for muxing into a video export. Returns null when no audio graph exists yet
	 * (mode 'off', or before any source started). Call `dispose()` to unhook the tap.
	 */
	createRecordingStream(): { stream: MediaStream; dispose: () => void } | null;
};

type CreateAudioSourceDeps = {
	getRingCount: () => number;
	getConfig: () => AudioBarsConfig;
};

/**
 * Owns one AudioContext + one AnalyserNode and feeds the same `readBars(): number[]`
 * contract as the dev fallback. The mic is never routed to `destination` (feedback);
 * the file IS routed to `destination` so it stays audible while tuning. The context is
 * created lazily and `resume()`d from a user gesture by the caller. All Web Audio access
 * is guarded so a missing API / denied permission degrades to `readBars() === []`.
 */
export function createAudioSource(deps: CreateAudioSourceDeps): AudioSource {
	let audioContext: AudioContext | null = null;
	let analyser: AnalyserNode | null = null;
	let buffer: Uint8Array<ArrayBuffer> | null = null;
	let timeBuffer: Uint8Array<ArrayBuffer> | null = null;

	let mode: AudioSourceMode = 'off';
	let micStream: MediaStream | null = null;
	let micNode: MediaStreamAudioSourceNode | null = null;

	let audioEl: HTMLAudioElement | null = null;
	let fileNode: MediaElementAudioSourceNode | null = null;
	let objectUrl: string | null = null;

	let peaks: WaveformPeak[] = [];
	let fileDuration = 0;
	let fileName: string | null = null;
	// Retained so future tasks can re-bucket at different resolutions (e.g., canvas resize).
	let decodedBuffer: AudioBuffer | null = null;
	let region = { start: 0, end: 0 };
	let loopRegion = false;

	function ensureContext(): AudioContext {
		if (!audioContext) {
			const Ctor = globalThis.AudioContext;
			if (!Ctor) throw new Error('Web Audio API is not available');
			audioContext = new Ctor();
			analyser = audioContext.createAnalyser();
			analyser.fftSize = 2048;
			buffer = new Uint8Array(analyser.frequencyBinCount);
			timeBuffer = new Uint8Array(analyser.fftSize);
		}
		return audioContext;
	}

	function detachSources(): void {
		if (micNode) {
			micNode.disconnect();
			micNode = null;
		}
		if (micStream) {
			for (const track of micStream.getTracks()) track.stop();
			micStream = null;
		}
		if (fileNode) {
			fileNode.disconnect();
			fileNode = null;
		}
		// Tear down the analyser→destination link too. File mode connects it for
		// audibility; without this, a later mic source would be routed to the
		// speakers (feedback). The analyser still analyses its input with no output.
		analyser?.disconnect();
	}

	async function setMode(next: AudioSourceMode): Promise<void> {
		if (next === 'off') {
			detachSources();
			mode = 'off';
			return;
		}

		const ctx = ensureContext();
		await ctx.resume();
		detachSources();

		if (next === 'mic') {
			const mediaDevices = globalThis.navigator?.mediaDevices;
			if (!mediaDevices?.getUserMedia) throw new Error('getUserMedia is not available');
			micStream = await mediaDevices.getUserMedia({ audio: true });
			micNode = ctx.createMediaStreamSource(micStream);
			micNode.connect(analyser as AnalyserNode); // NOT connected to destination
		} else {
			// file
			if (!audioEl) audioEl = new Audio();
			if (!fileNode) fileNode = ctx.createMediaElementSource(audioEl);
			fileNode.connect(analyser as AnalyserNode);
			(analyser as AnalyserNode).connect(ctx.destination); // audible while tuning
		}
		mode = next;
	}

	async function loadFile(file: File): Promise<void> {
		fileName = file.name;
		if (!audioEl) audioEl = new Audio();
		if (objectUrl) URL.revokeObjectURL(objectUrl);
		objectUrl = URL.createObjectURL(file);
		audioEl.src = objectUrl;

		const ctx = ensureContext();
		const arrayBuffer = await file.arrayBuffer();
		try {
			decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
			peaks = calculatePeaks(decodedBuffer, PEAK_BUCKETS);
			fileDuration = decodedBuffer.duration;
		} catch (e) {
			decodedBuffer = null;
			peaks = [];
			fileDuration = 0;
			fileName = null;
			throw e;
		}
	}

	function clearFile(): void {
		if (objectUrl) {
			URL.revokeObjectURL(objectUrl);
			objectUrl = null;
		}
		if (audioEl) {
			audioEl.pause();
			audioEl.src = '';
		}
		peaks = [];
		fileDuration = 0;
		fileName = null;
		decodedBuffer = null;
		region = { start: 0, end: 0 };
		loopRegion = false;
	}

	function getPeaks(): WaveformPeak[] {
		return peaks;
	}

	function getDuration(): number {
		return fileDuration;
	}

	function getFileName(): string | null {
		return fileName;
	}

	function getCurrentTime(): number {
		return audioEl?.currentTime ?? 0;
	}

	function seek(t: number): void {
		if (!audioEl) return;
		const max = fileDuration > 0 ? fileDuration : (audioEl.duration || 0);
		audioEl.currentTime = Math.max(0, Math.min(t, max));
	}

	function setRegion(start: number, end: number): void {
		const max = fileDuration;
		const clampedStart = Math.max(0, Math.min(start, max));
		const clampedEnd = Math.max(0, Math.min(end, max));
		region = {
			start: Math.min(clampedStart, clampedEnd),
			end: Math.max(clampedStart, clampedEnd)
		};
	}

	function getRegion(): { start: number; end: number } {
		return { ...region };
	}

	function setLoopRegion(enabled: boolean): void {
		loopRegion = enabled;
	}

	function isLoopRegion(): boolean {
		return loopRegion;
	}

	async function play(): Promise<void> {
		if (audioContext) await audioContext.resume();
		if (audioEl) await audioEl.play();
	}

	function pause(): void {
		audioEl?.pause();
	}

	function stop(): void {
		detachSources();
		audioEl?.pause();
		mode = 'off';
	}

	function readBars(): number[] {
		if (mode === 'off' || !analyser || !buffer || !audioContext) return [];

		// Region loop: if loop is on and playback has passed regionEnd, jump back.
		if (loopRegion && audioEl && region.end > region.start) {
			if (audioEl.currentTime >= region.end || audioEl.currentTime < region.start) {
				audioEl.currentTime = region.start;
			}
		}

		const cfg = deps.getConfig();
		analyser.smoothingTimeConstant = cfg.smoothing;
		analyser.getByteFrequencyData(buffer);
		return reduceToBands(
			buffer,
			deps.getRingCount(),
			cfg.minHz,
			cfg.maxHz,
			audioContext.sampleRate,
			analyser.fftSize,
			cfg.inputGain
		);
	}

	function readLevel(): number {
		if (mode === 'off' || !analyser || !timeBuffer) return 0;
		analyser.getByteTimeDomainData(timeBuffer);
		// Time-domain bytes centre on 128 (silence); peak deviation / 128 → 0..1.
		let peak = 0;
		for (let i = 0; i < timeBuffer.length; i += 1) {
			const dev = Math.abs(timeBuffer[i] - 128);
			if (dev > peak) peak = dev;
		}
		return clamp01(peak / 128);
	}

	function readZones(): { bass: number; mid: number; treble: number } {
		if (mode === 'off' || !analyser || !buffer || !audioContext) {
			return { bass: 0, mid: 0, treble: 0 };
		}
		const cfg = deps.getConfig();
		analyser.smoothingTimeConstant = cfg.smoothing;
		analyser.getByteFrequencyData(buffer);
		return reduceToZones(buffer, audioContext.sampleRate, analyser.fftSize, cfg.inputGain);
	}

	function createRecordingStream(): { stream: MediaStream; dispose: () => void } | null {
		if (!audioContext || !analyser) return null;
		const dest = audioContext.createMediaStreamDestination();
		analyser.connect(dest);
		return {
			stream: dest.stream,
			dispose: () => analyser?.disconnect(dest)
		};
	}

	return {
		setMode,
		loadFile,
		clearFile,
		play,
		pause,
		stop,
		readBars,
		readLevel,
		readZones,
		getPeaks,
		getDuration,
		getFileName,
		getCurrentTime,
		seek,
		setRegion,
		getRegion,
		setLoopRegion,
		isLoopRegion,
		createRecordingStream
	};
}