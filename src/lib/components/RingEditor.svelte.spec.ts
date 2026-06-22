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

	it('keeps the morph-target controls but no longer renders the morphT slider', async () => {
		render(RingEditor, { ring: morphRing(), index: 0 });
		// The drawing controls stay in the editor.
		await expect.element(page.getByRole('button', { name: 'Remove morph target' })).toBeInTheDocument();
		// The morphT slider + "Morph t:" readout moved to the Simple animate window.
		expect(page.getByText(/Morph t:/i).query()).toBeNull();
	});
});
