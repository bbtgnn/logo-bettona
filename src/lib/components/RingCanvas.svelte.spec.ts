import { page } from 'vitest/browser';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RingCanvas from './RingCanvas.svelte';
import { DEFAULT_GRID_OPTIONS } from '$lib/types';
import type { Path } from '$lib/types';

const PATH: Path = { cmds: ['M', 'L'], crds: [20, 100, 180, 100] };

describe('RingCanvas grid controls', () => {
	it('renders the visible/snap toggles and density slider', async () => {
		render(RingCanvas, { templatePath: PATH, gridOptions: DEFAULT_GRID_OPTIONS });
		await expect.element(page.getByTestId('grid-visible-toggle')).toBeInTheDocument();
		await expect.element(page.getByTestId('grid-snap-toggle')).toBeInTheDocument();
		await expect.element(page.getByTestId('grid-density-slider')).toBeInTheDocument();
	});

	it('emits a gridOptions change when the Snap toggle is clicked', async () => {
		const ongridoptionschange = vi.fn();
		render(RingCanvas, { templatePath: PATH, gridOptions: DEFAULT_GRID_OPTIONS, ongridoptionschange });
		await page.getByTestId('grid-snap-toggle').click();
		expect(ongridoptionschange).toHaveBeenCalledWith({ visible: true, snap: true, density: 8 });
	});
});
