import { page } from 'vitest/browser';
import { describe, expect, it, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AboutPage from './+page.svelte';
import { switchLocale } from '$lib/state/locale.svelte';

describe('About page', () => {
	beforeEach(() => switchLocale('en'));

	it('renders Back link, hero title, tagline, hero ring, and both cards', async () => {
		render(AboutPage);

		await expect.element(page.getByTestId('about-back-link')).toBeInTheDocument();
		await expect
			.element(page.getByRole('heading', { level: 1, name: 'logo-bettona' }))
			.toBeInTheDocument();
		await expect
			.element(page.getByText('A tool to generate ring-shaped logos.'))
			.toBeInTheDocument();
		await expect.element(page.getByTestId('about-hero-ring')).toBeInTheDocument();
		await expect
			.element(page.getByRole('heading', { level: 2, name: 'What it is' }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('heading', { level: 2, name: 'How to use it' }))
			.toBeInTheDocument();
	});
});
