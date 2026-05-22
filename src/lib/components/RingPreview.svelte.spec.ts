import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Path } from '$lib/types';

const validPath: Path = {
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

import RingPreview from './RingPreview.svelte';

describe('RingPreview', () => {
	it('renders a <canvas> when given a valid path', async () => {
		shouldThrow = false;
		const { container } = render(RingPreview, {
			path: validPath,
			baseRadius: 5,
			ringIncrement: 2
		});

		await vi.waitFor(() => {
			expect(container.querySelector('[data-testid="ring-preview-canvas"]')).not.toBeNull();
		});

		expect(container.querySelector('[data-testid="ring-preview-placeholder"]')).toBeNull();
	});

	it('shows the placeholder when the render pipeline rejects the path', async () => {
		shouldThrow = true;
		const { container } = render(RingPreview, {
			path: validPath,
			baseRadius: 5,
			ringIncrement: 2
		});

		await vi.waitFor(() => {
			expect(container.querySelector('[data-testid="ring-preview-placeholder"]')).not.toBeNull();
		});

		expect(container.textContent).toContain('?');
		expect(container.querySelector('[data-testid="ring-preview-canvas"]')).toBeNull();
	});

	it('calls pipeline.dispose() when the component is unmounted', async () => {
		shouldThrow = false;
		disposeSpy.mockClear();

		const { container, unmount } = render(RingPreview, {
			path: validPath,
			baseRadius: 5,
			ringIncrement: 2
		});

		await vi.waitFor(() => {
			expect(container.querySelector('[data-testid="ring-preview-canvas"]')).not.toBeNull();
		});

		unmount();
		expect(disposeSpy).toHaveBeenCalled();
	});
});
