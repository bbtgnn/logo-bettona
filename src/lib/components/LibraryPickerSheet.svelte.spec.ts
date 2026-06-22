import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import LibraryPickerSheet from './LibraryPickerSheet.svelte';
import { pathLibrary, saveEntry } from '$lib/state/path-library';
import { switchLocale } from '$lib/state/locale.svelte';
import type { PathLibraryEntry } from '$lib/types';
import type { ApplySlot } from '$lib/state/path-library';

const PATH = { cmds: ['M', 'L', 'Z'] as ('M' | 'L' | 'Z')[], crds: [0, 0, 10, 0] };

describe('LibraryPickerSheet', () => {
	beforeEach(() => {
		switchLocale('en');
		pathLibrary.entries = [];
		saveEntry(PATH, null);
	});

	it('with a single slot, hides the slot chooser and applies that slot', async () => {
		let applied: { entry: PathLibraryEntry; slot: ApplySlot } | null = null;
		render(LibraryPickerSheet, {
			open: true,
			slots: ['template'],
			onapply: (entry: PathLibraryEntry, slot: ApplySlot) => (applied = { entry, slot })
		});
		await userEvent.click(page.getByTestId(`library-picker-entry-${pathLibrary.entries[0].id}`));
		expect(page.getByText('Slot', { exact: true }).query()).toBeNull(); // no fieldset legend
		await userEvent.click(page.getByTestId('library-picker-confirm'));
		expect(applied).not.toBeNull();
		expect(applied!.slot).toBe('template');
	});

	it('by default shows all three slot options', async () => {
		render(LibraryPickerSheet, { open: true, onapply: () => {} });
		await userEvent.click(page.getByTestId(`library-picker-entry-${pathLibrary.entries[0].id}`));
		await expect.element(page.getByText('Slot', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('Primary')).toBeInTheDocument();
		await expect.element(page.getByText('Secondary')).toBeInTheDocument();
	});
});
