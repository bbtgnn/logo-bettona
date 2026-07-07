import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AudioZonesSection from './AudioZonesSection.svelte';
import { animationState, setLayerEnabled } from '$lib/state/animation';
import { keyframes } from '$lib/state/keyframes.svelte';
import { switchLocale } from '$lib/state/locale.svelte';
import { composition } from '$lib/state/composition-persistence.svelte';

describe('AudioZonesSection', () => {
	beforeEach(() => {
		switchLocale('en');
		setLayerEnabled('audioZones', false);
		composition.rings = [
			{
				id: 'ring-zones-test-0',
				color: '#000000',
				templatePath: { cmds: ['M', 'L'], crds: [0, 0, 10, 10] },
				secondaryTemplatePath: null,
				morphT: 0,
				ringHeight: 0.12
			}
		];
	});

	afterEach(() => {
		for (const id of Object.keys(keyframes.tracks)) keyframes.setTrackEnabled(id, false);
	});

	it('switch toggles the audioZones layer on', async () => {
		render(AudioZonesSection);
		await userEvent.click(page.getByTestId('layer-toggle-audioZones'));
		expect(animationState.layers.audioZones).toBe(true);
	});

	it('arming a zones param via its stopwatch enables the keyframe track', async () => {
		keyframes.ensureTrack('audioZones.bass');
		keyframes.setTrackEnabled('audioZones.bass', false);
		render(AudioZonesSection);
		await userEvent.click(page.getByLabelText('Animate Bass · tip'));
		expect(keyframes.tracks['audioZones.bass'].enabled).toBe(true);
	});

	it('renders a per-ring zone config (with preview) for each ring', async () => {
		render(AudioZonesSection);
		await expect.element(page.getByTestId('ring-zone-config-0')).toBeInTheDocument();
		await expect.element(page.getByText('Per-ring intensity')).toBeInTheDocument();
	});

	it('shows the per-ring zone copy in Italian', async () => {
		switchLocale('it');
		render(AudioZonesSection);
		await expect.element(page.getByText('Intensità per anello')).toBeInTheDocument();
		switchLocale('en');
	});
});
