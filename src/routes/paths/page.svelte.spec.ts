import { page } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PathsPage from './+page.svelte';
import { pathLibrary } from '$lib/state/path-library';
import { composition } from '$lib/state/composition-persistence.svelte';

describe('Tracciati page', () => {
	beforeEach(() => {
		pathLibrary.entries = [];
		composition.rings = [];
	});

	it('seeds the 10 builtin curves and renders them in the grid', async () => {
		render(PathsPage);
		await expect.element(page.getByTestId('curve-card-builtin-0')).toBeInTheDocument();
		await expect.element(page.getByTestId('curve-card-builtin-9')).toBeInTheDocument();
	});

	it('adds a ring and updates the counter when a curve is used', async () => {
		render(PathsPage);
		await page.getByTestId('curve-card-builtin-0').click();
		await page.getByTestId('curve-use-builtin-0').click();
		expect(composition.rings).toHaveLength(1);
		await expect.element(page.getByTestId('tracciati-ring-count')).toBeInTheDocument();
	});
});
