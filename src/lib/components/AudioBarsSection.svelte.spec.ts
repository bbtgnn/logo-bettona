import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AudioBarsSection from './AudioBarsSection.svelte';
import { animationState, setLayerEnabled } from '$lib/state/animation';
import { switchLocale } from '$lib/state/locale.svelte';

describe('AudioBarsSection', () => {
	beforeEach(() => {
		switchLocale('en');
		setLayerEnabled('audioBars', false);
	});

	it('switch toggles the audioBars layer on', async () => {
		render(AudioBarsSection);
		await userEvent.click(page.getByTestId('layer-toggle-audioBars'));
		expect(animationState.layers.audioBars).toBe(true);
	});
});
