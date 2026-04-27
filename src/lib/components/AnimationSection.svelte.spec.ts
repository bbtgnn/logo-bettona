import { page, userEvent } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { tick } from 'svelte';

type RingMock = {
	secondaryTemplatePath: { cmds: string[]; crds: number[] } | null;
	morphT: number;
};

const animationApi = vi.hoisted(() => ({
	animationState: {
		mode: null as 'audioBars' | 'dataSeries' | null,
		isPlaying: false,
		isPaused: false,
		progress: 0.25,
		durationSec: 3,
		loop: false,
		alternate: false
	},
	togglePlay: vi.fn(),
	setAnimationMode: vi.fn(),
	setAnimationDurationSec: vi.fn(),
	setAnimationLoop: vi.fn(),
	setAnimationAlternate: vi.fn(),
	handleCompositionChanged: vi.fn()
}));

const compositionApi = vi.hoisted(() => ({
	composition: {
		rings: [{ secondaryTemplatePath: { cmds: ['M'], crds: [0, 0] }, morphT: 0 }] as RingMock[]
	}
}));

vi.mock('$lib/state/animation', () => animationApi);
vi.mock('$lib/state/composition', () => compositionApi);

import AnimationSection from './AnimationSection.svelte';

describe('AnimationSection', () => {
	beforeEach(() => {
		animationApi.togglePlay.mockClear();
		animationApi.setAnimationMode.mockClear();
		animationApi.setAnimationDurationSec.mockClear();
		animationApi.setAnimationLoop.mockClear();
		animationApi.setAnimationAlternate.mockClear();
		animationApi.handleCompositionChanged.mockClear();
		animationApi.animationState.mode = null;
		compositionApi.composition.rings = [
			{ secondaryTemplatePath: { cmds: ['M'], crds: [0, 0] }, morphT: 0 }
		];
	});

	it('renders playback controls and progress', async () => {
		render(AnimationSection);

		await expect.element(page.getByRole('button', { name: 'Animation' })).toBeInTheDocument();
		await expect.element(page.getByLabelText('Animation mode')).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Play' })).toBeInTheDocument();
		await expect.element(page.getByLabelText('Duration (s)')).toBeInTheDocument();
		await expect.element(page.getByText('25%')).toBeInTheDocument();
	});

	it('wires basic controls to animation state actions', async () => {
		render(AnimationSection);

		await userEvent.click(page.getByRole('button', { name: 'Play' }));
		expect(animationApi.togglePlay).toHaveBeenCalledOnce();

		await userEvent.fill(page.getByLabelText('Duration (s)'), '4.5');
		expect(animationApi.setAnimationDurationSec).toHaveBeenLastCalledWith(4.5);
	});

	it('switches to Data Series mode', async () => {
		render(AnimationSection);

		await userEvent.selectOptions(page.getByLabelText('Animation mode'), 'dataSeries');

		expect(animationApi.setAnimationMode).toHaveBeenLastCalledWith('dataSeries');
	});

	it('shows contextual copy for selected mode', async () => {
		render(AnimationSection);

		await expect
			.element(page.getByText('Data Series mode maps each ring to your configured series values.'))
			.not.toBeInTheDocument();
		await expect
			.element(page.getByText('Audio Bars mode reacts to live frequency bands for each ring.'))
			.not.toBeInTheDocument();

		animationApi.animationState.mode = 'dataSeries';
		render(AnimationSection);
		await expect
			.element(page.getByText('Data Series mode maps each ring to your configured series values.'))
			.toBeInTheDocument();

		animationApi.animationState.mode = 'audioBars';
		render(AnimationSection);
		await expect
			.element(page.getByText('Audio Bars mode reacts to live frequency bands for each ring.'))
			.toBeInTheDocument();
	});

	it('shows warning and disables Play when no rings have secondary paths', async () => {
		compositionApi.composition.rings = [
			{ secondaryTemplatePath: null, morphT: 0 },
			{ secondaryTemplatePath: null, morphT: 0.2 }
		];
		render(AnimationSection);

		await expect
			.element(page.getByText('Animation won’t run until at least one ring has a secondary path.'))
			.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Play' })).toBeDisabled();
	});

	it('hides warning and enables Play when at least one ring has a secondary path', async () => {
		compositionApi.composition.rings = [
			{ secondaryTemplatePath: { cmds: ['M'], crds: [0, 0] }, morphT: 0 },
			{ secondaryTemplatePath: null, morphT: 0.2 }
		];
		render(AnimationSection);

		await expect
			.element(page.getByText('Animation won’t run until at least one ring has a secondary path.'))
			.not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Play' })).toBeEnabled();
	});

	it('checks composition safety when rendered', async () => {
		render(AnimationSection);
		await tick();

		expect(animationApi.handleCompositionChanged).toHaveBeenCalledOnce();
	});
});
