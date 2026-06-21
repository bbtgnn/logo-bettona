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
		mode: null as 'simple' | 'audioBars' | 'audioZones' | 'dataSeries' | null,
		isPlaying: false,
		isPaused: false,
		progress: 0.25,
		durationSec: 3,
		loop: false,
		alternate: false,
		audioSource: 'demo' as 'demo' | 'mic' | 'file' | 'off',
		elapsedMs: 0,
		audioBars: {
			smoothing: 0.5,
			minHz: 20,
			maxHz: 20000,
			waveCrests: 3,
			waveAmplitudeGain: 0.3,
			wavePhaseSpeed: 2.2,
			inputGain: 1
		},
		audioZones: {
			defaultIntensity: { bass: 0.5, mid: 0.5, treble: 0.5 }
		}
	},
	togglePlay: vi.fn(),
	setAnimationMode: vi.fn(),
	setAnimationDurationSec: vi.fn(),
	setAnimationLoop: vi.fn(),
	setAnimationAlternate: vi.fn(),
	handleCompositionChanged: vi.fn(),
	setAudioBarsConfig: vi.fn(),
	setAudioZonesDefaultIntensity: vi.fn(),
	setAudioSource: vi.fn(),
	audioSource: {
		loadFile: vi.fn(async () => {}),
		clearFile: vi.fn(),
		play: vi.fn(async () => {}),
		pause: vi.fn(),
		stop: vi.fn(),
		setMode: vi.fn(async () => {}),
		readBars: vi.fn(() => [] as number[]),
		readLevel: vi.fn(() => 0),
		getPeaks: vi.fn(() => [] as { min: number; max: number }[]),
		getDuration: vi.fn(() => 0),
		getFileName: vi.fn(() => null as string | null),
		getCurrentTime: vi.fn(() => 0),
		seek: vi.fn(),
		setRegion: vi.fn(),
		getRegion: vi.fn(() => ({ start: 0, end: 0 })),
		setLoopRegion: vi.fn(),
		isLoopRegion: vi.fn(() => false)
	}
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
import { switchLocale } from '$lib/state/locale.svelte';

describe('AnimationSection', () => {
	beforeEach(() => {
		switchLocale('en');
		vi.clearAllMocks();
		animationApi.animationState.mode = null;
		animationApi.animationState.audioSource = 'demo';
		compositionApi.composition.rings = [
			{ secondaryTemplatePath: { cmds: ['M'], crds: [0, 0] }, morphT: 0 }
		];
	});

	it('renders the section header and audio-reactivity toggle', async () => {
		render(AnimationSection);

		await expect.element(page.getByRole('button', { name: 'Animation' })).toBeInTheDocument();
		await expect.element(page.getByTestId('audio-reactivity-toggle')).toBeInTheDocument();
	});

	it('no longer renders the duration input or play control (moved to the timeline)', async () => {
		render(AnimationSection);
		await expect.element(page.getByLabelText('Duration (s)')).not.toBeInTheDocument();
		expect(page.getByRole('button', { name: 'Play' }).query()).toBeNull();
	});

	it('switches the motion source to Data Series when audio reactivity is off', async () => {
		animationApi.animationState.mode = null;
		render(AnimationSection);

		await userEvent.selectOptions(page.getByLabelText('Motion source'), 'dataSeries');

		expect(animationApi.setAnimationMode).toHaveBeenLastCalledWith('dataSeries');
	});

	it('shows the motion-source selector with Simple selected when mode is simple', async () => {
		animationApi.animationState.mode = 'simple';
		render(AnimationSection);
		await expect.element(page.getByRole('option', { name: /Simple/ })).toBeInTheDocument();
		const select = page.getByLabelText('Motion source');
		await expect.element(select).toHaveValue('simple');
	});

	it('audio reactivity toggle is off and hidden audio-type selector when mode is non-audio', async () => {
		animationApi.animationState.mode = 'simple';
		render(AnimationSection);
		await expect.element(page.getByTestId('audio-reactivity-toggle')).not.toBeChecked();
		expect(page.getByLabelText('Reactivity type').query()).toBeNull();
		await expect.element(page.getByLabelText('Motion source')).toBeInTheDocument();
	});

	it('audio reactivity toggle is on and shows the audio-type selector in an audio mode', async () => {
		animationApi.animationState.mode = 'audioBars';
		render(AnimationSection);
		await expect.element(page.getByTestId('audio-reactivity-toggle')).toBeChecked();
		await expect.element(page.getByLabelText('Reactivity type')).toBeInTheDocument();
		// the motion-source selector (Simple/Data Series) is not competing for the slot
		expect(page.getByLabelText('Motion source').query()).toBeNull();
	});

	it('turning audio reactivity on selects an audio mode (timeline is independent)', async () => {
		animationApi.animationState.mode = null;
		render(AnimationSection);
		await userEvent.click(page.getByTestId('audio-reactivity-toggle'));
		expect(animationApi.setAnimationMode).toHaveBeenLastCalledWith('audioBars');
	});

	it('still shows the Data Series contextual copy when that motion source is active', async () => {
		animationApi.animationState.mode = 'dataSeries';
		render(AnimationSection);
		await expect
			.element(page.getByText('Data Series mode maps each ring to your configured series values.'))
			.toBeInTheDocument();
	});

	it('shows the warning when no rings have secondary paths', async () => {
		compositionApi.composition.rings = [
			{ secondaryTemplatePath: null, morphT: 0 },
			{ secondaryTemplatePath: null, morphT: 0.2 }
		];
		render(AnimationSection);

		await expect
			.element(page.getByText('Animation won’t run until at least one ring has a secondary path.'))
			.toBeInTheDocument();
	});

	it('hides the warning when at least one ring has a secondary path', async () => {
		compositionApi.composition.rings = [
			{ secondaryTemplatePath: { cmds: ['M'], crds: [0, 0] }, morphT: 0 },
			{ secondaryTemplatePath: null, morphT: 0.2 }
		];
		render(AnimationSection);

		await expect
			.element(page.getByText('Animation won’t run until at least one ring has a secondary path.'))
			.not.toBeInTheDocument();
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

	it('shows no warning in audioBars mode even with no secondary paths', async () => {
		animationApi.animationState.mode = 'audioBars';
		compositionApi.composition.rings = [
			{ secondaryTemplatePath: null, morphT: 0 },
			{ secondaryTemplatePath: null, morphT: 0.2 }
		];
		render(AnimationSection);

		await expect
			.element(page.getByText('Animation won’t run until at least one ring has a secondary path.'))
			.not.toBeInTheDocument();
	});

	it('renders AudioFilePanel (not the old file controls) when source is file in audioBars mode', async () => {
		animationApi.animationState.mode = 'audioBars';
		animationApi.animationState.audioSource = 'file';
		render(AnimationSection);
		// Old controls are gone
		await expect.element(page.getByText('Play file')).not.toBeInTheDocument();
		await expect.element(page.getByText('Pause file')).not.toBeInTheDocument();
		// AudioFilePanel renders its drop zone (no file loaded in mock)
		await expect.element(page.getByText(/drop audio file|browse/i)).toBeInTheDocument();
	});

	it('shows "Listening" indicator in mic mode', async () => {
		animationApi.animationState.mode = 'audioBars';
		animationApi.animationState.audioSource = 'mic';
		render(AnimationSection);
		await expect.element(page.getByText(/listening/i)).toBeInTheDocument();
	});

	it('shows only one level meter when source is file in audioBars mode', async () => {
		animationApi.animationState.mode = 'audioBars';
		animationApi.animationState.audioSource = 'file';
		render(AnimationSection);
		const meters = page.getByRole('meter');
		// AudioFilePanel has its own meter; AnimationSection must not add a second one
		const els = await meters.elements();
		expect(els.length).toBeLessThanOrEqual(1);
	});
});
