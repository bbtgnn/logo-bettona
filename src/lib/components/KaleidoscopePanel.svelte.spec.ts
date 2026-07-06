import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import KaleidoscopePanel from './KaleidoscopePanel.svelte';
import { kaleidoscope, setCircularMask } from '$lib/state/kaleidoscope.svelte';
import { switchLocale } from '$lib/state/locale.svelte';

describe('KaleidoscopePanel', () => {
	beforeEach(() => switchLocale('en'));

	it('wires a static slider to its setter', async () => {
		render(KaleidoscopePanel);
		await userEvent.fill(page.getByLabelText('Sectors', { exact: true }), '12');
		expect(kaleidoscope.sectors).toBe(12);
	});

	it('toggles the circular mask', async () => {
		setCircularMask(true);
		render(KaleidoscopePanel);
		await userEvent.click(page.getByLabelText('Circular mask'));
		expect(kaleidoscope.circularMask).toBe(false);
	});

	it('shows no enabled checkbox, stopwatches, or audio rows', async () => {
		render(KaleidoscopePanel);
		expect(page.getByLabelText('Kaleidoscope mode').query()).toBeNull();
		expect(page.getByLabelText('Animate Sectors').query()).toBeNull();
		expect(page.getByLabelText('Live tile').query()).toBeNull();
		expect(page.getByTestId('layer-toggle-kaleidoscope').query()).toBeNull();
	});
});
