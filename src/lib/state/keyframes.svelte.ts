import { untrack } from 'svelte';
import { localStorageSync } from 'rune-sync/localstorage';
import {
	sampleTrack,
	sortKeyframes,
	clamp01,
	EASY_EASE_OUT,
	EASY_EASE_IN,
	type Track,
	type Keyframe,
	type Interp,
	type Handle
} from '$lib/animation/keyframes';

export const KALEIDO_GLOBAL_ROTATION = 'kaleidoscope.globalRotation';

const PERSIST_KEY = 'kaleidoscope-keyframes';
const SAME_TIME_EPS = 1e-4;

type TracksState = { tracks: Record<string, Track> };

const state = $state<TracksState>({ tracks: {} });

function newId(): string {
	const c = (globalThis as { crypto?: Crypto }).crypto;
	if (c && 'randomUUID' in c) return c.randomUUID();
	return `kf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function track(paramId: string): Track {
	if (!state.tracks[paramId]) {
		state.tracks[paramId] = { paramId, enabled: false, keyframes: [] };
	}
	return state.tracks[paramId];
}

function resort(paramId: string) {
	state.tracks[paramId].keyframes = sortKeyframes(state.tracks[paramId].keyframes);
}

export const keyframes = {
	get tracks() {
		return state.tracks;
	},
	ensureTrack(paramId: string) {
		track(paramId);
	},
	setTrackEnabled(paramId: string, on: boolean) {
		track(paramId).enabled = on;
	},
	setTrackInPoint(paramId: string, v: number) {
		const t = track(paramId);
		let next = clamp01(v);
		if (t.outPoint != null) next = Math.min(next, t.outPoint);
		t.inPoint = next;
	},
	setTrackOutPoint(paramId: string, v: number) {
		const t = track(paramId);
		let next = clamp01(v);
		if (t.inPoint != null) next = Math.max(next, t.inPoint);
		t.outPoint = next;
	},
	deleteTrack(paramId: string) {
		delete state.tracks[paramId];
	},
	deleteTracksForRing(ringId: string) {
		const prefix = `ring.${ringId}.`;
		for (const key of Object.keys(state.tracks)) {
			if (key.startsWith(prefix)) delete state.tracks[key];
		}
	},
	addKeyframe(paramId: string, init: { time: number; value: number; interp?: Interp }): string {
		const t = track(paramId);
		const kf: Keyframe = {
			id: newId(),
			time: clamp01(init.time),
			value: init.value,
			interp: init.interp ?? 'linear',
			handleOut: { ...EASY_EASE_OUT },
			handleIn: { ...EASY_EASE_IN }
		};
		t.keyframes.push(kf);
		resort(paramId);
		return kf.id;
	},
	upsertKeyframeAtTime(paramId: string, time: number, value: number) {
		const t = track(paramId);
		const existing = t.keyframes.find((k) => Math.abs(k.time - clamp01(time)) <= SAME_TIME_EPS);
		if (existing) {
			existing.value = value;
			return;
		}
		this.addKeyframe(paramId, { time, value });
	},
	moveKeyframe(paramId: string, id: string, next: { time?: number; value?: number }) {
		const kf = track(paramId).keyframes.find((k) => k.id === id);
		if (!kf) return;
		if (next.time !== undefined) kf.time = clamp01(next.time);
		if (next.value !== undefined) kf.value = next.value;
		resort(paramId);
	},
	deleteKeyframe(paramId: string, id: string) {
		const t = track(paramId);
		t.keyframes = t.keyframes.filter((k) => k.id !== id);
	},
	setKeyframeInterp(paramId: string, id: string, interp: Interp) {
		const kf = track(paramId).keyframes.find((k) => k.id === id);
		if (kf) kf.interp = interp;
	},
	setKeyframeHandle(paramId: string, id: string, which: 'in' | 'out', handle: Handle) {
		const kf = track(paramId).keyframes.find((k) => k.id === id);
		if (!kf) return;
		if (which === 'out') kf.handleOut = handle;
		else kf.handleIn = handle;
	},
	sampleParam(paramId: string, t: number): number | null {
		const tr = state.tracks[paramId];
		if (!tr || !tr.enabled) return null;
		return sampleTrack(tr, t);
	},
	hasEnabledTracks(): boolean {
		return Object.values(state.tracks).some((t) => t.enabled && t.keyframes.length > 0);
	}
};

// Persistence: window-guarded so node imports (animation integration test) stay clean.
if (typeof window !== 'undefined') {
	$effect.root(() => {
		let lastSaved: string;
		untrack(() => {
			// localStorageSync.read is synchronous for the localStorage driver; the union
			// with Promise comes from the generic driver signature, so narrow it here.
			const saved = localStorageSync.read<TracksState>(PERSIST_KEY) as TracksState | null;
			if (saved?.tracks) state.tracks = saved.tracks;
			lastSaved = JSON.stringify($state.snapshot(state));
		});
		$effect(() => {
			const serialized = JSON.stringify($state.snapshot(state));
			if (serialized === lastSaved) return;
			untrack(() => {
				localStorageSync.write(PERSIST_KEY, $state.snapshot(state));
				lastSaved = serialized;
			});
		});
	});
}
