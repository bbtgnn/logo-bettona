import { page } from 'vitest/browser';
import { describe, expect, it, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CompositionPage from './+page.svelte';
import { switchLocale } from '$lib/state/locale.svelte';

describe('Composition page', () => {
	beforeEach(async () => {
		switchLocale('en');
		await page.viewport(1280, 800);
	});

	it('renders the Canvas panel with the aspect-ratio control', async () => {
		render(CompositionPage);

		await expect.element(page.getByText('Canvas', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByLabelText('Aspect ratio')).toBeInTheDocument();
	});
});
