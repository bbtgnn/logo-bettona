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

	it('renders the placeholder heading and under-construction copy', async () => {
		render(CompositionPage);

		await expect
			.element(page.getByRole('heading', { level: 1, name: 'Composition' }))
			.toBeInTheDocument();
		await expect.element(page.getByText('Under construction')).toBeInTheDocument();
		await expect.element(page.getByTestId('composition-placeholder')).toBeInTheDocument();
	});

	it('includes the workspace nav with the Composizione tab', async () => {
		render(CompositionPage);

		await expect.element(page.getByTestId('workspace-nav')).toBeInTheDocument();
		await expect
			.element(page.getByTestId('nav-composition'))
			.toHaveAttribute('href', '/composition');
	});
});
