import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SimpleSection from './SimpleSection.svelte';
import { animationState, setLayerEnabled } from '$lib/state/animation';
import { switchLocale } from '$lib/state/locale.svelte';

describe('SimpleSection', () => {
	beforeEach(() => {
		switchLocale('en');
		setLayerEnabled('simple', true);
	});

	it('switch toggles the simple layer', async () => {
		render(SimpleSection);
		await userEvent.click(page.getByTestId('layer-toggle-simple'));
		expect(animationState.layers.simple).toBe(false);
	});
});
