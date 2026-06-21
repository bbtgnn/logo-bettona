import { page } from 'vitest/browser';
import { describe, expect, it, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import LanguageSwitcher from './LanguageSwitcher.svelte';
import { currentLocale, switchLocale } from '$lib/state/locale.svelte';

describe('LanguageSwitcher', () => {
	beforeEach(() => switchLocale('en'));

	it('renders eng and ita options with flags', async () => {
		render(LanguageSwitcher);
		await expect.element(page.getByTestId('language-switcher')).toBeInTheDocument();
		await expect.element(page.getByRole('option', { name: /eng/i })).toBeInTheDocument();
		await expect.element(page.getByRole('option', { name: /ita/i })).toBeInTheDocument();
	});

	it('switches the locale when a different option is chosen', async () => {
		render(LanguageSwitcher);
		await page.getByTestId('language-switcher').selectOptions('it');
		expect(currentLocale()).toBe('it');
	});
});
