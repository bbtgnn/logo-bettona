import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';
import Layout from './+layout.svelte';

const emptyChildren = createRawSnippet(() => ({ render: () => '<span></span>' }));

describe('(app) shell layout', () => {
	beforeEach(async () => {
		// The shadcn Sidebar renders an off-canvas Sheet (closed by default) below the
		// `md` breakpoint, which would hide sidebar content from the DOM entirely.
		// Force a desktop-sized viewport so the sidebar's inline content renders.
		await page.viewport(1280, 800);
	});

	it('renders the workspace nav and the persistent canvas wrapper', async () => {
		render(Layout, { props: { children: emptyChildren } });
		await expect.element(page.getByTestId('workspace-nav')).toBeInTheDocument();
		await expect.element(page.getByTestId('app-canvas')).toBeInTheDocument();
	});

	it('renders the section nav inside the sidebar', async () => {
		render(Layout, { props: { children: emptyChildren } });
		const sidebar = page.getByTestId('sidebar-content');
		await expect.element(sidebar.getByTestId('workspace-nav')).toBeInTheDocument();
	});
});
