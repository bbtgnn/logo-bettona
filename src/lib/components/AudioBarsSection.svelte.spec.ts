import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AudioBarsSection from './AudioBarsSection.svelte';
import { animationState, setLayerEnabled } from '$lib/state/animation';
import { keyframes } from '$lib/state/keyframes.svelte';
import { switchLocale } from '$lib/state/locale.svelte';

describe('AudioBarsSection', () => {
	beforeEach(() => {
		switchLocale('en');
		setLayerEnabled('audioBars', false);
	});

	afterEach(() => {
		for (const id of Object.keys(keyframes.tracks)) keyframes.setTrackEnabled(id, false);
	});

	it('switch toggles the audioBars layer on', async () => {
		render(AudioBarsSection);
		await userEvent.click(page.getByTestId('layer-toggle-audioBars'));
		expect(animationState.layers.audioBars).toBe(true);
	});

	it('arming a bars param via its stopwatch enables the keyframe track', async () => {
		keyframes.ensureTrack('audioBars.waveCrests');
		keyframes.setTrackEnabled('audioBars.waveCrests', false);
		render(AudioBarsSection);
		await userEvent.click(page.getByLabelText('Animate Wave crests'));
		expect(keyframes.tracks['audioBars.waveCrests'].enabled).toBe(true);
	});
});
