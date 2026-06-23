import { describe, it, expect } from 'vitest';
import {
	xFromTime,
	timeFromX,
	yFromValue,
	valueFromY,
	formatSeconds,
	snapProgressToFps,
	formatTimecode,
	parseTimecode
} from './timeline-geometry';

describe('timeline geometry', () => {
	it('maps time to x and back', () => {
		expect(xFromTime(0.5, 200)).toBe(100);
		expect(timeFromX(100, 200)).toBe(0.5);
	});

	it('clamps time from x to 0..1', () => {
		expect(timeFromX(-10, 200)).toBe(0);
		expect(timeFromX(999, 200)).toBe(1);
	});

	it('guards zero width', () => {
		expect(timeFromX(50, 0)).toBe(0);
	});

	it('maps value to y inverted (max at top = y 0)', () => {
		expect(yFromValue(360, 0, 360, 100)).toBe(0);
		expect(yFromValue(0, 0, 360, 100)).toBe(100);
		expect(yFromValue(180, 0, 360, 100)).toBe(50);
	});

	it('maps y back to value, clamped to range', () => {
		expect(valueFromY(0, 0, 360, 100)).toBeCloseTo(360, 6);
		expect(valueFromY(100, 0, 360, 100)).toBeCloseTo(0, 6);
		expect(valueFromY(-50, 0, 360, 100)).toBe(360);
		expect(valueFromY(150, 0, 360, 100)).toBe(0);
	});
});

describe('formatSeconds', () => {
	it('drops the decimal for whole seconds', () => {
		expect(formatSeconds(3)).toBe('3s');
		expect(formatSeconds(0)).toBe('0s');
	});
	it('keeps one decimal for fractional seconds', () => {
		expect(formatSeconds(1.5)).toBe('1.5s');
	});
	it('rounds to one decimal', () => {
		expect(formatSeconds(1.234)).toBe('1.2s');
	});
});

describe('snapProgressToFps', () => {
	it('keeps a progress that already lands on a frame', () => {
		// 25 fps over 2s = 50 frames; 0.5 → frame 25 → 0.5
		expect(snapProgressToFps(0.5, 2, 25)).toBeCloseTo(0.5, 6);
	});

	it('snaps down to the nearest frame', () => {
		// 10 fps over 1s = 10 frames; 0.51 → 5.1 → frame 5 → 0.5
		expect(snapProgressToFps(0.51, 1, 10)).toBeCloseTo(0.5, 6);
	});

	it('snaps up to the nearest frame', () => {
		// 0.56 → 5.6 → frame 6 → 0.6
		expect(snapProgressToFps(0.56, 1, 10)).toBeCloseTo(0.6, 6);
	});

	it('clamps out-of-range progress to 0..1', () => {
		expect(snapProgressToFps(-0.2, 1, 30)).toBe(0);
		expect(snapProgressToFps(1.4, 1, 30)).toBe(1);
	});
});

describe('timecode', () => {
	it('formats seconds as m:ss:ff (frames) for the given fps', () => {
		expect(formatTimecode(0, 25)).toBe('0:00:00');
		// 3.24s at 25fps = 81 frames → 3s + 6 frames
		expect(formatTimecode(3.24, 25)).toBe('0:03:06');
		// 65.52s at 25fps = 1638 frames → 1m 5s + 13 frames
		expect(formatTimecode(65.52, 25)).toBe('1:05:13');
	});

	it('adapts the frame field to the fps', () => {
		// 1.5s → half a second of frames: 25 at 50fps, 15 at 30fps
		expect(formatTimecode(1.5, 50)).toBe('0:01:25');
		expect(formatTimecode(1.5, 30)).toBe('0:01:15');
	});

	it('carries frames into seconds when rounding reaches fps', () => {
		// 3.999s at 25fps = 99.975 → 100 frames → 4s + 0 frames
		expect(formatTimecode(3.999, 25)).toBe('0:04:00');
		// 59.99s at 25fps = 1499.75 → 1500 frames → 1m 0s
		expect(formatTimecode(59.99, 25)).toBe('1:00:00');
	});

	it('clamps negative/non-finite to zero', () => {
		expect(formatTimecode(-1, 25)).toBe('0:00:00');
		expect(formatTimecode(NaN, 25)).toBe('0:00:00');
	});

	it('parses m:ss:ff and ss:ff to seconds for the given fps', () => {
		expect(parseTimecode('1:05:13', 25)).toBeCloseTo(65.52, 5);
		expect(parseTimecode('03:06', 25)).toBeCloseTo(3.24, 5);
		expect(parseTimecode('7', 25)).toBe(7);
		expect(parseTimecode('3.2', 25)).toBeCloseTo(3.2, 5);
	});

	it('returns null for invalid input', () => {
		expect(parseTimecode('', 25)).toBeNull();
		expect(parseTimecode('abc', 25)).toBeNull();
		expect(parseTimecode('-1', 25)).toBeNull();
		expect(parseTimecode('1:2:3:4', 25)).toBeNull();
	});
});
