import { page } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DataSeriesSection from './DataSeriesSection.svelte';
import { switchLocale } from '$lib/state/locale.svelte';

describe('DataSeriesSection', () => {
	beforeEach(() => switchLocale('en'));

	it('renders a disabled switch and the unavailable hint', async () => {
		render(DataSeriesSection);
		await expect.element(page.getByTestId('layer-toggle-dataSeries')).toBeDisabled();
		await expect.element(page.getByText('Mode not available yet.')).toBeInTheDocument();
	});
});
