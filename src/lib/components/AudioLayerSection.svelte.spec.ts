import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';
import AudioLayerSection from './AudioLayerSection.svelte';
import { animationState, setLayerEnabled } from '$lib/state/animation';
import { keyframes } from '$lib/state/keyframes.svelte';
import { switchLocale } from '$lib/state/locale.svelte';

const perRing = createRawSnippet(() => ({ render: () => `<p>per-ring marker</p>` }));

describe('AudioLayerSection', () => {
	beforeEach(() => {
		switchLocale('en');
		setLayerEnabled('audioBars', false);
	});
	afterEach(() => {
		for (const id of Object.keys(keyframes.tracks)) keyframes.setTrackEnabled(id, false);
	});

	it('the layer toggle flips the layer state', async () => {
		render(AudioLayerSection, {
			layerKey: 'audioBars',
			title: 'Audio Bars',
			params: [],
			inputHint: 'hint',
			perRing
		});
		await userEvent.click(page.getByTestId('layer-toggle-audioBars'));
		expect(animationState.layers.audioBars).toBe(true);
	});

	it('renders the audio-source select and the per-ring snippet', async () => {
		render(AudioLayerSection, {
			layerKey: 'audioBars',
			title: 'Audio Bars',
			params: [],
			inputHint: 'hint',
			perRing
		});
		expect(page.getByLabelText('Audio source').query()).not.toBeNull();
		await expect.element(page.getByText('per-ring marker')).toBeInTheDocument();
	});
});
