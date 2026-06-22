import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AudioZonesSection from './AudioZonesSection.svelte';
import { animationState, setLayerEnabled } from '$lib/state/animation';
import { switchLocale } from '$lib/state/locale.svelte';

describe('AudioZonesSection', () => {
	beforeEach(() => {
		switchLocale('en');
		setLayerEnabled('audioZones', false);
	});

	it('switch toggles the audioZones layer on', async () => {
		render(AudioZonesSection);
		await userEvent.click(page.getByTestId('layer-toggle-audioZones'));
		expect(animationState.layers.audioZones).toBe(true);
	});
});
