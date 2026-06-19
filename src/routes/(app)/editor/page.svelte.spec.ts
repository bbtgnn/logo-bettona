import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import EditorPage from './+page.svelte';

describe('Editor page', () => {
	it('renders the Rings add button but not the Animation section', async () => {
		render(EditorPage);
		await expect.element(page.getByRole('button', { name: 'Add Ring' })).toBeInTheDocument();
		await expect.element(page.getByText('Animation', { exact: true })).not.toBeInTheDocument();
	});
});
