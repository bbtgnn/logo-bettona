import { describe, it, expect } from 'vitest';
import { clamp01, sortKeyframes, sampleTrack, type Track, type Keyframe } from './keyframes';

const kf = (time: number, value: number, interp: Keyframe['interp'] = 'linear'): Keyframe => ({
	id: `${time}`,
	time,
	value,
	interp,
	handleOut: { dx: 1 / 3, dy: 0 },
	handleIn: { dx: -1 / 3, dy: 0 }
});

const track = (keyframes: Keyframe[], enabled = true): Track => ({
	paramId: 'p',
	enabled,
	keyframes
});

describe('keyframes pure', () => {
	it('clamps to 0..1', () => {
		expect(clamp01(-2)).toBe(0);
		expect(clamp01(2)).toBe(1);
		expect(clamp01(0.4)).toBe(0.4);
		expect(clamp01(NaN)).toBe(0);
	});

	it('sorts keyframes ascending by time', () => {
		const sorted = sortKeyframes([kf(0.8, 1), kf(0.2, 2), kf(0.5, 3)]);
		expect(sorted.map((k) => k.time)).toEqual([0.2, 0.5, 0.8]);
	});

	it('returns null for an empty track', () => {
		expect(sampleTrack(track([]), 0.5)).toBeNull();
	});

	it('returns the single keyframe value everywhere', () => {
		const tr = track([kf(0.3, 42)]);
		expect(sampleTrack(tr, 0)).toBe(42);
		expect(sampleTrack(tr, 1)).toBe(42);
	});

	it('clamps before first and after last keyframe', () => {
		const tr = track([kf(0.2, 10), kf(0.8, 20)]);
		expect(sampleTrack(tr, 0)).toBe(10);
		expect(sampleTrack(tr, 1)).toBe(20);
	});

	it('interpolates linearly between two keyframes', () => {
		const tr = track([kf(0, 0, 'linear'), kf(1, 100, 'linear')]);
		expect(sampleTrack(tr, 0.25)).toBeCloseTo(25, 6);
		expect(sampleTrack(tr, 0.5)).toBeCloseTo(50, 6);
	});

	it('holds the left value across a hold segment then jumps', () => {
		const tr = track([kf(0, 10, 'hold'), kf(1, 20, 'hold')]);
		expect(sampleTrack(tr, 0.99)).toBe(10);
		expect(sampleTrack(tr, 1)).toBe(20);
	});
});
