import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ApplyToRingSheet from './ApplyToRingSheet.svelte';
import type { Path, PathLibraryEntry, Ring } from '$lib/types';
import { switchLocale } from '$lib/state/locale.svelte';
import { newRingId } from '$lib/state/ring-id';

const PATH: Path = { cmds: ['M', 'L', 'Z'], crds: [0, 0, 10, 0] };

function entry(withSecondary: boolean): PathLibraryEntry {
	return {
		id: 'e1',
		name: 'Forma',
		createdAt: 1,
		path: { cmds: [...PATH.cmds], crds: [...PATH.crds] },
		secondaryPath: withSecondary ? { cmds: [...PATH.cmds], crds: [...PATH.crds] } : null
	};
}

function ring(): Ring {
	return {
		id: newRingId(),
		copies: 8,
		color: '#000',
		templatePath: { cmds: [...PATH.cmds], crds: [...PATH.crds] },
		secondaryTemplatePath: null,
		morphT: 0,
		ringHeight: 0.25
	};
}

describe('ApplyToRingSheet', () => {
	beforeEach(() => switchLocale('en'));

	it('lists one option per ring', async () => {
		render(ApplyToRingSheet, {
			props: { open: true, entry: entry(false), rings: [ring(), ring(), ring()], onapply: vi.fn() }
		});
		const select = page.getByTestId('apply-ring-select');
		await expect.element(select).toBeInTheDocument();
		expect((select.element() as HTMLSelectElement).querySelectorAll('option')).toHaveLength(3);
	});

	it('disables the "both" slot when the entry has no secondary path', async () => {
		render(ApplyToRingSheet, {
			props: { open: true, entry: entry(false), rings: [ring()], onapply: vi.fn() }
		});
		await expect.element(page.getByRole('radio', { name: 'Both' })).toBeDisabled();
	});

	it('confirm calls onapply with the chosen ring index and slot', async () => {
		const onapply = vi.fn();
		render(ApplyToRingSheet, {
			props: { open: true, entry: entry(true), rings: [ring(), ring()], onapply }
		});
		await userEvent.selectOptions(page.getByTestId('apply-ring-select'), '1');
		await userEvent.click(page.getByRole('radio', { name: 'Secondary' }));
		await userEvent.click(page.getByTestId('apply-confirm'));
		expect(onapply).toHaveBeenCalledWith(1, 'secondary');
	});

	it('does not apply when the selected ring index is out of range after rings shrink', async () => {
		const onapply = vi.fn();
		const { rerender } = render(ApplyToRingSheet, {
			props: { open: true, entry: entry(false), rings: [ring(), ring(), ring()], onapply }
		});
		await userEvent.selectOptions(page.getByTestId('apply-ring-select'), '2');
		// rings shrink to 1 while the sheet stays open; stale ringIndex (2) is now invalid.
		await rerender({ open: true, entry: entry(false), rings: [ring()], onapply });
		await userEvent.click(page.getByTestId('apply-confirm'));
		expect(onapply).not.toHaveBeenCalled();
	});
});
