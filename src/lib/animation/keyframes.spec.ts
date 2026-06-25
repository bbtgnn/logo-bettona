import { describe, it, expect } from 'vitest';
import {
	clamp01,
	sortKeyframes,
	sampleTrack,
	sampleBezierSegment,
	type Track,
	type Keyframe
} from './keyframes';

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

	it('is stable for two keyframes at the same time (steps to the later value)', () => {
		const tr = track([kf(0.5, 1), kf(0.5, 2)]);
		const v = sampleTrack(tr, 0.5);
		expect(Number.isFinite(v as number)).toBe(true);
		expect(v).toBe(2);
	});

	it('routes the correct segment in a multi-segment track', () => {
		const tr = track([kf(0, 0), kf(0.3, 30), kf(0.7, 70), kf(1, 100)]);
		// Mid of segment 2 of 3 (between 0.3 and 0.7) → linear 50.
		expect(sampleTrack(tr, 0.5)).toBeCloseTo(50, 6);
	});

	it('samples exactly at an interior keyframe boundary', () => {
		const tr = track([kf(0, 0), kf(0.3, 30), kf(1, 100)]);
		expect(sampleTrack(tr, 0.3)).toBeCloseTo(30, 6);
	});

	it('returns null before inPoint (strict)', () => {
		const t: Track = { ...track([kf(0, 0), kf(1, 1)]), inPoint: 0.25 };
		expect(sampleTrack(t, 0.1)).toBeNull();
	});

	it('returns null after outPoint (strict)', () => {
		const t: Track = { ...track([kf(0, 0), kf(1, 1)]), outPoint: 0.75 };
		expect(sampleTrack(t, 0.9)).toBeNull();
	});

	it('samples normally exactly at inPoint and outPoint', () => {
		const t: Track = { ...track([kf(0, 0), kf(1, 1)]), inPoint: 0.25, outPoint: 0.75 };
		expect(sampleTrack(t, 0.25)).toBeCloseTo(0.25);
		expect(sampleTrack(t, 0.75)).toBeCloseTo(0.75);
		expect(sampleTrack(t, 0.5)).toBeCloseTo(0.5);
	});

	it('with no in/out bounds keeps full-range behavior', () => {
		const t = track([kf(0, 0), kf(1, 1)]);
		expect(sampleTrack(t, 0)).toBeCloseTo(0);
		expect(sampleTrack(t, 1)).toBeCloseTo(1);
	});
});

describe('keyframes bezier', () => {
	const a = (interp: 'bezier') => kf(0, 0, interp);
	const b = kf(1, 100, 'bezier');

	it('hits the endpoints exactly', () => {
		expect(sampleBezierSegment(a('bezier'), b, 0)).toBeCloseTo(0, 6);
		expect(sampleBezierSegment(a('bezier'), b, 1)).toBeCloseTo(100, 6);
	});

	it('easy-ease is symmetric: midpoint is the mid value', () => {
		expect(sampleBezierSegment(a('bezier'), b, 0.5)).toBeCloseTo(50, 1);
	});

	it('easy-ease eases in (slower than linear early)', () => {
		// At t=0.25 an ease-in curve sits below the linear value (25).
		expect(sampleBezierSegment(a('bezier'), b, 0.25)).toBeLessThan(25);
	});

	it('is monotonic increasing across the segment', () => {
		let prev = -Infinity;
		for (let t = 0; t <= 1; t += 0.05) {
			const v = sampleBezierSegment(a('bezier'), b, t);
			expect(v).toBeGreaterThanOrEqual(prev - 1e-6);
			prev = v;
		}
	});

	it('stays monotonic at the dx clamp extremes (raw unclamped handles)', () => {
		// Feed raw out-of-range dx (5 / -5): the internal clamp must keep X monotonic,
		// so Y stays monotonic increasing across the segment.
		const a2: Keyframe = { ...kf(0, 0, 'bezier'), handleOut: { dx: 5, dy: 0 } };
		const b2: Keyframe = { ...kf(1, 100, 'bezier'), handleIn: { dx: -5, dy: 0 } };
		let prev = -Infinity;
		for (let t = 0; t <= 1; t += 0.05) {
			const v = sampleBezierSegment(a2, b2, t);
			expect(v).toBeGreaterThanOrEqual(prev - 1e-6);
			prev = v;
		}
		expect(sampleBezierSegment(a2, b2, 0)).toBeCloseTo(0, 6);
		expect(sampleBezierSegment(a2, b2, 1)).toBeCloseTo(100, 6);
	});

	it('sampleTrack routes bezier keyframes through the bezier curve', () => {
		const tr = track([kf(0, 0, 'bezier'), kf(1, 100, 'bezier')]);
		expect(sampleTrack(tr, 0.25)).toBeLessThan(25);
		expect(sampleTrack(tr, 0)).toBeCloseTo(0, 6);
		expect(sampleTrack(tr, 1)).toBeCloseTo(100, 6);
	});
});
