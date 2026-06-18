import { describe, it, expect, beforeEach } from 'vitest';
import { flushSync } from 'svelte';
import { localStorageSync } from 'rune-sync/localstorage';
import { keyframes, KALEIDO_GLOBAL_ROTATION as ROT } from './keyframes.svelte';

const PERSIST_KEY = 'kaleidoscope-keyframes';

describe('keyframes store', () => {
	beforeEach(() => {
		// Reset the track between tests.
		keyframes.ensureTrack(ROT);
		for (const k of [...keyframes.tracks[ROT].keyframes]) keyframes.deleteKeyframe(ROT, k.id);
		keyframes.setTrackEnabled(ROT, false);
	});

	it('ensures a track exists, disabled, empty', () => {
		expect(keyframes.tracks[ROT]).toBeDefined();
		expect(keyframes.tracks[ROT].enabled).toBe(false);
		expect(keyframes.tracks[ROT].keyframes).toHaveLength(0);
	});

	it('adds a keyframe and returns its id', () => {
		const id = keyframes.addKeyframe(ROT, { time: 0.5, value: 90 });
		const kf = keyframes.tracks[ROT].keyframes.find((k) => k.id === id);
		expect(kf).toBeDefined();
		expect(kf!.value).toBe(90);
		expect(kf!.interp).toBe('linear');
	});

	it('keeps keyframes sorted by time after add', () => {
		keyframes.addKeyframe(ROT, { time: 0.8, value: 10 });
		keyframes.addKeyframe(ROT, { time: 0.2, value: 20 });
		expect(keyframes.tracks[ROT].keyframes.map((k) => k.time)).toEqual([0.2, 0.8]);
	});

	it('moveKeyframe clamps time to 0..1 and re-sorts', () => {
		const a = keyframes.addKeyframe(ROT, { time: 0.2, value: 0 });
		keyframes.addKeyframe(ROT, { time: 0.6, value: 0 });
		keyframes.moveKeyframe(ROT, a, { time: 9 });
		expect(keyframes.tracks[ROT].keyframes.map((k) => k.time)).toEqual([0.6, 1]);
	});

	it('deleteKeyframe removes it', () => {
		const id = keyframes.addKeyframe(ROT, { time: 0.5, value: 1 });
		keyframes.deleteKeyframe(ROT, id);
		expect(keyframes.tracks[ROT].keyframes).toHaveLength(0);
	});

	it('setKeyframeInterp updates the type', () => {
		const id = keyframes.addKeyframe(ROT, { time: 0.5, value: 1 });
		keyframes.setKeyframeInterp(ROT, id, 'hold');
		expect(keyframes.tracks[ROT].keyframes[0].interp).toBe('hold');
	});

	it('upsertKeyframeAtTime updates an existing near-time keyframe instead of adding', () => {
		keyframes.addKeyframe(ROT, { time: 0.5, value: 10 });
		keyframes.upsertKeyframeAtTime(ROT, 0.5, 99);
		expect(keyframes.tracks[ROT].keyframes).toHaveLength(1);
		expect(keyframes.tracks[ROT].keyframes[0].value).toBe(99);
	});

	it('sampleParam returns null when the track is disabled', () => {
		keyframes.addKeyframe(ROT, { time: 0, value: 0 });
		keyframes.addKeyframe(ROT, { time: 1, value: 100 });
		expect(keyframes.sampleParam(ROT, 0.5)).toBeNull();
		keyframes.setTrackEnabled(ROT, true);
		expect(keyframes.sampleParam(ROT, 0.5)).toBeCloseTo(50, 6);
	});

	it('hasEnabledTracks reflects enabled state', () => {
		expect(keyframes.hasEnabledTracks()).toBe(false);
		keyframes.addKeyframe(ROT, { time: 0, value: 0 });
		keyframes.setTrackEnabled(ROT, true);
		expect(keyframes.hasEnabledTracks()).toBe(true);
	});

	it('persists keyframe edits to localStorage (round-trip)', () => {
		keyframes.addKeyframe(ROT, { time: 0.5, value: 77 });
		flushSync(); // run the persistence $effect synchronously
		const saved = localStorageSync.read<{ tracks: typeof keyframes.tracks }>(PERSIST_KEY) as {
			tracks: typeof keyframes.tracks;
		} | null;
		expect(saved?.tracks[ROT].keyframes.some((k) => k.value === 77)).toBe(true);
	});
});
