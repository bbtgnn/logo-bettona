import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { switchLocale } from '$lib/state/locale.svelte';
import { previewPresenter } from './preview-presenter.svelte';
import ExportSection from './ExportSection.svelte';

describe('ExportSection', () => {
	beforeEach(async () => {
		switchLocale('en');
		await page.viewport(1280, 800);
	});

	it('renders SVG/PNG buttons, the include-background toggle and resolution', async () => {
		render(ExportSection);
		await expect.element(page.getByRole('button', { name: 'Export SVG' })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Export PNG' })).toBeInTheDocument();
		await expect.element(page.getByLabelText('Include background')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Resolution')).toBeInTheDocument();
	});

	it('Export SVG calls the shared presenter with the include-background flag', async () => {
		const spy = vi.spyOn(previewPresenter, 'exportSvg').mockImplementation(() => {});
		try {
			render(ExportSection);
			await userEvent.click(page.getByRole('button', { name: 'Export SVG' }));
			expect(spy).toHaveBeenCalledWith({ includeBackground: true });
		} finally {
			spy.mockRestore();
		}
	});

	it('Export PNG passes the selected scale', async () => {
		const spy = vi.spyOn(previewPresenter, 'exportPng').mockImplementation(() => {});
		try {
			render(ExportSection);
			await userEvent.selectOptions(page.getByLabelText('Resolution'), '2');
			await userEvent.click(page.getByRole('button', { name: 'Export PNG' }));
			expect(spy).toHaveBeenCalledWith(expect.objectContaining({ includeBackground: true, scale: 2 }));
		} finally {
			spy.mockRestore();
		}
	});
});
