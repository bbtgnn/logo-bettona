import { page } from 'vitest/browser';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AnimatableSlider from './AnimatableSlider.svelte';
import { keyframes } from '$lib/state/keyframes.svelte';
import { kaleidoscope } from '$lib/state/kaleidoscope.svelte';

const param = {
	id: 'kaleidoscope.scale',
	label: 'Scala globale',
	min: 0.3,
	max: 3,
	step: 0.05,
	get: () => kaleidoscope.scale,
	set: (v: number) => (kaleidoscope.scale = v)
};

describe('AnimatableSlider', () => {
	beforeEach(() => {
		keyframes.tracks[param.id] = { paramId: param.id, enabled: false, keyframes: [] };
		kaleidoscope.scale = 1;
	});

	// The keyframes store is a shared singleton across the browser test project; disarm any
	// track this file enabled so it does not pollute other specs (e.g. hasEnabledTracks).
	afterEach(() => {
		for (const id of Object.keys(keyframes.tracks)) keyframes.setTrackEnabled(id, false);
	});

	it('arms the track when the stopwatch is toggled on', async () => {
		render(AnimatableSlider, { param });
		const stopwatch = page.getByLabelText('Anima Scala globale');
		await stopwatch.click();
		expect(keyframes.tracks[param.id].enabled).toBe(true);
	});

	it('unarmed slider input sets the value directly (no keyframe)', async () => {
		render(AnimatableSlider, { param });
		const slider = page.getByLabelText('Scala globale', { exact: true });
		await slider.fill('2');
		expect(kaleidoscope.scale).toBe(2);
		expect(keyframes.tracks[param.id].keyframes).toHaveLength(0);
	});

	it('armed slider input upserts a keyframe instead of setting directly', async () => {
		keyframes.tracks[param.id].enabled = true;
		render(AnimatableSlider, { param });
		const slider = page.getByLabelText('Scala globale', { exact: true });
		await slider.fill('2');
		expect(keyframes.tracks[param.id].keyframes.length).toBeGreaterThan(0);
	});

	it('when not animatable: no stopwatch, slider always sets the value directly', async () => {
		// Even with the track armed, a non-animatable slider must ignore arming.
		keyframes.tracks[param.id].enabled = true;
		render(AnimatableSlider, { param, animatable: false });
		expect(page.getByLabelText('Anima Scala globale').query()).toBeNull();
		const slider = page.getByLabelText('Scala globale', { exact: true });
		await slider.fill('2');
		expect(kaleidoscope.scale).toBe(2);
		expect(keyframes.tracks[param.id].keyframes).toHaveLength(0);
	});
});
