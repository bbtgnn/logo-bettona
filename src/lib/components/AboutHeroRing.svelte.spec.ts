import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AboutHeroRing from './AboutHeroRing.svelte';

describe('AboutHeroRing', () => {
	it('mounts and renders a canvas', async () => {
		render(AboutHeroRing);

		const wrapper = page.getByTestId('about-hero-ring');
		await expect.element(wrapper).toBeInTheDocument();

		const wrapperElement = await wrapper.element();
		const canvas = wrapperElement.querySelector('canvas');
		expect(canvas, 'Expected a <canvas> inside the hero ring wrapper').not.toBeNull();
	});
});
