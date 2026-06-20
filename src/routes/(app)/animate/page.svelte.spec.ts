import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AnimatePage from './+page.svelte';

describe('Animate page', () => {
	it('renders the Animation controls section', async () => {
		render(AnimatePage);
		await expect.element(page.getByText('Animation', { exact: true })).toBeInTheDocument();
	});

	it('shows the kaleidoscope section with stopwatches (animatable)', async () => {
		render(AnimatePage);
		await expect.element(page.getByLabelText('Anima Rotazione globale')).toBeInTheDocument();
	});
});
