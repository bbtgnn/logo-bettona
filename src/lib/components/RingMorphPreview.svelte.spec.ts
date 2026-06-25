import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { switchLocale } from '$lib/state/locale.svelte';
import type { Path } from '$lib/types';

const PATH: Path = {
	cmds: ['M', 'C', 'C'],
	crds: [20, 117, 59, 117, 32, 82, 61, 62, 83, 47, 101, 66, 180, 67]
};

let shouldThrow = false;
const disposeSpy = vi.fn();

vi.mock('$lib/geometry/render-pipeline', () => ({
	createRenderPipeline: () => ({
		render: () => {
			if (shouldThrow) throw new Error('boom');
		},
		dispose: disposeSpy
	})
}));

import RingMorphPreview from './RingMorphPreview.svelte';

describe('RingMorphPreview', () => {
	beforeEach(() => {
		switchLocale('en');
		shouldThrow = false;
	});

	it('renders the preview canvas for a valid primary path', async () => {
		const { container } = render(RingMorphPreview, {
			path: PATH,
			secondaryPath: PATH,
			morphT: 0.5,
			baseRadius: 5,
			ringIncrement: 2
		});
		await vi.waitFor(() => {
			expect(container.querySelector('[data-testid="ring-morph-preview-canvas"]')).not.toBeNull();
		});
		expect(container.querySelector('[data-testid="ring-morph-preview-placeholder"]')).toBeNull();
	});

	it('shows the placeholder when the render pipeline throws', async () => {
		shouldThrow = true;
		const { container } = render(RingMorphPreview, {
			path: PATH,
			baseRadius: 5,
			ringIncrement: 2
		});
		await vi.waitFor(() => {
			expect(
				container.querySelector('[data-testid="ring-morph-preview-placeholder"]')
			).not.toBeNull();
		});
	});

	it('pins the canvas to an explicit CSS size so flex layouts cannot stretch it', async () => {
		const { container } = render(RingMorphPreview, {
			path: PATH,
			baseRadius: 5,
			ringIncrement: 2,
			size: 160
		});
		await vi.waitFor(() => {
			expect(container.querySelector('[data-testid="ring-morph-preview-canvas"]')).not.toBeNull();
		});
		const el = container.querySelector(
			'[data-testid="ring-morph-preview-canvas"]'
		) as HTMLCanvasElement;
		expect(el.style.width).toBe('160px');
		expect(el.style.height).toBe('160px');
	});

	it('hides the Try button unless showTry is set', async () => {
		render(RingMorphPreview, { path: PATH, baseRadius: 5, ringIncrement: 2 });
		expect(page.getByTestId('ring-morph-preview-try').query()).toBeNull();
	});

	it('toggles the Try button between Try and Stop', async () => {
		render(RingMorphPreview, {
			path: PATH,
			secondaryPath: PATH,
			baseRadius: 5,
			ringIncrement: 2,
			showTry: true
		});
		const btn = page.getByTestId('ring-morph-preview-try');
		await expect.element(btn).toHaveTextContent('Try');
		await userEvent.click(btn);
		await expect.element(btn).toHaveTextContent('Stop');
		await userEvent.click(btn);
		await expect.element(btn).toHaveTextContent('Try');
	});

	it('re-renders without error when morphT changes', async () => {
		const { container, rerender } = render(RingMorphPreview, {
			path: PATH,
			secondaryPath: PATH,
			morphT: 0,
			baseRadius: 5,
			ringIncrement: 2
		});
		await vi.waitFor(() => {
			expect(container.querySelector('[data-testid="ring-morph-preview-canvas"]')).not.toBeNull();
		});
		await rerender({
			path: PATH,
			secondaryPath: PATH,
			morphT: 0.8,
			baseRadius: 5,
			ringIncrement: 2
		});
		expect(container.querySelector('[data-testid="ring-morph-preview-canvas"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="ring-morph-preview-placeholder"]')).toBeNull();
	});

	it('cancels the animation loop on unmount (no orphan rAF)', async () => {
		const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');
		const { unmount } = render(RingMorphPreview, {
			path: PATH,
			secondaryPath: PATH,
			baseRadius: 5,
			ringIncrement: 2,
			showTry: true
		});
		await userEvent.click(page.getByTestId('ring-morph-preview-try'));
		unmount();
		expect(cancelSpy).toHaveBeenCalled();
		cancelSpy.mockRestore();
	});
});
