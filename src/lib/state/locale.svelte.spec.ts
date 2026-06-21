import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { currentLocale, switchLocale } from './locale.svelte';

describe('locale rune', () => {
	beforeEach(() => switchLocale('en'));
	// Shared locale singleton across the browser test project: restore the base locale so
	// this file never leaves 'it' behind for specs that assert English UI text.
	afterEach(() => switchLocale('en'));

	it('reports the current locale', () => {
		expect(currentLocale()).toBe('en');
	});

	it('updates the current locale on switch', () => {
		switchLocale('it');
		expect(currentLocale()).toBe('it');
	});
});
