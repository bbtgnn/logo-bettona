import { page } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TimelineRuler from './TimelineRuler.svelte';
import { animationState } from '$lib/state/animation';

describe('TimelineRuler', () => {
	beforeEach(() => {
		animationState.progress = 0;
	});

	it('renders a playhead positioned from progress', async () => {
		animationState.progress = 0.5;
		render(TimelineRuler);
		await expect.element(page.getByTestId('playhead')).toBeInTheDocument();
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
});
