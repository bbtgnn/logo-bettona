import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TimelineTrack from './TimelineTrack.svelte';
import { keyframes, KALEIDO_GLOBAL_ROTATION as ROT } from '$lib/state/keyframes.svelte';

function reset() {
	keyframes.ensureTrack(ROT);
	for (const k of [...keyframes.tracks[ROT].keyframes]) keyframes.deleteKeyframe(ROT, k.id);
}

describe('TimelineTrack', () => {
	beforeEach(reset);

	it('renders a diamond per keyframe', async () => {
		const id = keyframes.addKeyframe(ROT, { time: 0.5, value: 10 });
		render(TimelineTrack, { paramId: ROT, label: 'Rotazione' });
		await expect.element(page.getByTestId(`kf-${id}`)).toBeInTheDocument();
	});

	it('adds a keyframe on double-click of the empty row', async () => {
		render(TimelineTrack, { paramId: ROT, label: 'Rotazione' });
		const row = page.getByTestId(`track-${ROT}`).element() as HTMLElement;
		const rect = row.getBoundingClientRect();
		row.dispatchEvent(
			new MouseEvent('dblclick', { bubbles: true, clientX: rect.left + rect.width / 2 })
		);
		expect(keyframes.tracks[ROT].keyframes).toHaveLength(1);
		expect(keyframes.tracks[ROT].keyframes[0].time).toBeCloseTo(0.5, 1);
	});

	it('selects a diamond then deletes it', async () => {
		const id = keyframes.addKeyframe(ROT, { time: 0.5, value: 10 });
		render(TimelineTrack, { paramId: ROT, label: 'Rotazione' });
		await userEvent.click(page.getByTestId(`kf-${id}`));
		await userEvent.click(page.getByRole('button', { name: 'Elimina keyframe' }));
		expect(keyframes.tracks[ROT].keyframes).toHaveLength(0);
	});

	it('sets interpolation of the selected keyframe', async () => {
		const id = keyframes.addKeyframe(ROT, { time: 0.5, value: 10 });
		render(TimelineTrack, { paramId: ROT, label: 'Rotazione' });
		await userEvent.click(page.getByTestId(`kf-${id}`));
		await userEvent.selectOptions(page.getByLabelText('Interpolazione keyframe'), 'hold');
		expect(keyframes.tracks[ROT].keyframes[0].interp).toBe('hold');
	});
});
