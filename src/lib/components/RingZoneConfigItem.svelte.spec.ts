import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RingZoneConfigItem from './RingZoneConfigItem.svelte';
import { composition } from '$lib/state/composition';
import { switchLocale } from '$lib/state/locale.svelte';
import type { Ring } from '$lib/types';

const PATH = { cmds: ['M', 'L', 'Z'] as ('M' | 'L' | 'Z')[], crds: [0, 0, 10, 0] };
const DEFAULT = { bass: 0.5, mid: 0.5, treble: 0.5 };

function ring(withOverride: boolean): Ring {
	return {
		id: 'test-ring',
		color: '#000',
		templatePath: { cmds: [...PATH.cmds], crds: [...PATH.crds] },
		secondaryTemplatePath: null,
		morphT: 0,
		ringHeight: 0.25,
		zoneConfig: withOverride ? { ...DEFAULT } : null
	};
}

describe('RingZoneConfigItem', () => {
	beforeEach(() => {
		switchLocale('en');
		composition.rings = [ring(false)];
	});

	it('enabling the override writes a zoneConfig from the default', async () => {
		render(RingZoneConfigItem, { ring: composition.rings[0], index: 0, globalDefault: DEFAULT });
		await userEvent.click(page.getByRole('button', { name: /Ring 1/ }));
		await userEvent.click(page.getByLabelText('Customize zones for this ring'));
		expect(composition.rings[0].zoneConfig).not.toBeNull();
	});

	it('with an override, dragging the Bass slider updates zoneConfig.bass', async () => {
		composition.rings = [ring(true)];
		render(RingZoneConfigItem, { ring: composition.rings[0], index: 0, globalDefault: DEFAULT });
		await userEvent.click(page.getByRole('button', { name: /Ring 1/ }));
		await userEvent.fill(page.getByLabelText('Bass intensity'), '0.8');
		expect(composition.rings[0].zoneConfig!.bass).toBeCloseTo(0.8);
	});
});
