import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';
import Layout from './+layout.svelte';

const emptyChildren = createRawSnippet(() => ({ render: () => '<span></span>' }));

describe('(app) shell layout', () => {
	it('renders the workspace nav and the persistent canvas wrapper', async () => {
		render(Layout, { props: { children: emptyChildren } });
		await expect.element(page.getByTestId('workspace-nav')).toBeInTheDocument();
		await expect.element(page.getByTestId('app-canvas')).toBeInTheDocument();
	});
});
