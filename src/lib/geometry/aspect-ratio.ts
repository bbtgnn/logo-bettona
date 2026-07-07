import type { AspectRatio } from '$lib/types';

/** The selectable canvas aspect-ratio presets, in display order. */
export const ASPECT_RATIOS: AspectRatio[] = ['1:1', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9'];

/** Canvas pixel dimensions for an arbitrary width:height proportion, longer side = `longSide`. */
export function proportionToCanvasSize(
	w: number,
	h: number,
	longSide: number
): { width: number; height: number } {
	if (w >= h) {
		return { width: longSide, height: Math.round((longSide * h) / w) };
	}
	return { width: Math.round((longSide * w) / h), height: longSide };
}

/**
 * Maps an aspect-ratio preset to integer canvas pixel dimensions whose longer side
 * equals `longSide`. The shorter side is rounded to the nearest pixel.
 */
export function ratioToCanvasSize(
	ratio: AspectRatio,
	longSide: number
): { width: number; height: number } {
	const [w, h] = ratio.split(':').map(Number);
	return proportionToCanvasSize(w, h, longSide);
}
