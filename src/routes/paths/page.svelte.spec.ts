import { page } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PathsPage from './+page.svelte';
import { pathLibrary } from '$lib/state/path-library';

describe('Tracciati v2 page', () => {
	beforeEach(async () => {
		pathLibrary.entries = [];
		// The shadcn Sidebar renders an off-canvas Sheet (closed by default) below the
		// `md` breakpoint, which hides SidebarContent (and its testids) from the DOM.
		// Force a desktop-sized viewport so the sidebar's inline content renders.
		await page.viewport(1280, 800);
	});

	it('seeds builtins and lists them as selectable base curves', async () => {
		render(PathsPage);
		await expect.element(page.getByTestId('base-curve-builtin-0')).toBeInTheDocument();
		await expect.element(page.getByTestId('base-curve-builtin-9')).toBeInTheDocument();
	});

	it('creates a custom curve from the Create button', async () => {
		render(PathsPage);
		await page.getByTestId('tracciati-create').click();
		expect(pathLibrary.entries.filter((e) => !e.builtin)).toHaveLength(1);
	});

	it('shows a preview of the selected curve', async () => {
		render(PathsPage);
		await expect.element(page.getByTestId('tracciati-preview')).toBeInTheDocument();
	});
});
