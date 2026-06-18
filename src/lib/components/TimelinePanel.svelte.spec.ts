import { page, userEvent } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TimelinePanel from './TimelinePanel.svelte';

describe('TimelinePanel', () => {
	it('starts collapsed and expands on toggle', async () => {
		render(TimelinePanel);
		expect(page.getByTestId('timeline-body').query()).toBeNull();
		await userEvent.click(page.getByRole('button', { name: 'Timeline' }));
		await expect.element(page.getByTestId('timeline-body')).toBeInTheDocument();
	});

	it('toggles the graph editor mode', async () => {
		render(TimelinePanel);
		await userEvent.click(page.getByRole('button', { name: 'Timeline' }));
		await userEvent.click(page.getByRole('button', { name: 'Graph Editor' }));
		await expect.element(page.getByTestId('timeline-graph')).toBeInTheDocument();
	});
});
