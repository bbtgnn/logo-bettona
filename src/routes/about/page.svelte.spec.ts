import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AboutPage from './+page.svelte';

describe('About page', () => {
	it('renders Back link, hero title, tagline, hero ring, and both cards', async () => {
		render(AboutPage);

		await expect.element(page.getByTestId('about-back-link')).toBeInTheDocument();
		await expect
			.element(page.getByRole('heading', { level: 1, name: 'logo-bettona' }))
			.toBeInTheDocument();
		await expect
			.element(page.getByText('Strumento per generare loghi a forma di anello.'))
			.toBeInTheDocument();
		await expect.element(page.getByTestId('about-hero-ring')).toBeInTheDocument();
		await expect
			.element(page.getByRole('heading', { level: 2, name: "Cos'è" }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('heading', { level: 2, name: 'Come si usa' }))
			.toBeInTheDocument();
	});
});
