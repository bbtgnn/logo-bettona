export type Interp = 'linear' | 'bezier' | 'hold';
export type Handle = { dx: number; dy: number };
export type Keyframe = {
	id: string;
	time: number;
	value: number;
	interp: Interp;
	handleOut: Handle;
	handleIn: Handle;
};
export type Track = {
	paramId: string;
	enabled: boolean;
	keyframes: Keyframe[];
};

export const EASY_EASE_OUT: Handle = { dx: 1 / 3, dy: 0 };
export const EASY_EASE_IN: Handle = { dx: -1 / 3, dy: 0 };

export function clamp01(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.max(0, Math.min(1, n));
}

export function sortKeyframes(kfs: Keyframe[]): Keyframe[] {
	return [...kfs].sort((a, b) => a.time - b.time);
}

function lerp(a: number, b: number, u: number): number {
	return a + (b - a) * u;
}

function cubic(p0: number, p1: number, p2: number, p3: number, u: number): number {
	const v = 1 - u;
	return v * v * v * p0 + 3 * v * v * u * p1 + 3 * v * u * u * p2 + u * u * u * p3;
}

export function sampleBezierSegment(a: Keyframe, b: Keyframe, t: number): number {
	const span = b.time - a.time;
	if (span <= 0) return b.value;
	const dv = b.value - a.value;

	const outDx = Math.max(0, Math.min(1, a.handleOut.dx));
	const inDx = Math.max(-1, Math.min(0, b.handleIn.dx));

	const x0 = a.time;
	const x1 = a.time + outDx * span;
	const x2 = b.time + inDx * span;
	const x3 = b.time;

	const y0 = a.value;
	const y1 = a.value + a.handleOut.dy * dv;
	const y2 = b.value + b.handleIn.dy * dv;
	const y3 = b.value;

	if (t <= a.time) return a.value;
	if (t >= b.time) return b.value;

	// Bisection solve X(u) = t (X is monotonic given the dx clamps above).
	let lo = 0;
	let hi = 1;
	let u = (t - a.time) / span;
	for (let i = 0; i < 40; i++) {
		const x = cubic(x0, x1, x2, x3, u);
		if (Math.abs(x - t) < 1e-7) break;
		if (x < t) lo = u;
		else hi = u;
		u = (lo + hi) / 2;
	}
	return cubic(y0, y1, y2, y3, u);
}

function sampleSegment(a: Keyframe, b: Keyframe, t: number): number {
	if (a.interp === 'hold') return t >= b.time ? b.value : a.value;
	if (a.interp === 'bezier') return sampleBezierSegment(a, b, t);
	const span = b.time - a.time;
	const u = span <= 0 ? 1 : (t - a.time) / span;
	return lerp(a.value, b.value, u);
}

export function sampleTrack(track: Track, t: number): number | null {
	const kfs = sortKeyframes(track.keyframes);
	if (kfs.length === 0) return null;
	if (kfs.length === 1) return kfs[0].value;
	// Upper edge is checked first so that keyframes sharing the same time resolve
	// to the later value (spec: "equal times → step to the later value").
	if (t >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;
	if (t <= kfs[0].time) return kfs[0].value;
	for (let i = 0; i < kfs.length - 1; i++) {
		const a = kfs[i];
		const b = kfs[i + 1];
		if (t >= a.time && t <= b.time) return sampleSegment(a, b, t);
	}
	return kfs[kfs.length - 1].value;
}
