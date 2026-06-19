import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ApplyToRingSheet from './ApplyToRingSheet.svelte';
import type { Path, PathLibraryEntry, Ring } from '$lib/types';

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
		copies: 8,
		color: '#000',
		templatePath: { cmds: [...PATH.cmds], crds: [...PATH.crds] },
		secondaryTemplatePath: null,
		morphT: 0,
		ringHeight: 0.25
	};
}

describe('ApplyToRingSheet', () => {
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
		await expect.element(page.getByRole('radio', { name: 'Entrambe' })).toBeDisabled();
	});

	it('confirm calls onapply with the chosen ring index and slot', async () => {
		const onapply = vi.fn();
		render(ApplyToRingSheet, {
			props: { open: true, entry: entry(true), rings: [ring(), ring()], onapply }
		});
		await userEvent.selectOptions(page.getByTestId('apply-ring-select'), '1');
		await userEvent.click(page.getByRole('radio', { name: 'Secondaria' }));
		await userEvent.click(page.getByTestId('apply-confirm'));
		expect(onapply).toHaveBeenCalledWith(1, 'secondary');
	});
});
