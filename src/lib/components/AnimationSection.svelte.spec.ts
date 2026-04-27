import { page, userEvent } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { tick } from 'svelte';

const animationApi = vi.hoisted(() => ({
	animationState: {
		mode: 'morphSweep',
		isPlaying: false,
		isPaused: false,
		progress: 0.25,
		durationSec: 3,
		loop: false,
		alternate: false
	},
	togglePlay: vi.fn(),
	setAnimationDurationSec: vi.fn(),
	setAnimationLoop: vi.fn(),
	setAnimationAlternate: vi.fn(),
	handleCompositionChanged: vi.fn()
}));

const compositionApi = vi.hoisted(() => ({
	composition: {
		rings: [{ secondaryTemplatePath: null, morphT: 0 }]
	}
}));

vi.mock('$lib/state/animation', () => animationApi);
vi.mock('$lib/state/composition', () => compositionApi);

import AnimationSection from './AnimationSection.svelte';

describe('AnimationSection', () => {
	beforeEach(() => {
		animationApi.togglePlay.mockClear();
		animationApi.setAnimationDurationSec.mockClear();
		animationApi.setAnimationLoop.mockClear();
		animationApi.setAnimationAlternate.mockClear();
		animationApi.handleCompositionChanged.mockClear();
		compositionApi.composition.rings = [{ secondaryTemplatePath: null, morphT: 0 }];
	});

	it('renders playback controls and progress', async () => {
		render(AnimationSection);

		await expect.element(page.getByText('Animation')).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Play' })).toBeInTheDocument();
		await expect.element(page.getByLabelText('Duration (s)')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Loop')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Alternate')).toBeInTheDocument();
		await expect.element(page.getByText('25%')).toBeInTheDocument();
	});

	it('wires controls to animation state actions', async () => {
		render(AnimationSection);

		await userEvent.click(page.getByRole('button', { name: 'Play' }));
		expect(animationApi.togglePlay).toHaveBeenCalledOnce();

		await userEvent.fill(page.getByLabelText('Duration (s)'), '4.5');
		expect(animationApi.setAnimationDurationSec).toHaveBeenLastCalledWith(4.5);

		await userEvent.click(page.getByLabelText('Loop'));
		expect(animationApi.setAnimationLoop).toHaveBeenLastCalledWith(true);

		await userEvent.click(page.getByLabelText('Alternate'));
		expect(animationApi.setAnimationAlternate).toHaveBeenLastCalledWith(true);
	});

	it('checks composition safety when rendered', async () => {
		render(AnimationSection);
		await tick();

		expect(animationApi.handleCompositionChanged).toHaveBeenCalledOnce();
	});
});
