import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PathsPage from './+page.svelte';
import { pathLibrary } from '$lib/state/path-library';
import { composition } from '$lib/state/composition';
import type { Path, PathLibraryEntry } from '$lib/types';
import { switchLocale } from '$lib/state/locale.svelte';

const PATH: Path = { cmds: ['M', 'L', 'L', 'L', 'Z'], crds: [0, 0, 100, 0, 100, 50, 0, 50] };

function entry(id: string, name: string, withSecondary = false): PathLibraryEntry {
	return {
		id,
		name,
		createdAt: 1,
		path: { cmds: [...PATH.cmds], crds: [...PATH.crds] },
		secondaryPath: withSecondary ? { cmds: [...PATH.cmds], crds: [...PATH.crds] } : null
	};
}

describe('Paths page', () => {
	beforeEach(async () => {
		// Desktop width so the shadcn Sidebar renders its inline (non-Sheet) variant and
		// the path list is present in the DOM (below 768px it becomes a closed mobile sheet).
		await page.viewport(1280, 800);
		switchLocale('en');
		pathLibrary.entries = [entry('a', 'Forma A'), entry('b', 'Forma B')];
	});
	afterEach(() => {
		pathLibrary.entries = [];
		composition.rings = [];
	});

	it('renders a card per saved entry in a vertical list', async () => {
		render(PathsPage);
		await expect.element(page.getByTestId('paths-list')).toBeInTheDocument();
		await expect.element(page.getByTestId('paths-card-a')).toBeInTheDocument();
		await expect.element(page.getByTestId('paths-card-b')).toBeInTheDocument();
	});

	it('selects the first entry by default and marks the selected card', async () => {
		render(PathsPage);
		await expect.element(page.getByTestId('paths-card-a')).toHaveAttribute('aria-current', 'true');
	});

	it('selecting another card moves the selection', async () => {
		render(PathsPage);
		await userEvent.click(page.getByTestId('paths-card-b'));
		await expect.element(page.getByTestId('paths-card-b')).toHaveAttribute('aria-current', 'true');
		expect(page.getByTestId('paths-card-a').element().getAttribute('aria-current')).not.toBe('true');
	});

	it('re-renders the preview canvas when the selection changes', async () => {
		render(PathsPage);
		const first = page.getByTestId('ring-preview-canvas').element();
		await userEvent.click(page.getByTestId('paths-card-b'));
		const second = page.getByTestId('ring-preview-canvas').element();
		expect(second).not.toBe(first);
	});

	it('does not show a "secondary" badge on cards', async () => {
		pathLibrary.entries = [entry('a', 'Forma A', true)];
		render(PathsPage);
		expect(page.getByText('secondary').query()).toBeNull();
	});

	it('shows the empty state when the library has no entries', async () => {
		pathLibrary.entries = [];
		render(PathsPage);
		await expect.element(page.getByTestId('paths-empty-state')).toBeInTheDocument();
	});

	it('enables Apply when an entry is selected and the mark has rings', async () => {
		composition.rings = [
			{
				copies: 8,
				color: '#000',
				templatePath: { cmds: [...PATH.cmds], crds: [...PATH.crds] },
				secondaryTemplatePath: null,
				morphT: 0,
				ringHeight: 0.25
			}
		];
		render(PathsPage);
		await expect.element(page.getByTestId('paths-apply')).toBeEnabled();
	});

	it('disables Apply when the mark has no rings', async () => {
		composition.rings = [];
		render(PathsPage);
		await expect.element(page.getByTestId('paths-apply')).toBeDisabled();
	});

	it('puts the workspace nav behind a collapsible sidebar trigger (no hard indent)', async () => {
		render(PathsPage);
		await expect.element(page.getByRole('button', { name: 'Toggle Sidebar' })).toBeInTheDocument();
		const header = page.getByTestId('paths-header').element() as HTMLElement;
		expect(header.classList.contains('pl-72')).toBe(false);
	});

	it('deletes a path only after confirming', async () => {
		render(PathsPage);
		await userEvent.click(page.getByRole('button', { name: 'Delete Forma A' }));
		// Nothing removed until the confirmation is pressed.
		expect(pathLibrary.entries).toHaveLength(2);
		await userEvent.click(page.getByRole('button', { name: 'Confirm deletion' }));
		expect(pathLibrary.entries.map((e) => e.id)).toEqual(['b']);
	});

	it('cancels a pending deletion', async () => {
		render(PathsPage);
		await userEvent.click(page.getByRole('button', { name: 'Delete Forma A' }));
		await userEvent.click(page.getByRole('button', { name: 'Cancel deletion' }));
		expect(pathLibrary.entries).toHaveLength(2);
	});

	it('renames a path inline after confirming', async () => {
		render(PathsPage);
		await userEvent.click(page.getByRole('button', { name: 'Rename Forma A' }));
		await userEvent.fill(page.getByLabelText('New name'), 'Logo tondo');
		await userEvent.click(page.getByRole('button', { name: 'Confirm rename' }));
		expect(pathLibrary.entries.find((e) => e.id === 'a')?.name).toBe('Logo tondo');
	});

	it('switches to the Anim Library placeholder and hides the path list', async () => {
		render(PathsPage);
		await expect.element(page.getByTestId('paths-list')).toBeInTheDocument();
		await userEvent.selectOptions(page.getByLabelText('Library'), 'anim');
		await expect.element(page.getByTestId('anim-library-placeholder')).toBeInTheDocument();
		expect(page.getByTestId('paths-list').query()).toBeNull();
	});
});
