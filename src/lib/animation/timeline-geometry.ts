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
