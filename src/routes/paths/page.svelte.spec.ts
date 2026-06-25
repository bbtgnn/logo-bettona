import { page } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PathsPage from './+page.svelte';
import { pathLibrary, updateEntryPath } from '$lib/state/path-library';
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

	it('Done commits the live edited path, not the pre-edit snapshot', async () => {
		render(PathsPage);
		await page.getByTestId('curve-card-builtin-0').click();
		await page.getByTestId('curve-edit-builtin-0').click();
		// The test runner's viewport is mobile-width, so the shadcn Sidebar renders
		// its content inside an offcanvas Sheet that must be opened explicitly.
		await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
		const draft = pathLibrary.entries.find((e) => !e.builtin)!;
		const EDITED = { cmds: ['M', 'L'] as ('M' | 'L')[], crds: [1, 1, 9, 9] };
		updateEntryPath(draft.id, EDITED); // simulate the canvas live-save
		await page.getByTestId('curve-editor-done').click();
		const ring = composition.rings[composition.rings.length - 1];
		expect(ring.templatePath).toEqual(EDITED);
	});
});
