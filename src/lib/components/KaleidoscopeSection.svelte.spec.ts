import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import KaleidoscopeSection from './KaleidoscopeSection.svelte';
import {
	kaleidoscope,
	setKaleidoscopeEnabled,
	setCircularMask,
	setLiveTile,
	setTileBackground
} from '$lib/state/kaleidoscope.svelte';
import { animationState } from '$lib/state/animation';
import { keyframes, KALEIDO_GLOBAL_ROTATION as ROT } from '$lib/state/keyframes.svelte';
import { switchLocale } from '$lib/state/locale.svelte';

describe('KaleidoscopeSection', () => {
	beforeEach(() => {
		switchLocale('en');
		setKaleidoscopeEnabled(false);
	});

	// Shared keyframes singleton: disarm tracks this file enabled so it does not pollute
	// other specs in the browser project (e.g. keyframes hasEnabledTracks).
	afterEach(() => {
		for (const id of Object.keys(keyframes.tracks)) keyframes.setTrackEnabled(id, false);
	});

	it('toggles kaleidoscope mode through the enable checkbox', async () => {
		render(KaleidoscopeSection);
		await userEvent.click(page.getByLabelText('Kaleidoscope mode'));
		expect(kaleidoscope.enabled).toBe(true);
	});

	it('updates sectors from the range input', async () => {
		render(KaleidoscopeSection);
		await userEvent.fill(page.getByLabelText('Sectors', { exact: true }), '12');
		expect(kaleidoscope.sectors).toBe(12);
	});

	// Each slider must route to its OWN setter — guards against copy-paste wiring bugs
	// across the structurally-identical control blocks.
	const rangeCases: ReadonlyArray<readonly [string, string, () => number]> = [
		['Repeats', '5', () => kaleidoscope.repeat],
		['Distance from centre', '0.5', () => kaleidoscope.offsetDistance],
		['Global scale', '2', () => kaleidoscope.scale],
		['Tile size', '1.5', () => kaleidoscope.tileSize],
		['Tile rotation', '90', () => kaleidoscope.tileRotation],
		['Carpet rotation', '45', () => kaleidoscope.carpetRotation],
		['Global rotation', '120', () => kaleidoscope.globalRotation]
	];

	for (const [label, value, get] of rangeCases) {
		it(`wires the "${label}" slider to its setter`, async () => {
			render(KaleidoscopeSection);
			await userEvent.fill(page.getByLabelText(label, { exact: true }), value);
			expect(get()).toBe(Number(value));
		});
	}

	it('arms the sectors track via its stopwatch', async () => {
		keyframes.ensureTrack('kaleidoscope.sectors');
		keyframes.setTrackEnabled('kaleidoscope.sectors', false);
		render(KaleidoscopeSection);
		await userEvent.click(page.getByLabelText('Animate Sectors'));
		expect(keyframes.tracks['kaleidoscope.sectors'].enabled).toBe(true);
	});

	it('wires the circular-mask, live-tile and tile-background checkboxes', async () => {
		setCircularMask(true);
		setLiveTile(false);
		setTileBackground(false);
		render(KaleidoscopeSection);

		await userEvent.click(page.getByLabelText('Circular mask'));
		expect(kaleidoscope.circularMask).toBe(false);

		await userEvent.click(page.getByLabelText('Live tile'));
		expect(kaleidoscope.liveTile).toBe(true);

		await userEvent.click(page.getByLabelText('Tile background'));
		expect(kaleidoscope.tileBackground).toBe(true);
		expect(kaleidoscope.drawBackground).toBe(false);
	});

	it('shows "Refresh snapshot" only while the live tile is off', async () => {
		setLiveTile(false);
		render(KaleidoscopeSection);
		await expect.element(page.getByText('Refresh snapshot')).toBeInTheDocument();
	});

	it('hides the stopwatches when not animatable but keeps the sliders working', async () => {
		render(KaleidoscopeSection, { animatable: false });
		expect(page.getByLabelText('Animate Sectors').query()).toBeNull();
		expect(page.getByLabelText('Animate Global rotation').query()).toBeNull();
		await userEvent.fill(page.getByLabelText('Sectors', { exact: true }), '12');
		expect(kaleidoscope.sectors).toBe(12);
	});
});

describe('KaleidoscopeSection rotation keyframing', () => {
	beforeEach(() => {
		switchLocale('en');
		keyframes.ensureTrack(ROT);
		for (const k of [...keyframes.tracks[ROT].keyframes]) keyframes.deleteKeyframe(ROT, k.id);
		keyframes.setTrackEnabled(ROT, false);
		animationState.progress = 0;
	});

	it('enables the rotation track via the stopwatch', async () => {
		render(KaleidoscopeSection);
		await userEvent.click(page.getByLabelText('Animate Global rotation'));
		expect(keyframes.tracks[ROT].enabled).toBe(true);
	});

	it('writes a keyframe at the playhead when the track is enabled', async () => {
		keyframes.setTrackEnabled(ROT, true);
		animationState.progress = 0.5;
		render(KaleidoscopeSection);
		await userEvent.fill(page.getByLabelText('Global rotation', { exact: true }), '120');
		const kf = keyframes.tracks[ROT].keyframes.find((k) => Math.abs(k.time - 0.5) < 1e-3);
		expect(kf?.value).toBe(120);
	});

	it('reflects the authored keyframe in the paused preview', async () => {
		keyframes.setTrackEnabled(ROT, true);
		animationState.progress = 0.5;
		animationState.isPlaying = false;
		render(KaleidoscopeSection);
		await userEvent.fill(page.getByLabelText('Global rotation', { exact: true }), '210');
		expect(kaleidoscope.globalRotation).toBeCloseTo(210, 4);
	});
});
