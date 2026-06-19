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

describe('KaleidoscopeSection', () => {
	beforeEach(() => setKaleidoscopeEnabled(false));

	// Shared keyframes singleton: disarm tracks this file enabled so it does not pollute
	// other specs in the browser project (e.g. keyframes hasEnabledTracks).
	afterEach(() => {
		for (const id of Object.keys(keyframes.tracks)) keyframes.setTrackEnabled(id, false);
	});

	it('toggles kaleidoscope mode through the enable checkbox', async () => {
		render(KaleidoscopeSection);
		await userEvent.click(page.getByLabelText('Modalità caleidoscopio'));
		expect(kaleidoscope.enabled).toBe(true);
	});

	it('updates sectors from the range input', async () => {
		render(KaleidoscopeSection);
		await userEvent.fill(page.getByLabelText('Settori', { exact: true }), '12');
		expect(kaleidoscope.sectors).toBe(12);
	});

	// Each slider must route to its OWN setter — guards against copy-paste wiring bugs
	// across the structurally-identical control blocks.
	const rangeCases: ReadonlyArray<readonly [string, string, () => number]> = [
		['Ripetizioni', '5', () => kaleidoscope.repeat],
		['Distanza dal centro', '0.5', () => kaleidoscope.offsetDistance],
		['Scala globale', '2', () => kaleidoscope.scale],
		['Dimensione tessera', '1.5', () => kaleidoscope.tileSize],
		['Rotazione tessera', '90', () => kaleidoscope.tileRotation],
		['Rotazione tappeto', '45', () => kaleidoscope.carpetRotation],
		['Rotazione globale', '120', () => kaleidoscope.globalRotation]
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
		await userEvent.click(page.getByLabelText('Anima Settori'));
		expect(keyframes.tracks['kaleidoscope.sectors'].enabled).toBe(true);
	});

	it('wires the circular-mask, live-tile and tile-background checkboxes', async () => {
		setCircularMask(true);
		setLiveTile(false);
		setTileBackground(false);
		render(KaleidoscopeSection);

		await userEvent.click(page.getByLabelText('Maschera circolare'));
		expect(kaleidoscope.circularMask).toBe(false);

		await userEvent.click(page.getByLabelText('Tessera viva'));
		expect(kaleidoscope.liveTile).toBe(true);

		await userEvent.click(page.getByLabelText('Sfondo tessera'));
		expect(kaleidoscope.tileBackground).toBe(true);
		expect(kaleidoscope.drawBackground).toBe(false);
	});

	it('shows "Aggiorna istantanea" only while the live tile is off', async () => {
		setLiveTile(false);
		render(KaleidoscopeSection);
		await expect.element(page.getByText('Aggiorna istantanea')).toBeInTheDocument();
	});

	it('shows the kaleidoscope background color input only when tile background is off', async () => {
		setTileBackground(false);
		render(KaleidoscopeSection);
		await expect.element(page.getByLabelText('Sfondo caleidoscopio')).toBeInTheDocument();
	});
});

describe('KaleidoscopeSection rotation keyframing', () => {
	beforeEach(() => {
		keyframes.ensureTrack(ROT);
		for (const k of [...keyframes.tracks[ROT].keyframes]) keyframes.deleteKeyframe(ROT, k.id);
		keyframes.setTrackEnabled(ROT, false);
		animationState.progress = 0;
	});

	it('enables the rotation track via the stopwatch', async () => {
		render(KaleidoscopeSection);
		await userEvent.click(page.getByLabelText('Anima Rotazione globale'));
		expect(keyframes.tracks[ROT].enabled).toBe(true);
	});

	it('writes a keyframe at the playhead when the track is enabled', async () => {
		keyframes.setTrackEnabled(ROT, true);
		animationState.progress = 0.5;
		render(KaleidoscopeSection);
		await userEvent.fill(page.getByLabelText('Rotazione globale', { exact: true }), '120');
		const kf = keyframes.tracks[ROT].keyframes.find((k) => Math.abs(k.time - 0.5) < 1e-3);
		expect(kf?.value).toBe(120);
	});

	it('reflects the authored keyframe in the paused preview', async () => {
		keyframes.setTrackEnabled(ROT, true);
		animationState.progress = 0.5;
		animationState.isPlaying = false;
		render(KaleidoscopeSection);
		await userEvent.fill(page.getByLabelText('Rotazione globale', { exact: true }), '210');
		expect(kaleidoscope.globalRotation).toBeCloseTo(210, 4);
	});
});
