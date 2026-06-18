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

// Bezier path is added in Task 2; until then it falls back to linear.
function sampleSegment(a: Keyframe, b: Keyframe, t: number): number {
	if (a.interp === 'hold') return t >= b.time ? b.value : a.value;
	const span = b.time - a.time;
	const u = span <= 0 ? 1 : (t - a.time) / span;
	return lerp(a.value, b.value, u);
}

export function sampleTrack(track: Track, t: number): number | null {
	const kfs = sortKeyframes(track.keyframes);
	if (kfs.length === 0) return null;
	if (kfs.length === 1) return kfs[0].value;
	if (t <= kfs[0].time) return kfs[0].value;
	if (t >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;
	for (let i = 0; i < kfs.length - 1; i++) {
		const a = kfs[i];
		const b = kfs[i + 1];
		if (t >= a.time && t <= b.time) return sampleSegment(a, b, t);
	}
	return kfs[kfs.length - 1].value;
}
