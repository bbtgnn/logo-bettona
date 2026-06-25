import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import WorkspaceNav from './WorkspaceNav.svelte';

describe('WorkspaceNav', () => {
	it('renders the three section tabs with hrefs', async () => {
		render(WorkspaceNav);
		await expect.element(page.getByTestId('nav-editor')).toHaveAttribute('href', '/editor');
		await expect.element(page.getByTestId('nav-animate')).toHaveAttribute('href', '/animate');
		await expect.element(page.getByTestId('nav-paths')).toHaveAttribute('href', '/paths');
	});
});
