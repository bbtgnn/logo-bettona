import { page } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RingEditor from './RingEditor.svelte';
import type { Path, Ring } from '$lib/types';
import { setRingExpanded } from '$lib/state/composition';
import { setLayerEnabled } from '$lib/state/animation';
import { switchLocale } from '$lib/state/locale.svelte';

const PATH: Path = { cmds: ['M', 'L', 'Z'], crds: [0, 0, 10, 0] };

function morphRing(): Ring {
	return {
		id: 'test-ring',
		copies: 4,
		color: '#000',
		templatePath: { cmds: [...PATH.cmds], crds: [...PATH.crds] },
		secondaryTemplatePath: { cmds: [...PATH.cmds], crds: [...PATH.crds] },
		morphT: 0.5,
		ringHeight: 0.25
	};
}

describe('RingEditor', () => {
	beforeEach(() => {
		switchLocale('en');
		// Morph controls are only visible while no audio layer overrides the petal.
		setLayerEnabled('audioBars', false);
		setLayerEnabled('audioZones', false);
		setRingExpanded(0, true);
	});

	it('shows only the primary path editor, no morph controls', async () => {
		render(RingEditor, { ring: morphRing(), index: 0 });
		// Morph controls are gone from the editor.
		expect(page.getByRole('button', { name: 'Create morph target' }).query()).toBeNull();
		expect(page.getByRole('button', { name: 'Remove morph target' }).query()).toBeNull();
		expect(page.getByRole('button', { name: 'Secondary' }).query()).toBeNull();
		// The primary drawing + sizing controls stay. The RingCanvas editor is identified
		// by its grid-density slider (the old "Path editor" badge was replaced by it).
		await expect.element(page.getByTestId('grid-density-slider')).toBeInTheDocument();
		await expect.element(page.getByText('Copies')).toBeInTheDocument();
	});
});
