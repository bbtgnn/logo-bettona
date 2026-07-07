import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RingMorphConfigItem from './RingMorphConfigItem.svelte';
import { composition } from '$lib/state/composition';
import { switchLocale } from '$lib/state/locale.svelte';
import type { Ring } from '$lib/types';

const PATH = { cmds: ['M', 'L', 'Z'] as ('M' | 'L' | 'Z')[], crds: [0, 0, 10, 0] };

function ring(secondary: boolean): Ring {
	return {
		id: 'test-ring',
		color: '#000',
		templatePath: { cmds: [...PATH.cmds], crds: [...PATH.crds] },
		secondaryTemplatePath: secondary ? { cmds: [...PATH.cmds], crds: [...PATH.crds] } : null,
		morphT: 0,
		ringHeight: 0.25
	};
}

describe('RingMorphConfigItem', () => {
	beforeEach(() => {
		switchLocale('en');
		composition.rings = [ring(false)];
	});

	it('shows Create morph target when the ring has no secondary', async () => {
		render(RingMorphConfigItem, { ring: composition.rings[0], index: 0 });
		await userEvent.click(page.getByRole('button', { name: /Ring 1/ }));
		await expect.element(page.getByRole('button', { name: 'Create morph target' })).toBeInTheDocument();
	});

	it('creating a morph target adds a secondary path to the ring', async () => {
		render(RingMorphConfigItem, { ring: composition.rings[0], index: 0 });
		await userEvent.click(page.getByRole('button', { name: /Ring 1/ }));
		await userEvent.click(page.getByRole('button', { name: 'Create morph target' }));
		expect(composition.rings[0].secondaryTemplatePath).not.toBeNull();
	});

	it('with a secondary, shows the morphT slider and Remove, and removing clears it', async () => {
		composition.rings = [ring(true)];
		render(RingMorphConfigItem, { ring: composition.rings[0], index: 0 });
		await userEvent.click(page.getByRole('button', { name: /Ring 1/ }));
		await expect.element(page.getByRole('button', { name: 'Remove morph target' })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Load from library' })).toBeInTheDocument();
		await userEvent.click(page.getByRole('button', { name: 'Remove morph target' }));
		expect(composition.rings[0].secondaryTemplatePath).toBeNull();
	});

	it('shows the primary reference above Create morph when there is no target', async () => {
		render(RingMorphConfigItem, { ring: composition.rings[0], index: 0 });
		await userEvent.click(page.getByRole('button', { name: /Ring 1/ }));
		expect(page.getByTestId('ring-morph-preview-canvas').query()).not.toBeNull();
		// The primary reference label is shown even before a target exists.
		await expect.element(page.getByText('Primary (reference)')).toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Create morph target' }))
			.toBeInTheDocument();
		// No morph result / Try button before a target exists.
		expect(page.getByTestId('ring-morph-preview-try').query()).toBeNull();
	});

	it('shows the morph preview, primary reference and Try once a target exists', async () => {
		composition.rings = [ring(true)];
		render(RingMorphConfigItem, { ring: composition.rings[0], index: 0 });
		await userEvent.click(page.getByRole('button', { name: /Ring 1/ }));
		expect(page.getByTestId('ring-morph-preview-try').query()).not.toBeNull();
		await expect.element(page.getByText('Primary (reference)')).toBeInTheDocument();
	});
});
