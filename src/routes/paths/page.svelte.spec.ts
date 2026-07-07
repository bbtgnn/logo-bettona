import { page } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PathsPage from './+page.svelte';
import { pathLibrary, updateEntryPath } from '$lib/state/path-library';
import { composition } from '$lib/state/composition';
import { newRingId } from '$lib/state/ring-id';

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

	it('reflects a live path edit of the selected custom curve', async () => {
		render(PathsPage);
		await page.getByTestId('tracciati-create').click();
		const draft = pathLibrary.entries.find((e) => !e.builtin)!;
		const NEW = { cmds: ['M', 'L'] as ('M' | 'L')[], crds: [1, 1, 9, 9] };
		updateEntryPath(draft.id, NEW);
		// the live-resolved entry (what the preview reads) carries the new path
		const live = pathLibrary.entries.find((e) => e.id === draft.id)!;
		expect(live.path).toEqual(NEW);
	});

	it('opens the apply sheet from the "Use this curve" button', async () => {
		render(PathsPage);
		await page.getByTestId('tracciati-apply').click();
		await expect.element(page.getByTestId('apply-confirm')).toBeInTheDocument();
	});

	it('applying to a new ring appends a ring carrying the selected curve', async () => {
		composition.rings = [];
		render(PathsPage);
		// selected falls back to builtins[0]; capture its path before applying.
		await page.getByTestId('base-curve-builtin-0').click();
		const curve = pathLibrary.entries.find((e) => e.id === 'builtin-0')!;
		await page.getByTestId('tracciati-apply').click();
		await page.getByTestId('apply-target-new').click();
		await page.getByTestId('apply-confirm').click();
		expect(composition.rings).toHaveLength(1);
		expect(composition.rings[0].templatePath).toEqual(curve.path);
	});

	it('applying to an existing ring replaces its primary curve, keeping copies', async () => {
		composition.rings = [
			{
				id: newRingId(),
				copies: 12,
				color: '#000',
				templatePath: { cmds: ['M', 'L'], crds: [0, 0, 1, 1] },
				secondaryTemplatePath: null,
				morphT: 0,
				ringHeight: 0.1
			}
		];
		render(PathsPage);
		await page.getByTestId('base-curve-builtin-0').click();
		const curve = pathLibrary.entries.find((e) => e.id === 'builtin-0')!;
		await page.getByTestId('tracciati-apply').click();
		await page.getByTestId('apply-target-existing-0').click();
		await page.getByTestId('apply-confirm').click();
		expect(composition.rings).toHaveLength(1);
		expect(composition.rings[0].templatePath).toEqual(curve.path);
		expect(composition.rings[0].copies).toBe(12);
	});
});
