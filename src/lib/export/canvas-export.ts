/** Linear capture progress in [0, 1]. Non-positive duration is treated as complete. */
export function clampProgress(elapsedMs: number, durationMs: number): number {
	if (!(durationMs > 0)) return 1;
	const p = elapsedMs / durationMs;
	return p < 0 ? 0 : p > 1 ? 1 : p;
}

/** First MediaRecorder-supported WebM mime type, or null if none (e.g. Safari). */
export function pickWebmMimeType(): string | null {
	if (typeof MediaRecorder === 'undefined') return null;
	const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
	for (const type of candidates) {
		if (MediaRecorder.isTypeSupported(type)) return type;
	}
	return null;
}

/** True when the browser can capture the canvas to a WebM MediaRecorder. */
export function isAnimationExportSupported(): boolean {
	return (
		typeof MediaRecorder !== 'undefined' &&
		typeof HTMLCanvasElement !== 'undefined' &&
		typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
		pickWebmMimeType() !== null
	);
}

export type CanvasExportOptions = {
	canvas: HTMLCanvasElement;
	durationSec: number;
	fps?: number;
	audioStream?: MediaStream | null;
	fileName?: string;
	onProgress?: (p: number) => void;
};

function downloadBlob(blob: Blob, fileName: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = fileName;
	a.click();
	URL.revokeObjectURL(url);
}

/**
 * Captures the live canvas to a WebM file for `durationSec` seconds (real time).
 * Resolves after the download is triggered. Reports progress 0..1 via onProgress.
 */
export function exportCanvasAnimation(opts: CanvasExportOptions): Promise<void> {
	const {
		canvas,
		durationSec,
		fps = 30,
		audioStream = null,
		fileName = 'animation.webm',
		onProgress
	} = opts;

	return new Promise<void>((resolve, reject) => {
		const mimeType = pickWebmMimeType();
		if (!mimeType) {
			reject(new Error('WebM recording is not supported in this browser'));
			return;
		}

		const stream = canvas.captureStream(fps);
		if (audioStream) {
			for (const track of audioStream.getAudioTracks()) stream.addTrack(track);
		}

		let recorder: MediaRecorder;
		try {
			recorder = new MediaRecorder(stream, { mimeType });
		} catch (err) {
			reject(err instanceof Error ? err : new Error(String(err)));
			return;
		}

		const chunks: BlobPart[] = [];
		const durationMs = Math.max(0, durationSec * 1000);
		const start = performance.now();
		let progressTimer: ReturnType<typeof setInterval> | null = null;

		recorder.ondataavailable = (e) => {
			if (e.data.size > 0) chunks.push(e.data);
		};
		recorder.onstop = () => {
			if (progressTimer !== null) clearInterval(progressTimer);
			onProgress?.(1);
			try {
				downloadBlob(new Blob(chunks, { type: mimeType }), fileName);
				resolve();
			} catch (err) {
				reject(err instanceof Error ? err : new Error(String(err)));
			}
		};
		recorder.onerror = () => {
			if (progressTimer !== null) clearInterval(progressTimer);
			reject(new Error('MediaRecorder error during capture'));
		};

		onProgress?.(0);
		recorder.start();
		progressTimer = setInterval(() => {
			onProgress?.(clampProgress(performance.now() - start, durationMs));
		}, 100);
		setTimeout(() => {
			if (recorder.state !== 'inactive') recorder.stop();
		}, durationMs);
	});
}
