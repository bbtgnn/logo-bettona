import { clamp01 } from './keyframes';

export function xFromTime(t: number, width: number): number {
	return clamp01(t) * width;
}

export function timeFromX(x: number, width: number): number {
	if (!Number.isFinite(width) || width <= 0) return 0;
	return clamp01(x / width);
}

export function yFromValue(value: number, min: number, max: number, height: number): number {
	const span = max - min || 1;
	const frac = (value - min) / span;
	return height - clamp01(frac) * height;
}

export function valueFromY(y: number, min: number, max: number, height: number): number {
	if (!Number.isFinite(height) || height <= 0) return min;
	const frac = 1 - clamp01(y / height);
	return min + frac * (max - min);
}

/**
 * Snaps a normalized playhead progress to the nearest frame boundary for the given
 * duration and frame rate. Frames span the whole duration (`fps * durationSec`); the
 * result is re-normalized to 0..1. Used for Shift-scrubbing on the ruler.
 */
export function snapProgressToFps(progress: number, durationSec: number, fps: number): number {
	const frames = Math.max(1, Math.round(fps * Math.max(0.1, durationSec)));
	const snappedFrame = Math.round(clamp01(progress) * frames);
	return clamp01(snappedFrame / frames);
}

export function formatSeconds(sec: number): string {
	const r = Math.round(sec * 10) / 10;
	return (Number.isInteger(r) ? String(r) : r.toFixed(1)) + 's';
}

/** Formats seconds as `m:ss.cs` (centiseconds). Negative/non-finite → `0:00.00`. */
export function formatTimecode(sec: number): string {
	const safe = Number.isFinite(sec) && sec > 0 ? sec : 0;
	// Round to centiseconds first so carrying rolls seconds and minutes correctly.
	const totalCs = Math.round(safe * 100);
	const cs = totalCs % 100;
	const totalSec = Math.floor(totalCs / 100);
	const s = totalSec % 60;
	const min = Math.floor(totalSec / 60);
	return `${min}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/**
 * Parses a user-typed time to seconds. Accepts `m:ss.cs`, `m:ss`, `ss.cs`, `ss`
 * (and a bare decimal). Returns null for empty, malformed, or negative input.
 */
export function parseTimecode(str: string): number | null {
	const t = str.trim();
	if (t === '') return null;
	let seconds: number;
	if (t.includes(':')) {
		const parts = t.split(':');
		if (parts.length !== 2) return null;
		const [minStr, restStr] = parts;
		if (!/^\d+$/.test(minStr)) return null;
		if (!/^\d+(\.\d+)?$/.test(restStr)) return null;
		seconds = Number(minStr) * 60 + Number(restStr);
	} else {
		if (!/^\d+(\.\d+)?$/.test(t)) return null;
		seconds = Number(t);
	}
	if (!Number.isFinite(seconds) || seconds < 0) return null;
	return seconds;
}
