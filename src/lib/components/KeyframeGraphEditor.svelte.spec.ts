import { page } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import KeyframeGraphEditor from './KeyframeGraphEditor.svelte';
import { keyframes, KALEIDO_GLOBAL_ROTATION as ROT } from '$lib/state/keyframes.svelte';

function reset() {
	keyframes.ensureTrack(ROT);
	for (const k of [...keyframes.tracks[ROT].keyframes]) keyframes.deleteKeyframe(ROT, k.id);
}

describe('KeyframeGraphEditor', () => {
	beforeEach(reset);

	it('shows an empty-state hint (and no curve) when the track has no keyframes', async () => {
		render(KeyframeGraphEditor, { paramId: ROT, min: 0, max: 360 });
		await expect.element(page.getByTestId('graph-empty')).toBeInTheDocument();
		expect(page.getByTestId('graph-curve').query()).toBeNull();
	});

	it('always shows a help caption explaining what the graph does', async () => {
		render(KeyframeGraphEditor, { paramId: ROT, min: 0, max: 360 });
		await expect.element(page.getByTestId('graph-help')).toBeInTheDocument();
	});

	it('draws the curve and a point per keyframe', async () => {
		const id = keyframes.addKeyframe(ROT, { time: 0, value: 0 });
		keyframes.addKeyframe(ROT, { time: 1, value: 360 });
		render(KeyframeGraphEditor, { paramId: ROT, min: 0, max: 360 });
		await expect.element(page.getByTestId('graph-curve')).toBeInTheDocument();
		await expect.element(page.getByTestId(`graph-pt-${id}`)).toBeInTheDocument();
	});

	it('renders a handle for a bezier keyframe', async () => {
		const id = keyframes.addKeyframe(ROT, { time: 0, value: 0, interp: 'bezier' });
		keyframes.addKeyframe(ROT, { time: 1, value: 360, interp: 'bezier' });
		render(KeyframeGraphEditor, { paramId: ROT, min: 0, max: 360 });
		await expect.element(page.getByTestId(`graph-handle-${id}`)).toBeInTheDocument();
	});

	it('drags a point to a new time and value', async () => {
		const id = keyframes.addKeyframe(ROT, { time: 0.2, value: 0 });
		keyframes.addKeyframe(ROT, { time: 0.9, value: 360 });
		render(KeyframeGraphEditor, { paramId: ROT, min: 0, max: 360 });
		const svg = page.getByTestId(`graph-${ROT}`).element() as SVGSVGElement;
		const rect = svg.getBoundingClientRect();
		const pt = page.getByTestId(`graph-pt-${id}`).element() as SVGElement;
		pt.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
		svg.dispatchEvent(
			new PointerEvent('pointermove', {
				bubbles: true,
				pointerId: 1,
				clientX: rect.left + rect.width / 2,
				clientY: rect.top
			})
		);
		svg.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
		const moved = keyframes.tracks[ROT].keyframes.find((k) => k.id === id)!;
		expect(moved.time).toBeCloseTo(0.5, 1);
		expect(moved.value).toBeCloseTo(360, 0);
	});
});
