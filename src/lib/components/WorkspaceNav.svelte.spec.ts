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

	it('lists Tracciati first in the nav', async () => {
		render(WorkspaceNav);
		const links = Array.from(document.querySelectorAll('a[data-testid^="nav-"]'));
		expect(links[0]?.getAttribute('data-testid')).toBe('nav-paths');
	});
});
