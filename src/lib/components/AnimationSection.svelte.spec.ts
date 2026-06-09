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
		mode: null as 'simple' | 'audioBars' | 'dataSeries' | null,
		isPlaying: false,
		isPaused: false,
		progress: 0.25,
		durationSec: 3,
		loop: false,
		alternate: false,
		audioSource: 'demo' as 'demo' | 'mic' | 'file' | 'off',
		audioBars: {
			smoothing: 0.5,
			minHz: 20,
			maxHz: 20000,
			waveCrests: 3,
			waveAmplitudeGain: 0.3,
			wavePhaseSpeed: 2.2,
			inputGain: 1
		}
	},
	togglePlay: vi.fn(),
	setAnimationMode: vi.fn(),
	setAnimationDurationSec: vi.fn(),
	setAnimationLoop: vi.fn(),
	setAnimationAlternate: vi.fn(),
	handleCompositionChanged: vi.fn(),
	setAudioBarsConfig: vi.fn(),
	setAudioSource: vi.fn(),
	audioSource: { loadFile: vi.fn(), play: vi.fn(), pause: vi.fn() }
}));

const compositionApi = vi.hoisted(() => ({
	composition: {
		rings: [{ secondaryTemplatePath: { cmds: ['M'], crds: [0, 0] }, morphT: 0 }] as RingMock[]
	},
	updateRing: vi.fn()
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
		animationApi.setAudioBarsConfig.mockClear();
		animationApi.setAudioSource.mockClear();
		animationApi.audioSource.loadFile.mockClear();
		animationApi.audioSource.play.mockClear();
		animationApi.audioSource.pause.mockClear();
		animationApi.animationState.mode = null;
		animationApi.animationState.audioSource = 'demo';
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

	it('shows Simple mode option and selects it when mode is simple', async () => {
		animationApi.animationState.mode = 'simple';
		render(AnimationSection);
		await expect.element(page.getByRole('option', { name: 'Simple' })).toBeInTheDocument();
		const select = page.getByLabelText('Animation mode');
		await expect.element(select).toHaveValue('simple');
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

	it('shows the audio source selector and five sliders in audioBars mode', async () => {
		animationApi.animationState.mode = 'audioBars';
		render(AnimationSection);

		await expect.element(page.getByLabelText('Audio source')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Wave crests')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Amplitude gain')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Phase speed')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Smoothing')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Input gain')).toBeInTheDocument();
	});

	it('does not show the audio controls outside audioBars mode', async () => {
		animationApi.animationState.mode = 'simple';
		render(AnimationSection);
		await expect.element(page.getByLabelText('Audio source')).not.toBeInTheDocument();
	});

	it('wires the source selector and a slider to their actions', async () => {
		animationApi.animationState.mode = 'audioBars';
		render(AnimationSection);

		await userEvent.selectOptions(page.getByLabelText('Audio source'), 'mic');
		expect(animationApi.setAudioSource).toHaveBeenLastCalledWith('mic');

		const slider = page.getByLabelText('Phase speed');
		const el = slider.element() as HTMLInputElement;
		el.value = '4';
		el.dispatchEvent(new Event('input', { bubbles: true }));
		expect(animationApi.setAudioBarsConfig).toHaveBeenLastCalledWith({ wavePhaseSpeed: 4 });
	});

	it('enables Play in audioBars mode even with no secondary paths', async () => {
		animationApi.animationState.mode = 'audioBars';
		compositionApi.composition.rings = [
			{ secondaryTemplatePath: null, morphT: 0 },
			{ secondaryTemplatePath: null, morphT: 0.2 }
		];
		render(AnimationSection);

		await expect
			.element(page.getByText('Animation won’t run until at least one ring has a secondary path.'))
			.not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Play' })).toBeEnabled();
	});
});
