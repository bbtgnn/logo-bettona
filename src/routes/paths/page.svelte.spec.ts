import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PathsPage from './+page.svelte';
import { pathLibrary } from '$lib/state/path-library';
import type { Path, PathLibraryEntry } from '$lib/types';

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
	beforeEach(() => {
		pathLibrary.entries = [entry('a', 'Forma A'), entry('b', 'Forma B')];
	});
	afterEach(() => {
		pathLibrary.entries = [];
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

	it('shows the empty state when the library has no entries', async () => {
		pathLibrary.entries = [];
		render(PathsPage);
		await expect.element(page.getByTestId('paths-empty-state')).toBeInTheDocument();
	});
});
