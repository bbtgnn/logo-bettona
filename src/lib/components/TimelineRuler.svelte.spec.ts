import { page } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TimelineRuler from './TimelineRuler.svelte';
import { animationState } from '$lib/state/animation';
import { kaleidoscope } from '$lib/state/kaleidoscope.svelte';
import { keyframes, KALEIDO_GLOBAL_ROTATION as ROT } from '$lib/state/keyframes.svelte';

describe('TimelineRuler', () => {
	beforeEach(() => {
		animationState.progress = 0;
		animationState.durationSec = 3;
		keyframes.ensureTrack(ROT);
		for (const k of [...keyframes.tracks[ROT].keyframes]) keyframes.deleteKeyframe(ROT, k.id);
		keyframes.setTrackEnabled(ROT, false);
	});

	it('renders a label at each integer second of the duration', async () => {
		animationState.durationSec = 3;
		render(TimelineRuler);
		await expect.element(page.getByText('0s', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('1s', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('2s', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('3s', { exact: true })).toBeInTheDocument();
	});

	it('scrubs progress on ruler click', async () => {
		render(TimelineRuler);
		const ruler = page.getByTestId('timeline-ruler').element() as HTMLElement;
		const rect = ruler.getBoundingClientRect();
		ruler.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				clientX: rect.left + rect.width / 2
			})
		);
		expect(animationState.progress).toBeCloseTo(0.5, 1);
	});

	it('applies the keyframe rotation while scrubbing a paused timeline', async () => {
		keyframes.addKeyframe(ROT, { time: 0, value: 0 });
		keyframes.addKeyframe(ROT, { time: 1, value: 360 });
		keyframes.setTrackEnabled(ROT, true);
		render(TimelineRuler);
		const ruler = page.getByTestId('timeline-ruler').element() as HTMLElement;
		const rect = ruler.getBoundingClientRect();
		ruler.dispatchEvent(
			new PointerEvent('pointerdown', { bubbles: true, clientX: rect.left + rect.width / 2 })
		);
		expect(kaleidoscope.globalRotation).toBeCloseTo(180, 0);
	});
});
