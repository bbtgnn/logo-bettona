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
	getPeaks(): WaveformPeak[];
	getDuration(): number;
	getFileName(): string | null;
	getCurrentTime(): number;
	seek(t: number): void;
	setRegion(start: number, end: number): void;
	getRegion(): { start: number; end: number };
	setLoopRegion(enabled: boolean): void;
	isLoopRegion(): boolean;
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
		} catch {
			decodedBuffer = null;
			peaks = [];
			fileDuration = 0;
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
		region = {
			start: Math.max(0, Math.min(start, max)),
			end: Math.max(0, Math.min(end, max))
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

	return {
		setMode,
		loadFile,
		clearFile,
		play,
		pause,
		stop,
		readBars,
		readLevel,
		getPeaks,
		getDuration,
		getFileName,
		getCurrentTime,
		seek,
		setRegion,
		getRegion,
		setLoopRegion,
		isLoopRegion
	};
}
