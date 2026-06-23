import { page } from 'vitest/browser';
import { describe, expect, it, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AnimatePage from './+page.svelte';
import { switchLocale } from '$lib/state/locale.svelte';

describe('Animate page', () => {
	beforeEach(() => switchLocale('en'));

	it('renders the per-layer windows with their switches', async () => {
		render(AnimatePage);
		await expect.element(page.getByTestId('layer-toggle-dataSeries')).toBeInTheDocument();
		await expect.element(page.getByTestId('layer-toggle-audioBars')).toBeInTheDocument();
		await expect.element(page.getByTestId('layer-toggle-audioZones')).toBeInTheDocument();
	});

	it('shows the kaleidoscope section with stopwatches (animatable)', async () => {
		render(AnimatePage);
		await expect.element(page.getByLabelText('Animate Global rotation')).toBeInTheDocument();
	});
});
