import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import CurveCard from './CurveCard.svelte';
import type { PathLibraryEntry } from '$lib/types';

const ENTRY: PathLibraryEntry = {
	id: 'builtin-0',
	name: 'Curva 1',
	createdAt: 0,
	path: {
		cmds: ['M', 'C', 'C'],
		crds: [20, 134, 52, 134, 39, 95, 68, 75, 90, 61, 146, 62, 180, 65]
	},
	secondaryPath: null,
	builtin: true
};

describe('CurveCard', () => {
	it('calls onuse when Use is clicked in the popover', async () => {
		const onuse = vi.fn();
		render(CurveCard, { entry: ENTRY, onuse, onedit: vi.fn() });
		await page.getByTestId('curve-card-builtin-0').click();
		await page.getByTestId('curve-use-builtin-0').click();
		expect(onuse).toHaveBeenCalledWith(ENTRY);
	});

	it('calls onedit when Edit is clicked in the popover', async () => {
		const onedit = vi.fn();
		render(CurveCard, { entry: ENTRY, onuse: vi.fn(), onedit });
		await page.getByTestId('curve-card-builtin-0').click();
		await page.getByTestId('curve-edit-builtin-0').click();
		expect(onedit).toHaveBeenCalledWith(ENTRY);
	});
});
