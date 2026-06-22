import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SimpleSection from './SimpleSection.svelte';
import { animationState, setLayerEnabled } from '$lib/state/animation';
import { composition } from '$lib/state/composition';
import { switchLocale } from '$lib/state/locale.svelte';

describe('SimpleSection', () => {
	beforeEach(() => {
		switchLocale('en');
		setLayerEnabled('simple', true);
	});

	it('switch toggles the simple layer', async () => {
		render(SimpleSection);
		await userEvent.click(page.getByTestId('layer-toggle-simple'));
		expect(animationState.layers.simple).toBe(false);
	});

	it('renders a morph editor per ring', async () => {
		composition.rings = [
			{ copies: 4, color: '#000', templatePath: { cmds: ['M', 'L', 'Z'], crds: [0, 0, 10, 0] }, secondaryTemplatePath: null, morphT: 0, ringHeight: 0.25 },
			{ copies: 4, color: '#000', templatePath: { cmds: ['M', 'L', 'Z'], crds: [0, 0, 10, 0] }, secondaryTemplatePath: null, morphT: 0, ringHeight: 0.25 }
		];
		render(SimpleSection);
		await expect.element(page.getByTestId('ring-morph-config-0')).toBeInTheDocument();
		await expect.element(page.getByTestId('ring-morph-config-1')).toBeInTheDocument();
	});

	it('shows the empty hint when there are no rings', async () => {
		composition.rings = [];
		render(SimpleSection);
		await expect
			.element(page.getByText('Add a ring in the Editor, then create a morph target here.'))
			.toBeInTheDocument();
	});
});
