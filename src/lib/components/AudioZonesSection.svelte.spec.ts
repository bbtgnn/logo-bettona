import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AudioZonesSection from './AudioZonesSection.svelte';
import { animationState, setLayerEnabled } from '$lib/state/animation';
import { keyframes } from '$lib/state/keyframes.svelte';
import { switchLocale } from '$lib/state/locale.svelte';

describe('AudioZonesSection', () => {
	beforeEach(() => {
		switchLocale('en');
		setLayerEnabled('audioZones', false);
	});

	afterEach(() => {
		for (const id of Object.keys(keyframes.tracks)) keyframes.setTrackEnabled(id, false);
	});

	it('switch toggles the audioZones layer on', async () => {
		render(AudioZonesSection);
		await userEvent.click(page.getByTestId('layer-toggle-audioZones'));
		expect(animationState.layers.audioZones).toBe(true);
	});

	it('arming a zones param via its stopwatch enables the keyframe track', async () => {
		keyframes.ensureTrack('audioZones.bass');
		keyframes.setTrackEnabled('audioZones.bass', false);
		render(AudioZonesSection);
		await userEvent.click(page.getByLabelText('Animate Bass · tip'));
		expect(keyframes.tracks['audioZones.bass'].enabled).toBe(true);
	});
});
