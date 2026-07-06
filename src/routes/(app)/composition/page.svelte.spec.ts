import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CompositionPage from './+page.svelte';
import { switchLocale } from '$lib/state/locale.svelte';
import { setKaleidoscopeEnabled } from '$lib/state/kaleidoscope.svelte';

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

	it('renders the layout switch and gates the kaleidoscope panel on mode', async () => {
		setKaleidoscopeEnabled(false);
		render(CompositionPage);

		await expect.element(page.getByRole('button', { name: 'Poster' })).toBeInTheDocument();
		expect(page.getByLabelText('Sectors', { exact: true }).query()).toBeNull();

		await userEvent.click(page.getByRole('button', { name: 'Kaleidoscope' }));
		await expect.element(page.getByLabelText('Sectors', { exact: true })).toBeInTheDocument();
	});
});
