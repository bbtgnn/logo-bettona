import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PathThumbnail from './PathThumbnail.svelte';
import type { Path } from '$lib/types';

const primary: Path = { cmds: ['M', 'L'], crds: [0, 0, 10, 10] };
const secondary: Path = { cmds: ['M', 'L'], crds: [2, 2, 8, 8] };

describe('PathThumbnail', () => {
	it('renders an svg with the expected d attribute', async () => {
		const { container } = render(PathThumbnail, { path: primary });
		const paths = container.querySelectorAll('svg path');
		expect(paths.length).toBe(1);
		expect(paths[0].getAttribute('d')).toBe('M 0 0 L 10 10');
	});

	it('renders a secondary overlay path when secondaryPath is provided', async () => {
		const { container } = render(PathThumbnail, { path: primary, secondaryPath: secondary });
		const paths = container.querySelectorAll('svg path');
		expect(paths.length).toBe(2);
		expect(paths[1].getAttribute('d')).toBe('M 2 2 L 8 8');
	});

	it('renders placeholder when path helpers throw', async () => {
		const bad: Path = { cmds: ['M', 'L'], crds: [0, 0, 1] }; // bad arity
		const { container } = render(PathThumbnail, { path: bad });
		expect(container.querySelector('svg path')).toBeNull();
		expect(container.textContent).toContain('?');
	});
});
