import { page } from 'vitest/browser';
import { describe, expect, it, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import EditorPage from './+page.svelte';
import { switchLocale } from '$lib/state/locale.svelte';
import { composition } from '$lib/state/composition';

describe('Editor page', () => {
	beforeEach(() => switchLocale('en'));

	it('does not render the Animation section', async () => {
		render(EditorPage);
		await expect.element(page.getByText('Animation', { exact: true })).not.toBeInTheDocument();
	});

	it('no longer shows the kaleidoscope panel', async () => {
		render(EditorPage);
		expect(page.getByText('Kaleidoscope', { exact: true }).query()).toBeNull();
		expect(page.getByLabelText('Sectors', { exact: true }).query()).toBeNull();
	});

	it('does not render an "Add Ring" button (creation happens in Tracciati)', async () => {
		render(EditorPage);
		expect(page.getByRole('button', { name: 'Add Ring' }).query()).toBeNull();
	});

	it('shows an empty-state message pointing to Tracciati when there are no rings', async () => {
		composition.rings = [];
		render(EditorPage);
		await expect
			.element(page.getByText('No rings yet. Create one from Tracciati.'))
			.toBeInTheDocument();
	});
});
