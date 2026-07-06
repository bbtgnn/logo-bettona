import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import LayoutModeSwitch from './LayoutModeSwitch.svelte';
import { kaleidoscope, setKaleidoscopeEnabled } from '$lib/state/kaleidoscope.svelte';
import { switchLocale } from '$lib/state/locale.svelte';

describe('LayoutModeSwitch', () => {
	beforeEach(() => {
		switchLocale('en');
		setKaleidoscopeEnabled(false);
	});

	it('selecting Kaleidoscope enables the kaleidoscope', async () => {
		render(LayoutModeSwitch);
		await userEvent.click(page.getByRole('button', { name: 'Kaleidoscope' }));
		expect(kaleidoscope.enabled).toBe(true);
	});

	it('selecting Poster disables the kaleidoscope', async () => {
		setKaleidoscopeEnabled(true);
		render(LayoutModeSwitch);
		await userEvent.click(page.getByRole('button', { name: 'Poster' }));
		expect(kaleidoscope.enabled).toBe(false);
	});

	it('marks the active mode with aria-pressed', async () => {
		render(LayoutModeSwitch);
		await expect
			.element(page.getByRole('button', { name: 'Poster' }))
			.toHaveAttribute('aria-pressed', 'true');
		await expect
			.element(page.getByRole('button', { name: 'Kaleidoscope' }))
			.toHaveAttribute('aria-pressed', 'false');
	});
});
