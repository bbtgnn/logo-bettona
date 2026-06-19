import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TimelinePanel from './TimelinePanel.svelte';
import { keyframes } from '$lib/state/keyframes.svelte';
import { kaleidoscope } from '$lib/state/kaleidoscope.svelte';

describe('TimelinePanel', () => {
	beforeEach(() => {
		for (const id of Object.keys(keyframes.tracks)) delete keyframes.tracks[id];
		kaleidoscope.enabled = true;
	});

	it('renders nothing when kaleidoscope mode is off', async () => {
		kaleidoscope.enabled = false;
		render(TimelinePanel);
		expect(page.getByTestId('timeline-panel').query()).toBeNull();
	});

	it('renders the panel when kaleidoscope mode is on', async () => {
		kaleidoscope.enabled = true;
		render(TimelinePanel);
		await expect.element(page.getByTestId('timeline-panel')).toBeInTheDocument();
	});

	it('starts collapsed and expands on toggle', async () => {
		render(TimelinePanel);
		expect(page.getByTestId('timeline-body').query()).toBeNull();
		await userEvent.click(page.getByRole('button', { name: 'Mostra/nascondi timeline' }));
		await expect.element(page.getByTestId('timeline-body')).toBeInTheDocument();
	});

	it('chevron toggles the panel open and closed', async () => {
		render(TimelinePanel);
		expect(page.getByTestId('timeline-body').query()).toBeNull();
		await userEvent.click(page.getByRole('button', { name: 'Mostra/nascondi timeline' }));
		await expect.element(page.getByTestId('timeline-body')).toBeInTheDocument();
		await userEvent.click(page.getByRole('button', { name: 'Mostra/nascondi timeline' }));
		expect(page.getByTestId('timeline-body').query()).toBeNull();
	});

	it('shows the empty-state hint when no param is armed', async () => {
		render(TimelinePanel);
		await userEvent.click(page.getByRole('button', { name: 'Mostra/nascondi timeline' }));
		await expect.element(page.getByTestId('timeline-empty')).toBeInTheDocument();
	});

	it('renders a track row for an armed param', async () => {
		keyframes.ensureTrack('kaleidoscope.scale');
		keyframes.setTrackEnabled('kaleidoscope.scale', true);
		render(TimelinePanel);
		await userEvent.click(page.getByRole('button', { name: 'Mostra/nascondi timeline' }));
		await expect.element(page.getByTestId('track-kaleidoscope.scale')).toBeInTheDocument();
	});

	it('switches to graph view then back to tracks WITHOUT closing the panel', async () => {
		keyframes.ensureTrack('kaleidoscope.scale');
		keyframes.setTrackEnabled('kaleidoscope.scale', true);
		render(TimelinePanel);
		await userEvent.click(page.getByRole('button', { name: 'Mostra/nascondi timeline' }));
		await userEvent.click(page.getByRole('button', { name: 'Graph Editor' }));
		await expect.element(page.getByTestId('timeline-graph')).toBeInTheDocument();
		// The bug: pressing Timeline used to close the panel. It must return to tracks instead.
		await userEvent.click(page.getByRole('button', { name: 'Timeline', exact: true }));
		await expect.element(page.getByTestId('timeline-tracks')).toBeInTheDocument();
		await expect.element(page.getByTestId('timeline-body')).toBeInTheDocument();
	});
});
