import { page } from 'vitest/browser';
import { describe, expect, it, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AnimatePage from './+page.svelte';
import { switchLocale } from '$lib/state/locale.svelte';

describe('Animate page', () => {
	beforeEach(() => switchLocale('en'));

	it('renders the Animation controls section', async () => {
		render(AnimatePage);
		await expect.element(page.getByText('Animation', { exact: true })).toBeInTheDocument();
	});

	it('shows the kaleidoscope section with stopwatches (animatable)', async () => {
		render(AnimatePage);
		await expect.element(page.getByLabelText('Animate Global rotation')).toBeInTheDocument();
	});
});
