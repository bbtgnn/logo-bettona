import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import KaleidoscopeAudioSection from './KaleidoscopeAudioSection.svelte';
import { kaleidoscope, setLiveTile } from '$lib/state/kaleidoscope.svelte';
import { animationState, setLayerEnabled } from '$lib/state/animation';
import { switchLocale } from '$lib/state/locale.svelte';

describe('KaleidoscopeAudioSection', () => {
	beforeEach(() => {
		switchLocale('en');
		setLayerEnabled('kaleidoscope', true);
		setLiveTile(false);
	});

	it('toggles the kaleidoscope layer gate', async () => {
		render(KaleidoscopeAudioSection);
		await userEvent.click(page.getByTestId('layer-toggle-kaleidoscope'));
		expect(animationState.layers.kaleidoscope).toBe(false);
	});

	it('toggles the live tile', async () => {
		render(KaleidoscopeAudioSection);
		await userEvent.click(page.getByLabelText('Live tile'));
		expect(kaleidoscope.liveTile).toBe(true);
	});

	it('shows no static look controls', async () => {
		render(KaleidoscopeAudioSection);
		expect(page.getByLabelText('Sectors', { exact: true }).query()).toBeNull();
		expect(page.getByLabelText('Circular mask').query()).toBeNull();
	});
});
