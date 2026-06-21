import { describe, it, expect, beforeEach } from 'vitest';
import { currentLocale, switchLocale } from './locale.svelte';

describe('locale rune', () => {
	beforeEach(() => switchLocale('en'));

	it('reports the current locale', () => {
		expect(currentLocale()).toBe('en');
	});

	it('updates the current locale on switch', () => {
		switchLocale('it');
		expect(currentLocale()).toBe('it');
	});
});
