import { page } from 'vitest/browser';
import { describe, expect, it, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import EditorPage from './+page.svelte';
import { switchLocale } from '$lib/state/locale.svelte';

describe('Editor page', () => {
	beforeEach(() => switchLocale('en'));

	it('renders the Rings add button but not the Animation section', async () => {
		render(EditorPage);
		await expect.element(page.getByRole('button', { name: 'Add Ring' })).toBeInTheDocument();
		await expect.element(page.getByText('Animation', { exact: true })).not.toBeInTheDocument();
	});

	it('no longer shows the kaleidoscope panel', async () => {
		render(EditorPage);
		expect(page.getByText('Kaleidoscope', { exact: true }).query()).toBeNull();
		expect(page.getByLabelText('Sectors', { exact: true }).query()).toBeNull();
	});
});
