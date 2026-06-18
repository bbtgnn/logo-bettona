import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import KaleidoscopeSection from './KaleidoscopeSection.svelte';
import { kaleidoscope, setKaleidoscopeEnabled } from '$lib/state/kaleidoscope.svelte';

describe('KaleidoscopeSection', () => {
	beforeEach(() => setKaleidoscopeEnabled(false));

	it('toggles kaleidoscope mode through the enable checkbox', async () => {
		render(KaleidoscopeSection);
		await userEvent.click(page.getByLabelText('Modalità caleidoscopio'));
		expect(kaleidoscope.enabled).toBe(true);
	});

	it('updates sectors from the range input', async () => {
		render(KaleidoscopeSection);
		await userEvent.fill(page.getByLabelText('Settori'), '12');
		expect(kaleidoscope.sectors).toBe(12);
	});
});
