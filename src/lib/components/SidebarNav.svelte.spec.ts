import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SidebarNav from './SidebarNav.svelte';

describe('SidebarNav', () => {
	it('renders the four section tabs with hrefs in order', async () => {
		render(SidebarNav);
		await expect.element(page.getByTestId('nav-paths')).toHaveAttribute('href', '/paths');
		await expect.element(page.getByTestId('nav-editor')).toHaveAttribute('href', '/editor');
		await expect
			.element(page.getByTestId('nav-composition'))
			.toHaveAttribute('href', '/composition');
		await expect.element(page.getByTestId('nav-animate')).toHaveAttribute('href', '/animate');
		const links = Array.from(document.querySelectorAll('a[data-testid^="nav-"]'));
		expect(links.map((l) => l.getAttribute('data-testid'))).toEqual([
			'nav-paths',
			'nav-editor',
			'nav-composition',
			'nav-animate'
		]);
	});
});
